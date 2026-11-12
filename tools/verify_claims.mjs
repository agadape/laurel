#!/usr/bin/env node
// Laurel · verify_claims: re-reads NEAR testnet and checks the on-chain claims of README.md and CLAIMS.md.
// Read-only: no key, no .env, no transaction, no npm install (Node 18+ built-ins and mcp/gbdt.mjs only).
//
//   node tools/verify_claims.mjs                    print the table; exit 0 = every check passed,
//                                                   1 = a check failed, 2 = nothing failed but the network was not reachable
//   node tools/verify_claims.mjs --json             machine-readable result on stdout
//   node tools/verify_claims.mjs --md docs/VERIFY.md   also write a snapshot of the run
//   node tools/verify_claims.mjs --no-sweep         skip the lookup of every transaction cited in CLAIMS.md (the slow part)
//   node tools/verify_claims.mjs --budget 600       seconds the run may spend on the network (default 240)
//
// Public RPC nodes limit the request rate, so the script paces itself (about one minute for a full run). A check that
// could not be completed because no node answered is reported as UNREACHABLE, never as PASS. The last full run is kept
// in docs/VERIFY.md.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { decodeModel, rawScore } from "../mcp/gbdt.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CONTRACT = "laurel.laurel-team-mw0x0c8g.testnet";
const TEAM = "laurel-team-mw0x0c8g.testnet";
const EXPLORER = "https://testnet.nearblocks.io/txns/";
// Views go to ordinary nodes. Transactions from early November are only kept by archival nodes.
const VIEW_RPCS = ["https://rpc.testnet.fastnear.com", "https://near-testnet.drpc.org", "https://test.rpc.fastnear.com", "https://rpc.testnet.near.org"];
const ARCHIVAL_RPCS = ["https://archival-rpc.testnet.fastnear.com", "https://archival-rpc.testnet.near.org"];
const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const opt = (name) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : undefined);
const quiet = flag("--json");
const progress = (s) => { if (!quiet && process.stderr.isTTY) process.stderr.write("\r" + s.padEnd(100).slice(0, 100)); };

class Unreachable extends Error {}
class Mismatch extends Error {}
const expect = (cond, msg) => { if (!cond) throw new Mismatch(msg); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const read = (rel) => fs.readFileSync(path.join(root, rel));
const sha256 = (buf) => crypto.createHash("sha256").update(buf).digest();
const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const base58 = (buf) => {
  let n = BigInt("0x" + (buf.toString("hex") || "0")), s = "";
  while (n > 0n) { s = B58[Number(n % 58n)] + s; n /= 58n; }
  for (const b of buf) { if (b === 0) s = "1" + s; else break; }
  return s;
};
const short = (h) => h.slice(0, 8) + "…";
const near = (yocto) => (Number(BigInt(yocto) / 10n ** 18n) / 1e6).toString();
const tgas = (gas) => (Number(gas) / 1e12).toFixed(3);
const acct = (a) => a.replace("." + TEAM, "");

// ---------- RPC with pacing, retry and failover ----------
const lastHit = new Map();
let rpcCalls = 0;
const started = Date.now();
const BUDGET_MS = 1000 * Number(opt("--budget") ?? 240);
const outOfTime = () => Date.now() - started > BUDGET_MS;
async function rpc(urls, method, params, { gap = 120, attempts = 14 } = {}) {
  let lastErr = "no attempt";
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (outOfTime()) throw new Unreachable(`time budget of ${BUDGET_MS / 1000} s spent (last answer: ${lastErr}); run again in a minute, or with --budget 600`);
    const url = urls[attempt % urls.length];
    const wait = (lastHit.get(url) ?? 0) + gap - Date.now();
    if (wait > 0) await sleep(wait);
    lastHit.set(url, Date.now());
    rpcCalls++;
    try {
      const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }), signal: AbortSignal.timeout(15000) });
      const text = await res.text();
      let j; try { j = JSON.parse(text); } catch { j = null; }
      if (j?.result !== undefined) return { result: j.result, host: new URL(url).host };
      const cause = j?.error?.cause?.name;
      // An answer from the node about the request itself (unknown transaction, unknown account, contract error) is final for
      // that node. Anything else (rate limit, gateway error, a block the node does not have yet) is worth another node.
      if (cause && !["UNKNOWN_BLOCK", "NO_SYNCED_BLOCKS", "INTERNAL_ERROR", "TIMEOUT_ERROR", "UNAVAILABLE_SHARD"].includes(cause)) return { error: j.error, cause, host: new URL(url).host };
      lastErr = `${new URL(url).host}: ${res.status} ${(j?.error?.message ?? text).toString().slice(0, 80)}`;
    } catch (e) {
      lastErr = `${new URL(url).host}: ${String(e?.message ?? e).slice(0, 80)}`;
    }
    // a rate limit clears after some seconds; wait longer each round, the time budget bounds the total
    await sleep(Math.min(12000, 800 * 2 ** Math.floor(attempt / urls.length)));
  }
  throw new Unreachable(lastErr);
}

