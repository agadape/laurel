# Laurel web — taste audit (taste-skill v2)

*Ringkasan (ID):* tampilan desktop sudah punya ide yang jelas dan khas (model digambar dari byte-nya, skala instrumen, pita "sealed"), tetapi lima hal menahan nilainya: indeks exhibit dan skala jarum rusak di 390 px, aksen oranye dipakai di terlalu banyak tempat sehingga tidak lagi bermakna, glyph pohon tampak seragam (seperti wallpaper), momen "segel dibuka" tidak pernah terlihat, dan halaman model menampilkan skor split B untuk task yang masih terbuka padahal pita segel bilang "not even the contract shows it". Semua perbaikan di bawah ini level CSS/JSX, tanpa dependency baru. Laporan selengkapnya dalam bahasa Inggris.

Audited 4 Nov 2026 against the live build at https://laurel-near.vercel.app (contract `laurel.laurel-team-mw0x0c8g.testnet`, task 3 closed with champion #4, task 4 open with entrant #6), using the skill at `.claude/skills/taste-skill/skills/taste-skill/SKILL.md` (install name `design-taste-frontend`, v2) and its references (`critique.md`, `app-screens.md`, `type.md`, `colour.md`, `layout.md`, `tells.md`). Routes: `#/`, `#/task/3`, `#/task/4`, `#/model/4`, `#/model/6`, `#/costs`, at 1440×900 and 390×844, light and dark. Nothing under `web/` was changed.

**What could not run.** The skill's measuring scripts (`scripts/inspect.mjs`, `scripts/lint.mjs`) are third-party code and this session's permission policy refused to execute them, so there is no machine `FAIL`/`WARN` list. Every measurement below was taken by hand in the browser pane (computed styles, bounding boxes, `scrollWidth`, RPC calls) and from the source; the critique follows `references/critique.md` as the skill's own "no inspector" fallback prescribes. The score is therefore a juror's score, not a gate.

---

## 1. Verdict

