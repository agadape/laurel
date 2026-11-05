# Laurel web — taste audit, pass 2 (taste-skill v2)

*Ringkasan (ID):* dari 17 temuan pass 1, 13 sudah beres, 3 beres sebagian (jarum di 390 px masih kurang 8 px ruang, skala ukuran huruf masih 12 langkah, kotak "the model" masih melompat 42 px saat byte tiba), dan 1 belum: momen "segel terangkat" masih berupa potongan keras, bukan animasi, karena pita dilepas dari DOM tepat saat kelas `lift` dipasang, dan slopegraph-nya hanya garis setipis rambut. Ada satu **regresi baru** yang paling terlihat: di lebar desktop diagram alur Method digambar dua kali (SVG mendatar + daftar vertikal tujuh kotak) di `#/` dan `#/costs`, karena `.flow-v { display: flex }` menimpa `.only-narrow { display: none }`. Skor naik dari 6.5 ke **7.5**; dengan tiga perbaikan teratas (regresi diagram, pita yang benar-benar terangkat, slopegraph yang terbaca) perkiraan 7.8–8.0. Semua perbaikan di bawah level CSS/JSX, tanpa dependency baru. Laporan selengkapnya dalam bahasa Inggris.

Audited 4 Nov 2026 (evening, after commit `d50f264`) against the live build at https://laurel-near.vercel.app (contract `laurel.laurel-team-mw0x0c8g.testnet`; task 3 closed, champion #4; task 4 open with #6), with the skill at `.claude/skills/taste-skill/skills/taste-skill/SKILL.md` (install name `design-taste-frontend`, v2) and `references/critique.md`, `app-screens.md`, `tells.md`. Routes `#/`, `#/task/3`, `#/task/4`, `#/model/4`, `#/model/6`, `#/costs` at 1440×900 and 390×844, light and dark (`prefers-color-scheme` emulated). Pass 1 is `docs/audit/TASTE.md`; what the team fixed is in `docs/UI_DIRECTION.md` §8. Nothing under `web/` was changed by this pass.

