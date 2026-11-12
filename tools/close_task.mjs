// Close a task after its deadline (anyone may call) and print the final leaderboard.
//   node tools/close_task.mjs <task_id> [--wait] [--as MAIN|FT|TEAM]
import { accountFromEnv, call, view, summary, sleep, errMsg } from "./lib.mjs";

const args = process.argv.slice(2);
const taskId = Number(args[0]);
if (!taskId) { console.log("usage: node tools/close_task.mjs <task_id> [--wait] [--as MAIN|FT|TEAM]"); process.exit(2); }
const i = args.indexOf("--as"); const who = i >= 0 ? args[i + 1] : "MAIN";
const signers = { TEAM: ["TEAM_ACCOUNT_ID", "TEAM_PRIVATE_KEY"], FT: ["NEAR_FT_CONTRACT_ID", "NEAR_FT_CONTRACT_PRIVATE_KEY"], MAIN: ["NEAR_ACCOUNT_ID", "NEAR_PRIVATE_KEY"] };
const signer = accountFromEnv(...signers[who]);
const C = process.env.BURSA_CONTRACT_ID || "laurel.laurel-team-mw0x0c8g.testnet";   // the final contract unless .env names another

try {
  const task = await view(C, "get_task", { task_id: taskId });
  if (!task) throw new Error("no such task");
  const deadlineMs = Number(BigInt(task.deadline_ns) / 1_000_000n);
  if (Date.now() < deadlineMs) {
    if (!args.includes("--wait")) { console.log(`deadline in ${Math.ceil((deadlineMs - Date.now()) / 1000)}s; pass --wait to wait`); process.exit(1); }
    console.log(`waiting ${Math.ceil((deadlineMs - Date.now()) / 1000)}s for the deadline...`);
    await sleep(deadlineMs - Date.now() + 3000);
  }
  const s = summary("close_task", await call(signer, C, "close_task", { task_id: taskId }, { gas: "50" }));
  console.log("\nwinner =", s.result);
  console.log("leaderboard (closed):", JSON.stringify(await view(C, "leaderboard", { task_id: taskId }), null, 2));
} catch (e) { console.log("[ERR]", errMsg(e)); process.exit(1); }
