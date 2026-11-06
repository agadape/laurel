"""Assemble one self-contained Markdown brief for an external model audit (written for Gemini's strengths: Google
Search grounding, very long context). Everything the auditor needs is inlined: instructions, docs, claims, data pipeline,
and the full source of the contract, evaluator, core crate, MCP server, agents and tools.

    python docs/audit/build_gemini_brief.py            -> docs/audit/GEMINI_AUDIT_BRIEF.md
"""
import json, os, subprocess, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "docs", "audit", "GEMINI_AUDIT_BRIEF.md")


def read(rel):
    p = os.path.join(ROOT, rel)
    return open(p, encoding="utf-8", errors="replace").read().replace("\r\n", "\n")


def fence(rel, lang):
    body = read(rel).rstrip("\n")
    tick = "````" if "```" in body else "```"
    return f"### `{rel}`\n\n{tick}{lang}\n{body}\n{tick}\n"


def doc(rel, title=None):
    body = read(rel).rstrip("\n")
    # demote headings so the brief's own structure stays on top
    lines = [("#" + l if l.startswith("#") else l) for l in body.split("\n")]
    return f"\n\n---\n\n## {title or rel}\n\n*(verbatim copy of `{rel}`)*\n\n" + "\n".join(lines) + "\n"


git = subprocess.run(["git", "log", "--format=%h %ad %s", "--date=short", "-25"], cwd=ROOT, capture_output=True, text=True).stdout
snapshot_path = os.path.join(ROOT, "tools", "out", "state_snapshot.json")
snapshot = open(snapshot_path, encoding="utf-8").read() if os.path.exists(snapshot_path) else "{}"

