# PLAN — Laurel (Project 2, NEAR HACKATHON), ditulis 2 Nov 2026 malam

> **Nama final: Laurel** (3 Nov, [docs/NAMING.md](../NAMING.md)); nama kerja "Bursa Model" dan codename kontrak `bursa` masih muncul di dokumen di bawah.

> **Status 2 Nov 23:30 WIB:** M0 selesai (S-1, S-2, S-4; S-3 menunggu manusia). M1 selesai lebih awal: C-1…C-5 terimplementasi (44 unit test), C-6 deploy ke `bursa-dev.nh-ft-mvp6pidf.testnet` dan **Checkpoint M1 lolos** dengan evaluator spike: tugas → 2 submit → 2 skor OutLayer → leaderboard → `close_task` → `predict_task` ×3 oleh agent dengan prabayar. Angka gas di [docs/GAS.md](../GAS.md): `predict` model 33 KB = **4,26 Tgas** (kriteria ≤ 8 ✓), model 197 KB = 13,2 Tgas.
> **Status 3 Nov 14:05 WIB — M2 hampir selesai:** E-1 evaluator v1 (balanced accuracy + F1, format secret kompak) dibangun, di-host, dan dipin (`docs/EVALUATOR.md`); ML-2 `split.py` + `train.py` + manifest; ML-1 `export.py` per tugas (kecocokan int vs float 100%); ML-2b secret 15 KB tersimpan (CLI dipatch lokal, disetujui); ML-3 `create_task.mjs`, `submit.mjs`, `close_task.mjs`, `predict.mjs`, `set_evaluator.mjs`. **Checkpoint M2 tercapai**: tugas `german-credit` (id 2) di `bursa-dev`, dua model nyata diskor OutLayer identik dengan lokal/Python (deep A 7100/B 6650, shallow A 7550/B 6150). Tugas 2 ditutup (pemenang deep via split B), `predict_task` 4,3 Tgas.
> **Status 3 Nov 15:30 WIB — M3 sebagian besar selesai:** I-1 agent dengan function-call key (`docs/AGENT.md`: 10 pemohon, 4 penolakan protokol tercatat), F-1 web baca-saja live di **https://bursa-model.vercel.app** (Vercel project `bursa-model`, 4 layar dari view RPC). I-2 selesai: `credit-desk` (`desk.nh-nft-mvp6py9i.testnet`, `docs/CONSUMER.md`) memanggil `predict_task` lewat promise, membayar dari kreditnya sendiri, 3 keputusan + 1 jalur error tercatat (≈8,9 Tgas total per screen). Sisa M3: F-2 perintah salin tambahan (P1), ML-4/X-5 tugas kedua (P2).
> **Status 3 Nov 18:30 WIB — M4 inti selesai:** T-1 unit test lengkap (50 `bursa` + 3 `credit-desk` + 4 `gbdt-core` + 1 evaluator); T-2 [docs/NEGATIVE_TESTS.md](../NEGATIVE_TESTS.md); **T-3 `tools/e2e.mjs` lolos dari nol** ([docs/E2E.md](../E2E.md): 23 langkah, 17/17 negatif ditolak, skor TEE = lokal, 228 s, akun dibersihkan). Pelajaran: tulis tx lewat satu `JsonRpcProvider` (failover menyembunyikan error deterministik), allowance FC key ≥ 1 NEAR saat gas price tinggi, kontrak ber-state besar tidak bisa dihapus (disapu saja). Biaya satu run e2e ≈ 3,2 NEAR terkunci di kontrak baru. Sisa M4: T-4 freeze 11 Nov.
> **Status 3 Nov 19:45 WIB — M5 dimulai:** D-1 [README.md](../../README.md) (Inggris, "do X → see Y" A–E, pengungkapan Undo, batasan), D-2 [CLAIMS.md](../../CLAIMS.md) (19 klaim → file:baris → test/tx), `LICENSE` MIT, `.env.example` lengkap, D-3 naskah [DEMO.md](DEMO.md) (video belum direkam — manusia). Fixture `tools/fixtures/model_8feat_synthetic.bin` ditambah agar e2e jalan dari clone bersih. Belum: video, akun tim + deploy akhir (S-3), repo publik + nama (manusia), D-5 rerun 13 Nov, D-6 submit.

**Keputusan: GO.** Gerbang S30 + S31 lolos ([SPIKE_LOG.md](../../SPIKE_LOG.md)). Dokumen ini adalah rencana kerja yang bisa diambil per tugas oleh pengembang pemula. Konteks ide: [IDEAS.md](IDEAS.md); uji arsitektur: [ARCH_STRESS_TEST.md](ARCH_STRESS_TEST.md).

**Tenggat (UTC, dari HACKATHON.md):** development ends **Sabtu 14 Nov 23:59 UTC** (= Minggu 15 Nov 06:59 WIB). Target submit **14 Nov 12:00 UTC**. Penjurian mulai 16 Nov; hosted demo dijaga hidup sampai 18 Nov (idealnya 25 Nov). Satu email boleh 2 submission; README project ini **wajib menyebut Undo** dan sebaliknya (Q-015).

**Tesis produk (satu kalimat untuk README):** sebuah model keputusan kecil bisa menjadi infrastruktur on-chain: kontrak dan agent lain memanggilnya langsung, dan mutunya diukur terhadap benchmark privat yang tidak bisa dibaca siapa pun selain evaluator yang hash-nya dipin.

---

## 0. Apa yang sudah terbukti vs yang belum

Dibaca dari kode di `spikes/s31/` dan hasil di `spikes/s31/out/`, bukan dari ringkasan.

| Sudah terbukti (S30/S31, boleh diklaim) | Bukti | Belum dibuat / belum diuji (jangan diklaim sebelum ada tugasnya) |
|---|---|---|
| Model GBDT integer (100 pohon, kedalaman 6, 8 fitur, 8.960 node, 197.551 B) tersimpan sebagai **data** di `LookupMap<u32, Vec<u8>>` dan dijalankan `predict` on-chain | `upload_model` tx `8WT9fo28…`, `predict` tx `GEEqCAwF…` 12,04 Tgas, batch 50 baris 13,75 Tgas | Model lebih dari satu arsitektur (hanya GBDT biner), regresi, multi-kelas |
| Python (`export.py`) dan Rust (`gbdt-core`) identik: 200 vektor di unit test, 50 view on-chain, 3.000 label sama dengan sklearn float | `cargo test`, `s31_results.json` (`view_agreement 50/50`) | Validasi model **di kontrak** selain decode borsh + batas 1.000 pohon (belum ada cek `n_features` vs tugas, indeks node, ukuran) |
| Biaya storage: kontrak memotong deposit persis sebesar byte terpakai dan mengembalikan sisanya | log `storage 1976000000000000000000000 yN` untuk 197.600 B | Pengembalian storage saat model dihapus |
| OutLayer menjalankan evaluator wasip2 yang **mengambil model dari kontrak lewat host `view`**, membaca secret `TEST_SET_A/B` dari env, dan skornya kembali ke `on_score` callback lalu tersimpan on-chain | tx `ZE7mnNaN…`, 13,4 s, 0,0022 NEAR; skor 8850/9100 bps = lokal = Python | Evaluator untuk **tugas berbeda** dengan secret berbeda (spike pakai satu profil `default` milik akun utama) |
| Secret terikat ke hash evaluator: build lain dengan `secrets_ref` sama → `TEST_SET_A missing`; tanpa `secrets_ref` → sama | tx `5v5TvhSk…`, run hash `75f06a7d…` | Kontrak **belum memin hash evaluator**: di spike, pemanggil bebas memberi `wasm_url`/`wasm_hash` (celah: orang bisa menjalankan "evaluator" palsu yang mengembalikan 10000) |
| Pola proxy OutLayer dari kontrak: `ext_outlayer.request_execution(source, resource_limits, input_data, secrets_ref, "Text", payer)` + callback `#[private]` dengan `Result<Option<String>, PromiseError>` | kode `contract/src/lib.rs` | Penanganan gagal/timeout/callback ganda (spike hanya menimpa `scores[model_id]`) |
| Evaluator output ≤ 900 B, skor dibulatkan 50 bps, dua split A/B | `evaluator/src/main.rs` | Menyembunyikan skor B sampai tugas ditutup (output OutLayer muncul di log tx publik) |
| CLI OutLayer: login non-interaktif via `credentials.json`, `upload`, `secrets set --wasm-hash … --access allow-all` | `s30_outlayer.sh`, `s30_upload.txt`, `s30_secrets.txt` | Secret > ~7 KB (CLI melampirkan 0,1 NEAR tetap; 20 KB butuh 0,274 NEAR) |
| Hosting evaluator di URL https mana pun + hash diterima OutLayer | `https://nh-spike-wasm.vercel.app/<sha256>.wasm` | FastFS testnet (gateway 502 sepanjang 2 Nov) |
| — | — | **Sub-account per model, NFT kepemilikan, fee yang berpindah bersama NFT, royalti otomatis**: tidak disentuh S30/S31 |
| — | — | Frontend, wallet connect di browser (S12 ❌), agent dengan FC key memanggil `predict` berbayar |