let BLOCK; // every view is read at this one final block
let ACCOUNT; // view_account of the contract at that block
const viewCache = new Map();
async function view(method, args = {}) {
  const key = method + JSON.stringify(args);
  if (!viewCache.has(key)) {
    const r = await rpc(VIEW_RPCS, "query", { request_type: "call_function", block_id: BLOCK.height, account_id: CONTRACT, method_name: method, args_base64: Buffer.from(JSON.stringify(args)).toString("base64") });
    if (r.error) throw new Mismatch(`view ${method} failed: ${r.cause}`);
    viewCache.set(key, JSON.parse(Buffer.from(r.result.result).toString()));
  }
  return viewCache.get(key);
}

const txCache = new Map();
let archivalStrikes = 0; // transaction lookups in a row that no archival node answered
/** A transaction by hash, normalised. Returns null only when an archival node says it does not know the hash. */
async function tx(hash) {
  if (txCache.has(hash)) { const c = txCache.get(hash); if (c instanceof Unreachable) throw c; return c; }
  progress(`reading transaction ${short(hash)} (${txCache.size + 1})`);
  // The sender only routes the lookup; archival nodes answer for any account. No waiting: these are old transactions.
  let r;
  try {
    // Two lookups in a row without an answer: the archival nodes are limiting this address. Stop asking them, so the
    // checks that only need views still run inside the time budget.
    if (archivalStrikes >= 2) throw new Unreachable("the public archival nodes are limiting requests from this address; run again in a few minutes");
    r = await rpc(ARCHIVAL_RPCS, "EXPERIMENTAL_tx_status", { tx_hash: hash, sender_account_id: CONTRACT, wait_until: "NONE" }, { gap: 450, attempts: 8 });
    archivalStrikes = 0;
  } catch (e) { archivalStrikes++; txCache.set(hash, e); throw e; }
  if (r.result && r.result.final_execution_status !== "FINAL") { const e = new Unreachable(`${short(hash)} is not final yet`); txCache.set(hash, e); throw e; }
  let out = null;
  if (r.error) {
    if (r.cause !== "UNKNOWN_TRANSACTION") { const e = new Unreachable(`${r.host}: ${r.cause}`); txCache.set(hash, e); throw e; }
  } else {
    const t = r.result.transaction;
    const receipts = r.result.receipts_outcome.map((o) => ({ executor: o.outcome.executor_id, gas: o.outcome.gas_burnt, failed: !!o.outcome.status.Failure, logs: o.outcome.logs }));
    const events = receipts.flatMap((rc) => rc.logs.filter((l) => l.startsWith("EVENT_JSON:")).map((l) => {
      try { const e = JSON.parse(l.slice(11)); return { executor: rc.executor, standard: e.standard, event: e.event, data: e.data?.[0] ?? {}, text: l }; } catch { return { executor: rc.executor, text: l }; }
    }));
    out = {
      hash, signer: t.signer_id, receiver: t.receiver_id, publicKey: t.public_key,
      actions: t.actions.map((a) => {
        if (typeof a === "string") return { kind: a };
        const kind = Object.keys(a)[0];
        if (kind !== "FunctionCall") return { kind };
        let args = null; try { args = JSON.parse(Buffer.from(a.FunctionCall.args, "base64").toString()); } catch { /* binary args */ }
        return { kind, method: a.FunctionCall.method_name, args, deposit: a.FunctionCall.deposit };
      }),
      ok: r.result.status.SuccessValue !== undefined,
      value: r.result.status.SuccessValue !== undefined ? Buffer.from(r.result.status.SuccessValue, "base64").toString() : null,
      receipts, events,
    };
    out.method = out.actions.find((a) => a.method)?.method ?? out.actions.map((a) => a.kind).join("+");
  }
  txCache.set(hash, out);
  return out;
}
async function mustTx(hash) {
  const t = await tx(hash);
  expect(t, `transaction ${hash} is not known to the archival node`);
  return t;
}

// ---------- what the repository says ----------
const claims = read("CLAIMS.md").toString();
const HASH = "[1-9A-HJ-NP-Za-km-z]{43,44}";
// CLAIMS.md also prints the contract's code hash in the same alphabet; it is not a transaction. The hash read from the
// chain is added before the checks run, so a wasm that differs from the deployed one fails one check, not five.
const NOT_TX = new Set([base58(sha256(read("wasm/bursa.wasm")))]);
// Mainnet transactions (linked to nearblocks.io, not testnet.nearblocks.io) are checked by the mainnet section, not here.
const mainnetTx = (text) => new Set([...text.matchAll(new RegExp("//nearblocks\\.io/txns/(" + HASH + ")", "g"))].map((m) => m[1]));
const hashesIn = (text) => { const main = mainnetTx(text); return [...new Set([...text.matchAll(new RegExp("(?:txns/|`)(" + HASH + ")(?![1-9A-HJ-NP-Za-km-z])", "g"))].map((m) => m[1]))].filter((h) => !NOT_TX.has(h) && !main.has(h)); };
const claimRow = (n) => claims.split(/\r?\n/).find((l) => l.startsWith(`| ${n} |`)) ?? "";
const rowTx = (n) => hashesIn(claimRow(n));
const agentTable = hashesIn(read("docs/AGENT.md").toString());

