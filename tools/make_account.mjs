// Create a funded sub-account of the team account and save its full-access key in .env.
//   node tools/make_account.mjs <name> <NEAR> <ENV_PREFIX>     e.g. node tools/make_account.mjs maker 1.3 MAKER
// Writes <ENV_PREFIX>_ACCOUNT_ID and <ENV_PREFIX>_PRIVATE_KEY to .env (never printed). Refuses if the prefix exists.
import fs from "node:fs";
import { accountFromEnv, saveEnv, envPath, provider, summary, errMsg, KeyPair, nearToYocto } from "./lib.mjs";

const [name, amount, prefix] = process.argv.slice(2);
if (!name || !amount || !prefix) { console.log("usage: node tools/make_account.mjs <name> <NEAR> <ENV_PREFIX>"); process.exit(2); }
if (new RegExp(`^${prefix}_ACCOUNT_ID=`, "m").test(fs.readFileSync(envPath, "utf8"))) { console.log(`${prefix}_ACCOUNT_ID already in .env; refusing`); process.exit(1); }
const team = accountFromEnv("TEAM_ACCOUNT_ID", "TEAM_PRIVATE_KEY");
const id = `${name}.${team.accountId}`;
const kp = KeyPair.fromRandom("ed25519");
try {
  const res = await team.createSubAccount({ accountOrPrefix: name, publicKey: kp.getPublicKey(), nearToTransfer: nearToYocto(amount) });
  summary(`create ${id}`, res);
  saveEnv({ [`${prefix}_ACCOUNT_ID`]: id, [`${prefix}_PRIVATE_KEY`]: kp.toString() });
  const acc = await provider.query({ request_type: "view_account", finality: "final", account_id: id });
  console.log(`created ${id} with ${Number(BigInt(acc.amount) / 10n ** 21n) / 1000} NEAR; key saved to .env as ${prefix}_*`);
} catch (e) {
  console.log("[ERR]", errMsg(e));
  process.exit(1);
}
