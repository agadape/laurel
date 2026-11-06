// Contract state for the page. Live first; a snapshot of the same views answers if RPC is slow, so the wall never waits.
// Open tasks are read through `leaderboard` only: split B stays out of this file on purpose.
import { decodeModel, b64ToBytes } from "../model.js";
import { view, contractId, DEFAULT_CONTRACT } from "../rpc.js";

async function live() {
  const [tasks, config, evaluator] = await Promise.all([view("list_tasks", { from: 0, limit: 50 }), view("get_config"), view("get_evaluator")]);
  const boards = {}, bytes = {};
  await Promise.all(tasks.map(async (t) => {
    const rows = await view("leaderboard", { task_id: t.task_id });
    boards[t.task_id] = rows;
    await Promise.all(rows.map(async (r) => { bytes[r.submission_id] = await view("get_model_bytes", { submission_id: r.submission_id }); }));
  }));
  const champ = tasks.filter((t) => t.closed && t.winner != null).pop();
  const earned = champ ? { id: champ.winner, yocto: await view("get_earnings", { submission_id: champ.winner }) } : null;
  return { tasks, config, evaluator, boards, bytes, earned, live: true };
}

// The page is built as HTML strings, and `?contract=` lets any contract supply these values, so contract text is
// escaped and numbers are forced to numbers here, once, before anything is rendered.
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const num = (x) => (x == null ? null : Number.isFinite(Number(x)) ? Number(x) : null);
const digits = (s) => (/^\d+$/.test(String(s ?? "")) ? String(s) : "0");
const cleanRow = (r) => ({ ...r, submission_id: num(r.submission_id), score_a_bps: num(r.score_a_bps), score_b_bps: num(r.score_b_bps), bytes: num(r.bytes), trees: num(r.trees), calls: num(r.calls) });
const clean = (raw) => ({
  ...raw,
  config: { ...raw.config, task_count: num(raw.config?.task_count), submission_count: num(raw.config?.submission_count) },
  evaluator: [esc(raw.evaluator?.[0]), esc(raw.evaluator?.[1])],
  tasks: raw.tasks.map((t) => ({ ...t, task_id: num(t.task_id), winner: num(t.winner), n_features: num(t.n_features), submission_count: num(t.submission_count), title: esc(t.title), slug: esc(t.slug), deadline_ns: digits(t.deadline_ns), fee_per_call: digits(t.fee_per_call) })),
  boards: Object.fromEntries(Object.entries(raw.boards || {}).map(([k, rows]) => [k, (rows || []).map(cleanRow)])),
  earned: raw.earned ? { id: num(raw.earned.id), yocto: digits(raw.earned.yocto) } : null,
  taken_at: esc(raw.taken_at),
});

const shape = (dirty) => {
  const raw = clean(dirty);
  const tasks = raw.tasks.map((t) => ({
    ...t,
    board: raw.boards[t.task_id] || [],
    models: (raw.boards[t.task_id] || []).map((r) => ({ id: r.submission_id, model: decodeModel(b64ToBytes(raw.bytes[r.submission_id])), rawB64: raw.bytes[r.submission_id] })).sort((a, b) => a.id - b.id),
  }));
  return { ...raw, tasks };
};

export async function loadData(wait = 2600) {
  const timeout = new Promise((_, no) => setTimeout(() => no(new Error("slow")), wait));
  try { return shape(await Promise.race([live(), timeout])); }
  catch {
    if (contractId() !== DEFAULT_CONTRACT) throw new Error("contract unreachable");
    const snapshot = await fetch(`${import.meta.env.BASE_URL}aset/snapshot.json`).then((r) => r.json());
    return shape({ ...snapshot, live: false });
  }
}

export const yoctoToNear = (y, d = 3) => (Number(BigInt(y) / 10n ** 18n) / 1e6).toFixed(d);
export const pad2 = (n) => String(n).padStart(2, "0");
export const bpsText = (x) => (x == null ? "—" : (x / 100).toFixed(2));
export const titleOf = (t) => t.title.replace(/\s*\[[^\]]*\]\s*/g, " ").replace(/\s+/g, " ").trim();
