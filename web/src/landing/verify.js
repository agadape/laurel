// "Check it yourself": after an on-chain answer, the visitor's browser re-checks it against NEAR testnet and the
// files it can fetch, with no server of ours in between. Each line says what was checked and what was seen.
import { LEAF } from "../model.js";
import { contractId } from "../rpc.js";

const TESTNET = { network: "testnet", rpcs: ["https://rpc.testnet.fastnear.com", "https://archival-rpc.testnet.fastnear.com", "https://test.rpc.fastnear.com"], attest: "https://testnet-api.outlayer.ai/attestations/by-tx/", register: "worker.outlayer.testnet" };
let NET = TESTNET;   // set by verifyPanel for the network that answered
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const short = (s, a = 8, b = 6) => (s && s.length > a + b + 1 ? `${s.slice(0, a)}…${s.slice(-b)}` : s);

async function rpc(method, params) {
  let last;
  for (const url of NET.rpcs) {
    try {
      const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: "laurel-check", method, params }) });
      const j = await r.json();
      if (j.error) throw new Error(j.error.data?.toString?.() || j.error.message || JSON.stringify(j.error));
      return j.result;
    } catch (e) { last = e; }
  }
  throw last;
}
const view = async (method, args = {}) => {
  const r = await rpc("query", { request_type: "call_function", finality: "final", account_id: NET.contract || contractId(), method_name: method, args_base64: btoa(JSON.stringify(args)) });
  if (r.error) throw new Error(r.error);
  return JSON.parse(new TextDecoder().decode(new Uint8Array(r.result)));
};
const sha256 = async (bytes) => new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
const hex = (u8) => Array.from(u8, (b) => b.toString(16).padStart(2, "0")).join("");
const b64 = (u8) => btoa(String.fromCharCode(...u8));
const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

function decode(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let o = 0;
  const u8 = () => dv.getUint8(o++), u16 = () => { const v = dv.getUint16(o, true); o += 2; return v; }, u32 = () => { const v = dv.getUint32(o, true); o += 4; return v; }, i64 = () => { const v = dv.getBigInt64(o, true); o += 8; return v; };
  u8(); u16(); i64(); i64();
  const bias = i64(), trees = [];
  for (let t = 0, n = u32(); t < n; t++) { const nodes = []; for (let i = 0, m = u32(); i < m; i++) nodes.push({ feature: u16(), threshold: i64(), left: u16(), right: u16(), value: i64() }); trees.push(nodes); }
  return { bias, trees };
}
function rawScore(model, x) {
  let acc = model.bias;
  for (const nodes of model.trees) {
    let i = 0;
    for (let g = 0; g < 64; g++) { const n = nodes[i]; if (n.left === LEAF) { acc += n.value; break; } i = BigInt(x[n.feature]) <= n.threshold ? n.left : n.right; }
  }
  return acc;
}

