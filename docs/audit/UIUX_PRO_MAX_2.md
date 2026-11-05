# Laurel web front end — UI/UX audit, pass 2 (ui-ux-pro-max skill)

Audited 4 Nov 2026 (evening) against the live site https://laurel-near.vercel.app (contract `laurel.laurel-team-mw0x0c8g.testnet`, task 3 closed with champion #4, task 4 open with #6), after the fixes of commit `d50f264` (summary in `docs/UI_DIRECTION.md` §8). Skill: `ui-ux-pro-max` v2.15.0 at `.claude/skills/ui-ux-pro-max/` (not reinstalled), `references/quick-reference.md` and `references/pro-rules.md`; rule ids cited as `[ux: rule-id]`. Routes checked: `#/`, `#/task/3`, `#/task/4`, `#/model/4`, `#/model/6`, `#/costs`, each at 1440 px and 390 px, light and dark (browser pane with `prefers-color-scheme` emulation). Every measurement below came from a script run in the page (contrast from computed colour against the nearest opaque ancestor background, element boxes from `getBoundingClientRect`, overflow from `scrollWidth`/`clientWidth`, timings from `performance.now()` polling at 25–30 ms); keyboard checks used real Tab/Enter key presses. Screenshots: `docs/audit/img/p2-*.jpg`, 16 files, largest 139 KB, taken with headless Chrome at the real viewport size. Nothing under `web/` was changed; nothing committed.

## Status of pass-1 findings S1–S13

