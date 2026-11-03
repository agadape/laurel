// ML-3 — submit a model to a task and get it scored by the pinned evaluator on OutLayer.
//   node tools/submit.mjs <task_id> <path/to/model.bin> [--as TEAM|FT|MAIN|P1|P2] [--no-score]
// Deposit: storage (1 NEAR / 100 KB) + task.submission_fee + 0.1 NEAR for OutLayer (unused part refunded).
import fs from "node:fs";
import { accountFromEnv, call, view, summary, nearToYocto, yoctoToNear, errMsg } from "./lib.mjs";

const args = process.argv.slice(2);
const [taskIdArg, modelPath] = args;
if (!taskIdArg || !modelPath) { console.log("usage: node tools/submit.mjs <task_id> <model.bin> [--as TEAM|FT|MAIN|P1|P2] [--no-score]"); process.exit(2); }
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const signers = {
  TEAM: ["TEAM_ACCOUNT_ID", "TEAM_PRIVATE_KEY"], FT: ["NEAR_FT_CONTRACT_ID", "NEAR_FT_CONTRACT_PRIVATE_KEY"], MAIN: ["NEAR_ACCOUNT_ID", "NEAR_PRIVATE_KEY"],
  P1: ["P1_ACCOUNT_ID", "P1_PRIVATE_KEY"], P2: ["P2_ACCOUNT_ID", "P2_PRIVATE_KEY"],
};
const signer = accountFromEnv(...signers[opt("as", process.env.P1_ACCOUNT_ID ? "P1" : "FT")]);
const C = process.env.BURSA_CONTRACT_ID || process.env.BURSA_DEV_ID;
const taskId = Number(taskIdArg);
const bytes = fs.readFileSync(modelPath);

try {
  const task = await view(C, "get_task", { task_id: taskId });
  if (!task) throw new Error(`task ${taskId} not found on ${C}`);
  const v = await view(C, "validate_model", { task_id: taskId, bytes: bytes.toString("base64") });
  console.log("validate_model ->", JSON.stringify(v));
  if (!v.ok) process.exit(1);
  const deposit = BigInt(v.storage_cost) + BigInt(task.submission_fee) + nearToYocto("0.02");
  console.log(`submit_model as ${signer.accountId}: ${bytes.length} B, deposit ${yoctoToNear(deposit, 4)} NEAR`);
  const r = await call(signer, C, "submit_model", { task_id: taskId, bytes: bytes.toString("base64") }, { deposit, gas: "150" });
  const s = summary("submit_model", r);
  const id = Number(s.result);
  console.log("\nsubmission_id =", id);
  if (args.includes("--no-score")) process.exit(0);

  const t0 = Date.now();
  const r2 = await call(signer, C, "request_score", { submission_id: id }, { deposit: nearToYocto("0.1"), gas: "300" });
  summary("request_score", r2);
  const sub = await view(C, "get_submission", { submission_id: id });
  console.log(`\nscored in ${Date.now() - t0} ms ->`, JSON.stringify({ status: sub.status, bal_acc_a_bps: sub.score_a_bps, f1_a_bps: sub.f1_a_bps, raw: sub.last_outlayer_raw }, null, 2));
  console.log("\nleaderboard:", JSON.stringify(await view(C, "leaderboard", { task_id: taskId }), null, 2));
} catch (e) {
  console.log("[ERR]", errMsg(e));
  process.exit(1);
}
