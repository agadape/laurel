# Kontrak konsumen contoh: credit-desk (I-2) — 2026-11-03T10:46:23.187Z

`desk.nh-nft-mvp6py9i.testnet` (wasm 156045 B, deploy `Hv3wTUNkDGmhucgGkZucjcCCK3YSXsfQiZLfUBLe1Yom`) memanggil `bursa-dev.nh-ft-mvp6pidf.testnet.predict_task(2, features)` lewat promise lintas-kontrak dan memutuskan di callback `on_prediction`. Fee dibayar dari kredit prabayar milik **kontrak desk sendiri** (`fund` → `bursa.deposit_credit`, tx `BHXmCRwRk5FzArHmBQDJD87abxi7Ped1Dr8WuLNTvYAM`); kredit desk 0.0191 → 0.0161 NEAR.

| pemohon | skor dari model | keputusan desk (simulasi) | label asli | Tgas total (desk + bursa + callback) | tx |
|---|---|---|---|---|---|
| holdout-0 | 811014 | RequireDeposit | 1 | 8.843 | `BNR63PPUcD6RgjQyN8nQ1i2iP9uJQfGPcLrozsHAcGz6` |
| holdout-1 | -2218985 | Approve | 0 | 8.864 | `GJ5HkYpWGPimxdged48rJnci8fn9kfqU7PT7QAVbziL3` |
| holdout-3 | 2240879 | RequireDeposit | 1 | 8.872 | `4Tops6ayFG44WwdmgFYj8FSvYTWDsqJKgzyC2GpRZNFF` |
| bad-input (3 fitur) | — | {"Error":{"reason":"predict_task failed: Failed"}} | — | — | `HMmwsMTMaN9B1prQDPJ3DDY6yc6xkZ9kwayfQogbFTPd` |

Pemenang tugas kini tercatat 16 panggilan. Keputusan "Approve / RequireDeposit" hanya ilustrasi simulasi (lihat batasan dataset di `tasks/german-credit/README.md`).

Kode: `contracts/consumer-example/src/lib.rs` (≈120 baris, 3 unit test). Pola yang sama berlaku untuk kontrak mana pun: `ext_bursa::ext(bursa).with_static_gas(30 Tgas).predict_task(task_id, features).then(callback)`.
