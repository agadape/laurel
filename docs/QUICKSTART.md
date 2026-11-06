# Enter the competition in one command

Laurel runs open model competitions on a NEAR testnet contract. You train a small model on public data, the contract
stores it, a TEE evaluator scores it on a sealed test set, and the leaderboard updates. If your model wins, it becomes a
paid prediction service. This page gets you from nothing to a scored entry in about ten minutes.

**Open tasks right now** (see the site for the live list, https://laurel-near.vercel.app):

| Task | What | Deadline (UTC) |
|---|---|---|
| **5** `near-retention` | real NEAR mainnet data: will a fresh `.near` account that acted in its first week still act after day 30? 22 integer features. [tasks/near-retention/README.md](../tasks/near-retention/README.md) | 12 Nov 2026 12:00 |
| 4 `credit-risk-open` | UCI German Credit simulation, 18 features. [tasks/german-credit/README.md](../tasks/german-credit/README.md) | 25 Nov 2026 23:59 |

Three entries per account per task. Testnet only: nothing here costs real money.

## 1. A NEAR testnet account with a few NEAR (2 minutes)

Any of these gives you a free testnet account and some NEAR:

- **Wallet:** [Meteor Wallet](https://wallet.meteorwallet.app) → create a wallet → switch the network to **testnet**; or
  [MyNearWallet testnet](https://testnet.mynearwallet.com). Then export the account's private key from the wallet's settings
  (it starts with `ed25519:`).
- **CLI:** with [near-cli-rs](https://github.com/near/near-cli-rs) installed:
  ```bash
  near account create-account sponsor-by-faucet-service <yourname>.testnet autogenerate-new-keypair print-to-terminal network-config testnet create
  ```
  prints the account's key pair; keep the private key.

The run needs about 0.3 NEAR (storage for a small model, 0.1 NEAR entry fee, a refundable 0.1 NEAR deposit for the TEE
run, gas). A faucet account has far more than that.

## 2. The repository and its dependencies (3 minutes)

Node 18+ and Python 3.10+:

```bash
git clone https://github.com/agadape/laurel && cd laurel
cd tools && npm install && cd ..
pip install scikit-learn pandas numpy
```

Put your account in `.env` at the repository root (the file is git-ignored; never commit it):

```
NEAR_ACCOUNT_ID=<yourname>.testnet
NEAR_PRIVATE_KEY=ed25519:...
```

## 3. One command (2 to 4 minutes, most of it the TEE run)

```bash
node tools/quickstart.mjs --task 5
```

It prints eight steps: environment, your balance, the task (open? entries left?), training a 20-tree × depth-2 model on
`tasks/near-retention/public_train.csv`, export to the contract's integer format, the contract's own validation and a cost
quote, the two transactions (`submit_model`, `request_score`), and the TEE's reading on split A with your rank. Add `--dry`
to stop after the quote without sending anything.

Choose your own model:

```bash
node tools/quickstart.mjs --task 5 --trees 40 --depth 3 --lr 0.05       # other hyper-parameters, same trainer
node tools/quickstart.mjs --task 5 --model my_model.pkl                  # any scikit-learn GradientBoostingClassifier pickle
```

Your pickle must be a `GradientBoostingClassifier` trained on the task's features in the order given by
`tasks/<slug>/features.json` (22 integer features for task 5). Feature engineering is not possible: the contract computes
the prediction from exactly those features. What you control is the model.

## 4. See it

- https://laurel-near.vercel.app/#/task/5 — the exhibit: split A readings while the task is open, split B unsealed at the
  deadline, the champion named by the contract.
- https://laurel-near.vercel.app/#/model/<your id> — your specimen: every tree drawn from the bytes the contract stores.
- The transaction links the command prints, on testnet.nearblocks.io.

## What decides the winner

Split A is 150 sealed rows you see the score of while the task is open. Split B is another 150 sealed rows whose score the
leaderboard, the site and the MCP tools withhold until `close_task` runs after the deadline; **it alone picks the champion**.
(In this first version the raw split-B figure can be dug out of the contract's `get_submission` view or the scoring
transaction's receipt; the rows cannot. Tuning against it is pointless anyway: you cannot see which rows you got wrong.) So a model tuned against split A's
leaderboard gains nothing on B. One row of a split is worth about 0.7 to 1.3 points of balanced accuracy, so differences
of a point between entries are mostly noise; think about what generalises.

Current split-A readings on task 5 (5 Nov): 8350 bps for a 1.6 KB 10-tree model and for a 3 KB 20-tree model, 8300 for the
5 KB 15-tree model this very command produced (#11), 8250 for a 32 KB 50-tree one, 8200 for a 10 KB 30-tree one. Big is not
better here.

## Costs, limits, honesty

- Testnet NEAR only. The run deposits storage (about 1 NEAR per 100 KB of model; a few hundredths for a small one),
  the task's 0.1 NEAR fee (it goes to the task creator) and 0.1 NEAR for the TEE run, of which the unused part is refunded.
- 3 entries per account per task. The quickstart refuses when none are left.
- The evaluator is pinned by hash in the contract; your model is scored by that code inside OutLayer's TEE and by nothing
  else. The evaluator is open source (`evaluator/`), and `tools/eval_local.sh` runs the same wasm on your machine if you
  have the private splits, which you do not; that is the point.
- If you win task 5, your model answers `predict_task(5, features)` for anyone, and each call pays 0.001 NEAR to you,
  withdrawable with `withdraw_earnings`.

Questions: open an issue on https://github.com/agadape/laurel.

---

## Invitation text (copy, adapt, post)

> I'm running a small model competition on NEAR testnet and I'd like a few real entries before 12 Nov.
> Task: predict whether a brand-new NEAR account that acted in its first week is still active a month later, from 22
> integer features built from real mainnet data. Train any gradient-boosted-tree model on the public rows; a TEE scores it
> on sealed rows; the contract names the champion. One command, free testnet NEAR, about 10 minutes:
> https://github.com/agadape/laurel/blob/main/docs/QUICKSTART.md

> Saya menjalankan kompetisi model kecil di NEAR testnet dan butuh beberapa peserta sungguhan sebelum 12 Nov.
> Tugasnya: memprediksi apakah akun NEAR baru yang aktif di minggu pertamanya masih aktif sebulan kemudian, dari 22 fitur
> integer yang dibangun dari data mainnet asli. Latih model gradient-boosted tree apa pun di data publik; TEE menilainya di
> baris tersegel; kontrak menetapkan juara. Satu perintah, NEAR testnet gratis, sekitar 10 menit:
> https://github.com/agadape/laurel/blob/main/docs/QUICKSTART.md
