// The site's guest accounts: one real predict_task per call, on NEAR testnet (default) or mainnet, used by /api/ask
// (the landing page's "Ask the champion") and, on testnet, by the remote MCP tool laurel_ask_champion.
// Mainnet uses LAUREL_MAINNET_GUEST_ID / LAUREL_MAINNET_GUEST_KEY: the same kind of key, limited to
// predict_task/predict on laurel.ikantongkolmangut.near, with a small prepaid credit (real NEAR, a demo).
// The only secret here is LAUREL_GUEST_KEY: a FUNCTION-CALL key of LAUREL_GUEST_ID that the protocol limits to
// predict_task/predict on the Laurel contract (made by tools/site_demo.mjs). It can spend the guest's prepaid credit
// on predictions and nothing else, so the worst a leak or a flood can do is use that credit up; the page then
// falls back to running the same on-chain bytes locally and says so.
// No dependency: the transaction is borsh-encoded and signed here with node:crypto.
import crypto from "node:crypto";

const NETS = {
  testnet: { contract: process.env.LAUREL_CONTRACT || "laurel.laurel-team-mw0x0c8g.testnet", rpcs: ["https://rpc.testnet.fastnear.com", "https://test.rpc.fastnear.com", "https://near-testnet.drpc.org"], explorer: "https://testnet.nearblocks.io/txns/", idVar: "LAUREL_GUEST_ID", keyVar: "LAUREL_GUEST_KEY", perIp: 8, total: 40 },
  mainnet: { contract: process.env.LAUREL_MAINNET_CONTRACT || "laurel.ikantongkolmangut.near", rpcs: ["https://rpc.mainnet.fastnear.com", "https://free.rpc.fastnear.com", "https://rpc.mainnet.near.org"], explorer: "https://nearblocks.io/txns/", idVar: "LAUREL_MAINNET_GUEST_ID", keyVar: "LAUREL_MAINNET_GUEST_KEY", perIp: 4, total: 20 },
};
const netName = (n) => (n === "mainnet" ? "mainnet" : "testnet");
const netOf = (n) => NETS[netName(n)];
const GAS = 30_000_000_000_000n;

// ---------- base58, borsh, ed25519 ----------
const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function b58decode(s) {
  let n = 0n;
  for (const c of s) { const i = B58.indexOf(c); if (i < 0) throw new Error("bad base58"); n = n * 58n + BigInt(i); }
  const hex = n.toString(16);
  const body = Buffer.from(hex.length % 2 ? "0" + hex : hex, "hex");
  let zeros = 0;
  while (zeros < s.length && s[zeros] === "1") zeros++;
  return Buffer.concat([Buffer.alloc(zeros), n === 0n ? Buffer.alloc(0) : body]);
}
function b58encode(buf) {
  let n = BigInt("0x" + (buf.toString("hex") || "0")), out = "";
  while (n > 0n) { out = B58[Number(n % 58n)] + out; n /= 58n; }
  for (const b of buf) { if (b === 0) out = "1" + out; else break; }
  return out;
}
const u32 = (v) => { const b = Buffer.alloc(4); b.writeUInt32LE(v); return b; };
const u64 = (v) => { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(v)); return b; };
const u128 = (v) => { const b = Buffer.alloc(16); b.writeBigUInt64LE(BigInt(v) & 0xffffffffffffffffn, 0); b.writeBigUInt64LE(BigInt(v) >> 64n, 8); return b; };
const str = (s) => { const b = Buffer.from(s, "utf8"); return Buffer.concat([u32(b.length), b]); };

export function signer(net = "testnet") {
  const N = netOf(net);
  const id = process.env[N.idVar], key = process.env[N.keyVar];
  if (!id || !key) return null;
  const raw = b58decode(key.replace(/^ed25519:/, ""));
  const seed = raw.subarray(0, 32);
  const priv = crypto.createPrivateKey({ key: Buffer.concat([Buffer.from("302e020100300506032b657004220420", "hex"), seed]), format: "der", type: "pkcs8" });
  const pub = crypto.createPublicKey(priv).export({ format: "der", type: "spki" }).subarray(-32);
  return { id, pub, pubStr: "ed25519:" + b58encode(pub), sign: (msg) => crypto.sign(null, msg, priv) };
}

