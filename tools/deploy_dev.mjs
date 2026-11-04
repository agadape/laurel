// C-6 / Checkpoint M1 — deploy `bursa` to a dev sub-account funded from a spike account, run the whole
// journey once with the S30 spike evaluator (hash dcc4…, secret profile `default` of the main spike account),
// and measure gas. Idempotent where it can be (dev account + deployment are reused via .env).
//
//   node tools/deploy_dev.mjs            # full run (takes ~4 min: waits for a 2-minute task deadline)
//
// Writes tools/out/deploy_dev.json and docs/GAS.md.
import fs from "node:fs";
import path from "node:path";
import { accountFromEnv, saveEnv, provider, view, call, summary, json, sleep, errMsg, root, here, Account, KeyPair, nearToYocto, yoctoToNear, actions, teraToGas, OUTLAYER } from "./lib.mjs";

const EVALUATOR_URL = "https://nh-spike-wasm.vercel.app/dcc4aa66c31fc634e43514accf2b46e111fa5243b3288f7a951d48268b9456c6.wasm";
const EVALUATOR_HASH = "dcc4aa66c31fc634e43514accf2b46e111fa5243b3288f7a951d48268b9456c6";
const WASM = path.join(root, "wasm", "bursa.wasm");
const SMALL = path.join(root, "tools", "out", "gasprobe", "model.bin"); // 50×4, 8 features, ~33 KB
const BIG = path.join(root, "spikes", "s31", "out", "model.bin"); // 100×6, 8 features, ~197 KB
const VECTORS = JSON.parse(fs.readFileSync(path.join(root, "tools", "out", "gasprobe", "vectors.json"), "utf8"));
const DEADLINE_SEC = 120;

const funder = accountFromEnv("NEAR_FT_CONTRACT_ID", "NEAR_FT_CONTRACT_PRIVATE_KEY"); // participant + task creator
const agent = accountFromEnv("NEAR_ACCOUNT_ID", "NEAR_PRIVATE_KEY"); // main spike account = secrets owner + agent
const out = { when: new Date().toISOString(), steps: {} };
const save = () => fs.writeFileSync(path.join(here, "out", "deploy_dev.json"), json(out) + "\n");

async function step(name, fn) {
  try {
    const r = await fn();
    const s = r?.transaction ? summary(name, r) : (console.log(`${name} ->`, json(r).slice(0, 600)), { ok: true, value: r });
    out.steps[name] = s;
    save();
    if (s.ok === false) throw new Error(`${name} failed: ${json(s.failure)}`);
    return s;
  } catch (e) {
    console.log(`[ERR] ${name}: ${errMsg(e)}`);
    out.steps[name] = { ok: false, error: errMsg(e) };
    save();
    throw e;
  }
}

// 1) dev contract account
let dev;
if (process.env.BURSA_DEV_ID) {
  dev = accountFromEnv("BURSA_DEV_ID", "BURSA_DEV_PRIVATE_KEY");
} else {
  const kp = KeyPair.fromRandom("ed25519");
  const id = `bursa-dev.${funder.accountId}`;
  await step("create dev account", () => funder.createSubAccount({ accountOrPrefix: "bursa-dev", publicKey: kp.getPublicKey(), nearToTransfer: nearToYocto("4") }));
  saveEnv({ BURSA_DEV_ID: id, BURSA_DEV_PRIVATE_KEY: kp.toString() });
  for (let i = 0; i < 10; i++) { try { await provider.viewAccount({ accountId: id }); break; } catch { await sleep(1500); } }
  dev = new Account(id, provider, kp.toString());
}
const C = dev.accountId;
out.contract = C;
console.log("contract account:", C);

