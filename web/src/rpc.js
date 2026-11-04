// Read-only access to the Bursa contract through NEAR JSON-RPC view calls. No wallet, no writes.
const RPCS = ["https://rpc.testnet.fastnear.com", "https://archival-rpc.testnet.fastnear.com", "https://near-testnet.drpc.org", "https://test.rpc.fastnear.com", "https://rpc.testnet.near.org"];

export const DEFAULT_CONTRACT = import.meta.env.VITE_BURSA_CONTRACT || "laurel.laurel-team-mw0x0c8g.testnet";
export const EXPLORER_ACCOUNT = (id) => `https://testnet.nearblocks.io/address/${id}`;
export const EXPLORER_TX = (h) => `https://testnet.nearblocks.io/txns/${h}`;

export function contractId() {
  const p = new URLSearchParams(window.location.search).get("contract");
  return p && /^[a-z0-9._-]+$/.test(p) ? p : DEFAULT_CONTRACT;
}

export async function view(method, args = {}) {
  const body = {
    jsonrpc: "2.0",
    id: "bursa-web",
    method: "query",
    params: { request_type: "call_function", finality: "optimistic", account_id: contractId(), method_name: method, args_base64: btoa(JSON.stringify(args)) },
  };
  let lastErr;
  for (const url of RPCS) {
    try {
      const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const j = await res.json();
      if (j.error) throw new Error(j.error.data?.toString?.() || j.error.message || JSON.stringify(j.error));
      if (j.result?.error) throw new Error(j.result.error);
      const text = new TextDecoder().decode(new Uint8Array(j.result.result));
      return JSON.parse(text);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

export const yoctoToNear = (y, d = 4) => (Number(BigInt(y) / 10n ** 18n) / 1e6).toFixed(d);
export const bps = (x) => (x == null ? "—" : (x / 100).toFixed(2) + " %");
export const nsToDate = (ns) => new Date(Number(BigInt(ns) / 1_000_000n));
export const short = (s, n = 10) => (s && s.length > 2 * n ? `${s.slice(0, n)}…${s.slice(-6)}` : s);
export const statusText = (st) => (typeof st === "string" ? st : Object.keys(st)[0]);
export const statusDetail = (st) => (typeof st === "string" ? "" : JSON.stringify(Object.values(st)[0]));

/** Raw model bytes of a submission (borsh, see src/model.js), fetched through the same view call the evaluator uses. */
export async function modelBytes(submission_id) {
  const b64 = await view("get_model_bytes", { submission_id });
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}
/** Parse the evaluator JSON stored on-chain (≤ 900 B) or return null. */
export function parseRaw(s) { try { return s ? JSON.parse(s) : null; } catch { return null; } }
