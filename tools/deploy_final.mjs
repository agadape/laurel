// Final demo deployment (D-6 prep). From the funded TEAM account it creates the named accounts, deploys the
// contract, pins the evaluator, publishes the German Credit task, submits the two reference models, scores them,
// and (optionally) waits for the deadline, closes the task and lets the agent call the winner.
//
//   node tools/deploy_final.mjs --name laurel [--slug credit-risk] [--minutes 60] [--open-until 2026-11-25T23:59:00Z] [--close]
//
// Creates TWO tasks: `<slug>` (demo; closed with --close so predict_task works) and `<slug>-open`
// (same spec, deadline --open-until) so judges can still submit models and get them scored.
// Needs in .env: TEAM_ACCOUNT_ID / TEAM_PRIVATE_KEY (≥ 8 NEAR free), and the OutLayer secret owner for the task
// (SECRETS_ACCOUNT, default NEAR_ACCOUNT_ID, profile `german-credit`, bound to EVALUATOR_HASH).
// Idempotent: accounts and deployment recorded in .env (FINAL_*) are reused on re-runs; keys are saved BEFORE
// the create transaction so a crash can never strand an account.
import fs from "node:fs";
import path from "node:path";
import { saveEnv, provider, view, call, summary, json, sleep, errMsg, root, here, Account, KeyPair, actions, teraToGas, nearToYocto, yoctoToNear, OUTLAYER } from "./lib.mjs";

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const NAME = opt("name", "laurel");
const MINUTES = Number(opt("minutes", "60"));
const SLUG = opt("slug", "german-credit"); // 4 Nov: tasks 1/2 (`german-credit*`, Indonesian title) were superseded by `credit-risk*` (English title)
const OPEN_UNTIL = Date.parse(opt("open-until", "2026-11-25T23:59:00Z"));
if (!process.env.TEAM_ACCOUNT_ID || !process.env.TEAM_PRIVATE_KEY) throw new Error("TEAM_ACCOUNT_ID/TEAM_PRIVATE_KEY missing in .env");
const EVALUATOR_URL = process.env.EVALUATOR_URL || "https://nh-spike-wasm.vercel.app/8b80010fc79259c9f5d95183a660e79ad7a450fdfceed3e8ce0924f296b60ac3.wasm";
const EVALUATOR_HASH = process.env.EVALUATOR_HASH || "8b80010fc79259c9f5d95183a660e79ad7a450fdfceed3e8ce0924f296b60ac3";
const SECRETS_ACCOUNT = process.env.SECRETS_ACCOUNT || process.env.NEAR_ACCOUNT_ID;
const { JsonRpcProvider } = await import("near-api-js");
const single = new JsonRpcProvider({ url: opt("rpc", process.env.WRITE_RPC || "https://rpc.testnet.fastnear.com") }); // writes: one provider, typed errors (--rpc to switch when rate-limited)
const team = new Account(process.env.TEAM_ACCOUNT_ID, single, process.env.TEAM_PRIVATE_KEY);
const out = { when: new Date().toISOString(), team: team.accountId, steps: [] };
const EXPECTED = { deep: { a: 7100, b: 6650 }, shallow: { a: 7550, b: 6150 } }; // docs/EVALUATOR.md
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
      if (!/RetriesExceeded|429|Rate limit|ECONNRESET|fetch failed|timeout/i.test(m) || attempt >= 5) { console.log(`[FAILED] ${name}: ${m.slice(0, 200)}`); throw e; }
      console.log(`[retry ${attempt}] ${name}`); await sleep(4000 * attempt);
    }
  }
}
/** Named sub-account of the team, created once and remembered in .env as FINAL_<KEY>_ID/_PRIVATE_KEY. */
async function named(prefix, near, envKey) {
  if (process.env[`FINAL_${envKey}_ID`]) return new Account(process.env[`FINAL_${envKey}_ID`], single, process.env[`FINAL_${envKey}_PRIVATE_KEY`]);
  const kp = KeyPair.fromRandom("ed25519");
  const id = `${prefix}.${team.accountId}`;
  saveEnv({ [`FINAL_${envKey}_ID`]: id, [`FINAL_${envKey}_PRIVATE_KEY`]: kp.toString() }); // before the tx: never strand an account
  await step(`create ${id}`, () => team.createSubAccount({ accountOrPrefix: prefix, publicKey: kp.getPublicKey(), nearToTransfer: nearToYocto(near) }));
  for (let i = 0; i < 10; i++) { try { await provider.viewAccount({ accountId: id }); break; } catch { await sleep(1500); } }
  return new Account(id, single, kp.toString());
}

/** Idempotent task creation by slug. */
async function ensureTask(slug, deadlineMs) {
  let task = await view(C, "get_task_by_slug", { slug });
  if (task) return task;
  const deadline_ns = (BigInt(deadlineMs) * 1_000_000n).toString();
  const id = Number((await step(`create_task ${slug}`, () => call(team, C, "create_task", {
    title: (slug.endsWith("-open") ? "[open] " : "") + spec.title.slice(0, 72), slug, description_url: "https://github.com/agadape/laurel/blob/main/tasks/german-credit/README.md", n_features: spec.n_features, feature_names: spec.features.map((f) => f.name),
    secrets_account: SECRETS_ACCOUNT, secrets_profile: "german-credit", deadline_ns, fee_per_call: nearToYocto("0.001").toString(), submission_fee: nearToYocto("0.1").toString(), max_per_account: 3,
  }, { deposit: nearToYocto("0.05"), gas: "50" }))).result);
  return view(C, "get_task", { task_id: id });
}

