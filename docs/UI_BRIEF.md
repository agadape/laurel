# UI brief — prompt for an external design / frontend AI

Copy everything below the line into another AI (v0, Lovable, Claude, GPT, Gemini, Figma Make …). Attach `web/src/App.jsx`, `web/src/style.css`, `web/src/rpc.js` and a screenshot of https://laurel-near.vercel.app (current look: `docs/img/ui-current-tasks.jpg`) if the tool accepts files. The brief is self-contained otherwise.

---

## Task

Redesign the web explorer of **Laurel**, a NEAR hackathon project, so it looks like a polished product in a 3-minute demo video judged by an international jury. Keep it a **read-only, wallet-free, static Vite + React 18 site** that fetches everything from NEAR JSON-RPC view calls. Deliverable: a complete, production-ready `App.jsx` + `style.css` (plain CSS or CSS modules, no Tailwind, no UI kit, no extra npm dependencies beyond react and react-dom), keeping the data layer (`rpc.js`) and every data field below unchanged.

## What Laurel is (30 seconds)

Small machine-learning models usually live on someone else's server, and nobody can verify how good they are. Laurel turns a small decision model into **on-chain infrastructure on NEAR**:

1. A **task creator** publishes a decision task (e.g. "credit risk, 18 integer features") and stores a **private test set** encrypted at OutLayer, bound to the sha256 of one evaluator program.
2. **Participants** train a gradient-boosted-tree model off-chain on public data, export it as a compact integer model (1–250 KB) and submit it to the registry contract. The contract validates the structure and stores the model as data.
3. On `request_score`, the contract asks **OutLayer** (a TEE worker network) to run the pinned evaluator. The evaluator reads the model from the contract, scores it on two hidden splits (A and B), and writes the scores back on-chain via a callback.
4. The **leaderboard** shows split-A scores while the task is open. Split B is hidden until the task closes, so nobody can overfit the final score.
5. After the deadline anyone can `close_task`; the best split-B score wins. The winning model becomes a fixed address: `predict_task(task_id, features)`. **AI agents** holding a restricted function-call key and **other contracts** (via cross-contract promise) call it and get a prediction inside NEAR consensus for about 4 Tgas; a per-call fee goes to the model owner.

Tagline options: "Small decision models as on-chain infrastructure." / "Train off-chain, prove in a TEE, serve from a contract."

Demo task: credit-risk classification on the UCI German Credit dataset (a simulation, explicitly not a real credit tool). Metric: balanced accuracy in basis points (7100 = 71.00 %). Two reference models: "deep" (50 trees × depth 4, 33 KB) and "shallow" (10 trees × depth 2, 1.6 KB). The story the UI must make visible: the shallow model leads on split A (75.50 %) but the deep model wins on the hidden split B (66.50 % vs 61.50 %).

