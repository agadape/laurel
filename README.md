# Laurel — small decision models as on-chain infrastructure on NEAR

*Trained off-chain, ranked on a private TEE benchmark, served from a NEAR contract to agents and other contracts. The model that earns the laurel serves on-chain.*

Built at **NEAR HACKATHON 2026** (testnet). Tracks: `agents`, `privacy`, `open`. Contract codename `bursa` (Indonesian for *exchange*) is kept in code, file and account names.
Sister project by the same team (disclosed per rule Q-015): **Undo** (reversible wrapped-USDC payments with a TEE-verified AI court). The two projects are independent products; what they share is the research notes in `docs/research/` and the testnet spike log: `spikes/contracts-undo/` and `spikes/s20*–s22*` are Undo's own spikes kept here as history and are not used by Laurel.

## What it is

**Compete. Verify. Deploy.** Laurel is a decentralized model competition and deployment protocol: small models compete under confidential evaluation, prove their results through a TEE bound to a pinned evaluator, and become permissionless prediction services on NEAR.

Laurel is a **registry contract** (`bursa`) where anyone can publish a *decision task* with a private test set, anyone can submit a small gradient-boosted-tree model, a TEE worker (OutLayer) scores the model against the private test set, the score comes back on-chain, and the winning model becomes callable infrastructure: **other contracts and AI agents call `predict_task(task_id, features)` and get a prediction inside NEAR consensus**, paying a per-call fee to the model's owner.

Why on NEAR:
- The model runs **inside the contract** (integer GBDT, no oracle round-trip): one prediction with a 33 KB / 50-tree model costs **4.3 Tgas** ([docs/GAS.md](docs/GAS.md)), so other contracts can compose it synchronously in a promise.
- **OutLayer** (NEAR partner) runs the evaluator in a TEE with the test set stored as a secret that is **bound to the evaluator's wasm hash**; the contract pins that hash, so neither participants nor the operator can swap the scorer ([docs/EVALUATOR.md](docs/EVALUATOR.md)).
- **Function-call access keys** give capability-based authorization at the protocol level: an AI agent holds a key that can only call `predict_task` on this contract: the protocol itself rejects `withdraw_credit`, deposits, other contracts and transfers from that key ([docs/AGENT.md](docs/AGENT.md)).

Demo task: **credit risk on UCI German Credit** (simulation only, see limits) — 18 integer features, label `1 = bad`, metric balanced accuracy. Live explorer: **https://laurel-near.vercel.app** (public landing page; the explorer opens after signing in with a NEAR testnet wallet, which creates no transaction).

## What is proven on testnet (3 Nov 2026)

| Claim | Evidence |
|---|---|
| Full journey from fresh accounts: task → 2 submissions → 2 OutLayer scores → leaderboard → close → agent `predict_task` → owner withdraws earnings; 17/17 negative paths rejected | [docs/E2E.md](docs/E2E.md) (every tx hash), `tools/e2e.mjs` |
| Scores computed in the TEE equal the local evaluator and the Python reference, bit for bit | `docs/E2E.md` ("matches local/Python"), `tools/eval_local.sh`, `crates/gbdt-core` tests |
| A different evaluator build cannot read the task secret | SPIKE_LOG S30, [docs/NEGATIVE_TESTS.md](docs/NEGATIVE_TESTS.md) §3 |
| Agent with a restricted key: 10 applicants screened, 4.31 Tgas/call, 4 forbidden actions rejected by the protocol | [docs/AGENT.md](docs/AGENT.md) |
| Another contract uses the model through a promise and pays from its own prepaid credit | [docs/CONSUMER.md](docs/CONSUMER.md), `contracts/consumer-example` |
| Gas and storage costs | [docs/GAS.md](docs/GAS.md); 10 agent calls on the final contract (4 Nov): function receipt **4.340 to 4.341 Tgas**, whole transaction **4.652 to 4.653 Tgas** burnt (`tools/out/agent.json`), i.e. about 0.00047 NEAR of gas plus the 0.001 NEAR fee per prediction at the base gas price |

