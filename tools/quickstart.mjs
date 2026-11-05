#!/usr/bin/env node
// Quickstart — from a funded NEAR testnet account to a TEE-scored entry in one command.
//
//   node tools/quickstart.mjs [--task 5] [--trees 20 --depth 2 --lr 0.1] [--model path/to/model.pkl] [--dry]
//                             [--as PREFIX]      # which .env account: PREFIX_ACCOUNT_ID / PREFIX_PRIVATE_KEY (default NEAR)
//
// What it does, printing every step: checks Python + scikit-learn, your account balance, the task (open? entries left?),
// trains a small gradient-boosted-tree model on the task's PUBLIC data (or takes your pickle), exports it to the contract's
// integer format, asks the contract to validate the bytes and quote the storage cost, then (unless --dry) stores the model
// on-chain (submit_model), requests a score from the TEE evaluator (request_score) and waits for the reading on split A.
// Costs: storage (about 1 NEAR per 100 KB of model, so a few cents of NEAR for a small one) + the task's submission fee
// (0.1 NEAR) + 0.1 NEAR deposited for the TEE run (the unused part comes back) + gas. Keep 0.5 NEAR free to be safe.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { accountFromEnv, provider, view, call, summary, root, datasetDir, nearToYocto, yoctoToNear, errMsg } from "./lib.mjs";

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const TASK = Number(opt("task", "5"));
const PREFIX = opt("as", "NEAR");
const DRY = args.includes("--dry");
const C = process.env.BURSA_CONTRACT_ID || "laurel.laurel-team-mw0x0c8g.testnet";
const SITE = "https://laurel-near.vercel.app";
const PY = process.env.PYTHON || (process.platform === "win32" ? "python" : "python3");
const step = (n, s) => console.log(`\n[${n}/8] ${s}`);
const die = (m) => { console.log(`\n✗ ${m}`); process.exit(1); };
const py = (argv, label) => {
  const r = spawnSync(PY, ["-I", ...argv], { cwd: root, encoding: "utf8", env: { ...process.env, PYTHONIOENCODING: "utf-8" } });
  if (r.status !== 0) die(`${label} failed:\n${(r.stderr || r.stdout).slice(-1500)}`);
  return r.stdout;
};