---

## 1. Keputusan arsitektur (pertanyaan terbuka yang diselesaikan)

| Pertanyaan | Keputusan MVP | Alasan dari kode/spike |
|---|---|---|
| Registry vs sub-account per model | **Satu kontrak registry `bursa`**. Sub-account per model = ekstensi opsional (§3) | Jalur registry sudah terbukti; sub-account dari dalam kontrak belum pernah dicoba (S33 belum jalan). Tesis "model bisa dipanggil kontrak lain" tetap benar lewat `bursa.predict` |
| Bagaimana pemenang dipilih dan dipublikasikan | Tugas punya `deadline_ns`. Setelah lewat, siapa pun memanggil `close_task(task_id)`: kontrak meranking submission `Scored` menurut `score_b_bps` (desc), lalu `submitted_at` (asc). Pemenang dicatat di `task.winner`, dan method stabil **`predict_task(task_id, features)`** meneruskan ke model pemenang | Semua state lokal, tidak ada promise. "Model jadi infrastruktur" = alamat stabil per tugas |
| Bagaimana evaluator mengakses model | `view get_model_bytes(submission_id)` lewat host `near:rpc/api.view` (persis seperti spike, nama argumen tetap `model_id` → diganti `submission_id` dan evaluator disesuaikan) | Terbukti untuk 197 KB (base64 ≈ 263 KB, jauh di bawah batas return 4 MB) |
| Siapa yang memilih evaluator | **Kontrak memin** `evaluator_url` + `evaluator_hash` (diset `owner` lewat `set_evaluator`). `request_score` tidak lagi menerima URL/hash dari pemanggil | Menutup celah evaluator palsu. Secret tugas dikunci ke hash yang sama (`--wasm-hash`), jadi hanya evaluator resmi yang bisa membaca test set |
| Secret per tugas | Pembuat tugas menyimpan test set dengan `outlayer secrets set '{"TEST_SET_A":…,"TEST_SET_B":…}' --wasm-hash <evaluator_hash> --profile <task_slug> --access allow-all` dari akunnya sendiri. Kontrak menyimpan `secrets_account` + `secrets_profile` per tugas | `secrets_ref {account_id, profile}` terbukti; pembuat tugas tidak perlu mempercayai operator Bursa. Batas CLI: test set ≤ ~6 KB (≈45 baris × 8 fitur × 2 split); lebih besar → tugas T-14 |
| Kebocoran test set lewat submit berulang | (1) maks **3 submission per akun per tugas**; (2) biaya submit = storage model (0,5–2 NEAR, ditahan) + `submission_fee` tetap 0,1 NEAR ke kas tugas; (3) skor dibulatkan 50 bps (sudah di evaluator); (4) leaderboard publik memakai **split A**, peringkat final memakai **split B** yang hanya dibaca saat `close_task`. Catatan jujur di README: output evaluator (termasuk B) terlihat di log tx OutLayer, jadi perlindungannya adalah bit yang sedikit per submit, bukan kerahasiaan mutlak | Sybil tidak dihentikan penuh; ditulis sebagai batasan |
| Gagal / timeout / callback ganda OutLayer | Submission punya `status`: `Uploaded → Pending{requested_at} → Scored | Failed{reason}`. `on_score` hanya diterima jika status `Pending` (idempoten), dan `request_score` hanya boleh dari `Uploaded`/`Failed`, atau dari `Pending` yang lebih tua dari 300 blok (≈ timeout yield OutLayer 200 blok + margin). Output evaluator `ok:false` → `Failed{error}`. Pemilik boleh `request_score` ulang (bayar lagi) | Spike menunjukkan callback datang juga saat worker gagal (`Ok(None)`), jadi ketiga cabang `Ok(Some)/Ok(None)/Err` ditangani |
| Deposit dan fee | **Storage**: `submit_model` payable, biaya byte dipotong presisi + refund (pola spike). **Fee inferensi**: saldo prabayar `deposit_credit()` per pemanggil; `predict`/`predict_task` memotong `task.fee_per_call` dari `credit[caller]` dan menambah `earnings[submission_id]`; pemilik `withdraw_earnings`. Tidak ada transfer di jalur panas | FC key tidak bisa melampirkan deposit (`AccessKeyDepositWithFunctionCall`, S7) → prabayar wajib untuk agent. `predict` dibuat **change method** supaya terhitung; view gratis tidak disediakan untuk model berfee |
| Hosting evaluator | Vercel `nh-spike-wasm` tetap dipakai; pindah ke FastFS kalau gateway pulih (hash tidak berubah, cukup `set_evaluator` URL baru) | FastFS 502 seharian |

---

## 2. Arsitektur MVP

```
 Pembuat tugas ──(CLI)──► outlayer secrets set --profile <slug> --wasm-hash <EVAL_HASH>
        │                                   (test set A/B, terenkripsi, hanya evaluator resmi yang bisa baca)
        └──create_task──────────────┐
                                    ▼
 Peserta ─export.py→ model.bin ─submit_model(base64)─► bursa.testnet ◄── predict / predict_task ── agent (FC key, saldo prabayar)
                                    │  tasks, submissions{model bytes,status,score_a,score_b}, credit, earnings
                                    │  evaluator_url/hash (dipin owner)
                                    │ request_score ─► outlayer.testnet.request_execution(WasmUrl=EVAL, secrets_ref=tugas)
                                    │                      └─ worker TEE: evaluator.wasm ── view(get_model_bytes) ──► bursa
                                    │ ◄─ on_score(submission_id) ──────────── stdout {a,b,…} ≤ 900 B
                                    ▼
                          Web (baca-saja, RPC view): daftar tugas, leaderboard, halaman model + biaya Tgas, perintah CLI siap salin
```

