# Laurel web front end — UI/UX audit (ui-ux-pro-max skill)

Audited 4 Nov 2026 against the live site https://laurel-near.vercel.app (contract `laurel.laurel-team-mw0x0c8g.testnet`), the skill `ui-ux-pro-max` v2.15.0 (installed under `.claude/skills/ui-ux-pro-max/`, full clone kept in `.claude/skills/ui-ux-pro-max-repo/`), its `references/quick-reference.md` (119 UX rules) and `references/pro-rules.md`, and the intended direction in `docs/UI_DIRECTION.md`. Routes checked: `#/`, `#/task/3`, `#/task/4`, `#/model/4`, `#/model/6`, `#/costs` at 1440 px and 390 px, light and dark. Measurements (contrast ratios, computed font sizes, element boxes) were taken in the browser with a script; contract values were cross-checked with direct `view` calls. Screenshots: `docs/audit/img/<route>-<width>-<scheme>.jpg` (24 files, all under 300 KB). Nothing under `web/` was changed. The skill's `--design-system` generator could not be run (the sandbox refused executing that part of the downloaded script twice); the `--domain ux` searches ran and are cited below as `[ux: rule-id]`.

## Verdict

The redesign lands the direction: the ivory/ink Swiss grid, the three typefaces, the single orange accent and the "model is the picture" idea are all real, consistent across the four screens and both themes, and every number on the page is read from the contract. On a 1440 px screen in light mode a jury will get the story in one scroll of `#/task/3` ("#5 read higher on the public split, #4 on the sealed one"). What stops it from being finished is below the fold and off the desktop: the home index is broken at 390 px, needle labels collide on every narrow scale, the open exhibit's model page prints the "sealed" split B reading that the task page swears nobody can see (and the contract really does return it), the accent is used for 12 px text at 3.2:1, and the dot plates throw away the tp/tn/fp/fn distinction they are captioned with. All of it is fixable at the CSS/JSX level in an afternoon, with no new dependencies.

## Findings, ranked by severity

### S1 · Critical — The product story contradicts itself on the open exhibit (split B is "sealed" on `#/task/4`, visible on `#/model/6`)

- **Where:** `#/task/4` → `Scale variant="b"` band text "sealed until 2026-11-25 23:59 UTC — not even the contract shows it"; `#/model/6` → `Model()` readings block (`.reading .v.accent`), "03 — Specimen plates" split B `DotPlate`, and the caption "unsealed at close".
- **What is wrong:** Submission #6 belongs to task 4, which is open (`get_task(4).closed === false`, `winner === null`). The task page hides split B. The model page shows `66.50 %`, F1, the full split B dot plate and the raw evaluator JSON with `"b": {...}`, captioned "unsealed at close". Cause in the web: `Model()` gates on `sub.score_b_bps != null` instead of on `task.closed`. Cause upstream: `get_submission(6)` returns `score_b_bps: 6650` and `last_outlayer_raw` with the `b` block while the task is open (`leaderboard(4)` correctly returns `b: null`). The claim "not even the contract shows it" is false today.
- **Why it matters:** This is the one claim the whole project rests on (a reading a model "could not have been tuned against"). A verifying developer who clicks the only open specimen sees the sealed number two clicks after being told it is sealed. The AI jury matches README claims against tx and code; a contradiction between two of your own pages is the cheapest way to lose that check.
- **Fix (web, JSX):** in `Model()` compute `const bOpen = sub.score_b_bps != null && task?.closed;` and use `bOpen` for the reading, the plate, the F1 line and the "unsealed at close" caption; while `task` is still loading show the sealed pill, never the number. In the raw JSON fold, when the task is open, render `JSON.stringify({...raw, b: "sealed until close"}, null, 2)` or hide the fold. Reword the band on `#/task/4` to what is true after the contract fix, e.g. "sealed until <date> — withheld by the contract until close". **Fix (contract, out of scope for this audit, needs a `docs/ABI.md` change first):** `get_submission` should null `score_b_bps`, `f1_b_bps` and strip `b` from `last_outlayer_raw` until the task is closed; otherwise the README must say split B is hidden only from the leaderboard view.

