// Remote MCP endpoint for Laurel (Streamable HTTP, stateless): https://laurel-near.vercel.app/api/mcp
// Read-only tools over the contract's view calls, so any MCP client can browse exhibits, read leaderboards, fetch a
// model's bytes and run it locally without installing anything. On-chain predict_task needs a key and stays in the
// npm package `laurel-mcp` (mcp/ in the repo).
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { decodeModel, rawScore, stats, sha256, b64ToBytes } from "./_lib/gbdt.mjs";

const CONTRACT = process.env.LAUREL_CONTRACT || "laurel.laurel-team-mw0x0c8g.testnet";
const RPCS = ["https://rpc.testnet.fastnear.com", "https://archival-rpc.testnet.fastnear.com", "https://near-testnet.drpc.org"];

async function view(method, args = {}) {
  const body = JSON.stringify({ jsonrpc: "2.0", id: "laurel-mcp", method: "query", params: { request_type: "call_function", finality: "optimistic", account_id: CONTRACT, method_name: method, args_base64: Buffer.from(JSON.stringify(args)).toString("base64") } });
  let last;
  for (const url of RPCS) {
    try {
      const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body });
      const j = await r.json();
      if (j.error) throw new Error(j.error.data?.toString?.() || j.error.message || JSON.stringify(j.error));
      if (j.result?.error) throw new Error(j.result.error);
      return JSON.parse(Buffer.from(j.result.result).toString());
    } catch (e) { last = e; }
  }
  throw last;
}
const text = (v) => ({ content: [{ type: "text", text: typeof v === "string" ? v : JSON.stringify(v, (_, x) => (typeof x === "bigint" ? x.toString() : x), 2) }] });
const fail = (msg) => ({ content: [{ type: "text", text: msg }], isError: true });
const deadline = (t) => new Date(Number(BigInt(t.deadline_ns) / 1000000n)).toISOString();

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

function buildServer() {
  const server = new McpServer({ name: "laurel", version: "0.1.0" }, {
    instructions: `Laurel is a registry contract on NEAR testnet (${CONTRACT}) where small gradient-boosted-tree models are submitted as data, scored inside a TEE on a sealed private test set (split A public while a task is open, split B revealed only at close), and the champion is served on-chain through predict_task. This remote endpoint is read-only: list exhibits, read a leaderboard or a specimen, fetch a model's bytes, and run a model with the contract's integer arithmetic. To call the champion on-chain (predict_task) install the npm package laurel-mcp with a NEAR key. Features are integers in the task's feature order; a raw score > 0 means the positive class (credit-risk demo: 1 = bad credit).`,
  });
  server.tool("laurel_list_exhibits", "List the tasks (exhibits) on the Laurel contract with their state, deadline and entrant count.", {}, async () => {
    const tasks = await view("list_tasks", { from: 0, limit: 50 });
    return text(tasks.map((t) => ({ task_id: t.task_id, slug: t.slug, title: t.title, closed: t.closed, champion: t.winner, deadline_utc: deadline(t), n_features: t.n_features, entrants: t.submission_count, explorer: `https://laurel-near.vercel.app/#/task/${t.task_id}` })));
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
  server.tool("laurel_download_model", "Fetch a model's bytes from the contract (the same view the TEE evaluator uses): returns sha256, structure and the bytes as base64 (borsh, gbdt-core model v1).", { submission_id: z.number().int().positive() }, async ({ submission_id }) => {
    const b64 = await view("get_model_bytes", { submission_id });
    const bytes = b64ToBytes(b64);
    return text({ submission_id, bytes: bytes.length, sha256: sha256(bytes), ...stats(decodeModel(bytes)), base64: b64, format: "borsh, gbdt-core model v1 (crates/gbdt-core in github.com/agadape/laurel)" });
  });
  server.tool("laurel_predict_local", "Run a submitted model with the contract's integer arithmetic (no transaction); the raw score equals what predict/predict_task returns on-chain for the same bytes.", { submission_id: z.number().int().positive(), features: z.array(z.number()).describe("integer features in the task's feature order") }, async ({ submission_id, features }) => {
    try {
      const model = decodeModel(b64ToBytes(await view("get_model_bytes", { submission_id })));
      const raw = rawScore(model, features);
      return text({ submission_id, raw_score: raw.toString(), label: raw > 0n ? 1 : 0, note: "label 1 = positive class (credit-risk demo: bad credit); identical to the on-chain result for the same bytes" });
    } catch (e) { return fail(String(e.message || e)); }
  });
  return server;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "content-type, mcp-session-id, mcp-protocol-version, authorization, accept");
  res.setHeader("Access-Control-Expose-Headers", "mcp-session-id");
  if (req.method === "OPTIONS") { res.statusCode = 204; return res.end(); }
  if (req.method !== "POST") {
    res.statusCode = 405; res.setHeader("content-type", "application/json");
    return res.end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32000, message: "Laurel MCP: stateless Streamable HTTP, POST only. Add https://laurel-near.vercel.app/api/mcp as a remote MCP server." }, id: null }));
  }
  const server = buildServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on("close", () => { transport.close(); server.close(); });
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
}
