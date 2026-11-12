// "Ask the champion": one public holdout row, one real predict_task on NEAR mainnet or testnet (paid by the site's guest account
// through /api/ask), then the row's true label. If the server cannot pay, the same on-chain bytes run here and the
// page says no transaction was sent. Rows come from aset/holdout.json: every public holdout row, none picked by hand.
import { LEAF, decodeModel, b64ToBytes } from "../model.js";
import { EXPLORER_TX, EXPLORER_ACCOUNT, contractId } from "../rpc.js";
import { yoctoToNear, pad2 } from "./data.js";
import { verifyPanel } from "./verify.js";
import { payOwnWallet, signInMainnet, onMainnetWallet, restoreMainnet, mainnetAccount, TOP_UP } from "./mainnet-wallet.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const n = (x) => Number(x).toLocaleString("en-US");
const plural = (k, one, many = one + "s") => `${n(k)} ${k === 1 ? one : many}`;
const capped = (v) => (v >= 32767 ? "32,767 or more" : n(v));
const nearOf = (mnear) => (mnear >= 32767 ? "more than 32.7" : (mnear / 1000).toLocaleString("en-US", { maximumFractionDigits: 3 }));
const WALLET = { "relayer.nearmobile.near": "NEAR Mobile", "free-name.herewallet.near": "HERE Wallet", "meteor-relayer.near": "Meteor Wallet", "wallet-relay.intear.near": "Intear Wallet" };
const shortId = (s) => (s.length > 30 ? `${s.slice(0, 14)}…${s.slice(-10)}` : s);
const day = (s) => new Date(s.replace(" ", "T") + "Z").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

// How each dataset reads to a person. `f` maps feature name -> value for the row.
const SPEAK = {
  "near-retention": {
    next: "Another account",
    intro: (id) => `A real account on NEAR mainnet and its first seven days. The champion of exhibit ${id} has never seen it.`,
    title: (f, acc) => esc(shortId(acc[0])),
    link: (f, acc) => `<a href="https://nearblocks.io/address/${encodeURIComponent(acc[0])}" target="_blank" rel="noreferrer">This account on NearBlocks ↗</a>`,
    facts: (f, acc) => [
      `Created ${day(acc[1])} through ${esc(WALLET[acc[2]] || shortId(acc[2]))}`,
      `${capped(f.tx_signed_7d)} ${f.tx_signed_7d === 1 ? "action" : "actions"} on ${plural(f.active_days_7d, "day")} of its first week`,
      f.fn_calls_7d ? `${capped(f.fn_calls_7d)} contract ${f.fn_calls_7d === 1 ? "call" : "calls"} to ${plural(f.distinct_contracts_7d, "contract")}` : "No contract calls",
      f.near_in_7d_mnear || f.near_out_7d_mnear ? `${nearOf(f.near_in_7d_mnear)} NEAR received, ${nearOf(f.near_out_7d_mnear)} NEAR sent` : "No NEAR received or sent",
      [f.touched_defi_7d && "Used DeFi", f.staked_7d && "Staked", f.keys_added_7d && `${plural(f.keys_added_7d, "key")} added`].filter(Boolean).join(" · "),
    ].filter(Boolean),
    question: "Will it still be active a month later?",
    verdict: (y) => (y ? "it stays." : "it leaves."),
    truth: (y) => (y ? "it acted again between day 30 and day 90" : "it did nothing between day 30 and day 90"),
  },
  "german-credit": {
    next: "Another applicant",
    intro: (id) => `A loan application from the German Credit dataset (collected in 1973–75, published by UCI in 1994), used here as a simulation. The champion of exhibit ${id} has never seen it.`,
    title: (f) => `${n(f.credit_amount_dm)} DM over ${f.duration_months} months`,
    link: () => "",
    facts: (f, acc, codes) => [
      `For ${esc((codes.purpose?.[f.purpose] || "others").replace(/\s*\(UCI.*\)/, "").replace(/^others$/, "another purpose"))}, applicant aged ${f.age_years}`,
      `Checking account: ${esc(codes.checking_status?.[f.checking_status] || "unknown")}`,
      `Savings: ${esc(codes.savings?.[f.savings] || "unknown")}`,
      `Employed: ${esc(codes.employment_since?.[f.employment_since] || "unknown")}`,
      `Housing: ${esc(codes.housing?.[f.housing] || "unknown")}`,
    ],
    question: "Is this loan a bad risk?",
    verdict: (y) => (y ? "bad risk." : "good risk."),
    truth: (y) => (y ? "the bank recorded it as a bad risk" : "the bank recorded it as a good risk"),
  },
};