const modelCache = new Map();
async function model(submissionId) {
  if (!modelCache.has(submissionId)) {
    const bytes = Buffer.from(await view("get_model_bytes", { submission_id: submissionId }), "base64");
    modelCache.set(submissionId, { bytes, decoded: decodeModel(new Uint8Array(bytes)) });
  }
  return modelCache.get(submissionId);
}
const allSubs = async () => {
  const cfg = await view("get_config");
  const out = [];
  for (let t = 1; t <= cfg.task_count; t++) out.push(...(await view("list_submissions", { task_id: t })));
  return out;
};
/** One paid prediction: the contract's answer must equal the model's bytes scored locally, and the fee must go to the owner. */
async function checkPrediction(hash, signer) {
  const t = await mustTx(hash);
  expect(t.signer === signer && t.receiver === CONTRACT, `${short(hash)}: ${t.signer} -> ${t.receiver}`);
  const call = t.actions.find((a) => a.method === "predict_task" || a.method === "predict");
  expect(call && t.ok, `${short(hash)}: not a successful prediction (${t.method})`);
  let sid = call.args.submission_id;
  let task;
  if (call.method === "predict_task") { task = await view("get_task", { task_id: call.args.task_id }); sid = task.winner; }
  const sub = await view("get_submission", { submission_id: sid });
  task ??= await view("get_task", { task_id: sub.task_id });
  const local = rawScore((await model(sid)).decoded, call.args.features).toString();
  expect(local === t.value.trim(), `${short(hash)}: on-chain ${t.value} but the same bytes give ${local} locally`);
  const ev = t.events.find((e) => e.event === "prediction" && e.executor === CONTRACT);
  expect(ev && ev.data.fee === task.fee_per_call && ev.data.owner === sub.owner && ev.data.submission_id === sid, `${short(hash)}: prediction event does not credit ${sub.owner} with ${task.fee_per_call}`);
  const fn = t.receipts.find((r) => r.executor === CONTRACT);
  return { sid, score: local, gas: fn.gas, key: t.publicKey, fee: task.fee_per_call, owner: sub.owner };
}

// ---------- the checks ----------
const results = [];
const sections = [];
function section(title) { sections.push({ title, at: checks.length }); }
const checks = [];
const check = (rows, title, fn) => checks.push({ rows, title, fn });

section("Contract and code");
check("27, 28", "The deployed contract is the wasm committed in this repo", async () => {
  if (!ACCOUNT) throw new Unreachable("the contract account could not be read");
  const local = base58(sha256(read("wasm/bursa.wasm")));
  expect(ACCOUNT.code_hash === local, `on-chain code hash ${ACCOUNT.code_hash}, sha256(wasm/bursa.wasm) ${local}`);
  expect(claimRow(28).includes(local), "CLAIMS row 28 cites another code hash");
  return `code hash ${local} = sha256(wasm/bursa.wasm)`;
});
check("27", "The v1.1 upgrade was a code-only deploy (no init call, no migration)", async () => {
  const deploys = [];
  for (const h of rowTx(27)) { const t = await mustTx(h); if (t.actions.some((a) => a.kind === "DeployContract")) deploys.push(t); }
  expect(deploys.length === 1, `expected one deploy transaction in CLAIMS row 27, found ${deploys.length}`);
  const t = deploys[0];
  expect(t.ok && t.receiver === CONTRACT && t.actions.length === 1, `deploy ${short(t.hash)} has actions ${t.actions.map((a) => a.method ?? a.kind).join(", ")}`);
  return `${short(t.hash)}: a single DeployContract action on ${CONTRACT}`;
});
check("4, 5", "The evaluator pinned in the contract is the wasm committed in this repo", async () => {
  const [url, pinned] = await view("get_evaluator");
  const local = sha256(read("wasm/evaluator.wasm")).toString("hex");
  expect(pinned === local, `pinned ${pinned}, sha256(wasm/evaluator.wasm) ${local}`);
  expect(url.includes(pinned), "the evaluator URL does not carry the pinned hash");
  return `evaluator hash ${pinned.slice(0, 16)}… = sha256(wasm/evaluator.wasm)`;
});
check("README", "At least 5 tasks and 15 models are on the contract", async () => {
  const c = await view("get_config");
  expect(c.task_count >= 5 && c.submission_count >= 15, `${c.task_count} tasks, ${c.submission_count} models`);
  return `${c.task_count} tasks, ${c.submission_count} models, owner ${c.owner}`;
});

