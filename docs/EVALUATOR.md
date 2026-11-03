# Evaluator yang dipin dan secret tugas (E-1, E-2, ML-2b)

| Hal | Nilai | Bukti |
|---|---|---|
| Evaluator v1 (`eval_version` "1") | sha256 `8b80010fc79259c9f5d95183a660e79ad7a450fdfceed3e8ce0924f296b60ac3`, 206.308 B, `wasm32-wasip2` | `bash build.sh evaluator` (3 Nov 2026) |
| URL | `https://nh-spike-wasm.vercel.app/8b80010fc79259c9f5d95183a660e79ad7a450fdfceed3e8ce0924f296b60ac3.wasm` | `curl` → 200, sha256 cocok. FastFS testnet masih 502 (2–3 Nov) |
| Dipin di `bursa-dev.nh-ft-mvp6pidf.testnet` | `set_evaluator` oleh owner `nh-ft-mvp6pidf.testnet` | tx `GRSvCNKdXurhSfiARZTdK5mw2xqxUQdbhMGNd7Dm8kxB` |
| Secret tugas `german-credit` | `TEST_SET_A` + `TEST_SET_B` (2 × 150 baris, format kompak, 15.282 B) disimpan oleh `nh-spike-mvp62mw4.testnet`, profil `german-credit`, **bound ke hash v1**, `--access allow-all` | `outlayer secrets set …` 3 Nov; `tasks/german-credit/private_manifest.json` memuat sha256 file privat |
| Deposit secret | CLI resmi melampirkan 0,1 NEAR tetap (≈ 7 KB). Dipakai salinan lokal `outlayer-cli` 0.2.1 dengan konstanta deposit 0,5 NEAR (`tools/patch_outlayer_cli.sh`, satu baris diubah) | disetujui tim 3 Nov |
| Evaluator spike (lama) | hash `dcc4aa66…`, hanya untuk Checkpoint M1 (tugas `gas-probe`), tidak lagi dipin | `docs/GAS.md` |

## Alur per tugas baru
1. `python tasks/<slug>/split.py` → file privat + manifest.
2. (WSL, login sebagai pembuat tugas) `bash tools/secrets.sh <slug> <profile> <hash evaluator>`.
3. `node tools/create_task.mjs <slug> --secrets-account <pembuat> --profile <profile>`.
4. Peserta: `python tools/export.py --task <slug> --model model.pkl --out …` lalu `node tools/submit.mjs <task_id> …/model.bin`.

## Ikatan hash (kenapa evaluator lain tidak bisa membaca secret)
Baris secret di OutLayer dikunci `(wasm_hash, profile, owner)`. Di S30 dibuktikan: build lain yang menyebut `secrets_ref` yang sama mendapat `TEST_SET_A missing` (tx run hash `75f06a7d…`). Kontrak hanya mengirim `request_execution` dengan hash yang dipin owner, jadi peserta tidak bisa memilih evaluator sendiri.

## Hasil end-to-end 3 Nov (tugas 2 di `bursa-dev`)
| Model | Lokal `wasmtime` | OutLayer → `on_score` | Python |
|---|---|---|---|
| deep 50×4 (33.011 B, submission 3) | A 7100 / F1 6000 · B 6650 / 5400 | **sama** (`score_a_bps` 7100, raw lengkap tersimpan; 11,4 s) | 7142→7100, 6698→6650 |
| shallow 10×2 (1.611 B, submission 4) | A 7550 / 6450 · B 6150 / 5000 | **sama** (8,5 s) | 7571→7550, 6190→6150 |

Catatan demo: leaderboard publik (split A) dipimpin model dangkal, tetapi peringkat final (split B) memenangkan model dalam — contoh nyata mengapa ada split privat kedua.

## Ganti evaluator
Ubah kode → `bash build.sh evaluator` → host file `<sha256>.wasm` → `node tools/set_evaluator.mjs <url> <sha256>` → simpan ulang secret tiap tugas dengan `--wasm-hash <sha256 baru>` (atau `outlayer secrets access … --build <sha256>` untuk memindahkan kunci). Submission lama tetap tersimpan; skor baru hanya untuk request berikutnya.
