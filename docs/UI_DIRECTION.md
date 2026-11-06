# Laurel — visual direction (final): scientific editorial meets computational art

Chosen on 4 Nov 2026 after three explorations on the design canvas (A "official results": too stiff; B "arena": too playful; **C "observatory"**: kept). This document is the brief the web implementation follows. Mockups: artboards C1 and C2 on the canvas "Laurel Official Results".

## 1. One sentence

Laurel is an observatory for small models: the site composes real on-chain data like a contemporary research publication, and the only "art" is the data itself drawn faithfully (the model's trees, the test rows, the two readings).

## 2. Foundations

| Layer | Decision |
|---|---|
| Structure (Swiss / industrial) | 12-column grid, 48 px page gutters on desktop, hairline rules (1.5 px ink for section breaks, 1 px for rows), asymmetric blocks (2 + 6 + 4, 7 + 5), numbered sections in mono (`01 — Readings`), oversized numerals for task ids. No rounded cards; the only rounded things are dots and status pills. |
| Atmosphere (observatory) | Instrument vocabulary: *readings* (scores on a scale with needles), *specimens* (models and test plates), *exhibits* (tasks), *in service* (the winner). Hidden split B = "not yet observed" with a hatched band; revealed = the needle appears. |
| Signature (computational art) | **The model is the picture.** Each submission is drawn from its real borsh bytes (`get_model_bytes`): one glyph per tree, depth = levels, split feature colours the branch, leaf value sets stroke weight. Each evaluation is drawn from its real confusion counts: one dot per test row, errors in orange. Nothing decorative is invented. |

## 3. Palette (light first, dark mirrored)

| Token | Light | Dark | Use |
|---|---|---|---|
| `--paper` | `#F2EFE8` | `#15161A` | page |
| `--plate` | `#FFFFFF` | `#1D1E24` | specimen plates, code blocks |
| `--ink` | `#1B1B1F` | `#ECEAE3` | text, rules, needles |
| `--ink-2` | `#3A3A40` | `#C9C7BF` | body copy |
| `--mist` | `#6B6B73` | `#9A9AA3` | labels, meta (4.5:1 on paper) |
| `--rule` | `#C9C5BB` | `#2E2F36` | row rules |
| `--accent` | `#E8552A` | `#FF7A4F` | split B / final, section numbers, errors in plates, the champion |
| `--sealed` | `#4A5B7A` | `#8FA3C7` | "not yet observed", pending |
| `--tee` | `#0E7C6B` | `#3FC9B0` | evaluator / TEE provenance |
| `--fault` | `#B3261E` | `#FF6B6B` | Failed status only |

One accent carries three meanings on purpose (final reading, misjudged rows, champion): they are the same idea, "what the sealed split decided".

## 4. Typography

- Display: **Archivo** 700/800 (Google Fonts), tight tracking (−0.03 em) at 40 px and above; numerals as composition elements (120 px exhibit ids, 72 px readings).
- Interface: **Inter** 400/500, 15 px base, 1.5 line height.
- Data: **JetBrains Mono** 400/500 for hashes, account ids, timestamps, section numbers, scale ticks; `font-variant-numeric: tabular-nums` everywhere numbers align.

## 5. Screens

### Home `#/` — "Exhibits"
Hero 6 + 6: left the title "Models, observed.", one paragraph, three figures from `get_config` (tasks, submissions) and the measured 4.3 Tgas; right the **specimen plate of the current champion** (its trees, drawn from bytes). Below, the exhibit index: id numeral, title, the leader's forest signature, split A reading, split B reading or "not yet observed", state. Earlier exhibits (tasks 1–2) in a mono footnote row.

### Task `#/task/:id` — "Exhibit NN"
Header with the id as a 120 px numeral, title, meta, and the instrument block (evaluator hash, secret profile). Then **01 Readings**: two scales 50–100 % with a needle per scored entry; split B scale shows a hatched "sealed until <deadline>" band while open and the needles once closed; the champion needle in accent. **02 Specimens**: one plate per entry, dot field from `last_outlayer_raw` (split B when closed, else split A) beside the forest signature, status pill, calls. **03 In service** when closed: `predict_task(id, …)`, calls, earnings. Rulebook (features, fees, quota) and the CLI snippets fold under **04 Enter**.

### Model `#/model/:id` — "Specimen #N"
Two large readings (A in ink, B in accent or "not yet observed"), the full forest drawn from bytes with a hover readout of a tree's thresholds, two confusion plates, provenance strip (model sha256, evaluator sha256, scored by, owner) with copy buttons, raw evaluator JSON in a fold, "in service" figures when it is the champion, the two CLI snippets.

### Costs `#/costs` — "Method"
The flow as a technical diagram (SVG, both themes), the measured Tgas table, the guaranteed / not guaranteed list verbatim.

## 6. Motion

- Needles slide to their reading once on mount (400 ms, ease-out); figures count up once.
- Opening a closed task: the sealed band lifts and the split B needles slide in (600 ms), once per page load.
- Tree glyphs draw in with `stroke-dashoffset` over 500 ms on the model page only.
- Hover on a tree glyph: tooltip with its first split (`feature < threshold`).
- `prefers-reduced-motion`: everything static.

## 7. Constraints

No new npm dependencies; `rpc.js` exports unchanged (one view helper added for model bytes); routes `#/`, `#/task/:id`, `#/model/:id`, `#/costs` (alias `#/biaya`) and `?contract=` kept; English copy; no mock data; every RPC call has loading and error states; bundle stays near 160 KB; works at 390 px.

Superseded: `docs/UI_DIRECTION_PLAYGROUND.md` (kept for the record).

## 8. Audits and fixes (4 Nov 2026)

Two external-skill audits of the first build are in `docs/audit/UIUX_PRO_MAX.md` and `docs/audit/TASTE.md`. Fixed the same day in the web: split B is withheld on every screen until the task is closed (the `get_submission` view still returns it; the copy now says "sealed in the leaderboard"); phone layout of the exhibit index and header; needle collisions measured in pixels with alternating tiers; `--accent-text` / `--tee-text` tokens for small text (AA on ivory), links in ink with underline, section numbers in mist, the "open" pill in ink; dot plates ordered by true class (filled = positive, ring = negative, orange = misjudged) with a key; the sealed band now renders on closed tasks and lifts once, with a slopegraph between the scales; tree glyphs carry leaf weight, split-feature tone and leaf direction, with a click/keyboard readout; error state and reserved box for model bytes; `h1` per screen, `document.title` per route, skip link, focus-visible; vertical flow list under 720 px; favicon and Open Graph. Not done: the contract-side change to `get_submission`.

**Pass 2 (4–5 Nov).** `docs/audit/UIUX_PRO_MAX_2.md` and `docs/audit/TASTE_2.md` re-measured the live site: 12/13 and 13/17 first-pass findings verified fixed, taste score 6.5 → 7.5. Fixed the same night: skip link no longer routes to `#main` (unknown hashes fall back to the index); the vertical flow list is hidden on desktop (no duplicate diagram) and its counters dropped; the `predict_task` box uses `--accent-text` so its label passes AA in light mode; the seal on a closed exhibit now stays mounted while it lifts (sealed → lifting → done) and the slopegraph (56 px, 2 px champion line, dashed loser) draws after it; raised needles get a 96 px track; no false "bytes unavailable" flash while an exhibit's specimens load, and a labelled retry when a view really fails; the forest is one tab stop with arrow-key movement, 5 columns under 720 px (≈ 63 px tap cells) and a readout slot in every state; all deadlines in ISO UTC; captions in mist with only the word champion in accent; `aria-current` plus an underline on the active nav item; the Undo footer mention links to its repo; 12 px floor for tick labels and code.

## 9. Landing page and wallet gate (5 Nov 2026)

At the owner's request the site is split in two. Signed-out visitors see a separate landing page (`web/src/Landing.jsx`): hero with the champion's forest, five live figures, four "how it works" steps, exhibit 03's split-A vs split-B scales with the seal lifting, two audiences, and a final call to connect a wallet. All of it is read live from the contract; split B is shown only for a closed task. The explorer screens (`#/`, `#/task/:id`, `#/model/:id`, `#/costs`, `#/connect`) render after a NEAR wallet sign-in (connect only, no transaction) or as a guest. Returning visitors with a saved wallet session see "restoring your wallet session…" instead of a flash of the landing. The remote MCP endpoint (`/api/mcp`) is not gated.

**Guest mode (5 Nov, owner's decision).** Judges and the AI jury mostly have no testnet wallet, so the explorer must not depend on one. The landing's hero and final section carry a second action, "Browse the exhibits without a wallet", which opens the explorer read-only; the choice is kept in `sessionStorage` (`laurel-guest`) so navigation and reload stay in guest mode. A deep link (`#/task/3`, `#/model/4`, `#/costs`, `#/connect`, `#/tasks`) opens its page directly as a guest, with no click, so a link from README or CLAIMS always lands on content; only the bare site root shows the landing first. The "restoring your wallet session…" state never shows to a guest. A wallet is needed only to buy prediction credit or withdraw (header "Connect wallet", Connect step 1, the credit panel).

## 10. Dex's landing and dark theme (6 Nov 2026)

The owner approved Dex Bennett's front end (`docs/design/DESIGN.md`, `docs/design/RASA-DESAIN.md`, hand-over in `docs/design/SERAH-TERIMA.md`). The landing is now framework-free and loaded on demand (`web/src/landing/`): an intro, a WebGL room of glass panes (one decision tree per pane, decoded from the on-chain bytes), the open exhibit's board (split A, split B sealed), how it works, exhibit 03's public-vs-sealed race, two audiences, and a closing call. The explorer pages keep their structure under `web/src/dex-theme.css`. The site is dark only; the light theme is dropped (owner's decision). Fonts: Zodiak, Satoshi (self-hosted in `web/public/aset/`), DM Mono.

Integration notes: every contract value the landing renders is escaped or coerced to a number in `landing/data.js` (`?contract=` makes them untrusted). If RPC is slower than 2.6 s on the default contract, the landing uses `web/public/aset/snapshot.json` (refresh with `python tools/landing_snapshot.py`) and its footer says it is a saved copy and when it was taken.

## 11. Inner pages in the landing's world (6 Nov 2026)

Following Dex's guide (`docs/design/RASA-DESAIN.md`: one object per page, no small text above headings, no rows of figure boxes, mono only for code and hashes), the explorer pages were rebuilt with `web/src/inner.jsx` and `web/src/inner.css` (classes prefixed `x-` so they never meet the landing's unscoped ones):
- **Exhibits:** live figures become one sentence; the index is a board: outlined numeral (orange open, blue closed), split-A leader bar, split B *Withheld* with a countdown or the champion with its laurel.
- **Exhibit:** the readings are a race (`Lanes`). Open: split A only, split B withheld. Closed: split A runs, the seal passes, everyone settles on split B, the laurel moves; *Run it again* replays it. Specimens are glass cards with their trees and private-row plate.
- **Specimen:** split A / B bars, the evaluation steps, and a tree explorer (`TreeExplorer`): pick any tree decoded from the on-chain bytes; idle, a call walks from root to a leaf; point at a leaf to read its rule (left when `x ≤ threshold`, as in `gbdt-core`) and its signed contribution.
- **Method:** the path of a model as seven stations with a travelling light, measured gas as bars linked to their transactions, and "Guaranteed, and not" as two panels.
- **Connect:** outlined step numerals, glass panels, the account's figures as one sentence, and example prompts that copy on tap.
- Header carries "Live on NEAR testnet"; the footer matches the landing's.