section("Private benchmark in a TEE");
check("3, 4, 24", "Every scored model was scored by the pinned evaluator", async () => {
  const [, pinned] = await view("get_evaluator");
  const scored = (await allSubs()).filter((s) => s.status === "Scored");
  const other = scored.filter((s) => s.scored_by !== pinned);
  expect(scored.length > 0 && other.length === 0, `scored by another evaluator: ${other.map((s) => "#" + s.submission_id).join(", ")}`);
  return `${scored.length} of ${scored.length} scored models carry scored_by = ${pinned.slice(0, 8)}…`;
});
check("3, 24, 25, 26, 28", "Scores were written by OutLayer inside the request_score transaction", async () => {
  const [, pinned] = await view("get_evaluator");
  let n = 0;
  for (const row of [24, 25, 26, 28]) for (const h of rowTx(row)) {
    const t = await mustTx(h);
    if (t.method !== "request_score") continue;
    const sid = t.actions[0].args.submission_id;
    const sub = await view("get_submission", { submission_id: sid });
    const asked = t.events.find((e) => e.event === "score_requested");
    const ran = t.events.find((e) => e.standard === "near-outlayer" && e.event === "execution_completed");
    const scored = t.events.find((e) => e.event === "model_scored" && e.executor === CONTRACT);
    expect(t.ok && asked?.data.evaluator_hash === pinned, `${short(h)}: not requested with the pinned evaluator`);
    expect(ran && ran.text.includes(pinned), `${short(h)}: no OutLayer execution of the pinned evaluator in this transaction`);
    expect(scored?.data.ok === true && scored.data.score_a_bps === sub.score_a_bps, `${short(h)}: #${sid} scored ${scored?.data.score_a_bps} in the transaction, contract now says ${sub.score_a_bps}`);
    n++;
  }
  expect(n >= 8, `only ${n} request_score transactions found in CLAIMS rows 24, 25, 26, 28`);
  return `${n} request_score transactions: OutLayer ran ${pinned.slice(0, 8)}… and the score in the transaction equals the stored one`;
});
check("11", "Each closed task's champion is the best sealed (split B) score, ties to the earlier entry", async () => {
  const c = await view("get_config");
  const lines = [];
  for (let id = 1; id <= c.task_count; id++) {
    const task = await view("get_task", { task_id: id });
    if (!task.closed) continue;
    const subs = (await view("list_submissions", { task_id: id })).filter((s) => s.status === "Scored" && s.score_b_bps !== null);
    expect(subs.length > 0, `closed task ${id} has no sealed score`);
    const best = subs.reduce((a, b) => (b.score_b_bps > a.score_b_bps || (b.score_b_bps === a.score_b_bps && b.submission_id < a.submission_id) ? b : a));
    expect(task.winner === best.submission_id, `task ${id}: champion #${task.winner}, best split B is #${best.submission_id}`);
    lines.push(`task ${id} → #${task.winner} (${(best.score_b_bps / 100).toFixed(2)} %)`);
  }
  expect(lines.length > 0, "no closed task");
  return lines.join(", ");
});
check("38", "No champion was picked by the split-A fallback: every entry of every closed task was scored and has a split-B score", async () => {
  // contracts/bursa final_score() falls back to split A when an entry has no split-B score, and close_task skips
  // entries that are not Scored (CLAIMS row 38). This checks that neither case ever applied on this contract.
  const c = await view("get_config");
  const lines = [];
  for (let id = 1; id <= c.task_count; id++) {
    const task = await view("get_task", { task_id: id });
    if (!task.closed) continue;
    const subs = await view("list_submissions", { task_id: id });
    const unscored = subs.filter((s) => s.status !== "Scored").map((s) => `#${s.submission_id} ${typeof s.status === "string" ? s.status : Object.keys(s.status)[0]}`);
    const noB = subs.filter((s) => s.status === "Scored" && s.score_b_bps == null).map((s) => `#${s.submission_id}`);
    expect(!unscored.length && !noB.length, `task ${id}: not scored ${unscored.join(", ") || "none"}; scored without split B ${noB.join(", ") || "none"}`);
    lines.push(`task ${id}: ${subs.length} of ${subs.length} scored with split B`);
  }
  expect(lines.length > 0, "no closed task");
  return lines.join("; ");
});
check("11, 28", "Task 3: the public leader lost, the sealed split picked the champion", async () => {
  const closeTx = (await Promise.all(rowTx(28).map(mustTx))).find((t) => t.method === "close_task");
  expect(closeTx?.ok, "no successful close_task transaction in CLAIMS row 28");
  const ev = closeTx.events.find((e) => e.event === "task_closed");
  const [s4, s5] = [await view("get_submission", { submission_id: 4 }), await view("get_submission", { submission_id: 5 })];
  expect(ev?.data.task_id === 3 && ev.data.winner === 4 && ev.data.final_score_bps === s4.score_b_bps, `close event ${JSON.stringify(ev?.data)}`);
  expect(s5.score_a_bps > s4.score_a_bps && s4.score_b_bps > s5.score_b_bps, `#4 ${s4.score_a_bps}/${s4.score_b_bps}, #5 ${s5.score_a_bps}/${s5.score_b_bps}`);
  return `${short(closeTx.hash)}: #5 led split A (${s5.score_a_bps} vs ${s4.score_a_bps} bps), #4 won split B (${s4.score_b_bps} vs ${s5.score_b_bps} bps)`;
});
check("11, 27", "Open tasks do not reveal split B through any view", async () => {
  const c = await view("get_config");
  let n = 0; const open = [];
  for (let id = 1; id <= c.task_count; id++) {
    const task = await view("get_task", { task_id: id });
    if (task.closed) continue;
    open.push(id);
    for (const row of await view("leaderboard", { task_id: id })) expect(row.score_b_bps === null, `leaderboard of task ${id} shows split B of #${row.submission_id}`);
    for (const s of await view("list_submissions", { task_id: id })) {
      const one = await view("get_submission", { submission_id: s.submission_id });
      for (const x of [s, one]) {
        const raw = x.last_outlayer_raw ? JSON.parse(x.last_outlayer_raw) : {};
        expect(x.score_b_bps === null && x.f1_b_bps === null && typeof raw.b !== "object", `#${x.submission_id} of open task ${id} reveals split B`);
      }
      n++;
    }
  }
  return open.length ? `tasks ${open.join(", ")} are open: ${n} entries checked in leaderboard, list_submissions and get_submission` : "no task is open right now, nothing to hide";
});
check("23, 24, 25, 26, 30", "The entries the README names have the scores, sizes and owners it states", async () => {
  // submission, task, owner, bytes, split A in bps (CLAIMS rows 24 to 26 and 30; split A never changes after scoring)
  const want = [[7, 5, "p1", 1611, 8350], [8, 5, "p2", 10051, 8200], [9, 5, TEAM, 32087, 8250], [10, 5, "maker", 3059, 8350], [11, 5, "p2", 5041, 8300], [12, 5, "maker", 6307, 8300], [13, 4, "maker", 12539, 7450], [14, 5, "dexseu0.testnet", 3191, 8350], [15, 5, "stevbeq.testnet", 9511, 8350]];
  for (const [id, task, owner, bytes, a] of want) {
    const s = await view("get_submission", { submission_id: id });
    expect(s.task_id === task && acct(s.owner) === owner && s.bytes === bytes && s.score_a_bps === a, `#${id}: task ${s.task_id}, ${acct(s.owner)}, ${s.bytes} B, ${s.score_a_bps} bps`);
  }
  const t5 = await view("get_task", { task_id: 5 });
  expect(t5.slug === "near-retention" && t5.n_features === 22, `task 5 is ${t5.slug} with ${t5.n_features} features`);
  return `#7 to #15 match (the agent's entries: #10 ${8350} bps and #12 ${8300} bps on task 5, #13 ${7450} bps on task 4; quickstart entries #14 and #15 ${8350} bps)`;
});

