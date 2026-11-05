// NEAR wallet login (wallet-selector), loaded lazily so visitors who only read pay nothing in bundle size.
// Used for exactly three contract calls: deposit_credit (buy prediction credit), withdraw_credit, withdraw_earnings.
import { contractId, DEFAULT_CONTRACT } from "./rpc.js";

const NETWORK = (contractId() || DEFAULT_CONTRACT).endsWith(".near") ? "mainnet" : "testnet";
let selectorP = null, modal = null;
const listeners = new Set();
let state = { accountId: null, ready: false, loading: false, error: null };
const emit = () => listeners.forEach((f) => f(state));
const set = (patch) => { state = { ...state, ...patch }; emit(); };
export const walletState = () => state;
export const onWallet = (f) => { listeners.add(f); f(state); return () => listeners.delete(f); };

async function load() {
  if (selectorP) return selectorP;
  set({ loading: true });
  selectorP = (async () => {
    const [{ setupWalletSelector }, { setupModal }, { setupMyNearWallet }, { setupMeteorWallet }] = await Promise.all([
      import("@near-wallet-selector/core"),
      import("@near-wallet-selector/modal-ui"),
      import("@near-wallet-selector/my-near-wallet"),
      import("@near-wallet-selector/meteor-wallet"),
      import("@near-wallet-selector/modal-ui/styles.css"),
    ]);
    const selector = await setupWalletSelector({ network: NETWORK, modules: [setupMyNearWallet(), setupMeteorWallet()] });
    modal = setupModal(selector, { contractId: contractId() }); // deposits need a full-access signature anyway, so no method-restricted key is requested at sign-in
    const sync = () => { const a = selector.store.getState().accounts.find((x) => x.active) || selector.store.getState().accounts[0]; set({ accountId: a?.accountId ?? null, ready: true, loading: false }); };
    selector.store.observable.subscribe(sync); sync();
    return selector;
  })().catch((e) => { set({ loading: false, error: String(e.message || e) }); selectorP = null; throw e; });
  return selectorP;
}

/** Restore a previous session silently (no modal). */
/** Restore a previous session silently (no modal). Loads the wallet code only if a session was saved before. */
export async function restore() {
  let saved = false;
  try { saved = Object.keys(localStorage).some((k) => k.startsWith("near-wallet-selector")); } catch {}
  if (!saved) return;
  try { await load(); } catch {}
}
export async function signIn() { await load(); modal.show(); }
export async function signOut() { const s = await load(); const w = await s.wallet(); await w.signOut(); set({ accountId: null }); }

const yocto = (near) => (BigInt(Math.round(Number(near) * 1e6)) * 10n ** 18n).toString();
async function call(methodName, args = {}, { deposit = "0", gas = "30000000000000" } = {}) {
  const s = await load();
  const w = await s.wallet();
  const res = await w.signAndSendTransaction({ receiverId: contractId(), actions: [{ type: "FunctionCall", params: { methodName, args, gas, deposit } }] });
  return res?.transaction?.hash || res?.transaction_outcome?.id || null;
}
/** Buy prediction credit: attaches `near` NEAR to deposit_credit. Returns the tx hash (or null when the wallet redirected). */
export const buyCredit = (near) => call("deposit_credit", {}, { deposit: yocto(near) });
export const withdrawCredit = (near) => call("withdraw_credit", { amount: yocto(near) });
export const withdrawEarnings = (submission_id) => call("withdraw_earnings", { submission_id });
export const network = NETWORK;
