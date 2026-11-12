// Laurel on NEAR MAINNET. DRY RUN BY DEFAULT: reads mainnet, prints every transaction with the NEAR it moves, sends nothing.
//
//   node tools/deploy_mainnet.mjs                         # the whole plan, read-only
//   node tools/deploy_mainnet.mjs --send --step <name>    # send ONE step, after the human approved it
//
// Before `task`: the secret. node tools/outlayer_mainnet_login.mjs, then in WSL
//   OUTLAYER_NETWORK=mainnet bash tools/secrets.sh near-retention near-retention <evaluator hash>   (≈ 0.5 NEAR deposit)
// Steps, in order (each is idempotent: what already exists on mainnet is skipped):
//   accounts  create laurel.<root> (contract), p1.<root> (model maker), guest.<root> (site button), agent.<root>
//   deploy    deploy wasm/bursa.wasm (the same build verify_claims checks on testnet) and init it: owner <root>,
//             outlayer.near, the same pinned evaluator 8b80010f…
//   task      create the NEAR account retention task, deadline --minutes from now (default 45)
//   models    p1 submits two baselines (the testnet #7 and #8 bytes) and has OutLayer score them in the TEE;
//             the split-A readings must equal testnet's (same rows, same evaluator), else it stops
//   close     after the deadline, close_task (split B picks the champion)
//   clients   guest and agent: function-call keys limited to predict_task/predict on the contract, prepaid credit
//   ask       the agent's key buys 3 predictions from the champion (public holdout rows), paid on-chain
//
// Needs in ../.env: MAINNET_ACCOUNT_ID / MAINNET_PRIVATE_KEY (tools/mainnet_key.ps1 writes them without showing the key),
// about 5 NEAR on that account, and the task's private splits stored as an OutLayer MAINNET secret owned by
// MAINNET_SECRETS_ACCOUNT (default: the root account), profile `near-retention`, bound to the evaluator hash.
// New keys are written to .env BEFORE the transaction that uses them, so a crash never strands an account.
import fs from "node:fs";
import path from "node:path";
import { saveEnv, json, sleep, errMsg, root, here, Account, KeyPair, actions, teraToGas, nearToYocto, yoctoToNear } from "./lib.mjs";
import { JsonRpcProvider } from "near-api-js";

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const SEND = args.includes("--send");
const STEP = opt("step", null);
const STEPS = ["accounts", "deploy", "task", "models", "close", "clients", "ask"];
if (SEND && !STEPS.includes(STEP)) { console.log(`--send needs --step <${STEPS.join("|")}>: mainnet steps are sent one at a time`); process.exit(2); }

const RPC = opt("rpc", process.env.MAINNET_RPC || "https://rpc.mainnet.fastnear.com");
const EXPLORER = "https://nearblocks.io/txns/";
const OUTLAYER = "outlayer.near";
const EVALUATOR_URL = process.env.EVALUATOR_URL || "https://nh-spike-wasm.vercel.app/8b80010fc79259c9f5d95183a660e79ad7a450fdfceed3e8ce0924f296b60ac3.wasm";
const EVALUATOR_HASH = "8b80010fc79259c9f5d95183a660e79ad7a450fdfceed3e8ce0924f296b60ac3";
const ROOT = process.env.MAINNET_ACCOUNT_ID || "";
const SECRETS_ACCOUNT = process.env.MAINNET_SECRETS_ACCOUNT || ROOT;
const PROFILE = "near-retention";
const MINUTES = Number(opt("minutes", "45"));
const FUND = { laurel: "3.05", p1: "0.5", guest: "0.3", agent: "0.15" };          // NEAR moved into each sub-account
const CREDIT = { guest: "0.2", agent: "0.08" };                                     // prediction credit (≈ 200 / 80 calls)
const MODELS = [["weak", 8350], ["mid", 8200]];                                     // tasks/near-retention/out/<name>/model.bin, testnet split A
const DS = path.join(root, "tasks", "near-retention");
const spec = JSON.parse(fs.readFileSync(path.join(DS, "features.json"), "utf8"));
const holdout = fs.readFileSync(path.join(DS, "public_holdout.csv"), "utf8").trim().split("\n").slice(1).map((l) => l.split(",").map(Number));
const provider = new JsonRpcProvider({ url: RPC });
const out = { when: new Date().toISOString(), network: "mainnet", root: ROOT, send: SEND, step: STEP, txs: [] };
const outFile = path.join(here, "out", "deploy_mainnet.json");
const prev = fs.existsSync(outFile) ? JSON.parse(fs.readFileSync(outFile, "utf8")) : null;
const save = () => { if (SEND) { out.txs = [...(prev?.txs || []), ...out.txs]; fs.writeFileSync(outFile, json(out) + "\n"); } };