**What could not run.** As in pass 1, the skill's `inspect.mjs` / `lint.mjs` are third-party scripts that this session's permission policy does not execute, so there is no machine `FAIL`/`WARN` list. Every number below was measured by hand in the browser pane (`getComputedStyle`, `getBoundingClientRect`, `scrollWidth`, a 100 ms poll of the band's class list during the reveal, WCAG luminance arithmetic on computed colours). "Accent share" is the painted area of accent-coloured text (at 25 % ink coverage), fills, strokes and borders inside the first 1440×900 screen, as a percentage of that screen; it is an estimate good to about ±0.3 points, not a pixel count.

---

## 1. Status of pass-1 findings 1–17

| # | Finding (pass 1) | Status | Measured on 4 Nov (pass 2) |
|---|---|---|---|
| 1 | Exhibit index broken at 390 px | **fixed** | `scrollWidth` 390 (was 401); two-column row grid `56px / 288px`; title 18 px over 3 lines, nothing overprints (readings start 1034 px, title ends above); row 251 px tall; pills wrap. |
| 2 | Needle labels collide at 390 px | **fixed, 8 px short** | Collision test now in px (`minPx 92`, `ResizeObserver`). At 390: A needles #4 `142–191 × 149–195`, #5 (raised) `170–228 × 111–157`; B #5 `74–123 × 343–389`, #4 (raised) `87–181 × 301–351`. Text no longer overprints text, but the raised tier is 38 px and a needle block is 46 px, so the raised needle's arrow sits 8 px into the lower value's box (`taste2-task3-390-light-scales.jpg`). At 1440 the pairs are 35 px and 27 px apart, no contact. |
| 3 | Accent spent everywhere | **fixed** | Accent share of the first screen: `#/` 0.6 %, `#/task/3` 0.9 %, `#/model/4` 1.2 %, `#/costs` 3.2 % (inflated by the duplicated diagram, N1). Links in ink with underline; `.sec` in mist; "open" pill ink-filled; forest edges in ink/ink-2/mist with only the root dot orange. Accent text left on `#/`: "Specimen · entry #4 · champion…", "02 — Exhibits", the 54 px "03", "66.50 %". Residual in N6. |
| 4 | Fifty trees are wallpaper | **fixed** | `#/model/4`: 50 trees, **50 distinct glyph signatures** (tone × stroke sequence), stroke widths 0.70–2.30 px over 100 distinct values, three tones, leaf ticks by sign. Readout line 12 px, `role=button`, `tabindex=0`; click on tree 8 printed "tree 8 · root split: checking_status < 1 · 31 nodes · depth 4"; the picked tree turns accent in both themes (`taste2-model4-1440-dark-forest.jpg`). Residual in N11: at the 19 px glyph size of the index signature the variation is invisible. |
| 5 | The reveal never fires | **not fixed (partly built)** | Polled at 100 ms on `#/task/3`: band present `617–1004 ms` with class `band` (opacity 1), then **absent** at `1101 ms`; needles `on` at `1101 ms`. The class `band lift` never occurred: `showBand = sealed \|\| (reveal && !lifted)` unmounts the band the moment `lifted` flips, so the 600 ms fade/translate in `.band.lift` has no element to run on. The seal is a hard cut, and the band flashes only while the leaderboard has already loaded. Slopegraph present: lines `42→33` (#4, accent, 0.6 px) and `51→23` (#5, mist, 0.35 px) do cross, but in a 26 px tall box with sub-pixel strokes they read as a scratch (`taste2-task3-1440-light-readings.jpg`). See N2, N3. |
| 6 | Split B shown for an open exhibit | **fixed (web)** | `#/model/6`: reading prints the sealed pill "not yet observed · sealed in the leaderboard until 2026-11-25 23:59 UTC"; plate B is 150 grey dots with the same caption; raw fold summary says "split B withheld until close" and the JSON has `"b": "sealed until the exhibit closes"`. `#/task/4` band copy: "sealed in the contract's leaderboard until 2026-11-25 23:59 UTC" (true). The `get_submission` view still returns B (out of scope). |
| 7 | Specimens half empty with one entrant | **fixed** | `#/task/4`: the single card is `spec c12 wide` (983 px), body `590 / 360 px`, signature drawn at 360×144 px. Provenance: raw-output fold now under the `dl` in one column. |
| 8 | 141 px header on phones | **fixed** | Header 56 px at 390 (tagline and contract id hidden; id kept in the footer). |
| 9 | Loading states shift the layout | **mostly fixed** | `#/model/6` poll: plate 411 px while "loading model bytes…", 453 px after decode (+42 px, page +41 px). The forest box is reserved by aspect ratio; the 42 px is the `.readout` line that only mounts after decode. Figures reserve with `.sk`. See N8. |
| 10 | Twelve sizes, three under the floor | **partly** | 10 px gone. Still 12 distinct sizes on `#/` at 1440 (11, 12, 13, 14, 15, 17, 20, 22, 26, 34, 54, 76) and on `#/task/3` (11, 12, 12.5, 13, 14, 15, 18, 22, 28, 34, 40, 120); `#/model/4` has 10; `#/costs` 7. Under 12 px: tick labels 11 px (`.scale .tl`), the flow SVG's text at 10.8 px rendered (11 in a 1000-unit viewBox scaled to 983 px), `pre` at 12.5. See N7. |
| 11 | Accent text fails contrast | **fixed** | Light: `--accent-text #B8431F` on paper 5.0:1 (12–13 px labels, needle ids, "Split B"). Dark: accent text 6.45:1 on plate, 7.0:1 on paper; mist 6.5:1; tee 8.8:1; costs diagram in dark: ink-on-orange `predict_task` 7.0:1, outlined TEE box with tee text 8.1:1, others 13.8:1. |
| 12 | Gradient row hover, no focus | **fixed** | `.row:hover` is a plate tone step plus a 4 px inset ink bar; `:focus-visible` outline 2 px accent, offset 3 px (verified on Tab: computed `solid … rgb(232, 85, 42)`). |
| 13 | Dot plates are bar charts | **fixed** | Dot order `pos, pos x, neg, neg x` (45 positives first on 150 rows); key "actually positive · actually negative · misjudged" with the real marks. A and B plates of #4 now differ where the orange sits (`taste2-model4-1440-light-forest.jpg`, lower half). |
| 14 | Costs page 477 px wide at 390 | **fixed** | `scrollWidth` 390; vertical seven-step list; table wraps inside 358 px with no sideways scroll; footer line wraps (`overflow-wrap: anywhere`), hash shortened with a copy button. |
| 15 | Copy button over the code | **fixed** | `.cmd` button sits in its own strip: button bottom 629 = `pre` top 629 at 390, 0 px overlap; code scrolls inside the `pre`. |
| 16 | Tracked caps on nav and pills | **fixed** | Nav Archivo 500, 14 px, sentence case, no tracking; pills Archivo 600, 12 px, sentence case, 0.02 em, still boxed. |
| 17 | Smaller things | **fixed, one regressed** | `h1` per screen ✓ (`document.title` per route too); `[open]` tag muted ✓; "NEAR earned" 0.018 on both task and model ✓; 40 px section rhythm with one `--plate` chapter per route ✓; `.reading.sep` border 0 px at 390 ✓; needle motion on `transform` ✓; the Method row now shows the flow diagram — but twice (N1). |

**Summary:** 13 fixed · 3 partly (2, 9, 10) · 1 not fixed (5) · 1 new regression (N1, from the fix to 17).

---

## 2. Critique sheet, round 2 (critique.md §4)

```
ROUND 2 (desktop 1440 light / phone 390 light; dark checked on every route, same findings)
Seen in one second: "Models, observed." and an ink plate of fifty small trees with orange roots (home);
  a 120 px "03" and two scales with one orange needle (task); a white plate of fifty trees that now
  differ in weight (model).
Idea (one sentence): the model decoded from its own on-chain bytes is the picture, and its two readings
  are needles on an instrument whose second scale stays sealed until close.
Live thing: click or tab a tree and read its root split (works, keyboard too); the seal on a closed
  exhibit flashes for half a second and is cut away rather than lifted; the slopegraph between the
  scales crosses but is a hairline.
Layout words by section: home: split / index / (diagram ×2 + strip) · task: header / instrument /
  plates / strip / split · model: header / two-up / plate / two-up / kv / code · costs: statement /
  (diagram ×2) / table / list.
Scores: design 7.5 · usability 7 · creativity 8 · content 8.5 → overall 7.55 → 7.5 (not rounded up)
Caps applied: none of the hard caps (no text over a title, nothing clipped, no reveal left blank).
  Design held under 8 by the duplicated diagram and the hairline slopegraph; usability held at 7 by
  the duplicated seven-box list on the home page, the 11 px tick labels and the sub-floor diagram text.
Top three problems (most visible first), screenshot, fix:
1. The Method flow is drawn twice at desktop on #/ and #/costs (taste2-home-1440-light-method-dup.jpg,
   taste2-costs-1440-light.jpg) → N1, one CSS line.
2. The seal does not lift, it vanishes; the lines between the scales are 0.35 px scratches
   (taste2-task3-1440-light-readings.jpg) → N2, N3.
3. The raised needle tier is 8 px short on phones; the sealed sentence prints twice on an open exhibit
   (taste2-task3-390-light-scales.jpg, taste2-task4-1440-light.jpg) → N4, N5.
```

Pass 1 scored 6.5 (design 6.5 · usability 5 · creativity 8 · content 8). Round 2 is **7.5**. With N1–N3 fixed the same page scores about design 8 · usability 8 · creativity 8.5 · content 8.5 → **8.1**, which is above the skill's Site-of-the-Day calibration (7.5–8.0); the creativity half-point is the reveal becoming a real moment (the one live thing the direction wrote).

The skill's page-level house rules (mono labels, index numbers, hairline rules, three faces) remain documented brand decisions in `docs/UI_DIRECTION.md` §2 and are kept out of the score as in pass 1. One of them is worth a second look: with the tracked caps gone, the mono eyebrow numbers and the counters `01…07` on the vertical flow list are now the only "gallery" device left, and the list's counters repeat the SVG's order; drop the counters on the list (`.flow-v li::before`) when N1 is fixed, since the boxes are already in order.

---

## 3. Verdict

The page has gone from a strong idea with broken phone screens to a site that holds at every width and in both themes: the index and the scales are honest at 390 px, the accent means "decided by the sealed split" again (under 1 % of any first screen), the fifty trees are fifty different trees, the dot plates show the class balance, split B is withheld everywhere the web controls, and nothing needs a hover to be understood. What keeps it at 7.5 instead of 8 is one regression and one unfinished moment. The regression is a stylesheet ordering slip: `.flow-v`'s `display: flex` is declared after `.only-narrow { display: none }`, so at desktop the Method diagram appears twice, as a 983 px SVG and then as a 300 px stack of seven boxes, and the home page ends on that stutter with its "03 — Method" label floating halfway down the section. The unfinished moment is the reveal: the sealed band now renders on a closed exhibit, but it is unmounted the instant `lifted` becomes true, so the 600 ms lift in the CSS never plays and the band simply blinks off once the leaderboard arrives; the slopegraph that should carry the sentence "the lines cross" is there, and does cross, but at 0.35 px in a 26 px box it is not something a juror will see in a three-minute video. Both are small changes. Everything else below is polish.

---

## 4. Remaining and new findings, ranked by impact

Each: **where** · **what feels off** · **why** · **fix** (CSS/JSX only, no new dependencies).

### N1. The Method flow is drawn twice at desktop (regression)
- **Where:** `#/` "03 — Method" and `#/costs` "01 — Flow", ≥ 721 px. `web/src/style.css:53-54` (`.only-narrow { display: none }`, media rule `display: block`) versus `web/src/style.css:226` (`.flow-v { … display: flex … }`), `FlowDiagram` in `web/src/App.jsx`. Screenshots `taste2-home-1440-light-method-dup.jpg`, `taste2-costs-1440-light.jpg`.
- **What:** measured at 1440: `svg.only-wide` display `block` **and** `.flow-v.only-narrow` display `flex`, 300 px tall; the home Method section is 564 px tall with the `.sec` label at y 375 while the SVG runs 280–388 (the section is `align-items: baseline`, so the label hangs between the two diagrams). On `#/costs` the orange `predict_task` box appears twice on one screen (accent share 3.2 %, the highest on the site).
- **Why:** same specificity, later rule wins; the fix to pass-1 item 17 added the vertical list and inherited this. It is the first thing a desktop visitor sees that looks like a mistake, and it is on the home page's last section and the method page's first.
- **Fix** (one line each): remove `display: flex` from `.flow-v` and give it to the media rule, so the `.only-*` pair stays the single switch:
  ```css
  .flow-v { margin: 0; padding: 0; list-style: none; counter-reset: st; flex-direction: column; gap: 8px; }
  @media (max-width: 720px) { .only-wide { display: none; } .only-narrow { display: block; } .flow-v.only-narrow { display: flex; } }
  ```
  And on the home page give the Method section `alignItems: "start"` so the label sits at the top of the diagram.

### N2. The seal is cut away, not lifted
- **Where:** `Scale` in `web/src/components.jsx` (`showBand`, `lifted`), `.scale .band.lift` in `web/src/style.css`. `#/task/3`.
- **What:** poll at 100 ms: band mounted at 617 ms (once the leaderboard arrives) without `lift`, gone at 1101 ms; `band lift` never appears in the DOM because `showBand` becomes false in the same render that would add the class. The transition in CSS is dead code. Visible effect: a hatched band blinks for about half a second over a scale that already has its needles, then disappears; the needles then fade in.
- **Why:** this is the product's one moment (the direction §6 writes it as the signature motion) and the pass-1 fix built the pieces but not the sequence. A juror watching the task page sees a flicker.
- **Fix:** keep the band mounted through its transition and start its timer from the data, not from mount:
  ```jsx
  const [stage, setStage] = useState(reveal && !reducedMotion() ? "sealed" : "done"); // sealed → lifting → done
  useEffect(() => {
    if (!reveal || reducedMotion() || entries.length === 0) return;          // wait for the needles to exist
    const t1 = setTimeout(() => setStage("lifting"), 700);
    const t2 = setTimeout(() => setStage("done"), 700 + 650);                 // 650 ≥ the 600 ms transition
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [reveal, entries.length]);
  const showBand = sealed || (reveal && stage !== "done");
  const armed = stage !== "sealed";
  …
  {showBand && <div className={`band ${stage === "lifting" ? "lift" : ""}`}>…</div>}
  ```
  and drop the separate `lifted`/`armed` states. Then the band is on screen for 700 ms with the needles hidden, lifts over 600 ms, and the needles rise as it goes. Reduced motion keeps today's behaviour (no band on a closed task).

### N3. The slopegraph is a hairline
- **Where:** `Slopegraph` in `web/src/components.jsx`, `.slope` in `web/src/style.css` (`height: 26px; margin: -14px 0 -6px`). `#/task/3`, screenshot `taste2-task3-1440-light-readings.jpg`.
- **What:** two lines at 0.35 px (mist) and 0.6 px (accent) in a 26 px band between the A tick labels and the "Split B" head. They cross (x 42→33 and 51→23 of 100) but at that weight they anti-alias to a faint grey mark that is easy to read as a rendering artefact. At 390 the same lines are 26 px tall over a 358 px track.
- **Why:** pass 1 asked for the crossing to *be* the sentence so the 14 px paragraph could shrink; today the paragraph still carries it.
- **Fix:** make the lines the size of the needles' story: `.slope { height: 56px; margin: -8px 0 -4px; }`, `strokeWidth={e.id === winner ? 2 : 1.25}` for both themes, mist line dashed (`strokeDasharray="4 3"`) so the loser reads as "led, then fell"; and let the lines draw after the band lifts (`.slope line { stroke-dasharray: 400; stroke-dashoffset: 400; animation: draw 500ms 1300ms ease-out forwards }`, reusing the `draw` keyframes). Then shorten the paragraph to one clause: "The lines cross: the sealed reading is the only one a model could not have been tuned against, so it decides."

### N4. The raised needle tier is 8 px short on phones
- **Where:** `.scale .needle.up { bottom: 38px }`, `.scale .track { height: 74px }` in `web/src/style.css`. `#/task/3` at 390, screenshot `taste2-task3-390-light-scales.jpg`.
- **What:** a needle block (22 px value + 12 px id + 10 px arrow + gaps) is 46 px tall; the raised tier is 38 px, so the raised needle's arrow overlaps the lower value's box by 8 px (A: 149–157, B: 343–351 measured). Text does not overprint, but the arrow of "75.50" touches the top-right of "71.00".
- **Fix:** `@media (max-width: 720px) { .scale .track { height: 92px; } .scale .needle.up { bottom: 48px; } }`; desktop can stay (pairs are 27–35 px apart there).

### N5. The sealed sentence prints twice on an open exhibit
- **Where:** `Task` in `web/src/App.jsx`: `sealedText` is passed both as the Split B `note` and as the band text. `#/task/4` at 1440 and 390 (`taste2-task4-1440-light.jpg`).
- **What:** "sealed in the contract's leaderboard until 2026-11-25 23:59 UTC" appears as the 12 px note at the right of the Split B head and again, with the lock, inside the band 20 px below; at 390 both wrap to two lines, four lines saying one thing.
- **Fix:** `note={task.closed ? \`unsealed ${fmtDate(task.deadline_ns)}\` : <Countdown ns={task.deadline_ns} />}` so the head carries the time left and the band carries the fact and the date.

### N6. Three wayfinding labels still in accent
- **Where:** `#/` `.row-head span.accent-text` ("02 — Exhibits"), the home plate caption "Specimen · entry #4 · champion of exhibit 03", the model page caption "all 50 trees, drawn from the bytes on-chain" (`web/src/App.jsx`).
- **What:** after fix 3, orange on a screen should be the split-B reading, the misjudged dots and the champion's mark. These three are captions; the first is a section number that is mist everywhere else (`.sec`).
- **Fix:** `className="mist"` on all three; if the champion needs a mark in the caption, wrap only the word `champion` in `accent-text`.

### N7. The small end of the type scale
- **Where:** `.scale .tl` (11 px), the flow SVG `fontSize="11"` (10.8 px rendered at 1440, about 4 px at 390 where the SVG is hidden anyway), `pre` 12.5 px, `.row .t b` 20 px vs `.spec .head b` 28 px vs `h3` 20 px, `.fig .v small` 14 vs `.reading .v small` 26.
- **What:** twelve sizes on `#/` and on `#/task/3`; 11 and 12.5 are one step from 12 and read as mush rather than a step.
- **Fix:** `.scale .tl { font-size: 12px }`, SVG text `fontSize="12.5"` (12.3 px rendered), `pre { font-size: 12px }`, `.fig .v small { font-size: 14px }` is fine; and collapse 17/18/20/22 to two steps (17 for the hero paragraph and 20 for titles; needle values 20, accent needle 22 → 26 to match the readings' `small`). Target scale: 12 · 13 · 15 · 17 · 20 · 26 · 34 · 54 · 76/120.

### N8. The forest still grows 42 px when the bytes land
- **Where:** `Forest` in `web/src/components.jsx`: the `.readout` div renders only in the decoded branch; the loading/error branches render the box alone. `#/model/6` (411 → 453 px measured).
- **Fix:** render the readout slot in every branch when `readout` is set (`{readout && <div className="mono mist readout">{bytes ? … : " "}</div>}` outside the early returns), or put `min-height: calc(var(--rows) * …)` on the plate; the first is three lines.

### N9. The split-B value and its sub-label touch on phones
- **Where:** `#/` row 03 at 390: "66.50 %#4 decided here" (`ExhibitRow`, the sub is nested inside the `.accent` span so the flex `gap: 8px` of `.row .r` does not apply; the A reading's sub is a direct child and gets the gap).
- **Fix:** `@media (max-width: 900px) { .row .r .sub { display: inline; margin-left: 8px; } }` or move the `.sub` span out of the accent span.

### N10. "02 — Exhibits" wraps in the 56 px head column on phones
- **Where:** `.row-head` at ≤ 900 px uses the row grid (`56px / 1fr`), so the first head cell holds "02 —" / "Exhibits" on two lines beside "Task".
- **Fix:** `@media (max-width: 900px) { .row-head { grid-template-columns: 1fr; } .row-head span:not(:first-child) { display: none; } }` (the row itself already says what each line is).

### N11. The index signature cannot show the fingerprint
- **Where:** `LeaderSig` on `#/` (16 trees, 8 columns, 40 px cells → about 19 px per glyph), the specimen signature on `#/task/:id` (30 trees at the same cell).
- **What:** at that size stroke 0.7–2.3 scaled by 0.47 becomes 0.3–1.1 px and the three tones merge; #4 and #6 (both 50×4) are the same mark. Fine as a *mark* (that is what pass 1 asked), but the caption "Leader's signature" promises identity it cannot deliver at this scale.
- **Fix (optional):** draw the signature from the first 4 trees at `cols={4} cell={80}` (same box, glyphs 4× larger, weight visible), or keep 16 trees and rename the column "Leader" with the tree count. A design choice; either is honest.

### N12. The specimen card's failed-read state is not labelled
- **Where:** `#/task/4` specimens on one load this evening: `get_submission(6)` and `get_model_bytes(6)` failed while `leaderboard(4)` succeeded, so the card showed "scored in TEE" with a 150-dot ghost plate captioned "split A · rows · one dot per private test row" (empty count) and "model bytes unavailable · retry". A reload fixed it (transient RPC), and the retry button works.
- **Fix:** caption `counts?.n ?? "—"`, and when `s?.sub === null` (the view failed) show "could not read the evaluator output · retry" with the same retry handler instead of the silent ghost; app-screens §11 (every state honest and labelled).

### Still true from pass 1, not scored
- The `get_submission` view returns split B while the task is open (contract side; `CLAIMS.md` #11 is about the leaderboard, and the site copy now says "leaderboard", so the README ↔ code ↔ tx check passes for the web).
- Index numbering on the vertical flow list (`01…07`) duplicates the order the boxes already have; drop `.flow-v li::before` when N1 lands.

---

## 5. Screenshots

All under `docs/audit/img/`, JPG, 35–69 KB, pane-scaled captures (pixel numbers in the text come from measurements, not from the images).

| File | Route · width · theme | Shows |
|---|---|---|
| `taste2-home-1440-light.jpg` | `#/` 1440 light | first screen after the fixes; accent share 0.6 % |
| `taste2-home-390-light-index.jpg` | `#/` 390 light | finding 1 fixed; N9, N10 |
| `taste2-home-1440-light-method-dup.jpg` | `#/` 1440 light | N1: SVG flow plus the seven-box list, label mid-section; footer |
| `taste2-task3-1440-light-readings.jpg` | `#/task/3` 1440 light | needles in tiers, hairline slopegraph (N3), chapter plate, specimens |
| `taste2-task3-390-light-scales.jpg` | `#/task/3` 390 light | finding 2 fixed; N4 (arrow 8 px into the lower box) |
| `taste2-task3-1440-dark-readings.jpg` | `#/task/3` 1440 dark | dark mirror after the token changes |
| `taste2-task4-1440-light.jpg` | `#/task/4` 1440 light | sealed band with the true claim; N5 (sentence twice) |
| `taste2-task4-1440-light-specimen.jpg` | `#/task/4` 1440 light | finding 7 fixed (full-width card), code strip above the `pre` (15) |
| `taste2-model4-1440-light-forest.jpg` | `#/model/4` 1440 light | finding 4 (distinct glyphs, readout line), finding 13 (ordered plates with key) |
| `taste2-model4-1440-dark-forest.jpg` | `#/model/4` 1440 dark | picked tree in accent on the dark plate |
| `taste2-model6-1440-light.jpg` | `#/model/6` 1440 light | finding 6 fixed (sealed pill, no split-B reading) |
| `taste2-costs-1440-light.jpg` | `#/costs` 1440 light | N1 on the method page; table |

Measurements quoted above (`scrollWidth`, header heights, needle boxes, the 100 ms band poll, stroke-width and signature counts, contrast ratios, section heights) were taken in the live page on 4 Nov 2026 between 21:30 and 22:00 local time.
