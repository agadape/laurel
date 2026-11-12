// Re-check, from public data only, that every score on the Laurel contract was computed inside an attested Intel TDX
// enclave running the pinned evaluator. Read-only: no key, no account, no transaction.
//   cd tools && npm ci && node verify_tee.mjs              # every successful request_score on the contract
//   node verify_tee.mjs <tx_hash> [<tx_hash> ...]          # only these scoring transactions
//   [--json out.json]                                      # also write the per-run results
//   [--network mainnet --contract <account>]               # the same checks on NEAR mainnet
//
// For each scoring transaction it checks, and prints one line per check:
//   1. OutLayer's per-run attestation exists for this transaction (testnet-api.outlayer.ai/attestations/by-tx/<hash>).
//   2. The Intel TDX quote in it verifies down to Intel's root certificate, with collateral fetched from Intel's PCS,
//      and its TCB status is UpToDate (@phala/dcap-qvl, pure JavaScript).
//   3. The quote's five measurements (MRTD, RTMR0-3) are on OutLayer's approved list in worker.outlayer.testnet,
//      the contract that also verifies each worker key's quote on-chain before admitting it.
//   4. The quote's report_data is SHA-256 of this run's task record (OutLayer's formula, worker/src/tdx_attestation.rs).
//   5. That record names the evaluator wasm the Laurel contract pins, the task's secret, and the transaction's signer.
//   6. Its input hash is the sha256 of the input the contract sent (execution_requested event), and its output hash is
//      the sha256 of the result OutLayer returned to the contract (on_execution_response).
//   7. The score the contract recorded (model_scored event) is the split-A reading inside that attested output.
// What this does NOT prove: that the code behind the approved measurements is honest (OutLayer's owner approves them),
// or what the private rows contain; and the Laurel contract itself still trusts outlayer.testnet's callback.
import crypto from "node:crypto";
import fs from "node:fs";
import { getCollateralAndVerify } from "@phala/dcap-qvl";

const args = process.argv.slice(2);
const flag = (k) => (args.includes(`--${k}`) ? args[args.indexOf(`--${k}`) + 1] : null);
const MAINNET = flag("network") === "mainnet";
const CONTRACT = flag("contract") || (MAINNET ? process.env.MAINNET_CONTRACT_ID : process.env.BURSA_CONTRACT_ID) || (MAINNET ? null : "laurel.laurel-team-mw0x0c8g.testnet");
if (!CONTRACT) { console.log("--network mainnet needs --contract <account> (or MAINNET_CONTRACT_ID)"); process.exit(2); }
const REGISTER = MAINNET ? "worker.outlayer.near" : "worker.outlayer.testnet";
const ATTEST = MAINNET ? "https://api.outlayer.ai/attestations/by-tx/" : "https://testnet-api.outlayer.ai/attestations/by-tx/";
const INTEL_PCS = "https://api.trustedservices.intel.com/";
const RPCS = MAINNET ? ["https://archival-rpc.mainnet.fastnear.com", "https://rpc.mainnet.fastnear.com"] : ["https://archival-rpc.testnet.fastnear.com", "https://rpc.testnet.fastnear.com"];
const TXAPI = MAINNET ? "https://tx.main.fastnear.com/v0" : "https://tx.test.fastnear.com/v0";

const jsonOut = flag("json");
const given = args.filter((a, i) => !a.startsWith("--") && !["--json", "--network", "--contract"].includes(args[i - 1]));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sha256 = (b) => crypto.createHash("sha256").update(b).digest();
const hex = (b) => Buffer.from(b).toString("hex");