// 2) deploy + init (redeploy allowed: state is reset only if `new` succeeds on a fresh state; else keep)
const st = await provider.viewAccount({ accountId: C });
const wasm = fs.readFileSync(WASM);
if (st.code_hash === "11111111111111111111111111111111") {
  await step("deploy+new", () => dev.signAndSendTransaction({
    receiverId: C,
    actions: [actions.deployContract(new Uint8Array(wasm)), actions.functionCall("new", { owner: funder.accountId, outlayer: OUTLAYER, evaluator_url: EVALUATOR_URL, evaluator_hash: EVALUATOR_HASH }, teraToGas("50"), 0n)],
  }));
} else {
  console.log("code already deployed; skipping deploy (delete BURSA_DEV_* from .env for a fresh account)");
}
const acct = await provider.viewAccount({ accountId: C });
out.contract_storage_bytes = acct.storage_usage;
console.log(`storage ${acct.storage_usage} B (~${(acct.storage_usage / 1e5).toFixed(2)} NEAR locked), balance ${yoctoToNear(acct.amount, 3)}`);
await step("get_config", () => view(C, "get_config"));

// 3) task (8 features, like the probe models; secrets = spike profile `default` on the agent/main account)
const deadlineNs = (BigInt(Date.now() + DEADLINE_SEC * 1000) * 1_000_000n).toString();
const taskIdStr = await step("create_task", () => call(funder, C, "create_task", {
  title: "Gas probe (synthetic)", slug: `gas-probe-${Date.now().toString(36)}`, description_url: "https://github.com/agadape/laurel",
  n_features: 8, feature_names: ["f0", "f1", "f2", "f3", "f4", "f5", "f6", "f7"],
  secrets_account: agent.accountId, secrets_profile: "default", deadline_ns: deadlineNs,
  fee_per_call: nearToYocto("0.001").toString(), submission_fee: nearToYocto("0.1").toString(), max_per_account: 3,
}, { deposit: nearToYocto("0.05"), gas: "50" }));
const taskId = Number(taskIdStr.result);
out.task_id = taskId;

// 4) submissions: small (33 KB) and big (197 KB)
const small = fs.readFileSync(SMALL);
const big = fs.readFileSync(BIG);
await step("validate_model small", () => view(C, "validate_model", { task_id: taskId, bytes: small.toString("base64") }));
const sSmall = await step("submit_model small", () => call(funder, C, "submit_model", { task_id: taskId, bytes: small.toString("base64") }, { deposit: nearToYocto("0.6"), gas: "100" }));
const sBig = await step("submit_model big", () => call(funder, C, "submit_model", { task_id: taskId, bytes: big.toString("base64") }, { deposit: nearToYocto("2.2"), gas: "150" }));
const idSmall = Number(sSmall.result), idBig = Number(sBig.result);
out.submission_small = idSmall; out.submission_big = idBig;

// 5) scoring through OutLayer with the spike evaluator (Checkpoint M1)
for (const [label, id] of [["request_score small", idSmall], ["request_score big", idBig]]) {
  const t0 = Date.now();
  const s = await step(label, () => call(funder, C, "request_score", { submission_id: id }, { deposit: nearToYocto("0.1"), gas: "300" }));
  s.latency_ms = Date.now() - t0;
  const sub = await view(C, "get_submission", { submission_id: id });
  console.log(label, "->", json({ status: sub.status, a: sub.score_a_bps, b: sub.score_b_bps, raw: sub.last_outlayer_raw?.slice(0, 160) }));
  out.steps[label].status = sub.status; out.steps[label].score_a_bps = sub.score_a_bps; out.steps[label].score_b_bps = sub.score_b_bps;
  save();
}
await step("leaderboard (open)", () => view(C, "leaderboard", { task_id: taskId }));

// 6) agent prepays and calls predict on both models (gas per call)
await step("deposit_credit (agent)", () => call(agent, C, "deposit_credit", {}, { deposit: nearToYocto("0.02"), gas: "30" }));
const x = VECTORS.rows[0].x;
for (const [label, id] of [["predict small", idSmall], ["predict big", idBig]]) {
  const s = await step(label, () => call(agent, C, "predict", { submission_id: id, features: x }, { deposit: 0n, gas: "50" }));
  if (id === idSmall) s.python_raw = VECTORS.rows[0].raw;
}
save();