Every claim is mapped to code and transactions in [CLAIMS.md](CLAIMS.md).

## Try it

### A. Read-only, in the browser (2 minutes, needs a NEAR testnet wallet to sign in)
1. Open https://laurel-near.vercel.app → **see** the landing page: live figures from `laurel.laurel-team-mw0x0c8g.testnet`, the champion model's 50 decision trees drawn from the bytes stored on-chain, and exhibit 03's split-A vs split-B readings. Click **Connect wallet to enter** and sign in with a testnet wallet (Meteor, Intear or Nightly; signing in creates no transaction) → **see** the exhibits (tasks). A deep link such as `#/task/3` opens straight after sign-in. Without a wallet, step 4 below and the remote MCP endpoint (section on MCP) read the same data.
2. Click exhibit **03 Credit risk** → **see** the two readings: on the split-A scale #5 is ahead (75.50 %), on the split-B scale, unsealed because the task is closed, #4 is the champion (66.50 %); below, one specimen plate per entry (one dot per private test row, orange = misjudged) and the "in service" strip with #4's call count. Exhibit **04** is still open, so its split-B scale shows a sealed band instead.
3. Click **Specimen #4** → **see** all 50 trees drawn from the on-chain bytes (hover one for its root split), both confusion plates, the pinned evaluator hash, the model sha256 and the owner's earnings.
4. Same data straight from RPC (needs `curl` and Python 3 for the decoding one-liner):
   ```bash
   curl -s https://rpc.testnet.fastnear.com -H 'content-type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"query","params":{"request_type":"call_function","finality":"final","account_id":"laurel.laurel-team-mw0x0c8g.testnet","method_name":"leaderboard","args_base64":"eyJ0YXNrX2lkIjozfQ=="}}' | python -c "import sys,json;print(bytes(json.load(sys.stdin)['result']['result']).decode())"
   ```
   → **see** JSON rows with `score_a_bps`, `score_b_bps`, `calls`.

