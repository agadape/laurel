# Tugas demo 1: risiko kredit (UCI German Credit) — simulasi

> Ini **demonstrasi mekanisme** "model menjadi infrastruktur keputusan on-chain". Dataset ini berasal dari Jerman tahun 1973–1975 dan tidak boleh dipakai untuk menilai kelayakan kredit orang sungguhan. Lihat *Batasan dan bias* di bawah.

Status (3 Nov 2026): **data dan pipeline jadi.** `split.py` menghasilkan file publik + privat + [private_manifest.json](private_manifest.json) (sha256 file privat; 0 baris identik antara privat dan publik). `train.py` melatih baseline; `tools/export.py --task german-credit` mengonversi ke `model.bin`. Secret privat tersimpan di OutLayer terikat ke evaluator v1 (lihat `docs/EVALUATOR.md`). Spesifikasi yang dibaca mesin ada di [features.json](features.json).

Model contoh (dilatih hanya pada `public_train.csv`, dievaluasi di split privat lewat OutLayer, 3 Nov):

| Model | Perintah | Byte | Holdout publik (bal. acc.) | Privat A | Privat B |
|---|---|---|---|---|---|
| deep | `train.py --trees 50 --depth 4` | 33.011 | 0,688 | 7100 bps | 6650 bps |
| shallow | `train.py --trees 10 --depth 2 --out model_weak.pkl` | 1.611 | 0,741 | 7550 bps | 6150 bps |

Holdout publik hanya 100 baris, jadi peringkatnya berisik; split privat B yang menentukan pemenang.

## Sumber

- UCI Machine Learning Repository, *Statlog (German Credit Data)*, id 144 — https://archive.ics.uci.edu/dataset/144/statlog+german+credit+data. Donor: Hans Hofmann (1994). 1.000 baris, 20 atribut, tanpa nilai kosong.
- Lisensi di halaman UCI: **CC BY 4.0** (dicek 2 Nov 2026). Atribusi: "Hofmann, H. (1994). Statlog (German Credit Data). UCI Machine Learning Repository."
- File yang dipakai: `german.data` (kode kategori `A11…A202`, label kolom ke-21). File `german.data-numeric` tidak dipakai supaya pengodean kita eksplisit dan dapat diaudit.

## Label

| UCI | Arti | Label kita | Peran |
|---|---|---|---|
| `1` | good credit risk | **`0`** | kelas negatif |
| `2` | bad credit risk | **`1`** | **kelas positif** (yang ingin dideteksi) |

Distribusi: 700 good / 300 bad. Skor mentah dari `predict`/`predict_task` adalah log-odds × 10⁶; **skor > 0 ⇒ bad**.

## Fitur (18, urutan tetap)

Dua atribut UCI **dibuang**: `personal_status_sex` (atribut 9, A91–A95) dan `foreign_worker` (atribut 20, A201–A202), karena sensitif. `age_years` tetap dipakai dan diakui sebagai risiko bias usia.

| pos | nama | asal UCI | tipe | pengodean |
|---|---|---|---|---|
| 0 | `checking_status` | attr 1 | ordinal | A11→0 (< 0 DM), A12→1, A13→2, A14→3 (tanpa rekening) |
| 1 | `duration_months` | attr 2 | integer | apa adanya |
| 2 | `credit_history` | attr 3 | ordinal | A30→0 … A34→4 |
| 3 | `purpose` | attr 4 | nominal sebagai kode | A40→0, A41→1, …, A49→9, A410→10 |
| 4 | `credit_amount_dm` | attr 5 | integer | apa adanya (Deutsche Mark) |
| 5 | `savings` | attr 6 | ordinal | A61→0 … A65→4 |
| 6 | `employment_since` | attr 7 | ordinal | A71→0 … A75→4 |
| 7 | `installment_rate_pct` | attr 8 | integer | 1–4 |
| 8 | `other_debtors` | attr 10 | nominal sebagai kode | A101→0, A102→1, A103→2 |
| 9 | `residence_since_years` | attr 11 | integer | 1–4 |
| 10 | `property` | attr 12 | ordinal | A121→0 … A124→3 |
| 11 | `age_years` | attr 13 | integer | apa adanya |
| 12 | `other_installment_plans` | attr 14 | nominal sebagai kode | A141→0, A142→1, A143→2 |
| 13 | `housing` | attr 15 | nominal sebagai kode | A151→0, A152→1, A153→2 |
| 14 | `existing_credits` | attr 16 | integer | 1–4 |
| 15 | `job` | attr 17 | ordinal | A171→0 … A174→3 |
| 16 | `num_dependents` | attr 18 | integer | 1–2 |
| 17 | `telephone` | attr 19 | biner | A191→0, A192→1 |

