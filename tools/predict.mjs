// Call the winning model of a task (predict_task) or a specific submission (predict), paying from prepaid credit.
//   node tools/predict.mjs <task_id> --row 0..99            # features from tasks/<slug>/public_holdout.csv
//   node tools/predict.mjs <task_id> --features 1,24,2,...   # raw integer features
//   node tools/predict.mjs <task_id> --submission 3 ...      # predict on one submission instead of the winner
//   [--as MAIN|FT|TEAM|AGENT] [--deposit 0.02]              # deposit credit first (full-access key)
import fs from "node:fs";
import path from "node:path";
import { accountFromEnv, call, view, summary, root, nearToYocto, yoctoToNear, errMsg, datasetDir } from "./lib.mjs";

const args = process.argv.slice(2);
const taskId = Number(args[0]);
if (!taskId) { console.log("usage: node tools/predict.mjs <task_id> (--row N | --features a,b,c) [--submission ID] [--as ACCT] [--deposit NEAR]"); process.exit(2); }
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const signers = { TEAM: ["TEAM_ACCOUNT_ID", "TEAM_PRIVATE_KEY"], FT: ["NEAR_FT_CONTRACT_ID", "NEAR_FT_CONTRACT_PRIVATE_KEY"], MAIN: ["NEAR_ACCOUNT_ID", "NEAR_PRIVATE_KEY"], AGENT: ["AGENT_ACCOUNT_ID", "AGENT_PRIVATE_KEY"] };
const signer = accountFromEnv(...signers[opt("as", "MAIN")]);
const C = process.env.BURSA_CONTRACT_ID || process.env.BURSA_DEV_ID;

try {
  const task = await view(C, "get_task", { task_id: taskId });
  if (!task) throw new Error("no such task");
  let features, label;
  if (opt("features")) features = opt("features").split(",").map((x) => Number(x.trim()));
  else {
    const row = Number(opt("row", "0"));
    const lines = fs.readFileSync(path.join(datasetDir(task), "public_holdout.csv"), "utf8").trim().split("\n");
    const cols = lines[row + 1].split(",").map(Number);
    features = cols.slice(0, -1); label = cols[cols.length - 1];
  }
  if (opt("deposit")) summary("deposit_credit", await call(signer, C, "deposit_credit", {}, { deposit: nearToYocto(opt("deposit")), gas: "30" }));
  const before = await view(C, "get_credit", { account_id: signer.accountId });
  const sub = opt("submission");
  const r = sub
    ? await call(signer, C, "predict", { submission_id: Number(sub), features }, { gas: "50" })
    : await call(signer, C, "predict_task", { task_id: taskId, features }, { gas: "50" });
  const s = summary(sub ? `predict #${sub}` : `predict_task ${taskId}`, r);
  const score = Number(s.result);
  const after = await view(C, "get_credit", { account_id: signer.accountId });
  console.log(`\nscore ${score} -> label ${score > 0 ? 1 : 0}${label !== undefined ? ` (true label ${label})` : ""}; ${s.fn_tgas} Tgas; credit ${yoctoToNear(BigInt(before), 4)} -> ${yoctoToNear(BigInt(after), 4)} NEAR`);
  console.log(task.slug === "german-credit" ? (score > 0 ? "keputusan simulasi: minta uang muka (risiko bad)" : "keputusan simulasi: beri tempo bayar 30 hari") : "");
} catch (e) { console.log("[ERR]", errMsg(e)); process.exit(1); }