Live data: contract `laurel.laurel-team-mw0x0c8g.testnet` on NEAR testnet. Task 3 `credit-risk` is closed (winner submission #4); task 4 `credit-risk-open` is open until 25 Nov 2026 with submission #6. Tasks 1–2 are older duplicates with Indonesian titles; they may be shown but are not the focus.

## Current site (what to replace)

Four screens behind a hash router, one 230-line `App.jsx`, one 50-line `style.css`, system font, light/dark via `prefers-color-scheme`, green accent `#0b6e4f`. Functional but generic: plain cards, plain tables, no hierarchy, no visual explanation of the flow, no hero.

Routes (keep them, they are linked from the README and the demo script):

| Route | Screen | RPC view calls |
|---|---|---|
| `#/` | Tasks list | `list_tasks {from, limit}` |
| `#/task/:id` | Task detail + leaderboard + CLI snippets | `get_task {task_id}`, `leaderboard {task_id}` |
| `#/model/:id` | Submission / model detail | `get_submission {submission_id}`, `get_earnings {submission_id}`, `get_config {}` |
| `#/costs` (alias `#/biaya`) | Costs & how it works | `get_config {}` |

Header: "Laurel" wordmark, nav (Tasks · Costs & how it works), the contract id linking to the NEAR explorer, "testnet · read-only". Footer: "Built at NEAR HACKATHON 2026 · source on GitHub · every number comes from the contract's view RPC, no mock data · sister project: Undo". A `?contract=<account>` query parameter switches the contract; keep it.

## Data shapes (JSON exactly as the contract returns them; do not rename)

```ts
type Status = "Uploaded" | { Pending: { requested_at_block: number } } | "Scored" | { Failed: { reason: string } };

type Task = {
  task_id: number; creator: string; title: string; slug: string; description_url: string;
  n_features: number; feature_names: string[];
  secrets_account: string; secrets_profile: string;
  deadline_ns: string;            // nanoseconds since epoch, as a decimal string
  fee_per_call: string;           // yoctoNEAR as a decimal string (1 NEAR = 1e24)
  submission_fee: string;         // yoctoNEAR
  max_per_account: number;
  winner: number | null; closed: boolean; created_at_ns: string; submission_count: number;
};

type LeaderboardRow = {
  submission_id: number; owner: string;
  score_a_bps: number | null; f1_a_bps: number | null;
  score_b_bps: number | null; f1_b_bps: number | null;   // null while the task is open
  bytes: number; trees: number; status: Status; calls: number;
};
// leaderboard order: open task → by score_a desc; closed task → by score_b desc, winner first

type Submission = {
  submission_id: number; task_id: number; owner: string;
  model_hash: string;             // base64 sha256 of the model bytes
  bytes: number; trees: number; nodes: number; max_depth?: number;
  submitted_at_ns: string; status: Status;
  score_a_bps: number | null; f1_a_bps: number | null; score_b_bps: number | null; f1_b_bps: number | null;
  calls: number;
  last_outlayer_raw: string | null;   // JSON string from the TEE evaluator, ≤ 900 bytes, e.g.
  // {"ok":true,"eval_version":"1","submission_id":4,"task_slug":"credit-risk","model_bytes":33011,"trees":50,
  //  "a":{"n":150,"n_pos":45,"tp":27,"tn":78,"fp":27,"fn":18,"bal_acc_bps":7100,"f1_bps":6000},"b":{...}}
  scored_by: string | null;
};

type Config = {
  owner: string; outlayer: string; evaluator_url: string; evaluator_hash: string;  // sha256 hex, 64 chars
  max_model_bytes: number; max_trees: number; pending_timeout_blocks: number;
  task_count: number; submission_count: number;
};
```

Helpers already in `rpc.js`: `view(method, args)`, `contractId()`, `yoctoToNear(str, decimals)`, `bps(n)` → "71.00 %", `nsToDate(str)`, `short(str, n)`, `statusText(status)`, `statusDetail(status)`, `EXPLORER_ACCOUNT(id)`, `EXPLORER_TX(hash)`.

## Static content that must stay on the Costs page

Measured on testnet (each row links to a transaction):

| Operation | Model | Tgas |
|---|---|---|
| `predict_task` from an agent (function-call key) | 50 trees × depth 4, 33 KB | 4.31 |
| `predict` | synthetic 100 × 6, 197 KB | 13.20 |
| `submit_model` (validation + storage) | 33 KB | 10.20 |
| `request_score` → OutLayer → callback | 33 KB, 2 × 150 rows | 12.5 total, ~10 s wall clock |
| `close_task` | — | 2.23 |
| another contract → `predict_task` → callback | 50 × 4 | 8.85 total |
| end-to-end from zero (23 steps, 17 negative tests) | — | 232 s |

Flow to visualise (an actual diagram is welcome, SVG inline, both themes):

```
task creator  ─ store private test set (bound to evaluator hash) ─► OutLayer
              ─ create_task ──────────────────────────────────────► Laurel registry contract
participant   ─ train off-chain → model.bin ─ submit_model ───────► contract validates + stores the model
              ─ request_score ────────────────────────────────────► contract → OutLayer.request_execution(pinned evaluator)
                                                                     TEE: evaluator reads the model via view → scores A/B → callback
anyone        ─ close_task after the deadline ────────────────────► winner = best split-B score
agent / contract ─ predict_task(task_id, features) ───────────────► inference inside consensus; fee → model owner
```

"Guaranteed / not guaranteed" bullets (keep the wording, it was reviewed for honesty):
- The scoring evaluator is fixed by the contract (hash pinned by the owner), not chosen by participants. The secret opens only for that hash.
- The model runs inside NEAR consensus: `predict` results equal the evaluator and Python, vector by vector.
- The agent uses a function-call key: the protocol rejects `withdraw_credit`, deposits, other contracts and transfers from that key.
- Not guaranteed: Sybil resistance (only a 3-per-account quota + submission fee), secrecy of split-B scores from OutLayer logs, secrecy of a dataset that is public anyway.
- The German Credit dataset (1994, Germany) is a simulation; this is not a tool for scoring real people's credit.

CLI snippets on the task and model pages (copy buttons) must stay; they are what judges run. Templates are in the current `App.jsx` (`datasetDir(slug)` maps a task slug to the dataset folder).

## Design direction

- Audience: hackathon judges watching a screen recording, and developers who open the site afterwards. Dense but legible, confident, "infrastructure" feel rather than consumer fintech. Think Linear / Vercel dashboard / Dune, not a bank.
- One strong hero on the Tasks page: tagline, one-sentence explanation, live stats pulled from `get_config` (tasks, submissions) and the open task's deadline countdown. No stock illustrations.
- Make the **hidden split B** concept visible: on an open task show the B column as a locked placeholder; on a closed task reveal it and highlight the winner. The provisional-vs-final ranking is the "aha" of the demo.
- Status chips for `Uploaded / Pending / Scored / Failed`; a small bar for the score relative to the best in the table.
- Model page: treat the evaluator output as a first-class artefact (confusion matrix as a 2×2 grid for split A and B, not just raw JSON; raw JSON still available in a collapsible block). Show the pinned evaluator hash and the model sha256 in monospace with copy buttons.
- Light and dark themes, both polished; respect `prefers-color-scheme`, optional manual toggle.
- Responsive down to 390 px (the leaderboard may collapse to cards on mobile). Desktop 1440 px is what the video will show.
- Typography: one display/sans and one monospace, loaded from Google Fonts or system; numbers with tabular figures.
- Loading and error states for every RPC call (RPC can be rate-limited; show a retry, never a blank page).
- No mock data anywhere; if a view returns nothing, say "no submissions yet". Never invent numbers.
- Performance: no heavy libraries; the whole bundle today is 160 KB and should stay in that range.

## Hard constraints

- Keep `rpc.js` and its exports as they are; all UI data must come from those view calls.
- No wallet connection, no write transactions, no backend, no environment variables other than the existing `VITE_BURSA_CONTRACT`.
- Routes, `?contract=` parameter, English copy, and the static tables/bullets above stay.
- Output complete files that build with `npm run build` on Vite 5 / React 18 without new dependencies.

## What to return

1. A short design rationale (5–10 lines).
2. `web/src/App.jsx` (may be split into `web/src/components/*.jsx` if you also list the imports).
3. `web/src/style.css`.
4. Any `index.html` changes (fonts, meta).