### B. The whole journey from zero, on your own testnet account (≈ 6 minutes, ≈ 6 NEAR, 3.2 of them stay locked as contract storage)
Prerequisites: Node ≥ 20, a NEAR **testnet** account with **≥ 7 NEAR** (browser faucet: https://near-faucet.io, or `near account create-account sponsor-by-faucet-service …` which funds 10 NEAR) and its ed25519 private key.
```bash
cd tools && npm install && cd ..
cp .env.example .env            # then fill TEAM_ACCOUNT_ID and TEAM_PRIVATE_KEY
node tools/e2e.mjs --funder TEAM --minutes 3 --cleanup
```
→ **see** in the terminal: 5 fresh accounts, `deploy + new`, `create_task`, two `submit_model`, two `request_score` lines ending in `matches local/Python`, `[rejected] …` for every negative path, `waiting …s for the deadline`, `close_task`, three `predict_task` lines with labels, a `SUMMARY` with `scores_match_local: true`, then cleanup. The report with all hashes lands in `docs/E2E.md` and `tools/out/e2e.json`.
The private test set is the one we stored at OutLayer (owner `nh-spike-mvp62mw4.testnet`, profile `german-credit`, access `allow-all`, bound to evaluator hash `8b80010f…`); your fresh contract references it by `secrets_account/secrets_profile`, so you do not need our keys. To host your **own** secret and evaluator see [docs/EVALUATOR.md](docs/EVALUATOR.md).

Then open `https://laurel-near.vercel.app/?contract=<your bursa-… account>` → **see** your run in the explorer.

### C. Rebuild and test (Linux/WSL with Rust 1.8x, `cargo-near`, target `wasm32-wasip2`)
```bash
bash build.sh test        # 50 bursa + 3 credit-desk + 4 gbdt-core + 1 evaluator unit tests
bash build.sh contract    # wasm/bursa.wasm, wasm/credit_desk.wasm (+ ABI)
bash build.sh evaluator   # wasm/evaluator.wasm + its sha256
```
→ **see** `test result: ok` four times and the three wasm files with sizes. The printed evaluator sha256 is what you would pin with `set_evaluator` for your own deployment; it only equals our pinned `8b80010f…` if your Rust toolchain matches ours (Rust 1.99, see `docs/EVALUATOR.md`). Prebuilt wasm is committed in `wasm/`, so step B works without Rust.

### D. Train and submit your own model (Python 3.10+, `pip install scikit-learn pandas numpy`)
Submit to an **open** task: on our final contract `laurel.laurel-team-mw0x0c8g.testnet` that is **task 4** (slug `credit-risk-open`, open until 2026-11-25 23:59 UTC → use `4` as `<open_task_id>`; the demo task `german-credit` is closed so that `predict_task` works). On your own contract from step B, create one first — the `--secrets-account/--profile` pair points it at the private test set we host at OutLayer:
```bash
node tools/create_task.mjs german-credit --as TEAM --minutes 1440 --secrets-account nh-spike-mvp62mw4.testnet --profile german-credit
python tasks/german-credit/split.py                      # downloads UCI data, writes public/private splits + manifest
python tasks/german-credit/train.py --trees 40 --depth 3  # trains on public_train.csv only
python tools/export.py --task german-credit --model tasks/german-credit/model_baseline.pkl --out tasks/german-credit/out/mine
node tools/submit.mjs <open_task_id> tasks/german-credit/out/mine/model.bin --as TEAM
```
→ **see** `validate_model -> {"ok":true,…}`, `submission_id = N`, then `scored in ~10000 ms -> {"status":"Scored","bal_acc_a_bps":…}` and the updated leaderboard. Models must be ≤ 250 KB / 500 trees with strictly increasing child indices and |values| ≤ 2^40 (`crates/gbdt-core::validate`).

### E. Call the winner from an agent or from a contract
On our final contract the closed demo task is **task 3** (`<task_id>` = `3`); `predict_task` works only on a closed task.
```bash
node tools/predict.mjs <task_id> --row 0 --as TEAM --deposit 0.02   # prepay once, then predict_task
node tools/agent.mjs <task_id> --rows 10                             # restricted key + 4 protocol rejections → docs/AGENT.md
node tools/consumer.mjs <task_id> --funder TEAM                      # deploys credit-desk, screens 3 applicants → docs/CONSUMER.md
```

### F. Give the model to an AI agent as an MCP server (`mcp/`, `web/api/mcp.mjs`)
Two ways, for every OS and client; the picker with ready-to-paste snippets is at https://laurel-near.vercel.app/#/connect.
- **Remote, nothing to install** (Claude.ai / Claude Desktop connectors, Claude Code `--transport http`, Cursor, VS Code): `https://laurel-near.vercel.app/api/mcp` — read-only (exhibits, leaderboards, specimens, model bytes, local prediction), served by a stateless Streamable-HTTP function on Vercel.
- **Local, with on-chain calls** (Node 18+, macOS/Windows/Linux):
```json
{ "mcpServers": { "laurel": { "command": "npx", "args": ["-y", "laurel-mcp"] } } }
```
Published on npm as [`laurel-mcp`](https://www.npmjs.com/package/laurel-mcp) (5 Nov 2026); Claude Code: `claude mcp add laurel -- npx -y laurel-mcp`; from this clone: `node mcp/server.mjs`. Seven tools: list exhibits, exhibit + leaderboard, specimen, **download the model's bytes from the contract**, **run it locally with the contract's integer arithmetic**, credit, and **`predict_task` on-chain** (needs `LAUREL_ACCOUNT_ID` / `LAUREL_PRIVATE_KEY`, a function-call key is enough). → **see** `laurel_predict_local` and `laurel_predict` return the same raw score for the same row (811014 for holdout row 0 of task 3, tx `ZockCH1M…`). The sealed rule holds in the tools too: split B of an open task is masked. Details and the verified run: [docs/MCP.md](docs/MCP.md).

## Business model (what is built, and what is not)

A model that wins an exhibit is **paid per prediction, in NEAR, on-chain**: the task creator sets `fee_per_call`; every `predict_task` / `predict` debits the caller's prepaid credit (`deposit_credit`) and credits the model owner, who withdraws with `withdraw_earnings`. This has run since the first deployment (docs/AGENT.md: 10 calls, 0.01 NEAR to the owner; the champion of exhibit 03 has earned from 19 calls). What the 5 Nov update adds is the **surface**: the landing page shows the live economics (fee, gas, calls served, earnings), the site has **NEAR wallet login** (Meteor, Intear, Nightly; testnet) with one job, *buy prediction credit* from the browser and withdraw credit or earnings, and the **Connect** page turns it into three steps: buy credit → give your agent a function-call key limited to `predict_task` (the "licence key": the protocol rejects everything else from it) → plug Laurel into the agent through MCP. Browsing the explorer is free but needs a wallet sign-in (no transaction); the landing page and the remote MCP endpoint need no wallet at all; only predictions are paid. First browser purchase: tx [`4YHqm8GP…`](https://testnet.nearblocks.io/txns/4YHqm8GPUpv6kvMSiBzUP3UwTnhLoWp6tK3BoKrj8rfd) (0.05 NEAR of credit via Meteor Wallet, 5 Nov).

**Not built, on purpose (phase 2 after the hackathon):** a price per model set by its owner (today the fee is per task), delegated spending so a hosted service can bill a user's credit, and on-chain licences. Model bytes are public by design (`get_model_bytes`): what is sold is the verified prediction, not the file.

## Security model and trust boundaries

What an attacker would try, and what stops it today. "Protocol" means NEAR itself, "contract" means `contracts/bursa`, "OutLayer" means the TEE worker network we do not run.

| Attack | What stops it | Where |
|---|---|---|
| Swap the model after it was scored | Bytes are stored once at `submit_model` and never updated; a new upload is a new submission id; `model_hash` (sha256) is stored and shown | `submit_model`, `Submission.model_hash` |
| Have a lenient evaluator score my model | The evaluator is not chosen by participants: `request_score` only uses the hash the contract pins, and the OutLayer secret opens only for that hash (`TEST_SET_A missing` for any other build) | `request_score`, `set_evaluator` (owner), SPIKE_LOG S30 |
| Operator swaps the evaluator later | Possible for *future* scores only: `set_evaluator` is owner-only and emits an event, and every submission records `scored_by` (the hash that produced its score), so a judge can see which evaluator scored what | `scored_by`, `docs/ABI.md` |
| Learn the sealed split from the evaluator output | The evaluator returns aggregates only (tp/tn/fp/fn per split, at most 900 bytes), never per-row predictions; scores are rounded to 50 bps; split B stays hidden in the leaderboard until close | `evaluator/src/main.rs`, `leaderboard` |
| Tune a model against split B by resubmitting | 3 submissions per account per task, a deadline, split B revealed once at close; the public dataset makes this a *leaderboard-feedback* defence, not data secrecy (see Limits) | `max_per_account`, `close_task` |
| Replay an old score onto another submission | The OutLayer callback is bound to the submission id and is idempotent: a second or stale callback changes nothing | `on_score`, unit test `on_score_ignores_duplicate_callback` |
| Change the winner after the fact | `close_task` is permissionless and deterministic: best split-B score, ties to the earlier submission; it runs once | `close_task`, unit tests |
| Spend from the agent's account | The agent's key is a function-call key limited to `predict_task`/`predict` on this contract with a gas allowance: the protocol rejects transfers, deposits, other methods and other contracts before any contract code runs (capability-based authorization at the protocol level) | docs/AGENT.md |
| Drain prediction credit | Credit is per account, debited only by that account's own calls, withdrawable only by its owner | `deposit_credit`, `withdraw_credit` |

What is **not** guaranteed, stated plainly: the contract trusts what `outlayer.testnet` returns (it verifies no TDX attestation itself; attestation is OutLayer's, bound to the wasm hash, inputs and outputs of each run); the dataset commitment (`tasks/german-credit/private_manifest.json`, sha256 of both private splits) lives in the repo, not on-chain; the owner can pin a different evaluator for future scoring; a public dataset can be trained on in full; no Sybil resistance beyond quota and cost.

## Questions a judge will ask

- **Why a blockchain at all?** Because the winner becomes an *address*: `predict_task(id, features)` is callable by any account and any contract, metered and paid in consensus, without an API key or a server anyone has to keep alive. A leaderboard site cannot be composed into another contract.
- **Why a TEE?** The private test set must be read by the evaluator and by nobody else. OutLayer binds the secret to the evaluator's wasm hash, so the only way to read it is to *be* the pinned evaluator, inside the enclave.
- **If the TEE only proves what ran, how do we know the evaluator is correct?** That does not come from the TEE. The evaluator is open source (`evaluator/`), builds reproducibly to the pinned sha256, shares its scoring code with the contract's `gbdt-core`, and its outputs are checked against the local evaluator and a Python reference vector by vector (`docs/EVALUATOR.md`, `crates/gbdt-core` tests).
- **Is the prediction really computed on-chain?** Yes: integer GBDT inside the contract, no oracle. The same bytes give the same raw score on-chain, in the TEE, in Python and in `laurel-mcp`'s local runner (811014 for holdout row 0 of task 3 on all four).
- **Can participants overfit?** To split A, partly: that is why split B exists and is revealed only at close. With 150 rows per split a 5-point gap is 7 to 8 rows, so the demo's lesson is "the public leaderboard does not predict generalization", not "deep trees beat shallow ones".
- **Why NEAR?** Function-call access keys (an agent key that can only call one method), cheap deterministic wasm execution (about 4.3 Tgas per prediction), precise storage accounting that makes a 33 KB model affordable to keep on-chain, and OutLayer as a NEAR-native TEE service with yield/resume.
- **Why would anyone use a Laurel model instead of hosting their own?** Because it comes with a public, verifiable record (hash, evaluator, sealed-split score, every call) and is callable by other contracts: "models with publicly verifiable competition records, available through permissionless on-chain interfaces", not "the best model for everyone".
- **What still depends on the operator?** Pinning the evaluator for new tasks, the Vercel hosting of the evaluator wasm (integrity still rests on the pinned hash), and OutLayer's availability. Closing a task and calling a winner are permissionless.
- **What if the winning model is malicious or useless?** It can only return an integer score for the features it is given; it cannot touch funds or state. Consumers decide what to do with the score (`contracts/consumer-example` turns it into an approve / require-deposit decision), and the split-B record is public.
- **Production-ready?** No: testnet, a 1994 simulation dataset, one task shape, no audit. The mechanisms are real; the deployment is a hackathon demo.

## How it works

```
task creator ─ outlayer secrets set --wasm-hash <EVALUATOR> ──► OutLayer (private test set, encrypted, hash-bound)
             ─ create_task ────────────────────────────────► bursa (registry contract)
participant  ─ export.py → model.bin ─ submit_model ────────► bursa stores the model as DATA (borsh), validates structure
             ─ request_score ──────────────────────────────► bursa → OutLayer.request_execution(pinned evaluator, task secrets_ref)
                                                             TEE worker: evaluator view(get_model_bytes) → scores A/B → on_score callback
anyone       ─ close_task (after deadline) ─────────────────► winner = best split-B balanced accuracy
agent/contract ─ predict_task(task_id, features) ──────────► inference inside consensus; fee from prepaid credit → owner earnings
```

- `contracts/bursa` — tasks, submissions, pinned evaluator, score state machine (`Uploaded → Pending → Scored | Failed`, idempotent callback), leaderboard (split B hidden until close), prepaid credit, metered `predict`/`predict_task`, pull-payment earnings. ABI: [docs/ABI.md](docs/ABI.md).
- `crates/gbdt-core` — integer-only GBDT shared by the contract and the evaluator; `validate()` rejects cycles, bad indices and feature ranges.
- `evaluator/` — `wasm32-wasip2` program for OutLayer: reads the model through the `view` host function, the secrets from env, prints ≤ 900 B JSON with balanced accuracy and F1 for both splits.
- `tools/` — Node scripts for every write action (the browser wallet only buys credit and withdraws); `tools/export.py` converts sklearn models.
- `web/` — Vite/React explorer over RPC view calls: a public landing page (`web/src/Landing.jsx`) and the explorer behind a NEAR wallet sign-in.
- `tasks/german-credit/` — dataset spec, split and training scripts, commitment manifest of the private splits.

NEAR features used: own contract (near-sdk 5.30), cross-contract promises and callbacks, function-call access keys with method restriction, OutLayer (TEE compute with hash-bound secrets, result returned into the calling transaction), NEP-297 events, precise storage accounting.

## Limits (please read before judging the numbers)

- **Simulation.** German Credit is a 1973–75 German dataset with known biases; two sensitive attributes are dropped, `age` is kept. The decisions ("approve / require deposit") are illustrations, not a credit tool. [tasks/german-credit/README.md](tasks/german-credit/README.md).
- **Private ≠ secret from everyone.** The dataset is public, so a participant could train on all 1,000 rows. The private split protects against leaderboard-feedback overfitting (3 submissions per account, scores rounded to 50 bps, split B only used at close), not against downloading UCI. Split-B scores are visible in the OutLayer transaction log even though the contract hides them until close.
- **No real Sybil resistance** beyond per-account quota and submission cost.
- **Model class.** Binary GBDT with integer thresholds only; a 197 KB / 100-tree model costs 13 Tgas per call and 2 NEAR of storage.
- **Trust assumptions.** The contract trusts what `outlayer.testnet` returns: it verifies no TEE attestation itself, so the "only the pinned evaluator can read the secret" guarantee is OutLayer's, not ours. The contract `owner` can call `set_evaluator` at any time (an `evaluator_set` event is emitted and every scored submission records `scored_by`), so participants trust the owner not to swap the scorer mid-task. The private test set for the demo task is an OutLayer secret owned by a team account.
- **Hosting.** The FastFS testnet gateway was down during the hackathon, so the evaluator wasm is served from Vercel; integrity still rests on the sha256 pinned in the contract, not on the host. Storing a 15 KB secret needed a one-line local patch of the OutLayer CLI deposit constant (`tools/patch_outlayer_cli.sh`).
- **Score requests.** If OutLayer's own call fails (promise error), the deposit is returned to the requester by the callback; a request whose timeout callback lands after a re-request may need one more `request_score`.
- **Testnet only, mainnet-ready.** Nothing in the code is testnet-specific: `outlayer.near` runs the same contract code as `outlayer.testnet` (identical code hash `5waWVnt6…`, checked 4 Nov 2026), the evaluator is pinned by sha256 and hosted off-chain, and the tools take the network from `.env`. A minimal mainnet deployment (contract + one task + one TEE-scored model) costs ≈ 3.5 NEAR, of which ≈ 2.9 NEAR is refundable code storage (289 KB at 1 NEAR / 100 KB) and ≈ 0.5 NEAR is spent (secret storage, score deposit, gas). We chose to keep the hackathon budget on testnet. Not audited.

## Repository map

`contracts/` `crates/` `evaluator/` `tools/` `web/` `mcp/` (MCP server for agents) `tasks/` `wasm/` (prebuilt) · `docs/` (ABI, GAS, AGENT, CONSUMER, E2E, EVALUATOR, MCP, NEGATIVE_TESTS, TESTNET, UI_DIRECTION, audit, research) · `spikes/` (the original testnet spikes S0–S31 that this design rests on, with [SPIKE_LOG.md](SPIKE_LOG.md)) · [PLAN.md](PLAN.md), [IDEAS.md](IDEAS.md), [ARCH_STRESS_TEST.md](ARCH_STRESS_TEST.md) (how the idea was chosen and stress-tested, in Indonesian).

## AI-generated code disclosure

Most code and documentation in this repository were written with Claude (Anthropic) under the team's direction; all behaviour described above was executed by the team on NEAR testnet and the transaction hashes in `docs/` are the record. Libraries: near-sdk, near-api-js, scikit-learn, Vite/React, wit-bindgen, base64, serde.

## License

MIT — see [LICENSE](LICENSE). Dataset: UCI Statlog (German Credit Data), CC BY 4.0, Hofmann 1994.
