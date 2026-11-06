# External audit 2 (Gemini, 6 Nov 2026): findings and what we did

Input: [GEMINI_AUDIT_BRIEF.md](GEMINI_AUDIT_BRIEF.md) (the single-file brief). The auditor had no live web access, so
every external check was marked "could not verify"; the static findings below were checked against the code by us.
Verdict column: **confirmed** (true, acted on), **confirmed, documented** (true, no code change possible before the
contract freeze), **refuted** (checked, wrong).

| # | Severity | Finding | Verdict | What we did |
|---|---|---|---|---|
| 1 | blocker | The competitor agent's shell policy stops the *model's* `Read` tool from opening `.env` / `private_*.json`, but the agent may write and run any Python in the repository, so a 3-line script could read the private splits or keys; `cat` allowed globs | **confirmed** | `agents/competitor.mjs` now runs in a throw-away workspace in the OS temp folder that holds only public files (export.py, features.json, public CSVs, train.py); shell arguments must be relative and glob-free; `..`, absolute paths and `~` are refused; script text that names parent paths, absolute paths, the environment, the network or subprocesses is refused; docs/AGENTS.md now says plainly that this is a tool-call policy plus an empty workspace, not OS isolation. Both earlier transcripts were scanned: zero tool inputs touched `.env`, private files, the network or the environment |
| 2 | major | `get_submission` / `list_submissions` return split B while the task is open; "sealed" holds only in `leaderboard`, the site and MCP | **confirmed, documented** | Was in Limits; now a row in the README "Security model" table with the fix we would make (second TEE run or encrypted B) |
| 3 | major | `create_task` has no ceiling on `fee_per_call`; credit is one balance per account; a function-call key limits the method, not its arguments; an agent tricked into `predict` on a hostile submission pays that fee | **confirmed, documented** | New row in the Security model table with mitigations (small credit balances; route through your own contract that hard-codes the task) |
| 4 | major | `close_task` does not wait for `Pending` entries; `request_score` is allowed until close; `on_score` records a late result after the winner is fixed | **confirmed, documented** | Security model row and ABI note; entries should be scored well before the deadline |
| 5 | major | `population.json` published per-creator retention rates computed over the whole population, private rows included; `creator_class` ranking also over the whole population | **confirmed** (aggregate leak, small) | Per-creator rates removed from `population.json` and from `build.py`; task README discloses both facts; the population-level rate (12.4 %) stays, it is in the README anyway |
| 6 | major | BigQuery `TIMESTAMP_DIFF(…, DAY)` counts UTC midnight boundaries, so `days_to_first_tx` could be 7 and off by one | **refuted** | Checked on BigQuery on 6 Nov: `TIMESTAMP_DIFF(TIMESTAMP '2026-06-09 00:01', TIMESTAMP '2026-06-08 23:59', DAY) = 0` and a 6-day-2-hour gap gives 6; the boundary semantics belong to `DATE_DIFF`/`DATETIME_DIFF` (same test on DATETIME gives 1). The sample's maximum is 6, as documented. The README now states the semantics |
| 7 | minor | README "What is live" said 9 models / three entries on task 5 while the chain had 11 / 5 | **confirmed** | Updated (6 Nov) |
| 8 | minor | `tools/export.py`: `min(len, max(200, len))` is `len`; docstring promised ≥ 200 rows | **confirmed** | Simplified and docstring fixed |
| 9 | minor | `validate_model` quotes `bytes + 400 B`; the real write adds the Submission struct and indexes, which is why the tools add 0.02 NEAR slack | **confirmed** | ABI note: the quote is approximate, attach refundable slack |
| 10 | minor | `withdraw_credit` leaves a zero-balance row; its ~0.001 NEAR of storage is never returned | **confirmed** (nit) | ABI note |
| 11 | minor | The brief said `web/src/model.js` runs the same arithmetic; it only decodes trees for drawing (and uses Number, not BigInt) | **confirmed** | Brief corrected; README never made that claim |
| 12 | minor | The competitor agent pooled public_train + public_holdout (950 rows) for its final fit, so `export.py`'s holdout figure for #10 is in-sample, and baselines #7–#9 used 800 rows | **confirmed** | Disclosed in docs/AGENTS.md; the system prompt now tells the agent to say which rows it trained on |
| 13 | framing | "Why pay for `predict_task` when the bytes are public?" needed a sharper answer | **accepted** | README Business model: off-chain agents run the bytes locally for free and pay only for an on-chain receipt; another contract has no choice, it cannot trust a score computed off-chain |
| 14 | to-do | Close task 5 on 12 Nov 12:00 UTC, run the caller through `predict_task(5, …)`, record the reveal | **accepted, scheduled** | On the 12 Nov checklist in docs/SUBMISSION.md |
| 15 | to-do | Get outside accounts onto task 5 before 12 Nov | **accepted** | docs/QUICKSTART.md invitation is out; depends on people |

Landscape section (Numerai / CrunchDAO / Bittensor, Giza / EZKL / Modulus / RISC Zero, Ritual / ORA / Phala, NEAR AI /
Bitte / Shade Agents): the comparisons are fair and are now the basis of the README's positioning paragraph; we could not
make the auditor verify them on the web, so treat the named projects as the judge's likely references, not as checked facts.
