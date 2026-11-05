#!/usr/bin/env node
// Laurel competitor agent — an autonomous participant built on the Claude Agent SDK, run under a strict tool policy.
//
//   node agents/competitor.mjs [--task 5] [--model claude-opus-5-5] [--max-turns 60] [--budget-usd 15] [--dry]
//
// The agent gets a read-only view of this repository, a sandboxed working folder (agents/work/), a short list of shell
// commands (python for training, tools/export.py for the borsh export) and Laurel's MCP server (mcp/server.mjs). The
// MCP server, not the agent, holds the maker account's key (MAKER_ACCOUNT_ID / MAKER_PRIVATE_KEY from .env, passed only
// to that subprocess). Every tool call is checked by canUseTool below: anything outside the allow-list is denied and
// logged. Every API message is appended to agents/out/competitor-<timestamp>.jsonl and a readable transcript to
// agents/out/competitor-<timestamp>.md; those files are the evidence (CLAIMS row 25).
//
// Nothing here tells the agent WHICH model to train. The system prompt only states the rules of the game.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { query } from "@anthropic-ai/claude-agent-sdk";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const work = path.join(here, "work");
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const TASK = Number(opt("task", "5"));
const MODEL = opt("model", "claude-opus-5-5");
const MAX_TURNS = Number(opt("max-turns", "60"));
const BUDGET_USD = Number(opt("budget-usd", "15"));
const DRY = args.includes("--dry");

