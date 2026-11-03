// I-1 — an AI agent that may only ask the winning model for predictions.
//
// 1. Agent account `agent.<funder>` (created once, saved to .env as AGENT_ACCOUNT_ID / AGENT_PRIVATE_KEY).
// 2. A function-call key limited to receiver = Bursa, methods = predict_task,predict, allowance 0.1 NEAR
//    (AGENT_FC_PRIVATE_KEY). This is the only key the agent process gets.
// 3. The owner (full key) prepays credit once with deposit_credit.
// 4. The agent (FC key) screens 10 applicants from public_holdout.csv through predict_task.
// 5. Negative checks with the FC key: withdraw_credit (method not allowed), predict with a deposit, a call to
//    another contract — all rejected by the protocol before any contract code runs.
//
//   node tools/agent.mjs <task_id> [--rows 10] [--funder FT|TEAM|MAIN]
// Writes tools/out/agent.json and docs/AGENT.md.
import fs from "node:fs";
import path from "node:path";
import { accountFromEnv, saveEnv, provider, view, call, summary, json, sleep, errMsg, root, here, Account, KeyPair, actions, teraToGas, nearToYocto, yoctoToNear } from "./lib.mjs";

const args = process.argv.slice(2);
const taskId = Number(args[0]);
if (!taskId) { console.log("usage: node tools/agent.mjs <task_id> [--rows 10] [--funder FT|TEAM|MAIN]"); process.exit(2); }
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const funders = { TEAM: ["TEAM_ACCOUNT_ID", "TEAM_PRIVATE_KEY"], FT: ["NEAR_FT_CONTRACT_ID", "NEAR_FT_CONTRACT_PRIVATE_KEY"], MAIN: ["NEAR_ACCOUNT_ID", "NEAR_PRIVATE_KEY"] };
const funder = accountFromEnv(...funders[opt("funder", process.env.TEAM_ACCOUNT_ID ? "TEAM" : "FT")]);
const C = process.env.BURSA_CONTRACT_ID || process.env.BURSA_DEV_ID;
const ROWS = Number(opt("rows", "10"));
const correctOf = () => out.summary?.correct ?? 0;
const out = { when: new Date().toISOString(), contract: C, task_id: taskId, calls: [], negatives: [] };
const save = () => fs.writeFileSync(path.join(here, "out", "agent.json"), json(out) + "\n");
/** Protocol error name + message. Negatives use a single JsonRpcProvider so the typed error is not wrapped
 *  in FailoverRpcProvider's RetriesExceeded. */
const deepErr = (e) => `${e?.constructor?.name ?? e?.type ?? "Error"} :: ${(e?.message ?? String(e)).slice(0, 200)}`;
const NEGATIVES_ONLY = args.includes("--negatives-only");
const prev = NEGATIVES_ONLY && fs.existsSync(path.join(here, "out", "agent.json")) ? JSON.parse(fs.readFileSync(path.join(here, "out", "agent.json"), "utf8")) : null;

const task = await view(C, "get_task", { task_id: taskId });
if (!task?.closed) throw new Error(`task ${taskId} is not closed yet (close it first)`);
console.log(`task ${taskId} "${task.title}" winner submission ${task.winner}`);

// 1) agent account (full key stays with the owner, never given to the agent process)
let agentOwner;
if (process.env.AGENT_ACCOUNT_ID) {
  agentOwner = accountFromEnv("AGENT_ACCOUNT_ID", "AGENT_PRIVATE_KEY");
} else {
  const kp = KeyPair.fromRandom("ed25519");
  const id = `agent.${funder.accountId}`;
  summary("create agent account", await funder.createSubAccount({ accountOrPrefix: "agent", publicKey: kp.getPublicKey(), nearToTransfer: nearToYocto("0.3") }));
  saveEnv({ AGENT_ACCOUNT_ID: id, AGENT_PRIVATE_KEY: kp.toString() });
  for (let i = 0; i < 10; i++) { try { await provider.viewAccount({ accountId: id }); break; } catch { await sleep(1500); } }
  agentOwner = new Account(id, provider, kp.toString());
}
const A = agentOwner.accountId;
out.agent = A;