/** The contract's arithmetic (gbdt-core raw_score): bias plus one leaf per tree, left when feature <= threshold. */
function scoreLocal(model, x) {
  let acc = model.bias;
  for (const tree of model.trees) {
    let i = 0;
    for (let guard = 0; guard < 64; guard++) {
      const node = tree.nodes[i];
      if (!node) throw new Error("bad tree");
      if (node.left === LEAF) { acc += node.value; break; }
      i = x[node.feature] <= node.threshold ? node.left : node.right;
    }
  }
  return acc;
}


// The two places the button can pay. Testnet is the main exhibition; mainnet is the same contract code with a small
// prepaid credit of real NEAR (a demo), shown first when its champion exists.
const NETS = {
  mainnet: { label: "Mainnet · real NEAR", contract: "laurel.ikantongkolmangut.near", rpcs: ["https://rpc.mainnet.fastnear.com", "https://free.rpc.fastnear.com"], tx: (h) => `https://nearblocks.io/txns/${h}`, account: (a) => `https://nearblocks.io/address/${a}`, attest: "https://api.outlayer.ai/attestations/by-tx/", register: "worker.outlayer.near", what: "NEAR mainnet, with real NEAR" },
  testnet: { label: "Testnet", contract: null, rpcs: null, tx: EXPLORER_TX, account: EXPLORER_ACCOUNT, attest: "https://testnet-api.outlayer.ai/attestations/by-tx/", register: "worker.outlayer.testnet", what: "NEAR testnet" },
};

async function mainnetView(method, args = {}) {
  let last;
  for (const url of NETS.mainnet.rpcs) {
    try {
      const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: "laurel-ask", method: "query", params: { request_type: "call_function", finality: "final", account_id: NETS.mainnet.contract, method_name: method, args_base64: btoa(JSON.stringify(args)) } }) });
      const j = await r.json();
      if (j.error || j.result?.error) throw new Error(JSON.stringify(j.error || j.result.error));
      return JSON.parse(new TextDecoder().decode(new Uint8Array(j.result.result)));
    } catch (e) { last = e; }
  }
  throw last;
}

/** The mainnet champion, or null while no mainnet task is closed. */
async function loadMainnet() {
  const tasks = await mainnetView("list_tasks", { from: 0, limit: 50 });
  const champ = tasks.filter((t) => t.closed && t.winner != null).pop();
  if (!champ) return null;
  const [b64, sub, earned] = await Promise.all([mainnetView("get_model_bytes", { submission_id: champ.winner }), mainnetView("get_submission", { submission_id: champ.winner }), mainnetView("get_earnings", { submission_id: champ.winner })]);
  return { champ, model: decodeModel(b64ToBytes(b64)), calls: sub.calls, earned };
}

