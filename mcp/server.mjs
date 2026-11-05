#!/usr/bin/env node
// laurel-mcp — an MCP server (stdio) for Laurel, small decision models as on-chain infrastructure on NEAR.
// Read-only tools need no key. `laurel_predict` signs a predict_task call and needs LAUREL_ACCOUNT_ID + LAUREL_PRIVATE_KEY
// (a function-call key limited to predict_task/predict is enough) with prepaid credit on the contract.
import fs from "node:fs";
import path from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { Account, JsonRpcProvider, FailoverRpcProvider, actions, teraToGas } from "near-api-js";
import { decodeModel, rawScore, stats, sha256, b64ToBytes } from "./gbdt.mjs";

const CONTRACT = process.env.LAUREL_CONTRACT || "laurel.laurel-team-mw0x0c8g.testnet";
const NETWORK = process.env.LAUREL_NETWORK || (CONTRACT.endsWith(".near") ? "mainnet" : "testnet");
const EXPLORER = NETWORK === "mainnet" ? "https://nearblocks.io" : "https://testnet.nearblocks.io";
const RPCS = (process.env.LAUREL_RPC ? process.env.LAUREL_RPC.split(",") : NETWORK === "mainnet"
  ? ["https://rpc.mainnet.fastnear.com", "https://near.drpc.org"]
  : ["https://rpc.testnet.fastnear.com", "https://archival-rpc.testnet.fastnear.com", "https://near-testnet.drpc.org"]).map((s) => s.trim());
const provider = new FailoverRpcProvider(RPCS.map((url) => new JsonRpcProvider({ url })));
const explorerTx = (h) => `${EXPLORER}/txns/${h}`;

async function view(method, args = {}) {
  const r = await provider.query({ request_type: "call_function", finality: "optimistic", account_id: CONTRACT, method_name: method, args_base64: Buffer.from(JSON.stringify(args)).toString("base64") });
  return JSON.parse(Buffer.from(r.result).toString());
}
const modelCache = new Map();
async function modelOf(submission_id) {
  if (!modelCache.has(submission_id)) {
    const bytes = b64ToBytes(await view("get_model_bytes", { submission_id }));
    modelCache.set(submission_id, { bytes, model: decodeModel(bytes) });
  }
  return modelCache.get(submission_id);
}
/** The sealed rule, applied client-side too: split B of a submission is reported only once its task is closed. */
async function specimen(submission_id) {
  const sub = await view("get_submission", { submission_id });
  if (!sub) return null;
  const task = await view("get_task", { task_id: sub.task_id });
  if (!task?.closed) {
    sub.score_b_bps = null; sub.f1_b_bps = null;
    try { const raw = JSON.parse(sub.last_outlayer_raw); if (raw && "b" in raw) { raw.b = "sealed until the task closes"; sub.last_outlayer_raw = JSON.stringify(raw); } } catch {}
    sub.split_b = "sealed until the task closes";
  }
  return { ...sub, task_closed: !!task?.closed, champion: !!task?.closed && task.winner === submission_id };
}
const text = (v) => ({ content: [{ type: "text", text: typeof v === "string" ? v : JSON.stringify(v, (_, x) => (typeof x === "bigint" ? x.toString() : x), 2) }] });
const fail = (msg) => ({ content: [{ type: "text", text: msg }], isError: true });

const server = new McpServer({ name: "laurel", version: "0.1.0" }, {
  instructions: `Laurel is a registry contract on NEAR ${NETWORK} (${CONTRACT}) where small gradient-boosted-tree models are submitted as data, scored inside a TEE on a sealed private test set (split A public while a task is open, split B revealed only at close), and the champion is served on-chain through predict_task. Use laurel_list_exhibits to see tasks, laurel_exhibit for a leaderboard, laurel_specimen for one model, laurel_download_model / laurel_predict_local to run a model here, and laurel_predict to call the champion on-chain (needs a key and prepaid credit). Features are integers in the task's feature order; a raw score > 0 means the positive class (for the credit-risk demo: 1 = bad credit).`,
});

server.tool("laurel_list_exhibits", "List the tasks (exhibits) on the Laurel contract with their state, deadline and entrant count.", {}, async () => {
  const tasks = await view("list_tasks", { from: 0, limit: 50 });
  return text(tasks.map((t) => ({ task_id: t.task_id, slug: t.slug, title: t.title, closed: t.closed, champion: t.winner, deadline_utc: new Date(Number(BigInt(t.deadline_ns) / 1000000n)).toISOString(), n_features: t.n_features, entrants: t.submission_count, fee_per_call_near: Number(BigInt(t.fee_per_call) / 10n ** 18n) / 1e6 })));
});

