# Uji negatif terdokumentasi (T-2)

Setiap baris adalah sesuatu yang **harus gagal** dan memang gagal, dengan bukti di testnet atau di unit test. Format pesan panik ada di `docs/ABI.md`. Bukti e2e berasal dari `tools/e2e.mjs` (laporan `docs/E2E.md`, hash per percobaan di `tools/out/e2e.json`).

## 1. Protokol menolak sebelum kode kontrak berjalan (function-call key agent)

| Percobaan | Error protokol | Bukti |
|---|---|---|
| FC key memanggil `withdraw_credit` (method tidak ada di key) | `AccessKeyMethodNameMismatch` | `docs/AGENT.md`, `docs/E2E.md` |
| FC key melampirkan deposit ke `predict_task` | `AccessKeyDepositWithFunctionCall` | `docs/AGENT.md`, `docs/E2E.md` |
| FC key memanggil kontrak lain (`wrap.testnet`) | `AccessKeyReceiverMismatch` | `docs/AGENT.md`, `docs/E2E.md` |
| FC key mentransfer NEAR | `AccessKeyRequiresFullAccess` | `docs/AGENT.md` |
| FC key kehabisan allowance | `AccessKeyNotEnoughAllowance` | run e2e pertama 3 Nov (allowance 0,05 NEAR habis setelah 2 tx; biaya pesimistis ≈ 0,03 NEAR/tx saat gas price tinggi) → e2e kini memakai allowance 1 NEAR |

## 2. Kontrak menolak (panik, state kembali seperti semula, fee tidak dipotong)

| Percobaan | Pesan | Bukti |
|---|---|---|
| `set_evaluator` oleh bukan owner | `owner only` | unit test, e2e |
| `create_task` slug ganda | `slug taken` | unit test, e2e |
| `create_task` deadline lampau | `deadline in the past` | unit test, e2e |
| `create_task` jumlah nama fitur ≠ `n_features` | `n_features mismatch` | unit test |
| `submit_model` model 8 fitur ke tugas 18 fitur | `invalid model: WrongFeatureCount` | unit test, e2e |
| `submit_model` byte sampah | `invalid model: decode` | unit test, e2e |
| `submit_model` indeks anak mundur (siklus) | `invalid model: BadChildIndex` | unit test (`gbdt-core::validate`) |
| `submit_model` deposit < storage + fee | `storage deposit: need …` | unit test, e2e |
| `submit_model` ke-4 dari akun yang sama | `quota: 3 submissions per account` | unit test, e2e |
| `submit_model` setelah deadline / setelah tutup | `deadline passed` / `task closed` | unit test |
| `request_score` oleh bukan pemilik submission | `owner only` | unit test, e2e |
| `request_score` saat `Pending` belum kedaluwarsa | `not requestable: status Pending` | unit test |
| `request_score` pada submission `Scored` | `not requestable: status Scored` | unit test, e2e |
| `request_score` deposit < 0,05 NEAR | `deposit: at least …` | unit test |
| `request_score` setelah tugas ditutup | `task closed` | unit test |
| `on_score` callback ganda / basi | diabaikan, status tidak berubah | unit test |
| `close_task` sebelum deadline | `before deadline` | unit test, e2e |
| `close_task` dua kali | `already closed` | unit test |
| `close_task` tanpa submission `Scored` | `no scored submission` | unit test |
| `predict_task` sebelum tugas ditutup | `task not closed` | unit test, e2e |
| `predict` jumlah fitur salah | `feature count: expected N, got M` | unit test, e2e |
| `predict` tanpa kredit | `insufficient credit` | unit test |
| `predict` pada submission `Failed`/`Uploaded` | `not scored: status …` | unit test |
| `withdraw_earnings` oleh bukan pemilik / saat kosong | `owner only` / `nothing to withdraw` | unit test, e2e |
| `withdraw_credit` melebihi saldo | `insufficient credit` | unit test |
| `deposit_credit` tanpa deposit | `attach a deposit` | unit test |

## 3. Evaluator dan secret

| Percobaan | Hasil | Bukti |
|---|---|---|
| Build evaluator lain (hash `75f06a7d…`) menyebut `secrets_ref` yang sama | `secret TEST_SET_A missing` → submission `Failed` | SPIKE_LOG S30, tx `vcHbSoU19TTNQ66zS3DW2PGcXZLvnNJR3CPQXFXn5Jo`-series (2 Nov) |
| `request_score` tanpa secret | `TEST_SET_A missing` | S30 tx `5v5TvhSk6LVrRPLRpYQtrjgxvWQpuTACsbATn57SXXbw` |
| Peserta memilih evaluator sendiri | tidak mungkin: `request_score` tidak menerima URL/hash; hanya `set_evaluator` oleh owner | `docs/ABI.md`, kode `request_score` |
| Kontrak konsumen memanggil dengan fitur salah | callback menerima promise error → `Outcome::Error`, tidak panik | `docs/CONSUMER.md` tx `HMmwsMTMaN9B1prQDPJ3DDY6yc6xkZ9kwayfQogbFTPd` |

## 4. Yang **tidak** diuji / tidak dijamin (ditulis di README)

- Sybil: akun baru bisa mendapat kuota baru; penghalangnya hanya biaya submit + storage.
- Skor split B terlihat di log tx OutLayer meski view kontrak menyembunyikannya sampai tutup.
- Kehilangan kunci akun segar: run e2e tanpa `--cleanup` meninggalkan akun; e2e kini menyimpan kunci ke `tools/out/e2e-keys.json` dan mendukung `--cleanup-only <tag>`.
- Evaluator di Vercel adalah hosting sementara (FastFS testnet 502 sejak 2 Nov); integritasnya tetap dijamin oleh sha256 yang dipin, bukan oleh host.

Menjalankan ulang semua unit test: `bash build.sh test` (WSL) — 50 kontrak `bursa`, 3 `credit-desk`, 4 `gbdt-core`, 1 evaluator.