Arti setiap kode ada di [features.json](features.json). Semua fitur integer → `feature_scale = 1`: nilai dikirim ke kontrak **apa adanya**, tanpa pembulatan. Pohon keputusan menangani kode nominal sebagai integer; ini keterbatasan yang disengaja agar format model tetap satu.

## Pembagian data (reproducible)

`split.py` (ML-2) mengunduh `german.data`, mengodekan 18 fitur, lalu membagi secara **stratified menurut label** dengan `random_state = 144` dalam dua tahap `train_test_split`:

| File | Baris | good/bad | Untuk siapa | Di repo? |
|---|---|---|---|---|
| `public_train.csv` | 600 | 420/180 | peserta melatih | ya |
| `public_holdout.csv` | 100 | 70/30 | peserta memvalidasi sendiri; sumber `vectors.json` dan 10 pemohon simulasi agent | ya |
| `private_a.json` | 150 | 105/45 | leaderboard sementara (evaluator) | **tidak** (gitignored) |
| `private_b.json` | 150 | 105/45 | peringkat final saat `close_task` | **tidak** (gitignored) |
| `private_manifest.json` | — | — | sha256 + jumlah baris/kelas tiap file privat (komitmen) | ya |

Format file privat untuk secret OutLayer: `{"n":18,"b64":"<base64 dari i16 little-endian, 19 nilai per baris (18 fitur + label)>"}` (≈ 7,6 KB per split). Evaluator juga menerima format JSON `{"rows":[[…,label]]}` dari spike.

Pemeriksaan anti-tumpang-tindih: `split.py` menghitung hash setiap baris dan memastikan tidak ada baris privat yang muncul di file publik.

## Metrik

- **Utama: balanced accuracy** dalam basis poin: `bal_acc_bps = (correct_bad·10⁴/n_bad + correct_good·10⁴/n_good) / 2`, aritmetika integer, pembulatan ke 50 bps. Alasan: kelas 70/30; "semua good" sudah 70% akurasi biasa.
- **Pendamping: F1 kelas bad**: `f1_bps = 2·TP·10⁴ / (2·TP + FP + FN)`. Ditampilkan, tidak dipakai untuk peringkat.
- Matriks biaya UCI (bad→good = 5, good→bad = 1) **tidak** dipakai; disebut sebagai referensi.

## Model yang didukung

GBDT biner (`gbdt-core` v1): pohon dengan ambang integer, nilai daun log-odds × 10⁶, `bias` = log-odds prior. Baseline rencana: 50 pohon × kedalaman 4 dengan `sample_weight` bad ≈ 2,33 (≈ 1.500 node ≈ 34 KB). Batas demo **60 KB**; batas kontrak 250 KB / 500 pohon. Exporter mendukung `--bias-shift` untuk menyetel ambang keputusan.

## Use case demo (simulasi)

`tools/agent.mjs` memuat 10 pemohon dari `public_holdout.csv`, memanggil `predict_task(task_id, features)` dengan function-call key, dan mencetak keputusan simulasi: skor ≤ 0 → "beri tempo bayar 30 hari", skor > 0 → "minta uang muka". Hanya ilustrasi.

## Batasan dan bias (wajib disalin ke README utama)

1. **Data lama dan asing:** Jerman Selatan, 1973–1975, nilai dalam DM. Tidak mewakili pemohon masa kini, apalagi Indonesia.
2. **Atribut sensitif:** dataset ini benchmark standar riset *fairness* karena memuat jenis kelamin/status perkawinan, kewarganegaraan, dan usia. Dua kami buang; usia tetap dipakai dan dapat menimbulkan bias usia.
3. **Dokumentasi asli keliru:** Grömping (2019, "South German Credit (UPDATE)") menunjukkan kesalahan pengodean beberapa atribut dalam dokumentasi UCI. Kami memakai kamus UCI apa adanya untuk reproduktibilitas dan menyebut koreksi itu sebagai referensi.
4. **Kebocoran yang tidak bisa dicegah:** dataset publik penuh; peserta dapat melatih pada 1.000 baris termasuk baris privat kami. Split privat melindungi dari overfitting lewat umpan balik leaderboard, bukan dari pengunduhan data asli. Benchmark produksi memerlukan data privat sungguhan.
5. **Bukan alat kredit:** keluaran model tidak boleh dipakai untuk keputusan terhadap orang. Ini demonstrasi infrastruktur.
