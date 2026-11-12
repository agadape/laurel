// "Pay with your own wallet" on NEAR mainnet, for the landing page's Ask section. A second wallet-selector instance,
// separate from the testnet one in ../wallet.js: its session lives under its own localStorage prefix, so signing in
// here never looks like a testnet session there. One wallet approval sends one transaction to the mainnet contract:
// deposit_credit (only when the visitor has no credit yet) then predict_task, as two actions of the same receipt.
const CONTRACT = "laurel.ikantongkolmangut.near";
const RPCS = ["https://rpc.mainnet.fastnear.com", "https://free.rpc.fastnear.com"];
const PREFIX = "laurel-mainnet:";
const storage = {
  getItem: async (k) => { try { return localStorage.getItem(PREFIX + k); } catch { return null; } },
  setItem: async (k, v) => { try { localStorage.setItem(PREFIX + k, v); } catch {} },
  removeItem: async (k) => { try { localStorage.removeItem(PREFIX + k); } catch {} },
};

let selectorP = null, modal = null, accountId = null;
const listeners = new Set();
const emit = () => listeners.forEach((f) => f(accountId));
export const onMainnetWallet = (f) => { listeners.add(f); f(accountId); return () => listeners.delete(f); };
export const mainnetAccount = () => accountId;

async function load() {
  if (selectorP) return selectorP;
  selectorP = (async () => {
    const [{ setupWalletSelector }, { setupModal }, { setupHotWallet }, { setupMeteorWallet }, { setupIntearWallet }, { setupNearMobileWallet }, { setupNightly }] = await Promise.all([
      import("@near-wallet-selector/core"),
      import("@near-wallet-selector/modal-ui"),
      import("@near-wallet-selector/hot-wallet"),
      import("@near-wallet-selector/meteor-wallet"),
      import("@near-wallet-selector/intear-wallet"),
      import("@near-wallet-selector/near-mobile-wallet"),
      import("@near-wallet-selector/nightly"),
      import("@near-wallet-selector/modal-ui/styles.css"),
    ]);
    const selector = await setupWalletSelector({
      network: { networkId: "mainnet", nodeUrl: RPCS[0], helperUrl: "https://helper.mainnet.near.org", explorerUrl: "https://nearblocks.io", indexerUrl: "https://api.kitwallet.app" },
      fallbackRpcUrls: RPCS,
      storage,
      modules: [setupHotWallet(), setupMeteorWallet(), setupIntearWallet(), setupNearMobileWallet(), setupNightly()],
    });
    modal = setupModal(selector, { contractId: "" });
    const sync = () => { const s = selector.store.getState(); const a = s.accounts.find((x) => x.active) || s.accounts[0]; accountId = a?.accountId ?? null; emit(); };
    selector.store.observable.subscribe(sync); sync();
    return selector;
  })().catch((e) => { selectorP = null; throw e; });
  return selectorP;
}

/** Restore a saved mainnet session without opening the modal. */
export async function restoreMainnet() {
  try { if (Object.keys(localStorage).some((k) => k.startsWith(PREFIX))) await load(); } catch {}
}
export async function signInMainnet() { await load(); modal.show(); }
export async function signOutMainnet() { const s = await load(); await (await s.wallet()).signOut(); accountId = null; emit(); }

async function view(method, args = {}) {
  let last;
  for (const url of RPCS) {
    try {
      const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: "laurel", method: "query", params: { request_type: "call_function", finality: "optimistic", account_id: CONTRACT, method_name: method, args_base64: btoa(JSON.stringify(args)) } }) });
      const j = await r.json();
      if (j.error || j.result?.error) throw new Error(JSON.stringify(j.error || j.result.error));
      return JSON.parse(new TextDecoder().decode(new Uint8Array(j.result.result)));
    } catch (e) { last = e; }
  }
  throw last;
}
async function txStatus(hash, signer) {
  for (let i = 0; i < 12; i++) {
    for (const url of RPCS) {
      try {
        const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: "laurel", method: "EXPERIMENTAL_tx_status", params: { tx_hash: hash, sender_account_id: signer, wait_until: "EXECUTED_OPTIMISTIC" } }) });
        const j = await r.json();
        if (j.result) return j.result;
      } catch {}
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error("the transaction did not show up on mainnet in time");
}

export const TOP_UP = 0.01;   // NEAR the first payment attaches as credit: about 9 predictions after the credit record's storage

/** One paid prediction from the visitor's own mainnet account. Returns the same shape /api/ask returns. */
export async function payOwnWallet(task, features) {
  const s = await load();
  const w = await s.wallet();
  const me = accountId;
  if (!me) throw new Error("not signed in");
  const credit = BigInt(await view("get_credit", { account_id: me }).catch(() => "0"));
  const fee = BigInt(task.fee_per_call);
  const enc = (o) => new TextEncoder().encode(JSON.stringify(o));
  const actions = [];
  if (credit < fee) actions.push({ functionCall: { methodName: "deposit_credit", args: enc({}), gas: 30_000_000_000_000n, deposit: BigInt(Math.round(TOP_UP * 1e6)) * 10n ** 18n } });
  actions.push({ functionCall: { methodName: "predict_task", args: enc({ task_id: task.task_id, features }), gas: 50_000_000_000_000n, deposit: 0n } });
  const before = BigInt(await view("get_earnings", { submission_id: task.winner }).catch(() => "0"));
  const res = await w.signAndSendTransaction({ receiverId: CONTRACT, actions });
  const hash = res?.transaction?.hash || res?.transaction_outcome?.id;
  if (!hash) throw new Error("the wallet did not return a transaction (it may have redirected)");
  const out = res?.status ? res : await txStatus(hash, me);
  if (out.status?.Failure) throw new Error(JSON.stringify(out.status.Failure).slice(0, 200));
  const raw = out.status?.SuccessValue != null ? new TextDecoder().decode(Uint8Array.from(atob(out.status.SuccessValue), (c) => c.charCodeAt(0))) : null;
  let ev = null, gas = Number(out.transaction_outcome?.outcome?.gas_burnt || 0);
  for (const r of out.receipts_outcome || []) {
    gas += Number(r.outcome.gas_burnt);
    for (const l of r.outcome.logs || []) { if (l.startsWith("EVENT_JSON:")) { try { const j = JSON.parse(l.slice(11)); if (j.event === "prediction") ev = j.data?.[0]; } catch {} } }
  }
  return {
    network: "mainnet", contract: CONTRACT, task_id: task.task_id, submission_id: ev?.submission_id ?? task.winner,
    raw_score: raw, label: raw != null && BigInt(raw) > 0n ? 1 : 0, tx: hash, gas_tgas: Number((gas / 1e12).toFixed(2)),
    fee_yocto: String(task.fee_per_call), calls: ev?.calls ?? null, owner: ev?.owner ?? null,
    earned_yocto: String(before + fee), paid_by: me, own_wallet: true, topped_up: actions.length > 1,
  };
}