try {
  step(1, "environment");
  const v = spawnSync(PY, ["-c", "import sklearn, pandas, numpy; print(sklearn.__version__)"], { encoding: "utf8" });
  if (v.status !== 0) die(`Python with scikit-learn, pandas and numpy is needed (${PY}): pip install scikit-learn pandas numpy`);
  console.log(`  ${PY} ok, scikit-learn ${v.stdout.trim()}; node ${process.version}; contract ${C}`);

  step(2, `your account (${PREFIX}_ACCOUNT_ID / ${PREFIX}_PRIVATE_KEY in .env)`);
  const me = accountFromEnv(`${PREFIX}_ACCOUNT_ID`, `${PREFIX}_PRIVATE_KEY`);
  const acc = await provider.query({ request_type: "view_account", finality: "final", account_id: me.accountId });
  const bal = BigInt(acc.amount);
  console.log(`  ${me.accountId}: ${yoctoToNear(bal, 3)} NEAR`);
  if (bal < nearToYocto("0.4")) die("keep at least 0.4 NEAR free (storage + 0.1 fee + 0.1 TEE deposit + gas). Testnet NEAR is free: see docs/QUICKSTART.md");

  step(3, `task ${TASK}`);
  const task = await view(C, "get_task", { task_id: TASK });
  if (!task) die(`task ${TASK} does not exist on ${C}`);
  const deadline = new Date(Number(BigInt(task.deadline_ns) / 1_000_000n));
  console.log(`  "${task.title}" · slug ${task.slug} · ${task.n_features} features · ${task.closed ? "CLOSED" : `open until ${deadline.toISOString().replace("T", " ").slice(0, 16)} UTC`}`);
  if (task.closed) die("this task is closed; pick an open one: node -e \"...\" or see the site " + SITE);
  const mine = (await view(C, "list_submissions", { task_id: TASK })).filter((s) => s.owner === me.accountId);
  console.log(`  entries by you so far: ${mine.length} of ${task.max_per_account}` + (mine.length ? ` (${mine.map((s) => `#${s.submission_id}: ${s.score_a_bps ?? "pending"} bps`).join(", ")})` : ""));
  if (mine.length >= task.max_per_account) die("no entries left on this account for this task");
  const dsDir = datasetDir(task);            // absolute path of tasks/<folder>
  const ds = path.basename(dsDir);
  if (!fs.existsSync(path.join(dsDir, "features.json"))) die(`dataset folder tasks/${ds} not found; git pull`);

  step(4, "model");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  let pkl = opt("model");
  if (pkl) { if (!fs.existsSync(pkl)) die(`${pkl} not found`); console.log(`  using your pickle ${pkl}`); }
  else {
    const trees = opt("trees", "20"), depth = opt("depth", "2"), lr = opt("lr", "0.1");
    const out = `quickstart_${stamp}.pkl`;
    console.log(`  training on tasks/${ds}/public_train.csv: ${trees} trees × depth ${depth}, lr ${lr}`);
    const o = py([path.join("tasks", ds, "train.py"), "--trees", trees, "--depth", depth, "--lr", lr, "--out", out], "training");
    const m = o.match(/"holdout_balanced_accuracy": ([\d.]+)/); console.log(`  holdout balanced accuracy (float model): ${m ? m[1] : "?"}`);
    pkl = path.join("tasks", ds, out);
  }

  step(5, "export to the contract's integer format");
  const outDir = path.join("tasks", ds, "out", `quickstart_${stamp}`);
  py([path.join("tools", "export.py"), "--task", ds, "--model", pkl, "--out", outDir], "export");
  const rep = JSON.parse(fs.readFileSync(path.join(root, outDir, "report.json"), "utf8"));
  const bin = path.join(root, outDir, "model.bin");
  const bytes = fs.readFileSync(bin);
  console.log(`  ${outDir}/model.bin: ${bytes.length} bytes, ${rep.trees} trees, ${rep.nodes} nodes; integer model on holdout: ${rep.integer_model_on_eval_rows?.bal_acc_bps} bps`);

  step(6, "validate with the contract and quote the cost");
  const val = await view(C, "validate_model", { task_id: TASK, bytes: bytes.toString("base64") });
  if (!val.ok) die(`the contract rejected the bytes: ${JSON.stringify(val)}`);
  const deposit = BigInt(val.storage_cost) + BigInt(task.submission_fee) + nearToYocto("0.02");
  console.log(`  ok · storage ${yoctoToNear(val.storage_cost, 4)} NEAR + fee ${yoctoToNear(task.submission_fee, 2)} NEAR (+0.02 slack, refunded) = ${yoctoToNear(deposit, 4)} NEAR, plus 0.1 NEAR deposited for the TEE run (unused part refunded)`);
  if (DRY) { console.log("\n--dry: stopping before anything is sent. Re-run without --dry to enter."); process.exit(0); }

  step(7, "enter: submit_model, then request_score (TEE)");
  const r1 = await call(me, C, "submit_model", { task_id: TASK, bytes: bytes.toString("base64") }, { deposit, gas: "150" });
  const s1 = summary("submit_model", r1);
  if (!s1.ok) die("submit_model failed (see above)");
  const id = Number(s1.result);
  console.log(`  submission #${id} stored · ${s1.explorer}`);
  const t0 = Date.now();
  const r2 = await call(me, C, "request_score", { submission_id: id }, { deposit: nearToYocto("0.1"), gas: "300" });
  const s2 = summary("request_score", r2);
  if (!s2.ok) die("request_score failed (see above)");
  let sub = await view(C, "get_submission", { submission_id: id });
  while (sub.status !== "Scored" && !(typeof sub.status === "object" && sub.status.Failed) && Date.now() - t0 < 240_000) {
    await new Promise((r) => setTimeout(r, 4000)); sub = await view(C, "get_submission", { submission_id: id });
  }

  step(8, "result");
  if (sub.status !== "Scored") die(`not scored yet: ${JSON.stringify(sub.status)} — check later: node -e "..." or ${SITE}/#/model/${id}`);
  const lb = (await view(C, "leaderboard", { task_id: TASK })).filter((r) => r.score_a_bps != null).sort((a, b) => b.score_a_bps - a.score_a_bps);
  const rank = lb.findIndex((r) => r.submission_id === id) + 1;
  console.log(`  split A (TEE, pinned evaluator ${String(sub.scored_by).slice(0, 8)}…): ${sub.score_a_bps} bps balanced accuracy, F1 ${sub.f1_a_bps} bps`);
  console.log(`  rank ${rank} of ${lb.length} on split A (ties share a score); split B stays sealed until ${deadline.toISOString().slice(0, 16).replace("T", " ")} UTC and decides the champion`);
  console.log(`  leaderboard: ${lb.map((r) => `#${r.submission_id} ${r.score_a_bps}${r.submission_id === id ? " ← you" : ""}`).join(" · ")}`);
  console.log(`\n  see it: ${SITE}/#/model/${id}   (exhibit: ${SITE}/#/task/${TASK})`);
  console.log(`  txs: submit ${s1.explorer}\n       score  ${s2.explorer}`);
  console.log(`\n  entries left on this account: ${task.max_per_account - mine.length - 1}. Different trees/depth/lr, or your own pickle with --model.`);
} catch (e) {
  die(errMsg(e));
}
