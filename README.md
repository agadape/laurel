# Laurel — small decision models as on-chain infrastructure on NEAR

*Trained off-chain, ranked on a private TEE benchmark, served from a NEAR contract to agents and other contracts. The model that earns the laurel serves on-chain.*

Built at **NEAR HACKATHON 2026** (testnet). Tracks: `agents`, `privacy`, `open`. Contract codename `bursa` (Indonesian for *exchange*) is kept in code, file and account names.
Sister project by the same team (disclosed per rule Q-015): **Undo** (reversible wrapped-USDC payments with a TEE-verified AI court). The two projects are independent products; what they share is the research notes in `docs/research/` and the testnet spike log: `spikes/contracts-undo/` and `spikes/s20*–s22*` are Undo's own spikes kept here as history and are not used by Laurel.

## What it is

Laurel is a **registry contract** (`bursa`) where anyone can publish a *decision task* with a private test set, anyone can submit a small gradient-boosted-tree model, a TEE worker (OutLayer) scores the model against the private test set, the score comes back on-chain, and the winning model becomes callable infrastructure: **other contracts and AI agents call `predict_task(task_id, features)` and get a prediction inside NEAR consensus**, paying a per-call fee to the model's owner.

Why on NEAR:
- The model runs **inside the contract** (integer GBDT, no oracle round-trip): one prediction with a 33 KB / 50-tree model costs **4.3 Tgas** ([docs/GAS.md](docs/GAS.md)), so other contracts can compose it synchronously in a promise.
- **OutLayer** (NEAR partner) runs the evaluator in a TEE with the test set stored as a secret that is **bound to the evaluator's wasm hash**; the contract pins that hash, so neither participants nor the operator can swap the scorer ([docs/EVALUATOR.md](docs/EVALUATOR.md)).
- **Function-call access keys** let an AI agent hold a key that can only call `predict_task` on this contract: the protocol itself rejects `withdraw_credit`, deposits, other contracts and transfers from that key ([docs/AGENT.md](docs/AGENT.md)).

Demo task: **credit risk on UCI German Credit** (simulation only, see limits) — 18 integer features, label `1 = bad`, metric balanced accuracy. Live read-only explorer: **https://laurel-near.vercel.app**.

## What is proven on testnet (3 Nov 2026)

| Claim | Evidence |
|---|---|
| Full journey from fresh accounts: task → 2 submissions → 2 OutLayer scores → leaderboard → close → agent `predict_task` → owner withdraws earnings; 17/17 negative paths rejected | [docs/E2E.md](docs/E2E.md) (every tx hash), `tools/e2e.mjs` |
| Scores computed in the TEE equal the local evaluator and the Python reference, bit for bit | `docs/E2E.md` ("matches local/Python"), `tools/eval_local.sh`, `crates/gbdt-core` tests |
| A different evaluator build cannot read the task secret | SPIKE_LOG S30, [docs/NEGATIVE_TESTS.md](docs/NEGATIVE_TESTS.md) §3 |
| Agent with a restricted key: 10 applicants screened, 4.31 Tgas/call, 4 forbidden actions rejected by the protocol | [docs/AGENT.md](docs/AGENT.md) |
| Another contract uses the model through a promise and pays from its own prepaid credit | [docs/CONSUMER.md](docs/CONSUMER.md), `contracts/consumer-example` |
| Gas and storage costs | [docs/GAS.md](docs/GAS.md) |

Every claim is mapped to code and transactions in [CLAIMS.md](CLAIMS.md).

## Try it

### A. Read-only, no setup (2 minutes)
1. Open https://laurel-near.vercel.app → **see** the task list read live from `laurel.laurel-team-mw0x0c8g.testnet`.
2. Click task **#3 Credit risk** → **see** the final leaderboard: split-A scores, split-B scores (only visible because the task is closed), the winner badge on submission #4 (deep model: lower split-A score than #5, better split-B) and its call count.
3. Click **Model #4** → **see** the evaluator output stored on-chain (confusion matrix, `eval_version`), the pinned evaluator hash and the owner's earnings.
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
- `tools/` — Node scripts for every write action (no wallet in the browser); `tools/export.py` converts sklearn models.
- `web/` — read-only Vite/React explorer over RPC view calls.
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

`contracts/` `crates/` `evaluator/` `tools/` `web/` `tasks/` `wasm/` (prebuilt) · `docs/` (ABI, GAS, AGENT, CONSUMER, E2E, EVALUATOR, NEGATIVE_TESTS, TESTNET, research) · `spikes/` (the original testnet spikes S0–S31 that this design rests on, with [SPIKE_LOG.md](SPIKE_LOG.md)) · [PLAN.md](PLAN.md), [IDEAS.md](IDEAS.md), [ARCH_STRESS_TEST.md](ARCH_STRESS_TEST.md) (how the idea was chosen and stress-tested, in Indonesian).

## AI-generated code disclosure

Most code and documentation in this repository were written with Claude (Anthropic) under the team's direction; all behaviour described above was executed by the team on NEAR testnet and the transaction hashes in `docs/` are the record. Libraries: near-sdk, near-api-js, scikit-learn, Vite/React, wit-bindgen, base64, serde.

## License

MIT — see [LICENSE](LICENSE). Dataset: UCI Statlog (German Credit Data), CC BY 4.0, Hofmann 1994.
