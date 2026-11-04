// T-3 — end-to-end run from ZERO on testnet: fresh contract + participants + agent, the whole user journey,
// the negative paths, and a report with every transaction hash. This is what a judge (or we, on 13 Nov) runs.
//
//   node tools/e2e.mjs [--funder NFT|FT|TEAM] [--minutes 3] [--cleanup] [--no-score]
//
// Needs in .env: the funder key (≥ 6 NEAR free), NEAR_ACCOUNT_ID (owner of the OutLayer secret profile
// `german-credit`, see docs/EVALUATOR.md), and the model files from tools/export.py in tasks/german-credit/out/.
// --cleanup deletes the four fresh accounts at the end and returns the NEAR to the funder.
import fs from "node:fs";
import path from "node:path";
import { accountFromEnv, provider, view, call, summary, json, sleep, errMsg, root, here, Account, KeyPair, actions, teraToGas, nearToYocto, yoctoToNear, OUTLAYER } from "./lib.mjs";

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const funders = { TEAM: ["TEAM_ACCOUNT_ID", "TEAM_PRIVATE_KEY"], FT: ["NEAR_FT_CONTRACT_ID", "NEAR_FT_CONTRACT_PRIVATE_KEY"], NFT: ["NEAR_NFT_CONTRACT_ID", "NEAR_NFT_CONTRACT_PRIVATE_KEY"], S22: ["NEAR_S22_CONTRACT_ID", "NEAR_S22_CONTRACT_PRIVATE_KEY"], MT: ["NEAR_MT_CONTRACT_ID", "NEAR_MT_CONTRACT_PRIVATE_KEY"] };
const funder = accountFromEnv(...funders[opt("funder", process.env.TEAM_ACCOUNT_ID ? "TEAM" : "NFT")]);
const MINUTES = Number(opt("minutes", "3"));
const CLEANUP = args.includes("--cleanup");
const CLEANUP_ONLY = opt("cleanup-only", null); // tag of an earlier run whose accounts should be deleted
const KEYS_FILE = path.join(here, "out", "e2e-keys.json"); // fresh-account keys, so a crashed run can still be cleaned up
const keys = fs.existsSync(KEYS_FILE) ? JSON.parse(fs.readFileSync(KEYS_FILE, "utf8")) : {};
const { JsonRpcProvider } = await import("near-api-js");
const singleProvider = new JsonRpcProvider({ url: process.env.WRITE_RPC || "https://rpc.testnet.fastnear.com" });
/** Same account on a single provider: typed protocol/contract errors instead of RetriesExceeded. */
const single = (acc) => new Account(acc.accountId, singleProvider, keys[acc.accountId]);
const EVALUATOR_URL = process.env.EVALUATOR_URL || "https://nh-spike-wasm.vercel.app/8b80010fc79259c9f5d95183a660e79ad7a450fdfceed3e8ce0924f296b60ac3.wasm";
const EVALUATOR_HASH = process.env.EVALUATOR_HASH || "8b80010fc79259c9f5d95183a660e79ad7a450fdfceed3e8ce0924f296b60ac3";
const SECRETS_ACCOUNT = process.env.SECRETS_ACCOUNT || process.env.NEAR_ACCOUNT_ID; // owner of the OutLayer secret rows
const TAG = CLEANUP_ONLY || Date.now().toString(36);
const T0 = Date.now();
const out = { when: new Date().toISOString(), funder: funder.accountId, tag: TAG, steps: [], negatives: [] };
const save = () => fs.writeFileSync(path.join(here, "out", "e2e.json"), json(out) + "\n");
const spec = JSON.parse(fs.readFileSync(path.join(root, "tasks", "german-credit", "features.json"), "utf8"));
const deep = fs.readFileSync(path.join(root, "tasks", "german-credit", "out", "deep", "model.bin"));
const shallow = fs.readFileSync(path.join(root, "tasks", "german-credit", "out", "shallow", "model.bin"));
const probe8 = fs.readFileSync(path.join(root, "tools", "fixtures", "model_8feat_synthetic.bin")); // 8 features → wrong task
const holdout = fs.readFileSync(path.join(root, "tasks", "german-credit", "public_holdout.csv"), "utf8").trim().split("\n").slice(1).map((l) => l.split(",").map(Number));
const b64 = (b) => b.toString("base64");