INTRO = f"""# Laurel — audit brief for an external model (built for Gemini)

Generated {datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M UTC")} from the repository at commit `{git.split()[0] if git else "?"}` (https://github.com/agadape/laurel).
This single file contains everything: who we are, what we built, every claim we make, the whole source of the pieces
that matter, and what we want from you. You do not need the repository; you do need the web.

## 0. Who you are and what we want

You are auditing a hackathon project (NEAR HACKATHON 2026, deadline 14 Nov 2026 23:59 UTC, tracks `agents`, `privacy`,
`open`) eight days before submission. The team is two people; one AI assistant (Claude) wrote most of the code and the
docs with them, and an earlier ChatGPT audit already shaped the README's "Security model" and "Questions a judge will ask"
sections. We now want a **second, independent, adversarial audit that uses what you are good at**:

1. **Grounded verification with Google Search.** Every transaction hash in this brief is on NEAR testnet; check a sample
   of them on `https://testnet.nearblocks.io/txns/<hash>` (or any explorer you can reach) and tell us if any claim does not
   match what the chain shows. Check `https://laurel-near.vercel.app` (read-only, no wallet needed) and the npm package
   `laurel-mcp`. Check OutLayer's public documentation (`outlayer.near`, `outlayer.testnet`, "OutLayer NEAR TEE") and
   tell us whether our description of how its secrets are bound to a wasm hash and how attestation works is accurate,
   overstated or understated. Check the NEAR HACKATHON 2026 public pages for the judging criteria and the tracks, and
   score us against them as a judge would.
2. **Landscape.** Find the closest existing projects (decentralised model competitions, on-chain or TEE-verified ML
   inference, model marketplaces, "Kaggle on-chain", zkML inference services, agent-economy tooling on NEAR and elsewhere)
   and tell us plainly where Laurel is weaker, where it is genuinely different, and which comparison a judge is likely
   to make. Name them.
3. **Claims vs code.** `CLAIMS.md` maps every README statement to code, tests and hashes. Read the code (all inlined
   below) and find claims that are wrong, stretched, or unverifiable. Be specific: quote the claim, quote the code.
4. **Security and economics of the contract** (`contracts/bursa/src/lib.rs`, inlined in full): griefing, fund loss,
   stuck states, callback misuse, storage accounting, quota bypass, anything an attacker or a careless user could hit on
   mainnet. We know some limits already (listed in the README's Limits and Security sections); tell us what we missed.
5. **The dataset methodology** of task 5 (`tasks/near-retention`, SQL inlined): leakage between features and label,
   population definition, sampling bias, whether the "private rows are secret" claim holds, and whether the BigQuery
   queries do what the README says.
6. **The autonomous agents** (`agents/`): is the tool policy as tight as we say, can the agent exceed it, is anything in
   the transcripts' evidence weaker than the README implies.
7. **What to do in the remaining days.** A ranked list, each item with effort and expected effect on judging, including
   things we should *stop* doing. If you think a claim should be removed rather than fixed, say so.

Constraints you should know: the contract is **frozen** (no redeploy before submission unless you find a real bug);
testnet only (mainnet was judged too expensive, the README says "mainnet-ready" with reasons); we will not add a new
model class. Everything else is open.

**Output format.** One Markdown report, in English, with: (a) a one-paragraph verdict as a judge; (b) a findings table
(severity: blocker / major / minor / nit; area; claim or code quoted; what is wrong; fix); (c) the landscape comparison;
(d) the ranked to-do list; (e) a short summary in Indonesian for the team lead. Where you used the web, cite the URL.
Where you could not verify something, say "could not verify" instead of guessing. Do not praise; we have enough of that.

## 1. The project in one page

- **Name:** Laurel (contract codename `bursa`). Repository https://github.com/agadape/laurel, MIT.
- **One line:** *Compete. Verify. Deploy.* Small gradient-boosted-tree models compete on a private test set scored inside
  a TEE, and the winner becomes a NEAR contract method that AI agents and other contracts call and pay for, per prediction.
- **Live:** contract `laurel.laurel-team-mw0x0c8g.testnet` (NEAR testnet, near-sdk 5.30), explorer
  https://laurel-near.vercel.app (Vite + React, read-only without a wallet), MCP server `laurel-mcp` on npm (stdio) and a
  remote read-only MCP endpoint https://laurel-near.vercel.app/api/mcp (Streamable HTTP, stateless, on Vercel).
- **TEE:** OutLayer (`outlayer.testnet`). The evaluator is a `wasm32-wasip2` program pinned in the contract by sha256
  `8b80010fc79259c9f5d95183a660e79ad7a450fdfceed3e8ce0924f296b60ac3`, served from
  `https://nh-spike-wasm.vercel.app/<hash>.wasm`. The private test splits are OutLayer secrets (`TEST_SET_A`, `TEST_SET_B`)
  bound to that hash, stored by `nh-spike-mvp62mw4.testnet` under profiles `german-credit` and `near-retention`.
- **Tasks on the contract:** 1 `german-credit` (closed), 2 `german-credit-open`, 3 `credit-risk` (closed; champion #4),
  4 `credit-risk-open` (open to 25 Nov), 5 `near-retention` (real mainnet data, open to 12 Nov 12:00 UTC).
- **Model format:** integer GBDT, borsh v1: `u8 version, u16 n_features, i64 feature_scale, i64 out_scale, i64 bias,
  u32 n_trees, per tree u32 n_nodes, per node (u16 feature, i64 threshold, u16 left, u16 right, i64 value)`, leaf =
  left == right == 0xFFFF, walk `x[feature] <= threshold ? left : right`, raw score = bias + one leaf per tree,
  label 1 iff raw > 0. The same arithmetic runs in the contract (`crates/gbdt-core`), in the evaluator, in Python
  (`tools/export.py`) and in JS (`mcp/gbdt.mjs`, BigInt). `web/src/model.js` only decodes the borsh trees for drawing.
- **Metric:** balanced accuracy in basis points, integer arithmetic, rounded down to 50 bps; F1 shown, not used for ranking.
  Split A is public while a task is open; split B is sealed in the leaderboard until `close_task` and alone decides.
- **Economics:** submission fee (0.1 NEAR) to the task creator; storage paid by the submitter; `request_score` deposits
  0.1 NEAR to OutLayer (about 0.001 NEAR charged, rest refunded); predictions paid from the caller's prepaid credit
  (`deposit_credit`) at the task's `fee_per_call` (0.001 NEAR) to the model owner (`withdraw_earnings`).
- **Agents:** `agents/competitor.mjs` and `agents/caller.mjs` (Claude Agent SDK) entered submission #10 and bought
  predictions from it with a function-call key; transcripts in `agents/out/`.
- **Team:** two students in Indonesia; sister project Undo (https://github.com/agadape/undo) by the same team, disclosed.

## 2. Live state snapshot (read from the contract when this brief was built)

```json
{snapshot}
```

## 3. Recent commits

```
{git}```

## 4. Repository map

```
contracts/bursa/          the registry contract (Rust, near-sdk 5.30); src/lib.rs + src/events.rs; 50 unit tests
contracts/consumer-example/  a second contract that calls predict_task through a promise (credit desk)
crates/gbdt-core/         integer GBDT decode / validate / raw_score, shared by contract and evaluator
evaluator/                the TEE program (wasm32-wasip2) OutLayer runs; reads TEST_SET_A/B from env, model via view
mcp/                      laurel-mcp: MCP server (stdio) with read-only and paid tools; gbdt.mjs port of the scorer
web/                      Vite + React explorer; web/api/mcp.mjs = remote read-only MCP endpoint on Vercel
agents/                   Claude Agent SDK agents (competitor, caller) and their transcripts
tasks/german-credit/      UCI German Credit simulation: spec, split, train, manifest
tasks/near-retention/     NEAR mainnet retention task: BigQuery SQL, fetch, build, train, manifest, population stats
tools/                    deploy, create_task, submit, predict, agent, consumer, e2e, export.py, quickstart, secrets.sh
docs/                     ABI, AGENT, AGENTS, CONSUMER, E2E, EVALUATOR, GAS, MCP, NEGATIVE_TESTS, QUICKSTART, SUBMISSION, TESTNET
CLAIMS.md                 every README claim -> code, tests, tx hashes
SPIKE_LOG.md              the spikes that de-risked each piece before building
```
"""

