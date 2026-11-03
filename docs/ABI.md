# ABI kontrak `bursa` — dibekukan M0 (3 Nov 2026)

Sumber kebenaran untuk tim frontend (F), integrasi (I), dan evaluator (E). Perubahan apa pun pada tanda tangan method **harus** diubah di sini dulu, lalu diumumkan di grup pada hari yang sama. Implementasi mengikuti PLAN.md §2.3; stub yang terkompilasi ada di `contracts/bursa/src/lib.rs` dan memanggil `panic("unimplemented: <tugas>")` sampai tugas C-x selesai.

Konvensi:
- Semua uang `NearToken` dikirim/diterima sebagai **string yoctoNEAR** di JSON (`"100000000000000000000000"` = 0,1 NEAR).
- `U64` (waktu `*_ns`) adalah **string** di JSON. Waktu = `env::block_timestamp()` nanodetik.
- Fitur ke `predict*`: `Vec<i64>` yang **sudah dikuantisasi** sesuai `feature_scale` model (German Credit: skala 1, integer apa adanya) dengan urutan persis `task.feature_names`.
- Skor mentah = log-odds × `out_scale` (10⁶). **`> 0` ⇒ kelas positif** (German Credit: *bad*).
- `*_bps` = basis poin (0–10000). `score_*_bps` = balanced accuracy; `f1_*_bps` = F1 kelas positif.

## Tipe

```jsonc
Status  = "Uploaded" | {"Pending":{"requested_at_block":123}} | "Scored" | {"Failed":{"reason":"…"}}

Task = { "task_id":1, "creator":"a.testnet", "title":"…", "slug":"german-credit", "description_url":"https://…",
         "n_features":18, "feature_names":["checking_status", …], "secrets_account":"a.testnet",
         "secrets_profile":"german-credit", "deadline_ns":"1762…", "fee_per_call":"1000000000000000000000",
         "submission_fee":"100000000000000000000000", "max_per_account":3, "winner":null, "closed":false,
         "created_at_ns":"…", "submission_count":0 }

Submission = { "submission_id":7, "task_id":1, "owner":"p.testnet", "model_hash":"<base64 sha256>", "bytes":34210,
               "trees":50, "nodes":1510, "submitted_at_ns":"…", "status":Status,
               "score_a_bps":7050, "score_b_bps":null, "f1_a_bps":5600, "f1_b_bps":null, "calls":12,
               "last_outlayer_raw":"{…≤900 B…}" }

LeaderboardRow = { "submission_id", "owner", "score_a_bps", "f1_a_bps", "score_b_bps" /* null sebelum closed */,
                   "bytes", "trees", "status", "calls" }

Config = { "owner", "outlayer", "evaluator_url", "evaluator_hash", "max_model_bytes":256000, "max_trees":500,
           "pending_timeout_blocks":300, "task_count":2, "submission_count":7 }
```

## Method perubahan state

| Method | Argumen JSON | Deposit | Gas saran | Balik | Panik (pesan dimulai dengan) | Tugas |
|---|---|---|---|---|---|---|
| `new` | `{owner, outlayer, evaluator_url, evaluator_hash}` | 0 | 30 Tgas | — | — | ✅ |
| `set_evaluator` | `{url, hash}` | 0 | 10 Tgas | — | `owner only` | ✅ |
| `create_task` | `{title, slug, description_url, n_features, feature_names, secrets_account, secrets_profile, deadline_ns, fee_per_call, submission_fee, max_per_account}` | storage (≈ 0,01 NEAR), sisa dikembalikan | 30 Tgas | `task_id: u32` | `n_features mismatch`, `deadline in the past`, `slug taken`, `slug: lowercase letters, digits, '-' only` (≤ 40), `title: 1..=80 bytes`, `n_features: 1..=64`, `storage deposit` | ✅ C-1 |
| `submit_model` | `{task_id, bytes:<base64 borsh Model>}` | storage byte model + `submission_fee` (fee ditransfer ke `task.creator`), sisa dikembalikan | 100 Tgas (model ≤ 60 KB) | `submission_id: u32` | `no such task`, `task closed`, `deadline passed`, `quota: N submissions per account`, `invalid model: …` (`size`, `decode`, `N trees > 500`, `WrongFeatureCount`, `BadChildIndex(tree,node)`, `FeatureOutOfRange`, `EmptyTree`, `UnsupportedVersion`, `BadScale`), `storage deposit` | ✅ C-2 |
| `request_score` | `{submission_id}` | ≥ 0,05 NEAR (diteruskan ke OutLayer, sisa dikembalikan OutLayer ke pemanggil) | 300 Tgas | `Promise` → callback menyimpan `Status` | `no such submission`, `owner only`, `deposit: at least …`, `not requestable: status …` (hanya dari `Uploaded`, `Failed`, atau `Pending` berumur ≥ 300 blok), `task closed` | ✅ C-3 |
| `on_score` | privat (callback) | — | 15 Tgas | `Status` baru | tidak panik: callback saat status bukan `Pending` **diabaikan** (log `on_score ignored`), status lama dikembalikan | ✅ C-3 |

