import React, { useEffect, useState } from "react";
import { view, yoctoToNear, EXPLORER_ACCOUNT, EXPLORER_TX } from "./rpc.js";
import { onWallet, restore, signIn, signOut, buyCredit, withdrawCredit, withdrawEarnings, network } from "./wallet.js";
import { Err } from "./components.jsx";

export function useWallet() {
  const [w, setW] = useState({ accountId: null, ready: false, loading: false, error: null });
  useEffect(() => { restore(); return onWallet(setW); }, []);
  return w;
}

/** Header control: "Connect wallet" or the account id with sign-out. */
export function WalletButton() {
  const w = useWallet();
  if (w.accountId) return <span className="wallet"><a href="#/connect" className="mono">{w.accountId}</a><button className="retry" onClick={signOut}>sign out</button></span>;
  return <button className="wallet-btn" onClick={signIn} disabled={w.loading}>{w.loading ? "loading wallet…" : "Connect wallet"}</button>;
}

/** Credit balance, buy credit, withdraw credit, and earnings of the models this account owns. */
export function AccountPanel({ compact = false }) {
  const w = useWallet();
  const [credit, setCredit] = useState(null);
  const [owned, setOwned] = useState([]);
  const [amount, setAmount] = useState("0.05");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [n, setN] = useState(0);
  useEffect(() => {
    let alive = true;
    if (!w.accountId) { setCredit(null); setOwned([]); return; }
    (async () => {
      try {
        const c = await view("get_credit", { account_id: w.accountId });
        const tasks = await view("list_tasks", { from: 0, limit: 50 });
        const subs = (await Promise.all(tasks.map((t) => view("list_submissions", { task_id: t.task_id })))).flat().filter((s) => s.owner === w.accountId);
        const withEarn = await Promise.all(subs.map(async (s) => ({ ...s, earnings: await view("get_earnings", { submission_id: s.submission_id }).catch(() => "0") })));
        if (alive) { setCredit(c); setOwned(withEarn); }
      } catch (e) { if (alive) setMsg({ err: String(e.message || e) }); }
    })();
    return () => { alive = false; };
  }, [w.accountId, n]);
  const run = async (label, fn) => {
    setBusy(true); setMsg(null);
    try { const tx = await fn(); setMsg({ ok: `${label} sent${tx ? "" : " (confirm in the wallet tab)"}`, tx }); setTimeout(() => setN((x) => x + 1), 2500); }
    catch (e) { const m = String(e.message || e); setMsg({ err: (/near_rpc_error|rpc/i.test(m) ? "The wallet's RPC node refused the request (usually rate-limiting on testnet). Wait a minute and retry, or use the CLI path below. " : "") + m.slice(0, 300) }); }
    finally { setBusy(false); }
  };
  const feeHint = "0.001 NEAR per prediction on the demo task · 0.05 NEAR ≈ 50 predictions";
  if (!w.accountId) {
    return (
      <div className="panel stack">
        <b style={{ fontFamily: "var(--display)", fontSize: 17 }}>Buy credit with your NEAR wallet</b>
        <p className="ink2">{feeHint}. Each call pays the model's owner.</p>
        <div><button className="wallet-btn" onClick={signIn} disabled={w.loading}>{w.loading ? "loading wallet…" : "Connect wallet"}</button>{w.error && <span className="err mono" style={{ marginLeft: 10 }}>{w.error}</span>}</div>
        <details><summary>Wallet tips</summary><p className="mist" style={{ marginTop: 8 }}>Meteor, Intear or Nightly on {network}. Meteor opens a popup: allow popups for this site, or use its extension. Signing in creates no transaction; each purchase is approved in the wallet. Nothing on this site needs a wallet to read.</p></details>
      </div>
    );
  }
  return (
    <div className="panel stack">
      <div className="between"><b style={{ fontFamily: "var(--display)", fontSize: 17 }}>Your account</b><span className="mono"><a href={EXPLORER_ACCOUNT(w.accountId)} target="_blank" rel="noreferrer">{w.accountId}</a> · {network}</span></div>
      <p className="x-sum" style={{ fontSize: "clamp(22px, 2vw, 30px)" }}>You have <b>{credit == null ? "…" : yoctoToNear(credit, 3)}</b> NEAR of prediction credit on the contract. You own <b>{owned.length}</b> {owned.length === 1 ? "model" : "models"}, with <b>{owned.length ? yoctoToNear(owned.reduce((a, s) => a + BigInt(s.earnings), 0n).toString(), 3) : "0.000"}</b> NEAR waiting to be withdrawn.</p>
      <div className="buy">
        <label className="label" htmlFor="buy-amt">buy credit (NEAR)</label>
        <input id="buy-amt" type="number" min="0.001" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="mono" />
        <button className="wallet-btn" disabled={busy || !(Number(amount) > 0)} onClick={() => run(`deposit_credit ${amount} NEAR`, () => buyCredit(amount))}>Buy credit</button>
        {credit != null && BigInt(credit) > 0n && <button className="retry" disabled={busy} onClick={() => run("withdraw_credit", () => withdrawCredit(yoctoToNear(credit, 6)))}>withdraw all credit</button>}
      </div>
      <p className="mist">{feeHint}. The wallet shows the exact deposit before you sign.</p>
      {owned.length > 0 && !compact && (
        <div className="stack" style={{ gap: 6 }}>
          <span className="label">your models</span>
          {owned.map((s) => (
            <div key={s.submission_id} className="between mono">
              <span><a href={`#/model/${s.submission_id}`}>#{s.submission_id}</a> · task {s.task_id} · {s.calls} calls · earned {yoctoToNear(s.earnings, 4)} NEAR</span>
              {BigInt(s.earnings) > 0n && <button className="retry" disabled={busy} onClick={() => run(`withdraw_earnings #${s.submission_id}`, () => withdrawEarnings(s.submission_id))}>withdraw</button>}
            </div>
          ))}
        </div>
      )}
      {msg?.ok && <p className="tee mono">{msg.ok}{msg.tx && <> · <a href={EXPLORER_TX(msg.tx)} target="_blank" rel="noreferrer">tx</a></>}</p>}
      {msg?.err && <Err error={msg.err} plain />}
    </div>
  );
}
