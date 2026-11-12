> Nama final project: **Laurel** (lihat docs/NAMING.md); dokumen di bawah masih memakai nama kerja "Bursa Model".

# Uji Arsitektur — Bursa Model (sebelum commit), 2 Nov 2026

Tujuan: menjawab empat pertanyaan arsitektur dengan memisahkan **fakta terdokumentasi**, **sudah dibuktikan spike kita**, dan **asumsi**. Lalu merampingkan MVP dan memberi go/no-go. Tidak ada kode yang ditulis.

Legenda: **[DOC]** dokumentasi resmi (dibaca 2 Nov) · **[SPIKE]** dibuktikan di [SPIKE_LOG.md](../../SPIKE_LOG.md) · **[ASUMSI]** belum dibuktikan · **[PARAM]** parameter protokol NEAR (`nearcore/core/parameters/res/runtime_configs/parameters.yaml`).

Angka protokol yang dipakai di bawah [PARAM]: `max_transaction_size` 1.572.864 B · `max_arguments_length` 4 MiB · `max_contract_size` 4 MiB · storage 10¹⁹ yN/byte (= **1 NEAR per 100 KB**) · `storage_write_value_byte` 31 Mgas/B · `storage_read_value_byte` 5,6 Mgas/B · `max_gas_burnt` 1.000 Tgas · `max_total_log_length` 16 KB (dari pengetahuan nearcore, belum dikutip ulang hari ini).

---

## Q1. Satu pipeline ekspor model untuk evaluator OutLayer dan kontrak NEAR?

**Jawaban singkat: ya, asalkan model diperlakukan sebagai DATA, bukan kode.** Dua target wasm memang berbeda, tapi keduanya memuat crate Rust yang sama.

### Alur eksekusi
1. Peserta melatih model di Python (sklearn/xgboost), menjalankan `export.py` → file biner **borsh** `model.bin`: daftar pohon, tiap node = `(feature_idx: u16, threshold: i64, left: u16, right: u16, leaf_value: i64)`. Fitur dan ambang **dikuantisasi ke integer** (misal ×10⁶), tanpa float.
2. Crate bersama `gbdt-core` (`no_std`, hanya `borsh` + aritmetika integer) punya satu fungsi: `predict(model: &[u8], features: &[i64]) -> i64`.
3. **Kontrak NEAR** (`wasm32-unknown-unknown`, near-sdk 5.30) memakai `gbdt-core` dan menyimpan `model.bin` di state.
4. **Evaluator OutLayer** (`wasm32-wasip2`, `[[bin]]` dengan `fn main`, baca stdin, tulis stdout ≤ 900 B) memakai `gbdt-core` yang sama + test set dari secret.

### Fakta vs asumsi
| Hal | Status |
|---|---|
| OutLayer menjalankan `wasm32-wasip2`, input JSON lewat **stdin**, output JSON lewat **stdout maksimal 900 byte** dalam mode blockchain, wajib `flush()` | **[DOC]** app.outlayer.ai/docs/wasi, `wasi-examples/WASI_TUTORIAL.md` |
| Hanya wasm yang sudah dipublikasikan dan cocok sha256 yang dijalankan; `outlayer upload <wasm>` → URL FastFS + hash; `outlayer deploy <name> <url>` membuat Project; sumber `{"Project":{"project_id":"owner/name","version_key":null}}` atau `{"WasmUrl":{url,hash}}` | **[DOC]** docs/getting-started, PROXY_CONTRACTS_TUTORIAL.md |
| Fuel metering; batas default 100 miliar instruksi / 60 s (maks 500 miliar / 180 s); memori ≥ 1 GB | **[DOC]** docs/wasi, docs/pricing |
| Wasm P2 bisa HTTP keluar lewat crate `wasi-http-client`, dan ada host function NEAR `near:rpc/api` (`view`, `call`, `transfer`) | **[DOC]** WASI_TUTORIAL.md, `wasi-examples/rpc-test-ark` |
| `input_data` gratis sampai **32 KB** (`INPUT_DATA_FREE_BYTES = 32*1024`), di atas itu disimpan di state dengan biaya dan menambah gas callback (`CALLBACK_GAS_PER_INPUT_BYTE = 25 Mgas/B`) | **[DOC]** `contract/src/lib.rs` OutLayer |
| Satu crate Rust dikompilasi ke dua target | Praktik Rust standar; **belum dicoba tim** → bagian dari S31 |
| Integer-only GBDT memberi hasil identik di kedua target | Benar secara konstruksi (tidak ada float); dicek dengan test vector di S31 |

