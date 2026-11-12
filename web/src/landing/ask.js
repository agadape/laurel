// "Ask the champion": one public holdout row, one real predict_task on NEAR testnet (paid by the site's guest account
// through /api/ask), then the row's true label. If the server cannot pay, the same on-chain bytes run here and the
// page says no transaction was sent. Rows come from aset/holdout.json: every public holdout row, none picked by hand.
import { LEAF } from "../model.js";
import { EXPLORER_TX, EXPLORER_ACCOUNT } from "../rpc.js";
import { yoctoToNear, pad2 } from "./data.js";
import { verifyPanel } from "./verify.js";

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
    intro: (id) => `A loan application from a 1994 textbook dataset, used here as a simulation. The champion of exhibit ${id} has never seen it.`,
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

export function askSection(champ, winRow, earned) {
  if (!champ || !winRow) return "";
  return `<section class="l-sec ask-sec" id="ask"><i class="aura a1"></i><div class="l-wrap ask">
    <div class="ask-left">
      <h2 class="rise">Ask the champion.</h2>
      <p class="body rise" id="ask-intro" style="--d:80ms">One press sends a real transaction on NEAR testnet. Model #${champ.winner} answers inside the contract and its owner is paid ${yoctoToNear(champ.fee_per_call, 3)} NEAR. Our guest account pays, so you need no wallet.</p>
      <div class="ask-case rise" id="ask-case" style="--d:140ms" aria-live="polite"></div>
      <div class="ask-go rise" style="--d:200ms">
        <button class="btn solid" id="ask-btn" type="button" disabled><span>Ask the champion</span><i aria-hidden="true">↗</i></button>
        <button class="ask-next" id="ask-next" type="button" disabled>Another one</button>
      </div>
    </div>
    <div class="ask-right rise" style="--d:160ms">
      <div class="ask-out" id="ask-out" aria-live="polite"></div>
      <div class="ask-ledger"><div><b data-live="calls">${winRow.calls}</b><span>predictions served by #${champ.winner}</span></div><div><b data-live="earned">${earned}</b><span>NEAR earned by its owner</span></div></div>
    </div>
  </div></section>`;
}

export async function wireAsk(root, champ, champModel) {
  const $ = (s) => root.querySelector(s);
  const btn = $("#ask-btn"), next = $("#ask-next"), box = $("#ask-case"), out = $("#ask-out");
  if (!btn || !champ || !champModel) return;
  const label = btn.querySelector("span");
  let ds, order = [], at = 0, busy = false, ready = false;
  try {
    const all = await fetch(`${import.meta.env.BASE_URL}aset/holdout.json`).then((r) => r.json());
    ds = all.datasets.find((d) => JSON.stringify(d.feature_names) === JSON.stringify(champ.feature_names));
  } catch {}
  const speak = ds && SPEAK[ds.key];
  if (!speak) { $("#ask")?.remove(); return; }
  fetch("/api/ask").then((r) => r.json()).then((j) => { ready = !!j.ready && BigInt(j.credit_yocto || "0") >= BigInt(champ.fee_per_call); }).catch(() => {});

  order = ds.rows.map((_, i) => i).sort(() => Math.random() - 0.5);
  $("#ask-intro").insertAdjacentHTML("beforeend", ` ${speak.intro(pad2(champ.task_id))}`);
  next.textContent = speak.next;
  const row = () => ds.rows[order[at % order.length]];
  const named = (r) => Object.fromEntries(ds.feature_names.map((k, i) => [k, r[i]]));

  const idle = () => { out.innerHTML = `<p class="ask-wait">${speak.question}</p>`; };
  const show = () => {
    const r = row(), f = named(r), acc = ds.accounts?.[order[at % order.length]];
    box.innerHTML = `<h3>${speak.title(f, acc)}</h3><ul>${speak.facts(f, acc, ds.codes || {}).map((x) => `<li>${x}</li>`).join("")}</ul>${speak.link(f, acc)}`;
    idle();
    btn.disabled = false; next.disabled = false; label.textContent = "Ask the champion";
  };
  const live = (key, value) => document.querySelectorAll(`[data-live="${key}"]`).forEach((el) => { el.textContent = value; });

  const answer = (raw, how) => {
    const y = raw > 0 ? 1 : 0, truth = row()[ds.feature_names.length], right = y === truth;
    out.innerHTML = `<p class="ask-verdict">#${champ.winner} says ${speak.verdict(y)}</p>
      <p class="ask-truth">What happened: ${speak.truth(truth)}. <b class="${right ? "ok" : "no"}">The champion was ${right ? "right" : "wrong"}.</b></p>
      <dl class="ask-bill">${how}<div><dt>Raw score</dt><dd>${n(raw)}, ${y ? "above" : "not above"} zero</dd></div></dl>`;
    dispatchEvent(new Event("resize"));
  };

  async function ask() {
    if (busy) return;
    busy = true; btn.disabled = true; next.disabled = true;
    const features = row().slice(0, ds.feature_names.length);
    let why = "the site's guest account could not pay just now";
    if (ready) {
      label.textContent = "Sending the transaction…";
      out.innerHTML = `<p class="ask-wait">Waiting for NEAR to run the model…</p>`;
      try {
        const r = await fetch("/api/ask", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ task_id: champ.task_id, features }) });
        const j = await r.json();
        if (r.ok && j.raw_score != null) {
          if (j.calls != null) live("calls", j.calls);
          if (j.earned_yocto) live("earned", yoctoToNear(j.earned_yocto, 3));
          answer(Number(j.raw_score), `
            <div><dt>Transaction</dt><dd><a href="${EXPLORER_TX(esc(j.tx))}" target="_blank" rel="noreferrer">${esc(j.tx.slice(0, 8))}…${esc(j.tx.slice(-6))} ↗</a></dd></div>
            <div><dt>Computed</dt><dd>inside the contract, ${esc(j.gas_tgas)} Tgas</dd></div>
            <div><dt>Paid</dt><dd>${yoctoToNear(j.fee_yocto, 3)} NEAR to ${j.owner ? `<a href="${EXPLORER_ACCOUNT(esc(j.owner))}" target="_blank" rel="noreferrer">${esc(shortId(j.owner))}</a>` : "the model's owner"}</dd></div>`);
          verifyPanel(out, { ...j, features });
          label.textContent = "Answered on-chain"; next.disabled = false; busy = false;
          return;
        }
        if (j.error) why = j.error;
        if (r.status === 402) ready = false;
      } catch {}
    }
    // no payment possible: the same bytes the contract stores, run here
    try {
      answer(scoreLocal(champModel.model, features), `<div><dt>Computed</dt><dd>in your browser, from the model bytes the contract stores</dd></div><div><dt>Paid</dt><dd>nothing: no transaction was sent (${esc(why)})</dd></div>`);
      label.textContent = "Answered locally";
    } catch { out.innerHTML = `<p class="ask-wait">The model could not be run. Try another one.</p>`; label.textContent = "Ask the champion"; }
    next.disabled = false; busy = false;
  }

  btn.addEventListener("click", ask);
  next.addEventListener("click", () => { if (busy) return; at += 1; show(); });
  show();
}