/** The checks, in order. Each returns a line of what was seen, or throws with what was wrong. */
function checks(ans) {
  const C = NET.contract || contractId();
  let tx, sub, task, evaluator, bytes, att, quote, td;
  return [
    [`The transaction is on NEAR ${NET.network} and succeeded`, async () => {
      const r = await rpc("EXPERIMENTAL_tx_status", { tx_hash: ans.tx, sender_account_id: ans.paid_by, wait_until: "NONE" });
      tx = r;
      const t = r.transaction, a = t.actions?.[0]?.FunctionCall;
      if (!r.status?.SuccessValue) throw new Error(`status ${JSON.stringify(r.status).slice(0, 80)}`);
      if (t.receiver_id !== C || a?.method_name !== "predict_task") throw new Error(`${t.receiver_id}.${a?.method_name}`);
      const args = JSON.parse(atob(a.args));
      if (JSON.stringify(args.features) !== JSON.stringify(ans.features)) throw new Error("the features in the transaction differ from the case shown");
      return `${esc(t.signer_id)} called <code>${esc(C)}.predict_task</code> with the ${args.features.length} features shown; result <code>${esc(atob(r.status.SuccessValue))}</code>`;
    }],
    ["The key that signed it can only buy predictions", async () => {
      const t = tx.transaction;
      const k = await rpc("query", { request_type: "view_access_key", finality: "final", account_id: t.signer_id, public_key: t.public_key });
      const fc = k.permission?.FunctionCall;
      if (!fc) throw new Error("it is a full-access key");
      if (fc.receiver_id !== C || fc.method_names.some((m) => !["predict_task", "predict"].includes(m))) throw new Error(JSON.stringify(fc).slice(0, 120));
      return `function-call key <code>${esc(short(t.public_key, 14, 4))}</code>: only <code>${fc.method_names.join(", ")}</code> on this contract; NEAR itself rejects any transfer or other call from it`;
    }],
    ["The model that answered is the task's champion, picked by the sealed split", async () => {
      task = await view("get_task", { task_id: ans.task_id });
      const board = await view("leaderboard", { task_id: ans.task_id });
      if (!task.closed || task.winner !== ans.submission_id) throw new Error(`champion is #${task.winner}, answer came from #${ans.submission_id}`);
      const best = board.filter((r) => r.score_b_bps != null).sort((x, y) => y.score_b_bps - x.score_b_bps || x.submission_id - y.submission_id)[0];
      if (best.submission_id !== task.winner) throw new Error(`best sealed score is #${best.submission_id}`);
      const pub = board.slice().sort((x, y) => y.score_a_bps - x.score_a_bps)[0];
      return `#${task.winner} has the best sealed (split B) score, ${(best.score_b_bps / 100).toFixed(2)} %, of ${board.length} entries${pub.submission_id !== task.winner ? `; the public-split leader was #${pub.submission_id}` : ""}`;
    }],
    ["Its bytes are the ones stored when it was entered", async () => {
      sub = await view("get_submission", { submission_id: ans.submission_id });
      bytes = fromB64(await view("get_model_bytes", { submission_id: ans.submission_id }));
      const h = b64(await sha256(bytes));
      if (h !== sub.model_hash) throw new Error(`sha256 ${h} ≠ recorded ${sub.model_hash}`);
      return `sha256 of the ${bytes.length.toLocaleString("en-US")} bytes = <code>${esc(short(sub.model_hash, 10, 4))}</code>, the hash recorded at <code>submit_model</code>`;
    }],
    ["The same bytes, run in your browser, give the same answer", async () => {
      const mine = rawScore(decode(bytes), ans.features);
      if (String(mine) !== String(ans.raw_score)) throw new Error(`browser ${mine}, chain ${ans.raw_score}`);
      return `raw score <code>${mine}</code> here = <code>${esc(ans.raw_score)}</code> in the transaction (integer arithmetic, no rounding)`;
    }],
    ["It was scored by the evaluator the contract pins", async () => {
      evaluator = await view("get_evaluator");
      if (sub.scored_by !== evaluator[1]) throw new Error(`scored_by ${sub.scored_by} ≠ pinned ${evaluator[1]}`);
      return `<code>scored_by</code> = pinned hash <code>${esc(short(evaluator[1], 10, 4))}</code>; the TEE secret holding the test rows opens only for that wasm`;
    }],
    ["The evaluator file hashes to the pinned value", async () => {
      const wasm = new Uint8Array(await (await fetch(evaluator[0], { cache: "no-store" })).arrayBuffer());
      const h = hex(await sha256(wasm));
      if (h !== evaluator[1]) throw new Error(`sha256 ${h} ≠ ${evaluator[1]}`);
      return `downloaded ${wasm.length.toLocaleString("en-US")} bytes from <code>${esc(new URL(evaluator[0]).host)}</code>: sha256 matches; its source is <code>evaluator/</code> in the repository`;
    }],
    ["Its score was computed in an Intel TDX enclave that OutLayer's contract approves", async () => {
      const map = await (await fetch(`${import.meta.env.BASE_URL}aset/attested.json`)).json();
      const scoreTx = (NET.network === "mainnet" ? map.mainnet?.runs : map.runs)?.[ans.submission_id];
      if (!scoreTx) throw new Error(`no scoring transaction on file for #${ans.submission_id}`);
      att = await (await fetch(`${NET.attest}${scoreTx}`)).json();
      const { getCollateralAndVerify, PHALA_PCCS_URL } = await import("@phala/dcap-qvl");
      quote = Uint8Array.from(atob(att.tdx_quote), (c) => c.charCodeAt(0));
      const v = await getCollateralAndVerify(quote, PHALA_PCCS_URL);
      td = v.report.data;
      if (v.status !== "UpToDate") throw new Error(`TCB status ${v.status}`);
      const m = { mrtd: hex(td.mrTd), rtmr0: hex(td.rtMr0), rtmr1: hex(td.rtMr1), rtmr2: hex(td.rtMr2), rtmr3: hex(td.rtMr3) };
      const r = await rpc("query", { request_type: "call_function", finality: "final", account_id: NET.register, method_name: "get_approved_measurements", args_base64: btoa("{}") });
      const approved = JSON.parse(new TextDecoder().decode(new Uint8Array(r.result)));
      if (!approved.some((x) => Object.keys(m).every((k) => x[k] === m[k]))) throw new Error(`measurements MRTD ${m.mrtd.slice(0, 12)}… not approved`);
      return `scoring tx <code>${esc(short(scoreTx))}</code>: OutLayer's TDX quote for that run verifies to Intel's root certificate in your browser (TCB UpToDate), and its five measurements are on the approved list of <code>${esc(NET.register)}</code>`;
    }],
    ["That enclave ran the pinned evaluator on the task's secret and returned the recorded score", async () => {
      const enc = new TextEncoder(), parts = [];
      const le64 = (n) => { const b = new Uint8Array(8); new DataView(b.buffer).setBigInt64(0, BigInt(n), true); return b; };
      parts.push(enc.encode(att.task_type), le64(att.task_id));
      for (const k of ["repo", "commit", "build_target", "wasm_hash", "input_hash"]) if (att[k] != null) parts.push(enc.encode(att[k]));
      parts.push(enc.encode(att.output_hash));
      if (att.block_height != null) parts.push(le64(att.block_height));
      for (const k of ["caller_account_id", "project_id", "secrets_ref"]) if (att[k] != null) parts.push(enc.encode(att[k]));
      parts.push(le64(att.timestamp));
      if (att.attached_usd != null) parts.push(enc.encode(att.attached_usd));
      const all = new Uint8Array(parts.reduce((a, p) => a + p.length, 0));
      parts.reduce((o, p) => (all.set(p, o), o + p.length), 0);
      if (hex(await sha256(all)) !== hex(td.reportData).slice(0, 64)) throw new Error("the quote's report_data is not the hash of this run's record");
      if (att.wasm_hash !== evaluator[1] || att.executed_wasm_sha256 !== evaluator[1]) throw new Error(`ran wasm ${att.wasm_hash}`);
      if (att.secrets_ref !== `${task.secrets_account}/${task.secrets_profile}`) throw new Error(`secret ${att.secrets_ref}`);
      const st = await rpc("EXPERIMENTAL_tx_status", { tx_hash: att.transaction_hash, sender_account_id: att.caller_account_id, wait_until: "NONE" });
      const recs = Object.fromEntries((st.receipts || []).map((x) => [x.receipt_id, x]));
      const o = st.receipts_outcome.find((x) => recs[x.id]?.receipt?.Action?.actions?.some((a) => a.FunctionCall?.method_name === "on_execution_response"));
      const out = fromB64(o.outcome.status.SuccessValue);
      if (hex(await sha256(out)) !== att.output_hash) throw new Error("the output on chain is not the attested output");
      let res = JSON.parse(new TextDecoder().decode(out)); if (typeof res === "string") res = JSON.parse(res);
      if (res.a.bal_acc_bps !== sub.score_a_bps || (sub.score_b_bps != null && res.b.bal_acc_bps !== sub.score_b_bps)) throw new Error("the recorded scores differ from the attested output");
      return `the quote commits to this run's record: wasm <code>${esc(short(att.wasm_hash, 10, 4))}</code>, secret <code>${esc(att.secrets_ref)}</code>, and an output whose sha256 matches what OutLayer returned on-chain, holding split A ${(res.a.bal_acc_bps / 100).toFixed(2)} % and split B ${(res.b.bal_acc_bps / 100).toFixed(2)} %, the scores the contract recorded`;
    }],
    ["The fee went to the model's owner", async () => {
      let ev = null;
      for (const r of tx.receipts_outcome) for (const l of r.outcome.logs || []) { if (l.startsWith("EVENT_JSON:")) { const j = JSON.parse(l.slice(11)); if (j.event === "prediction") ev = j.data[0]; } }
      if (!ev) throw new Error("no prediction event in the transaction");
      if (ev.owner !== sub.owner || ev.fee !== task.fee_per_call) throw new Error(`event owner ${ev.owner}, fee ${ev.fee}`);
      return `the <code>prediction</code> event credits ${(Number(BigInt(ev.fee) / 10n ** 18n) / 1e6).toFixed(3)} NEAR to <code>${esc(short(ev.owner, 12, 10))}</code>, call #${ev.calls}`;
    }],
  ];
}