| # | Pass-1 finding | Status | Measurement that proves it |
|---|---|---|---|
| S1 | Split B visible on `#/model/6` while task 4 is open | **Fixed (web)** | `#/model/6`: body text contains no `66.50`/`6650`; reading B renders the pill "not yet observed · sealed in the leaderboard until 2026-11-25 23:59 UTC"; plate B is 150 grey `i.na` dots with the same sealed line; raw fold opened shows `"b": "sealed until the exhibit closes"` and the summary says "split B withheld until close". `#/task/4` band text now reads "sealed in the contract's leaderboard until …" (true), scale B has 0 needles, page text has no `66.50`. `#/model/4` (closed task) still shows 66.50 % as it should. Contract view `get_submission(6)` still returns the value (out of scope, unchanged). Screenshots `p2-model6-1440-light-readings.jpg`, `p2-model6-1440-light-raw.jpg`, `p2-task4-1440-light.jpg`. |
| S2 | Home index unusable at 390 px | **Fixed** | `.row` columns at 390 px = `56px 288.4px`; row height 251 px; title wraps to 2 lines; readings `A 71.00 % #6` / `B not yet observed` sit at x 86–374 on their own lines; sealed pill 137 × 23 px inside the viewport; state pill visible (`display: block`); `scrollWidth === clientWidth === 390`. Screenshot `p2-home-390-light-index.jpg`. |
| S3 | Needle labels collide | **Partly fixed** | Needle-to-needle collisions are gone: pixel threshold `minPx = 92` with alternating tiers; 0 label-box overlaps on `#/task/3` scales A and B at 1440 (track 983 px) and 390 (track 358 px), light and dark. New collision instead: the raised tier (`.needle.up`, `bottom: 38px`) is taller than the 74 px track, so its value sits above the track top at every width (`aboveTrack: true` for "75.50 #5 · led" and "66.50 #4 · champion"). At 1440 the head text is left/right of it, so it only looks tall; at 390 the head note wraps onto its own line directly above the track and "66.50" overprints "unsealed 2026-11-04 09:35 UTC" (needle value box y 826–848 vs head box 785–834). See N3. Screenshot `p2-task3-390-light-scales.jpg`. |
| S4 | Accent text 3.17:1 in light mode | **Fixed** | Full-page contrast sweep (every visible text node, 87–183 nodes per route): 0 failures on `#/task/3`, `#/task/4`, `#/model/4`, `#/model/6` in both themes and both widths. `--accent-text #B8431F` on paper = 4.74:1, on plate = 5.44:1; `--tee-text #0B6A5B` on plate = 6.51:1; links are ink + underline; `.pill.open` is ink on paper. Only the cases in N2 and N8 remain, both new. |
| S5 | White on accent/tee in dark mode | **Fixed in dark, regressed in light** | Dark: `predict_task` box = paper-dark `#15161A` on `#FF7A4F` = 7.02:1; TEE box is outlined, `#3FC9B0` on plate = 8.07:1. Light: the same box (SVG `text` 11 px and the phone list item `li.last` 12 px) is `#F2EFE8` on `#E8552A` = **3.17:1**, below AA; pass 1 wrongly assumed paper-on-accent passes. See N2. Screenshots `p2-costs-1440-dark.jpg`, `p2-costs-390-light.jpg`. |
| S6 | Dot plates collapse four cells | **Fixed** | Plates render four classes in true-class order: `#4` split B = 26 `pos` + 19 `pos x` + 80 `neg` + 25 `neg x` = 150, matching the `aria-label` "26 true positive, 19 missed positive, 80 true negative, 25 false alarm"; a key with the three glyphs sits under every plate. |
| S7 | Model-bytes fetch stuck on "loading" | **Fixed, with a new false-error flash** | `Forest` now distinguishes `undefined` (error + retry) from `null` (loading) and reserves the box with `aspect-ratio` (forest box 953 × 381 px at 1440 for 50 trees). But `Task()` passes `s?.bytes` before `subs` is filled, which is `undefined`, so for ~0.8 s on every task page load both specimens show "model bytes unavailable [retry]" and "not scored yet" (measured 489 → 1274 ms after route change on `#/task/3`). See N4. Screenshot `p2-task3-1440-light-band.jpg` catches it. |
| S8 | Method flow illegible at 390 px | **Fixed at 390, regressed at desktop** | 390 px: SVG `display: none`, `ol.flow-v` renders 7 items 36–39 px tall at 12 px mono; `#/costs` no longer scrolls sideways (`scrollWidth` 390; hash line wraps with `overflow-wrap: anywhere`; table 358 px). 1440 px: `ol.flow-v` is **also** rendered (`display: flex`, 300 px tall) under the SVG on both `#/` and `#/costs`, because `.flow-v { display: flex }` is declared after `.only-narrow { display: none }` at equal specificity. See N1. Screenshot `p2-home-1440-light-method-dup.jpg`. |
| S9 | Tree readout hover-only | **Fixed** | Each `g.tree` has `tabindex="0"`, `role="button"`, `aria-label`; a real Tab press from the owner link lands on tree 1, the stroke turns accent (`rgb(232,85,42)`), and the readout line (`aria-live="polite"`) reads "tree 1 · root split: checking_status < 1 · 31 nodes · depth 4"; the next Tab moves to tree 2. Glyphs now vary: 770 distinct stroke widths and three tones on `#/model/4`. Cost: 50 tab stops before the next control (N5), and 26 × 24 px tap targets at 390 px (N6). Screenshot `p2-model4-1440-light-forest.jpg`. |
| S10 | Heading structure, landmarks, titles | **Fixed, with one new defect** | `h1` per route ("Models, observed.", "Exhibit 03: …", "Specimen #6", "How a model becomes infrastructure."), section labels are `h2`; `document.title` = "Exhibits · Laurel", "Exhibit 03 · credit-risk · Laurel", "Exhibit 04 · credit-risk-open · Laurel", "Specimen #6 · Laurel", "Method · Laurel"; skip link is the first Tab stop on a fresh load (ink box at 8,8, 39 px tall) and `main` receives focus on every hash change. But activating the skip link sets the hash to `#main`, which the router reads as a route and renders nothing: `main` text length 1725 → 0. See N0. |
| S11 | 10–11 px text carrying data | **Fixed** | Sweep of text under 12 px: only the tick labels `.tl` (11 px, 12 nodes), the `copy` button (11 px) and the SVG flow labels (11 px, 14.4 px rendered glyph box at 1440). `.row .r .sub`, `.needle .id`, `.label`, `.pill` are 12 px. |
| S12 | Layout shift, static countdown, RPC with id 0 | **Fixed** | `.fig .v` and `.row` have `min-height` (34 px / 112 px) and a `.sk` skeleton; `useView` takes `skip` and `get_submission`/`get_earnings` are skipped while the id is null; `Countdown` re-renders every 60 s. |
| S13 | Favicon, Open Graph, Undo link | **Fixed except the link** | Inline SVG favicon present; `og:title`, `og:description`, `og:image` (`/og.jpg` answers HTTP 200), `twitter:card` present. "sister project: Undo (same team)" in the footer is still plain text, not a link (Q-015 asks the two projects to reference each other). |

