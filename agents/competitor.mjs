#!/usr/bin/env node
// Laurel competitor agent — an autonomous participant built on the Claude Agent SDK, run under a tool policy inside a
// throw-away workspace that holds only public files.
//
//   node agents/competitor.mjs [--task 5] [--model claude-opus-5-5] [--max-turns 60] [--budget-usd 15] [--dry]
//
// What the agent gets:
//   - a workspace created for this run in the OS temp folder, OUTSIDE the repository, containing copies of the public
//     files it needs (tools/export.py, tasks/<slug>/{features.json, public_train.csv, public_holdout.csv, train.py}) and
//     an empty work/ folder. There is no .env, no private split, no key, no other task in that tree;
//   - Laurel's MCP server (mcp/server.mjs), started as a separate process from the repository with the maker account's
//     FULL-ACCESS key in ITS environment (MAKER_ACCOUNT_ID / MAKER_PRIVATE_KEY from .env). The agent never sees the key;
//   - a canUseTool policy (below) that confines Read/Glob/Grep/Write/Edit to the workspace, allows only a short list of
//     shell commands with relative, glob-free arguments, and refuses scripts whose text names secrets, absolute paths,
//     parent directories, the network or the process environment.
// What this is and is not: a policy on the model's tool calls plus a workspace that contains nothing secret. It is NOT
// OS-level isolation: Python runs as the local user, so a script could still open an absolute path on this machine. The
// workspace makes the obvious paths empty, the content filter catches the obvious attempts, and the transcript shows
// every call (agents/out/, "denied tool calls"). The first run of this agent (13:49 UTC) was blocked by a bug in an
// earlier version of this policy and is kept as evidence; see docs/AGENTS.md.
//
// Nothing here tells the agent WHICH model to train. The system prompt only states the rules of the game.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { query } from "@anthropic-ai/claude-agent-sdk";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const TASK = Number(opt("task", "5"));
const MODEL = opt("model", "claude-opus-5-5");
const MAX_TURNS = Number(opt("max-turns", "60"));
const BUDGET_USD = Number(opt("budget-usd", "15"));
const DRY = args.includes("--dry");