/** Submit + score one reference model for a task unless that owner already has a submission there. */
async function ensureScored(task, who, name) {
  const mine = (await view(C, "list_submissions", { task_id: task.task_id })).filter((s) => s.owner === who.accountId);
  if (mine.length) { console.log(`  ${name}: already submitted (#${mine[0].submission_id}, ${json(mine[0].status)})`); return mine[0]; }
  const bytes = fs.readFileSync(path.join(root, "tasks", "german-credit", "out", name, "model.bin"));
  const v = await view(C, "validate_model", { task_id: task.task_id, bytes: bytes.toString("base64") });
  if (!v.ok) throw new Error(`${name}: validate_model ${json(v)}`);
  const deposit = BigInt(v.storage_cost) + BigInt(task.submission_fee) + nearToYocto("0.02");
  const id = Number((await step(`${name}: submit_model (task ${task.task_id})`, () => call(who, C, "submit_model", { task_id: task.task_id, bytes: bytes.toString("base64") }, { deposit, gas: "150" }))).result);
  await step(`${name}: request_score #${id}`, () => call(who, C, "request_score", { submission_id: id }, { deposit: nearToYocto("0.1"), gas: "300" }));
  const sub = await view(C, "get_submission", { submission_id: id });
  const ok = sub.status === "Scored" && sub.score_a_bps === EXPECTED[name].a && sub.score_b_bps === EXPECTED[name].b;
  console.log(`  ${name} #${id}: ${json(sub.status)} A ${sub.score_a_bps} B ${sub.score_b_bps} → ${ok ? "matches docs/EVALUATOR.md" : "MISMATCH — stop and check evaluator/secret before touching docs"}`);
  if (!ok) throw new Error(`${name}: unexpected score ${json(sub)}`);
  return sub;
}

console.log(`final deploy "${NAME}" from ${team.accountId}; evaluator ${EVALUATOR_HASH.slice(0, 8)}…; secrets ${SECRETS_ACCOUNT}/german-credit`);
const contract = await named(NAME, "3.4", "CONTRACT");            // ≈ 2.9 NEAR code + task storage
const p1 = await named("p1", "1.6", "P1");                       // deep model on two tasks (2 × ≈0.6)
const p2 = await named("p2", "0.6", "P2");                       // shallow model
const agentOwner = await named("agent", "0.6", "AGENT");         // FC-key agent
const C = contract.accountId;
out.contract = C;
// aliases so submit.mjs/predict.mjs (--as P1/P2) and agent.mjs (AGENT_*) use the final accounts
saveEnv({ BURSA_CONTRACT_ID: C, P1_ACCOUNT_ID: p1.accountId, P1_PRIVATE_KEY: process.env.FINAL_P1_PRIVATE_KEY, P2_ACCOUNT_ID: p2.accountId, P2_PRIVATE_KEY: process.env.FINAL_P2_PRIVATE_KEY, AGENT_ACCOUNT_ID: agentOwner.accountId, AGENT_PRIVATE_KEY: process.env.FINAL_AGENT_PRIVATE_KEY });

const st = await provider.viewAccount({ accountId: C });
if (st.code_hash === "11111111111111111111111111111111") {
  const wasm = fs.readFileSync(path.join(root, "wasm", "bursa.wasm"));
  await step("deploy + new", () => contract.signAndSendTransaction({ receiverId: C, actions: [actions.deployContract(new Uint8Array(wasm)), actions.functionCall("new", { owner: team.accountId, outlayer: OUTLAYER, evaluator_url: EVALUATOR_URL, evaluator_hash: EVALUATOR_HASH }, teraToGas("50"), 0n)] }));
} else console.log("contract already deployed on", C);
await step("get_config", () => view(C, "get_config"));

const task = await ensureTask(SLUG, Date.now() + MINUTES * 60_000);
const openTask = await ensureTask(`${SLUG}-open`, OPEN_UNTIL);
const tId = task.task_id;
out.task_id = tId; out.open_task_id = openTask.task_id;

// reference models on both tasks (demo task gets both; open task gets the deep model so its leaderboard is not empty)
await ensureScored(task, p1, "deep");
await ensureScored(task, p2, "shallow");
await ensureScored(openTask, p1, "deep");

// agent: FC key + prepaid credit (once)
if (!process.env.FINAL_AGENT_FC_PRIVATE_KEY) {
  const fc = KeyPair.fromRandom("ed25519");
  saveEnv({ FINAL_AGENT_FC_PRIVATE_KEY: fc.toString(), AGENT_FC_PRIVATE_KEY: fc.toString() });
  await step("agent: add function-call key", () => agentOwner.signAndSendTransaction({ receiverId: agentOwner.accountId, actions: [actions.addFunctionCallAccessKey(fc.getPublicKey(), C, ["predict_task", "predict"], nearToYocto("1"))] }));
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
console.log(`\ncontract ${C} · demo task ${tId} (closed with --close) · open task ${openTask.task_id} (until ${new Date(OPEN_UNTIL).toISOString()})`);
console.log(`explorer https://laurel-near.vercel.app/?contract=${C}#/task/${tId}`);
console.log("next: update web/src/rpc.js default, README A/D/E ids, docs/TESTNET.md, docs/SUBMISSION.md; then node tools/consumer.mjs <demo task> --funder TEAM and node tools/agent.mjs <demo task> --funder TEAM.");