### 2.1 Komponen dan tanggung jawab

| Komponen | Lokasi | Tanggung jawab | Asal |
|---|---|---|---|
| `contracts/bursa` (Rust, near-sdk 5.30) | baru, turunan `spikes/s31/contract` | tugas, submission, evaluator terpin, skor, leaderboard, pemenang, prabayar, fee, penarikan | spike + tugas C-* |
| `crates/gbdt-core` | pindahan `spikes/s31/gbdt-core` | decode borsh, `raw_score`, `predict_label`, `accuracy_bps` (dipakai kontrak dan evaluator) | **selesai**, tambah validasi (C-2) |
| `evaluator/` (wasip2) | pindahan `spikes/s31/evaluator` | baca stdin `{contract, submission_id}`, `view` model, baca `TEST_SET_A/B`, skor A/B, output ≤ 900 B | **selesai**, ganti nama arg + versi (E-1) |
| `tools/export.py` + `tools/submit.mjs` | pindahan `spikes/s31/export.py`, baru | latih/konversi sklearn → `model.bin`, validasi lokal, `submit_model` + `request_score` | ML-* |
| `tools/agent.mjs` | baru (pola `spikes/s7`) | akun agent dengan FC key hanya `predict_task`, isi prabayar sekali, panggil N kali, cetak Tgas dan fee | I-* |
| `web/` (Next.js, baca-saja) | baru | 3 layar (§6) lewat RPC view; tombol "salin perintah" untuk aksi tulis | F-* |
| `tasks/german-credit/` | baru | `split.py`, `features.json`, `public_train.csv`, `public_holdout.csv`, `train.py`, `private_manifest.json`; `private_a/b.json` **tidak** di-commit; README tugas dengan batasan & bias (§2.6) | ML-* |
| Dokumen | README, CLAIMS.md, DEMO.md, SPIKE_LOG.md, LICENSE | juri AI mencocokkan klaim ↔ file:baris ↔ tx | D-* |

### 2.2 Desain storage kontrak

```rust
struct Contract {
  owner: AccountId,                    // boleh set_evaluator, pause
  outlayer: AccountId,                 // outlayer.testnet
  evaluator_url: String, evaluator_hash: String,   // dipin
  next_task: u32, next_submission: u32,
  tasks: LookupMap<u32, Task>,
  task_ids: Vector<u32>,               // untuk daftar
  submissions: LookupMap<u32, Submission>,
  model_bytes: LookupMap<u32, Vec<u8>>, // dipisah supaya view Submission murah
  task_submissions: LookupMap<u32, Vector<u32>>,
  per_account_count: LookupMap<(u32, AccountId), u8>,
  credit: LookupMap<AccountId, NearToken>,
  earnings: LookupMap<u32, NearToken>,
}
struct Task { creator, title, slug, description_url, n_features: u16, feature_names: Vec<String>,
  secrets_account: AccountId, secrets_profile: String, deadline_ns: u64,
  fee_per_call: NearToken, submission_fee: NearToken, max_per_account: u8,
  winner: Option<u32>, closed: bool, created_at_ns: u64 }
struct Submission { task_id, owner, model_hash: [u8;32], bytes: u32, trees: u16, nodes: u32,
  submitted_at_ns: u64, status: Status,
  score_a_bps: Option<u32>, score_b_bps: Option<u32>,   // balanced accuracy, bps
  f1_a_bps: Option<u32>, f1_b_bps: Option<u32>,         // pendamping, tidak dipakai untuk peringkat
  last_outlayer_raw: Option<String> /* ≤ 900 B */ }
enum Status { Uploaded, Pending { requested_at_block: u64 }, Scored, Failed { reason: String } }
```

Biaya storage per submission ≈ ukuran model + ~300 B metadata. Model demo ditargetkan **≤ 60 KB** (≈ 30 pohon kedalaman 5, atau 50 pohon kedalaman 4) supaya deposit peserta ≈ 0,6 NEAR dan `predict` ≈ 4–6 Tgas (diukur ulang di C-6).

### 2.3 Spesifikasi method (ABI dibekukan di M0)

| Method | Jenis | Argumen | Efek / nilai balik | Penolakan |
|---|---|---|---|---|
| `new(owner, outlayer, evaluator_url, evaluator_hash)` | init | | | |
| `set_evaluator(url, hash)` | owner | | ganti evaluator terpin | bukan owner |
| `create_task(title, slug, description_url, n_features, feature_names, secrets_account, secrets_profile, deadline_ns, fee_per_call, submission_fee, max_per_account)` | payable (storage) | | `task_id`; event `task_created` | `n_features` ≠ `feature_names.len()`, deadline ≤ now, slug dipakai |
| `submit_model(task_id, bytes: Base64VecU8)` | payable | model borsh | validasi (decode, `n_features` cocok, ≤ `MAX_MODEL_BYTES` 250 KB, ≤ 500 pohon, indeks node sah), potong storage + `submission_fee`, refund sisa; `submission_id`; status `Uploaded`; event `model_submitted` | tugas ditutup/lewat deadline, kuota akun habis, deposit kurang, model invalid |
| `request_score(submission_id)` | payable (≥ 0,05 NEAR untuk OutLayer) | | status `Pending`, promise ke OutLayer dengan evaluator terpin + `secrets_ref` tugas, callback `on_score` | bukan pemilik, status bukan `Uploaded/Failed/Pending-kedaluwarsa` |
| `on_score(submission_id)` | `#[private]` callback | `Result<Option<String>, PromiseError>` | parse JSON evaluator → `Scored{a,b}` atau `Failed{reason}`; simpan raw ≤ 900 B; event `model_scored` | status bukan `Pending` → abaikan (log) |
| `close_task(task_id)` | siapa pun | | setelah deadline: pilih pemenang (B desc, lalu waktu), set `winner`, `closed`; event `task_closed` | sebelum deadline, sudah ditutup, tidak ada `Scored` |
| `deposit_credit()` | payable | | `credit[caller] += deposit` | |
| `withdraw_credit(amount)` | | | transfer sisa prabayar | saldo kurang |
| `predict(submission_id, features: Vec<i64>) -> i64` | **change** | | potong `fee_per_call` dari `credit[caller]` → `earnings[submission_id]`; kembalikan skor mentah; event `prediction` | kredit kurang, status bukan `Scored`, jumlah fitur salah |
| `predict_task(task_id, features) -> i64` | change | | sama, ke `task.winner` | tugas belum ditutup / tanpa pemenang |
| `withdraw_earnings(submission_id)` | | | transfer `earnings` ke pemilik submission | bukan pemilik |
| Views: `get_task`, `list_tasks(from, limit)`, `leaderboard(task_id) -> Vec<{submission_id, owner, score_a_bps, f1_a_bps, bytes, trees, status}>` (`score_*_bps` = balanced accuracy; skor B hanya setelah `closed`), `get_submission`, `get_model_bytes(submission_id)`, `get_credit(account)`, `get_earnings(submission_id)`, `get_evaluator()`, `get_config()` | view | | | |

Skala fitur: `feature_scale` ada di model; pemanggil mengirim fitur **sudah dikuantisasi** (`round(x·10⁶)`). Dokumentasikan di README tugas; `tools/agent.mjs` melakukan kuantisasi.

### 2.4 Alur OutLayer (request → eksekusi → callback)