## Verdict

The fix pass did what it promised: the sealed split is withheld on every screen, the phone index and header are usable, text contrast now passes AA everywhere the first audit flagged it, the plates and tree glyphs carry real data, keyboard users can read the forest, and every route has a heading, a title and a skip link. Twelve of thirteen findings are fixed or substantially fixed. What the pass introduced is more dangerous than what it left: the skip link, the one control a keyboard or screen-reader user meets first, blanks the page because the hash router treats `#main` as a route; the vertical flow list now renders on desktop as a second copy of the diagram; every exhibit page flashes "model bytes unavailable · not scored yet" for most of a second before the real data lands; and the orange `predict_task` box fails contrast in light mode. All four are one-line fixes. The remaining items (raised needle overprinting the head note at phone width, 50 tab stops through the forest, 26 px tree tap targets, two date formats on one line, the accent "02 — Exhibits" label, a missing `aria-current`) are polish.

## Remaining and new findings, ranked by severity

### N0 · Critical — The skip link blanks the page

- **Where:** `App()` in `web/src/App.jsx`: `<a className="skip" href="#main">` and `useRoute()`, which parses `window.location.hash` as the route.
- **What is wrong:** Pressing Enter on "Skip to content" sets the hash to `#main`. `useRoute` reads `main` as the page, none of the four branches matches, and `<main>` renders empty: measured `main.innerText.length` 1725 → 0 after the click, `location.hash === "#main"`, title still "Exhibits · Laurel". Focus does land on `main`, but there is nothing in it, and Back is the only way out. `[ux: skip-links, keyboard-nav, back-behavior]`
- **Why it matters:** The first Tab on the site leads to an empty page. A screen-reader or keyboard-only juror, or anyone who hits Tab + Enter by habit, loses the whole site; an accessibility reviewer will mark this as a regression against the previous build, which had no skip link.
- **Fix (JSX, one handler):** do not use the hash for the skip target:
  ```jsx
  <a className="skip" href="#main" onClick={(e) => { e.preventDefault(); const m = document.getElementById("main"); m?.focus(); m?.scrollIntoView(); }}>Skip to content</a>
  ```
  and, as a guard in `useRoute`, treat unknown pages as the index: `const known = ["tasks", "task", "model", "costs", "biaya"]; return { page: known.includes(parts[0]) ? parts[0] : "tasks", id: … }`. Keep `main:focus { outline: none }` and the focus on route change.

### N1 · High — The vertical flow list renders on desktop under the SVG (duplicate diagram)

- **Where:** `web/src/style.css`: `.only-narrow { display: none; }` (line 56) and `.flow-v { … display: flex; … }` (line 208); `FlowDiagram()` in `App.jsx`, used on `#/` "03 — Method" and `#/costs` "01 — Flow".
- **What is wrong:** Both rules have specificity 0,1,0; the later `.flow-v` wins, so at 1440 px the `<ol>` is `display: flex` (measured, 300 px tall) and the seven stages appear twice, first as the SVG strip then as the numbered list. At 390 px the SVG is correctly hidden and only the list shows. `[ux: consistency, visual-hierarchy]`
- **Why it matters:** It is the first thing under the fold on the home page and the first section of the Method page, the two pages a juror reads to understand the architecture; a duplicated diagram reads as a build mistake. Screenshot `p2-home-1440-light-method-dup.jpg`.
- **Fix (CSS, two lines):** make the list's own display rule respect the breakpoint:
  ```css
  .flow-v { display: none; margin: 0; padding: 0; list-style: none; counter-reset: st; flex-direction: column; gap: 8px; }
  @media (max-width: 720px) { .flow-v { display: flex; } }
  ```
  (or move `.only-narrow { display: none }` below `.flow-v`; the explicit rule is safer against the next addition).