async function step(name, fn) {
  const t = Date.now();
  let r;
  for (let attempt = 1; ; attempt++) {
    try { r = await fn(); break; } catch (e) {
      const m = errMsg(e);
      const transient = /RetriesExceeded|429|Rate limit|ECONNRESET|fetch failed|timeout/i.test(m);
      if (!transient || attempt >= 3) { out.failed = { name, error: m.slice(0, 400) }; save(); console.log(`[FAILED] ${name}: ${m.slice(0, 200)}`); throw e; }
      console.log(`[retry ${attempt}] ${name}: ${m.slice(0, 100)}`); await sleep(4000 * attempt);
    }
  }
  const s = r?.transaction ? summary(name, r) : { ok: true, value: r };
  if (s.ok === false) throw new Error(`${name} failed: ${json(s.failure)}`);
  out.steps.push({ name, hash: s.hash, total_tgas: s.total_tgas, fn_tgas: s.fn_tgas, ms: Date.now() - t, result: s.result ?? (r?.transaction ? undefined : r) });
  save();
  await sleep(300); // be gentle with public RPC rate limits
  return s;
}
async function expectFail(name, fn, needle) {
  try {
    const r = await fn();
    const s = r?.transaction ? summary(name, r) : { ok: true };
    out.negatives.push({ name, rejected: false, hash: s.hash });
    console.log(`[UNEXPECTED SUCCESS] ${name}`);
  } catch (e) {
    const m = errMsg(e);
    const ok = !needle || m.includes(needle);
    out.negatives.push({ name, rejected: true, matched: ok, error: m.slice(0, 220) });
    console.log(`[rejected${ok ? "" : " — but message differs"}] ${name}: ${m.slice(0, 140)}`);
  }
  save();
  await sleep(300);
}
async function fresh(prefix, near) {
  const kp = KeyPair.fromRandom("ed25519");
  const id = `${prefix}-${TAG}.${funder.accountId}`;
  keys[id] = kp.toString();
  fs.writeFileSync(KEYS_FILE, json(keys) + "\n");
  await step(`create ${prefix}`, () => funder.createSubAccount({ accountOrPrefix: `${prefix}-${TAG}`, publicKey: kp.getPublicKey(), nearToTransfer: nearToYocto(near) }));
  for (let i = 0; i < 10; i++) { try { await provider.viewAccount({ accountId: id }); break; } catch { await sleep(1500); } }
  // Writes go through ONE provider: FailoverRpcProvider retries deterministic tx errors on every RPC and
  // then hides them behind RetriesExceeded (S7 gotcha). Views keep using the failover `provider`.
  return new Account(id, singleProvider, kp.toString());
}

async function cleanup(ids) {
  for (const id of ids) {
    if (!keys[id]) { console.log("no key for", id); continue; }
    const a = new Account(id, singleProvider, keys[id]);
    try { summary(`cleanup: delete ${id}`, await a.signAndSendTransaction({ receiverId: id, actions: [actions.deleteAccount(funder.accountId)] })); delete keys[id]; continue; }
    catch (e) { const m = errMsg(e); if (!/large state/i.test(m)) { console.log("cleanup failed:", id, m.slice(0, 120)); continue; } }
    // a contract account with large state cannot be deleted: sweep its free balance instead (storage stays locked)
    try {
      const st = await provider.viewAccount({ accountId: id });
      const free = BigInt(st.amount) - BigInt(st.storage_usage) * 10n ** 19n - BigInt(nearToYocto("0.05"));
      if (free > 0n) summary(`cleanup: sweep ${yoctoToNear(free, 3)} NEAR from ${id}`, await a.signAndSendTransaction({ receiverId: funder.accountId, actions: [actions.transfer(free)] }));
      console.log(`kept ${id} (large state; key stays in e2e-keys.json)`);
    } catch (e) { console.log("sweep failed:", id, errMsg(e).slice(0, 120)); }
  }
  fs.writeFileSync(KEYS_FILE, json(keys) + "\n");
}
if (CLEANUP_ONLY) {
  await cleanup(Object.keys(keys).filter((id) => id.includes(`-${CLEANUP_ONLY}.`)));
  process.exit(0);
}
if (args.includes("--report-only")) {
  // rebuild docs/E2E.md from the last tools/out/e2e.json without touching the chain
  Object.assign(out, JSON.parse(fs.readFileSync(path.join(here, "out", "e2e.json"), "utf8")));
  writeReport();
  process.exit(0);
}
console.log(`e2e ${TAG}: funder ${funder.accountId}, evaluator ${EVALUATOR_HASH.slice(0, 8)}…, secrets ${SECRETS_ACCOUNT}/german-credit`);