1. `request_score(id)` (deposit 0,05–0,1 NEAR): set `Pending{requested_at_block}`, lalu `ext_outlayer.request_execution(source={"WasmUrl":{url,hash,"build_target":"wasm32-wasip2"}}, resource_limits={max_instructions:20e9, max_memory_mb:256, max_execution_seconds:60}, input_data=json{contract, submission_id}, secrets_ref={profile, account_id}, "Text", Some(predecessor))` dengan gas = prepaid − 25 Tgas, `.then(on_score)` 15 Tgas.
2. Worker TEE mengunduh evaluator dari URL terpin, mencocokkan sha256, mendekripsi secret (hanya jika hash cocok), menjalankan: `view(contract, "get_model_bytes", {submission_id})` → decode → skor A, B → stdout JSON.
3. OutLayer menyelesaikan yield → `on_score` menerima `Ok(Some(json))`. Kontrak mem-parse: `ok:true` → `Scored`; `ok:false` → `Failed{error}`; `Ok(None)`/`Err` → `Failed{"outlayer: …"}`.
4. Waktu nyata dari spike: 13 s; biaya 0,0011 NEAR dipotong dari deposit, sisanya dikembalikan OutLayer ke `payer`.

### 2.5 Pipeline serialisasi dan validasi model

1. `tools/export.py --task <slug> --model <pickle|train>`: sklearn `GradientBoostingClassifier` biner → kuantisasi (`FEATURE_SCALE=1e6`, ambang `floor`, leaf `rint(value·lr·1e6)`, bias = log-odds prior) → `model.bin` (format borsh `gbdt-core::Model`, versi 1) + `vectors.json` + laporan kecocokan integer vs float.
2. `tools/validate.mjs model.bin --task <id>`: decode dengan port kecil JS atau lewat view `validate_model` di kontrak (opsional) — minimal: ukuran, `n_features`, jumlah pohon.
3. Kontrak (`submit_model`) memvalidasi ulang: decode, `n_features == task.n_features`, `trees ≤ 500`, `bytes ≤ 250 KB`, tiap node `left/right < nodes.len()` atau `LEAF`, `feature < n_features`.
4. Evaluator memakai crate yang sama → skor TEE == skor on-chain == Python (sudah terbukti).

### 2.6 Spesifikasi dataset dan tugas demo 1: risiko kredit (UCI German Credit) — diputuskan 2 Nov

**Status:** keputusan dan rancangan. Belum ada file yang dibuat, belum ada pipeline yang terintegrasi; semua baris di bawah menjadi kenyataan lewat tugas ML-1, ML-2, E-1.

| Hal | Keputusan |
|---|---|
| Sumber resmi | UCI Machine Learning Repository, *Statlog (German Credit Data)*, id 144: https://archive.ics.uci.edu/dataset/144/statlog+german+credit+data (donor H. Hofmann, 1994). File yang dipakai: `german.data` (1.000 baris, 20 atribut berkode `A11…A202`, label kolom ke-21). File `german.data-numeric` (24 kolom pra-encode) **tidak** dipakai supaya encoding kita eksplisit. Lisensi tercantum di halaman UCI (CC BY 4.0 — dicek ulang saat ML-2 dan dicatat di README tugas) |
| Tugas | Klasifikasi biner risiko kredit, **simulasi** untuk mendemonstrasikan model-sebagai-infrastruktur. Bukan sistem penilaian kredit untuk manusia |
| **Label** | UCI: `1` = good, `2` = bad. **Kita: `label = 1` jika UCI `2` (bad / berisiko), `label = 0` jika UCI `1` (good).** Kelas positif = *bad*. `predict`/`predict_task` mengembalikan skor mentah (log-odds × 10⁶); **> 0 ⇒ bad**. Distribusi: 700 good / 300 bad |
| Fitur (18, urutan tetap) | Numerik apa adanya (integer): `duration_months`, `credit_amount_dm`, `installment_rate_pct`, `residence_since_years`, `age_years`, `existing_credits`, `num_dependents`. Kategorikal → kode ordinal integer sesuai urutan kode UCI: `checking_status` (A11–A14 → 0–3), `credit_history` (A30–A34 → 0–4), `purpose` (A40–A49, A410 → 0–10), `savings` (A61–A65 → 0–4), `employment_since` (A71–A75 → 0–4), `other_debtors` (A101–A103 → 0–2), `property` (A121–A124 → 0–3), `other_installment_plans` (A141–A143 → 0–2), `housing` (A151–A153 → 0–2), `job` (A171–A174 → 0–3), `telephone` (A191–A192 → 0–1). **Dibuang (keputusan tim 2 Nov):** `personal_status_sex` (A91–A95) dan `foreign_worker` (A201–A202) karena atribut sensitif (lihat batasan); `n_features = 18` final. Tabel kode lengkap ditulis di `tasks/german-credit/features.json` dan README tugas |
| Format fitur ke kontrak | `Vec<i64>` 18 elemen, **`feature_scale = 1`** (semua fitur sudah integer; tidak ada pembulatan), `out_scale = 1_000_000`. Kompatibel dengan `gbdt-core` tanpa perubahan format borsh (versi 1). Ambang sklearn (mis. 2,5) di-`floor` → `x ≤ 2` setara `x ≤ 2,5` untuk integer |
| Pembagian data | 1.000 baris → **stratified by label, `random_state = 144`** (id dataset), prosedur `train_test_split` dua tahap yang dicatat di `tasks/german-credit/split.py`: `public_train.csv` 600 (420 good / 180 bad), `public_holdout.csv` 100 (70/30, untuk validasi mandiri peserta), **`private_a.json` 150** (105/45, leaderboard sementara), **`private_b.json` 150** (105/45, peringkat final). Dua file privat **gitignored**; yang di-commit hanya `private_manifest.json` berisi sha256 tiap file privat + jumlah baris + jumlah per kelas, sebagai komitmen |
| Ukuran secret vs batas CLI | 150 baris × 19 integer sebagai JSON ≈ 10 KB per split → ≈ 20 KB total > batas CLI (~7 KB untuk deposit tetap 0,1 NEAR; S30). Rencana: encoding kompak `rows` sebagai base64 dari `i16` little-endian (150 × 19 × 2 B = 5,7 KB → base64 7,6 KB per split, ≈ 15 KB total) dan **tugas ML-2b** untuk menyimpan secret dengan deposit cukup (lihat §4). Kalau semua jalur gagal: 75/75 baris (≈ 7,6 KB total), dicatat sebagai pengurangan resolusi |
| **Metrik utama** | **Balanced accuracy** dalam bps = `(TPR_bps + TNR_bps) / 2`, dihitung integer: `TPR_bps = correct_bad·10⁴ / n_bad`, `TNR_bps = correct_good·10⁴ / n_good`. Alasan: kelas 70/30; akurasi biasa 70% dicapai model "semua good". Pendamping: **F1 kelas bad** (`2·TP / (2·TP + FP + FN)`, bps). Evaluator mengeluarkan `{a:{n,n_bad,tp,tn,fp,fn,bal_acc_bps,f1_bps}, b:{…}}` (≤ 900 B). Leaderboard dan `close_task` memakai `bal_acc_bps`; F1 ditampilkan saja. Pembulatan 50 bps tetap |
| Baseline yang diharapkan | GBDT 50 pohon kedalaman 4 (≤ 1.550 node ≈ 34 KB) dengan `sample_weight` 1 : 2,33 untuk bad; perkiraan balanced accuracy 0,68–0,74 (literatur German Credit: akurasi 0,75–0,78). Angka pasti baru ada setelah ML-2. Exporter mendapat opsi `--bias-shift` (menggeser `bias` di model, bukan format baru) supaya peserta bisa menyetel ambang untuk balanced accuracy |
| Use case agent (demo) | `tools/agent.mjs` memuat 10 pemohon simulasi dari `public_holdout.csv`, memanggil `predict_task(task_id, features)` dengan FC key, dan mencetak keputusan simulasi: skor ≤ 0 → "beri tempo bayar 30 hari", > 0 → "minta uang muka". Keputusan ini hanya ilustrasi di lingkungan simulasi |

