# VERIFY: the last full run of `node tools/verify_claims.mjs`

The script re-reads NEAR testnet and checks the on-chain claims of [README.md](../README.md) and [CLAIMS.md](../CLAIMS.md). It is read-only: no key, no `.env`, no transaction, no `npm install` (Node 18+). Run it yourself from the repository root:

```bash
node tools/verify_claims.mjs
```

Exit code 0 = every check passed, 1 = a check failed, 2 = nothing failed but a node could not be reached (public RPC nodes limit the request rate; wait a minute and run it again). This file is the snapshot of one run, written with `--md docs/VERIFY.md`.

| | |
|---|---|
| Contract | `laurel.laurel-team-mw0x0c8g.testnet` (NEAR testnet) |
| Block | every view was read at final block 277085185, 2026-11-10T15:22:01Z |
| Result | **21 PASS, 0 FAIL, 0 UNREACHABLE** of 21 checks; 42 transactions read back from an archival node; 66 s |


## Contract and code

| Result | Check | CLAIMS rows | Observed |
|---|---|---|---|
| PASS | The deployed contract is the wasm committed in this repo | 27, 28 | code hash BVNELFchTXxedNghd8vDWFncVWxstXjmjo3R6WeeoB65 = sha256(wasm/bursa.wasm) |
| PASS | The v1.1 upgrade was a code-only deploy (no init call, no migration) | 27 | [`GU37HBpW…`](https://testnet.nearblocks.io/txns/GU37HBpW6aXVZ57dkDacTspfPLHdsjnCnByhgbBw6uFF): a single DeployContract action on laurel.laurel-team-mw0x0c8g.testnet |
| PASS | The evaluator pinned in the contract is the wasm committed in this repo | 4, 5 | evaluator hash 8b80010fc79259c9… = sha256(wasm/evaluator.wasm) |
| PASS | At least 5 tasks and 13 models are on the contract | README | 5 tasks, 13 models, owner laurel-team-mw0x0c8g.testnet |

## Private benchmark in a TEE

| Result | Check | CLAIMS rows | Observed |
|---|---|---|---|
| PASS | Every scored model was scored by the pinned evaluator | 3, 4, 24 | 13 of 13 scored models carry scored_by = 8b80010f… |
| PASS | Scores were written by OutLayer inside the request_score transaction | 3, 24, 25, 26, 28 | 8 request_score transactions: OutLayer ran 8b80010f… and the score in the transaction equals the stored one |
| PASS | Each closed task's champion is the best sealed (split B) score, ties to the earlier entry | 11 | task 1 → #1 (66.50 %), task 3 → #4 (66.50 %) |
| PASS | Task 3: the public leader lost, the sealed split picked the champion | 11, 28 | [`Fx7k6sDC…`](https://testnet.nearblocks.io/txns/Fx7k6sDCUgVoVdVpjWLqGHoxcNE3tppEs2m8YYHD5EbB): #5 led split A (7550 vs 7100 bps), #4 won split B (6650 vs 6150 bps) |
| PASS | Open tasks do not reveal split B through any view | 11, 27 | tasks 2, 4, 5 are open: 9 entries checked in leaderboard, list_submissions and get_submission |
| PASS | The entries the README names have the scores, sizes and owners it states | 23, 24, 25, 26 | #7 to #13 match (the agent's entries: #10 8350 bps and #12 8300 bps on task 5, #13 7450 bps on task 4) |

## The model lives in the contract and answers for a fee

| Result | Check | CLAIMS rows | Observed |
|---|---|---|---|
| PASS | The champion's bytes on chain are the model file in this repo | 1 | 33011 bytes, sha256 214f89a6c7749191… = tasks/german-credit/out/deep/model.bin |
| PASS | Ten paid predictions by the agent: on-chain answer = the same bytes scored locally | 1, 12, 13 | 10 of 10 equal (first: 811014); each credits 0.001 NEAR to p1 |
| PASS | One prediction with the 33 KB, 50-tree champion costs about 4.3 Tgas | 2 | function receipts burnt 4.340 to 4.341 Tgas |
| PASS | The agent's key can only call the prediction methods of this contract | 13 | ed25519:QBy4d6eV…: function-call key, receiver laurel.laurel-team-mw0x0c8g.testnet, methods predict_task, predict |
| PASS | The buying agent's calls to the autonomous agent's model #10 equal the local score | 25 | 3 of 3 equal, 2.690 to 2.710 Tgas, fee to maker |
| PASS | Another contract buys a prediction through a promise | 14 | 3 calls to desk3.screen: the model ran in laurel.laurel-team-mw0x0c8g.testnet with the consumer contract as the paying caller and returned the local score; 1 bad input rejected without a charge |
| PASS | A browser wallet bought prediction credit | 22 | [`4YHqm8GP…`](https://testnet.nearblocks.io/txns/4YHqm8GPUpv6kvMSiBzUP3UwTnhLoWp6tK3BoKrj8rfd): smoothicon6710.testnet deposited 0.05 NEAR of credit |

## Every transaction cited in CLAIMS.md

| Result | Check | CLAIMS rows | Observed |
|---|---|---|---|
| PASS | Every transaction hash in CLAIMS.md exists on NEAR testnet | all | 33 of 33 found; 1 ended in a failure ([`DtaaDVx9…`](https://testnet.nearblocks.io/txns/DtaaDVx9KhD1evMUTUCZ35T6gU5RBYs9ZTujtp3QRxYo)), which CLAIMS cites as a rejected path |

## Live endpoints (not on-chain)

| Result | Check | CLAIMS rows | Observed |
|---|---|---|---|
| PASS | The site answers | 16 | https://laurel-near.vercel.app → 200 |
| PASS | The remote MCP endpoint lists its tools with nothing installed | 21 | 5 tools, among them laurel_list_exhibits, laurel_exhibit, laurel_specimen |
| PASS | laurel-mcp is published on npm | 20 | laurel-mcp@0.2.0 = mcp/package.json |

What the script does not cover: claims that are not on-chain facts (the unit tests, which run in CI; the bit-for-bit equality of TEE, local and Python scores in docs/E2E.md and docs/EVALUATOR.md; the dataset split; the Agent SDK transcripts). Those rows of CLAIMS.md point to the code, test or log that backs them.