### Konsekuensi desain
- **Model tidak dikirim sebagai `input_data`** (50–200 KB > 32 KB, dan `input_data` ikut masuk ke event log OutLayer seperti terlihat di S9 → berisiko menabrak batas log 16 KB). Evaluator mengambil `model.bin` lewat host function `view` ke kontrak Bursa (`get_model_bytes(submission_id)`), atau HTTP ke RPC publik. Keduanya **[DOC]** tersedia, **[ASUMSI]** sampai S30 membuktikannya dari dalam TEE.
- Output 900 B cukup untuk `{"submission_id":..,"n":1000,"correct":913,"score_bps":9130,"hash":"…"}`.

### Eksperimen terkecil
**S31 (½ hari):** satu workspace dengan `gbdt-core` + kontrak `predict` + binary wasip2 yang membaca `{"model_hex":..,"rows":[..]}` dari stdin; jalankan binary P2 secara lokal dengan `wasmtime`, bandingkan hasil dengan unit test kontrak pada 50 baris. Lolos jika hasil identik dan `predict` 100 pohon × kedalaman 6 di testnet ≤ 10 Tgas.

### Kompleksitas untuk tim pemula
**Sedang.** Rust `no_std` + borsh sudah dikuasai dari S13/S20/S22. Yang baru: target wasip2 dan `wit_bindgen` untuk host function `view` (contoh lengkap ada di `rpc-test-ark`). Estimasi 1–1,5 hari termasuk exporter Python.

---

## Q2. Bisakah kontrak Bursa membuat sub-account model dan men-deploy bytecode model yang dikirim?

**Jawaban singkat: secara teknis ya, tapi JANGAN deploy wasm kiriman pengguna.** Deploy template kita + data model.