**Anti-kebocoran (apa yang dilindungi dan apa yang tidak):**
- Baris privat tidak ada di `public_train`/`public_holdout`; `split.py` deterministik, dan manifest sha256 di-commit sebelum tugas dibuka.
- Umpan balik skor dibatasi (3 submit/akun, 50 bps, split B hanya saat tutup).
- **Tidak dilindungi, ditulis di README:** German Credit publik sepenuhnya, jadi peserta bisa melatih pada 1.000 baris UCI termasuk baris privat. Split privat kita melindungi dari *overfitting lewat umpan balik leaderboard*, bukan dari pengunduhan dataset asli. Ini memadai untuk demo mekanisme; benchmark produksi memerlukan data privat sungguhan.

**Batasan dan bias dataset (wajib di README tugas):**
- 1.000 baris dari Jerman Selatan, ~1973–1975, nilai dalam Deutsche Mark; tidak mewakili pemohon kredit masa kini atau Indonesia.
- Dataset memuat atribut sensitif (jenis kelamin/status perkawinan, pekerja asing, usia) dan sering dipakai sebagai *benchmark bias* dalam riset fairness; dua atribut kami buang, `age_years` tetap dipakai dan diakui sebagai risiko bias usia.
- Dokumentasi asli UCI diketahui mengandung kesalahan pengodean untuk beberapa atribut (Grömping, 2019, "South German Credit"); kami memakai file dan kamus UCI apa adanya dan menyebutkan koreksi tersebut sebagai referensi.
- UCI menyertakan matriks biaya (salah menilai *bad* sebagai *good* = 5× lebih mahal); kami memakai balanced accuracy, bukan biaya tertimbang, demi kesederhanaan dan menyebutkannya.
- Model demo tidak boleh dipakai untuk keputusan kredit nyata terhadap orang.

**Kriteria terima tugas demo 1 (dipenuhi lewat ML-1, ML-2, ML-2b, E-1, C-6, I-1):**
1. Model dapat dilatih dari `public_train.csv` saja dengan `tasks/german-credit/train.py`.
2. `export.py` menghasilkan `model.bin` valid (decode oleh `gbdt-core`, `n_features = 18`).
3. `model.bin` demo ≤ 60 KB.
4. Python dan Rust identik pada ≥ 200 test vector dari `public_holdout.csv` (`cargo test`).
5. Evaluator OutLayer mengembalikan `bal_acc_bps` dan `f1_bps` untuk A dan B dari secret, sama dengan hitungan lokal.
6. `predict_task(task_id, features)` di testnet mengembalikan skor yang sama dengan Python untuk 10 pemohon simulasi.

---

## 3. Lingkup

**MVP (wajib, dalam urutan perjalanan pengguna):**
1. Pembuat tugas menerbitkan tantangan (`create_task` + secret via CLI).
2. Peserta mengirim model GBDT (`export.py` → `submit_model`).
3. Evaluator menilai di OutLayer dengan test set privat (`request_score`).
4. Skor kembali ke NEAR dan tersimpan (`on_score`).
5. Leaderboard terbarui (view + web).
6. Model pemenang jadi infrastruktur (`close_task` → `predict_task`).
7. Agent dengan FC key memanggil dan menerima prediksi (`tools/agent.mjs`).
8. Demo menunjukkan biaya nyata (Tgas per panggilan di log tx + halaman web).

**Ekstensi opsional (hanya jika M3 selesai ≤ 9 Nov; masing-masing punya tugas dan kriteria sendiri, tidak diklaim sebelum lolos):**

| Ekstensi | Tugas | Kriteria terima | Catatan |
|---|---|---|---|
| X-1 Sub-account per model pemenang (`m<id>.bursa.testnet` via `Promise::create_account().transfer().deploy_contract(template).function_call("new")`) | 1 hari | akun lahir dari `close_task`/`spawn`, `predict` di akun itu == `bursa.predict`, gas ≤ 60 Tgas | belum pernah dicoba dari dalam kontrak |
| X-2 NFT NEP-171 per model (contract-tools, pola S13) | ½ hari | `nft_token` menunjuk pemilik; `withdraw_earnings` memakai pemilik NFT saat itu | fee berpindah bersama NFT (aturan ditulis) |
| X-3 Pembagian royalti otomatis (pembuat tugas % dari fee) | ½ hari | split tercatat per panggilan | |
| X-4 Arsitektur lain (regresi logistik, regresi numerik) | 1 hari | `export.py` + `gbdt-core` varian + vektor | |
| X-5 Tugas kedua (dataset berbeda) | ½ hari | leaderboard dua tugas | diprioritaskan di antara ekstensi |
| X-6 Wallet connect di web untuk `submit`/`deposit_credit` | 1 hari (S32 dulu) | tx dari browser berhasil | S12 belum pernah di-spike |

---

## 4. Daftar tugas

Peran: **C** kontrak (Rust), **E** evaluator, **ML** exporter/dataset, **I** integrasi (skrip Node, deploy), **F** frontend, **D** dokumentasi. Effort dalam jam-orang untuk pemula yang dibimbing. Prioritas: P0 = jalur kritis, P1 = diperlukan untuk demo yang rapi, P2 = opsional.

### M0 — Fondasi (Senin 3 Nov)

| ID | Tugas | Pri | Tergantung | Deliverable | Kriteria terima | Jam | Peran | Risiko utama → fallback |
|---|---|---|---|---|---|---|---|---|
| S-1 | Struktur repo produk: `contracts/bursa`, `crates/gbdt-core`, `evaluator/`, `tools/`, `web/`, `tasks/`, `docs/research/` (pindahkan `docs/research/`), `spikes/` tetap | P0 | — | pohon folder + `Cargo.toml` workspace + `build.sh` (pola `spikes/s31/build.sh`) | `bash build.sh test` lolos dari root baru | 2 | I | — |
| S-2 | Bekukan ABI §2.3 sebagai `docs/ABI.md` + stub method yang mengembalikan `unimplemented` | P0 | S-1 | file ABI + kontrak kompilasi | `cargo near build` sukses; F dan I mulai dari ABI ini | 2 | C | perubahan ABI nanti → setiap perubahan dicatat di ABI.md hari itu juga |
| S-3 | Dana testnet: minta manusia mengisi ≥ 15 NEAR lewat browser faucet (near-faucet.io) ke akun baru `bursa-dev` + 2 akun peserta + 1 akun agent; simpan di `.env` | P0 | — | akun berisi | saldo terlihat di RPC | 1 | I (+manusia) | faucet 429 → danai dari `nh-mt-…` (4 NEAR) dan `nh-ft/nh-nft` (±8 NEAR masing-masing) |
| S-4 | **Diputuskan 2 Nov: UCI German Credit** (§2.6). Tulis `tasks/german-credit/README.md` (sumber, lisensi, mapping label, 18 fitur + tabel kode, batasan & bias) dan `features.json` | P0 | — | README tugas + `features.json` | kamus kode cocok dengan `german.doc` UCI; label `1 = bad` tertulis eksplisit | 2 | ML | lisensi UCI tidak jelas → tetap pakai dengan atribusi, catat |

