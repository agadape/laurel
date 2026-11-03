# E2E dari nol (T-3) — 2026-11-03T11:02:06.903Z

Funder `nh-s22-mvz0oawn.testnet` · kontrak baru `bursa-mw0kvxh3.nh-s22-mvz0oawn.testnet` · owner `own-mw0kvxh3.nh-s22-mvz0oawn.testnet` · peserta `p1-mw0kvxh3.nh-s22-mvz0oawn.testnet`, `p2-mw0kvxh3.nh-s22-mvz0oawn.testnet` · agent `agent-mw0kvxh3.nh-s22-mvz0oawn.testnet` · evaluator `8b80010fc792…` · 228 s.

**Ringkasan:** 23 langkah sukses, 17/17 jalur negatif ditolak, skor TEE sama dengan lokal/Python: true, pemenang submission 1, agent benar 3/3.

## Langkah
| # | langkah | Tgas total | hasil | tx |
|---|---|---|---|---|
| 1 | create own | 8.35 |  | `2cH8KZA5Lgbc5vSYB35G17R93ccN2MQxcb4mR6S6psLS` |
| 2 | create bursa | 8.35 |  | `7rUqfCpQg3Xjg32UM13RW5USTRfSGrqtgWA4vaen7kMv` |
| 3 | create p1 | 8.35 |  | `FoM5Aat6arPDLFpEEYnwKqBPr4p1oW4s8kqMPAMehzdP` |
| 4 | create p2 | 8.35 |  | `56LjvqcrGoqv6xTRrzF7s3akaer13KTWhCF56MXmBcJt` |
| 5 | create agent | 8.35 |  | `7hqLDg7ovcC2skK68751Ajty8mj4bY7nkh9PmQa4Cw9` |
| 6 | deploy + new | 22.566 |  | `3xD7aSRCiToDezE5UbtFdycfEi7PZdTbv6CxPaAcyFe3` |
| 7 | get_config | view |  |  |
| 8 | create_task german-credit | 3.401 | 1 | `H3tn1mC6D3HJypVVMbWGT3bnKEhSvDSS98gB8CGh7XbH` |
| 9 | p1 submit deep (50×4) | 13.367 | 1 | `57NbS86x7B8dn3d1SjDbxrLJ2TxULGMY61AXZUjGi9RS` |
| 10 | p2 submit shallow (10×2) | 4.806 | 2 | `8VQarnJghc8p9oPaDm61bEynvUeDYMg9Kb91ML8XKrNp` |
| 11 | request_score deep (OutLayer, evaluator pinned) | 12.752 | A 7100 / B 6650 (= lokal) | `9vPHXG7VjgtYjMfmUvMFgYaZqDZCzvmHc4Rya87AZHjG` |
| 12 | request_score shallow (OutLayer, evaluator pinned) | 12.75 | A 7550 / B 6150 (= lokal) | `Ar7kEdTzzGqDF4bevW9QGC4QMnnkXCJC7LWc7pj4nvz8` |
| 13 | p2 submit shallow again #2 (quota probe, --no-score) | 4.832 | 3 | `5kv1sXTuEFcScRRgCjQWhnCeaYH2gPgoy3BGyqEy6FXs` |
| 14 | p2 submit shallow again #3 (quota probe, --no-score) | 4.832 | 4 | `7gpnLjr86cCekMq2BaDj4VD9t9yxP3rodxRVFFBZDgFH` |
| 15 | leaderboard (open; B hidden) | view |  |  |
| 16 | agent: add function-call key (predict_task, predict → bursa) | 0.421 |  | `38cARExNrqyGjERUXfZZXGKjpAjggT1XQSP356rXeBKT` |
| 17 | agent owner: deposit_credit 0.02 | 2.175 | "19010000000000000000000" | `45fzHNCftizqzbTLS7ipFjw7te7UbDa313s17xFsCCcG` |
| 18 | close_task (anyone) | 2.926 | 1 | `9X3AZEgmpMaasGyA1LThc2gCA642Fx2fV8YG3Xtyi44Z` |
| 19 | leaderboard (closed; B shown) | view |  |  |
| 20 | agent (FC key) predict_task row 0 | 4.651 | label 1 (asli 1) | `7vn1CuPXLgG129cYWxCNpLy7LyjADrhXaTQ1ACVG2aUy` |
| 21 | agent (FC key) predict_task row 1 | 4.67 | label 0 (asli 0) | `H1UYDchdBQCmaEhjLebEvsBg9HNmya8kPJ1FSpmyj3jK` |
| 22 | agent (FC key) predict_task row 2 | 4.67 | label 0 (asli 0) | `jaofnuQbjYJtor42AUNA4ZcLSXjYp9EXUddNsZhJ2Ua` |
| 23 | winner owner: withdraw_earnings | 2.882 | 0.003 NEAR | `6mrFRdU2odgreFgArF1eQzUj2NQK9GinG64U9diuvjxN` |

## Jalur negatif
| percobaan | ditolak | pesan |
|---|---|---|
| set_evaluator by non-owner | ya | `Smart contract panicked: panicked at contracts/bursa/src/lib.rs:697:9:
assertion `left == right` failed: owner only
  le` |
| create_task with the same slug | ya | `Smart contract panicked: panicked at contracts/bursa/src/lib.rs:287:9:
slug taken` |
| create_task with deadline in the past | ya | `Smart contract panicked: panicked at contracts/bursa/src/lib.rs:290:9:
deadline in the past` |
| submit model with 8 features to an 18-feature task | ya | `Smart contract panicked: invalid model: WrongFeatureCount` |
| submit garbage bytes | ya | `Smart contract panicked: invalid model: decode Decode` |
| submit with deposit below storage + fee | ya | `Smart contract panicked: panicked at contracts/bursa/src/lib.rs:206:5:
storage deposit: need 118730000000000000000000 yo` |
| request_score by non-owner of the submission | ya | `Smart contract panicked: panicked at contracts/bursa/src/lib.rs:407:9:
assertion `left == right` failed: owner only
  le` |
| request_score again on a Scored submission | ya | `Smart contract panicked: panicked at contracts/bursa/src/lib.rs:414:9:
not requestable: status Scored` |
| p2 fourth submission (quota 3 per account) | ya | `Smart contract panicked: panicked at contracts/bursa/src/lib.rs:342:9:
quota: 3 submissions per account` |
| close_task before deadline | ya | `Smart contract panicked: panicked at contracts/bursa/src/lib.rs:476:9:
before deadline` |
| agent predict_task before the task is closed | ya | `Smart contract panicked: panicked at contracts/bursa/src/lib.rs:541:9:
task not closed` |
| agent FC key: withdraw_credit | ya | `Access key does not allow method withdraw_credit` |
| agent FC key: deposit attached to predict_task | ya | `Deposit is not allowed with function call` |
| agent FC key: call another contract | ya | `Access key receiver bursa-mw0kvxh3.nh-s22-mvz0oawn.testnet does not match transaction receiver wrap.testnet` |
| predict with wrong feature count | ya | `Smart contract panicked: panicked at contracts/bursa/src/lib.rs:564:9:
feature count: expected 18, got 3` |
| withdraw_earnings again (nothing left) | ya | `Smart contract panicked: panicked at contracts/bursa/src/lib.rs:553:9:
nothing to withdraw` |
| withdraw_earnings by non-owner | ya | `Smart contract panicked: panicked at contracts/bursa/src/lib.rs:551:9:
assertion `left == right` failed: owner only
  le` |