section("The model lives in the contract and answers for a fee");
check("1", "The champion's bytes on chain are the model file in this repo", async () => {
  const { bytes } = await model(4);
  const sub = await view("get_submission", { submission_id: 4 });
  const file = read("tasks/german-credit/out/deep/model.bin");
  expect(bytes.equals(file), "get_model_bytes(4) differs from tasks/german-credit/out/deep/model.bin");
  expect(sha256(bytes).toString("base64") === sub.model_hash, "model_hash stored in the contract is not the sha256 of the bytes");
  return `${bytes.length} bytes, sha256 ${sha256(bytes).toString("hex").slice(0, 16)}… = tasks/german-credit/out/deep/model.bin`;
});
let agentKey;
check("1, 12, 13", "Ten paid predictions by the agent: on-chain answer = the same bytes scored locally", async () => {
  expect(agentTable.length === 10, `docs/AGENT.md lists ${agentTable.length} transactions`);
  const out = [];
  for (const h of agentTable) out.push(await checkPrediction(h, "agent." + TEAM));
  agentKey = out[0].key;
  expect(out.every((o) => o.key === agentKey && o.sid === 4), "the ten calls were not all signed by one key for champion #4");
  return `10 of 10 equal (first: ${out[0].score}); each credits ${near(out[0].fee)} NEAR to ${acct(out[0].owner)}`;
});
check("2", "One prediction with the 33 KB, 50-tree champion costs about 4.3 Tgas", async () => {
  const gas = [];
  for (const h of agentTable) gas.push((await checkPrediction(h, "agent." + TEAM)).gas);
  const [lo, hi] = [Math.min(...gas), Math.max(...gas)];
  expect(lo > 4.2e12 && hi < 4.5e12, `function receipts burnt ${tgas(lo)} to ${tgas(hi)} Tgas`);
  return `function receipts burnt ${tgas(lo)} to ${tgas(hi)} Tgas`;
});
check("13", "The agent's key can only call the prediction methods of this contract", async () => {
  if (!agentKey) throw new Unreachable("needs the agent's transactions from the check above, which were not read");
  const r = await rpc(VIEW_RPCS, "query", { request_type: "view_access_key", block_id: BLOCK.height, account_id: "agent." + TEAM, public_key: agentKey });
  expect(!r.error, `key ${agentKey.slice(0, 16)}… is no longer on the account (${r.cause})`);
  const p = r.result.permission?.FunctionCall;
  expect(p && p.receiver_id === CONTRACT && p.method_names.length > 0 && p.method_names.every((m) => ["predict_task", "predict"].includes(m)), `permission ${JSON.stringify(r.result.permission)}`);
  return `${agentKey.slice(0, 16)}…: function-call key, receiver ${CONTRACT}, methods ${p.method_names.join(", ")}`;
});
check("25", "The buying agent's calls to the autonomous agent's model #10 equal the local score", async () => {
  const out = [];
  for (const h of rowTx(25)) { const t = await mustTx(h); if (t.method === "predict") out.push(await checkPrediction(h, "agent." + TEAM)); }
  expect(out.length === 3 && out.every((o) => o.sid === 10), `${out.length} predict transactions in CLAIMS row 25`);
  return `3 of 3 equal, ${tgas(Math.min(...out.map((o) => o.gas)))} to ${tgas(Math.max(...out.map((o) => o.gas)))} Tgas, fee to ${acct(out[0].owner)}`;
});
check("14", "Another contract buys a prediction through a promise", async () => {
  let paid = 0, rejected = 0, who;
  for (const h of rowTx(14)) {
    const t = await mustTx(h);
    if (t.method !== "screen") continue;
    who = t.receiver;
    expect(t.receiver !== CONTRACT, `${short(h)}: screen was called on the Laurel contract itself`);
    const ev = t.events.find((e) => e.event === "prediction" && e.executor === CONTRACT);
    if (!ev) {
      // the error path CLAIMS cites: the model rejects the input, nothing is charged, the consumer reports the failure
      expect(t.receipts.some((r) => r.executor === CONTRACT && r.failed), `${short(h)}: no prediction and no rejected call in ${CONTRACT}`);
      rejected++;
      continue;
    }
    const local = rawScore((await model(ev.data.submission_id)).decoded, t.actions[0].args.features).toString();
    expect(t.ok && ev.data.caller === t.receiver, `${short(h)}: the prediction was paid by ${ev.data.caller}, not by ${t.receiver}`);
    expect(String(ev.data.score) === local && String(JSON.parse(t.value).score) === local, `${short(h)}: consumer got ${t.value}, the same bytes give ${local} locally`);
    paid++;
  }
  expect(paid >= 3, `${paid} paid screen transactions in CLAIMS row 14`);
  return `${paid} calls to ${acct(who)}.screen: the model ran in ${CONTRACT} with the consumer contract as the paying caller and returned the local score` + (rejected ? `; ${rejected} bad input rejected without a charge` : "");
});
check("22", "A browser wallet bought prediction credit", async () => {
  const t = (await Promise.all(rowTx(22).map(mustTx))).find((x) => x.method === "deposit_credit");
  expect(t?.ok && t.receiver === CONTRACT && !t.signer.endsWith(TEAM), "no successful deposit_credit from an outside account in CLAIMS row 22");
  return `${short(t.hash)}: ${t.signer} deposited ${near(t.actions[0].deposit)} NEAR of credit`;
});

