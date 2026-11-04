// I-2 — deploy the example consumer contract (credit-desk) and let it screen applicants by calling
// bursa.predict_task through a cross-contract promise. The desk pays fees from its own prepaid credit.
//   node tools/consumer.mjs <task_id> [--funder NFT|FT|TEAM] [--rows 0,1,3]
// Writes tools/out/consumer.json and docs/CONSUMER.md.
import fs from "node:fs";
import path from "node:path";
import { accountFromEnv, saveEnv, provider, view, call, summary, json, sleep, errMsg, root, here, Account, KeyPair, actions, teraToGas, nearToYocto, yoctoToNear, datasetDir } from "./lib.mjs";

const args = process.argv.slice(2);
const taskId = Number(args[0]);
if (!taskId) { console.log("usage: node tools/consumer.mjs <task_id> [--funder NFT|FT|TEAM] [--rows 0,1,3]"); process.exit(2); }
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const funders = { TEAM: ["TEAM_ACCOUNT_ID", "TEAM_PRIVATE_KEY"], FT: ["NEAR_FT_CONTRACT_ID", "NEAR_FT_CONTRACT_PRIVATE_KEY"], NFT: ["NEAR_NFT_CONTRACT_ID", "NEAR_NFT_CONTRACT_PRIVATE_KEY"] };
const funder = accountFromEnv(...funders[opt("funder", process.env.TEAM_ACCOUNT_ID ? "TEAM" : "NFT")]);
const C = process.env.BURSA_CONTRACT_ID || process.env.BURSA_DEV_ID;
const WASM = path.join(root, "wasm", "credit_desk.wasm");
const rows = opt("rows", "0,1,3").split(",").map(Number);
const out = { when: new Date().toISOString(), bursa: C, task_id: taskId, screens: [] };
const save = () => fs.writeFileSync(path.join(here, "out", "consumer.json"), json(out) + "\n");

const task = await view(C, "get_task", { task_id: taskId });
if (!task?.closed) throw new Error(`task ${taskId} must be closed (winner needed)`);

// 1) desk account + deploy. A desk is bound at `new` to one bursa contract + task, so reuse the saved one only
//    when it points at THIS contract and task; otherwise create a fresh desk (desk<taskId>.<funder>).
let desk = null;
if (process.env.DESK_ACCOUNT_ID) {
  try {
    const cfg = await view(process.env.DESK_ACCOUNT_ID, "get_config");
    if (cfg[1] === C && cfg[2] === taskId) desk = accountFromEnv("DESK_ACCOUNT_ID", "DESK_PRIVATE_KEY");
    else console.log(`saved desk ${process.env.DESK_ACCOUNT_ID} is bound to ${cfg[1]} task ${cfg[2]}; creating a new one for ${C} task ${taskId}`);
  } catch { console.log("saved desk not readable; creating a new one"); }
}
if (!desk) {
  const kp = KeyPair.fromRandom("ed25519");
  const prefix = `desk${taskId}`;
  const id = `${prefix}.${funder.accountId}`;
  saveEnv({ DESK_ACCOUNT_ID: id, DESK_PRIVATE_KEY: kp.toString() }); // save before the tx
  summary("create desk account", await funder.createSubAccount({ accountOrPrefix: prefix, publicKey: kp.getPublicKey(), nearToTransfer: nearToYocto("1.8") }));
  for (let i = 0; i < 10; i++) { try { await provider.viewAccount({ accountId: id }); break; } catch { await sleep(1500); } }
  desk = new Account(id, provider, kp.toString());
}
const D = desk.accountId;
out.desk = D;
const st = await provider.viewAccount({ accountId: D });
const wasm = fs.readFileSync(WASM);
if (st.code_hash === "11111111111111111111111111111111") {
  const s = summary("deploy credit-desk + new", await desk.signAndSendTransaction({
    receiverId: D,
    actions: [actions.deployContract(new Uint8Array(wasm)), actions.functionCall("new", { owner: funder.accountId, bursa: C, task_id: taskId }, teraToGas("30"), 0n)],
  }));
  out.deploy_tx = s.hash; out.wasm_bytes = wasm.length;
} else console.log("desk already deployed");