### S2 · Critical — Home exhibit index is unusable at 390 px

- **Where:** `#/` → `.row`, `.row-head` (rule `@media (max-width: 900px) { .row, .row-head { grid-template-columns: 64px minmax(0,1fr) 100px 100px } }`). Screenshot `img/home-390-light.jpg`.
- **What is wrong:** Measured columns at 390 px: `64px 58.4px 100px 100px`. The title column is 58 px wide, so "Credit risk (UCI German Credit) — simulation" stacks one word per line (ten lines), the 20 px bold title overlaps the split A number, the `not yet observed` pill (127 px, `white-space: nowrap`) overflows its 100 px column and clips at the viewport edge, and the state column (open/closed) is `display: none`, so state is carried by numeral colour alone. `[ux: horizontal-scroll, visual-hierarchy, compact-label-overflow, color-not-only]`
- **Why it matters:** The brief says the site must work at 390 px, and a jury member opening the link from a phone during judging sees the first screen after the hero fall apart. It also looks like a bug rather than a design choice, which undermines the "scientific editorial" precision.
- **Fix (CSS):** below 720 px make each row a two-line card instead of a four-column grid:
  ```css
  @media (max-width: 720px) {
    .row, .row-head { grid-template-columns: 56px minmax(0, 1fr); row-gap: 8px; }
    .row-head .right, .row-head .sig { display: none; }
    .row .t { grid-column: 2; }
    .row .r { grid-column: 2; text-align: left; font-size: 22px; display: inline-flex; gap: 6px; align-items: baseline; }
    .row .r .sub { display: inline; font-size: 11px; }
    .row .state { display: block; grid-column: 2; text-align: left; }
    .row .n { font-size: 40px; align-self: start; }
    .pill { white-space: normal; }
  }
  ```
  and in `ExhibitRow` prefix the two readings with their label (`<small>A</small> 71.00 %`, `<small>B</small> not yet observed`) so they survive without the column header.

### S3 · High — Needle labels collide on every scale narrower than ~900 px, and on the champion/led pair at any width

- **Where:** `#/task/3`, `#/task/4` → `Scale()` in `components.jsx`, collision rule `const up = x - lastX < 7 && !lastUp;` (7 % of track width). Screenshot `img/task3-390-light.jpg`; also visible at 1440 px dark (`img/task3-1440-dark.jpg`: "71.00" and "75.50" overprint, "#4 · champion" overprints "#5").
- **What is wrong:** The threshold is in percent of the track, but the needle label is 49–78 px wide. At 358 px (390 px viewport) 7 % is 25 px, so 71.00 and 75.50 (4.5 points apart) overlap and the two split B needles overlap. Even at 1440 px the 1283 px-wide track puts 61.50 and 66.50 only 84 px apart with labels of 49 and 78 px, so "#4 · champion" runs into "#5". `[ux: axis-readability, truncation-strategy]`
- **Why it matters:** The scales are the instrument that tells the story. When the two readings that swap order are the two labels that overprint, the story is unreadable exactly where it matters.
- **Fix (JSX):** measure the collision in pixels using the rendered track width: keep a `ref` on `.track`, read `trackRef.current?.clientWidth || 1000`, and raise a needle when `(x - lastX) / 100 * width < 84` (the widest label plus 6 px). Allow a third tier (`up2`, `bottom: 72px`) for three clustered entries, and alternate rather than only "not after an up". Also shorten the champion label to `#4 ★` with the word "champion" in a `title`/visually-hidden span, or move "champion"/"led" into the `.head` note above the track.

### S4 · High — Accent-coloured text fails AA contrast in light mode (3.17:1), used for all section numbers, labels and inline links