// ---------- 1. accounts + contract ----------
try {
const owner = await fresh("own", "0.3");        // task creator / contract owner
const contract = await fresh("bursa", "3.15");   // code ≈ 2.87 NEAR locked (cannot be deleted later: large state; free part is swept)
const p1 = await fresh("p1", "0.9");             // deep model (33 KB ≈ 0.33 + fee 0.1 + score 0.1)
const p2 = await fresh("p2", "1.0");             // shallow model + quota probes (3 × 0.12 + score 0.1)
const agentOwner = await fresh("agent", "0.5");  // pays burnt gas of FC-key calls
const C = contract.accountId;
Object.assign(out, { contract: C, owner: owner.accountId, p1: p1.accountId, p2: p2.accountId, agent: agentOwner.accountId });
const wasm = fs.readFileSync(path.join(root, "wasm", "bursa.wasm"));
await step("deploy + new", () => contract.signAndSendTransaction({ receiverId: C, actions: [actions.deployContract(new Uint8Array(wasm)), actions.functionCall("new", { owner: owner.accountId, outlayer: OUTLAYER, evaluator_url: EVALUATOR_URL, evaluator_hash: EVALUATOR_HASH }, teraToGas("50"), 0n)] }));
await step("get_config", () => view(C, "get_config"));
await expectFail("set_evaluator by non-owner", () => call(single(p1), C, "set_evaluator", { url: EVALUATOR_URL, hash: EVALUATOR_HASH }, { gas: "20" }), "owner only");

// ---------- 2. task ----------
const deadline_ns = (BigInt(Date.now() + MINUTES * 60_000) * 1_000_000n).toString();
const taskArgs = { title: spec.title.slice(0, 80), slug: "german-credit", description_url: "https://github.com/agadape/laurel/blob/main/tasks/german-credit/README.md", n_features: spec.n_features, feature_names: spec.features.map((f) => f.name), secrets_account: SECRETS_ACCOUNT, secrets_profile: "german-credit", deadline_ns, fee_per_call: nearToYocto("0.001").toString(), submission_fee: nearToYocto("0.1").toString(), max_per_account: 3 };
const tId = Number((await step("create_task german-credit", () => call(owner, C, "create_task", taskArgs, { deposit: nearToYocto("0.05"), gas: "50" }))).result);
await expectFail("create_task with the same slug", () => call(single(owner), C, "create_task", taskArgs, { deposit: nearToYocto("0.05"), gas: "50" }), "slug taken");
await expectFail("create_task with deadline in the past", () => call(single(owner), C, "create_task", { ...taskArgs, slug: "past", deadline_ns: "1" }, { deposit: nearToYocto("0.05"), gas: "50" }), "deadline in the past");

// ---------- 3. submissions + private scoring ----------
const sDeep = Number((await step("p1 submit deep (50×4)", () => call(p1, C, "submit_model", { task_id: tId, bytes: b64(deep) }, { deposit: nearToYocto("0.5"), gas: "150" }))).result);
const sShallow = Number((await step("p2 submit shallow (10×2)", () => call(p2, C, "submit_model", { task_id: tId, bytes: b64(shallow) }, { deposit: nearToYocto("0.15"), gas: "100" }))).result);
await expectFail("submit model with 8 features to an 18-feature task", () => call(single(p2), C, "submit_model", { task_id: tId, bytes: b64(probe8) }, { deposit: nearToYocto("0.5"), gas: "150" }), "WrongFeatureCount");
await expectFail("submit garbage bytes", () => call(single(p2), C, "submit_model", { task_id: tId, bytes: b64(Buffer.from([1, 2, 3, 4])) }, { deposit: nearToYocto("0.15"), gas: "100" }), "invalid model");
await expectFail("submit with deposit below storage + fee", () => call(single(p2), C, "submit_model", { task_id: tId, bytes: b64(shallow) }, { deposit: nearToYocto("0.1"), gas: "100" }), "storage deposit");
await expectFail("request_score by non-owner of the submission", () => call(single(p2), C, "request_score", { submission_id: sDeep }, { deposit: nearToYocto("0.1"), gas: "300" }), "owner only");
const expected = { [sDeep]: { a: 7100, b: 6650 }, [sShallow]: { a: 7550, b: 6150 } };
if (!args.includes("--no-score")) {
  for (const [who, id, label] of [[p1, sDeep, "deep"], [p2, sShallow, "shallow"]]) {
    const s = await step(`request_score ${label} (OutLayer, evaluator pinned)`, () => call(who, C, "request_score", { submission_id: id }, { deposit: nearToYocto("0.1"), gas: "300" }));
    const sub = await view(C, "get_submission", { submission_id: id });
    const okScore = sub.status === "Scored" && sub.score_a_bps === expected[id].a && sub.score_b_bps === expected[id].b;
    out.steps.at(-1).score = { status: sub.status, a: sub.score_a_bps, b: sub.score_b_bps, expected: expected[id], matches_local: okScore };
    console.log(`  ${label}: ${json(sub.status)} A ${sub.score_a_bps} B ${sub.score_b_bps} → ${okScore ? "matches local/Python" : "MISMATCH"}`);
    save();
  }
  await expectFail("request_score again on a Scored submission", () => call(single(p1), C, "request_score", { submission_id: sDeep }, { deposit: nearToYocto("0.1"), gas: "300" }), "not requestable");
}
// quota: p2 already has 1 (+ failed attempts don't count); two more OK, the fourth is rejected
for (let i = 0; i < 2; i++) await step(`p2 submit shallow again #${i + 2} (quota probe, --no-score)`, () => call(p2, C, "submit_model", { task_id: tId, bytes: b64(shallow) }, { deposit: nearToYocto("0.15"), gas: "100" }));
await expectFail("p2 fourth submission (quota 3 per account)", () => call(single(p2), C, "submit_model", { task_id: tId, bytes: b64(shallow) }, { deposit: nearToYocto("0.15"), gas: "100" }), "quota");
await step("leaderboard (open; B hidden)", () => view(C, "leaderboard", { task_id: tId }));
await expectFail("close_task before deadline", () => call(single(agentOwner), C, "close_task", { task_id: tId }, { gas: "50" }), "before deadline");

// ---------- 4. agent key + prepaid credit ----------
const fc = KeyPair.fromRandom("ed25519");
await step("agent: add function-call key (predict_task, predict → bursa)", () => agentOwner.signAndSendTransaction({ receiverId: agentOwner.accountId, actions: [actions.addFunctionCallAccessKey(fc.getPublicKey(), C, ["predict_task", "predict"], nearToYocto("1"))] }));
await step("agent owner: deposit_credit 0.02", () => call(agentOwner, C, "deposit_credit", {}, { deposit: nearToYocto("0.02"), gas: "30" }));
const agent = new Account(agentOwner.accountId, singleProvider, fc.toString());
await expectFail("agent predict_task before the task is closed", () => agent.signAndSendTransaction({ receiverId: C, actions: [actions.functionCall("predict_task", { task_id: tId, features: holdout[0].slice(0, -1) }, teraToGas("30"), 0n)] }), "task not closed");

// ---------- 5. close + predict ----------
const waitMs = Number(BigInt(deadline_ns) / 1_000_000n) - Date.now() + 3000;
if (waitMs > 0) { console.log(`waiting ${Math.ceil(waitMs / 1000)}s for the deadline...`); await sleep(waitMs); }
const winner = Number((await step("close_task (anyone)", () => call(agentOwner, C, "close_task", { task_id: tId }, { gas: "50" }))).result);
out.winner = winner;
await step("leaderboard (closed; B shown)", () => view(C, "leaderboard", { task_id: tId }));
let correct = 0;
for (let r = 0; r < 3; r++) {
  const s = await step(`agent (FC key) predict_task row ${r}`, () => agent.signAndSendTransaction({ receiverId: C, actions: [actions.functionCall("predict_task", { task_id: tId, features: holdout[r].slice(0, -1) }, teraToGas("20"), 0n)] }));
  const label = Number(s.result) > 0 ? 1 : 0; correct += label === holdout[r].at(-1) ? 1 : 0;
  out.steps.at(-1).label = label; out.steps.at(-1).truth = holdout[r].at(-1);
}
await expectFail("agent FC key: withdraw_credit", () => agent.signAndSendTransaction({ receiverId: C, actions: [actions.functionCall("withdraw_credit", { amount: nearToYocto("0.001").toString() }, teraToGas("30"), 0n)] }), "does not allow method");
await expectFail("agent FC key: deposit attached to predict_task", () => agent.signAndSendTransaction({ receiverId: C, actions: [actions.functionCall("predict_task", { task_id: tId, features: holdout[0].slice(0, -1) }, teraToGas("30"), 1n)] }), "Deposit is not allowed");
await expectFail("agent FC key: call another contract", () => agent.signAndSendTransaction({ receiverId: "wrap.testnet", actions: [actions.functionCall("ft_metadata", {}, teraToGas("10"), 0n)] }), "does not match transaction receiver");
await expectFail("predict with wrong feature count", () => call(single(agentOwner), C, "predict", { submission_id: winner, features: [1, 2, 3] }, { gas: "30" }), "feature count");
const winnerOwner = winner === sDeep ? p1 : p2;
const earned = await view(C, "get_earnings", { submission_id: winner });
await step("winner owner: withdraw_earnings", () => call(winnerOwner, C, "withdraw_earnings", { submission_id: winner }, { gas: "30" }));
out.steps.at(-1).earned_near = yoctoToNear(BigInt(earned), 4);
await expectFail("withdraw_earnings again (nothing left)", () => call(single(winnerOwner), C, "withdraw_earnings", { submission_id: winner }, { gas: "30" }), "nothing to withdraw");
await expectFail("withdraw_earnings by non-owner", () => call(single(p2 === winnerOwner ? p1 : p2), C, "withdraw_earnings", { submission_id: winner }, { gas: "30" }), "owner only");

// ---------- 6. summary / cleanup ----------
out.summary = { steps: out.steps.length, negatives_rejected: out.negatives.filter((n) => n.rejected).length, negatives_total: out.negatives.length, negatives_message_mismatch: out.negatives.filter((n) => n.rejected && n.matched === false).map((n) => n.name), winner, agent_correct: `${correct}/3`, scores_match_local: out.steps.filter((s) => s.score).every((s) => s.score.matches_local), elapsed_s: Math.round((Date.now() - T0) / 1000) };
console.log("\nSUMMARY", json(out.summary));
save();
} finally {
  if (CLEANUP) await cleanup(Object.keys(keys).filter((id) => id.includes(`-${TAG}.`)));
}
if (!out.summary) process.exit(1);
writeReport();