Alasan `Failed{reason}` dari `on_score`: `evaluator: <error dari evaluator>` (output `ok:false`), `evaluator output is not JSON: …`, `evaluator output missing a.bal_acc_bps`, `outlayer: empty output`, `outlayer: promise error …`. Setelah `Failed`, pemilik boleh `request_score` lagi. Parser menerima `a.bal_acc_bps` (ABI) **atau** `a.score_bps` (format evaluator spike S30); nilai di-clamp ke 10000. `last_outlayer_raw` menyimpan ≤ 900 byte output mentah.

Payload yang dikirim ke `outlayer.request_execution`: `source = {"WasmUrl":{"url":<evaluator_url>,"hash":<evaluator_hash>,"build_target":"wasm32-wasip2"}}`, `resource_limits = {"max_instructions":20000000000,"max_memory_mb":256,"max_execution_seconds":60}`, `input_data = {"contract":<bursa>,"submission_id":N,"task_slug":<slug>}`, `secrets_ref = {"profile":<task.secrets_profile>,"account_id":<task.secrets_account>}`, `response_format = "Text"`, `payer_account_id = <pemanggil>`. Gas: prepaid − 15 Tgas (callback) − 25 Tgas.
| `close_task` | `{task_id}` | 0 | 50 Tgas | `winner: u32` | `no such task`, `before deadline`, `already closed`, `no scored submission`. Pemenang = skor final tertinggi (`score_b_bps`, kalau tidak ada `score_a_bps`), seri → submit lebih awal, lalu id lebih kecil. Event `task_closed {task_id, winner, final_score_bps, scored, by}` | ✅ C-4 |
| `deposit_credit` | `{}` | jumlah prabayar (> 0; deposit pertama dipotong storage baris ≈ 0,001 NEAR) | 10 Tgas | saldo baru (yoctoNEAR string) | `attach a deposit`, `deposit too small for storage` | ✅ C-5 |
| `withdraw_credit` | `{amount}` | 0 | 20 Tgas | `Promise` transfer ke pemanggil | `insufficient credit: have …` | ✅ C-5 |
| `predict` | `{submission_id, features:[i64…]}` | 0 (fee `task.fee_per_call` dipotong dari kredit pemanggil → `earnings[submission]`) | 30 Tgas (model ≤ 60 KB; 197 KB ≈ 13 Tgas) | `i64` skor mentah (`> 0` ⇒ positif) | `no such submission`, `not scored: status …`, `feature count: expected N, got M`, `insufficient credit: need …`, `predict: …` | ✅ C-5 |
| `predict_task` | `{task_id, features}` | 0 | 30 Tgas | `i64` | `no such task`, `task not closed`, `no winner`, lalu seperti `predict` pada pemenang | ✅ C-5 |
| `withdraw_earnings` | `{submission_id}` | 0 | 20 Tgas | `Promise` transfer ke pemilik submission | `no such submission`, `owner only`, `nothing to withdraw` | ✅ C-5 |

Pemilik model juga membayar fee kalau memanggil modelnya sendiri (fee kembali lewat `withdraw_earnings`). Fee dipotong **sebelum** model dijalankan; kalau prediksi panik, seluruh tx dibatalkan (state dikembalikan), jadi tidak ada fee untuk panggilan gagal.

Semua method `predict*` adalah **change method** (butuh transaksi) karena dihitung; agent memanggilnya dengan **function-call key** yang hanya mengizinkan `predict_task` (dan/atau `predict`) tanpa deposit, setelah `deposit_credit` sekali dari full-access key.

## View