// 2) fund: desk forwards the deposit to bursa.deposit_credit → credit belongs to the desk account
const credit0 = BigInt(await view(C, "get_credit", { account_id: D }));
if (credit0 < BigInt(nearToYocto("0.005"))) {
  const s = summary("fund (owner → desk → bursa.deposit_credit)", await call(funder, D, "fund", {}, { deposit: nearToYocto("0.02"), gas: "50" }));
  out.fund_tx = s.hash;
}
out.desk_credit_before = yoctoToNear(BigInt(await view(C, "get_credit", { account_id: D })), 4);

// 3) screen applicants: anyone may call; the desk's own credit pays
const lines = fs.readFileSync(path.join(datasetDir(task), "public_holdout.csv"), "utf8").trim().split("\n");
for (const r of rows) {
  const cols = lines[r + 1].split(",").map(Number);
  const features = cols.slice(0, -1), truth = cols[cols.length - 1];
  const applicant = `holdout-${r}`;
  const s = summary(`screen ${applicant}`, await call(funder, D, "screen", { applicant, features }, { gas: "100" }));
  let decision = null; try { decision = JSON.parse(s.result); } catch {}
  out.screens.push({ applicant, hash: s.hash, total_tgas: s.total_tgas, outcome: decision?.outcome, score: decision?.score, truth });
  save();
}
out.desk_credit_after = yoctoToNear(BigInt(await view(C, "get_credit", { account_id: D })), 4);
out.recent = await view(D, "recent_decisions", { limit: 10 });
out.winner_calls = (await view(C, "get_submission", { submission_id: task.winner })).calls;
save();
console.log("\nrecent_decisions:", json(out.recent));

// 4) a screen with the wrong feature count must land as Outcome::Error (callback handles the failed promise)
const s = summary("screen with 3 features (expect Error outcome)", await call(funder, D, "screen", { applicant: "bad-input", features: [1, 2, 3] }, { gas: "100" }));
let bad = null; try { bad = JSON.parse(s.result); } catch {}
out.bad_input = { hash: s.hash, outcome: bad?.outcome };
save();

const md = `# Kontrak konsumen contoh: credit-desk (I-2) — ${out.when}

\`${D}\` (wasm ${out.wasm_bytes ?? "—"} B${out.deploy_tx ? `, deploy \`${out.deploy_tx}\`` : ""}) memanggil \`${C}.predict_task(${taskId}, features)\` lewat promise lintas-kontrak dan memutuskan di callback \`on_prediction\`. Fee dibayar dari kredit prabayar milik **kontrak desk sendiri** (\`fund\` → \`bursa.deposit_credit\`${out.fund_tx ? `, tx \`${out.fund_tx}\`` : ""}); kredit desk ${out.desk_credit_before} → ${out.desk_credit_after} NEAR.

| pemohon | skor dari model | keputusan desk (simulasi) | label asli | Tgas total (desk + bursa + callback) | tx |
|---|---|---|---|---|---|
${out.screens.map((x) => `| ${x.applicant} | ${x.score} | ${typeof x.outcome === "string" ? x.outcome : JSON.stringify(x.outcome)} | ${x.truth} | ${x.total_tgas} | \`${x.hash}\` |`).join("\n")}
| bad-input (3 fitur) | — | ${JSON.stringify(out.bad_input.outcome)} | — | — | \`${out.bad_input.hash}\` |

Pemenang tugas kini tercatat ${out.winner_calls} panggilan. Keputusan "Approve / RequireDeposit" hanya ilustrasi simulasi (lihat batasan dataset di \`tasks/german-credit/README.md\`).

Kode: \`contracts/consumer-example/src/lib.rs\` (≈120 baris, 3 unit test). Pola yang sama berlaku untuk kontrak mana pun: \`ext_bursa::ext(bursa).with_static_gas(30 Tgas).predict_task(task_id, features).then(callback)\`.
`;
fs.writeFileSync(path.join(root, "docs", "CONSUMER.md"), md);
console.log("\nwrote docs/CONSUMER.md and tools/out/consumer.json");
