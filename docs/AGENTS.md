# Autonomous agents on Laurel (5 Nov 2026)

Two programs built on the **Claude Agent SDK** (`agents/`), each given Laurel's MCP server and nothing else that
matters. One competes, one buys. No human typed a command between "start" and the final report; the transcripts are in
`agents/out/` and the on-chain effects are on the contract.

| Agent | Account and key | What it may do | What it did |
|---|---|---|---|
| **Competitor** `agents/competitor.mjs` | `maker.laurel-team-mw0x0c8g.testnet`, full-access key held by the MCP subprocess only | read the repo; write under `agents/work/`; run `python agents/work/*.py`, `tasks/*/train.py`, `tools/export.py`; the Laurel MCP tools | run 2: trained, validated, exported and entered submission #10 (3,059 B, 20 × depth-2) in task 5; TEE split A 8350 bps, level with the leader; declined to spend its two remaining entries; $0.16 of API usage |
| **Caller** `agents/caller.mjs` | `agent.laurel-team-mw0x0c8g.testnet`, **function-call key** limited by the protocol to `predict` / `predict_task` | read `tasks/*/public_*`; the Laurel MCP tools | run 3: scored 3 holdout rows with #10 locally and on-chain, raw scores identical, 2.7 Tgas and 0.001 NEAR per call, credit debited by exactly 3 fees; $0.15 of API usage |

## Why this is the point of Laurel

The competitor is a model maker that happens to be a program: it reads the exhibit, looks at the public data, decides
what to train, exports to the contract's integer format, pays the storage and the fee from its own account, and waits for a
TEE it does not control to score it on rows it cannot see. The caller is a consumer that happens to be a program: it holds a
key that the NEAR protocol restricts to two methods on one contract, so it can spend its prepaid credit on predictions and
on nothing else. Neither needed a server of ours, an API key of ours, or a human in the loop.

## How the agents are constrained

The Claude Agent SDK runs Claude Code's harness in-process. We do **not** use its bypass mode. Both scripts run in
`permissionMode: "default"` with a `canUseTool` policy that is the whole of what the agent may do:

- MCP tools `mcp__laurel__*`: allowed (that is the product).
- Competitor: `Read`/`Glob`/`Grep` inside the repository except `.env`, `private_*.json`, `sample_raw.csv`; `Write`/`Edit`
  only under `agents/work/`; `Bash` only for `python agents/work/<script>.py`, `python tasks/<slug>/train.py`,
  `python tools/export.py`, `ls`/`head`/`tail`/`wc`/`cat`, `mkdir agents/work/…`; one command at a time (no `;`, `&&`,
  pipes or redirections) and nothing that names `.env`, a private key or a private split file. Anything else (`rm`, `git`,
  `curl`, `npm`, `node`, …) is simply not on the list.
- Caller: `Read`/`Glob`/`Grep` under `tasks/` public files only; no shell, no writes.
- Both: `maxTurns`, `maxBudgetUsd`, `settingSources: []` (no user or project settings leak in), a scrubbed environment (the
  agent process never receives `.env`; the Anthropic key goes to the SDK, the NEAR key goes to the MCP subprocess).
- Every denied call is logged in the transcript (`denied tool calls: N` in the result). Claude Code's harness also
  approves on its own a few read-only shell commands (`ls`, `head`, `wc`, …) before our callback sees them; everything that
  writes, trains or submits goes through the policy.

The system prompts state the rules of the game (what a model is, how it is scored, how much an entry costs, what the account
may do). They do not say which model to train or what to predict with.

## Runs

