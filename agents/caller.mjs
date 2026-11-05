#!/usr/bin/env node
// Laurel caller agent — the other side of the market: an agent that BUYS predictions on-chain with a key that can do
// nothing else.
//
//   node agents/caller.mjs --submission <id> [--task 5] [--rows 3] [--model claude-opus-5-5]
//
// It gets Laurel's MCP server with the agent account's FUNCTION-CALL key (AGENT_ACCOUNT_ID / AGENT_FC_PRIVATE_KEY, limited
// by the NEAR protocol to predict/predict_task on the contract) and read access to a task's public holdout. It is asked to
// score a few holdout rows with a given model both locally (laurel_predict_local) and on-chain (laurel_predict_model), check
// that the two agree, and report the transactions and what they cost. Transcript: agents/out/caller-<timestamp>.{md,jsonl}.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { query } from "@anthropic-ai/claude-agent-sdk";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const TASK = Number(opt("task", "5"));
const SUB = Number(opt("submission", "0"));
const ROWS = Number(opt("rows", "3"));
const MODEL = opt("model", "claude-opus-5-5");
if (!SUB) throw new Error("--submission <id> required");

const env = Object.fromEntries(fs.readFileSync(path.join(root, ".env"), "utf8").split(/\r?\n/).filter((l) => /^[A-Z0-9_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
const FC_KEY = env.FINAL_AGENT_FC_PRIVATE_KEY || env.AGENT_FC_PRIVATE_KEY;
for (const k of ["ANTHROPIC_API_KEY", "AGENT_ACCOUNT_ID", "BURSA_CONTRACT_ID"]) if (!env[k]) throw new Error(`${k} missing in .env`);
if (!FC_KEY) throw new Error("AGENT_FC_PRIVATE_KEY missing in .env");

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
fs.mkdirSync(path.join(here, "out"), { recursive: true });
const jsonl = path.join(here, "out", `caller-${stamp}.jsonl`);
const md = path.join(here, "out", `caller-${stamp}.md`);
const log = (s) => { process.stdout.write(s + "\n"); fs.appendFileSync(md, s + "\n"); };

const inside = (p, dir) => { const r = path.relative(dir, path.resolve(root, p)); return r !== "" && !r.startsWith("..") && !path.isAbsolute(r); };
const denied = [];
async function canUseTool(toolName, input) {
  let ok = false, why = `tool ${toolName} is not available to this agent`;
  if (toolName.startsWith("mcp__laurel__")) ok = true;
  else if (["Read", "Glob", "Grep"].includes(toolName)) {
    const p = String(input.file_path || input.path || "");
    ok = inside(p, path.join(root, "tasks")) && !/private_|sample_raw/.test(p); why = "read only tasks/<slug>/public files";
  }
  if (ok) return { behavior: "allow", updatedInput: input };
  denied.push({ toolName, why }); log(`\n> **denied** \`${toolName}\` (${why})`);
  return { behavior: "deny", message: `Not allowed: ${why}` };
}

const SYSTEM = `You are an AI agent that uses Laurel, a registry of small decision models on a NEAR smart contract
(${env.BURSA_CONTRACT_ID}, testnet). You hold account ${env.AGENT_ACCOUNT_ID} through a FUNCTION-CALL access key: the NEAR
protocol lets that key call only predict and predict_task on the contract, nothing else, and each paid call is debited from the
account's prepaid credit (laurel_credit shows it). You can read the public files of a task under tasks/<slug>/ (Read, Glob, Grep),
nothing else on disk. Tools: laurel_exhibit, laurel_specimen, laurel_download_model, laurel_predict_local, laurel_predict_model,
laurel_credit. Be concise.`;

const PROMPT = `Task ${TASK} on Laurel has a model entered as submission #${SUB}. Read the exhibit and the specimen, take the first
${ROWS} rows of the task's public_holdout.csv (tasks/<slug>/public_holdout.csv; the slug is in the exhibit; the last column is the
label, the others are the features in order), and for each row get the model's prediction twice: locally with laurel_predict_local
and on-chain with laurel_predict_model (a paid call from your credit). Check that the raw scores agree. Finish with a table: row,
label, raw score, predicted label, transaction link, gas; then one line on credit spent (laurel_credit before and after).`;

log(`# Laurel caller agent — ${new Date().toISOString()}\n\n- model: ${MODEL}\n- task: ${TASK}, submission: #${SUB}, rows: ${ROWS}\n- account: ${env.AGENT_ACCOUNT_ID} (function-call key)\n- transcript: ${path.relative(root, jsonl)}\n`);

const q = query({
  prompt: PROMPT,
  options: {
    model: MODEL, systemPrompt: SYSTEM, cwd: root, maxTurns: 30, maxBudgetUsd: 5, permissionMode: "default", canUseTool,
    allowedTools: ["mcp__laurel__*"],
    disallowedTools: ["Bash", "Write", "Edit", "WebSearch", "WebFetch", "Task", "NotebookEdit", "TodoWrite"],
    settingSources: [],
    mcpServers: { laurel: { type: "stdio", command: "node", args: [path.join(root, "mcp", "server.mjs")], env: { LAUREL_CONTRACT: env.BURSA_CONTRACT_ID, LAUREL_ACCOUNT_ID: env.AGENT_ACCOUNT_ID, LAUREL_PRIVATE_KEY: FC_KEY, ...(env.WRITE_RPC ? { LAUREL_RPC: env.WRITE_RPC } : {}) } } },
    env: { PATH: process.env.PATH, SYSTEMROOT: process.env.SYSTEMROOT, APPDATA: process.env.APPDATA, LOCALAPPDATA: process.env.LOCALAPPDATA, USERPROFILE: process.env.USERPROFILE, HOME: process.env.HOME, TEMP: process.env.TEMP, TMP: process.env.TMP, ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY },
  },
});

const short = (v, n = 1200) => { const s = typeof v === "string" ? v : JSON.stringify(v); return s.length > n ? s.slice(0, n) + ` … [${s.length - n} more chars]` : s; };
for await (const m of q) {
  fs.appendFileSync(jsonl, JSON.stringify(m) + "\n");
  if (m.type === "system" && m.subtype === "init") log(`\n## Session ${m.session_id}\n\n- tools: ${m.tools.join(", ")}\n- mcp: ${m.mcp_servers.map((s) => `${s.name} (${s.status})`).join(", ")}\n`);
  else if (m.type === "assistant") for (const b of m.message.content) {
    if (b.type === "text" && b.text.trim()) log(`\n**agent:** ${b.text.trim()}\n`);
    else if (b.type === "tool_use") log(`\n> **tool** \`${b.name}\` ${short(b.input, 600)}`);
  }
  else if (m.type === "user" && Array.isArray(m.message?.content)) for (const b of m.message.content) if (b.type === "tool_result") log(`\n\`\`\`\n${short(Array.isArray(b.content) ? b.content.map((x) => x.text ?? "").join("\n") : String(b.content ?? ""), 1500)}\n\`\`\``);
  else if (m.type === "result") log(`\n## Result: ${m.subtype}\n\n- turns: ${m.num_turns}\n- duration: ${Math.round(m.duration_ms / 1000)} s\n- cost: $${m.total_cost_usd?.toFixed(4)}\n- denied tool calls: ${denied.length}\n${m.subtype === "success" ? `\n${m.result}\n` : `\n${(m.errors || []).join("\n")}\n`}`);
}
log(`\n(transcript: ${path.relative(root, md)}, raw: ${path.relative(root, jsonl)})`);