// ---------- read-only helpers ----------
async function rpcQuery(params) {
  try { return await provider.query(params); } catch (e) { return { __error: errMsg(e) }; }
}
async function accountState(id) {
  const r = await rpcQuery({ request_type: "view_account", finality: "final", account_id: id });
  return r.__error ? null : r;
}
async function view(contract, method, a = {}) {
  const r = await rpcQuery({ request_type: "call_function", finality: "final", account_id: contract, method_name: method, args_base64: Buffer.from(JSON.stringify(a)).toString("base64") });
  if (r.__error) throw new Error(r.__error);
  return JSON.parse(Buffer.from(r.result).toString());
}
const near = (y) => yoctoToNear(BigInt(y), 4);

// ---------- the plan ----------
const plan = [];   // { step, what, near (moved), spent (estimate of what is consumed) }
const add = (step, what, moved = "0", spent = "0.001") => plan.push({ step, what, moved: Number(moved), spent: Number(spent) });
const sub = (p) => `${p}.${ROOT || "<root>.near"}`;

async function send(label, fn) {
  if (!SEND) return null;
  for (let attempt = 1; ; attempt++) {
    try {
      const r = await fn();
      const hash = r?.transaction?.hash;
      const failure = r?.status?.Failure;
      const result = r?.status?.SuccessValue != null ? Buffer.from(r.status.SuccessValue, "base64").toString() : null;
      out.txs.push({ label, hash, ok: !failure, result });
      console.log(`  ${failure ? "FAILED" : "ok"}  ${label}  ${hash ? EXPLORER + hash : ""}${result ? `  → ${result.slice(0, 120)}` : ""}`);
      save();
      if (failure) throw new Error(`${label}: ${JSON.stringify(failure).slice(0, 400)}`);
      await sleep(1200);
      return { r, hash, result };
    } catch (e) {
      const m = errMsg(e);
      if (!/429|Rate limit|ECONNRESET|fetch failed|timeout/i.test(m) || attempt >= 4) { console.log(`[STOP] ${label}: ${m.slice(0, 300)}`); throw e; }
      console.log(`  [retry ${attempt}] ${label}`); await sleep(4000 * attempt);
    }
  }
}
const rootAcc = () => new Account(ROOT, provider, process.env.MAINNET_PRIVATE_KEY);
function subAcc(name) {
  const id = process.env[`MAINNET_${name.toUpperCase()}_ID`], key = process.env[`MAINNET_${name.toUpperCase()}_PRIVATE_KEY`];
  return id && key ? new Account(id, provider, key) : null;
}
const callFn = (acc, contract, method, a, { deposit = "0", gas = "100" } = {}) =>
  acc.signAndSendTransaction({ receiverId: contract, actions: [actions.functionCall(method, a, teraToGas(gas), nearToYocto(deposit))] });

// ---------- steps ----------
const C = sub("laurel");
const run = (name) => !SEND || STEP === name;

async function stepAccounts() {
  for (const [p, amount] of Object.entries(FUND)) {
    const id = sub(p), st = ROOT ? await accountState(id) : null;
    if (st) { console.log(`  exists  ${id} (${near(st.amount)} NEAR)`); continue; }
    add("accounts", `create ${id} with ${amount} NEAR (its own new full-access key, saved to .env as MAINNET_${p.toUpperCase()}_*)`, amount, "0.002");
    if (SEND && run("accounts")) {
      const kp = KeyPair.fromRandom("ed25519");
      saveEnv({ [`MAINNET_${p.toUpperCase()}_ID`]: id, [`MAINNET_${p.toUpperCase()}_PRIVATE_KEY`]: kp.toString() });
      await send(`create ${id}`, () => rootAcc().createSubAccount({ accountOrPrefix: p, publicKey: kp.getPublicKey(), nearToTransfer: nearToYocto(amount) }));
    }
  }
}