section("Every transaction cited in CLAIMS.md");
if (!flag("--no-sweep")) check("all", "Every transaction hash in CLAIMS.md exists on NEAR testnet", async () => {
  const all = hashesIn(claims);
  const missing = [], failed = [];
  for (const h of all) { const t = await tx(h); if (!t) missing.push(h); else if (!t.ok || t.receipts.some((r) => r.failed)) failed.push(h); }
  expect(missing.length === 0, `not found: ${missing.join(", ")}`);
  return `${all.length} of ${all.length} found` + (failed.length ? `; ${failed.length} ended in a failure (${failed.map(short).join(", ")}), which CLAIMS cites as a rejected path` : "; all of them succeeded");
});

section("Also on NEAR mainnet (same code, small funds, a demo)");
const MAINNET_CONTRACT = opt("--mainnet-contract") ?? "laurel.ikantongkolmangut.near";
const MAINNET_RPCS = ["https://rpc.mainnet.fastnear.com", "https://rpc.mainnet.near.org"];
const mview = async (method, args = {}) => {
  const r = await rpc(MAINNET_RPCS, "query", { request_type: "call_function", finality: "final", account_id: MAINNET_CONTRACT, method_name: method, args_base64: Buffer.from(JSON.stringify(args)).toString("base64") });
  if (r.error) throw new Mismatch(`mainnet view ${method} failed: ${r.cause}`);
  return JSON.parse(Buffer.from(r.result.result).toString());
};
check("mainnet", "The mainnet contract runs the same wasm and pins the same evaluator on outlayer.near", async () => {
  const r = await rpc(MAINNET_RPCS, "query", { request_type: "view_account", finality: "final", account_id: MAINNET_CONTRACT });
  if (r.error) throw new Mismatch(`mainnet account ${MAINNET_CONTRACT}: ${r.cause}`);
  const acc = r.result;
  const local = base58(sha256(read("wasm/bursa.wasm")));
  expect(acc.code_hash === local, `mainnet code hash ${acc.code_hash}, sha256(wasm/bursa.wasm) ${local}`);
  const [, pinned] = await mview("get_evaluator");
  const ev = sha256(read("wasm/evaluator.wasm")).toString("hex");
  expect(pinned === ev, `mainnet pins ${pinned}, sha256(wasm/evaluator.wasm) ${ev}`);
  const c = await mview("get_config");
  expect(c.outlayer === "outlayer.near", `mainnet contract uses ${c.outlayer}`);
  return `${MAINNET_CONTRACT}: code ${short(local)} = testnet's, evaluator ${pinned.slice(0, 12)}…, ${c.task_count} task(s), ${c.submission_count} model(s)`;
});
check("mainnet", "Every mainnet score came from the pinned evaluator, and each closed mainnet task's champion is its best sealed score", async () => {
  const [, pinned] = await mview("get_evaluator");
  const tasks = await mview("list_tasks", { from: 0, limit: 50 });
  let scored = 0, closed = 0;
  for (const t of tasks) {
    const subs = await mview("list_submissions", { task_id: t.task_id });
    for (const s of subs.filter((s) => s.status === "Scored")) { expect(s.scored_by === pinned, `#${s.submission_id} scored by ${s.scored_by}`); scored++; }
    if (t.closed) {
      const gap = subs.filter((s) => s.status !== "Scored" || s.score_b_bps == null).map((s) => `#${s.submission_id}`);
      expect(!gap.length, `mainnet task ${t.task_id}: entries not scored on split B: ${gap.join(", ")} (the split-A fallback would apply)`);
      const board = (await mview("leaderboard", { task_id: t.task_id })).filter((r) => r.score_b_bps != null);
      const best = board.sort((a, b) => b.score_b_bps - a.score_b_bps || a.submission_id - b.submission_id)[0];
      expect(!best || best.submission_id === t.winner, `task ${t.task_id}: champion #${t.winner}, best sealed #${best?.submission_id}`);
      closed++;
    }
  }
  return `${scored} scored model(s) on mainnet, all by ${pinned.slice(0, 12)}…; ${closed} closed task(s), every entry scored on split B, champion = best split B`;
});
check("33-37", "Every mainnet transaction cited in CLAIMS.md exists on mainnet and succeeded", async () => {
  const hashes = [...mainnetTx(claims)];
  const bad = [];
  for (const h of hashes) {
    const r = await rpc(["https://archival-rpc.mainnet.fastnear.com", "https://rpc.mainnet.fastnear.com"], "EXPERIMENTAL_tx_status", { tx_hash: h, sender_account_id: MAINNET_CONTRACT, wait_until: "NONE" }, { gap: 300, attempts: 8 });
    const st = r.result?.status;
    if (r.error || !st || st.Failure) bad.push(`${short(h)} ${r.cause ?? JSON.stringify(st?.Failure ?? "").slice(0, 60)}`);
  }
  expect(hashes.length > 0 && !bad.length, bad.length ? `not found or failed: ${bad.join(", ")}` : "no mainnet transactions cited");
  return `${hashes.length} mainnet transactions found, all succeeded`;
});