function writeReport() {
const md = `# E2E dari nol (T-3) — ${out.when}

Funder \`${out.funder}\` · kontrak baru \`${out.contract}\` · owner \`${out.owner}\` · peserta \`${out.p1}\`, \`${out.p2}\` · agent \`${out.agent}\` · evaluator \`${EVALUATOR_HASH.slice(0, 12)}…\` · ${out.summary.elapsed_s} s${CLEANUP ? " · akun dihapus di akhir (kontrak disapu, state besar tidak bisa dihapus), NEAR kembali ke funder" : ""}.

**Ringkasan:** ${out.summary.steps} langkah sukses, ${out.summary.negatives_rejected}/${out.summary.negatives_total} jalur negatif ditolak, skor TEE sama dengan lokal/Python: ${out.summary.scores_match_local}, pemenang submission ${out.winner}, agent benar ${out.summary.agent_correct}.

## Langkah
| # | langkah | Tgas total | hasil | tx |
|---|---|---|---|---|
${out.steps.map((s, i) => `| ${i + 1} | ${s.name} | ${s.total_tgas ?? "view"} | ${s.score ? `A ${s.score.a} / B ${s.score.b} (${s.score.matches_local ? "= lokal" : "≠"})` : s.label != null ? `label ${s.label} (asli ${s.truth})` : s.earned_near ? `${s.earned_near} NEAR` : typeof s.result === "string" ? s.result.slice(0, 40) : ""} | ${s.hash ? `\`${s.hash}\`` : ""} |`).join("\n")}

## Jalur negatif
| percobaan | ditolak | pesan |
|---|---|---|
${out.negatives.map((n) => `| ${n.name} | ${n.rejected ? (n.matched === false ? "ya (pesan beda)" : "ya") : "**TIDAK**"} | \`${(n.error || "").replace(/\|/g, "/").slice(0, 120)}\` |`).join("\n")}
`;
fs.writeFileSync(path.join(root, "docs", "E2E.md"), md);
console.log("wrote docs/E2E.md and tools/out/e2e.json");
}
