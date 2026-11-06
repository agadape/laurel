// Upgrade the deployed contract's CODE only (no `new`, no migration): the state layout is unchanged.
//   node tools/upgrade.mjs wasm/bursa.wasm [--yes]
// Signs with FINAL_CONTRACT_ID / FINAL_CONTRACT_PRIVATE_KEY (the contract account's own full-access key), prints the
// wasm sha256 before and after, the deploy tx, and then re-reads a few views to prove the state survived.
import fs from "node:fs";
import crypto from "node:crypto";
import { accountFromEnv, provider, view, summary, actions, errMsg } from "./lib.mjs";

const [wasmPath] = process.argv.slice(2);
if (!wasmPath) { console.log("usage: node tools/upgrade.mjs <wasm> [--yes]"); process.exit(2); }
const wasm = fs.readFileSync(wasmPath);
const sha = crypto.createHash("sha256").update(wasm).digest("hex");
const contract = accountFromEnv("FINAL_CONTRACT_ID", "FINAL_CONTRACT_PRIVATE_KEY");
const C = contract.accountId;
const before = await provider.query({ request_type: "view_account", finality: "final", account_id: C });
console.log(`contract ${C}\n  current code_hash (base58) ${before.code_hash}, storage ${before.storage_usage} B\n  new wasm ${wasmPath}: ${wasm.length} B, sha256 ${sha}`);
const tasksBefore = await view(C, "list_tasks", { from: 0, limit: 20 });
const lbBefore = await view(C, "leaderboard", { task_id: 5 });
console.log(`  state before: ${tasksBefore.length} tasks, task 5 leaderboard ${lbBefore.map((r) => `#${r.submission_id}:${r.score_a_bps}`).join(" ")}`);
if (!process.argv.includes("--yes")) { console.log("\n--yes missing: nothing sent"); process.exit(0); }
try {
  const res = await contract.signAndSendTransaction({ receiverId: C, actions: [actions.deployContract(new Uint8Array(wasm))] });
  const s = summary("deploy (code only)", res);
  if (!s.ok) process.exit(1);
  const after = await provider.query({ request_type: "view_account", finality: "final", account_id: C });
  const tasksAfter = await view(C, "list_tasks", { from: 0, limit: 20 });
  const lbAfter = await view(C, "leaderboard", { task_id: 5 });
  const sub = await view(C, "get_submission", { submission_id: 12 });
  const ls = await view(C, "list_submissions", { task_id: 5 });
  console.log(`\nafter: code_hash ${after.code_hash}, storage ${after.storage_usage} B (was ${before.storage_usage})`);
  console.log(`  ${tasksAfter.length} tasks (was ${tasksBefore.length}); task 5 leaderboard ${lbAfter.map((r) => `#${r.submission_id}:${r.score_a_bps}`).join(" ")}`);
  console.log(`  get_submission(12): a=${sub.score_a_bps} b=${sub.score_b_bps} f1b=${sub.f1_b_bps} raw.b=${JSON.parse(sub.last_outlayer_raw).b}`);
  console.log(`  list_submissions(5): ${ls.map((x) => `#${x.submission_id} b=${x.score_b_bps}`).join(" ")}`);
  const closed = await view(C, "get_submission", { submission_id: 4 });
  console.log(`  closed task 3, get_submission(4): b=${closed.score_b_bps} (must still be visible)`);
  console.log(`\ndeploy tx ${s.hash}\n${s.explorer}`);
} catch (e) {
  console.log("[ERR]", errMsg(e));
  process.exit(1);
}
