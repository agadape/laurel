# Kontrak konsumen contoh: credit-desk (I-2) — 2026-11-04T09:37:20.997Z

`desk3.laurel-team-mw0x0c8g.testnet` (wasm — B) memanggil `laurel.laurel-team-mw0x0c8g.testnet.predict_task(3, features)` lewat promise lintas-kontrak dan memutuskan di callback `on_prediction`. Fee dibayar dari kredit prabayar milik **kontrak desk sendiri** (`fund` → `bursa.deposit_credit`); kredit desk 0.019 → 0.016 NEAR.

| pemohon | skor dari model | keputusan desk (simulasi) | label asli | Tgas total (desk + bursa + callback) | tx |
|---|---|---|---|---|---|
| holdout-0 | 811014 | RequireDeposit | 1 | 8.877 | `E4WHQDRvWaJnzrUmhkey9J9424WETpsdwzdPjr58gnh6` |
| holdout-1 | -2218985 | Approve | 0 | 8.898 | `DaJeURvJPxN9Bj81jv1gPyashUkigXVahPxgjSWytAjQ` |
| holdout-3 | 2240879 | RequireDeposit | 1 | 8.905 | `6RR8xrKu4fYthaNhR1UZhuxFptzuXyXvSi9te3uVtg8E` |
| bad-input (3 fitur) | — | {"Error":{"reason":"predict_task failed: Failed"}} | — | — | `DtaaDVx9KhD1evMUTUCZ35T6gU5RBYs9ZTujtp3QRxYo` |

Pemenang tugas kini tercatat 8 panggilan. Keputusan "Approve / RequireDeposit" hanya ilustrasi simulasi (lihat batasan dataset di `tasks/german-credit/README.md`).

Kode: `contracts/consumer-example/src/lib.rs` (≈120 baris, 3 unit test). Pola yang sama berlaku untuk kontrak mana pun: `ext_bursa::ext(bursa).with_static_gas(30 Tgas).predict_task(task_id, features).then(callback)`.