### M1 — Kontrak inti (Selasa 4 – Rabu 5 Nov)

| ID | Tugas | Pri | Tergantung | Deliverable | Kriteria terima | Jam | Peran | Risiko → fallback |
|---|---|---|---|---|---|---|---|---|
| C-1 | State + `new`, `set_evaluator`, `create_task`, views `get_task/list_tasks/get_config` | P0 | S-2 | kode + unit test | test: buat 2 tugas, slug unik, deadline ditolak jika lampau | 4 | C | — |
| C-2 | `submit_model` + validasi model (decode, `n_features`, ukuran, indeks) + storage presisi + kuota per akun + `submission_fee` | P0 | C-1 | kode + unit test | test: model spike lolos, model dengan indeks rusak ditolak, submit ke-4 ditolak, refund benar | 5 | C | validasi indeks mahal untuk 9k node → cukup cek saat decode (≤ 1 Tgas, ukur) |
| C-3 | `request_score` dengan evaluator terpin + `on_score` mesin status (`Uploaded/Pending/Scored/Failed`, idempoten, timeout 300 blok) | P0 | C-2 | kode + unit test | test: callback kedua diabaikan; `ok:false` → Failed; request ulang dari Failed boleh | 5 | C | format JSON evaluator berubah → parser toleran, simpan raw |
| C-4 | `close_task` + pemenang + `leaderboard` (B disembunyikan sebelum tutup) | P0 | C-3 | kode + unit test | test: peringkat B desc, seri → lebih awal; sebelum deadline ditolak | 3 | C | — |
| C-5 | Prabayar + fee: `deposit_credit`, `withdraw_credit`, `predict`, `predict_task`, `withdraw_earnings` | P0 | C-4 | kode + unit test | test: kredit kurang ditolak; earnings bertambah; tarik oleh bukan pemilik ditolak | 4 | C | — |
| C-6 | Deploy ke `bursa-dev.testnet`, ukur gas `submit_model` (60 KB & 197 KB), `predict` (model 60 KB), simpan di `docs/GAS.md` | P0 | C-5, S-3 | tabel Tgas + hash tx | `predict` ≤ 8 Tgas untuk model demo ≤ 60 KB | 2 | I | > 8 Tgas → kecilkan model (depth 4) |

**Checkpoint M1 (5 Nov malam):** `node tools/smoke.mjs` membuat tugas, submit model spike, `request_score` **dengan evaluator spike lama** (hash `dcc4aa66…`, secret `default` milik akun utama) → `Scored`. Ini menguji kontrak baru dengan evaluator yang sudah terbukti sebelum evaluator diubah.

### M2 — Evaluator + pipeline model (Kamis 6 Nov)

| ID | Tugas | Pri | Tergantung | Deliverable | Kriteria terima | Jam | Peran | Risiko → fallback |
|---|---|---|---|---|---|---|---|---|
| E-1 | Evaluator v1: arg `submission_id`, field `eval_version`, `task_slug` dari input, error terstruktur; **metrik balanced accuracy + F1** (fungsi `confusion()` baru di `gbdt-core`, integer), pembaca secret format base64 `i16` **dan** JSON lama; build, sha256, host di Vercel (atau FastFS bila pulih) | P0 | C-3 | `evaluator.wasm` + hash + URL | run lokal `wasmtime` == `bal_acc_bps`/`f1_bps` Python pada `private_a/b`; output ≤ 900 B | 3 | E | FastFS tetap mati → Vercel |
| E-2 | `set_evaluator(url, hash)` di `bursa-dev`; secret tugas demo disimpan oleh akun pembuat tugas dengan `--profile <slug> --wasm-hash <hash>`; uji negatif hash lain | P0 | E-1 | `docs/EVALUATOR.md` berisi hash, URL, perintah | `request_score` → `Scored`; evaluator lama (hash `dcc4…`) kini **gagal** membaca secret tugas baru | 2 | I | secret > 7 KB ditolak CLI → test set ≤ 45 baris/split atau T-14 |
| ML-1 | `export.py` menjadi CLI tugas: `--task german-credit` membaca `features.json` (18 fitur, `feature_scale = 1`), opsi `--bias-shift`, menulis `model.bin`, `vectors.json` (≥ 200 baris dari `public_holdout`), `report.json` (kecocokan int vs float, ukuran, n pohon, balanced accuracy & F1 lokal di holdout) | P0 | S-4 | skrip + contoh output | kecocokan label int vs float ≥ 99,5%; `model.bin` ≤ 60 KB | 4 | ML | — |
| ML-2 | Dataset: `tasks/german-credit/split.py` (unduh `german.data`, encode 18 fitur, label `1 = bad`, stratified seed 144) → `public_train.csv` 600, `public_holdout.csv` 100, `private_a.json` 150, `private_b.json` 150 (**gitignored**), `private_manifest.json` (sha256 + jumlah per kelas); `train.py` baseline GBDT 50×4 dengan `sample_weight` | P0 | S-4 | file + manifest | tidak ada baris privat di file publik (cek hash baris); baseline balanced accuracy holdout ≥ 0,65; model ≤ 60 KB | 5 | ML | balanced accuracy < 0,65 → tambah pohon sampai 60 KB atau `--bias-shift` |
| ML-2b | Simpan secret tugas (A+B ≈ 15 KB dengan encoding base64 `i16`) di OutLayer dari akun pembuat tugas, `--profile german-credit --wasm-hash <EVAL_HASH>` | P0 | ML-2, E-1 | `docs/EVALUATOR.md` berisi tx secret | evaluator membaca A dan B; uji negatif hash lain gagal | 2 | I | CLI menolak (> 7 KB, deposit tetap 0,1 NEAR) → (1) patch konstanta deposit di salinan lokal `outlayer-cli` dan `cargo install --path`, (2) dashboard web OutLayer, (3) kecilkan ke 75/75 baris |
| ML-3 | `tools/submit.mjs <task_id> model.bin` (submit + request_score + tunggu `Scored`) dan `tools/create_task.mjs` | P0 | C-5 | skrip | jalan ujung ke ujung dengan 2 akun peserta | 3 | I | — |

**Checkpoint M2 (6 Nov malam):** dua model German Credit (baseline 50×4 dan yang lebih lemah, mis. 10×2) masuk leaderboard dengan `bal_acc_bps` A berbeda; `close_task` setelah deadline uji (10 menit) memilih pemenang menurut B. Catatan beban: ML-1/ML-2/ML-2b/E-1 kini ≈ 14 jam (sebelumnya ≈ 9); masih muat di 4–6 Nov karena ML-1/ML-2 tidak menunggu kontrak dan bisa dimulai 3 Nov.

### M3 — Integrasi agent + web (Jumat 7 – Minggu 9 Nov)

