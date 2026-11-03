// ML-3 — publish a task from tasks/<slug>/features.json.
//   node tools/create_task.mjs <slug> [--minutes 1440] [--fee 0.001] [--submission-fee 0.1] [--max 3]
//        [--secrets-account <acct>] [--profile <slug>] [--as TEAM|FT|MAIN]
// Signer (--as): TEAM = TEAM_ACCOUNT_ID/TEAM_PRIVATE_KEY, FT = NEAR_FT_CONTRACT_*, MAIN = NEAR_ACCOUNT_ID/NEAR_PRIVATE_KEY.
// Contract: BURSA_CONTRACT_ID in .env (falls back to BURSA_DEV_ID).
import fs from "node:fs";
import path from "node:path";
import { accountFromEnv, call, view, summary, root, nearToYocto, errMsg } from "./lib.mjs";

const args = process.argv.slice(2);
const slug = args[0];
if (!slug || slug.startsWith("--")) { console.log("usage: node tools/create_task.mjs <slug> [--minutes N] [--fee NEAR] [--submission-fee NEAR] [--max N] [--secrets-account A] [--profile P] [--as TEAM|FT|MAIN]"); process.exit(2); }
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const signers = { TEAM: ["TEAM_ACCOUNT_ID", "TEAM_PRIVATE_KEY"], FT: ["NEAR_FT_CONTRACT_ID", "NEAR_FT_CONTRACT_PRIVATE_KEY"], MAIN: ["NEAR_ACCOUNT_ID", "NEAR_PRIVATE_KEY"] };
const who = opt("as", process.env.TEAM_ACCOUNT_ID ? "TEAM" : "FT");
const signer = accountFromEnv(...signers[who]);
const C = process.env.BURSA_CONTRACT_ID || process.env.BURSA_DEV_ID;
if (!C) throw new Error("BURSA_CONTRACT_ID (or BURSA_DEV_ID) missing in .env");

const spec = JSON.parse(fs.readFileSync(path.join(root, "tasks", slug, "features.json"), "utf8"));
const minutes = Number(opt("minutes", "1440"));
const deadline_ns = (BigInt(Date.now() + minutes * 60_000) * 1_000_000n).toString();
const taskArgs = {
  title: spec.title.slice(0, 80),
  slug: opt("slug-override", spec.slug),
  description_url: opt("url", `https://github.com/`),
  n_features: spec.n_features,
  feature_names: spec.features.map((f) => f.name),
  secrets_account: opt("secrets-account", signer.accountId),
  secrets_profile: opt("profile", spec.slug),
  deadline_ns,
  fee_per_call: nearToYocto(opt("fee", "0.001")).toString(),
  submission_fee: nearToYocto(opt("submission-fee", "0.1")).toString(),
  max_per_account: Number(opt("max", "3")),
};
console.log(`create_task on ${C} as ${signer.accountId}:`, JSON.stringify({ ...taskArgs, feature_names: `${taskArgs.feature_names.length} names` }, null, 2));
try {
  const r = await call(signer, C, "create_task", taskArgs, { deposit: nearToYocto("0.05"), gas: "50" });
  const s = summary("create_task", r);
  const taskId = Number(s.result);
  console.log("\ntask_id =", taskId);
  console.log(JSON.stringify(await view(C, "get_task", { task_id: taskId }), null, 2));
  console.log(`\nnext: store the private splits for this task under the pinned evaluator hash:\n  bash tools/secrets.sh ${slug} ${taskArgs.secrets_profile}`);
} catch (e) {
  console.log("[ERR]", errMsg(e));
  process.exit(1);
}