- **Where:** every route → `.sec` (`01 — Readings`, 12 px mono), `a` (default link colour: owner accounts, explorer links, "read the method →", footer repo link), `.accent` spans at 12 px (`Split B` label, "all 50 trees…" caption), `.scale .needle .id` at 10 px, `.pill.open` (white on accent, 3.64:1), `.pill.scored` / `.mono.tee` / `.label` in `--tee` (4.45:1, just under). Measured: `#E8552A` on `#F2EFE8` = 3.17:1; `#0E7C6B` on paper = 4.45:1. In dark mode all pairs pass (accent 7.0:1, tee 8.8:1). `[ux: color-contrast, color-accessible-pairs, contrast-readability]`
- **Why it matters:** The skill's first priority is accessibility; WCAG AA needs 4.5:1 for text under 24 px (18.66 px bold). The accent is fine as a 72 px reading and as a 1.5 px rule, but it is being used as a text colour for 10–12 px monospace labels on 36 separate text nodes on `#/task/3`. On a projector in a bright room (jury video call, demo booth) the orange section numbers vanish into the ivory.
- **Fix (CSS, keep the one-accent idea):** add a text-grade token and use it where the accent is a text colour, not a mark:
  ```css
  :root { --accent-text: #B8431F; --tee-text: #0B6A5B; }           /* 4.6:1 and 5.1:1 on paper */
  @media (prefers-color-scheme: dark) { :root { --accent-text: var(--accent); --tee-text: var(--tee); } }
  .sec, a, .scale .needle .id, .spec .head b { color: var(--accent-text); }
  .pill.scored, .mono.tee, .label.tee, .tee { color: var(--tee-text); }
  .pill.open { background: var(--accent-text); border-color: var(--accent-text); }
  ```
  Keep `--accent` for the 72 px readings, the numeral, needles, rules, dots and the champion forest. Underline inline links in body copy (`p a, dd a { text-decoration: underline; text-underline-offset: 2px; }`) so links are not colour-only.

### S5 · High — Hard-coded white text on accent/tee backgrounds fails in dark mode (2.06:1 and 2.58:1)

- **Where:** `#/costs` → flow SVG in `Costs()`: `fill={tee || last ? "#fff" : "var(--ink)"}` on the `TEE evaluator` (`--tee` = `#3FC9B0` in dark) and `predict_task` (`--accent` = `#FF7A4F`) boxes; `.pill.open { color: #fff }` on `#/` and `#/task/4`. Screenshot `img/costs-1440-dark.jpg`. `[ux: color-dark-mode, dark-mode-pairing]`
- **Why it matters:** The direction document promises "light first, dark mirrored"; these are the two places where the mirror breaks. The dark mint box with white 11 px type is the least legible element on the method page, which is the page a verifying developer reads.
- **Fix (JSX/CSS):** use `fill="var(--paper)"` in the SVG (paper is `#F2EFE8` light / `#15161A` dark, which gives ≥ 4.5:1 on both tee and accent in both themes), and `.pill.open { color: var(--paper); }`. Same for the `--tee` stage: in dark mode prefer an outlined box (`fill: var(--plate); stroke: var(--tee); color: var(--tee)`) which also matches the "no filled cards" rule in the direction.

### S6 · Medium — The dot plates collapse four confusion cells into two colours and sort the dots, so they cannot show what the caption promises

