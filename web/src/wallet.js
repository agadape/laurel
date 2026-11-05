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
    // MyNearWallet retired new app connections in Nov 2026, so it is not offered.
    const [{ setupWalletSelector }, { setupModal }, { setupMeteorWallet }, { setupIntearWallet }, { setupNightly }] = await Promise.all([
      import("@near-wallet-selector/core"),
      import("@near-wallet-selector/modal-ui"),
      import("@near-wallet-selector/meteor-wallet"),
      import("@near-wallet-selector/intear-wallet"),
      import("@near-wallet-selector/nightly"),
      import("@near-wallet-selector/modal-ui/styles.css"),
    ]);
    // explicit nodeUrl: the wallet SDKs otherwise default to test.rpc.fastnear.com, which rate-limits (429) and surfaces as near_rpc_error
    const network = NETWORK === "mainnet"
      ? { networkId: "mainnet", nodeUrl: "https://near.drpc.org", helperUrl: "https://helper.mainnet.near.org", explorerUrl: "https://nearblocks.io", indexerUrl: "https://api.kitwallet.app" }
      : { networkId: "testnet", nodeUrl: "https://near-testnet.drpc.org", helperUrl: "https://helper.testnet.near.org", explorerUrl: "https://testnet.nearblocks.io", indexerUrl: "https://test.api.fastnear.com/v0" };
    const fallbackRpcUrls = NETWORK === "mainnet" ? ["https://near.drpc.org", "https://rpc.mainnet.fastnear.com"] : ["https://near-testnet.drpc.org", "https://rpc.testnet.fastnear.com", "https://archival-rpc.testnet.fastnear.com"];
    const selector = await setupWalletSelector({ network, fallbackRpcUrls, modules: [setupMeteorWallet(), setupIntearWallet(), setupNightly()] });
    // "connect only": no access key is created at sign-in (deposits need a full signature anyway), so signing in is one
    // wallet approval with no transaction; each purchase/withdrawal is then approved in the wallet.
    modal = setupModal(selector, { contractId: "" });
    const sync = () => { const a = selector.store.getState().accounts.find((x) => x.active) || selector.store.getState().accounts[0]; set({ accountId: a?.accountId ?? null, ready: true, loading: false }); };
    selector.store.observable.subscribe(sync); sync();
    return selector;
  })().catch((e) => { set({ loading: false, error: String(e.message || e) }); selectorP = null; throw e; });
  return selectorP;
}

/** true when wallet-selector left a session in localStorage (a returning visitor). */
export function hasSavedSession() {
  try { return Object.keys(localStorage).some((k) => k.startsWith("near-wallet-selector")); } catch { return false; }
}
/** Restore a previous session silently (no modal). Loads the wallet code only if a session was saved before. */
export async function restore() {
  if (!hasSavedSession()) return;
  try { await load(); } catch {}
}
export async function signIn() { await load(); modal.show(); }
export async function signOut() { const s = await load(); const w = await s.wallet(); await w.signOut(); set({ accountId: null }); }

const yocto = (near) => (BigInt(Math.round(Number(near) * 1e6)) * 10n ** 18n).toString();
async function call(methodName, args = {}, { deposit = "0", gas = "30000000000000" } = {}) {
  const s = await load();
  const w = await s.wallet();
  // wallet-selector v10 takes near-api-js-shaped actions: { functionCall: { methodName, args: bytes, gas, deposit } }
  const action = { functionCall: { methodName, args: new TextEncoder().encode(JSON.stringify(args)), gas: BigInt(gas), deposit: BigInt(deposit) } };
  const res = await w.signAndSendTransaction({ receiverId: contractId(), actions: [action] });
  return res?.transaction?.hash || res?.transaction_outcome?.id || null;
}
/** Buy prediction credit: attaches `near` NEAR to deposit_credit. Returns the tx hash (or null when the wallet redirected). */
export const buyCredit = (near) => call("deposit_credit", {}, { deposit: yocto(near) });
export const withdrawCredit = (near) => call("withdraw_credit", { amount: yocto(near) });
export const withdrawEarnings = (submission_id) => call("withdraw_earnings", { submission_id });
export const network = NETWORK;
