// Final demo deployment (D-6 prep). From the funded TEAM account it creates the named accounts, deploys the
// contract, pins the evaluator, publishes the German Credit task, submits the two reference models, scores them,
// and (optionally) waits for the deadline, closes the task and lets the agent call the winner.
//
//   node tools/deploy_final.mjs --name laurel [--minutes 60] [--close] [--consumer]
//
// Needs in .env: TEAM_ACCOUNT_ID / TEAM_PRIVATE_KEY (≥ 12 NEAR free), and the OutLayer secret owner for the task
// (SECRETS_ACCOUNT, default NEAR_ACCOUNT_ID, profile `german-credit`, bound to EVALUATOR_HASH).
// Idempotent: accounts and deployment recorded in .env (FINAL_*) are reused on re-runs.
import fs from "node:fs";
import path from "node:path";
import { accountFromEnv, saveEnv, provider, view, call, summary, json, sleep, errMsg, root, here, Account, KeyPair, actions, teraToGas, nearToYocto, yoctoToNear, OUTLAYER } from "./lib.mjs";

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const NAME = opt("name", "laurel");
const MINUTES = Number(opt("minutes", "60"));
const team = accountFromEnv("TEAM_ACCOUNT_ID", "TEAM_PRIVATE_KEY");
const EVALUATOR_URL = process.env.EVALUATOR_URL || "https://nh-spike-wasm.vercel.app/8b80010fc79259c9f5d95183a660e79ad7a450fdfceed3e8ce0924f296b60ac3.wasm";
const EVALUATOR_HASH = process.env.EVALUATOR_HASH || "8b80010fc79259c9f5d95183a660e79ad7a450fdfceed3e8ce0924f296b60ac3";
const SECRETS_ACCOUNT = process.env.SECRETS_ACCOUNT || process.env.NEAR_ACCOUNT_ID;
const { JsonRpcProvider } = await import("near-api-js");
const single = new JsonRpcProvider({ url: "https://rpc.testnet.fastnear.com" });
const out = { when: new Date().toISOString(), team: team.accountId, steps: [] };
const save = () => fs.writeFileSync(path.join(here, "out", "deploy_final.json"), json(out) + "\n");
const spec = JSON.parse(fs.readFileSync(path.join(root, "tasks", "german-credit", "features.json"), "utf8"));
const holdout = fs.readFileSync(path.join(root, "tasks", "german-credit", "public_holdout.csv"), "utf8").trim().split("\n").slice(1).map((l) => l.split(",").map(Number));

async function step(name, fn) {
  for (let attempt = 1; ; attempt++) {
    try {
      const r = await fn();
      const s = r?.transaction ? summary(name, r) : { ok: true, value: r };
      if (s.ok === false) throw new Error(`${name}: ${json(s.failure)}`);
      out.steps.push({ name, hash: s.hash, total_tgas: s.total_tgas, result: s.result ?? (r?.transaction ? undefined : r) });
      save(); await sleep(300);
      return s;
    } catch (e) {
      const m = errMsg(e);
      if (!/RetriesExceeded|429|Rate limit|ECONNRESET|fetch failed|timeout/i.test(m) || attempt >= 3) { console.log(`[FAILED] ${name}: ${m.slice(0, 200)}`); throw e; }
      console.log(`[retry ${attempt}] ${name}`); await sleep(4000 * attempt);
    }
  }
}
/** Named sub-account of the team, created once and remembered in .env as FINAL_<KEY>_ID/_PRIVATE_KEY. */
async function named(prefix, near, envKey) {
  if (process.env[`FINAL_${envKey}_ID`]) return new Account(process.env[`FINAL_${envKey}_ID`], single, process.env[`FINAL_${envKey}_PRIVATE_KEY`]);
  const kp = KeyPair.fromRandom("ed25519");
  const id = `${prefix}.${team.accountId}`;
  await step(`create ${id}`, () => team.createSubAccount({ accountOrPrefix: prefix, publicKey: kp.getPublicKey(), nearToTransfer: nearToYocto(near) }));
  saveEnv({ [`FINAL_${envKey}_ID`]: id, [`FINAL_${envKey}_PRIVATE_KEY`]: kp.toString() });
  for (let i = 0; i < 10; i++) { try { await provider.viewAccount({ accountId: id }); break; } catch { await sleep(1500); } }
  return new Account(id, single, kp.toString());
}

console.log(`final deploy "${NAME}" from ${team.accountId}; evaluator ${EVALUATOR_HASH.slice(0, 8)}…; secrets ${SECRETS_ACCOUNT}/german-credit`);
const contract = await named(NAME, "3.4", "CONTRACT");            // ≈ 2.9 NEAR code + task storage
const p1 = await named("p1", "1.0", "P1");                       // deep model
const p2 = await named("p2", "0.6", "P2");                       // shallow model
const agentOwner = await named("agent", "0.6", "AGENT");         // FC-key agent
const C = contract.accountId;
out.contract = C;
saveEnv({ BURSA_CONTRACT_ID: C });