export function askSection(champ, winRow, earned) {
  if (!champ || !winRow) return "";
  return `<section class="l-sec ask-sec" id="ask"><i class="aura a1"></i><div class="l-wrap ask">
    <div class="ask-left">
      <h2 class="rise">Ask the champion.</h2>
      <div class="ask-net rise" role="tablist" aria-label="Network" hidden></div>
      <p class="body rise" id="ask-intro" style="--d:80ms"></p>
      <div class="ask-case rise" id="ask-case" style="--d:140ms" aria-live="polite"></div>
      <div class="ask-go rise" style="--d:200ms">
        <button class="btn solid" id="ask-btn" type="button" disabled><span>Ask the champion</span><i aria-hidden="true">↗</i></button>
        <button class="ask-next" id="ask-next" type="button" disabled>Another one</button>
      </div>
      <div class="ask-own rise" id="ask-own" hidden>
        <button class="btn" id="ask-own-btn" type="button"><span>Pay with my own NEAR wallet</span><i aria-hidden="true">↗</i></button>
        <p id="ask-own-note"></p>
      </div>
    </div>
    <div class="ask-right rise" style="--d:160ms">
      <div class="ask-out" id="ask-out" aria-live="polite"></div>
      <div class="ask-ledger"><div><b data-ask="calls">${winRow.calls}</b><span data-ask="calls-label">predictions served by #${champ.winner}</span></div><div><b data-ask="earned">${earned}</b><span>NEAR earned by its owner</span></div></div>
    </div>
  </div></section>`;
}

