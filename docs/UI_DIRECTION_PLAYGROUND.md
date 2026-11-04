# Visual direction #1 — "The Arena" (superseded on 4 Nov by docs/UI_DIRECTION.md)

Design proposal only; nothing here is implemented yet. It builds on the existing site (Vite + React 18, hash routes `#/`, `#/task/:id`, `#/model/:id`, `#/costs`, read-only RPC views in `web/src/rpc.js`) and changes **nothing** in the contract, the tools or the data layer. Every visual element below is derived from fields the contract already returns; no mock data, no invented numbers.

## 1. The concept in one paragraph

Laurel is literally a competition: models enter an arena, are judged behind a sealed door, and the winner is put to work. So the interface is an **arena**, not a dashboard. Each model is a **creature** with an identity derived from its on-chain bytes. A task page is the arena floor: the open floor (split A) is bright and public; the **sealed chamber** (split B) is a vault that stays locked until the deadline, then opens to reveal the final ranking and crown the winner with a laurel wreath. Winning is not the end: the winner becomes "now serving", with a live call counter, which is the deployment achievement.

## 2. Palette (intentional, one meaning per colour)

| Token | Light | Dark | Meaning |
|---|---|---|---|
| `--paper` / `--ink` | `#F4F1EA` / `#141518` | `#0B0D12` / `#ECEAE3` | background / text (warm paper vs deep ink) |
| `--floor` (split A, open competition) | `#B9F03C` lime | `#C8FF3D` | provisional scores, open badges, floor lane |
| `--chamber` (split B, sealed) | `#6D4AFF` violet | `#8B7CFF` | hidden/final scores, vault, deadline dial |
| `--laurel` (winner, serving) | `#E8A317` amber | `#FFC247` | winner wreath, "now serving", earnings |
| `--fault` (Failed) | `#E0452B` coral | `#FF6B4A` | Failed status, protocol rejections |
| `--tee` (evaluator / OutLayer) | `#0E8C7A` teal | `#2FD4BC` | TEE status ribbon, evaluator seal, tx links |
| `--mist` | `#8A8F99` | `#7F8594` | muted labels |

Rule: lime never appears on the chamber side, violet never on the floor. A viewer learns the A/B split by colour before reading a label.

## 3. Typography

- Display: **Unbounded** (Google Fonts, 700/900) for the wordmark, task titles, and the big score numerals. Wide, slightly odd, unmistakably not a SaaS dashboard.
- Body: **Inter** 400/500 for copy and labels.
- Mono: **JetBrains Mono** for hashes, account ids, CLI snippets, confusion matrices. Tabular numerals everywhere numbers sit in columns.
- Scale: scores are the hero number on every surface (`71.00 %` at 56–96 px on the model page, 28 px on leaderboard rows). Labels stay 12–13 px uppercase tracked.

Fonts load from Google Fonts in `index.html`; no npm dependency.

## 4. Models as creatures (identity from on-chain data)

Each submission gets a deterministic SVG creature generated client-side from fields the contract returns, so two viewers always see the same creature and nothing is faked:

- Seed: `model_hash` (sha256) → hue rotation, eye placement, pattern.
- `trees` → number of body segments or petals (10 trees = a compact 10-petal disc, 50 trees = a dense 50-spoke wheel).
- `nodes` / `max_depth` → ring layers (depth 2 = two rings, depth 4 = four).
- `bytes` → overall size on the leaderboard (1.6 KB creature is small and quick; 33 KB is large and heavy).
- Status → expression: `Uploaded` eyes closed, `Pending` eyes darting (CSS keyframes), `Scored` eyes open, `Failed` cracked outline in coral.
- Winner → a laurel wreath ring in amber.

The same creature appears at 32 px in task cards, 48 px on leaderboard rows, 240 px on the model page, so the three screens feel like one world. Implementation is ~120 lines of SVG generation in a `Creature.jsx` component, pure functions, no library.

## 5. Screens

### Home (`#/`) — "the arena gate"
- Full-width hero: wordmark in Unbounded, tagline "Models compete. A sealed chamber judges. The winner serves on-chain.", and three live counters from `get_config` (`task_count`, `submission_count`) and the open task's deadline as a countdown ring.
- Below it, tasks are **arena posters**, not cards: a tall tilted panel per task (CSS `perspective` + `rotateY(-4deg)`, straightens on hover), the task title in display type, the creature line-up of its submissions along the bottom edge, a lime "OPEN" stamp or an amber laurel stamp with "WINNER #4".
- The two superseded Indonesian-title tasks (1 and 2) are shown smaller in a "past seasons" strip so the page stays honest about what is on the contract.

