// Log the OutLayer CLI (in WSL) into MAINNET as the task's secrets owner, from ../.env, without the key ever being
// printed or put on a command line. Writes ~/.outlayer/mainnet/credentials.json inside WSL with mode 600 through stdin,
// the same file `outlayer login mainnet` writes. The CLI's default network is left as it is (testnet), so testnet
// tools keep working; mainnet commands then run with OUTLAYER_NETWORK=mainnet, e.g.
//   wsl -d Ubuntu-24.04 -- bash -lc 'cd /mnt/c/Project_Dave/NEAR_Hackathon_2 && OUTLAYER_NETWORK=mainnet bash tools/secrets.sh near-retention near-retention 8b80010fc79259c9f5d95183a660e79ad7a450fdfceed3e8ce0924f296b60ac3'
//
//   node tools/outlayer_mainnet_login.mjs            # owner = MAINNET_SECRETS_ACCOUNT if set, else MAINNET_ACCOUNT_ID
// Read-only check first: the key must be a full-access key of that account on mainnet.
import { spawnSync } from "node:child_process";
import { KeyPair } from "near-api-js";
import "./lib.mjs";   // loads ../.env

const DISTRO = process.env.WSL_DISTRO || "Ubuntu-24.04";
const id = process.env.MAINNET_SECRETS_ACCOUNT || process.env.MAINNET_ACCOUNT_ID;
const key = process.env.MAINNET_SECRETS_ACCOUNT ? process.env.MAINNET_SECRETS_PRIVATE_KEY : process.env.MAINNET_PRIVATE_KEY;
if (!id || !key) { console.log("[STOP] MAINNET_ACCOUNT_ID / MAINNET_PRIVATE_KEY are not in .env yet: run tools/mainnet_key.ps1 first"); process.exit(1); }
const pub = KeyPair.fromString(key).getPublicKey().toString();

const r = await fetch("https://rpc.mainnet.fastnear.com", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "query", params: { request_type: "view_access_key", finality: "final", account_id: id, public_key: pub } }) }).then((x) => x.json());
if (r.error || r.result?.error) { console.log(`[STOP] ${pub} is not a key of ${id} on mainnet`); process.exit(1); }
if (r.result.permission !== "FullAccess") { console.log("[STOP] storing a secret needs a full-access key"); process.exit(1); }

const creds = JSON.stringify({ account_id: id, public_key: pub, private_key: key, contract_id: "outlayer.near", auth_type: "near_key" }, null, 2);
const w = spawnSync("wsl", ["-d", DISTRO, "--", "bash", "-c", "umask 077 && mkdir -p ~/.outlayer/mainnet && cat > ~/.outlayer/mainnet/credentials.json && chmod 600 ~/.outlayer/mainnet/credentials.json && echo written"], { input: creds, encoding: "utf8" });
if (w.status !== 0 || !/written/.test(w.stdout)) { console.log("[STOP] could not write the WSL credentials file:", (w.stderr || w.stdout).slice(0, 300)); process.exit(1); }
const who = spawnSync("wsl", ["-d", DISTRO, "--", "bash", "-lc", "OUTLAYER_NETWORK=mainnet outlayer whoami 2>&1 | head -3"], { encoding: "utf8" });
console.log(`OutLayer CLI (WSL ${DISTRO}) logged into MAINNET as ${id} (key ${pub}, full access); default network unchanged`);
console.log((who.stdout || "").replace(/ed25519:[1-9A-HJ-NP-Za-km-z]{60,}/g, "ed25519:<hidden>").trim());