export async function wireAsk(root, champ, champModel) {
  const $ = (s) => root.querySelector(s);
  const btn = $("#ask-btn"), next = $("#ask-next"), box = $("#ask-case"), out = $("#ask-out"), tabs = $(".ask-net");
  if (!btn || !champ || !champModel) return;
  const label = btn.querySelector("span");
  let all;
  try { all = await fetch(`${import.meta.env.BASE_URL}aset/holdout.json`).then((r) => r.json()); } catch { $("#ask")?.remove(); return; }
  const dsOf = (c) => all.datasets.find((d) => JSON.stringify(d.feature_names) === JSON.stringify(c.feature_names));

  const testWin = champ.board?.find((r) => r.submission_id === champ.winner);
  const state = {
    testnet: { champ, model: champModel.model, calls: testWin?.calls ?? 0, earned: null, earnedText: $('[data-ask="earned"]').textContent, ready: false },
    mainnet: null,
  };
  let net = "testnet", order = [], at = 0, busy = false;
  const cur = () => state[net];
  const ds = () => dsOf(cur().champ);
  const speak = () => SPEAK[ds()?.key];
  const row = () => ds().rows[order[at % order.length]];
  const named = (r) => Object.fromEntries(ds().feature_names.map((k, i) => [k, r[i]]));
  const setLedger = () => {
    const c = cur();
    $('[data-ask="calls"]').textContent = c.calls;
    $('[data-ask="calls-label"]').textContent = `predictions served by #${c.champ.winner}${net === "mainnet" ? " on mainnet" : ""}`;
    $('[data-ask="earned"]').textContent = c.earned != null ? yoctoToNear(c.earned, 3) : (c.earnedText ?? "—");
  };
  const status = (n) => fetch(`/api/ask${n === "mainnet" ? "?network=mainnet" : ""}`).then((r) => r.json()).then((j) => { if (state[n]) state[n].ready = !!j.ready && BigInt(j.credit_yocto || "0") >= BigInt(state[n].champ.fee_per_call); }).catch(() => {});
  status("testnet");

  const idle = () => { out.innerHTML = `<p class="ask-wait">${speak().question}</p>`; };
  const show = () => {
    const r = row(), f = named(r), acc = ds().accounts?.[order[at % order.length]];
    box.innerHTML = `<h3>${speak().title(f, acc)}</h3><ul>${speak().facts(f, acc, ds().codes || {}).map((x) => `<li>${x}</li>`).join("")}</ul>${speak().link(f, acc)}`;
    idle();
    btn.disabled = false; next.disabled = false; label.textContent = "Ask the champion";
  };
  const select = (n) => {
    if (busy || !state[n]) return;
    net = n;
    const c = cur();
    order = ds().rows.map((_, i) => i).sort(() => Math.random() - 0.5); at = 0;
    tabs.querySelectorAll("button").forEach((b) => { const on = b.dataset.net === n; b.classList.toggle("on", on); b.setAttribute("aria-selected", on); });
    $("#ask-intro").innerHTML = `One press sends a real transaction on <b>${NETS[n].what}</b>. Model #${c.champ.winner} answers inside the contract <code>${esc(n === "mainnet" ? NETS.mainnet.contract : contractId())}</code> and its owner is paid ${yoctoToNear(c.champ.fee_per_call, 3)} NEAR. ${n === "mainnet" ? "Our guest account pays, so you need no wallet, or pay from your own wallet below." : "Our guest account pays, so you need no wallet."} ${speak().intro(pad2(c.champ.task_id))}`;
    next.textContent = speak().next;
    $("#ask-own").hidden = n !== "mainnet";
    setLedger();
    show();
  };

  const answer = (raw, how) => {
    const y = raw > 0 ? 1 : 0, truth = row()[ds().feature_names.length], right = y === truth;
    out.innerHTML = `<p class="ask-verdict">#${cur().champ.winner} says ${speak().verdict(y)}</p>
      <p class="ask-truth">What happened: ${speak().truth(truth)}. <b class="${right ? "ok" : "no"}">The champion was ${right ? "right" : "wrong"}.</b></p>
      <dl class="ask-bill">${how}<div><dt>Raw score</dt><dd>${n(raw)}, ${y ? "above" : "not above"} zero</dd></div></dl>`;
    dispatchEvent(new Event("resize"));
  };

  const paid = (j, here, features) => {
    const N = NETS[here];
    answer(Number(j.raw_score), `
      <div><dt>Network</dt><dd>${here === "mainnet" ? "NEAR mainnet, real NEAR" : "NEAR testnet"}</dd></div>
      <div><dt>Transaction</dt><dd><a href="${N.tx(esc(j.tx))}" target="_blank" rel="noreferrer">${esc(j.tx.slice(0, 8))}…${esc(j.tx.slice(-6))} ↗</a></dd></div>
      <div><dt>Computed</dt><dd>inside the contract, ${esc(j.gas_tgas)} Tgas</dd></div>
      <div><dt>Paid</dt><dd>${yoctoToNear(j.fee_yocto, 3)} NEAR ${j.own_wallet ? `by you (<a href="${N.account(esc(j.paid_by))}" target="_blank" rel="noreferrer">${esc(shortId(j.paid_by))}</a>) ` : ""}to ${j.owner ? `<a href="${N.account(esc(j.owner))}" target="_blank" rel="noreferrer">${esc(shortId(j.owner))}</a>` : "the model's owner"}</dd></div>`);
    verifyPanel(out, { ...j, features }, here === "mainnet" ? { contract: N.contract, rpcs: N.rpcs, attest: N.attest, register: N.register, network: "mainnet" } : { attest: N.attest, register: N.register, network: "testnet" });
  };

  // Pay with the visitor's own mainnet wallet: one approval, the fee comes from their account.
  const own = $("#ask-own-btn"), ownLabel = own.querySelector("span"), ownNote = $("#ask-own-note");
  onMainnetWallet((acc) => {
    ownLabel.textContent = acc ? `Pay 0.001 NEAR from ${shortId(acc)}` : "Pay with my own NEAR wallet";
    ownNote.innerHTML = acc
      ? `Your wallet asks you to approve one transaction on mainnet. The first one also puts ${TOP_UP} NEAR of prediction credit on the contract, enough for about nine more; you can take what is left back with <code>withdraw_credit</code>.`
      : `HOT, Meteor, Intear, NEAR Mobile or Nightly, on mainnet. You pay the fee yourself, so the champion's owner earns from your account, not ours.`;
  });
  own.addEventListener("click", async () => {
    if (busy || net !== "mainnet") return;
    if (!mainnetAccount()) { try { await signInMainnet(); } catch (e) { ownNote.textContent = `The wallet could not open: ${String(e.message || e).slice(0, 120)}`; } return; }
    busy = true; btn.disabled = true; next.disabled = true; own.disabled = true; tabs.classList.add("busy");
    const c = cur(), features = row().slice(0, ds().feature_names.length);
    ownLabel.textContent = "Approve it in your wallet…";
    out.innerHTML = `<p class="ask-wait">Waiting for your wallet, then for NEAR mainnet to run the model…</p>`;
    try {
      const j = await payOwnWallet(c.champ, features);
      if (j.calls != null) c.calls = j.calls;
      c.earned = j.earned_yocto;
      setLedger();
      paid(j, "mainnet", features);
      ownLabel.textContent = `Paid from ${shortId(j.paid_by)}`;
    } catch (e) {
      out.innerHTML = `<p class="ask-wait">No payment was made: ${esc(String(e.message || e).slice(0, 160))}</p>`;
      ownLabel.textContent = mainnetAccount() ? `Pay 0.001 NEAR from ${shortId(mainnetAccount())}` : "Pay with my own NEAR wallet";
    }
    busy = false; btn.disabled = false; next.disabled = false; own.disabled = false; tabs.classList.remove("busy");
  });

  async function ask() {
    if (busy) return;
    busy = true; btn.disabled = true; next.disabled = true; tabs.classList.add("busy");
    const c = cur(), N = NETS[net], here = net;
    const features = row().slice(0, ds().feature_names.length);
    let why = "the site's guest account could not pay just now";
    if (c.ready) {
      label.textContent = "Sending the transaction…";
      out.innerHTML = `<p class="ask-wait">Waiting for NEAR ${here === "mainnet" ? "mainnet " : ""}to run the model…</p>`;
      try {
        const r = await fetch("/api/ask", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ task_id: c.champ.task_id, features, network: here }) });
        const j = await r.json();
        if (r.ok && j.raw_score != null) {
          if (j.calls != null) c.calls = j.calls;
          if (j.earned_yocto) c.earned = j.earned_yocto;
          setLedger();
          if (here === "testnet") document.querySelectorAll('[data-live="calls"]').forEach((el) => { el.textContent = c.calls; }), j.earned_yocto && document.querySelectorAll('[data-live="earned"]').forEach((el) => { el.textContent = yoctoToNear(j.earned_yocto, 3); });
          paid(j, here, features);
          label.textContent = "Answered on-chain"; next.disabled = false; busy = false; tabs.classList.remove("busy");
          return;
        }
        if (j.error) why = j.error;
        if (r.status === 402) c.ready = false;
      } catch {}
    }
    // no payment possible: the same bytes the contract stores, run here
    try {
      answer(scoreLocal(c.model, features), `<div><dt>Computed</dt><dd>in your browser, from the model bytes the contract stores</dd></div><div><dt>Paid</dt><dd>nothing: no transaction was sent (${esc(why)})</dd></div>`);
      label.textContent = "Answered locally";
    } catch { out.innerHTML = `<p class="ask-wait">The model could not be run. Try another one.</p>`; label.textContent = "Ask the champion"; }
    next.disabled = false; busy = false; tabs.classList.remove("busy");
  }

  btn.addEventListener("click", ask);
  next.addEventListener("click", () => { if (busy) return; at += 1; show(); });
  tabs.addEventListener("click", (e) => { const b = e.target.closest("button[data-net]"); if (b) select(b.dataset.net); });
  select("testnet");

  // Mainnet joins when its champion exists, and becomes the first tab.
  try {
    const m = await loadMainnet();
    if (m && dsOf(m.champ)) {
      state.mainnet = { ...m, ready: false };
      tabs.innerHTML = ["mainnet", "testnet"].map((k) => `<button type="button" role="tab" data-net="${k}">${NETS[k].label}</button>`).join("");
      tabs.hidden = false;
      await status("mainnet");
      restoreMainnet();
      if (!busy && at === 0) select("mainnet"); else select(net);
    }
  } catch {}
}