### Yang terdokumentasi
`near_sdk::Promise` 5.30 **[DOC]** (docs.rs): `create_account()`, `transfer(NearToken)`, `deploy_contract(code)`, `function_call(name, args, deposit, gas)`, `add_full_access_key`, `delete_account`, dan **`deploy_global_contract(code)` / `use_global_contract(code_hash)` / `use_global_contract_by_account_id(account)`**. Global contracts (NEP-591) live di testnet dan mainnet ([docs/research/07](../research/07_new_primitives.md) #6).

Alur yang terbukti sebagian: S13 men-deploy kontrak dari **skrip** ke akun faucet (deploy + `new` dalam satu tx). Dari **dalam kontrak** lewat Promise batch belum pernah kami lakukan → **[ASUMSI]** sampai S33.

### Kenapa bukan bytecode kiriman pengguna
1. **Keamanan ekonomi:** kontrak arbitrer di `m7.bursa.testnet` bisa memalsukan skor, mengabaikan fee, atau memanggil apa pun atas nama akun itu. Tidak ada cara memverifikasi on-chain bahwa wasm kiriman "hanya GBDT".
2. **Kebocoran test set (Q4):** kalau evaluator OutLayer menjalankan wasm kiriman, wasm itu bisa membuat HTTP request dan mengirim test set keluar. Model sebagai data menutup jalur ini sepenuhnya.
3. **Biaya:** wasm 150–250 KB kiriman = 1,5–2,5 NEAR storage per model ditanggung kontrak Bursa, plus deploy 4 MiB maks.
4. **Ukuran tx:** `max_transaction_size` 1,5 MB, jadi unggah 200 KB masih muat, tapi tidak perlu.

### Alur yang disarankan
- `bursa.testnet` menyimpan `model.bin` (data, ~20–60 KB untuk 100 pohon kedalaman 6: 6.300 node × 16 B ≈ 100 KB sebelum kompresi; pakai `u16` indeks dan `i32` ambang → ≈ 50 KB) di `LookupMap<SubmissionId, Vec<u8>>`. Biaya tulis: 50.000 × 31 Mgas ≈ 1,6 Tgas (murah); storage 0,5 NEAR, dibebankan ke pengirim lewat `attached_deposit`.
- `spawn(submission_id)`: `Promise::new("m<id>.bursa.testnet").create_account().transfer(0.1 NEAR).use_global_contract(TEMPLATE_HASH).function_call("new", {model: bytes, bursa: "bursa.testnet", token_id}, 0, 30 Tgas)`. Template di-deploy **sekali** sebagai global contract (biaya 10× storage sekali, lalu tiap akun model tidak membayar storage kode).
- Fallback kalau `use_global_contract` bermasalah: `deploy_contract(TEMPLATE_BYTES)` dari bytes yang disimpan di state Bursa (template ~120 KB → 1,2 NEAR per akun model; masih OK untuk demo dengan 3–5 model).

### Eksperimen terkecil
**S33 (½ hari):** kontrak uji dengan satu method `spawn(name, blob)` yang menjalankan batch di atas memakai template `echo` 20 KB; cek akun lahir, kode terpasang, `new` tersimpan, dan gas total. Lolos jika ≤ 60 Tgas dan storage akun model < 0,2 NEAR dengan global contract.

### Kompleksitas
**Sedang** untuk `deploy_contract` (pola terdokumentasi, kami sudah paham deploy), **sedang-tinggi** untuk global contract (baru di SDK, sedikit contoh). Rekomendasi: S33 mencoba global contract dulu selama 2 jam, kalau gagal pakai `deploy_contract` dan lanjut.

**Catatan jujur:** fitur "model jadi akun sendiri" adalah **pemanis pitch**, bukan inti. Tanpa sub-account pun klaim "model berjalan sebagai kontrak dan dipanggil kontrak/agent lain" tetap benar lewat `bursa.predict(token_id, features)`. Lihat §Revisi MVP.

---

## Q3. Kepemilikan NFT model dan fee per inferensi tanpa pembacaan lintas-kontrak sinkron

**Jawaban singkat: taruh NFT, registry model, dan buku fee di SATU kontrak, lalu pakai pola tarik (pull payment).** NEAR memang tidak punya cross-contract read sinkron; semua `ext_contract` adalah promise asinkron (**[DOC]**, dan kami alami di S20/S22).

### Desain
- `bursa.testnet` mengimplementasikan NEP-171 (near-sdk-contract-tools, **[SPIKE] S13**): satu token per model yang lolos (`token_id = submission_id`). Pemilik awal = pengirim.
- `predict(token_id, features)` adalah **call payable** di `bursa`: `assert!(attached_deposit >= fee)`; hitung prediksi; `earnings[token_id] += fee` (akumulasi per **token**, bukan per akun). Tidak ada promise, tidak ada transfer di jalur panas. Biaya per panggilan: baca 50 KB ≈ 0,3 Tgas + eksekusi; target ≤ 5 Tgas.
- `withdraw(token_id)`: hanya `nft_token(token_id).owner_id == predecessor`; transfer `earnings[token_id]`, nol-kan. Satu promise transfer, pola standar.
- Saat `nft_transfer`: override hook transfer dari contract-tools untuk **menyelesaikan dulu** `earnings` ke pemilik lama (kredit ke `pending_withdraw[old_owner]`), sehingga pembeli NFT hanya menerima fee setelah transfer. Semuanya state lokal → sinkron.
- **Jika ada sub-account model** (opsional): `m<id>.predict` menghitung, lalu `Promise::new(bursa).function_call("record_fee", {token_id}, fee, 5 Tgas)`. Bursa memverifikasi `predecessor == format!("m{id}.bursa.testnet")` (nama deterministik, tidak perlu registry). Tetap tidak ada pembacaan sinkron; owner tidak pernah disalin ke akun model.

### Fakta vs asumsi
- Override hook transfer di contract-tools: **[ASUMSI ringan]**; alternatif tanpa hook: `withdraw` membayar siapa pun pemilik saat itu (fee yang belum ditarik ikut berpindah bersama NFT, dan ini ditulis sebagai aturan, bukan bug). Untuk MVP pakai alternatif ini.
- Agent pemanggil memakai **function-call key** yang hanya boleh `predict` (**[SPIKE] S7**). Perhatian dari recon 07: FC key tidak bisa melampirkan deposit (`AccessKeyDepositWithFunctionCall`, terbukti S7). Jadi fee tidak bisa dibayar dengan `attached_deposit` oleh agent ber-FC-key. Solusi: **saldo prabayar** `deposit_credit()` (full key, sekali) lalu `predict` memotong `credit[caller]`. Ini juga membuat `predict` bisa dipanggil tanpa deposit sama sekali. Dokumentasikan sebagai desain.

### Eksperimen terkecil
Tidak perlu spike terpisah: unit test near-sdk untuk `predict → earnings → withdraw` dan satu panggilan FC-key di testnet saat integrasi (pola S7 sudah ada).

### Kompleksitas
**Rendah–sedang.** Semua pola sudah dipakai di S13/S20.

---

## Q4. Apakah benchmark privat tahan terhadap kebocoran lewat submit berulang dan akun Sybil dalam 12 hari?

**Jawaban jujur: tahan terhadap kebocoran, tidak tahan penuh terhadap Sybil. Yang kedua harus diakui di README, bukan diklaim.**

### Ancaman dan tindakan
| Ancaman | Mekanisme | Tindakan MVP | Status |
|---|---|---|---|
| Eksfiltrasi test set oleh kode kiriman | Kode berjalan di TEE dengan HTTP | **Tidak ada kode kiriman**: model = data (Q2). Evaluator adalah wasm kami yang hash-nya dipin; secret dikunci ke build itu lewat aturan **"One build only"** (**[DOC]** docs/secrets) | Terkunci secara desain |
| Operator Bursa membaca test set | Secret milik akun pemasang tugas | Secret dibuat pemasang tugas, bound ke `wasm_hash + profile + owner` (**[DOC]**). Operator Bursa tidak melihatnya. Catat: pemasang tugas sendiri jelas tahu test set-nya; "privat" = privat dari peserta dan operator | OK |
| Rekonstruksi label lewat skor berulang | Tiap submit membocorkan ≤ log₂(n+1) bit | Skor dibulatkan ke 0,5% (`score_bps` kelipatan 50); **maks 3 submit per akun per tugas**; **split publik/privat**: leaderboard sementara memakai split A, peringkat final memakai split B yang skornya baru dicatat saat `close_task` (pola Kaggle). Dengan n=1.000 dan 3 submit, bocoran ≈ 30 bit dari ~1.000 bit label → tidak berguna | Cukup |
| Sybil: banyak akun untuk banyak submit | Akun testnet gratis; mainnet 0,007 NEAR | **Biaya submit** 0,5 NEAR (= storage model, ditahan, dikembalikan saat model dihapus setelah tugas tutup → biaya nyata adalah modal yang terkunci + gas). Tidak menghentikan penyerang serius. Opsi staking/slashing dan nada.bot `is_human` masuk roadmap | **Diakui terbatas** |
| Overfitting ke split privat lewat tim Sybil berbagi informasi | Sama dengan di atas | Rotasi split privat per tugas; split B hanya dinilai sekali saat tutup → informasi untuk overfit tidak pernah tersedia selama tugas berjalan | Cukup untuk demo |

### Fakta vs asumsi
- `secrets_ref` format `{"profile":"...","account_id":"..."}` dan binding ke wasm hash: **[DOC]** + **[SPIKE] S9** (kami memakai secret milik `zavodil2.testnet`).
- Skor split B bisa ditahan sampai `close_task`: implementasi di kontrak kita sendiri (evaluator mengembalikan dua skor, kontrak hanya **menyimpan** B tanpa mengeksposnya di view sampai tutup). Skor B tetap ada di hasil tx OutLayer yang publik → kebocoran kecil per submit tetap terjadi, sudah dihitung di atas.

### Eksperimen terkecil
Bagian dari **S30**: buat secret di dashboard OutLayer untuk akun kedua kami, kunci ke hash evaluator, panggil dari akun ketiga dengan `secrets_ref` → harus berhasil; ganti satu byte evaluator (hash lain) → harus gagal mengakses secret.

### Kompleksitas
**Rendah** (cap, fee, dua skor). Yang **tidak** masuk 12 hari: staking + slashing, proof-of-personhood, re-scoring berkala.

---

## Gerbang spike (selesai Rabu 4 Nov, 22:00 WIB)

| # | Spike | Bukti lolos | Waktu | Kalau gagal |
|---|---|---|---|---|
| **S30** | Publish evaluator sendiri: `cargo build --target wasm32-wasip2` → `outlayer upload` → `outlayer deploy` → secret test set (JSON ≤ 100 baris) dikunci ke build → `request_execution` **dari kontrak proxy** mengikuti PROXY_CONTRACTS_TUTORIAL (callback `#[private]` dengan `#[callback_result] Result<Option<String>, PromiseError>`) → evaluator mengambil `model.bin` lewat host `view` → skor masuk callback | Skor benar di callback ≤ 15 s; biaya ≤ 0,02 NEAR; akses secret ditolak untuk hash lain | 4–6 jam | **Tanpa benchmark privat**: skor dihitung on-chain di split publik. Produk tetap "model jadi kontrak + royalti", tapi kehilangan kail Illia #13 → lihat go/no-go |
| **S31** | `gbdt-core` dua target + kontrak `predict` 100 pohon kedalaman 6 + exporter Python; test vector identik; ukur Tgas | ≤ 10 Tgas/predict; `model.bin` ≤ 100 KB | 4 jam | Turunkan ke 30 pohon / regresi logistik; tetap go |
| **S33** (opsional) | `spawn` sub-account dari kontrak dengan `use_global_contract`, fallback `deploy_contract` | Akun model lahir, ≤ 60 Tgas | 3 jam | Buang fitur sub-account; `predict` di Bursa saja. **Tidak memblokir go** |

Kedua spike wajib (S30, S31) bisa berjalan paralel oleh dua orang.

---

## Revisi arsitektur MVP (lebih ramping)

```
[Python export.py] ──model.bin──► bursa.testnet (satu kontrak)
                                   ├─ tasks, submissions (model bytes), split-A/B scores
                                   ├─ NEP-171 token per model, earnings[token_id], credit[caller]
                                   ├─ predict(token_id, features)  ← agent (FC key) / kontrak lain
                                   └─ submit → ext_outlayer.request_execution(Project evaluator)
                                                   │ evaluator (wasip2): view(bursa.get_model_bytes)
                                                   │ + secret test set → stdout {scoreA, scoreB}
                                                   ▼
                                        on_score (#[private] callback) → leaderboard
```

**Dihapus dari MVP** dibanding IDEAS.md §5:
- Sub-account per model dan global contract (S33 jadi *stretch*, dikerjakan hanya jika S30+S31 selesai sebelum 5 Nov siang).
- Kontrak `model-template` terpisah (tidak perlu kalau `predict` ada di Bursa).
- Marketplace NFT, gas key, tier LLM, dataset privat per pemasang, re-scoring.

**Tetap ada:** satu kontrak Rust, satu binary wasip2, satu exporter Python, skrip agent FC-key, frontend 3 halaman (tugas, leaderboard, log panggilan), dua tugas demo dengan data publik dan skrip latih yang bisa direproduksi juri.

**Jadwal realistis (tim pemula, 2–3 orang):** 3–4 Nov gerbang · 5–8 Nov kontrak + evaluator + exporter · 9–10 Nov frontend + agent + dua tugas · 11–12 Nov README "do X → see Y", `CLAIMS.md`, video · 13 Nov buffer · 14 Nov 12:00 UTC submit.

---

## Bisa-di-NEAR vs bisa-oleh-tim-kita

| Fitur | Mungkin di NEAR | Realistis sebelum 14 Nov | Alasan |
|---|---|---|---|
| Model GBDT integer sebagai method kontrak | Ya | **Ya** | Rust + borsh sudah dikuasai; gas murah |
| Evaluator di OutLayer dengan secret + callback ke kontrak | Ya [DOC] | **Mungkin** — tergantung S30 | Alur publish/secret belum pernah kami jalankan; dokumentasi ada tapi detail `secrets_ref` + "one build only" baru dibaca |
| Evaluator membaca model lewat host `view` | Ya [DOC] | Mungkin — bagian S30 | `wit_bindgen` baru bagi tim |
| NFT + earnings + pull payment dalam satu kontrak | Ya | **Ya** | S13 pola sama |
| Agent membayar lewat saldo prabayar dengan FC key | Ya | **Ya** | S7 |
| Sub-account per model via Promise batch | Ya [DOC] | Mungkin, opsional | Belum pernah dari dalam kontrak |
| Global contract untuk template | Ya | **Tidak diprioritaskan** | Sedikit contoh; tidak mengubah demo |
| Anti-Sybil yang sungguhan | Ya | **Tidak** | Butuh staking/identitas; ditulis sebagai batasan |
| Tier LLM teratestasi (S21/S22) | Ya, sudah di-spike | **Tidak** | Memakan waktu dan menyerupai tooling Undo |

---

## Go / No-Go

**Keputusan: GO BERSYARAT.** Lanjutkan ke gerbang S30 + S31 pada 3–4 Nov. Tidak ada kode produk sebelum gerbang.

- **GO penuh** jika S30 dan S31 lolos per kriteria di atas. Arsitektur ramping (satu kontrak + satu evaluator) muat untuk tim pemula dalam 9 hari build tersisa, dan setiap klaim README bisa ditunjuk ke file + tx.
- **GO dengan pitch lebih kecil** jika S31 lolos tapi S30 gagal karena *hal yang bisa kami kendalikan* (misal `wit_bindgen`): coba sekali lagi setengah hari pada 5 Nov pagi dengan jalur HTTP RPC alih-alih host `view`. Kalau masih gagal, jatuh ke baris berikut.
- **NO-GO untuk Bursa Model → pindah ke Anti Jam Karet** jika S30 gagal karena *hal di luar kendali* (secret tidak bisa dikunci ke build, publish tidak tersedia untuk akun kami, egress diblokir, callback tidak stabil). Alasannya: tanpa benchmark privat, yang tersisa adalah "registry model kecil dengan royalti" — benar dan tetap unik di NEAR, tapi kehilangan dua dari empat kutipan juri (Illia #13, Eddy evaluator terdesentralisasi) dan demonya mengecil menjadi dashboard. Untuk tim pemula dengan 9 hari, Anti Jam Karet (semua komponen ✅, 0 pesaing, pengguna nyata) memberi peluang hadiah track yang lebih pasti.

Risiko yang tersisa bahkan setelah GO penuh, supaya tidak ada yang kaget:
1. OutLayer menyatakan batasnya "dapat berubah tanpa pembaruan dokumentasi" (docs/pricing). Simpan hash evaluator dan semua tx di `SPIKE_LOG.md`, dan jalankan ulang evaluator pada 13 Nov.
2. Upgrade mainnet 86→88 (~7 Nov) tidak menyentuh kita (testnet), tapi `outlayer.testnet` bisa ikut berubah versi; cek `estimate_execution_cost` setiap pagi.
3. Dua tugas demo butuh data yang masuk akal; siapkan dataset akun bot/manusia dari fitur tx testnet pada 5–6 Nov, paralel dengan kontrak, supaya tidak jadi pekerjaan hari terakhir.