| ID | Tugas | Pri | Tergantung | Deliverable | Kriteria terima | Jam | Peran | Risiko → fallback |
|---|---|---|---|---|---|---|---|---|
| I-1 | `tools/agent.mjs`: buat akun agent (atau pakai `agent.*`), tambah **FC key** hanya `predict_task`, `deposit_credit` sekali dengan full key, lalu 10 pemohon simulasi dari `public_holdout.csv` → 10 panggilan `predict_task` dengan FC key; cetak skor, keputusan simulasi ("tempo 30 hari" / "minta uang muka"), Tgas, sisa kredit, earnings pemilik | P0 | C-6, ML-2 | skrip + `docs/AGENT.md` | 10/10 berhasil dan skor == Python; panggilan `withdraw_credit` dengan FC key ditolak (`AccessKeyReceiverMismatch`/method) | 4 | I | — |
| I-2 | Contoh **kontrak pemanggil** `contracts/consumer-example`: satu method yang memanggil `bursa.predict_task` lewat promise dan bertindak di callback (mis. "setujui/tolak") | P1 | C-6 | kontrak kecil + tx | callback menerima skor; dicatat di CLAIMS | 4 | C | waktu habis → cukup agent (I-1) |
| F-1 | Web baca-saja: layar Tugas (daftar + status + deadline), Leaderboard (A, status, byte, pohon; B dan pemenang setelah tutup), Model (skor, pemilik, tombol "salin perintah agent", log 20 panggilan terakhir dari event via RPC `EXPERIMENTAL_changes` atau indexer sederhana = polling view `get_submission`), Biaya (tabel Tgas dari `docs/GAS.md`) | P0 | C-5 | Next.js di Vercel | semua angka berasal dari view RPC; tidak ada data palsu | 10 | F | event log sulit → tampilkan counter panggilan dari state (`calls: u64` di Submission, tambahkan di C-5) |
| F-2 | "Salin perintah" untuk `create_task`, `submit`, `request_score`, `deposit_credit` memakai `near-cli-rs` dan skrip kita | P1 | F-1 | | perintah yang disalin jalan | 2 | F | — |
| ML-4 | Tugas 2 (ekstensi X-5) kalau ML-2 selesai ≤ 7 Nov | P2 | ML-2 | | | 3 | ML | lewati |

**Checkpoint M3 (9 Nov malam) = demo end-to-end pertama direkam kasar:** tugas → submit 2 model → skor → tutup → agent memanggil pemenang → web menampilkan semuanya.

### M4 — Pengerasan + freeze (Senin 10 – Selasa 11 Nov)

| ID | Tugas | Pri | Tergantung | Deliverable | Kriteria terima | Jam | Peran |
|---|---|---|---|---|---|---|---|
| T-1 | Unit test lengkap kontrak (status mesin, fee, kuota, validasi) + `cargo test` di CI lokal | P0 | C-5 | ≥ 20 test | hijau | 4 | C |
| T-2 | Uji negatif terdokumentasi: evaluator hash lain, submit ke-4, kredit habis, callback ganda (simulasi di unit test), model `n_features` salah | P0 | T-1 | `docs/NEGATIVE_TESTS.md` dengan hash tx | tiap kasus punya bukti | 3 | I |
| T-3 | Skrip `tools/e2e.mjs` yang menjalankan seluruh perjalanan pengguna di testnet dari nol (akun baru dari `.env`) dan mencetak ringkasan + hash | P0 | I-1 | skrip | selesai < 10 menit tanpa campur tangan | 4 | I |
| T-4 | **Feature freeze 11 Nov 18:00 WIB.** Setelah ini hanya perbaikan bug dan dokumen | P0 | | | | | semua |
| X-* | Ekstensi hanya jika M3 selesai ≤ 9 Nov dan T-1..T-3 sudah hijau | P2 | | | | | |

### M5 — Dokumen, video, submit (Rabu 12 – Sabtu 14 Nov)