async function rpc(method, params) {
  let last;
  for (let attempt = 0; attempt < 6; attempt++) {
    for (const url of RPCS) {
      try {
        const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: "verify-tee", method, params }) });
        if (r.status === 429) throw new Error("rate limited");
        const j = await r.json();
        if (j.error) throw new Error(JSON.stringify(j.error.data ?? j.error.message ?? j.error).slice(0, 300));
        return j.result;
      } catch (e) { last = e; }
    }
    await sleep(800 * (attempt + 1));
  }
  throw last;
}
const view = async (account_id, method_name, a = {}) => {
  const r = await rpc("query", { request_type: "call_function", finality: "final", account_id, method_name, args_base64: Buffer.from(JSON.stringify(a)).toString("base64") });
  return JSON.parse(Buffer.from(r.result).toString());
};
/** Network hiccups (a dropped connection to Intel's PCS or OutLayer's API) are retried, not reported as a failed check. */
async function retry(fn, tries = 4) {
  for (let i = 1; ; i++) { try { return await fn(); } catch (e) { if (i >= tries) throw new Error(`network: ${e.message || e} (after ${tries} tries)`); await sleep(1500 * i); } }
}
const post = async (url, body) => (await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })).json();

/** Scoring transactions: the ones given, or every successful request_score sent to the contract. */
async function scoringTxs() {
  let hashes = given;
  if (!hashes.length) {
    const acc = await post(`${TXAPI}/account`, { account_id: CONTRACT });
    hashes = acc.account_txs.filter((t) => t.is_receiver && t.is_success).map((t) => t.transaction_hash);
  }
  const out = [];
  for (let i = 0; i < hashes.length; i += 20) {
    const j = await post(`${TXAPI}/transactions`, { tx_hashes: hashes.slice(i, i + 20) });
    for (const t of j.transactions || []) {
      const tx = t.transaction;
      if (tx.receiver_id === CONTRACT && tx.actions.some((a) => a.FunctionCall?.method_name === "request_score")) out.push({ hash: tx.hash, signer: tx.signer_id });
    }
  }
  return out;
}

/** OutLayer's task hash (report_data[0..32]), as in worker/src/tdx_attestation.rs generate_task_attestation. */
function taskHash(a) {
  const h = crypto.createHash("sha256");
  const le64 = (n) => { const b = Buffer.alloc(8); b.writeBigInt64LE(BigInt(n)); return b; };
  const leU64 = (n) => { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(n)); return b; };
  h.update(a.task_type); h.update(le64(a.task_id));
  for (const k of ["repo", "commit", "build_target", "wasm_hash", "input_hash"]) if (a[k] != null) h.update(a[k]);
  h.update(a.output_hash);
  if (a.block_height != null) h.update(leU64(a.block_height));
  for (const k of ["caller_account_id", "project_id", "secrets_ref"]) if (a[k] != null) h.update(a[k]);
  h.update(le64(a.timestamp));
  if (a.attached_usd != null) h.update(a.attached_usd);
  return h.digest();
}

const [, pinned] = await view(CONTRACT, "get_evaluator");
const approved = await view(REGISTER, "get_approved_measurements");
const isApproved = (m) => approved.some((x) => ["mrtd", "rtmr0", "rtmr1", "rtmr2", "rtmr3"].every((k) => x[k] === m[k]));
const tasks = Object.fromEntries((await view(CONTRACT, "list_tasks", { from: 0, limit: 50 })).map((t) => [t.task_id, t]));
const txs = await scoringTxs();
console.log(`NEAR ${MAINNET ? "mainnet" : "testnet"} · Laurel contract ${CONTRACT}; pinned evaluator ${pinned}`);
console.log(`OutLayer register ${REGISTER}: ${approved.length} approved measurement sets`);
console.log(`${txs.length} scoring transaction(s) to check\n`);

