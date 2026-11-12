// "Ask the champion" for the landing page: one real predict_task on NEAR testnet per press, paid by the site's guest account.
//   GET  /api/ask                              -> { ready, paid_by, credit_yocto }
//   POST /api/ask { task_id, features: [...] } -> { raw_score, label, tx, explorer, gas_tgas, fee_yocto, calls, earned_yocto, ... }
// Signing, limits and the guest key's scope are in _lib/guest.mjs.
import { askChampion, guestStatus } from "./_lib/guest.mjs";

const send = (res, code, body) => { res.statusCode = code; res.setHeader("content-type", "application/json"); res.setHeader("cache-control", "no-store"); res.end(JSON.stringify(body)); };

export default async function handler(req, res) {
  if (req.method === "GET") return send(res, 200, await guestStatus());
  if (req.method !== "POST") return send(res, 405, { error: "POST { task_id, features }" });
  const body = typeof req.body === "string" ? (() => { try { return JSON.parse(req.body); } catch { return {}; } })() : req.body || {};
  const ip = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "?").split(",")[0].trim();
  const { code, body: out } = await askChampion(Number(body.task_id), body.features, ip);
  return send(res, code, out);
}
