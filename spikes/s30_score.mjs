// S30 — ask OutLayer (through our S31 contract) to score a model with the published evaluator and the
// secret test set, then read the score back from the contract.
//   node s30_score.mjs <wasm_url> <sha256> [model_id=1] [secrets_account=NEAR_ACCOUNT_ID] [profile=default]
//   node s30_score.mjs <wasm_url> <sha256> 1 none        -> run WITHOUT secrets (expects "TEST_SET_A missing")
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Account, actions, teraToGas, nearToYocto, yoctoToNear } from "near-api-js";
import { account, accountId, provider, txSummary, json } from "./lib.mjs";

const [wasmUrl, wasmHash, modelIdArg = "1", secretsAccountArg, profile = "default"] = process.argv.slice(2);
if (!wasmUrl || !wasmHash) { console.log("usage: node s30_score.mjs <wasm_url> <sha256> [model_id] [secrets_account|none] [profile]"); process.exit(2); }
const here = path.dirname(fileURLToPath(import.meta.url));
const env = fs.readFileSync(path.join(here, "..", ".env"), "utf8");
const C = env.match(/^NEAR_S31_CONTRACT_ID=(.+)$/m)[1].trim();
const secretsAccount = secretsAccountArg === "none" ? null : (secretsAccountArg ?? accountId);
const modelId = Number(modelIdArg);
const outPath = path.join(here, "s31", "out", "s30_results.json");
const prev = fs.existsSync(outPath) ? JSON.parse(fs.readFileSync(outPath, "utf8")) : { runs: [] };

const before = await account.getBalance();
const t0 = Date.now();
let summary;
try {
  const r = await account.signAndSendTransaction({
    receiverId: C,
    actions: [actions.functionCall("request_score", { model_id: modelId, wasm_url: wasmUrl, wasm_hash: wasmHash, secrets_account: secretsAccount, secrets_profile: profile }, teraToGas("300"), nearToYocto("0.1"))],
  });
  const ms = Date.now() - t0;
  const s = txSummary(`request_score model ${modelId} secrets=${secretsAccount ?? "none"}`, r);
  const after = await account.getBalance();
  const outlayerLogs = s.logs.filter((l) => l.includes("execution_completed") || l.includes("charged") || l.startsWith("score model"));
  summary = { when: new Date().toISOString(), contract: C, model_id: modelId, secrets_account: secretsAccount, wasm_hash: wasmHash, hash: s.hash, explorer: s.explorer, latency_ms: ms, net_cost_near: yoctoToNear(before - after, 6), ok: s.ok, callback_result: s.successValue, outlayer_logs: outlayerLogs, failure: s.failure };
} catch (e) {
  summary = { when: new Date().toISOString(), contract: C, model_id: modelId, secrets_account: secretsAccount, wasm_hash: wasmHash, error: (e?.type ? e.type + ": " : "") + (e?.message ?? String(e)).slice(0, 800) };
  console.log("[ERR]", summary.error);
}
const stored = await provider.callFunction({ contractId: C, method: "get_score", args: { model_id: modelId }, blockQuery: { finality: "optimistic" } }).catch((e) => ({ err: e.message }));
summary.get_score = stored;
console.log("\nget_score ->", json(stored));
prev.runs.push(summary);
fs.writeFileSync(outPath, json(prev) + "\n");
console.log("saved", outPath);