parts = [INTRO]
parts.append(doc("README.md", "README.md (the document judges read first)"))
parts.append(doc("CLAIMS.md", "CLAIMS.md (claim → code → evidence)"))
parts.append(doc("docs/EVALUATOR.md"))
parts.append(doc("docs/NEGATIVE_TESTS.md"))
parts.append(doc("docs/GAS.md"))
parts.append(doc("docs/AGENT.md"))
parts.append(doc("docs/CONSUMER.md"))
parts.append(doc("docs/E2E.md"))
parts.append(doc("docs/ABI.md"))
parts.append(doc("docs/MCP.md"))
parts.append(doc("docs/AGENTS.md"))
parts.append(doc("docs/QUICKSTART.md"))
parts.append(doc("docs/TESTNET.md"))
parts.append(doc("tasks/near-retention/README.md", "tasks/near-retention/README.md (task 5, real mainnet data)"))
parts.append(doc("tasks/german-credit/README.md", "tasks/german-credit/README.md (task 1–4 dataset; Indonesian)"))
parts.append(doc("SPIKE_LOG.md", "SPIKE_LOG.md (what was tested before building; Indonesian/English)"))

parts.append("\n\n---\n\n## Source code (verbatim)\n\nRead these as the ground truth for every claim above.\n")
for rel, lang in [
    ("contracts/bursa/src/lib.rs", "rust"), ("contracts/bursa/src/events.rs", "rust"),
    ("crates/gbdt-core/src/lib.rs", "rust"), ("evaluator/src/main.rs", "rust"),
    ("contracts/consumer-example/src/lib.rs", "rust"),
    ("tasks/near-retention/features.json", "json"), ("tasks/near-retention/sql/build_tables.sql", "sql"),
    ("tasks/near-retention/sql/population_stats.sql", "sql"), ("tasks/near-retention/fetch.py", "python"),
    ("tasks/near-retention/build.py", "python"), ("tasks/near-retention/train.py", "python"),
    ("tasks/near-retention/private_manifest.json", "json"), ("tasks/near-retention/population.json", "json"),
    ("tools/export.py", "python"), ("tools/submit.mjs", "javascript"), ("tools/create_task.mjs", "javascript"),
    ("tools/quickstart.mjs", "javascript"), ("tools/secrets.sh", "bash"), ("tools/lib.mjs", "javascript"),
    ("mcp/server.mjs", "javascript"), ("mcp/gbdt.mjs", "javascript"), ("web/api/mcp.mjs", "javascript"),
    ("agents/competitor.mjs", "javascript"), ("agents/caller.mjs", "javascript"),
    ("web/src/rpc.js", "javascript"), ("web/src/model.js", "javascript"),
]:
    if os.path.exists(os.path.join(ROOT, rel)):
        parts.append(fence(rel, lang))

parts.append("\n\n---\n\n## Agent transcripts (verbatim, readable form)\n")
for rel in ["agents/out/competitor-2026-11-05T13-49-26.md", "agents/out/competitor-2026-11-05T13-53-49.md", "agents/out/caller-2026-11-05T13-57-13.md"]:
    if os.path.exists(os.path.join(ROOT, rel)):
        parts.append(fence(rel, "markdown"))

parts.append("""

---

## Closing instructions

Work through sections 0.1 to 0.7 in order. Before writing the findings table, list the URLs you actually opened. If the
web gives you nothing on a point, say so. Quote code with file and function name. Rank the to-do list by effect on the
judges' score per hour of work, and put "remove or soften this claim" items at the top when they apply. End with the
Indonesian summary (ringkasan untuk ketua tim: apa yang paling berbahaya, apa yang paling berharga, apa yang harus
dilakukan besok).
""")

text = "".join(parts)
open(OUT, "w", encoding="utf-8", newline="\n").write(text)
print(OUT, len(text), "chars,", text.count("\n"), "lines")