### Task page (`#/task/:id`) — "the arena floor"
Two lanes side by side (stack on mobile):

- **Open floor (split A)**, lime: a horizontal race track. Each submission is a creature placed by `score_a_bps` relative to the best; the bar is the lane; the number sits on the creature's badge. Order and values come straight from `leaderboard`.
- **Sealed chamber (split B)**, violet: a vault door. While `closed == false` the door is shut, the deadline countdown is engraved on it as a rotating dial (`deadline_ns`), and the B column shows a lock glyph instead of a number. When `closed == true` the door is open (one-time `rotateY` reveal on page load), the chamber shows the final ranking by `score_b_bps`, and the winner wears the wreath with "serving as `predict_task(3, features)`".
- A small **evaluator seal** in teal in the corner: the pinned hash (`get_config.evaluator_hash`, monospace, copy button) with the text "scored in a TEE by this evaluator only".
- Task facts (features, fees, quota, secret profile) live in a collapsible "rulebook" drawer so the arena stays uncluttered but every field remains one click away.
- CLI snippets ("Enter the arena") keep their copy buttons, styled as a ticket stub.

### Model page (`#/model/:id`) — "character sheet"
- Creature at 240 px on the left, score numerals on the right: split A and split B as two giant numbers in lime and violet (B shows a padlock while hidden).
- **TEE ribbon** across the top: `Uploaded → Pending → Scored` as three stations, the current one lit; `Failed` turns the ribbon coral with `statusDetail` in mono.
- Confusion matrices for A and B drawn as two 2×2 tiles (tp/tn in ink, fp/fn in coral) from `last_outlayer_raw`; raw JSON stays in a "view raw" fold.
- Provenance strip: `model_hash`, pinned evaluator hash, `scored_by`, owner (explorer link), all mono with copy buttons.
- "Now serving" plaque (amber) when this submission is the task winner: `calls` ticking up with a count-up animation on load, `earnings` from `get_earnings`, and the `predict` CLI snippet.

### Costs page (`#/costs`) — "how the arena works"
- The flow diagram becomes an illustrated path: a creature travels from "train off-chain" through "submit", "sealed chamber (TEE)", "vault opens", to "serving", each station with its measured Tgas from the existing table. Pure inline SVG, animated dashed path, respects `prefers-reduced-motion`.
- The measured-cost table and the "guaranteed / not guaranteed" bullets stay verbatim (they were reviewed for honesty), restyled as a rulebook.

## 6. Motion (meaningful, not decorative)

- Numbers count up once on mount (300 ms, ease-out). Bars grow from zero.
- Vault door reveal on a closed task: once per page load, 600 ms; skipped under `prefers-reduced-motion`.
- Creature eyes blink every 6–10 s; `Pending` eyes dart (this is the only state with continuous motion, which mirrors "work in progress").
- Poster tilt on hover; the leaderboard row lifts 2 px and shows the creature's name card.
- One burst of laurel leaves when a winner page opens for the first time in the session (`sessionStorage` flag, wrapped in try/catch).
- No parallax, no background particles, nothing that moves while reading.

## 7. 3D and illustration

- CSS 3D only: posters (`perspective`, `rotateY`), the vault door (`rotateY` hinge), the confusion tiles (slight `rotateX` on hover). No three.js; bundle stays near today's 160 KB.
- All illustration is generated SVG from data (creatures, the vault, the path). No stock art.

## 8. Keeping the technical layer accessible

Every number has a source and stays reachable: hashes and ids in mono with copy; status detail text on Failed; tx links to the explorer in the costs table; `?contract=` still switches contracts; loading and error states on every view call with a retry button (RPC can be rate-limited).

## 9. Implementation plan (for when the direction is approved)

1. Design tokens, fonts, dark/light theme, `Creature.jsx` (one afternoon).
2. Task page: floor lane + vault + rulebook drawer.
3. Leaderboard rows and posters on home.
4. Model character sheet with ribbon and confusion tiles.
5. Costs path illustration.
6. Mobile pass (390 px) and reduced-motion pass, then `npm run build` and deploy to the same Vercel project.

Constraints that do not change: no new npm dependencies, `rpc.js` untouched, routes and `?contract=` kept, English copy, no mock data.
