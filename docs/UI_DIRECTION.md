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