/** One FunctionCall action, signed: the SignedTransaction as base64 and the transaction hash. */
function signedCall(s, nonce, blockHash, method, args, contract) {
  const action = Buffer.concat([Buffer.from([2]), str(method), (() => { const a = Buffer.from(JSON.stringify(args)); return Buffer.concat([u32(a.length), a]); })(), u64(GAS), u128(0n)]);
  const tx = Buffer.concat([str(s.id), Buffer.from([0]), s.pub, u64(nonce), str(contract), blockHash, u32(1), action]);
  const hash = crypto.createHash("sha256").update(tx).digest();
  return { base64: Buffer.concat([tx, Buffer.from([0]), s.sign(hash)]).toString("base64"), hash: b58encode(hash) };
}

// ---------- RPC ----------
async function rpc(method, params, timeoutMs = 20000, net = "testnet") {
  let last;
  for (const url of netOf(net).rpcs) {
    try {
      const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: "laurel-ask", method, params }), signal: AbortSignal.timeout(timeoutMs) });
      const j = await r.json();
      if (j.error) { const e = new Error(JSON.stringify(j.error.data ?? j.error.message ?? j.error).slice(0, 600)); e.rpc = j.error; throw e; }
      return j.result;
    } catch (e) { last = e; if (e.rpc) throw e; }   // an answer from the node is final; only a dead endpoint moves on
  }
  throw last;
}
export async function view(method, args = {}, net = "testnet") {
  const r = await rpc("query", { request_type: "call_function", finality: "optimistic", account_id: netOf(net).contract, method_name: method, args_base64: Buffer.from(JSON.stringify(args)).toString("base64") }, 20000, net);
  if (r.error) throw new Error(r.error);
  return JSON.parse(Buffer.from(r.result).toString());
}

// ---------- a little restraint: per address and per server instance ----------
const seen = new Map();
const recent = { testnet: [], mainnet: [] };
export function allow(ip, net = "testnet") {
  const now = Date.now(), k = netName(net), N = NETS[k];
  recent[k] = recent[k].filter((t) => now - t < 60000);
  const mine = (seen.get(k + ip) || []).filter((t) => now - t < 60000);
  if (mine.length >= N.perIp || recent[k].length >= N.total) return false;
  mine.push(now); seen.set(k + ip, mine); recent[k].push(now);
  if (seen.size > 2000) seen.clear();
  return true;
}
const queue = { testnet: Promise.resolve(), mainnet: Promise.resolve() };   // one transaction at a time per network and instance, so nonces never race here

async function predictOnChain(s, task_id, features, net) {
  for (let attempt = 0; ; attempt++) {
    const key = await rpc("query", { request_type: "view_access_key", finality: "optimistic", account_id: s.id, public_key: s.pubStr }, 20000, net);
    const { base64, hash } = signedCall(s, BigInt(key.nonce) + 1n + BigInt(attempt), b58decode(key.block_hash), "predict_task", { task_id, features }, netOf(net).contract);
    try {
      const res = await rpc("send_tx", { signed_tx_base64: base64, wait_until: "EXECUTED_OPTIMISTIC" }, 25000, net);
      return { res, hash };
    } catch (e) {
      if (attempt < 2 && /InvalidNonce|nonce/i.test(e.message)) continue;
      throw e;
    }
  }
}