// 2) function-call key: only Bursa, only predict_task/predict, 0.1 NEAR gas allowance
let fcKey;
if (process.env.AGENT_FC_PRIVATE_KEY) {
  fcKey = KeyPair.fromString(process.env.AGENT_FC_PRIVATE_KEY);
} else {
  fcKey = KeyPair.fromRandom("ed25519");
  const s = summary("add function-call key", await agentOwner.signAndSendTransaction({
    receiverId: A,
    actions: [actions.addFunctionCallAccessKey(fcKey.getPublicKey(), C, ["predict_task", "predict"], nearToYocto("0.1"))],
  }));
  out.add_key_tx = s.hash;
  saveEnv({ AGENT_FC_PRIVATE_KEY: fcKey.toString() });
  await sleep(1500);
}
const keyInfo = await provider.viewAccessKey({ accountId: A, publicKey: fcKey.getPublicKey().toString() });
out.fc_key = { public_key: fcKey.getPublicKey().toString(), permission: keyInfo.permission };
console.log("FC key permission:", json(keyInfo.permission));
const agent = new Account(A, provider, fcKey.toString()); // the agent process only ever holds this key

// 3) owner prepays credit (full key; FC keys cannot attach deposits)
const lines = fs.readFileSync(path.join(root, "tasks", task.slug, "public_holdout.csv"), "utf8").trim().split("\n");
let correct = 0;
if (prev) {
  Object.assign(out, { calls: prev.calls, summary: prev.summary, deposit_tx: prev.deposit_tx, add_key_tx: prev.add_key_tx ?? out.add_key_tx });
  correct = prev.summary?.correct ?? 0;
  console.log("--negatives-only: reusing", prev.calls.length, "recorded calls");
}
const credit0 = BigInt(await view(C, "get_credit", { account_id: A }));
if (!prev && credit0 < BigInt(nearToYocto("0.01"))) {
  const s = summary("deposit_credit (owner, full key)", await call(agentOwner, C, "deposit_credit", {}, { deposit: nearToYocto("0.05"), gas: "30" }));
  out.deposit_tx = s.hash;
}
const creditBefore = BigInt(await view(C, "get_credit", { account_id: A }));
const earningsBefore = BigInt(await view(C, "get_earnings", { submission_id: task.winner }));

// 4) screen applicants with the FC key
for (let r = 0; r < (prev ? 0 : ROWS); r++) {
  const cols = lines[r + 1].split(",").map(Number);
  const features = cols.slice(0, -1), truth = cols[cols.length - 1];
  const t0 = Date.now();
  const res = await agent.signAndSendTransaction({ receiverId: C, actions: [actions.functionCall("predict_task", { task_id: taskId, features }, teraToGas("30"), 0n)] });
  const s = summary(`predict_task row ${r}`, res);
  const score = Number(s.result), label = score > 0 ? 1 : 0;
  correct += label === truth ? 1 : 0;
  out.calls.push({ row: r, hash: s.hash, fn_tgas: s.fn_tgas, total_tgas: s.total_tgas, ms: Date.now() - t0, score, label, truth, decision: label ? "minta uang muka" : "tempo bayar 30 hari" });
  save();
}
if (!prev) {
  const creditAfter = BigInt(await view(C, "get_credit", { account_id: A }));
  const earningsAfter = BigInt(await view(C, "get_earnings", { submission_id: task.winner }));
  out.summary = { rows: ROWS, correct, fee_total_near: yoctoToNear(creditBefore - creditAfter, 4), owner_earned_near: yoctoToNear(earningsAfter - earningsBefore, 4), avg_fn_tgas: +(out.calls.reduce((a, c) => a + c.fn_tgas, 0) / ROWS).toFixed(3) };
}
console.log("\nsummary:", json(out.summary));