const st = await provider.viewAccount({ accountId: C });
if (st.code_hash === "11111111111111111111111111111111") {
  const wasm = fs.readFileSync(path.join(root, "wasm", "bursa.wasm"));
  await step("deploy + new", () => contract.signAndSendTransaction({ receiverId: C, actions: [actions.deployContract(new Uint8Array(wasm)), actions.functionCall("new", { owner: team.accountId, outlayer: OUTLAYER, evaluator_url: EVALUATOR_URL, evaluator_hash: EVALUATOR_HASH }, teraToGas("50"), 0n)] }));
} else console.log("contract already deployed on", C);
await step("get_config", () => view(C, "get_config"));

let task = await view(C, "get_task_by_slug", { slug: "german-credit" });
if (!task) {
  const deadline_ns = (BigInt(Date.now() + MINUTES * 60_000) * 1_000_000n).toString();
  const id = Number((await step("create_task german-credit", () => call(team, C, "create_task", {
    title: spec.title.slice(0, 80), slug: "german-credit", description_url: "https://github.com/", n_features: spec.n_features, feature_names: spec.features.map((f) => f.name),
    secrets_account: SECRETS_ACCOUNT, secrets_profile: "german-credit", deadline_ns, fee_per_call: nearToYocto("0.001").toString(), submission_fee: nearToYocto("0.1").toString(), max_per_account: 3,
  }, { deposit: nearToYocto("0.05"), gas: "50" }))).result);
  task = await view(C, "get_task", { task_id: id });
}
const tId = task.task_id;
out.task_id = tId;

if (task.submission_count === 0) {
  for (const [who, name] of [[p1, "deep"], [p2, "shallow"]]) {
    const bytes = fs.readFileSync(path.join(root, "tasks", "german-credit", "out", name, "model.bin"));
    const v = await view(C, "validate_model", { task_id: tId, bytes: bytes.toString("base64") });
    const deposit = BigInt(v.storage_cost) + BigInt(task.submission_fee) + nearToYocto("0.02");
    const id = Number((await step(`${name}: submit_model`, () => call(who, C, "submit_model", { task_id: tId, bytes: bytes.toString("base64") }, { deposit, gas: "150" }))).result);
    await step(`${name}: request_score`, () => call(who, C, "request_score", { submission_id: id }, { deposit: nearToYocto("0.1"), gas: "300" }));
    const sub = await view(C, "get_submission", { submission_id: id });
    console.log(`  ${name} #${id}: ${json(sub.status)} A ${sub.score_a_bps} B ${sub.score_b_bps}`);
  }
} else console.log(`task ${tId} already has ${task.submission_count} submissions`);

// agent: FC key + prepaid credit (once)
if (!process.env.FINAL_AGENT_FC_PRIVATE_KEY) {
  const fc = KeyPair.fromRandom("ed25519");
  await step("agent: add function-call key", () => agentOwner.signAndSendTransaction({ receiverId: agentOwner.accountId, actions: [actions.addFunctionCallAccessKey(fc.getPublicKey(), C, ["predict_task", "predict"], nearToYocto("1"))] }));
  saveEnv({ FINAL_AGENT_FC_PRIVATE_KEY: fc.toString() });
}
if (BigInt(await view(C, "get_credit", { account_id: agentOwner.accountId })) < BigInt(nearToYocto("0.01"))) {
  await step("agent owner: deposit_credit 0.05", () => call(agentOwner, C, "deposit_credit", {}, { deposit: nearToYocto("0.05"), gas: "30" }));
}

if (args.includes("--close")) {
  const deadlineMs = Number(BigInt(task.deadline_ns) / 1_000_000n);
  if (Date.now() < deadlineMs) { console.log(`waiting ${Math.ceil((deadlineMs - Date.now()) / 1000)}s for the deadline...`); await sleep(deadlineMs - Date.now() + 3000); }
  if (!task.closed) await step("close_task", () => call(team, C, "close_task", { task_id: tId }, { gas: "50" }));
  const agent = new Account(agentOwner.accountId, single, process.env.FINAL_AGENT_FC_PRIVATE_KEY);
  for (let r = 0; r < 5; r++) {
    const s = await step(`agent predict_task row ${r}`, () => agent.signAndSendTransaction({ receiverId: C, actions: [actions.functionCall("predict_task", { task_id: tId, features: holdout[r].slice(0, -1) }, teraToGas("20"), 0n)] }));
    console.log(`  row ${r}: score ${s.result} (label asli ${holdout[r].at(-1)})`);
  }
  console.log("leaderboard:", json(await view(C, "leaderboard", { task_id: tId })));
}
save();
console.log(`\ncontract ${C} · task ${tId} · explorer https://bursa-model.vercel.app/?contract=${C}#/task/${tId}`);
console.log("next: update VITE_BURSA_CONTRACT default in web/src/rpc.js, docs/TESTNET.md and README A.1 to this contract; agent.mjs/consumer.mjs work with BURSA_CONTRACT_ID set.");