// .env is read here, once; the agent process gets none of it. The Anthropic key goes to the SDK, the NEAR key to the MCP subprocess.
const env = Object.fromEntries(fs.readFileSync(path.join(root, ".env"), "utf8").split(/\r?\n/).filter((l) => /^[A-Z0-9_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
for (const k of ["ANTHROPIC_API_KEY", "MAKER_ACCOUNT_ID", "MAKER_PRIVATE_KEY", "BURSA_CONTRACT_ID"]) if (!env[k]) throw new Error(`${k} missing in .env`);

// ---- the task's dataset folder (public files only are copied) ------------------------------------------------------
const slugOf = (id) => {
  // tasks/<folder>/features.json whose slug matches the on-chain slug prefix; falls back to the folder named like the task
  for (const d of fs.readdirSync(path.join(root, "tasks"))) {
    const f = path.join(root, "tasks", d, "features.json");
    if (fs.existsSync(f) && JSON.parse(fs.readFileSync(f, "utf8")).task_ids?.includes(id)) return d;
  }
  return { 1: "german-credit", 2: "german-credit", 3: "german-credit", 4: "german-credit", 5: "near-retention" }[id] || String(id);
};
const DS = slugOf(TASK);
const PUBLIC_FILES = ["features.json", "public_train.csv", "public_holdout.csv", "train.py", "README.md"];

// ---- workspace in the OS temp folder, outside the repository -------------------------------------------------------
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const ws = fs.mkdtempSync(path.join(os.tmpdir(), `laurel-agent-${stamp}-`));
fs.mkdirSync(path.join(ws, "tools"), { recursive: true });
fs.mkdirSync(path.join(ws, "tasks", DS), { recursive: true });
fs.mkdirSync(path.join(ws, "work"), { recursive: true });
fs.copyFileSync(path.join(root, "tools", "export.py"), path.join(ws, "tools", "export.py"));
for (const f of PUBLIC_FILES) { const src = path.join(root, "tasks", DS, f); if (fs.existsSync(src)) fs.copyFileSync(src, path.join(ws, "tasks", DS, f)); }
const wsFiles = fs.readdirSync(path.join(ws, "tasks", DS));

fs.mkdirSync(path.join(here, "out"), { recursive: true });
const jsonl = path.join(here, "out", `competitor-${stamp}.jsonl`);
const md = path.join(here, "out", `competitor-${stamp}.md`);
const log = (s) => { process.stdout.write(s + "\n"); fs.appendFileSync(md, s + "\n"); };

// ---- tool policy -------------------------------------------------------------------------------------------------
const inside = (p, dir) => { const r = path.relative(dir, path.resolve(ws, p)); return r !== "" && !r.startsWith("..") && !path.isAbsolute(r); };
const ARG = String.raw`[\w.\-]+(?:[\\/][\w.\-]+)*`;                          // relative path or flag value: no globs, no "..", no drive letters
const FLAG = String.raw`--?[\w\-]+(?:=[\w.\-]+)?`;
const SHELL_OK = [
  new RegExp(String.raw`^python3?(\.exe)? (-I )?work[\\/]${ARG}\.py( (?:${FLAG}|${ARG}))*$`),       // the agent's own scripts
  new RegExp(String.raw`^python3?(\.exe)? (-I )?tasks[\\/][\w\-]+[\\/]train\.py( (?:${FLAG}|${ARG}))*$`),
  new RegExp(String.raw`^python3?(\.exe)? (-I )?tools[\\/]export\.py( (?:${FLAG}|${ARG}))*$`),
  new RegExp(String.raw`^(ls|dir|head|tail|wc|cat|type)( (?:${FLAG}|${ARG}))+$`),
  new RegExp(String.raw`^mkdir( -p)? work([\\/][\w\-]+)*$`),
];
const FORBIDDEN_IN_SHELL = /(\.\.|\.env\b|\.ssh\b|private_|sample_raw|[*?\[]|~|^[A-Za-z]:|[\\/]{2}|^[\\/]|>|<|\||;|&&|\$\(|`)/i;
// Script contents: the obvious ways to reach outside the workspace or off the machine. A guardrail, not a sandbox.
const FORBIDDEN_IN_CODE = /(\.\.[\\/]|[A-Za-z]:[\\/]|\\\\|os\.environ|getenv|\.env\b|private_|sample_raw|urllib|requests\b|socket|http\.client|subprocess|shutil|ctypes|importlib|__import__|open\(['"][\\/]|pathlib\.Path\(['"][\\/A-Za-z]:)/i;
function decide(tool, input) {
  if (tool.startsWith("mcp__laurel__")) return { ok: true };
  if (["Read", "Glob", "Grep"].includes(tool)) {
    const p = input.file_path || input.path || ws;
    return inside(p, ws) || path.resolve(p) === ws ? { ok: true } : { ok: false, why: "outside the workspace" };
  }
  if (["Write", "Edit"].includes(tool)) {
    if (!inside(input.file_path, path.join(ws, "work"))) return { ok: false, why: "writes only under work/" };
    const body = String(input.content ?? input.new_string ?? "");
    const m = body.match(FORBIDDEN_IN_CODE);
    return m ? { ok: false, why: `script text contains "${m[0]}" (no parent paths, absolute paths, environment, network or subprocess)` } : { ok: true };
  }
  if (tool === "Bash") {
    const c = String(input.command || "").trim();
    const m = c.match(FORBIDDEN_IN_SHELL);
    if (m) return { ok: false, why: `forbidden token "${m[0]}" in command` };
    return SHELL_OK.some((re) => re.test(c)) ? { ok: true } : { ok: false, why: "command not on the allow-list (python work/*.py, python tasks/<slug>/train.py, python tools/export.py, ls/head/tail/wc/cat, mkdir work/...; relative paths only)" };
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
(${env.BURSA_CONTRACT_ID}, testnet). Your working directory is a workspace made for this run: ${ws}
It contains tools/export.py, tasks/${DS}/ (${wsFiles.join(", ")}) and an empty work/ folder. Python 3 with scikit-learn,
pandas and numpy is installed. There is nothing else to find in it, and nothing outside it is yours to read.

Your goal: enter the best model you can in task ${TASK} and get it scored by the TEE evaluator.

Rules of the game (enforced by the contract and the evaluator; breaking them only wastes your deposit):
- A model is a binary gradient-boosted-tree ensemble with integer thresholds, exported to the contract's borsh format by
    python tools/export.py --task ${DS} --model <pickle> --out work/<folder>     -> work/<folder>/model.bin
  tasks/${DS}/features.json describes the features; train.py is a baseline trainer you may read, reuse (python tasks/${DS}/train.py
  --trees N --depth D --out <name>.pkl writes the pickle into tasks/${DS}/) or ignore; public_train.csv and public_holdout.csv are
  the public data. tools/export.py needs a scikit-learn GradientBoostingClassifier pickle and evaluates it on public_holdout.csv, so
  if you train on the holdout too, its report is in-sample; say so in your report if you do.
- Train on public data only. The private test splits are sealed inside the TEE; the public holdout is small, so do not over-trust it.
- The score is balanced accuracy on split A (public while the task is open) and split B (sealed until close; it alone decides the champion).
- Your account ${env.MAKER_ACCOUNT_ID} may enter at most 3 models in this task and holds about 1 NEAR: storage costs about
  1 NEAR per 100 KB of model plus a 0.1 NEAR fee per entry, so keep models small (a few KB to a few tens of KB) and do not waste entries.
- Tools: the Laurel MCP tools (laurel_list_exhibits, laurel_exhibit, laurel_specimen, laurel_download_model, laurel_predict_local,
  laurel_submit_model, laurel_wait_score) for the competition; Read/Glob/Grep inside the workspace; Write/Edit only under work/;
  the shell only for: python work/<script>.py, python tasks/${DS}/train.py, python tools/export.py, ls/head/tail/wc/cat, mkdir work/...,
  always with relative paths and no globs, pipes or chaining. Scripts must not touch parent directories, absolute paths, the
  environment, the network or subprocesses. Anything else is denied by policy, so do not try it.
- laurel_submit_model takes a path the MCP server can open: pass the ABSOLUTE path of your model.bin, i.e. ${ws.replace(/\\/g, "/")}/work/<folder>/model.bin.

Work in this order: read the exhibit and the leaderboard, look at the data, decide on an approach, train and validate
(holdout balanced accuracy, model size), export, enter ONE model with laurel_submit_model, wait for its TEE score, then decide
whether a second entry is worth the NEAR. Finish with a short report: what you entered, its bytes, which rows it was trained on,
holdout and split-A scores, where it stands on the leaderboard, and the transaction links. Be concise.`;

const PROMPT = `Enter task ${TASK} on Laurel and get the best split-A reading you can. Start by reading the exhibit.`;

log(`# Laurel competitor agent — ${new Date().toISOString()}\n\n- model: ${MODEL}\n- task: ${TASK} (dataset ${DS})\n- account: ${env.MAKER_ACCOUNT_ID}\n- contract: ${env.BURSA_CONTRACT_ID}\n- workspace: ${ws} (public files only: ${wsFiles.join(", ")})\n- budget: $${BUDGET_USD}, max ${MAX_TURNS} turns\n- transcript: ${path.relative(root, jsonl)}\n`);
if (DRY) { log("(dry run: not calling the API)"); process.exit(0); }

const q = query({
  prompt: PROMPT,
  options: {
    model: MODEL,
    systemPrompt: SYSTEM,
    cwd: ws,
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
    log(`\n## Result: ${m.subtype}\n\n- turns: ${m.num_turns}\n- duration: ${Math.round(m.duration_ms / 1000)} s\n- cost: $${m.total_cost_usd?.toFixed(4)}\n- denied tool calls: ${denied.length}\n- workspace kept at: ${ws}\n- usage: ${short(m.usage, 400)}\n${m.subtype === "success" ? `\n${m.result}\n` : `\n${(m.errors || []).join("\n")}\n`}`);
  }
}
log(`\n(transcript: ${path.relative(root, md)}, raw: ${path.relative(root, jsonl)})`);