section("Live endpoints (not on-chain)");
const http = async (url, init) => { try { return await fetch(url, { ...init, signal: AbortSignal.timeout(25000) }); } catch (e) { throw new Unreachable(`${new URL(url).host}: ${String(e?.message ?? e).slice(0, 80)}`); } };
check("16", "The site answers", async () => {
  const r = await http("https://laurel-near.vercel.app/");
  expect(r.status === 200, `HTTP ${r.status}`);
  return "https://laurel-near.vercel.app → 200";
});
check("21", "The remote MCP endpoint lists its tools with nothing installed", async () => {
  const r = await http("https://laurel-near.vercel.app/api/mcp", { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }) });
  const text = await r.text();
  const line = text.split("\n").find((l) => l.startsWith("data:"))?.slice(5) ?? text;
  let tools = []; try { tools = JSON.parse(line).result.tools; } catch { /* reported below */ }
  expect(r.status === 200 && tools.length >= 5 && tools.some((t) => t.name === "laurel_predict_local"), `HTTP ${r.status}, ${tools.length} tools`);
  return `${tools.length} tools, among them ${tools.slice(0, 3).map((t) => t.name).join(", ")}`;
});
check("20", "laurel-mcp is published on npm", async () => {
  const r = await http("https://registry.npmjs.org/laurel-mcp/latest");
  const p = await r.json();
  const local = JSON.parse(read("mcp/package.json").toString()).version;
  expect(p.name === "laurel-mcp" && p.version === local, `npm has ${p.version}, mcp/package.json says ${local}`);
  return `laurel-mcp@${p.version} = mcp/package.json`;
});