### N2 · High — The orange `predict_task` box fails contrast in light mode (3.17:1)

- **Where:** `FlowDiagram()`: `<rect fill="var(--accent)">` with `<text fill="var(--paper)">` (11 px) on `#/` and `#/costs` at ≥ 720 px; `.flow-v li.last { background: var(--accent); color: var(--paper); }` (12 px) under 720 px.
- **What is wrong:** `#F2EFE8` on `#E8552A` measures 3.17:1 in light mode (SVG text and list item both). AA for text under 18.66 px bold is 4.5:1. Dark mode is fine (7.02:1) because dark paper is near-black. Pass 1 proposed `var(--paper)` on the assumption it passed; it does not. `[ux: color-contrast, contrast-data, dark-mode-pairing]`
- **Why it matters:** This is the one box that names the product's output (`predict_task`) and it is the least legible label on both pages in the default theme.
- **Fix (CSS/JSX):** use the text-grade accent as the fill in light mode, which keeps the orange box and passes: paper on `--accent-text #B8431F` = 4.74:1 (white on it = 5.44:1). In `FlowDiagram` set `fill={last ? "var(--accent-text)" : "var(--plate)"}` on the rect and keep `var(--paper)` on the text; in CSS `.flow-v li.last { background: var(--accent-text); border-color: var(--accent-text); }`. In dark mode `--accent-text` already equals `--accent`, so nothing changes there. Alternative that stays closer to "no filled cards": outlined box, `fill: var(--plate); stroke: var(--accent); text fill: var(--accent-text)` (5.44:1), matching the TEE box treatment.

### N3 · Medium — Raised needles overflow the track and overprint the head note at phone width

- **Where:** `Scale()` in `components.jsx`, `.scale .needle.up { bottom: 38px }` with `.scale .track { height: 74px }` in `style.css`; `#/task/3` scales A and B.
- **What is wrong:** A raised needle is value (22 px) + id (12 px) + arrow (10 px) + 38 px offset ≈ 88 px, taller than the 74 px track, so its value box starts above the track at every width (`aboveTrack: true` at 1440 and 390). At 1440 the `.head` texts are to the left and right of it, so it only looks tall. At 390 the head wraps and its note line ("unsealed 2026-11-04 09:35 UTC", "balanced accuracy, 50–100 %") lies directly above the track: "66.50" box y 826–848 overlaps the head box 785–834; "75.50" likewise. `[ux: axis-readability, truncation-strategy]`
- **Why it matters:** The sealed-split reading of the champion is the number the whole story turns on, and on a phone it is printed over the unseal date. Screenshot `p2-task3-390-light-scales.jpg`.
- **Fix (CSS):** give the track room for the second tier instead of letting it escape: `.scale .track { height: 96px; }` and `.scale .band { top: 22px; }` (so the band keeps its 74 px look), or `.scale .head { margin-bottom: 20px }` under 720 px. Also at `max-width: 720px` set `.scale .head { flex-direction: column; gap: 2px }` so the note never shares a line with the title and the gap above the track is predictable.

### N4 · Medium — Every exhibit page flashes a false error state while its specimens load

