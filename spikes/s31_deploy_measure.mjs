// S31 — deploy the bursa spike contract, upload a 100-tree GBDT (197 KB) as data, measure gas for
// upload / predict / predict_batch, and check on-chain predictions against the Python vectors.
//   node s31_deploy_measure.mjs
// Account: NEAR_S31_CONTRACT_ID in .env, else faucet, else a sub-account funded from NEAR_MT_CONTRACT.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Account, KeyPair, actions, teraToGas, nearToYocto, yoctoToNear } from "near-api-js";
import { account, accountId, provider, txSummary, json, sleep } from "./lib.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(here, "..", ".env");
const wasmPath = path.join(here, "s31", "wasm", "s31_bursa_spike.wasm");
const outDir = path.join(here, "s31", "out");
const errMsg = (e) => (e?.type ? e.type + ": " : "") + (e?.message ?? String(e)).slice(0, 400);
const results = { steps: [] };
const tgas = (res) => {
  const g = (res?.transaction_outcome?.outcome?.gas_burnt ?? 0) + (res?.receipts_outcome ?? []).reduce((a, r) => a + (r.outcome?.gas_burnt ?? 0), 0);
  return +(g / 1e12).toFixed(3);
};

async function getContractAccount() {
  let env = fs.readFileSync(envPath, "utf8");
  let m = env.match(/^NEAR_S31_CONTRACT_ID=(.+)$/m);
  if (m) return new Account(m[1].trim(), provider, env.match(/^NEAR_S31_CONTRACT_PRIVATE_KEY=(.+)$/m)[1].trim());
  const kp = KeyPair.fromRandom("ed25519");
  let id = `nh-s31-${Date.now().toString(36)}.testnet`;
  let how = "faucet";
  try {
    const res = await fetch("https://helper.nearprotocol.com/account", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newAccountId: id, newAccountPublicKey: kp.getPublicKey().toString() }),
    });
    if (!res.ok) throw new Error(`faucet ${res.status}: ${(await res.text()).slice(0, 120)}`);
  } catch (e) {
    console.log("faucet failed:", errMsg(e), "-> sub-account of NEAR_MT_CONTRACT");
    const mtId = env.match(/^NEAR_MT_CONTRACT_ID=(.+)$/m)[1].trim();
    const mt = new Account(mtId, provider, env.match(/^NEAR_MT_CONTRACT_PRIVATE_KEY=(.+)$/m)[1].trim());
    id = `s31.${mtId}`;
    how = "sub-account";
    const r = await mt.createSubAccount({ accountOrPrefix: "s31", publicKey: kp.getPublicKey(), nearToTransfer: nearToYocto("6") });
    txSummary("create sub-account", r);
  }
  fs.appendFileSync(envPath, `NEAR_S31_CONTRACT_ID=${id}\nNEAR_S31_CONTRACT_PRIVATE_KEY=${kp.toString()}\n`);
  console.log("contract account:", id, `(${how})`);
  for (let i = 0; i < 10; i++) { try { await provider.viewAccount({ accountId: id }); break; } catch { await sleep(1500); } }
  return new Account(id, provider, kp.toString());
}

const c = await getContractAccount();
const C = c.accountId;
const view = (method, args = {}) => provider.callFunction({ contractId: C, method, args, blockQuery: { finality: "optimistic" } });
const callFrom = (acc, method, args, deposit = 0n, gas = "100") =>
  acc.signAndSendTransaction({ receiverId: C, actions: [actions.functionCall(method, args, teraToGas(gas), deposit)] });

// 1) deploy + init (idempotent: skip if code already there)
const st = await provider.viewAccount({ accountId: C });
const wasm = fs.readFileSync(wasmPath);
if (st.code_hash === "11111111111111111111111111111111") {
  const r = await c.signAndSendTransaction({
    receiverId: C,
    actions: [actions.deployContract(new Uint8Array(wasm)), actions.functionCall("new", { outlayer: "outlayer.testnet" }, teraToGas("50"), 0n)],
  });
  const s = txSummary("deploy+new", r);
  results.steps.push({ step: "deploy+new", hash: s.hash, tgas: tgas(r), wasm_bytes: wasm.length });
} else console.log("already deployed, code_hash", st.code_hash);
const after = await provider.viewAccount({ accountId: C });
console.log(`contract storage ${after.storage_usage} B (~${(after.storage_usage / 1e5).toFixed(2)} NEAR), balance ${yoctoToNear(after.amount, 3)}`);

// 2) upload model (197 KB borsh as base64 arg)
const model = fs.readFileSync(path.join(outDir, "model.bin"));
const vectors = JSON.parse(fs.readFileSync(path.join(outDir, "vectors.json"), "utf8"));
let modelId;
try {
  const r = await callFrom(c, "upload_model", { bytes: model.toString("base64") }, nearToYocto("2.5"), "300");
  const s = txSummary("upload_model", r);
  modelId = Number(s.successValue);
  results.steps.push({ step: "upload_model", hash: s.hash, tgas: tgas(r), model_bytes: model.length, model_id: modelId, logs: s.logs });
} catch (e) { console.log("[ERR] upload_model:", errMsg(e)); results.steps.push({ step: "upload_model", error: errMsg(e) }); }
const after2 = await provider.viewAccount({ accountId: C });
console.log(`storage after upload ${after2.storage_usage} B, balance ${yoctoToNear(after2.amount, 3)} NEAR`);
if (!modelId) { fs.writeFileSync(path.join(outDir, "s31_results.json"), json(results)); process.exit(1); }

// 3) views: info + predictions vs Python vectors
console.log("model_info", json(await view("model_info", { model_id: modelId })));
let agree = 0;
const N = 50;
for (let i = 0; i < N; i++) {
  const raw = await view("predict", { model_id: modelId, features: vectors.rows[i].x });
  if (Number(raw) === vectors.rows[i].raw) agree++;
}
console.log(`view predict agrees with Python on ${agree}/${N} rows`);
results.view_agreement = `${agree}/${N}`;

// 4) gas: predict as a tx (1 row), predict_batch (10 and 50 rows)
for (const [label, method, args] of [
  ["predict x1", "predict", { model_id: modelId, features: vectors.rows[0].x }],
  ["predict_batch x10", "predict_batch", { model_id: modelId, rows: vectors.rows.slice(0, 10).map((r) => r.x) }],
  ["predict_batch x50", "predict_batch", { model_id: modelId, rows: vectors.rows.slice(0, 50).map((r) => r.x) }],
]) {
  try {
    const r = await callFrom(account, method, args, 0n, "300");
    const s = txSummary(label, r);
    const fnGas = (r.receipts_outcome ?? []).map((x) => x.outcome?.gas_burnt ?? 0).sort((a, b) => b - a)[0];
    results.steps.push({ step: label, hash: s.hash, tgas_total: tgas(r), tgas_fn_receipt: +(fnGas / 1e12).toFixed(3), result: s.successValue?.slice(0, 120) });
    console.log(`${label}: total ${tgas(r)} Tgas, function receipt ${(fnGas / 1e12).toFixed(3)} Tgas`);
  } catch (e) { console.log(`[ERR] ${label}:`, errMsg(e)); results.steps.push({ step: label, error: errMsg(e) }); }
}
results.contract = C;
results.model_id = modelId;
fs.writeFileSync(path.join(outDir, "s31_results.json"), json(results) + "\n");
console.log("\nsaved s31/out/s31_results.json");