// ---------- run ----------
try {
  const b = await rpc(VIEW_RPCS, "block", { finality: "final" });
  BLOCK = { height: b.result.header.height, time: new Date(Number(BigInt(b.result.header.timestamp_nanosec) / 1000000n)).toISOString().replace(/\.\d+Z$/, "Z") };
  const a = await rpc(VIEW_RPCS, "query", { request_type: "view_account", block_id: BLOCK.height, account_id: CONTRACT });
  if (a.result) { ACCOUNT = a.result; NOT_TX.add(a.result.code_hash); }
} catch (e) {
  console.error(`No NEAR testnet RPC node answered (${e.message}). Nothing was verified; the last full run is in docs/VERIFY.md.`);
  process.exit(2);
}
for (const [i, c] of checks.entries()) {
  progress(`check ${i + 1} of ${checks.length}: ${c.title}`);
  try { results.push({ ...c, status: "PASS", detail: await c.fn() }); }
  catch (e) {
    if (e instanceof Unreachable) results.push({ ...c, status: "UNREACHABLE", detail: e.message });
    else if (e instanceof Mismatch) results.push({ ...c, status: "FAIL", detail: e.message });
    else results.push({ ...c, status: "FAIL", detail: "unexpected: " + String(e?.message ?? e).slice(0, 300) });
  }
}
progress("");
if (!quiet && process.stderr.isTTY) process.stderr.write("\r");

const count = (s) => results.filter((r) => r.status === s).length;
const summary = { contract: CONTRACT, network: "testnet", block: BLOCK.height, block_time: BLOCK.time, checks: results.length, pass: count("PASS"), fail: count("FAIL"), unreachable: count("UNREACHABLE"), transactions_read: [...txCache.values()].filter((t) => t && !(t instanceof Unreachable)).length, rpc_calls: rpcCalls, seconds: Math.round((Date.now() - started) / 1000) };
const verdict = summary.fail ? `${summary.fail} FAILED` : summary.unreachable ? `nothing failed, ${summary.unreachable} could not be reached` : "all passed";

if (quiet) {
  console.log(JSON.stringify({ ...summary, results: results.map(({ fn, ...r }) => r) }, null, 2));
} else {
  console.log(`Laurel · verify_claims · read-only, no keys\ncontract ${CONTRACT} · NEAR testnet · every view read at block ${BLOCK.height} (${BLOCK.time})\n`);
  for (const [i, r] of results.entries()) {
    const s = sections.find((x) => x.at === i);
    if (s) console.log(`${i ? "\n" : ""}${s.title}`);
    console.log(`  ${r.status.padEnd(5)} ${r.title}  [CLAIMS ${r.rows}]\n        ${r.detail}`);
  }
  console.log(`\n${summary.checks} checks: ${summary.pass} PASS, ${summary.fail} FAIL, ${summary.unreachable} UNREACHABLE · ${summary.transactions_read} transactions read · ${summary.seconds} s\n${verdict}`);
}

const mdPath = opt("--md");
if (mdPath) {
  const esc = (s) => String(s).replace(/\|/g, "\\|");
  // a shortened hash in a detail line becomes a link to the explorer
  const link = (s) => { let out = esc(s); for (const [h, t] of txCache) if (t && !(t instanceof Unreachable)) out = out.split(short(h)).join(`[\`${short(h)}\`](${EXPLORER}${h})`); return out; };
  const lines = [
    "# VERIFY: the last full run of `node tools/verify_claims.mjs`", "",
    `The script re-reads NEAR testnet and checks the on-chain claims of [README.md](../README.md) and [CLAIMS.md](../CLAIMS.md). It is read-only: no key, no \`.env\`, no transaction, no \`npm install\` (Node 18+). Run it yourself from the repository root:`, "",
    "```bash", "node tools/verify_claims.mjs", "```", "",
    `Exit code 0 = every check passed, 1 = a check failed, 2 = nothing failed but a node could not be reached (public RPC nodes limit the request rate; wait a minute and run it again). This file is the snapshot of one run, written with \`--md docs/VERIFY.md\`.`, "",
    `| | |`, `|---|---|`,
    `| Contract | \`${CONTRACT}\` (NEAR testnet) |`,
    `| Block | every view was read at final block ${BLOCK.height}, ${BLOCK.time} |`,
    `| Result | **${summary.pass} PASS, ${summary.fail} FAIL, ${summary.unreachable} UNREACHABLE** of ${summary.checks} checks; ${summary.transactions_read} transactions read back from an archival node; ${summary.seconds} s |`, "",
  ];
  for (const [i, r] of results.entries()) {
    const s = sections.find((x) => x.at === i);
    if (s) lines.push("", `## ${s.title}`, "", "| Result | Check | CLAIMS rows | Observed |", "|---|---|---|---|");
    lines.push(`| ${r.status} | ${esc(r.title)} | ${r.rows} | ${link(r.detail)} |`);
  }
  lines.push("", "What the script does not cover: claims that are not on-chain facts (the unit tests, which run in CI; the bit-for-bit equality of TEE, local and Python scores in docs/E2E.md and docs/EVALUATOR.md; the dataset split; the Agent SDK transcripts). Those rows of CLAIMS.md point to the code, test or log that backs them.", "");
  fs.writeFileSync(path.resolve(process.cwd(), mdPath), lines.join("\n"));
  if (!quiet) console.log(`snapshot written to ${mdPath}`);
}
process.exit(summary.fail ? 1 : summary.unreachable ? 2 : 0);