export function verifyPanel(host, ans, net = {}) {
  const box = document.createElement("div");
  box.className = "ask-check";
  box.innerHTML = `<button class="ask-next" type="button">Check it yourself ↓</button>`;
  host.appendChild(box);
  box.querySelector("button").addEventListener("click", async () => {
    NET = { ...TESTNET, ...net, rpcs: net.rpcs ? [...net.rpcs, "https://archival-rpc.mainnet.fastnear.com"] : TESTNET.rpcs };
    const list = checks(ans);
    box.innerHTML = `<p class="ask-check-head">Your browser is checking this answer against NEAR ${NET.network}, not against our server.</p><ol>${list.map(([t]) => `<li><b>${t}</b><span>…</span></li>`).join("")}</ol>`;
    const items = box.querySelectorAll("li");
    let ok = 0;
    for (let i = 0; i < list.length; i++) {
      const li = items[i];
      try { li.querySelector("span").innerHTML = await list[i][1](); li.classList.add("ok"); ok++; }
      catch (e) { li.querySelector("span").textContent = String(e.message || e).slice(0, 200); li.classList.add("bad"); }
      dispatchEvent(new Event("resize"));
    }
    box.insertAdjacentHTML("beforeend", `<p class="ask-check-foot">${ok === list.length ? `Verified: ${ok} of ${list.length} checks passed.` : `${ok} of ${list.length} checks passed.`} Not checked here: that the code behind OutLayer's approved measurements is honest, which rests on OutLayer's owner (see the README's trust boundaries). Every score on the contract: <code>node tools/verify_tee.mjs${NET.network === "mainnet" ? " --network mainnet --contract " + esc(NET.contract) : ""}</code>.</p>`);
    dispatchEvent(new Event("resize"));
  });
}