// 5) negatives: the same FC key must be useless for anything else (single provider → typed protocol errors)
const { JsonRpcProvider } = await import("near-api-js");
const agent1 = new Account(A, new JsonRpcProvider({ url: "https://rpc.testnet.fastnear.com" }), fcKey.toString());
out.negatives = [];
const neg = async (label, fn) => {
  try { const r = await fn(); out.negatives.push({ label, allowed: true, hash: r?.transaction?.hash }); console.log(`[UNEXPECTED ALLOWED] ${label}`); }
  catch (e) { const d = deepErr(e); out.negatives.push({ label, allowed: false, error: d }); console.log(`[rejected] ${label}: ${d.slice(0, 160)}`); }
  save();
};
await neg("FC key calls withdraw_credit (method not in key)", () => agent1.signAndSendTransaction({ receiverId: C, actions: [actions.functionCall("withdraw_credit", { amount: nearToYocto("0.001").toString() }, teraToGas("30"), 0n)] }));
await neg("FC key attaches a deposit to predict_task", () => agent1.signAndSendTransaction({ receiverId: C, actions: [actions.functionCall("predict_task", { task_id: taskId, features: lines[1].split(",").map(Number).slice(0, -1) }, teraToGas("30"), 1n)] }));
await neg("FC key calls another contract (wrap.testnet)", () => agent1.signAndSendTransaction({ receiverId: "wrap.testnet", actions: [actions.functionCall("ft_metadata", {}, teraToGas("10"), 0n)] }));
await neg("FC key transfers NEAR", () => agent1.signAndSendTransaction({ receiverId: funder.accountId, actions: [actions.transfer(nearToYocto("0.001"))] }));

// 6) docs/AGENT.md
const md = `# Agent dengan function-call key (I-1) — ${out.when}

Kontrak \`${C}\`, tugas ${taskId} (\`${task.slug}\`), pemenang submission ${task.winner}. Agent \`${A}\`.

**Kunci yang dipegang proses agent:** \`${out.fc_key.public_key}\` dengan izin
\`\`\`json
${json(out.fc_key.permission)}
\`\`\`
Pemilik menyetor kredit sekali dengan full-access key (\`deposit_credit\`${out.deposit_tx ? `, tx \`${out.deposit_tx}\`` : ""}); agent tidak pernah memegang kunci itu.

## ${ROWS} pemohon dari \`public_holdout.csv\` lewat \`predict_task\`

| # | skor mentah | label | label asli | keputusan simulasi | Tgas fungsi | tx |
|---|---|---|---|---|---|---|
${out.calls.map((c) => `| ${c.row} | ${c.score} | ${c.label} | ${c.truth} | ${c.decision} | ${c.fn_tgas} | \`${c.hash}\` |`).join("\n")}

Benar ${out.summary.correct}/${out.summary.rows} · rata-rata **${out.summary.avg_fn_tgas} Tgas** per panggilan · fee total ${out.summary.fee_total_near} NEAR dipotong dari kredit agent · pemilik model menerima ${out.summary.owner_earned_near} NEAR (\`withdraw_earnings\`).

## Yang ditolak protokol untuk kunci yang sama (sebelum kode kontrak berjalan)

| Percobaan | Hasil |
|---|---|
${out.negatives.map((n) => `| ${n.label} | ${n.allowed ? "**DIIZINKAN (tak terduga)**" : "ditolak: `" + n.error.split(" :: ")[0] + "`"} |`).join("\n")}

Keputusan "tempo bayar" / "uang muka" hanya ilustrasi dalam simulasi (lihat \`tasks/german-credit/README.md\`, batasan dataset).
`;
fs.writeFileSync(path.join(root, "docs", "AGENT.md"), md);
console.log("\nwrote docs/AGENT.md and tools/out/agent.json");
