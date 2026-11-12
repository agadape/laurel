# Task: NEAR account retention (mainnet data)

> A fresh `.near` account showed up in its first week. Will it still be acting a month later?
> Positive class = **retained** (initiated at least one action between day 30 and day 90 after creation).

This is the first Laurel task built from **real NEAR mainnet data** instead of a textbook dataset. Every row is a named
account created through the `near` registrar between 8 June 2026 and 2 August 2026 (UTC) that acted at least once in its
first seven days; every feature comes from the account's creation receipt and those seven days; the label comes from
what the account did between day 30 and day 90. Source: the public BigQuery dataset `bigquery-public-data.crypto_near_mainnet_us` (NEAR Public Lakehouse).

Why it matters on NEAR: most new accounts are created *for free* by relayers (Meteor, HERE, NEAR Mobile, …), which pay
the storage. Quest platforms, airdrops and onboarding programs pay again to attract them. A model that says, after one
week, "this account will still be here in a month" is worth money to all of them, and on Laurel it is callable by any
agent or contract: `predict_task(5, features)`.

## Results

Three baseline models, trained on `public_train.csv` only, exported with `tools/export.py`, scored by the pinned evaluator
(`8b80010f…`) inside OutLayer's TEE on 5 Nov 2026. Split A is public while the task is open; split B is withheld from the
contract's leaderboard until the deadline, **12 Nov 2026 12:00 UTC**, when `close_task` reveals it and names the champion.
Honest footnote (6 Nov): the split-B *score* is readable on-chain before close in the OutLayer receipt's result (and, until
the v1.1 upgrade that afternoon, through `get_submission` too); the *rows* are what is sealed. The team has read those values while checking an audit finding
and commits to make **no further team entries on task 5** (`p1`, `p2`, `laurel-team`, `maker`) so that knowledge cannot be
used; see the README's Security model. Disclosure (12 Nov): one team member entered after that commitment: #14 (`dexseu0.testnet`, 10 Nov) is Dex, the team's designer, testing the one-command quickstart with its default settings. Its bytes are identical to #16 (`chenn19i.testnet`, outside the team), the default quickstart model, so it uses no knowledge of split B; it is still a team entry.

| Submission | Model | Bytes | Public holdout (150 rows) | Split A, TEE | Split B, TEE | Local evaluator (wasmtime, same wasm) |
|---|---|---|---|---|---|---|
| #7 (`p1`) | 10 trees × depth 2 (`train.py --trees 10 --depth 2`) | 1,611 | 8222 bps | **8350 bps** | sealed | A 8350 · B 8400 |
| #9 (team) | 50 trees × depth 4 (`train.py`) | 32,087 | 8638 bps | 8250 bps | sealed | A 8250 · B 8050 |
| #8 (`p2`) | 30 trees × depth 3 | 10,051 | 8388 bps | 8200 bps | sealed | A 8200 · B 8250 |