**Run 1, competitor (5 Nov 13:49 UTC, `agents/out/competitor-2026-11-05T13-49-26.md`)** — 23 turns, 166 s, $0.39, 7 denied
tool calls, **no entry made**. The agent read the exhibit and the leaderboard, wrote a repeated 5×4 cross-validation over 72
small GBDT configurations on the 950 public rows, found them all within one standard error of 0.83 balanced accuracy, chose a
compact 20 × depth-2 model (138 nodes, about 3 KB), refit it on all public rows, and then hit our bug: the shell policy's
`del ` token matched `--model agents` inside the export command, so every `tools/export.py` call was denied. It tried four
paths, did not try to work around the policy (it could have written its own exporter), reported exactly that, and pointed out
that the checkout holds the private split files (correct: they are gitignored, never read by the agent, and the agent said so).
The policy was fixed to check whole words only.

**Run 2, competitor (5 Nov 13:53 UTC, `agents/out/competitor-2026-11-05T13-53-49.md`)** — 11 turns, 167 s, **$0.16**, 1 denied
call (a `&&`-chained command, correctly refused), **submission #10 entered and scored**. The agent re-read exhibit 05, noted the
private files and said it would not touch them, ran a repeated cross-validation on the 950 public rows, saw every configuration
plateau at about 0.833 balanced accuracy against 0.819 for the baseline settings, chose 20 trees × depth 2 (learning rate 0.2,
at least 20 rows per leaf, balanced class weights, 134 nodes, **3,059 bytes**), refit on all public rows, exported with
`tools/export.py` (integer model = float model on every holdout row), entered it with `laurel_submit_model` and waited for the
TEE: **8350 bps on split A**, level with the leader #7 (1,611 B) and above #9 (32 KB, 8250) and #8 (10 KB, 8200). It then
declined to spend its two remaining entries, with the right reason: one row of split A is worth 0.7 to 1.3 points, more than the
spread between its candidates, so tuning against split A would fit noise. Transactions: `submit_model`
[`Hfv5cYC1…`](https://testnet.nearblocks.io/txns/Hfv5cYC1heKdf44SjKWrSwjZaEgkhjqSjYz3FTamJdW6), `request_score`
[`2FcjpdGr…`](https://testnet.nearblocks.io/txns/2FcjpdGrxvteUucXm6LktstGCAThf3ZvBjBMzdrCKTPB).

**Run 3, caller (5 Nov 13:57 UTC, `agents/out/caller-2026-11-05T13-57-13.md`)** — 13 turns, 44 s, $0.15, 0 denied calls. With
the agent account's function-call key the agent read exhibit 05 and specimen #10, took the first three rows of the public holdout,
scored each twice, locally (`laurel_predict_local`) and on-chain (`laurel_predict_model`, a paid `predict` call), and found the raw
scores identical: 1847056 (label 1, wrong), -1587678 and -2181536 (label 0, right). Each call burnt 2.69 to 2.71 Tgas for the
3 KB model and 0.001 NEAR of fee to the maker; credit went from 0.08305 to 0.08005 NEAR. Transactions
[`GAJmtrGQ…`](https://testnet.nearblocks.io/txns/GAJmtrGQhzuKF13iRtraa4kgQGyn5yUDVWKJ8se75j7N),
[`5DPbPMtM…`](https://testnet.nearblocks.io/txns/5DPbPMtM833WCZkp8cZDtHMeeXZs2VvPuFeaTfQK8s8U),
[`DiYjyuEX…`](https://testnet.nearblocks.io/txns/DiYjyuEXfyvYW1hfnPa4XSvDPsJNA9yd38phyfksaEhc).

Total API usage for the three runs: about $0.70.

## Reproduce

```bash
cd agents && npm install                                  # @anthropic-ai/claude-agent-sdk (+ the platform binary)
node tools/make_account.mjs maker 1.3 MAKER               # once: a funded sub-account whose key goes to .env as MAKER_*
node agents/competitor.mjs --task 5                       # ANTHROPIC_API_KEY in .env; ~$0.2 to 0.4 per run at claude-opus-5-5
node agents/caller.mjs --task 5 --submission <id> --rows 3
```

Transcripts land in `agents/out/<agent>-<timestamp>.md` (readable) and `.jsonl` (every SDK message). `agents/work/` is the
competitor's scratch space and is not committed.