- **Where:** `Task()` in `App.jsx`: `const s = subs[r.submission_id]` is `undefined` until the `Promise.all` resolves; `<Forest bytes={s?.bytes} …>` and `<DotPlate counts={counts} …>` with `counts = raw ? raw[split] : null`.
- **What is wrong:** `Forest` treats `undefined` as "fetch failed" (by design after S7), so each specimen shows "model bytes unavailable [retry]" from the moment the leaderboard arrives until the per-submission fetch returns: measured on `#/task/3` from 489 ms to 1274 ms after route change (≈ 0.8 s, both specimens). In the same window `DotPlate` gets `counts = null` and shows the grey ghost with "not scored yet" under a "scored in TEE" pill, and the caption prints "split B · rows ·" with no count. `[ux: loading-states, error-recovery, progressive-loading]`
- **Why it matters:** An error with a retry button that appears on every page load, then disappears, teaches the reader that the errors on this site are noise. On a slow connection the false state lasts seconds. Screenshot `p2-task3-1440-light-band.jpg` shows it next to the seal band.
- **Fix (JSX):** pass the loading sentinel until the entry exists: `<Forest bytes={s ? s.bytes : null} …>` and for the plate `scored ? (s ? <DotPlate counts={counts} …/> : <DotPlate counts={null} ghostText="reading the evaluator record…" caption={`split ${split.toUpperCase()} · one dot per private test row`} />) : …`. Optionally seed `subs` with `{ [id]: { sub: null, bytes: null } }` placeholders before the fetch starts.

### N5 · Medium — Fifty tab stops through the forest before the next control

- **Where:** `Forest()` with `readout`: every `g.tree` has `tabIndex={0}`; `#/model/4` and `#/model/6` have 67 tabbable elements, 50 of them trees, between the owner link and the provenance copy buttons.
- **What is wrong:** Keyboard access works (S9), but a keyboard user who wants the copy buttons or the raw JSON fold has to press Tab 50 times, and a 500-tree model would need 500. `[ux: keyboard-nav, focusable-elements]`
- **Fix (JSX, roving tabindex):** keep one tab stop on the plate and move with the arrow keys: `tabIndex={i === (picked ?? 0) ? 0 : -1}` on each `g`, and on the `<svg>` an `onKeyDown` that handles `ArrowRight/ArrowLeft` (±1), `ArrowDown/ArrowUp` (±cols), `Home/End`, then `setPicked(j)` and `focus()` the target `g` (hold `g` refs in an array). Extend the readout's idle text to "… arrow keys move between trees". Add `role="group" aria-label="decision trees"` on the svg.

### N6 · Medium — Tree glyphs are 26 × 24 px tap targets on a phone

- **Where:** `Forest()` on `#/model/*` at 390 px: measured `g.tree` box 26 × 24 px (10 columns in a 330 px plate); on `#/task/*` specimens at `cell=40` they are smaller still.
- **What is wrong:** The readout is the only interactive moment on the site and the skill's floor for touch targets is 44 pt. `[ux: touch-target-size, touch-target-chart, touch-spacing]`
- **Fix (JSX):** under 720 px render the model plate with 5 columns (a small `useMedia("(max-width: 720px)")` hook → `cols={narrow ? 5 : 10}`), which gives ≈ 64 px cells, or resolve taps by position: one `onPointerDown` on the `<svg>` that maps `(x, y)` to the nearest cell and calls `setPicked`, so any touch inside the plate picks a tree regardless of glyph size. Keep the specimen plates on task pages non-interactive as they are.

### N7 · Low — Two date formats for the same deadline on one line

- **Where:** `Countdown` in `components.jsx` (`d.toLocaleString()`), used on `#/` rows and the `#/task/4` subtitle: "21d 9h left · 11/26/2026, 6:59:00 AM", next to the band and the model page which print `fmtDate` "2026-11-25 23:59 UTC". Closed tasks also use `fmtDate` ("closed 2026-11-04 09:35 UTC").
- **Fix (JSX):** `<span>{…} left · {fmtDate(ns)}</span>` so every date on the site is ISO-style UTC; if local time is wanted, put it in a `title` attribute.

### N8 · Low — Inconsistent section-label colour, and decorative arrows under contrast