server.tool("laurel_exhibit", "One task with its feature names and leaderboard. Split B readings appear only once the task is closed.", { task_id: z.number().int().positive() }, async ({ task_id }) => {
  const task = await view("get_task", { task_id });
  if (!task) return fail(`no task ${task_id} on ${CONTRACT}`);
  const leaderboard = await view("leaderboard", { task_id });
  return text({ task, leaderboard, note: task.closed ? `closed; champion #${task.winner} serves predict_task(${task_id}, features)` : "open; split B is sealed in the contract's leaderboard until the deadline passes and close_task is called" });
});

server.tool("laurel_specimen", "One submitted model: owner, size, status, split-A reading, evaluator record, calls served. Split B only when its task is closed.", { submission_id: z.number().int().positive() }, async ({ submission_id }) => {
  const s = await specimen(submission_id);
  return s ? text(s) : fail(`no submission ${submission_id} on ${CONTRACT}`);
});

server.tool("laurel_download_model", "Fetch a model's bytes from the contract (the same view the TEE evaluator uses) and save them as a .bin file; returns its sha256 and structure.", { submission_id: z.number().int().positive(), out_path: z.string().optional().describe("where to write the file; default ./laurel-model-<id>.bin") }, async ({ submission_id, out_path }) => {
  const { bytes, model } = await modelOf(submission_id);
  const file = path.resolve(out_path || `laurel-model-${submission_id}.bin`);
  fs.writeFileSync(file, bytes);
  return text({ file, bytes: bytes.length, sha256: sha256(bytes), ...stats(model), format: "borsh, gbdt-core model v1 (see crates/gbdt-core in the Laurel repo)" });
});

server.tool("laurel_predict_local", "Run a submitted model on this machine with the contract's integer arithmetic; the raw score equals what predict/predict_task returns on-chain.", { submission_id: z.number().int().positive(), features: z.array(z.number()).describe("integer features in the task's feature order") }, async ({ submission_id, features }) => {
  const { model } = await modelOf(submission_id);
  try {
    const raw = rawScore(model, features);
    return text({ submission_id, raw_score: raw.toString(), label: raw > 0n ? 1 : 0, note: "label 1 = positive class (credit-risk demo: bad credit); identical to the on-chain result for the same bytes" });
  } catch (e) { return fail(String(e.message || e)); }
});

server.tool("laurel_credit", "Prepaid prediction credit of the configured account on the contract (predict_task is paid from it).", {}, async () => {
  const id = process.env.LAUREL_ACCOUNT_ID;
  if (!id) return fail("set LAUREL_ACCOUNT_ID to check credit");
  const yocto = await view("get_credit", { account_id: id });
  return text({ account: id, credit_near: Number(BigInt(yocto) / 10n ** 18n) / 1e6, top_up: `node tools/predict.mjs <task_id> --row 0 --as <ACCOUNT> --deposit 0.02 (from the Laurel repo) or call deposit_credit with an attached deposit` });
});

server.tool("laurel_predict", "Call the champion model of a closed task ON-CHAIN (predict_task): the prediction is computed inside NEAR consensus and the per-call fee goes to the model owner. Needs LAUREL_ACCOUNT_ID and LAUREL_PRIVATE_KEY (a function-call key limited to predict_task/predict is enough) and prepaid credit.", { task_id: z.number().int().positive(), features: z.array(z.number()).describe("integer features in the task's feature order") }, async ({ task_id, features }) => {
  const id = process.env.LAUREL_ACCOUNT_ID, key = process.env.LAUREL_PRIVATE_KEY;
  if (!id || !key) return fail("laurel_predict needs LAUREL_ACCOUNT_ID and LAUREL_PRIVATE_KEY in the server's env (use laurel_predict_local for a key-less run on the same bytes)");
  try {
    const account = new Account(id, new JsonRpcProvider({ url: RPCS[0] }), key);
    const res = await account.signAndSendTransaction({ receiverId: CONTRACT, actions: [actions.functionCall("predict_task", { task_id, features: features.map((v) => Math.trunc(Number(v))) }, teraToGas("30"), 0n)] });
    const hash = res.transaction.hash;
    const status = res.status?.SuccessValue;
    const raw = status != null ? Buffer.from(status, "base64").toString() : null;
    const gas = res.receipts_outcome?.reduce((a, r) => a + Number(r.outcome.gas_burnt), 0) / 1e12;
    return text({ task_id, raw_score: raw, label: raw != null ? (BigInt(raw) > 0n ? 1 : 0) : null, tx: hash, explorer: explorerTx(hash), gas_tgas: gas != null ? Number(gas.toFixed(3)) : null, paid_by: id });
  } catch (e) {
    const m = String(e.message || e);
    const hint = /insufficient credit/i.test(m) ? " — top up with deposit_credit (laurel_credit shows the balance)" : /task not closed/i.test(m) ? " — predict_task only serves closed tasks; use laurel_predict_local on an open task's entries" : /access ?key/i.test(m) ? " — the key must be a key of LAUREL_ACCOUNT_ID that allows predict_task on this contract" : "";
    return fail(`predict_task failed: ${m.slice(0, 400)}${hint}`);
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