| ID | Tugas | Pri | Deliverable | Kriteria terima | Jam | Peran |
|---|---|---|---|---|---|---|
| D-1 | `README.md`: apa, masalah, cara coba "do X → see Y" (10 langkah dengan perintah persis), protokol NEAR yang dipakai (OutLayer, FC key, near-sdk), kode AI diungkap, **pengungkapan project saudara Undo (Q-015)**, batasan jujur (Sybil, skor B di log, model kecil) | P0 | file | juri pemula bisa mengulang semua langkah dengan akun testnet baru | 4 | D |
| D-2 | `CLAIMS.md`: tabel klaim → file:baris → test/tx | P0 | file | setiap kalimat klaim di README punya baris | 2 | D |
| D-3 | `DEMO.md` + video 3 menit (§7) | P0 | video unlisted | durasi ≤ 3:00, semua tx asli | 4 | D + I |
| D-4 | `SPIKE_LOG.md` S30–S33 final, `docs/GAS.md`, `LICENSE` MIT, `.env.example` | P0 | | | 2 | D |
| D-5 | Jalankan ulang `tools/e2e.mjs` dan spike S30/S31 pada 13 Nov (OutLayer bisa berubah) | P0 | log | hijau | 1 | I |
| D-6 | 14 Nov: manusia membuat repo publik, push, post X (@NEARProtocol #NEARHackathon), lalu payload submit dicetak dan dikirim setelah "ya" — **target 12:00 UTC** | P0 | 201 | | 1 | manusia + D |

**Buffer:** 13 Nov siang–malam dan 14 Nov pagi tidak diisi tugas baru.

---

## 5. Jalur kritis

S-1 → S-2 → C-1 → C-2 → C-3 → **Checkpoint M1** → E-1 → E-2 → ML-2 → ML-3 → **Checkpoint M2** → I-1 → F-1 → **Checkpoint M3** → T-3 → freeze → D-1 → D-3 → D-6.

Tugas di luar jalur kritis yang boleh paralel sejak hari 1 tanpa risiko integrasi: ML-1/ML-2 (hanya butuh format borsh yang sudah final), F-1 kerangka layar dengan data dari kontrak spike `s31.nh-mt-mvp6qbyw.testnet` (view `model_info`, `get_score`) sampai `bursa-dev` ada.

**Aturan anti-kekacauan integrasi untuk tim pemula:**
- Satu orang memegang kontrak; tidak ada dua orang mengedit `lib.rs` di hari yang sama.
- ABI berubah hanya lewat `docs/ABI.md` + pesan di grup; F dan I membaca ABI, bukan kode.
- Setiap tugas selesai = ada perintah yang bisa dijalankan orang lain untuk memverifikasi (kolom "kriteria terima").
- Tidak ada pekerjaan di mainnet. Tidak ada secret di repo (`tasks/*/secret_*.json`, `.env`).

---

## 6. Layar frontend (baca-saja)

| Layar | Data (view) | Interaksi |
|---|---|---|
| **Tugas** | `list_tasks` | kartu: judul, fitur, deadline (hitung mundur), jumlah submission, status; tombol "Ikut" → perintah `tools/submit.mjs` yang bisa disalin |
| **Leaderboard** `/task/:id` | `leaderboard`, `get_task` | tabel peringkat A; setelah tutup: kolom B + lencana "Pemenang" + alamat `predict_task` yang bisa disalin; grafik batang sederhana skor |
| **Model** `/model/:id` | `get_submission`, `get_earnings`, (`calls`) | skor, ukuran, pohon, pemilik, hash model, hash evaluator + link tx skor; blok "Panggil dari agent" (perintah + contoh fitur); kolom biaya: Tgas per panggilan dari `docs/GAS.md` + link tx |
| **Tentang / Biaya** | statis | diagram §2, tabel Tgas, batasan jujur |

Tanpa wallet connect di MVP (S12 belum pernah di-spike). Semua tulis lewat CLI; juri mengulang dengan perintah dari README.

---

## 7. Skenario demo (3 menit, semua tx asli di testnet)

| Waktu | Tampil | Narasi |
|---|---|---|
| 0:00–0:25 | Layar Tugas | "Model ML biasanya hidup di server orang lain. Di NEAR, model bisa jadi kontrak yang dipanggil agent lain, dan mutunya diuji di benchmark yang tidak bisa dibaca siapa pun." Pembuat tugas sudah menerbitkan tugas *risiko kredit* (German Credit, 18 fitur, metrik balanced accuracy); secret test set tersimpan di OutLayer |
| 0:25–0:55 | Terminal `tools/submit.mjs` | peserta: `train.py` di data publik → `export.py` → `model.bin` (≈ 35 KB) → `submit_model` → `request_score`; hitung 13 detik; balanced accuracy split A muncul di leaderboard (tx OutLayer di explorer) |
| 0:55–1:20 | Leaderboard | model kedua yang lebih lemah masuk di bawah; `close_task` → skor split B terbuka, lencana pemenang + alamat `predict_task` |
| 1:20–2:00 | Terminal `tools/agent.mjs` | agent simulasi dengan FC key (tunjukkan `view_access_key`: hanya `predict_task`) memeriksa 10 pemohon → skor + keputusan simulasi, **≈ 5 Tgas per panggilan**, kredit berkurang, earnings pemilik bertambah; satu panggilan `withdraw_credit` dari FC key ditolak protokol |
| 2:00–2:30 | Explorer | tx `on_score`: hash evaluator terpin; coba `request_score` dengan evaluator lain → `TEST_SET missing` (uji negatif sudah direkam) |
| 2:30–3:00 | Layar Biaya | tabel Tgas vs EVM; batasan jujur satu kalimat ("dataset 1994, simulasi, bukan penilaian kredit manusia"); "repo + README do-X-see-Y" |

---

## 8. Deployment dan kebutuhan testnet

| Hal | Nilai |
|---|---|
| Kontrak | `bursa-dev.testnet` (dev) dan `bursa.<akun-tim>.testnet` (demo akhir, deploy ulang 12 Nov) |
| NEAR dibutuhkan | kode ±1,8 NEAR; per model demo ±0,6 NEAR × 4; secret 0,1 × 2; gas → **≥ 10 NEAR per deploy akhir, 15 NEAR total aman**. Sumber: browser faucet (manusia) atau sisa akun spike |
| OutLayer | `outlayer.testnet`; evaluator di Vercel `nh-spike-wasm` (ganti ke FastFS jika pulih); CLI login via `credentials.json` |
| Akun | pembuat tugas (akun tim), 2 peserta, 1 agent (+ FC key), 1 konsumen kontrak (I-2) |
| Web | Vercel project `bursa-model` (baca RPC fastnear) |
| RPC | `rpc.testnet.fastnear.com` (+ failover seperti `lib.mjs`) |
| Upgrade protokol mainnet 86→88 (~7 Nov) | tidak berdampak (testnet 88 sudah), tapi `outlayer.testnet` bisa berubah → T-3 dijalankan ulang 13 Nov |

---

## 9. Pertanyaan yang butuh keputusan manusia

1. ~~Dataset tugas demo~~ **Diputuskan 2 Nov: UCI German Credit, balanced accuracy, label `1 = bad`** (§2.6). Yang masih perlu validasi teknis saat ML-2 (bukan keputusan baru): (a) lisensi di halaman UCI dicatat apa adanya; (b) baseline 50×4 mencapai balanced accuracy ≥ 0,65 pada holdout (kalau tidak, naikkan pohon sampai 60 KB); (c) secret ≈ 15 KB tersimpan lewat salah satu jalur ML-2b. **Diputuskan 2 Nov: 18 fitur, `personal_status_sex` dan `foreign_worker` dibuang** (bukan lagi pertanyaan terbuka). Tugas 2 (X-5) tetap opsional: prediksi transaksi NEAR gagal atau harga cabai PIHPS.
2. **Komposisi tim dan peran** C/E/ML/I/F/D: siapa memegang kontrak (satu orang), siapa web.
3. **Nama project dan nama repo** (harus unik, repo terpisah dari Undo; `docs/research/` ikut di `docs/research/` atau dibuang dari repo publik?).
4. **Isi ulang testnet** ≥ 15 NEAR lewat browser faucet oleh manusia (faucet API 429).
5. Setuju hosting evaluator tetap di Vercel sampai 25 Nov bila FastFS belum pulih.

---

## 10. Ringkasan akhir

**Arsitektur MVP final:** satu kontrak registry `bursa` (tugas, submission, model sebagai data, evaluator terpin, mesin status skor, leaderboard, pemenang per tugas, prabayar + fee pull-payment) · satu evaluator wasip2 di OutLayer (model via `view`, secret per tugas terikat hash) · exporter Python + skrip Node (submit, agent FC key, e2e) · web Next.js baca-saja · dua dataset (satu wajib).

**Ditunda secara eksplisit:** sub-account per model (X-1), NFT kepemilikan (X-2), royalti otomatis (X-3), arsitektur model lain (X-4), tugas kedua (X-5, dikerjakan kalau sempat), wallet connect (X-6), penyembunyian skor B dari log OutLayer, anti-Sybil sungguhan (staking/identitas), pengembalian storage, skor tier LLM.

**Tugas jalur kritis:** S-1, S-2, C-1–C-6, E-1, E-2, ML-2, ML-3, I-1, F-1, T-3, D-1, D-3, D-6.

**Tiga risiko terbesar:**
1. **OutLayer/FastFS berubah atau mati di hari penjurian** (gateway 502 sudah terjadi 2 Nov). Mitigasi: evaluator di Vercel, `set_evaluator` bisa mengganti URL tanpa ubah hash, T-3 dijalankan ulang 13 Nov, video merekam tx asli.
2. **Kontrak molor** (satu orang, 5 tugas C dalam 2 hari). Mitigasi: ABI dibekukan hari 1, Checkpoint M1 memakai evaluator spike lama supaya kontrak diuji lebih awal, ekstensi dilarang sebelum M3.
3. **Model demo German Credit terlihat lemah atau bias** (balanced accuracy ~0,70 adalah plafon wajar dataset ini; atribut sensitif; data 1994). Mitigasi: metrik dan batasan dijelaskan terang-terangan di README dan video, dua model dengan skor berbeda supaya leaderboard bermakna, baseline + `--bias-shift`, tidak ada data sintetis di demo.

**Checklist kesiapan submit (14 Nov):**
- [ ] `tools/e2e.mjs` hijau pada 13 Nov dengan akun baru
- [ ] README "do X → see Y" diuji oleh anggota yang tidak menulis kode
- [ ] `CLAIMS.md`: setiap klaim → file:baris → tx/test; tidak ada fitur X-* yang diklaim kecuali lolos kriterianya
- [ ] README menyebut project Undo (Q-015) dan Undo menyebut project ini
- [ ] `LICENSE` ada; tidak ada secret/test set di repo; `.env.example` lengkap
- [ ] Web hidup di Vercel, evaluator URL hidup, kontrak demo final terdeploy dan hash evaluator terpin
- [ ] Video ≤ 3 menit, post X oleh manusia dengan "built at NEAR HACKATHON", @NEARProtocol #NEARHackathon
- [ ] Payload submit dicetak, `requestId` disimpan, dikirim setelah konfirmasi "ya", respons 201