async function stepDeploy() {
  const st = ROOT ? await accountState(C) : null;
  if (st && st.code_hash !== "11111111111111111111111111111111") { console.log(`  deployed  ${C} code_hash ${st.code_hash}`); return; }
  const wasm = fs.readFileSync(path.join(root, "wasm", "bursa.wasm"));
  add("deploy", `deploy wasm/bursa.wasm (${wasm.length.toLocaleString("en-US")} B, locks ≈ ${(wasm.length / 1e5).toFixed(2)} NEAR of ${C}'s balance) + new(owner ${ROOT || "<root>"}, ${OUTLAYER}, evaluator ${EVALUATOR_HASH.slice(0, 8)}…)`, "0", "0.01");
  if (SEND && run("deploy")) {
    const c = subAcc("laurel"); if (!c) throw new Error("MAINNET_LAUREL_* missing: run --step accounts first");
    await send("deploy + new", () => c.signAndSendTransaction({ receiverId: C, actions: [actions.deployContract(new Uint8Array(wasm)), actions.functionCall("new", { owner: ROOT, outlayer: OUTLAYER, evaluator_url: EVALUATOR_URL, evaluator_hash: EVALUATOR_HASH }, teraToGas("50"), 0n)] }));
    const [, h] = await view(C, "get_evaluator");
    console.log(`  pinned evaluator ${h} ${h === EVALUATOR_HASH ? "= the testnet one" : "MISMATCH"}`);
  }
}

async function currentTask() {
  try { return await view(C, "get_task_by_slug", { slug: spec.slug }); } catch { return null; }
}

async function stepTask() {
  const t = await currentTask();
  if (t) { console.log(`  task ${t.task_id} ${t.slug} exists, deadline ${new Date(Number(BigInt(t.deadline_ns) / 1_000_000n)).toISOString()}, closed ${t.closed}`); return; }
  add("task", `create_task ${spec.slug} (22 features, fee 0.001 NEAR per prediction, submission fee 0.1 NEAR, 3 entries per account, deadline +${MINUTES} min, secret ${SECRETS_ACCOUNT || "<root>"}/${PROFILE}); deposit 0.05, unused part refunded`, "0.05", "0.01");
  if (SEND && run("task")) {
    const deadline_ns = (BigInt(Date.now() + MINUTES * 60_000) * 1_000_000n).toString();
    await send(`create_task ${spec.slug}`, () => callFn(rootAcc(), C, "create_task", {
      title: spec.title.slice(0, 80), slug: spec.slug, description_url: "https://github.com/agadape/laurel/blob/main/tasks/near-retention/README.md",
      n_features: spec.n_features, feature_names: spec.features.map((f) => f.name), secrets_account: SECRETS_ACCOUNT, secrets_profile: PROFILE,
      deadline_ns, fee_per_call: nearToYocto("0.001").toString(), submission_fee: nearToYocto("0.1").toString(), max_per_account: 3,
    }, { deposit: "0.05", gas: "50" }));
  }
}

