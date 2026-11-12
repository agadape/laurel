// Save a NEAR MAINNET account and its private key into ../.env without ever showing the key.
//   Called by tools/mainnet_key.ps1 (Windows, hidden input) or tools/mainnet_key.sh (Linux/macOS/WSL).
//   The key arrives in the environment variable LAUREL_KEY_IN, never on the command line. It may be an
//   `ed25519:...` private key OR a 12/24-word seed phrase (NEAR Mobile, MyNearWallet, Meteor exports): the phrase is
//   turned into its key here, locally (BIP-39 + SLIP-10 path m/44'/397'/0', near-seed-phrase, which near-api-js
//   itself uses), and only the resulting key is written. The phrase itself is never stored.
//   node tools/mainnet_key.mjs <account.near>
// It checks, read-only on mainnet RPC: the account exists, the key belongs to it, and whether it is a full-access key.
// Then it writes MAINNET_ACCOUNT_ID and MAINNET_PRIVATE_KEY to .env (git-ignored), replacing older values.
// Prints only the account, the PUBLIC key, the key's permission and the balance.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { KeyPair } from "near-api-js";
const require = createRequire(import.meta.url);

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(root, ".env");
const RPCS = ["https://rpc.mainnet.fastnear.com", "https://free.rpc.fastnear.com", "https://near.lava.build"];
const account = (process.argv[2] || "").trim().toLowerCase();
const raw = (process.env.LAUREL_KEY_IN || "").trim();
delete process.env.LAUREL_KEY_IN;
const words = raw.toLowerCase().split(/\s+/).filter(Boolean);
let secret = raw.replace(/\s+/g, ""), from = "private key";
if (words.length === 12 || words.length === 24) {
  const bip39 = require("bip39");
  if (!bip39.validateMnemonic(words.join(" "))) { console.log("[STOP] those words are not a valid BIP-39 seed phrase (a typo or a word out of order?); nothing was saved"); process.exit(1); }
  secret = require("near-seed-phrase").parseSeedPhrase(words.join(" ")).secretKey;
  from = `${words.length}-word seed phrase, path m/44'/397'/0'`;
}

const fail = (m) => { console.log(`[STOP] ${m}`); process.exit(1); };
if (!/^([a-z0-9_-]+\.)*[a-z0-9_-]+\.near$|^[0-9a-f]{64}$/.test(account)) fail(`"${account}" is not a mainnet account (name.near or a 64-hex implicit account)`);
if (!/^ed25519:[1-9A-HJ-NP-Za-km-z]{60,}$/.test(secret)) fail("paste either an ed25519:<base58> private key or a 12/24-word seed phrase; nothing was saved");

let pub;
try { pub = KeyPair.fromString(secret).getPublicKey().toString(); } catch { fail("that is not a valid ed25519 private key; nothing was saved"); }

async function query(params) {
  let last;
  for (const url of RPCS) {
    try {
      const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "query", params }), signal: AbortSignal.timeout(15000) });
      const j = await r.json();
      if (j.error) return { error: j.error };
      if (j.result?.error) return { error: j.result.error };
      return { result: j.result };
    } catch (e) { last = e; }
  }
  return { error: String(last?.message || last) };
}

const acc = await query({ request_type: "view_account", finality: "final", account_id: account });
if (acc.error) fail(`${account} was not found on mainnet (${JSON.stringify(acc.error).slice(0, 120)}); nothing was saved`);
const key = await query({ request_type: "view_access_key", finality: "final", account_id: account, public_key: pub });
if (key.error) fail(`the key from this ${from} (public ${pub}) is not a key of ${account}; nothing was saved${from.includes("seed") ? ". If the wallet derived the account key differently, export the private key (ed25519:...) instead" : ""}`);
const perm = key.result.permission === "FullAccess" ? "FullAccess" : `FunctionCall ${JSON.stringify(key.result.permission.FunctionCall)}`;
if (perm !== "FullAccess") fail(`the key is a function-call key (${perm}); deploying needs a full-access key; nothing was saved`);

const lines = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8").split(/\r?\n/).filter((l) => !/^MAINNET_(ACCOUNT_ID|PRIVATE_KEY)=/.test(l)) : [];
while (lines.length && lines[lines.length - 1] === "") lines.pop();
lines.push(`MAINNET_ACCOUNT_ID=${account}`, `MAINNET_PRIVATE_KEY=${secret}`, "");
fs.writeFileSync(envPath, lines.join("\n"));

const near = Number(BigInt(acc.result.amount) / 10n ** 21n) / 1000;
console.log(`saved to .env: MAINNET_ACCOUNT_ID=${account}`);
console.log(`key: ${pub} (${perm}, from the ${from}) — the private key is in .env only, never printed`);
console.log(`balance: ${near.toFixed(3)} NEAR${near < 5 ? "  (the full mainnet deployment needs about 5 NEAR)" : ""}`);