| Method | Argumen | Balik |
|---|---|---|
| `get_config` | `{}` | `Config` |
| `get_evaluator` | `{}` | `[url, hash]` |
| `get_task` | `{task_id}` | `Task \| null` |
| `get_task_by_slug` | `{slug}` | `Task \| null` |
| `list_tasks` | `{from, limit}` | `Task[]` |
| `get_submission` | `{submission_id}` | `Submission \| null` |
| `leaderboard` | `{task_id}` | `LeaderboardRow[]`; tugas terbuka: urut `score_a_bps` desc (belum diskor = 0, paling bawah), waktu submit asc, `score_b_bps` selalu `null`; tugas tertutup: urut skor final (B, kalau tidak ada A; bukan `Scored` = 0) desc, waktu asc, `score_b_bps` terisi. Tugas tak dikenal → `[]` |
| `get_model_bytes` | `{submission_id}` (alias `{model_id}` untuk evaluator spike) | base64 model (dibaca evaluator lewat host `view`) |
| `get_credit` | `{account_id}` | yoctoNEAR string |
| `get_earnings` | `{submission_id}` | yoctoNEAR string |
| `list_submissions` | `{task_id}` | `Submission[]` urut waktu submit |
| `validate_model` | `{task_id, bytes}` | tidak pernah panik: `{ok:true, bytes, trees, nodes, max_depth, n_features, storage_cost, submission_fee}` atau `{ok:false, error, n_features_expected?, n_features_model?}` |

Aturan struktur model yang diterima (`gbdt-core::Model::validate`): `version = 1`; `feature_scale`, `out_scale` > 0; tiap pohon 1..65534 node; node dalam punya `left`, `right` **lebih besar dari indeks node itu** dan < jumlah node (sehingga penelusuran selalu berhenti), `feature < n_features`; kedalaman < 64. `tools/export.py` menghasilkan format ini.

## Memanggil dari kontrak lain

Contoh lengkap: `contracts/consumer-example` (`credit-desk`, lihat `docs/CONSUMER.md`). Pola:
```rust
#[ext_contract(ext_bursa)]
trait Bursa { fn deposit_credit(&mut self) -> NearToken; fn predict_task(&mut self, task_id: u32, features: Vec<i64>) -> i64; }
// sekali: ext_bursa::ext(bursa).with_attached_deposit(x).deposit_credit()   → kredit atas nama KONTRAK pemanggil
// tiap keputusan:
ext_bursa::ext(bursa).with_static_gas(Gas::from_tgas(30)).predict_task(task_id, features)
    .then(Self::ext(env::current_account_id()).with_static_gas(Gas::from_tgas(10)).on_prediction(ctx))
// callback: #[callback_result] result: Result<i64, PromiseError>  → Err kalau kredit habis / tugas belum ditutup / jumlah fitur salah
```
Terukur 3 Nov: satu `screen` (desk → bursa → callback) ≈ 8,9 Tgas total.

## Event (NEP-297, `EVENT_JSON:` di log)

`standard: "bursa", version: "1.0.0"`, `event` ∈ `evaluator_set {url, hash}`, `task_created {task_id, creator, slug, deadline_ns}`, `model_submitted {submission_id, task_id, owner, bytes, trees, nodes, max_depth, storage_cost}`, `score_requested {submission_id, task_id, by, evaluator_hash}`, `model_scored {submission_id, task_id, ok, score_a_bps, f1_a_bps, status}`, `task_closed {task_id, winner}`, `prediction {submission_id, task_id, caller, owner, fee, score, label, calls}`, `credit_deposited {account, amount, balance}`, `credit_withdrawn {account, amount}`, `earnings_withdrawn {submission_id, to, amount}`.

## Kontrak dengan evaluator (E-1)

- Input stdin: `{"contract":"<bursa account>","submission_id":7,"task_slug":"german-credit"}`.
- Evaluator memanggil `view(contract, "get_model_bytes", {"submission_id":7}, "")`.
- Secret env: `TEST_SET_A`, `TEST_SET_B`. Format didukung: (1) JSON `{"rows":[[f1..fn,label],…]}` (format spike), (2) **kompak**: `{"n":18,"b64":"<base64 i16 LE, (n+1) nilai per baris>"}`.
- Output stdout ≤ 900 B: `{"ok":true,"eval_version":"1","submission_id":7,"model_bytes":…,"trees":…, "a":{"n":150,"n_pos":45,"tp":…,"tn":…,"fp":…,"fn":…,"bal_acc_bps":7050,"f1_bps":5600}, "b":{…}}` atau `{"ok":false,"submission_id":7,"error":"…"}`.
- `on_score` membaca `a.bal_acc_bps`, `a.f1_bps`, `b.bal_acc_bps`, `b.f1_bps`; selain itu disimpan mentah.