/** One paid prediction from the champion of a closed task. Returns { code, body } (HTTP-style status and JSON body). */
export async function askChampion(task_id, features, ip, net = "testnet") {
  net = netName(net);
  const EXPLORER = NETS[net].explorer, v = (m, a) => view(m, a, net);
  const s = (() => { try { return signer(net); } catch { return null; } })();
  if (!s) return { code: 503, body: { error: "the site's guest key is not configured", fallback: "local" } };
  if (!Number.isInteger(task_id) || task_id < 1 || !Array.isArray(features) || features.length > 256 || !features.every((v) => Number.isInteger(v) && Math.abs(v) <= 2_000_000_000))
    return { code: 400, body: { error: "task_id must be a positive integer and features an array of integers" } };
  if (!allow(ip, net)) return { code: 429, body: { error: "too many questions in a minute; try again shortly", fallback: "local" } };
  try {
    const task = await v("get_task", { task_id });
    if (!task) return { code: 404, body: { error: `no task ${task_id}` } };
    if (!task.closed || task.winner == null) return { code: 409, body: { error: `task ${task_id} is still open: it has no champion to ask yet` } };
    if (features.length !== task.n_features) return { code: 400, body: { error: `task ${task_id} takes ${task.n_features} features, got ${features.length}` } };
    const credit = BigInt(await v("get_credit", { account_id: s.id }));
    if (credit < BigInt(task.fee_per_call)) return { code: 402, body: { error: "the guest account's prepaid credit is used up", fallback: "local", paid_by: s.id } };

    // earnings are read BEFORE the call: a view right after send can still lag one block behind
    const earnedBefore = await v("get_earnings", { submission_id: task.winner }).catch(() => null);
    const run = queue[net].then(() => predictOnChain(s, task_id, features, net));
    queue[net] = run.catch(() => {});
    const { res: out, hash } = await run;
    const failure = out.status?.Failure;
    if (failure) return { code: 502, body: { error: JSON.stringify(failure).slice(0, 400), tx: hash, explorer: EXPLORER + hash } };
    const raw = out.status?.SuccessValue != null ? Buffer.from(out.status.SuccessValue, "base64").toString() : null;
    if (raw == null || !/^-?\d+$/.test(raw)) return { code: 502, body: { error: "the transaction was sent but its result is not in yet", tx: hash, explorer: EXPLORER + hash } };
    const gas = (out.receipts_outcome || []).reduce((a, r) => a + Number(r.outcome.gas_burnt), Number(out.transaction_outcome?.outcome?.gas_burnt || 0)) / 1e12;
    let ev = null;
    for (const r of out.receipts_outcome || []) for (const l of r.outcome.logs || []) {
      if (!l.startsWith("EVENT_JSON:")) continue;
      try { const j = JSON.parse(l.slice(11)); if (j.event === "prediction") ev = j.data?.[0] ?? j.data; } catch {}
    }
    const submission_id = ev?.submission_id ?? task.winner;
    const earned = earnedBefore != null && submission_id === task.winner ? BigInt(earnedBefore) + BigInt(task.fee_per_call) : await v("get_earnings", { submission_id }).catch(() => null);
    return { code: 200, body: {
      network: net, contract: NETS[net].contract, task_id, submission_id, raw_score: raw, label: BigInt(raw) > 0n ? 1 : 0,
      tx: hash, explorer: EXPLORER + hash, gas_tgas: Number(gas.toFixed(2)),
      fee_yocto: String(task.fee_per_call), calls: ev?.calls ?? null, owner: ev?.owner ?? null,
      earned_yocto: earned != null ? String(earned) : null, paid_by: s.id, credit_left_yocto: String(credit - BigInt(task.fee_per_call)),
    } };
  } catch (e) {
    return { code: 502, body: { error: String(e.message || e).slice(0, 400), fallback: "local" } };
  }
}

/** Guest status for GET /api/ask. */
export async function guestStatus(net = "testnet") {
  net = netName(net);
  const s = (() => { try { return signer(net); } catch { return null; } })();
  if (!s) return { ready: false, network: net };
  try { return { ready: true, network: net, contract: NETS[net].contract, paid_by: s.id, credit_yocto: String(await view("get_credit", { account_id: s.id }, net)) }; }
  catch { return { ready: false, paid_by: s.id }; }
}