// 7) wait for the deadline, close, predict_task
const waitMs = Number(BigInt(deadlineNs) / 1_000_000n) - Date.now() + 3000;
if (waitMs > 0) { console.log(`waiting ${Math.ceil(waitMs / 1000)}s for the task deadline...`); await sleep(waitMs); }
await step("close_task", () => call(agent, C, "close_task", { task_id: taskId }, { gas: "50" }));
await step("leaderboard (closed)", () => view(C, "leaderboard", { task_id: taskId }));
for (let i = 0; i < 3; i++) await step(`predict_task #${i + 1}`, () => call(agent, C, "predict_task", { task_id: taskId, features: VECTORS.rows[i].x }, { gas: "50" }));
await step("get_earnings winner", async () => ({ small: await view(C, "get_earnings", { submission_id: idSmall }), big: await view(C, "get_earnings", { submission_id: idBig }) }));
await step("get_credit agent", () => view(C, "get_credit", { account_id: agent.accountId }));

// 8) GAS.md
const g = (k) => out.steps[k] ?? {};
const md = `# Biaya gas terukur (C-6) — ${out.when}

Kontrak: \`${C}\` (wasm ${wasm.length} B, storage akun ${out.contract_storage_bytes} B ≈ ${(out.contract_storage_bytes / 1e5).toFixed(2)} NEAR terkunci). Evaluator: spike S30 (\`${EVALUATOR_HASH.slice(0, 8)}…\`). Model probe **sintetis** (\`make_classification\`), hanya untuk mengukur gas; bukan model demo.

| Langkah | Model | Tgas total | Tgas receipt fungsi | Tx |
|---|---|---|---|---|
| \`create_task\` | — | ${g("create_task").total_tgas} | ${g("create_task").fn_tgas} | \`${g("create_task").hash}\` |
| \`submit_model\` | 50×4, ${small.length} B | ${g("submit_model small").total_tgas} | ${g("submit_model small").fn_tgas} | \`${g("submit_model small").hash}\` |
| \`submit_model\` | 100×6, ${big.length} B | ${g("submit_model big").total_tgas} | ${g("submit_model big").fn_tgas} | \`${g("submit_model big").hash}\` |
| \`request_score\` (+OutLayer+callback) | 50×4 | ${g("request_score small").total_tgas} | — | \`${g("request_score small").hash}\` (${g("request_score small").latency_ms} ms, status ${json(g("request_score small").status)}, A ${g("request_score small").score_a_bps} / B ${g("request_score small").score_b_bps}) |
| \`request_score\` (+OutLayer+callback) | 100×6 | ${g("request_score big").total_tgas} | — | \`${g("request_score big").hash}\` (${g("request_score big").latency_ms} ms, A ${g("request_score big").score_a_bps} / B ${g("request_score big").score_b_bps}) |
| \`predict\` | 50×4 | ${g("predict small").total_tgas} | **${g("predict small").fn_tgas}** | \`${g("predict small").hash}\` (skor ${g("predict small").result}, Python ${g("predict small").python_raw}) |
| \`predict\` | 100×6 | ${g("predict big").total_tgas} | **${g("predict big").fn_tgas}** | \`${g("predict big").hash}\` |
| \`close_task\` | — | ${g("close_task").total_tgas} | ${g("close_task").fn_tgas} | \`${g("close_task").hash}\` |
| \`predict_task\` ×3 | pemenang | ${["#1", "#2", "#3"].map((k) => g(`predict_task ${k}`).total_tgas).join(" / ")} | ${["#1", "#2", "#3"].map((k) => g(`predict_task ${k}`).fn_tgas).join(" / ")} | \`${g("predict_task #1").hash}\` … |

Biaya storage: 1 NEAR per 100 KB model (dipotong presisi dari deposit pengirim). Kriteria C-6 (\`predict\` ≤ 8 Tgas untuk model ≤ 60 KB): **${g("predict small").fn_tgas <= 8 ? "lolos" : "tidak lolos"}** (${g("predict small").fn_tgas} Tgas).
`;
fs.writeFileSync(path.join(root, "docs", "GAS.md"), md);
console.log("\nwrote docs/GAS.md and tools/out/deploy_dev.json");