- **Where:** `#/` row head `<span className="accent-text">02 — Exhibits</span>` is accent (`rgb(184,67,31)`, 4.74:1) while every other `Sec` is mist; `.flow .arrow { color: var(--rule) }` renders the three "→" between method phrases at 1.31:1 (light) / 1.36:1 (dark), the only text nodes under 3:1 on the home page.
- **Fix:** render the row head label with `<Sec n="02" title="Exhibits" />` (it becomes an `h2` too, which the index currently lacks), and mark the arrows decorative: `<span className="arrow" aria-hidden="true">→</span>`; if they should be read, use `var(--mist)` (4.6:1).

### N9 · Low — Active nav state is colour-only and `aria-current` is missing

- **Where:** `header nav a.on` (ink vs mist); `#/task/*` and `#/model/*` both mark "Exhibits" as on.
- **Fix:** add `aria-current={on ? "page" : undefined}` and a non-colour cue such as `header nav a.on { text-decoration: underline; text-underline-offset: 6px; }` or a 1.5 px bottom rule. `[ux: color-not-only, navigation-consistency]`

### N10 · Low — Leftovers from pass 1

- "sister project: Undo (same team)" is still not a link (S13); add an `href` to the Undo repo or site.
- The seal band is removed, not lifted: `showBand` becomes false the moment `lifted` flips, so the element unmounts at ≈ 1000 ms with `opacity: 1` and the `.band.lift` transition (600 ms) never plays (polled every 25 ms: `band|op=1` → `none`). Either keep the band mounted while it fades (a second state set 600 ms after `lifted`) or delete the dead rule. The band itself does render for ≈ 460 ms on closed tasks, as promised; screenshot `p2-task3-1440-light-band.jpg`.
- The error copy for a missing id is "RPC error: submission 99 not found"; it is not an RPC error. `Err` could take a prefix prop, or the screens could pass a plain message.
- `.flow-v li.last::before` (the "07" counter) inherits the same 3.17:1 pair as N2; the N2 fix covers it.

## What the pass got right (keep)

- Split B is withheld consistently: reading, plate, raw fold, task band and leaderboard all say the same thing, and the band copy is now literally true.
- The phone index: 56 px numeral column, labelled A/B readings, pill wraps, state pill visible, 56 px header. No horizontal scroll on any route at 390 px in either theme.
- Contrast: 0 failures in a full text sweep on five of six routes in both themes; the `--accent-text`/`--tee-text` split keeps the orange for marks and the 72 px readings.
- The slopegraph between the scales (2 lines, winner in accent, 26 px, no overlap with tick labels at either width) and the "The lines cross" sentence are the clearest telling of the story on the site.
- Plates: four confusion classes in order with a key and a full `aria-label`; this is now a real figure.
- Forest: keyboard-reachable, focus shows as an accent stroke, readout line is `aria-live`, glyphs vary by leaf weight and feature tone, reserved aspect ratio so the page does not jump.
- Headings, titles, skip-link position and styling, `main` focus on route change, favicon, Open Graph with a resolving image, error state with retry on unknown ids.

## Method notes

- Contrast was computed per text node from `getComputedStyle(el).color` against the nearest opaque ancestor background (alpha composited), with the 3:1 allowance for ≥ 24 px or ≥ 18.66 px bold text; SVG text was measured separately from `fill` against the box `fill`.
- Needle collisions: bounding boxes of `.needle .v` and `.needle .id` compared pairwise within each scale; raised-tier overflow compared against `.track` and `.head` boxes.
- Timings: `location.hash` set in-page, then polling at 25–30 ms for `.band` presence/class, `.needle.on` count, `.forest .err` count and plate caption text.
- Keyboard: real Tab/Enter key events through the browser pane; the skip-link test was repeated after a full reload so that focus started at the document.
- Screenshots: headless Chrome driven over the DevTools protocol (device metrics + `prefers-color-scheme` emulation), JPEG quality 72, viewport-sized captures after scrolling the relevant section into view.
- The skill's `--design-system` generator was not run (not needed for a verification pass); `quick-reference.md` rule ids were used as the checklist.
