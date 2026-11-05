// Shared helpers for tools/*.mjs. Credentials come from ../.env (never printed).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { Account, JsonRpcProvider, FailoverRpcProvider, KeyPair, actions, teraToGas } from "near-api-js";

export const here = path.dirname(fileURLToPath(import.meta.url));
export const root = path.resolve(here, "..");
export const envPath = path.join(root, ".env");
dotenv.config({ path: envPath, quiet: true });

export const EXPLORER = "https://testnet.nearblocks.io/txns/";
export const OUTLAYER = "outlayer.testnet";

// 4 Nov: fastnear rate-limited this IP (429) mid-deploy, rpc.testnet.near.org is deprecated → more fallbacks for views.
export const provider = new FailoverRpcProvider([
  new JsonRpcProvider({ url: "https://rpc.testnet.fastnear.com" }),
  new JsonRpcProvider({ url: "https://archival-rpc.testnet.fastnear.com" }),
  new JsonRpcProvider({ url: "https://near-testnet.drpc.org" }),
  new JsonRpcProvider({ url: "https://test.rpc.fastnear.com" }),
  new JsonRpcProvider({ url: "https://rpc.testnet.near.org" }),
]);

export const json = (v) => JSON.stringify(v, (_, x) => (typeof x === "bigint" ? x.toString() : x), 2);
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const errMsg = (e) => (e?.type ? e.type + ": " : "") + (e?.message ?? String(e)).slice(0, 500);

/** Account from two .env keys (id + private key). */
export function accountFromEnv(idKey, keyKey) {
  const id = process.env[idKey];
  const key = process.env[keyKey];
  if (!id || !key) throw new Error(`${idKey}/${keyKey} missing in .env`);
  return new Account(id, provider, key);
}

/** Append KEY=value lines to .env and process.env. */
export function saveEnv(entries) {
  const cur = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
  fs.appendFileSync(envPath, (cur && !cur.endsWith("\n") ? "\n" : "") + Object.entries(entries).map(([k, v]) => `${k}=${v}\n`).join(""));
  Object.assign(process.env, entries);
}

export const view = (contractId, method, args = {}) =>
  provider.callFunction({ contractId, method, args, blockQuery: { finality: "optimistic" } });

export const call = (account, contractId, method, args, { deposit = 0n, gas = "100" } = {}) =>
  account.signAndSendTransaction({ receiverId: contractId, actions: [actions.functionCall(method, args, teraToGas(gas), deposit)] });

/** Total gas burnt across tx + receipts, and the largest single receipt (the function call itself), in Tgas. */
export function gasOf(res) {
  const receipts = (res?.receipts_outcome ?? []).map((r) => r.outcome?.gas_burnt ?? 0);
  const total = (res?.transaction_outcome?.outcome?.gas_burnt ?? 0) + receipts.reduce((a, b) => a + b, 0);
  return { total_tgas: +(total / 1e12).toFixed(3), fn_tgas: +((Math.max(0, ...receipts)) / 1e12).toFixed(3) };
}

export function summary(label, res) {
  const hash = res?.transaction?.hash ?? res?.transaction_outcome?.id;
  const failure = res?.status?.Failure;
  const sv = res?.status?.SuccessValue;
  const out = {
    label,
    ok: !failure,
    hash,
    explorer: hash ? EXPLORER + hash : undefined,
    ...gasOf(res),
    logs: (res?.receipts_outcome ?? []).flatMap((r) => r.outcome?.logs ?? []),
    result: sv ? Buffer.from(sv, "base64").toString() : undefined,
    failure,
  };
  const shown = { ...out, logs: out.logs.filter((l) => !l.includes("execution_requested")).map((l) => l.slice(0, 300)) };
  console.log(json(shown));
  return out;
}

/** Dataset folder under tasks/ for an on-chain task: the folder whose features.json lists the same feature names
 *  (task slugs may differ from folder names, e.g. `credit-risk` → tasks/german-credit), else tasks/<slug>. */
export function datasetDir(task) {
  const tasksDir = path.join(root, "tasks");
  for (const d of fs.readdirSync(tasksDir)) {
    const f = path.join(tasksDir, d, "features.json");
    if (!fs.existsSync(f)) continue;
    const names = JSON.parse(fs.readFileSync(f, "utf8")).features?.map((x) => x.name);
    if (names && JSON.stringify(names) === JSON.stringify(task.feature_names)) return path.join(tasksDir, d);
  }
  return path.join(tasksDir, task.slug);
}

export { Account, KeyPair, actions, teraToGas };
export { nearToYocto, yoctoToNear } from "near-api-js";