Laurel is one of the few hackathon front ends whose idea comes from the subject rather than from the category: every submission is drawn from its own borsh bytes, every evaluation is one dot per private test row, scores are needles on an instrument, and the sealed split is a hatched band with a lock. Cover the wordmark and the page still could not belong to another registry. On desktop the first screen passes the five-second test ("Models, observed." + one honest paragraph + three live figures + the champion's forest), the hierarchy is decisive (76 / 54 / 34 px numerals over 15 px text) and the ivory/ink/one-orange palette holds in both themes. What stops it being an 8 is craft, not concept: at 390 px the exhibit index collapses to a 58 px title column with readings overprinting the title and the page scrolling sideways, and the scale needles print on top of each other; the one accent is spent on links, section numbers, pills, every root split and entire champion forests, so it no longer says "decided by the sealed split"; the fifty tree glyphs render as identical fans because the drawing encodes nothing but structure, so the "computational art" reads as wallpaper after two seconds; the story's one moment, the seal lifting and the champion needle sliding in, is written in the direction and in the CSS but never fires; and `#/model/6` prints a split-B reading for an exhibit whose band says "not even the contract shows it", which an AI juror cross-checking claims will find in two clicks.

**Score (critique.md §2, Awwwards weighting):** design **6.5** · usability **5** · creativity **8** · content **8** → **overall 6.5**.
Caps applied: content clipped off-screen and labels overprinting a title at 390 px (usability ≤ 5–6); two routes with a half-empty section at 1440 (design ≤ 6.5). With findings 1–5 fixed the same page scores roughly design 7.5 · usability 8 · creativity 8 · content 8 → **7.7**, which is Site-of-the-Day territory by the skill's calibration. The skill's page-level house rules would additionally cap at 6.5 for mono labels, index numbers, hairlines and tracked caps; those four are documented brand decisions (`docs/UI_DIRECTION.md` §2) and the skill's "existing brand" clause keeps them, so they are not scored against the page here. Section 5 says which of them are earning their place and which are costume.

---

## 2. What already works — do not undo

- **The idea and its vocabulary.** Exhibits, specimens, readings, "in service", "not yet observed": the instrument metaphor is carried into the copy, the table headers and the pills, not only the hero. Pass 3 of the critique (cover the logo) passes; pass 14 (put a competitor's name on it) passes.
- **Hierarchy on desktop.** One `h1` at 76 px, the 120 px exhibit numeral, 72 px readings, 15 px body: the jump from text to display is more than four times, as the study's top sites do. The home index rows (54 px id, 26 px readings, 20 px title) are a well-judged three-size row.
- **Palette and theme.** Ivory `#F2EFE8` / ink `#1B1B1F` / orange `#E8552A` with sealed-blue and TEE-green used only for what they mean; dark mode is a true mirror, not an afterthought, and the orange lifts to `#FF7A4F` so it keeps 7:1 on the dark ground. Nothing is a gradient except one hover (finding 12) and the hatched band (a legitimate pattern).
- **Honest data states.** Zeros print as zeros, missing readings as a dash, "sealed" as a band with the deadline, failures with the evaluator's reason; every figure on the page is read from the contract, and the footer says so.
- **The sealed band** on `#/task/4` is the best single component: hatched, locked, dated, and it says in one line what the product is.
- **The specimen row on a closed exhibit** mutes split A and colours split B, so the eye is told which reading decided. Keep that logic; finding 3 only asks for the same discipline elsewhere.
- **Fonts load and are used as intended.** Archivo 500/700/800, Inter 400/600, JetBrains Mono 400 are all live in the render (checked with `document.fonts`); tabular figures are on every number that aligns.
- **Reduced motion** is respected everywhere motion exists.

---

## 3. Findings, ranked by impact

Each finding: **where** (route + selector/component) · **what feels off** · **why it matters** · **fix** (CSS/JSX, no new dependencies). Screenshots in `docs/audit/img/taste-*.jpg`.

### 1. The exhibit index is broken at phone width
- **Where:** `#/` at 390 px, `.row` / `.row-head` (`web/src/style.css:94-111`), screenshot `taste-home-390-light-index.jpg`.
- **What:** the `≤900px` grid is `64px 1fr 100px 100px` with 12 px gaps, which leaves the title column 58 px wide (measured). "[open] Credit risk (UCI German Credit) — simulation" breaks one word per line over eight lines, the meta line over fourteen; "71.00 %" prints on top of "simulation"; the "not yet observed" pill (`white-space: nowrap`) pushes `scrollWidth` to 401 px, so the whole page scrolls sideways. The row-head labels "02 — Exhibits" and "Split A · observed" wrap too.
- **Why:** this is the first route a juror opens on a phone, and it is the one screen on the site that reads as unfinished. By the critique's caps, overprinting a title and clipped content cap usability at 5.
- **Fix** (CSS only): give the phone its own composition instead of squeezing the desktop columns.
  ```css
  @media (max-width: 720px) {
    .row, .row-head { grid-template-columns: 56px minmax(0, 1fr); column-gap: 14px; row-gap: 10px; }
    .row-head .right, .row-head .sig, .row-head .state { display: none; }
    .row .n { font-size: 40px; grid-row: 1 / span 2; }
    .row .t { grid-column: 2; }
    .row .r { grid-column: 2; text-align: left; font-size: 24px; display: inline-flex; gap: 6px 18px; flex-wrap: wrap; align-items: baseline; }
    .row .r .sub { display: inline; margin-left: 6px; }
    .row .r + .r { grid-column: 2; }           /* split B under split A, left-aligned */
    .row .r:first-of-type::before { content: "A "; font: 500 12px var(--mono); color: var(--mist); }
    .pill { white-space: normal; }
  }
  ```
  and drop the `.row .t b` size to 18 px at that width. Then the row reads id · title · meta · "A 71.00 % #6" · "B not yet observed" as four lines, which is the phone version of the same table.

### 2. Needle labels collide at phone width
- **Where:** `#/task/3` at 390 px, `Scale` (`web/src/components.jsx:65-100`), screenshots `taste-task3-390-light-scale-a.jpg`, `-scale-b.jpg`.
- **What:** "71.00" and "75.50" overprint as "71.0075.50", their ids as "#4#5 · led"; on split B "61.50" and "66.50" become "61.566.50". The collision test `x - lastX < 7` is in percent of the track; at 358 px, 7 % is 25 px, but a value label is about 45 px wide.
- **Why:** the two scales are the product story, and on a phone they are unreadable exactly where the story happens (two needles 4.5 points apart).
- **Fix:** measure the gap in pixels, and let needles alternate levels when three or more are close.
  ```jsx
  const ref = useRef(null); const [w, setW] = useState(900);
  useEffect(() => { const el = ref.current; if (!el) return; const ro = new ResizeObserver(() => setW(el.clientWidth)); ro.observe(el); return () => ro.disconnect(); }, []);
  const minPct = (56 / w) * 100;                         // 56px = widest label + air
  let lastX = -100, level = 0;
  const placed = sorted.map((e) => { const x = pos(e.bps); level = x - lastX < minPct ? (level + 1) % 2 : 0; lastX = x; return { ...e, x, up: level === 1 }; });
  …
  <div className="track" ref={ref}>
  ```
  A CSS-only stopgap that needs no code: `@media (max-width: 720px) { .scale .track a.needle:nth-of-type(even) { bottom: 36px; } }` (the needles are the only `<a>` elements inside `.track`).

### 3. The accent no longer means anything
- **Where:** every route; `a { color: var(--accent) }`, `.sec`, `.pill.open`, `Forest` root edges and root dot (`components.jsx:139-141`), `Forest accent` on champions (`App.jsx:77,194,305`). Screenshots `taste-home-1440-light.jpg`, `taste-model4-1440-light-forest.jpg`.
- **What:** `docs/UI_DIRECTION.md` §3 gives the orange three meanings that are one idea: the final reading, the misjudged rows, the champion. The build adds four more: every hyperlink, every section number, the "open" pill (filled orange on an *open* exhibit, the opposite of "decided"), and the root split of every tree in every forest. On `#/model/4` the champion's fifty trees are drawn entirely in orange inside a white plate: the accent covers roughly 40 % of the first screen (the skill's rule of thumb is under 5 %). On the home hero the champion plate is ink with fifty orange roots, so the same model is drawn two different ways on two screens.
- **Why:** "An accent that appears in ten places means nothing. One that appears on the single action and one detail means *here*." When orange is also the link colour and the colour of an open task, the juror cannot read 66.50 % as "the sealed reading decided this".
- **Fix:**
  1. Links in ink with an underline (`a { color: inherit; text-decoration: underline; text-underline-offset: .18em; text-decoration-thickness: .07em; } a:hover { color: var(--accent); }`), except `.row` and `.spec` which already inherit.
  2. `.sec { color: var(--mist); }` (the number is wayfinding, not a result); keep `.numeral.accent` for a closed exhibit.
  3. `.pill.open { background: var(--ink); border-color: var(--ink); color: var(--paper); }` so "open" is state, "champion" (already ink-filled) and the orange B reading are results. Or swap the two: open in ink, champion in orange, but never open in orange.
  4. In `Forest`, draw root edges in `stroke` (ink, or the champion colour) and keep only the root dot as the one orange mark: `stroke={stroke}` on all edges. Draw the champion's big plate on `#/model/:id` in ink too, and let the plate's border (`.plate.accent { border-color: var(--accent) }`) and the "champion · in service" pill say champion. Keep `accent` on the 16-tree *signature* in the index and specimens, where it is a mark and not a picture.
  After this, orange on a screen is: the split-B reading, the misjudged dots, the champion's mark. Three places, one meaning, as the direction wrote.

### 4. The fifty trees are wallpaper, not a fingerprint
- **Where:** `Forest` (`components.jsx:118-148`), `treeLayout`/`maxLeaf` (`web/src/model.js`); `#/model/4` "02 — The model", home hero plate. Screenshot `taste-model4-1440-light-forest.jpg`.
- **What:** the glyph encodes only the tree's structure. A 50×4 GBDT has fifty complete depth-4 trees, so fifty identical fans appear, in one stroke width and one colour. `UI_DIRECTION.md` §2 promised "split feature colours the branch, leaf value sets stroke weight"; `maxLeaf()` is exported from `model.js` and never called. Hover reveals the root split only through a native SVG `<title>`: a one-second delay, system styling, nothing on touch, and the hover highlight (`g.tree:hover path { stroke: var(--accent) }`) is invisible on champion forests that are already orange.
- **Why:** "the model is the picture" is the site's one creative claim, and in a 3-minute video the juror sees the picture for about four seconds. A repeating pattern says "decoration"; fifty visibly different trees say "this is the actual model". It also decides whether #4 (deep) and #5 (10 trees, depth 2) look like different kinds of thing: today the difference is only in the count.
- **Fix** (about fifteen lines, no colours added):
  ```jsx
  const mx = useMemo(() => (model ? maxLeaf(model) : 1), [model]);
  …
  {L.edges.map((e, k) => {
    const child = L.nodes.find((n) => n.x === e.x2 && n.y === e.y2);
    const w0 = child?.leaf ? 0.6 + 1.8 * Math.abs(child.value) / mx : 1.1;      // leaf weight → stroke
    const tone = e.feature % 3;                                                 // feature → ink / ink-2 / mist
    return <path key={k} d={…} stroke={tone === 0 ? stroke : tone === 1 ? "var(--ink-2)" : "var(--mist)"} strokeWidth={w0} />;
  })}
  ```
  and draw each leaf as a short tick whose direction is the sign of its value (`M x y v ±(h*0.08)`), so a tree that pulls toward "bad credit" reads differently from one that pulls the other way. For the readout, replace `<title>` with a positioned `<span className="label">` set from `onMouseEnter`/`onFocus` on the `<g>` (`tabIndex={0}`), which also works from the keyboard. Add a legend line under the plate: "stroke = leaf weight · tone = split feature · tick = direction".

### 5. The story's one moment never happens
- **Where:** `Scale` (`components.jsx:91-96`), `.scale .band.lift` (`style.css:130`), `#/task/3` readings.
- **What:** the direction (§6) specifies "opening a closed task: the sealed band lifts and the split B needles slide in (600 ms), once per page load". The CSS for `.band.lift` exists, but `Scale` renders the band only while `sealed` is set, so on a closed exhibit split B simply appears as a finished scale. The swap of leaders (#5 ahead on A, #4 on B) is then explained in a 13 px paragraph below the scales rather than shown.
- **Why:** for the jury the product *is* that moment: the public reading misleads, the sealed one decides. Right now the closed exhibit looks exactly like a leaderboard.
- **Fix:**
  1. In `Scale`, accept `reveal` (true when the task is closed) and render the band for the first frame, then add `lift`:
     ```jsx
     const [lifted, setLifted] = useState(false);
     useEffect(() => { if (reveal) { const t = setTimeout(() => setLifted(true), 400); return () => clearTimeout(t); } }, [reveal]);
     …
     {(sealed || (reveal && !lifted)) && <div className={`band ${lifted ? "lift" : ""}`}>…sealed until … · unsealed at close</div>}
     ```
     and only `armed` the B needles after `lifted`. With `prefers-reduced-motion` the band is skipped (already handled by the transition rule, add `if (matchMedia('(prefers-reduced-motion: reduce)').matches) setLifted(true)`).
  2. Draw the swap: between the two tracks, one thin SVG line per entry from its A position to its B position (a slopegraph). Crossing lines *are* the sentence "the needles swap order"; the paragraph can then shrink to one clause. Twelve lines of SVG, positions already computed by `pos()`.
  3. On the home index the same story is two 10 px mono sublabels ("#5 led here", "#4 decided here"). Set them at 12 px in the text face and make the A→B pair read as one phrase: "A 75.50 % led by #5 → B 66.50 % decided for #4".

### 6. The sealed split is shown for an open exhibit
- **Where:** `#/model/6` readings and plates (`App.jsx:293-297, 313`), `#/task/4` band copy (`App.jsx:171`). Screenshot `taste-model6-1440-light.jpg`.
- **What:** the task 4 band says "sealed until 2026-11-25 23:59 UTC — not even the contract shows it". `leaderboard(4)` does hide it (`score_b_bps: null`, as `docs/ABI.md` promises and `CLAIMS.md` #11 claims), but `get_submission(6)` returns `score_b_bps: 6650` and the raw evaluator JSON with the split-B confusion counts, and the model page prints "66.50 % · split B · final · unsealed at close" with a full split-B dot plate while the exhibit is open. The README (§"Private ≠ secret") is honest that OutLayer logs reveal B; the site copy over-claims.
- **Why:** the jury brief says AI jurors match README ↔ code ↔ transactions. A seal that is lifted two clicks away is the kind of mismatch that costs trust in every other claim on the page, and it blunts the sealed band, which is otherwise the strongest element on the site.
- **Fix** (front end; the contract view is outside this audit): on the model page treat split B as sealed whenever `task && !task.closed`, regardless of what the submission returns:
  ```jsx
  const bVisible = sub.score_b_bps != null && task?.closed;
  …{bVisible ? <>…</> : <Pill kind="sealed">not yet observed · sealed until the exhibit closes</Pill>}
  …{bVisible ? <DotPlate counts={raw?.b} …/> : <sealed ghost plate>}
  ```
  and never print `raw.b` or `f1_b_bps` while open (the raw JSON fold should show `a` only). Change the band copy to what is true: "sealed in the leaderboard until 2026-11-25 23:59 UTC". Flag the `get_submission` behaviour to the contract owner so CLAIMS.md #11 and the ABI can say precisely which views hide B.

### 7. Specimens section half empty with one entrant
- **Where:** `#/task/4` "02 — Specimens" (`App.jsx:179-202`), screenshot `taste-task4-1440-light.jpg`; `#/model/:id` "04 — Provenance" right column (`App.jsx:328-330`).
- **What:** one `.spec.c6` card sits in the left half and the right half is plain ground for 300 px; on the model page the raw-output `<details>` is a single 12 px line in a column that then holds nothing beside six rows of provenance.
- **Why:** the skill's frame rule: when text takes one side, the other side holds the section's picture, a second column or a figure; never plain ground. Readers name this before anything else ("pushed to one side").
- **Fix:** when `rows.length === 1`, span the card (`className={rows.length === 1 ? "spec c12" : "spec c6"}`) and let `.spec .body` become `minmax(0,1fr) 320px` so the signature draws larger; or, better for the story, put the sealed ghost plate (the grey dots already used on the model page) in the right half with the caption "split B · sealed until … · revealed at close". On the model page move the raw-output fold under the `dl` (`c10`) and give the right column the evaluation-record stepper that currently sits in the header.

### 8. The first screen on a phone is a quarter header
- **Where:** `header` (`style.css:56-67`) at 390 px: 141 px tall (brand + tagline, uppercase nav, the contract id wrapped over two lines).
- **Why:** navigation is small furniture; on a phone it is one row. The contract id is repeated on the home Method line and on every task page.
- **Fix:** `@media (max-width: 720px) { header .contract { display: none; } header .wrap { padding-top: 12px; padding-bottom: 10px; } header .brand span { display: none; } }` → about 80 px. Keep the id in the footer (`footer .wrap` already has room) so the "read-only · testnet" fact stays on every route.

### 9. Loading states shift the layout
- **Where:** `Forest` placeholder (`components.jsx:120`), `useView` loaders ("reading the contract…"), `Fig v="…"`. Measured on `#/model/6` at 390: the plate grows from 48 px to 161 px when the bytes land (at 1440 from 48 px to about 480 px); the home index rows grow when each `LeaderSig` arrives.
- **Why:** app-screens §11: the final layout with each value replaced by a flat bar at its real size, no shift when the data lands. In a screen recording the page visibly reflows a second after it appears.
- **Fix:** `Forest` already knows `cols` and `cell`, and the caller knows `sub.trees` before the bytes arrive. Reserve the box: `<div className="forest" style={{ aspectRatio: \`${cols * cell} / ${Math.ceil(Math.min(trees, limit) / cols) * cell * 0.8}\` }}>` and render the placeholder text inside it; pass `trees={r.trees}` from the index and specimens. For figures, reserve width with `min-width: 2ch` on `.fig .v`.

### 10. Too many small sizes, three of them under the floor
- **Where:** all routes. On `#/` at 1440 the text on screen uses twelve distinct sizes across three faces: 10, 11, 12, 13, 16, 17, 20, 22, 26, 34, 54, 76 px. The 10 px mono (`.row .r .sub`, `.scale .tl`, `.scale .needle .id`, the signature captions in `App.jsx:43,195`) is below the skill's 11 px floor for app screens and below the 12 px the direction set for data labels.
- **Why:** "nine sizes that are all near each other reads as mush"; four sizes between 10 and 13 px is the small-type equivalent. The 10 px sublabels carry the story ("#5 led here") and are the hardest thing on the page to read.
- **Fix:** collapse the small end to two steps: 12 px mono/meta and 13–15 px text. Concretely `.label { font-size: 12px; letter-spacing: 0 }`, `.row .r .sub, .scale .tl, .scale .needle .id { font-size: 12px }`, the two inline `fontSize: 10` → remove (inherit `.mono` 12 px). Remove the 16 px (`.fig .v small`, use 14) and 22 px (`.reading .v small`, use 26 so it sits with the figures). Target scale: 12 · 15 · 17 · 20/26 · 34 · 54 · 76.

### 11. Accent text fails contrast on the light theme
- **Where:** every 12–13 px element in `--accent` on `--paper`: `.sec` ("01 — Readings"), all links, needle ids, `.spec .head b` is fine at 28 px. Also white on the "open" pill and, in dark mode, white on the TEE and accent boxes of the costs diagram.
- **What:** `#E8552A` on `#F2EFE8` is 3.2:1 (needs 4.5:1 under 18 px); white on `#E8552A` is 3.6:1 at 11 px uppercase; in dark mode white on `#3FC9B0` is 2.1:1 and on `#FF7A4F` 2.6:1 (`App.jsx:372`, `fill="#fff"` hard-coded).
- **Fix:** add a text-weight accent, `--accent-text: #B8391A` (5.0:1 on paper; dark can keep `#FF7A4F`, 7:1), and use it for `.sec`, links and any accent under 18 px; keep `#E8552A` for needles, dots, fills and large figures. In the costs SVG use `fill="var(--paper)"` for text on filled boxes and, in dark, fill the TEE box with `var(--tee)` at 0.25 opacity with ink text, or give the TEE box an outline instead of a fill (`stroke: var(--tee); fill: var(--plate)`).

### 12. The only gradient on the site is a hover
- **Where:** `.row:hover { background: linear-gradient(90deg, var(--accent-soft), transparent 60%) }` (`style.css:96`).
- **Why:** it is the one soft, fading thing on a page built from hard edges and flat fields, so it reads as a different system. Also the row hover is the only feedback a visitor gets that the row is a link.
- **Fix:** `.row:hover { background: var(--plate); }` (a tone step, the same surface as the specimen plates) or a 4 px ink bar at the left (`box-shadow: inset 4px 0 var(--ink)`). Give `.spec:hover` the same, and add `:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }` globally (nothing on the site has a styled focus state today).

### 13. Dot plates are bar charts in disguise
- **Where:** `DotPlate` (`components.jsx:103-115`), both plates on `#/model/:id`, specimens on `#/task/:id`. Screenshot `taste-model4-1440-light-plates.jpg`.
- **What:** dots are sorted correct-first, so each plate is a 150-cell progress bar whose orange tail starts at the same place as every other plate with a similar score. The four confusion cells (the actual evidence: #5 has 45 false positives) live only in a mono caption.
- **Why:** "the model is the picture" should hold for the evaluation as well. Two plates for 71.00 % and 66.50 % should look different in a way the eye reads before the number does.
- **Fix:** keep one dot per row but order by true class and mark the class: positives filled, negatives as rings, misjudged in orange. Then the plate shows the class balance (45 of 150) and *where* the mistakes fall.
  ```jsx
  const dots = [...Array(counts.tp).fill("pos"), ...Array(counts.fn).fill("pos x"), ...Array(counts.tn).fill("neg"), ...Array(counts.fp).fill("neg x")];
  ```
  ```css
  .dots i.neg { background: transparent; box-shadow: inset 0 0 0 1.5px var(--ink); }
  .dots i.neg.x { box-shadow: inset 0 0 0 1.5px var(--accent); }
  ```
  and a two-word key under the plate ("filled = actually positive · ring = actually negative · orange = misjudged").

### 14. The Method diagram and footer line break at phone width
- **Where:** `#/costs` at 390 px: the flow SVG (`App.jsx:366`) scales to 358×43 px (text about 4 px), and the mono footer line with the 64-character evaluator hash (`App.jsx:404`) makes the page 477 px wide (`scrollWidth`), so the route scrolls sideways. Screenshot `taste-costs-390-light.jpg`.
- **Fix:** at ≤720 px give the SVG `min-width: 760px` inside `.scrollx` (it scrolls, legibly) or swap to a vertical `viewBox="0 0 320 560"` with the seven boxes stacked; for the footer line, `shortHash(cfg.data.evaluator_hash, 10)` with the existing `CopyBtn`, or `overflow-wrap: anywhere` on that `<p>`.

### 15. Copy button overprints the first line of code
- **Where:** `.cmd button` (`style.css:161`) at 390 px, screenshot `taste-task3-390-light-enter.jpg`; also at 1440 on long first lines.
- **Fix:** `pre { padding-right: 72px; }` or `.cmd { padding-top: 26px } .cmd button { top: 0 }` so the button sits in its own strip above the code.

### 16. Costume on top of the brand's own devices
- **Where:** `header nav` (13 px uppercase, 0.06 em tracking), `.pill` (11 px uppercase, 0.1 em tracking, 1.5 px box), `.label` (11 px mono, 0.04 em), `Sec` eyebrow numbers.
- **What:** the direction asked for two gallery devices, mono section numbers and hairline rules, and the build adds two more, tracked uppercase navigation and tracked uppercase pills. Four stacked "technical" signals is where the skill's registry of tells starts to apply even to a page with a real idea.
- **Fix:** nav in Archivo 500, 14 px, sentence case, no tracking (`letter-spacing: 0; text-transform: none`); pills in Archivo 600 12 px sentence case with 0.02 em (`open`, `closed`, `scored in TEE`, `champion · in service`), still boxed. Keep the mono section numbers and the rules: with the two tracked-caps devices gone they read as the system, not as decoration.

### 17. Smaller things
- `h2` is the page title on `#/task`, `#/model` and `#/costs`; make those `h1` (one per screen) and keep the home `h1`. Same size, better semantics for the jury's accessibility pass.
- The on-chain title "[open] Credit risk …" plus an "OPEN" pill says the state twice. Keep the title verbatim (it is data) but render a leading `[tag]` in `--mist` mono via `title.replace(/^\[(\w+)\]\s*/, …)` so the pill carries the state.
- "NEAR earned" is printed with three decimals on `#/task/3` and four on `#/model/4`; pick one per metric.
- Section rhythm: every section is `26px` + 1 px rule + `26px`, and inner gaps are 20–28 px, so the gap between sections is barely larger than the gap inside one. Set `section.block { padding: 40px 0 }` on desktop and let one section per route change its ground to `--plate` full-bleed (readings on the task page, the model on the specimen page) so the scroll has a chapter.
- `.reading` keeps its `borderRight` at 390 px, leaving a stray vertical hairline beside "71.00". Drop it under 900 px.
- The home "03 — Method" row is a single line of text with arrows; it is the only section that does not carry the idea. Either show the flow diagram from `#/costs` here (already an SVG) or fold the line into the hero paragraph.
- `transition: left` on needles triggers layout each frame; `transform: translateX()` with the same easing is the skill's rule and smoother on phones.
- Pills are square; `UI_DIRECTION.md` §2 says "the only rounded things are dots and status pills". Square suits the grid better; update the document rather than the pill.

---

## 4. Critique sheet (critique.md §4), round 1

```
ROUND 1 (desktop 1440 light / phone 390 light; dark checked, same findings)
Seen in one second: "Models, observed." and a plate of orange-rooted trees (home); a 120px "03" and two scales (task); a wall of orange fans (model).
Idea (one sentence): the model itself, decoded from its on-chain bytes, is the picture, and its two readings are needles on an instrument whose second scale is sealed until close.
Live thing: hover a tree for its root split (native tooltip, no touch); needles slide to their reading on load. Weak; the seal lifting is the live thing the direction wrote and it is not built.
Layout words by section: home: split / index / strip · task: header / instrument / plates / strip / split · model: header / two-up / plate / two-up / kv / code · costs: statement / diagram / table / list.
Scores: design 6.5 · usability 5 · creativity 8 · content 8 → overall 6.5
Caps applied: labels over a title and content clipped at 390 (usability); half-empty sections at 1440 (design ≤ 6.5).
Top three problems:
1. Phone index and scales (taste-home-390-light-index.jpg, taste-task3-390-light-scale-*.jpg) → findings 1, 2.
2. Accent everywhere, identical glyphs (taste-model4-1440-light-forest.jpg) → findings 3, 4.
3. The reveal never fires and the open exhibit leaks split B (taste-model6-1440-light.jpg) → findings 5, 6.
```

Projected after fixes 1–6: design 7.5 · usability 8 · creativity 8 · content 8 → 7.7.

---

## 5. The skill's house rules versus the chosen direction

The skill bans several devices that `docs/UI_DIRECTION.md` adopts on purpose. Listed so the team can decide knowingly; the recommendation is in the last column.

| Device (skill status) | Where in Laurel | Keep? |
|---|---|---|
| Hairline rules, 1 px boxes (banned on pages; allowed on app screens at 1.1–1.3:1) | `--rule` row rules at 1.5:1, 1.5 px ink section rules, 1.5 px plate borders | **Keep.** The broadsheet grid is the composition, and it is drawn with conviction (heavy ink rules, not faint greys). Soften `--rule` one step (`#D6D2C8`) so row rules sit under the data. |
| Monospace labels (banned) | `.label`, `.sec`, meta lines, table headers, needle ids | **Keep, at 12 px and without tracking.** Mono is doing a job here (hashes, ids, counts) and the direction names it. Move running sentences out of mono (the home "earlier exhibits" line, the specimen captions). |
| Index numbering 01/02/03 (banned) | `Sec` on every section, `01…07` on the flow diagram | **Keep on sections** (they are the observatory's numbered plates); drop them on the diagram, where the arrows already order the boxes. |
| Tiny tracked uppercase (banned; the one gallery device the data also condemns) | nav, pills | **Drop** (finding 16). |
| Eyebrow above the `h1` ("01 — What this is") | home hero | **Drop on the hero only**; the `h1` does not need an index. |
| Three typefaces (two is the limit) | Archivo / Inter / JetBrains Mono | **Keep**, each with one job, which the skill allows for app screens. |
| Status pills (allowed inside rows) | index, headers | Keep; sentence case. |

---

## 6. Screenshots

All under `docs/audit/img/`, JPG, 38–80 KB each, from the browser pane (pane-scaled, so pixel sizes in the text come from measurements, not from the images).

| File | Route · width · theme | Shows |
|---|---|---|
| `taste-home-1440-light.jpg` | `#/` 1440 light | first screen; accent count |
| `taste-home-1440-dark.jpg` | `#/` 1440 dark | index in dark |
| `taste-home-390-light-index.jpg` | `#/` 390 light | finding 1 |
| `taste-task3-1440-light-readings.jpg` | `#/task/3` 1440 light | the two scales, the swap |
| `taste-task3-1440-light-specimens.jpg` | `#/task/3` 1440 light | plates, in service, enter |
| `taste-task3-390-light-scale-a.jpg`, `-scale-b.jpg` | `#/task/3` 390 light | finding 2 |
| `taste-task3-390-light-enter.jpg` | `#/task/3` 390 light | finding 15 |
| `taste-task4-1440-light.jpg` | `#/task/4` 1440 light | sealed band (good), finding 7 |
| `taste-model4-1440-light-forest.jpg` | `#/model/4` 1440 light | findings 3, 4 |
| `taste-model4-1440-dark-forest.jpg` | `#/model/4` 1440 dark | same in dark |
| `taste-model4-1440-light-plates.jpg` | `#/model/4` 1440 light | finding 13, provenance |
| `taste-model6-1440-light.jpg` | `#/model/6` 1440 light | findings 6, 9 |
| `taste-costs-1440-light.jpg` | `#/costs` 1440 light | diagram and table |
| `taste-costs-390-light.jpg` | `#/costs` 390 light | finding 14 |

Measurements quoted in the findings (title column 58 px, header 141 px, `scrollWidth` 401/477 px, plate 48→161 px, twelve text sizes, eight accent text elements on the home first screen, contrast ratios) were taken with `getComputedStyle`/`getBoundingClientRect` in the live page on 4 Nov 2026 and by WCAG relative-luminance arithmetic on the tokens in `web/src/style.css`.