const results = [];
let pass = 0, fail = 0;
for (const { hash, signer } of txs) {
  const lines = [], res = { tx: hash, checks: {} };
  const check = (name, ok, seen) => { lines.push(`  ${ok ? "PASS" : "FAIL"}  ${name}${seen ? ` (${seen})` : ""}`); res.checks[name] = ok; return ok; };
  try {
    const st = await rpc("EXPERIMENTAL_tx_status", { tx_hash: hash, sender_account_id: signer, wait_until: "NONE" });
    const recs = Object.fromEntries((st.receipts || []).map((r) => [r.receipt_id, r]));
    let reqData = null, output = null, scored = null;
    for (const o of st.receipts_outcome) {
      for (const l of o.outcome.logs) {
        if (!l.startsWith("EVENT_JSON:")) continue;
        const e = JSON.parse(l.slice(11));
        if (e.event === "execution_requested") reqData = JSON.parse(e.data[0].request_data);
        if (e.event === "model_scored") scored = e.data[0];
      }
      const m = recs[o.id]?.receipt?.Action?.actions?.find((a) => a.FunctionCall)?.FunctionCall?.method_name;
      if (m === "on_execution_response" && o.outcome.status?.SuccessValue != null) output = Buffer.from(o.outcome.status.SuccessValue, "base64");
    }
    res.submission_id = scored?.submission_id; res.task_id = scored?.task_id;
    if (!scored?.ok || !reqData || !output) { lines.push("  SKIP  this request_score did not end in a recorded score (failed or retried run)"); results.push({ ...res, skipped: true }); console.log(`${hash} (#${scored?.submission_id ?? "?"})\n${lines.join("\n")}\n`); continue; }

    const r = await retry(() => fetch(ATTEST + hash));
    const att = r.ok ? await r.json() : null;
    if (!check("1 OutLayer published a TDX attestation for this run", !!att?.tdx_quote, att ? `request_id ${att.request_id}` : `HTTP ${r.status}`)) throw new Error("no attestation");

    const quote = Buffer.from(att.tdx_quote, "base64");
    const v = await retry(() => getCollateralAndVerify(quote, INTEL_PCS));
    const td = v.report?.data || {};
    check("2 the TDX quote verifies to Intel's root, TCB UpToDate", v.status === "UpToDate", `status ${v.status}, quote ${quote.length} bytes`);

    const m = { mrtd: hex(td.mrTd), rtmr0: hex(td.rtMr0), rtmr1: hex(td.rtMr1), rtmr2: hex(td.rtMr2), rtmr3: hex(td.rtMr3) };
    check(`3 its five measurements are approved on ${REGISTER}`, isApproved(m), `MRTD ${m.mrtd.slice(0, 12)}…, RTMR3 ${m.rtmr3.slice(0, 12)}…`);

    const th = taskHash(att);
    check("4 report_data = sha256 of this run's record", hex(td.reportData).slice(0, 64) === hex(th), hex(th).slice(0, 16) + "…");

    const task = tasks[scored.task_id];
    const secret = task ? `${task.secrets_account}/${task.secrets_profile}` : null;
    check("5 the record names the pinned evaluator, the task's secret and the signer", att.wasm_hash === pinned && att.executed_wasm_sha256 === pinned && att.secrets_ref === secret && att.caller_account_id === signer && att.transaction_hash === hash, `wasm ${att.wasm_hash.slice(0, 12)}…, secrets ${att.secrets_ref}, caller ${att.caller_account_id}`);

    check("6 input and output hashes match the chain", att.input_hash === hex(sha256(reqData.input_data ?? "")) && att.output_hash === hex(sha256(output)), `${output.length}-byte output`);

    let a = null;
    try { let o = JSON.parse(output.toString()); if (typeof o === "string") o = JSON.parse(o); a = o.a; } catch {}
    check("7 the recorded split-A score is the one in the attested output", a && a.bal_acc_bps === scored.score_a_bps, `#${scored.submission_id} task ${scored.task_id}: ${scored.score_a_bps} bps`);
  } catch (e) {
    if (!lines.some((l) => l.includes("FAIL"))) lines.push(`  FAIL  ${String(e.message || e).slice(0, 200)}`);
  }
  const ok = lines.every((l) => !l.includes("FAIL"));
  ok ? pass++ : fail++;
  results.push({ ...res, ok });
  console.log(`${hash} (#${res.submission_id ?? "?"}, task ${res.task_id ?? "?"})\n${lines.join("\n")}\n`);
  await sleep(300);
}
const skipped = results.filter((r) => r.skipped).length;
console.log(`${pass + fail} scored run(s): ${pass} attested, ${fail} not${skipped ? `; ${skipped} request(s) without a recorded score skipped` : ""}`);
if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify({ contract: CONTRACT, pinned_evaluator: pinned, checked_at: new Date().toISOString(), runs: results }, null, 2));
process.exit(fail ? 1 : 0);