async function stepModels() {
  const t = await currentTask();
  const mine = t ? (await view(C, "list_submissions", { task_id: t.task_id })).filter((s) => s.owner === sub("p1")) : [];
  for (const [name, expectA] of MODELS) {
    const bytes = fs.readFileSync(path.join(DS, "out", name, "model.bin"));
    const have = mine.find((s) => s.bytes === bytes.length);
    if (have) { console.log(`  ${name}: #${have.submission_id} ${json(have.status)} A ${have.score_a_bps}`); continue; }
    const storage = (bytes.length + 400) / 1e5;
    add("models", `p1 submit_model ${name} (${bytes.length.toLocaleString("en-US")} B): storage ≈ ${storage.toFixed(3)} + submission fee 0.1 (to the task creator, i.e. back to us) + 0.02 margin refunded`, (storage + 0.12).toFixed(3), storage.toFixed(3));
    add("models", `p1 request_score ${name}: 0.1 to OutLayer for the TEE run, unused part refunded; split A must be ${expectA} bps as on testnet`, "0.1", "0.01");
    if (SEND && run("models")) {
      if (!t) throw new Error("no task yet: run --step task first");
      const p1 = subAcc("p1"); if (!p1) throw new Error("MAINNET_P1_* missing");
      const v = await view(C, "validate_model", { task_id: t.task_id, bytes: bytes.toString("base64") });
      if (!v.ok) throw new Error(`${name}: validate_model ${json(v)}`);
      const deposit = yoctoToNear(BigInt(v.storage_cost) + BigInt(t.submission_fee) + BigInt(nearToYocto("0.02")), 6);
      const s = await send(`${name}: submit_model`, () => callFn(p1, C, "submit_model", { task_id: t.task_id, bytes: bytes.toString("base64") }, { deposit, gas: "150" }));
      const id = Number(s.result);
      await send(`${name}: request_score #${id}`, () => callFn(p1, C, "request_score", { submission_id: id }, { deposit: "0.1", gas: "300" }));
      const got = await view(C, "get_submission", { submission_id: id });
      console.log(`  ${name} #${id}: ${json(got.status)} split A ${got.score_a_bps} ${got.score_a_bps === expectA ? "= testnet" : "≠ testnet: STOP and check the secret and the evaluator"}`);
      if (got.score_a_bps !== expectA) throw new Error("split A differs from testnet");
    }
  }
}

async function stepClose() {
  const t = await currentTask();
  if (t?.closed) { console.log(`  task ${t.task_id} closed, champion #${t.winner}`); return; }
  add("close", "close_task after the deadline (permissionless; best split B wins, ties to the earlier entry)", "0", "0.002");
  if (SEND && run("close")) {
    if (!t) throw new Error("no task yet");
    const dl = Number(BigInt(t.deadline_ns) / 1_000_000n);
    if (Date.now() < dl) { console.log(`  waiting ${Math.ceil((dl - Date.now()) / 1000)} s for the deadline`); await sleep(dl - Date.now() + 5000); }
    await send("close_task", () => callFn(rootAcc(), C, "close_task", { task_id: t.task_id }, { gas: "50" }));
    const after = await view(C, "get_task", { task_id: t.task_id });
    console.log(`  champion #${after.winner}; leaderboard ${json(await view(C, "leaderboard", { task_id: t.task_id }))}`);
  }
}

async function stepClients() {
  for (const who of ["guest", "agent"]) {
    const id = sub(who);
    const fcEnv = `MAINNET_${who.toUpperCase()}_FC_PRIVATE_KEY`;
    let haveKey = false;
    if (process.env[fcEnv] && ROOT) {
      const k = await rpcQuery({ request_type: "view_access_key", finality: "final", account_id: id, public_key: KeyPair.fromString(process.env[fcEnv]).getPublicKey().toString() });
      haveKey = !k.__error;
    }
    if (haveKey) console.log(`  ${who}: function-call key present`);
    else add("clients", `${who}: add a function-call key limited to predict_task/predict on ${C} (gas allowance 0.1 NEAR), saved to .env as ${fcEnv}`, "0", "0.001");
    let credit = 0n;
    try { credit = BigInt(await view(C, "get_credit", { account_id: id })); } catch {}
    if (credit < BigInt(nearToYocto("0.01"))) add("clients", `${who}: deposit_credit ${CREDIT[who]} NEAR (pays the model owner 0.001 per prediction; withdrawable)`, CREDIT[who], "0.001");
    else console.log(`  ${who}: credit ${near(credit)} NEAR`);
    if (SEND && run("clients")) {
      const acc = subAcc(who); if (!acc) throw new Error(`MAINNET_${who.toUpperCase()}_* missing`);
      if (!haveKey) {
        const fc = KeyPair.fromRandom("ed25519");
        saveEnv({ [fcEnv]: fc.toString() });
        await send(`${who}: add function-call key`, () => acc.signAndSendTransaction({ receiverId: id, actions: [actions.addFunctionCallAccessKey(fc.getPublicKey(), C, ["predict_task", "predict"], nearToYocto("0.1"))] }));
      }
      if (credit < BigInt(nearToYocto("0.01"))) await send(`${who}: deposit_credit ${CREDIT[who]}`, () => callFn(acc, C, "deposit_credit", {}, { deposit: CREDIT[who], gas: "30" }));
    }
  }
}