// .env: the agent process never receives it; the SDK gets only the Anthropic key, the MCP subprocess only the maker key.
const env = Object.fromEntries(fs.readFileSync(path.join(root, ".env"), "utf8").split(/\r?\n/).filter((l) => /^[A-Z0-9_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
for (const k of ["ANTHROPIC_API_KEY", "MAKER_ACCOUNT_ID", "MAKER_PRIVATE_KEY", "BURSA_CONTRACT_ID"]) if (!env[k]) throw new Error(`${k} missing in .env`);

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
fs.mkdirSync(path.join(here, "out"), { recursive: true });
fs.mkdirSync(work, { recursive: true });
const jsonl = path.join(here, "out", `competitor-${stamp}.jsonl`);
const md = path.join(here, "out", `competitor-${stamp}.md`);
const log = (s) => { process.stdout.write(s + "\n"); fs.appendFileSync(md, s + "\n"); };

// ---- tool policy -------------------------------------------------------------------------------------------------
const inside = (p, dir) => { const r = path.relative(dir, path.resolve(root, p)); return r !== "" && !r.startsWith("..") && !path.isAbsolute(r); };
const SHELL_OK = [
  /^python3?(\.exe)? (-I )?agents[\\/]work[\\/][\w./\\-]+\.py( \S+)*$/,                           // the agent's own training scripts, any flags
  /^python3?(\.exe)? (-I )?tasks[\\/][\w-]+[\\/]train\.py( \S+)*$/,                                // a task's baseline trainer
  /^python3?(\.exe)? (-I )?tools[\\/]export\.py( \S+)*$/,                                         // export to borsh
  /^(ls|dir|head|tail|wc|cat|type)( \S+)+$/,                                                     // look at files
  /^mkdir( -p)? agents[\\/]work([\\/][\w-]+)*$/,
];
// One command, no chaining or redirection, no secrets. (The first run of this agent was blocked on `--model agents`,
// which contains "del " — hence word-level checks only.)
const FORBIDDEN_IN_SHELL = /(\.env\b|\.ssh\b|\.near-credentials|private_[a-z_]*key|private_[ab]\.json|sample_raw|>|<|\||;|&&|\$\(|`)/i;
function decide(tool, input) {
  if (tool.startsWith("mcp__laurel__")) return { ok: true };
  if (["Read", "Glob", "Grep"].includes(tool)) {
    const p = input.file_path || input.path || root;
    if (/\.env|private_[ab]\.json|sample_raw\.csv/.test(String(p))) return { ok: false, why: "private file" };
    return inside(p, root) || path.resolve(p) === root ? { ok: true } : { ok: false, why: "outside the repository" };
  }
  if (["Write", "Edit"].includes(tool)) return inside(input.file_path, work) ? { ok: true } : { ok: false, why: "writes only under agents/work/" };
  if (tool === "Bash") {
    const c = String(input.command || "").trim();
    if (FORBIDDEN_IN_SHELL.test(c)) return { ok: false, why: "forbidden token in command" };
    return SHELL_OK.some((re) => re.test(c)) ? { ok: true } : { ok: false, why: "command not on the allow-list (python agents/work/*.py, tasks/*/train.py, tools/export.py, ls/head/tail/wc/cat, mkdir agents/work/...)" };
  }
  return { ok: false, why: `tool ${tool} is not available to this agent` };
}
const denied = [];
async function canUseTool(toolName, input) {
  const d = decide(toolName, input);
  if (d.ok) return { behavior: "allow", updatedInput: input };
  denied.push({ toolName, input, why: d.why });
  log(`\n> **denied** \`${toolName}\` (${d.why})`);
  return { behavior: "deny", message: `Not allowed: ${d.why}` };
}

const SYSTEM = `You are an autonomous participant in Laurel, a model competition that lives on a NEAR smart contract
(${env.BURSA_CONTRACT_ID}, testnet). You work in a checkout of the Laurel repository. Python 3 with scikit-learn, pandas and
numpy is installed.

Your goal: enter the best model you can in task ${TASK} and get it scored by the TEE evaluator.

Rules of the game (enforced by the contract and the evaluator; breaking them only wastes your deposit):
- A model is a binary gradient-boosted-tree ensemble with integer thresholds, exported to the contract's borsh format by
    python tools/export.py --task <dataset folder name> --model <pickle> --out <folder under agents/work>   -> <folder>/model.bin
  The dataset folder of a task is tasks/<slug>: features.json describes the features, train.py is a baseline trainer you may
  read, reuse (python tasks/<slug>/train.py ... writes the pickle next to it; pass --out with a name) or ignore, public_train.csv
  and public_holdout.csv are the public data. tools/export.py needs a scikit-learn GradientBoostingClassifier pickle.
- Train on public data only. The private test splits are sealed inside the TEE; the public holdout is small, so do not over-trust it.
- The score is balanced accuracy on split A (public while the task is open) and split B (sealed until close; it alone decides the champion).
- Your account ${env.MAKER_ACCOUNT_ID} may enter at most 3 models in this task and holds a little over 1 NEAR: storage costs about
  1 NEAR per 100 KB of model plus a 0.1 NEAR fee per entry, so keep models small (a few KB to a few tens of KB) and do not waste entries.
- Tools: the Laurel MCP tools (laurel_list_exhibits, laurel_exhibit, laurel_specimen, laurel_download_model, laurel_predict_local,
  laurel_submit_model, laurel_wait_score) for the competition; Read/Glob/Grep for the repository; Write/Edit only under agents/work/;
  the shell only for: python agents/work/<script>.py, python tasks/<slug>/train.py, python tools/export.py, ls/head/tail/wc/cat, mkdir.
  Anything else is denied by policy, so do not try it.

Work in this order: read the exhibit and the leaderboard, look at the data, decide on an approach, train and validate
(holdout balanced accuracy, model size), export, enter ONE model with laurel_submit_model, wait for its TEE score, then decide
whether a second entry is worth the NEAR. Finish with a short report: what you entered, its bytes, holdout and split-A scores,
where it stands on the leaderboard, and the transaction links. Be concise.`;

const PROMPT = `Enter task ${TASK} on Laurel and get the best split-A reading you can. Start by reading the exhibit.`;

log(`# Laurel competitor agent — ${new Date().toISOString()}\n\n- model: ${MODEL}\n- task: ${TASK}\n- account: ${env.MAKER_ACCOUNT_ID}\n- contract: ${env.BURSA_CONTRACT_ID}\n- budget: $${BUDGET_USD}, max ${MAX_TURNS} turns\n- transcript: ${path.relative(root, jsonl)}\n`);
if (DRY) { log("(dry run: not calling the API)"); process.exit(0); }

const q = query({
  prompt: PROMPT,
  options: {
    model: MODEL,
    systemPrompt: SYSTEM,
    cwd: root,
    maxTurns: MAX_TURNS,
    maxBudgetUsd: BUDGET_USD,
    permissionMode: "default",
    canUseTool,
    allowedTools: ["mcp__laurel__*"],
    disallowedTools: ["WebSearch", "WebFetch", "Task", "NotebookEdit", "TodoWrite", "KillShell", "Bash(rm *)", "Bash(git *)", "Bash(curl *)", "Bash(npm *)", "Bash(node *)"],
    settingSources: [],
    mcpServers: {
      laurel: {
        type: "stdio",
        command: "node",
        args: [path.join(root, "mcp", "server.mjs")],
        env: { LAUREL_CONTRACT: env.BURSA_CONTRACT_ID, LAUREL_ACCOUNT_ID: env.MAKER_ACCOUNT_ID, LAUREL_PRIVATE_KEY: env.MAKER_PRIVATE_KEY, ...(env.WRITE_RPC ? { LAUREL_RPC: env.WRITE_RPC } : {}) },
      },
    },
    env: { PATH: process.env.PATH, SYSTEMROOT: process.env.SYSTEMROOT, APPDATA: process.env.APPDATA, LOCALAPPDATA: process.env.LOCALAPPDATA, USERPROFILE: process.env.USERPROFILE, HOME: process.env.HOME, TEMP: process.env.TEMP, TMP: process.env.TMP, ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY, PYTHONIOENCODING: "utf-8" },
  },
});

const short = (v, n = 1200) => { const s = typeof v === "string" ? v : JSON.stringify(v); return s.length > n ? s.slice(0, n) + ` … [${s.length - n} more chars]` : s; };
for await (const m of q) {
  fs.appendFileSync(jsonl, JSON.stringify(m) + "\n");
  if (m.type === "system" && m.subtype === "init") {
    log(`\n## Session ${m.session_id}\n\n- tools: ${m.tools.join(", ")}\n- mcp: ${m.mcp_servers.map((s) => `${s.name} (${s.status})`).join(", ")}\n- model: ${m.model}\n`);
  } else if (m.type === "assistant") {
    for (const b of m.message.content) {
      if (b.type === "text" && b.text.trim()) log(`\n**agent:** ${b.text.trim()}\n`);
      else if (b.type === "tool_use") log(`\n> **tool** \`${b.name}\` ${short(b.input, 600)}`);
    }
  } else if (m.type === "user" && Array.isArray(m.message?.content)) {
    for (const b of m.message.content) if (b.type === "tool_result") {
      const c = Array.isArray(b.content) ? b.content.map((x) => x.text ?? "").join("\n") : String(b.content ?? "");
      log(`\n\`\`\`\n${short(c, 1500)}\n\`\`\``);
    }
  } else if (m.type === "result") {
    log(`\n## Result: ${m.subtype}\n\n- turns: ${m.num_turns}\n- duration: ${Math.round(m.duration_ms / 1000)} s\n- cost: $${m.total_cost_usd?.toFixed(4)}\n- denied tool calls: ${denied.length}\n- usage: ${short(m.usage, 400)}\n${m.subtype === "success" ? `\n${m.result}\n` : `\n${(m.errors || []).join("\n")}\n`}`);
  }
}
log(`\n(transcript: ${path.relative(root, md)}, raw: ${path.relative(root, jsonl)})`);
