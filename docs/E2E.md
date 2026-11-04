# E2E dari nol (T-3) — 2026-11-04T09:48:38.532Z

Funder `laurel-team-mw0x0c8g.testnet` · kontrak baru `bursa-mw1xpamc.laurel-team-mw0x0c8g.testnet` · owner `own-mw1xpamc.laurel-team-mw0x0c8g.testnet` · peserta `p1-mw1xpamc.laurel-team-mw0x0c8g.testnet`, `p2-mw1xpamc.laurel-team-mw0x0c8g.testnet` · agent `agent-mw1xpamc.laurel-team-mw0x0c8g.testnet` · evaluator `8b80010fc792…` · 232 s · akun dihapus di akhir (kontrak disapu, state besar tidak bisa dihapus), NEAR kembali ke funder.

**Ringkasan:** 23 langkah sukses, 17/17 jalur negatif ditolak, skor TEE sama dengan lokal/Python: true, pemenang submission 1, agent benar 3/3.

## Langkah
| # | langkah | Tgas total | hasil | tx |
|---|---|---|---|---|
| 1 | create own | 8.35 |  | `AutDUNo6EiLYHZ7m5JyFzsBuVNuWSwxE61dTE4h6YbKL` |
| 2 | create bursa | 8.35 |  | `76nKWXrjQgSe1p1x2wkaBvDdzgAcLg83pr89656Kd6ya` |
| 3 | create p1 | 8.35 |  | `FJuz3gwGn2UwVMJVdzPr5u62oEiAuCQjuFxR9jVpPNRU` |
| 4 | create p2 | 8.35 |  | `odCGzSsPuVAqnaADJu63oKWoGhivTDp1N6XmQnAg8sv` |
| 5 | create agent | 8.35 |  | `4ssXMsbnxavTs8dFMWpDkFPzTTRjsmkA7LaVh8sYjkjm` |
| 6 | deploy + new | 22.728 |  | `DKiS1z7JU8zN4eGeYDLrQwTgGtqKSztMdyP7fZ2BRmXQ` |
| 7 | get_config | view |  |  |
| 8 | create_task german-credit | 3.397 | 1 | `4trHABJMFfVfYiW3DrDKhMLUR45geazX6bVQpNbKhthx` |
| 9 | p1 submit deep (50×4) | 13.375 | 1 | `DgcEjh9EseoQGsfFfTBje5aLoSqeSNUtEjT22yBp69fm` |
| 10 | p2 submit shallow (10×2) | 4.801 | 2 | `2vcjudPtXrxM6RdeiZBX6xquv2i4ohYjouFLmohzvbZe` |
| 11 | request_score deep (OutLayer, evaluator pinned) | 12.789 | A 7100 / B 6650 (= lokal) | `9vW4rmouyf2Z2bpPHaasFFuA3uoptQf4CmW6iXsE5APA` |
| 12 | request_score shallow (OutLayer, evaluator pinned) | 12.791 | A 7550 / B 6150 (= lokal) | `9ceTDzimGwVfrT14FrSUGTVDdnA59dJo46nvpakr3Abw` |
| 13 | p2 submit shallow again #2 (quota probe, --no-score) | 4.827 | 3 | `DCza7uBE9biC7Fn4LWCifEceng94eqF1A43uXjHZLNTW` |
| 14 | p2 submit shallow again #3 (quota probe, --no-score) | 4.827 | 4 | `9R3uNKqxcCai5695T7EiP4h4jAuX5iqdvuHvfTKDUCRX` |
| 15 | leaderboard (open; B hidden) | view |  |  |
| 16 | agent: add function-call key (predict_task, predict → bursa) | 0.421 |  | `FU4XDad3oC9WFME9j1dY8bjwDSJfYsizUBm9HrdWqEf8` |
| 17 | agent owner: deposit_credit 0.02 | 2.176 | "18960000000000000000000" | `7K5Eg4iTne4JwXRTCWoAkhd4nvQGUZqvXwqoy89Mx9gZ` |
| 18 | close_task (anyone) | 2.934 | 1 | `6nY5beYNsFMEotiTkXtZDReLrxRKTBggWw9hiDhUGp3N` |
| 19 | leaderboard (closed; B shown) | view |  |  |
| 20 | agent (FC key) predict_task row 0 | 4.659 | label 1 (asli 1) | `7fW2BLGJBs2w9kRDcGxvrxWkevR2YDfprqrxGhDZE4QB` |
| 21 | agent (FC key) predict_task row 1 | 4.678 | label 0 (asli 0) | `EiYGxDJeMQzQBD7LNxdMucujBj6LsMKNwxQSQsPqR9sv` |
| 22 | agent (FC key) predict_task row 2 | 4.678 | label 0 (asli 0) | `HupMCEYQTzjz9FU7tTgfVVdVm9HhcXN42DjxcHZ7YZo7` |
| 23 | winner owner: withdraw_earnings | 2.887 | 0.003 NEAR | `26bBHciBSNkEMSUj1jfQ9qThjphdskLUcY7BnqgZvGTk` |

## Jalur negatif
| percobaan | ditolak | pesan |
|---|---|---|
| set_evaluator by non-owner | ya | `Smart contract panicked: panicked at contracts/bursa/src/lib.rs:709:9:
assertion `left == right` failed: owner only
  le` |
| create_task with the same slug | ya | `Smart contract panicked: panicked at contracts/bursa/src/lib.rs:289:9:
slug taken` |
| create_task with deadline in the past | ya | `Smart contract panicked: panicked at contracts/bursa/src/lib.rs:292:9:
deadline in the past` |
| submit model with 8 features to an 18-feature task | ya | `Smart contract panicked: invalid model: WrongFeatureCount` |
| submit garbage bytes | ya | `Smart contract panicked: invalid model: decode Decode` |
| submit with deposit below storage + fee | ya | `Smart contract panicked: panicked at contracts/bursa/src/lib.rs:208:5:
storage deposit: need 118790000000000000000000 yo` |
| request_score by non-owner of the submission | ya | `Smart contract panicked: panicked at contracts/bursa/src/lib.rs:410:9:
assertion `left == right` failed: owner only
  le` |
| request_score again on a Scored submission | ya | `Smart contract panicked: panicked at contracts/bursa/src/lib.rs:417:9:
not requestable: status Scored` |
| p2 fourth submission (quota 3 per account) | ya | `Smart contract panicked: panicked at contracts/bursa/src/lib.rs:344:9:
quota: 3 submissions per account` |
| close_task before deadline | ya | `Smart contract panicked: panicked at contracts/bursa/src/lib.rs:488:9:
before deadline` |
| agent predict_task before the task is closed | ya | `Smart contract panicked: panicked at contracts/bursa/src/lib.rs:553:9:
task not closed` |
| agent FC key: withdraw_credit | ya | `Access key does not allow method withdraw_credit` |
| agent FC key: deposit attached to predict_task | ya | `Deposit is not allowed with function call` |
| agent FC key: call another contract | ya | `Access key receiver bursa-mw1xpamc.laurel-team-mw0x0c8g.testnet does not match transaction receiver wrap.testnet` |
| predict with wrong feature count | ya | `Smart contract panicked: panicked at contracts/bursa/src/lib.rs:576:9:
feature count: expected 18, got 3` |
| withdraw_earnings again (nothing left) | ya | `Smart contract panicked: panicked at contracts/bursa/src/lib.rs:565:9:
nothing to withdraw` |
| withdraw_earnings by non-owner | ya | `Smart contract panicked: panicked at contracts/bursa/src/lib.rs:563:9:
assertion `left == right` failed: owner only
  le` |