- **Where:** `#/task/3` specimens, `#/model/4` and `#/model/6` "03 — Specimen plates" → `DotPlate()` (`dots.push(i < correct ? "" : "x")`), caption "one dot per test row · orange = misjudged".
- **What is wrong:** Dots are rendered correct-first then wrong, so the plate is a sorted proportion bar drawn as a 25-column waffle, not "one dot per row" in any row order, and tp/tn/fp/fn are only in the text line beneath. Between #4 and #5 the plates differ only in how long the orange tail is, which the 66.50 vs 61.50 readings already say. `[ux: pattern-texture, color-not-only, direct-labeling]`
- **Why it matters:** The direction says "nothing decorative is invented"; a plate that encodes one number is decoration with extra steps. The real insight on task 3 (the shallow model #5 has 45 false positives, three times #4's 15 false negatives, i.e. it approves bad credit) is in the data and invisible in the picture.
- **Fix (JSX/CSS, no new data):** order the dots `tp, fn, tn, fp` in four runs and give negatives a hollow dot: `.dots i.neg { background: transparent; box-shadow: inset 0 0 0 1.5px currentColor; }`, errors stay orange (`fn` filled-orange hollow? keep: `fp` = hollow orange, `fn` = filled orange). Add a 4-item legend under the caption in the existing mono style (`● correct positive  ○ correct negative  ● missed positive  ○ false alarm`) and keep the `aria-label` but extend it with the four counts. One extra class per dot, no dependency.

### S7 · Medium — Failed model-bytes fetch is stuck on "loading model bytes…" forever

- **Where:** `Forest()` in `components.jsx`: `if (!bytes) return "loading model bytes…"`; `useModelBytes()` in `App.jsx` sets `undefined` on error, `null` while loading, so both branches render the loading text. Reproduce by opening `#/model/4` with the RPC blocked, or on a slow network when the five RPCs race. `[ux: error-recovery, timeout-feedback, error-state-chart]`
- **Why it matters:** The direction document (§7) promises "every RPC call has loading and error states"; this one has no error state, and the one page where the model is the hero shows a permanent spinner-less "loading".
- **Fix (JSX):** `if (bytes === undefined) return <div className="err mono">model bytes unavailable <button className="retry" onClick={reload}>retry</button></div>; if (bytes === null) return <div className="mist mono">loading model bytes…</div>;` and have `useModelBytes` return `{bytes, reload}`. Also reserve height for the forest plate (`min-height: calc(var(--rows) * 48px)` or an `aspect-ratio` from the tree count already known from `sub.trees`) so the page does not jump when it arrives. `[ux: content-jumping]`

### S8 · Medium — Method-page flow diagram is 4.8 px type at 390 px, and the sealed-stage box is the only one with dashed stroke

- **Where:** `#/costs` → `<svg viewBox="0 0 1000 120" width="1000" ... style={{maxWidth:"100%", height:"auto"}}>` inside `.scrollx`. Measured at 390 px: rendered 358 × 43 px, text glyphs 4.8 px tall. Screenshot `img/costs-390-light.jpg`. `[ux: responsive-chart, readable-font-size]`
- **Why it matters:** This is the one diagram that explains the architecture to a jury; on a phone it is a grey stripe.
- **Fix (CSS/JSX):** drop `maxWidth: 100%` on the SVG and let `.scrollx` scroll horizontally (`.scrollx svg { min-width: 1000px; }`) with a mono hint "scroll →" at small widths; or, better, below 720 px render the same `stages` array as a numbered vertical list (`<ol className="flow-v">`) in the existing mono style. Keep the SVG on desktop.

### S9 · Medium — Information carried only by hover: tree root splits and the champion hint

- **Where:** `Forest()` uses `<title>` inside each `<g className="tree">` ("hover a tree for its root split"); `.forest g.tree:hover path { stroke: var(--accent) }`. `#/` hero caption "Hover a tree to read its root split." `[ux: hover-vs-tap, tooltip-keyboard, touch-target-chart]`
- **What is wrong:** Native SVG `<title>` tooltips appear after ~1 s on desktop, never on touch, never for keyboard users, and are not announced. The direction's "hover readout of a tree's thresholds" is the only interactive moment on the site and 40 % of visitors (phone) cannot reach it.
- **Fix (JSX):** make each `<g>` focusable and clickable: `tabIndex={0} role="button" aria-label={title} onClick={() => setPicked(i)} onFocus={() => setPicked(i)}` and render the picked tree's first split in a fixed mono line under the plate ("tree 12 · root split: duration_months < 22 · depth 4 · 31 nodes"). Add `.forest g.tree:focus-visible path { stroke: var(--accent) }`. This also gives keyboard users a visible focus state, which no custom element on the site currently defines (`focusRules: []` in the stylesheet; default outlines are not removed, which is good, but the needles and specimen cards rely on the browser default).

### S10 · Medium — Heading structure and landmarks do not match the visual hierarchy

- **Where:** all routes. `#/` has one `h1` and no other heading; `#/task/3`, `#/model/4`, `#/costs` have a single `h2` and no `h1`; the section titles (`01 — Readings`, `02 — Specimens`…) are `<div className="sec">`; no skip link; no focus move on hash change (`useRoute` only scrolls to top); `<title>` is always "Laurel". `[ux: heading-hierarchy, skip-links, focus-on-route-change, deep-linking]`
- **Why it matters:** A screen-reader user or a crawler sees four pages with one heading each. For the jury: browser history and shared links all read "Laurel", so the three-minute video's call to action ("open exhibit 03") cannot be bookmarked by name.
- **Fix (JSX):** render `Sec` as `<h2 className="sec">` (keep the look, add `font-size: 12px; font-weight: 400`), promote the page title to `h1` on task/model/costs (the `h2` size rule can be reused via class `.h2`), set `document.title = \`Exhibit 03 · Laurel\`` in each screen's effect, add `<a className="skip" href="#main">Skip to content</a>` + `<main id="main" tabIndex={-1}>` and call `document.getElementById("main")?.focus()` in the `hashchange` handler.

### S11 · Low — Small text: 10–11 px labels carry data

- **Where:** `.scale .tl` (10 px tick labels), `.scale .needle .id` (10 px), `.row .r .sub` (10 px "#5 led here", "#4 decided here"), forest captions (`fontSize: 10` inline), `.label` 11 px, `.pill` 11 px. 48 text nodes under 12 px on `#/task/3`. `[ux: readable-font-size, font-scale]`
- **Why it matters:** The sub-labels are exactly the words that tell the story ("led here" / "decided here"). The type scale otherwise is clean (12/13/15/17/20/26/34/44–76).
- **Fix (CSS):** raise the floor to 11 px for ticks and 12 px for everything that is a word: `.row .r .sub, .scale .needle .id, .forest + .mono { font-size: 12px; }`, `.scale .tl { font-size: 11px; }`, and let `.label` be 12 px with the same tracking.

### S12 · Low — Loading states shift layout; countdown does not tick; champion caption fires an RPC for submission 0

- **Where:** `Home()`: hero figures show "…" then jump to numbers; exhibit rows mount one by one as `leaderboard` resolves; `useView("get_submission", {submission_id: champion?.winner ?? 0})` and `get_earnings(0)` in `Task()` run with id 0 before the task is known (errors are swallowed, but it is one wasted RPC each and shows in the network panel of a verifying developer). `Countdown` renders once and never updates. `[ux: content-jumping, loading-chart, progressive-loading]`
- **Fix (JSX/CSS):** give `.fig .v` and `.row` a `min-height` (`.row { min-height: 112px }`, `.fig .v { min-height: 34px }`) and render a hairline skeleton (`.sk { background: var(--rule); height: 1em; width: 3ch }`) instead of "…"; skip the view when the id is null (`useView(method, args, deps)` → return early when `args.submission_id == null`); add `const [, tick] = useState(0); useEffect(() => { const t = setInterval(() => tick(x => x + 1), 60000); return () => clearInterval(t); }, [])` in `Countdown`.

### S13 · Low — Missing favicon and share metadata; "sister project: Undo" is not a link

- **Where:** `web/index.html` (no `<link rel="icon">`, no `og:title`/`og:description`/`og:image`); footer text in `App()`.
- **Why it matters:** Jury members open the link from Devpost, X or a DM; without Open Graph the preview card is blank and the tab shows the default globe. Q-015 asks both projects to reference each other; the web mentions Undo but gives no way to get there.
- **Fix:** add an inline SVG favicon (`<link rel="icon" href="data:image/svg+xml,…">` drawing one tree glyph in `--accent`), `og:title` "Laurel — models, observed", `og:description` from the existing meta, `og:image` pointing at `docs/audit/img/home-1440-light.jpg` or a dedicated 1200×630 export, and link "Undo" to its repo or site.

## Direction-document conformance (what is implemented vs. promised)

| Direction item | Status |
|---|---|
| 12-col grid, 48 px gutters, hairline rules, numbered mono sections, 120 px numerals | Done, faithful |
| Palette tokens light/dark, one accent with three meanings | Done; see S4/S5 for the two places it fails contrast |
| Archivo / Inter / JetBrains Mono, tabular numerals | Done; weights 500/700/800, 400, 400 loaded (Inter 500/600 are requested but never used, drop them from the Google Fonts URL to save a request) |
| Home: hero 6+6, champion plate drawn from bytes, index with leader signature | Done at ≥ 900 px; broken at 390 px (S2) |
| Task: scales with needles, hatched sealed band, specimens with dot plates, in service, enter | Done; needle collisions (S3) |
| Model: two readings, full forest with hover readout, two plates, provenance with copy, raw JSON fold, CLI | Done; sealed gating wrong for open tasks (S1), hover-only readout (S9) |
| Costs: SVG flow, measured table with tx links, guaranteed/not list | Done; illegible at 390 px (S8) |
| Motion: needles slide (400 ms), figures count up, sealed band lifts on a closed task, trees draw in on the model page, reduced-motion static | Needles slide (500 ms) ✓; trees draw in ✓ (also on the home hero, which the direction limits to the model page); figures do not count up; the band-lift reveal is never rendered on closed tasks (`sealed={null}` means no band, so `.band.lift` is dead CSS). Either implement the reveal (render the band, then add `lift` after 300 ms) or delete the dead rule. Reduced-motion ✓ |
| Constraints: no new deps, routes kept, `rpc.js` exports kept, English, no mock data, loading + error on every RPC, 390 px | All kept except the error state in S7 and 390 px in S2/S3/S8 |

## What already works well (do not undo)

- **The model-as-picture idea is real and verifiable.** `Forest` decodes the borsh bytes from `get_model_bytes` and draws 1,440 paths for #4; a developer can diff the glyph count against `trees` on-chain. Keep the orange root dot and the hover stroke.
- **The story sentence on closed tasks** ("The needles swap order between the scales…") is the best copy on the site; it is generated only when it is true (`leadA.id !== champ.submission_id`).
- **Tokens, not raw hex.** Every colour in `style.css` and nearly every inline style goes through `var(--…)`; dark mode is a mirrored token set, not an inversion. The two exceptions are listed in S5.
- **Honest states.** "scored in TEE", "in the TEE…", "failed: <detail>", "not scored yet", RPC error with retry, the "no closed exhibit yet" fallback on the hero. Keep the wording.
- **Provenance strip** with full hashes, copy buttons that have `aria-label`s, and the "= pinned / ≠ pinned" check against `get_config.evaluator_hash` is exactly what a verifying developer wants.
- **Typography system**: 15 px Inter at 1.5, Archivo with −0.03 em only at display sizes, mono for every identifier; `tabular-nums` where numbers align. Line length of body copy is capped (`max-width: 520/560/760`).
- **Accessibility basics present:** `lang="en"`, viewport meta without `maximum-scale`, `role="img"` + `aria-label` on both the forest SVG and the dot plates, `aria-hidden` on decorative SVGs, native focus outlines not removed, `prefers-reduced-motion` honoured, `target="_blank"` links carry `rel="noreferrer"`.
- **Mobile basics present:** no horizontal scroll on `#/`, `#/task/*`, `#/model/*` at 390 px (`scrollWidth === 390`), gutters collapse to 16 px, specimen cards stack, the key/value lists wrap long tokens.

## Method notes

- Skill install: cloned to `.claude/skills/ui-ux-pro-max-repo/`; the skill folder the repo's own CLI would install (`SKILL.md`, `data/`, `scripts/`, `references/`) is copied to `.claude/skills/ui-ux-pro-max/` so Claude Code can find `SKILL.md` at the top level. Both folders are untracked; decide whether to gitignore `.claude/skills/` before the freeze.
- Searches run from the skill (all `--domain ux`, 2–3 results each): contrast/accessibility, focus/keyboard, touch target size, colour-alone meaning, layout shift/skeleton, minimum font size, link distinction, hover-only tooltips. The `--design-system` reasoning run was blocked by the sandbox and is not part of this report.
- Contrast ratios were computed in-page from `getComputedStyle` colour against the nearest opaque ancestor background, so they are the ratios a user sees, not the ratios implied by the token table.
