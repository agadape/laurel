// Smoke test: start the server over stdio as an MCP client would, call every tool, and check that the local prediction
// equals the on-chain one recorded in docs/AGENT.md for holdout row 0 of the demo task (811014).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");
const onchain = process.argv.includes("--onchain");
const env = { ...process.env };
if (onchain) {
  // reuse the demo agent's function-call key from the repo's .env (never printed)
  const dotenv = fs.readFileSync(path.join(root, ".env"), "utf8");
  const get = (k) => { const ms = [...dotenv.matchAll(new RegExp(`^${k}=(.*)$`, "gm"))]; return ms.length ? ms.at(-1)[1].trim() : undefined; }; // last wins, like dotenv overrides
  env.LAUREL_ACCOUNT_ID = get("AGENT_ACCOUNT_ID"); env.LAUREL_PRIVATE_KEY = get("AGENT_FC_PRIVATE_KEY");
}
const transport = new StdioClientTransport({ command: process.execPath, args: [path.join(here, "..", "server.mjs")], env });
const client = new Client({ name: "smoke", version: "0.0.0" });
await client.connect(transport);

const tools = (await client.listTools()).tools.map((t) => t.name);
console.log("tools:", tools.join(", "));
const call = async (name, args = {}) => { const r = await client.callTool({ name, arguments: args }); const t = r.content[0].text; if (r.isError) throw new Error(`${name}: ${t}`); try { return JSON.parse(t); } catch { return t; } };

const exhibits = await call("laurel_list_exhibits");
console.log("exhibits:", exhibits.map((t) => `${t.task_id} ${t.slug} ${t.closed ? "closed" : "open"}`).join(" · "));
const closed = exhibits.filter((t) => t.closed && t.champion).at(-1);
const ex = await call("laurel_exhibit", { task_id: closed.task_id });
console.log(`exhibit ${closed.task_id}: champion #${ex.task.winner}, ${ex.leaderboard.length} entries`);

const openTask = exhibits.find((t) => !t.closed);
if (openTask) {
  const lb = (await call("laurel_exhibit", { task_id: openTask.task_id })).leaderboard;
  if (lb[0]) { const s = await call("laurel_specimen", { submission_id: lb[0].submission_id }); if (s.score_b_bps != null || !/sealed/.test(s.last_outlayer_raw || "")) throw new Error("split B leaked for an open task"); console.log(`specimen #${lb[0].submission_id} (open task): split B sealed ✓`); }
}

const dl = await call("laurel_download_model", { submission_id: ex.task.winner, out_path: path.join(here, "out-model.bin") });
console.log(`download: ${dl.bytes} B sha256 ${dl.sha256.slice(0, 12)}… ${dl.trees} trees depth ${dl.max_depth}`);
fs.unlinkSync(dl.file);

const holdout = fs.readFileSync(path.join(root, "tasks", "german-credit", "public_holdout.csv"), "utf8").trim().split("\n").slice(1).map((l) => l.split(",").map(Number));
const row0 = holdout[0].slice(0, -1);
const local = await call("laurel_predict_local", { submission_id: ex.task.winner, features: row0 });
console.log(`predict_local #${ex.task.winner} row 0: ${local.raw_score} (label ${local.label})`);
if (ex.task.winner === 4 && local.raw_score !== "811014") throw new Error(`expected 811014 (docs/AGENT.md), got ${local.raw_score}`);

if (onchain) {
  const credit = await call("laurel_credit");
  console.log(`credit: ${credit.credit_near} NEAR`);
  const p = await call("laurel_predict", { task_id: closed.task_id, features: row0 });
  console.log(`predict on-chain: ${p.raw_score} (label ${p.label}) tx ${p.tx} ${p.gas_tgas} Tgas`);
  if (p.raw_score !== local.raw_score) throw new Error("on-chain and local scores differ");
  console.log("on-chain == local ✓");
}
await client.close();
console.log("smoke OK");