Balanced accuracy in basis points, rounded to 50 (the evaluator's output also carries the exact confusion counts per split, so the exact value can be recomputed; the rounding is cosmetic). The TEE's split-A readings equal the local evaluator's to the point,
and the integer model agrees with sklearn on every holdout row (`report.json`, `label agreement … 1.0000`). Note the
order: the biggest model wins the public holdout, the smallest wins split A. What split B says is in the contract on
12 Nov; the local numbers are in this table only so that the claim "TEE = local" can be checked after the reveal.

A row is one account's first week on NEAR. Holdout row 0, for instance, acted on 2 UTC dates, called 9 functions
through 5 methods on 4 contracts, received a 32.767+ NEAR transfer, added no keys, touched DeFi, and churned; #7 says
retained (raw score 1,007,503 > 0), which is one of its false positives.

## Population and sample

| | |
|---|---|
| Registrar creations in the window | 43,927 `*.near` top-level accounts whose `CREATE_ACCOUNT` receipt (predecessor `near`) succeeded. 90 % of them never initiated a single action in their first week (28,728 of them, 65 %, were created by a single signer, `titiku.near`, and not one of those ever acted); they are out of scope: there is nothing to predict from |
| Population | 4,407 accounts: the ones that initiated at least one action in their first 7 days |
| Population retention rate | 12.4 % (548 of 4,407) initiated an action between day 30 and day 90 |
| Sample | 1,250 accounts, stratified so that about 40 % are retained (enriched: the model's log-odds are relative to that prior, not to the population's) |
| Creation window | 8 June 2026 to 2 August 2026 (UTC), so day 90 of the last account falls before the data was pulled |
| Observation window | creation receipt + 7 days; **nothing after day 7 is used** |
| Label window | day 30 to day 90 |

The population summary (registrar creations by creator, activated accounts, the population retention rate, the `creator_class` codes) is in [population.json](population.json). It deliberately holds **no per-creator retention rate**: those were computed over the whole population, private rows included, in the first build and were removed on 6 Nov after an external audit flagged them as an aggregate label leak. The creator *frequency ranking* behind `creator_class` is also computed over the whole population (it depends only on who created the accounts, not on labels).

## Label

`retained = 1` if `count(receipt_actions where receipt_predecessor_account_id = account and t0 + 30d <= block_timestamp < t0 + 90d) >= 1`,
where `t0` is the creation block's timestamp.

"Initiated an action" means the receipt's predecessor is the account. That covers a transaction the account signed itself
**and** a meta-transaction (NEP-366) it sent through a relayer, where the relayer is the signer on the transaction table.
The first draft of this task used `transactions.signer_account_id` and found only 122 "retained" accounts in two weeks;
most wallet users on NEAR act through relayers, so that definition undercounts real activity by a wide margin. Any
action counts, whatever its outcome: the account *acted*.

## Features (22, fixed order, all integers that fit i16)

| pos | name | what it is |
|---|---|---|
| 0 | `created_hour_utc` | UTC hour of the creation block, 0–23 |
| 1 | `created_weekday` | 0 = Monday … 6 = Sunday |
| 2 | `creator_class` | who signed the `create_account` call: code of the creator among the four most frequent creators of the population (`population.json` → `creator_codes`), 4 = any other account |
| 3 | `name_len` | length of the name without `.near` |
| 4 | `name_digits` | digits in the name (`fastpant3073` → 4) |
| 5 | `name_has_separator` | 1 if the name contains `-` or `_` |
| 6 | `initial_deposit_mnear` | NEAR transferred in the creation receipt, in milliNEAR, clipped at 32767 |
| 7 | `tx_signed_7d` | receipts of actions the account initiated in days 0–7 (signed itself or through a relayer) |
| 8 | `active_days_7d` | distinct UTC dates with an initiated action, 1–7 |
| 9 | `days_to_first_tx` | whole 24-hour periods from creation to the first initiated action, 0–6 (`TIMESTAMP_DIFF(…, DAY)` on BigQuery TIMESTAMPs counts elapsed days, not UTC midnights: checked 6 Nov, `TIMESTAMP_DIFF('2026-06-09 00:01', '2026-06-08 23:59', DAY) = 0`) |
| 10 | `unique_receivers_7d` | distinct receivers of those actions |
| 11 | `fn_calls_7d` | `FUNCTION_CALL` actions the account initiated |
| 12 | `distinct_methods_7d` | distinct method names among them |
| 13 | `distinct_contracts_7d` | distinct contracts called |
| 14 | `transfers_out_7d` | `TRANSFER` actions the account initiated |
| 15 | `near_out_7d_mnear` | sum of those transfers, milliNEAR |
| 16 | `near_in_7d_mnear` | NEAR received in `TRANSFER` actions after the creation receipt, milliNEAR |
| 17 | `tx_received_7d` | receipts from other accounts (not refunds, not the creation receipt) whose receiver is the account |
| 18 | `keys_added_7d` | `ADD_KEY` actions on the account after creation (wallet or dapp logins) |
| 19 | `deployed_contract_7d` | 1 if a contract was deployed to the account |
| 20 | `staked_7d` | 1 if a `STAKE` action or a call to a staking pool (`*.poolv1.near`, `*.pool.near`, `meta-pool.near`, `linear-protocol.near`) |
| 21 | `touched_defi_7d` | 1 if a call to `v2.ref-finance.near`, `dclv2.ref-labs.near`, `wrap.near`, `contract.main.burrow.near`, `intents.near` or `aurora` |

Counts and amounts are clipped at 32767 so every row fits the evaluator's compact i16 secret format. `feature_scale = 1`:
features are sent to the contract as they are. The exact SQL is [sql/build_tables.sql](sql/build_tables.sql).

## Files and how they were made

| File | Rows | In the repo? | Purpose |
|---|---|---|---|
| `public_train.csv` | 800 | yes | train on this |
| `public_holdout.csv` | 150 | yes | validate yourself; source of `vectors.json` |
| `public_accounts.csv` | 950 | yes | the account id and creation time behind every public row, so anyone can recheck a feature on-chain |
| `private_a.json` | 150 | **no** (OutLayer secret `TEST_SET_A`) | leaderboard while the task is open |
| `private_b.json` | 150 | **no** (OutLayer secret `TEST_SET_B`) | decides the champion at close |
| `private_manifest.json` | — | yes | sha256, sizes and class counts of the private files (the commitment) |
| `population.json` | — | yes | registrar creations, population size and retention rate, creator codes (no per-creator rates) |

```bash
python tasks/near-retention/fetch.py --project <your gcp project>   # BigQuery: population, labels, sample, features -> sample_raw.csv (gitignored) + population.csv
python tasks/near-retention/build.py                                 # splits, private i16 secrets, manifest, public_accounts.csv
python tasks/near-retention/train.py --trees 10 --depth 2 --out model_weak.pkl   # trains on public_train.csv only; this one leads split A
python tools/export.py --task near-retention --model tasks/near-retention/model_weak.pkl --out tasks/near-retention/out/weak
node tools/submit.mjs 5 tasks/near-retention/out/weak/model.bin --as TEAM
```

The sample is deterministic: accounts are ordered by `FARM_FINGERPRINT(account_id)` in BigQuery, then split with
`train_test_split(stratify=label, random_state=90)`. `fetch.py` needs a Google account (`gcloud auth login`); the
public dataset is paid for by NEAR and the first terabyte of queries per month is free. One clean run scans roughly 300 GB (the dry run's lower bound is 197 GB before the feature stage); our
iterations on 5 Nov, including two aborted runs, used 900 GB of the month's free terabyte, so run `--dry-run` first.

## What is private here, honestly

- The **rows** of split A and B are private: their account ids are never published, their feature vectors exist only
  inside the OutLayer secret bound to the evaluator hash, and the public files hold other accounts.
- The **population is reconstructible**: the window and the SQL are public, so anyone with BigQuery can rebuild all
  4,407 accounts with labels and train on them. That is legitimate (more training data), not a leak: the private rows
  are 300 of 4,407, and a model capped at 250 KB cannot memorise the population. What the sealed split still buys is
  what it buys everywhere on Laurel: no feedback loop against the rows that decide the champion.
- The label is **observable on-chain**, so the dataset ages well: the same SQL on a later window gives a fresh task.
- `creator_class` encodes *who* created the account. It is the strongest single signal and it is also a proxy for
  which wallet a person used; the task is about accounts, not people, but keep that in mind before reusing the idea.
- Prevalence is enriched to about 40 % retained. A consumer who wants a probability must recalibrate to its own base
  rate; the raw score is a ranking signal.