async function stepAsk() {
  add("ask", "agent's function-call key: predict_task on 3 public holdout rows (0.001 NEAR each to the champion's owner)", "0", "0.003");
  if (SEND && run("ask")) {
    const t = await currentTask(); if (!t?.closed) throw new Error("task not closed yet");
    const agent = new Account(sub("agent"), provider, process.env.MAINNET_AGENT_FC_PRIVATE_KEY);
    for (const r of [0, 1, 2]) {
      const s = await send(`agent predict_task row ${r}`, () => agent.signAndSendTransaction({ receiverId: C, actions: [actions.functionCall("predict_task", { task_id: t.task_id, features: holdout[r].slice(0, -1) }, teraToGas("30"), 0n)] }));
      console.log(`    row ${r}: raw ${s.result} → label ${Number(s.result) > 0 ? 1 : 0}, true label ${holdout[r].at(-1)}`);
    }
  }
}

// ---------- run ----------
console.log(`Laurel → NEAR MAINNET ${SEND ? `· SENDING step "${STEP}"` : "· DRY RUN (nothing is sent)"}`);
if (!ROOT) console.log("MAINNET_ACCOUNT_ID is not in .env yet (tools/mainnet_key.ps1 adds it): the plan below uses <root>.near and skips balance checks.");
else {
  const st = await accountState(ROOT);
  if (!st) { console.log(`[STOP] ${ROOT} not found on mainnet`); process.exit(1); }
  console.log(`root ${ROOT}: ${near(st.amount)} NEAR`);
}
const ow = ROOT ? await accountState(OUTLAYER) : null;
console.log(`OutLayer ${OUTLAYER}: ${ow ? `code ${ow.code_hash.slice(0, 8)}…` : "(not checked)"} · evaluator ${EVALUATOR_HASH.slice(0, 8)}… from ${new URL(EVALUATOR_URL).host}`);
try {
  for (const [name, fn] of [["accounts", stepAccounts], ["deploy", stepDeploy], ["task", stepTask], ["models", stepModels], ["close", stepClose], ["clients", stepClients], ["ask", stepAsk]]) {
    if (SEND && STEP !== name) continue;
    console.log(`\n[${name}]`);
    await fn();
  }
} catch (e) { console.log(`\n[STOP] ${errMsg(e)}`); save(); process.exit(1); }

if (!SEND) {
  console.log("\nPlan (nothing sent):");
  let moved = 0, spent = 0;
  for (const p of plan) { console.log(`  ${p.step.padEnd(8)} ${p.what}`); moved += p.moved; spent += p.spent; }
  console.log(`\nNEAR moved by these transactions ≈ ${moved.toFixed(2)} (most stays ours: sub-account balances, ≈ 2.9 locked as code storage, credit)`);
  console.log(`NEAR consumed by these transactions (gas, OutLayer runs, model storage) ≈ ${spent.toFixed(2)}`);
  console.log("Before [task]: store the private splits as an OutLayer MAINNET secret (≈ 0.5 NEAR, patched CLI deposit):");
  console.log("  node tools/outlayer_mainnet_login.mjs   then in WSL:  OUTLAYER_NETWORK=mainnet bash tools/secrets.sh near-retention near-retention " + EVALUATOR_HASH);
  console.log(`Recommended balance on ${ROOT || "<root>.near"} before starting: 6 NEAR (≈ 4.9 moved here + 0.5 secret + margin).`);
  console.log(`To send one step after approval: node tools/deploy_mainnet.mjs --send --step ${plan[0]?.step || "accounts"}`);
}
save();
