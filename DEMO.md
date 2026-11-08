# DEMO — naskah video 3 menit, versi 8 Nov 2026 (kontrak v1.1, exhibit 05, agen otonom, quickstart)

Semua yang tampil adalah transaksi testnet asli di kontrak final **`laurel.laurel-team-mw0x0c8g.testnet`** (v1.1, code hash
`BVNELFch…`). Rekam layar 1080p, terminal font besar, browser di **https://laurel-near.vercel.app**. Narasi berbahasa Inggris
karena juri internasional; boleh diucapkan dalam bahasa Indonesia dengan subtitle Inggris. Batas video 3 menit (aturan
submit, `docs/SUBMISSION.md`).

**Cerita dalam satu kalimat:** sebuah model kecil berkompetisi di data NEAR mainnet asli, dinilai di TEE pada baris yang tidak
pernah dilihat siapa pun, dan pemenangnya menjadi method kontrak yang dipakai agen AI dan kontrak lain; peserta masuk dengan
satu perintah, dan salah satu pesertanya adalah agen AI yang bekerja sendiri.

## Keadaan situs yang harus diketahui sebelum merekam

- Pengunjung yang belum login hanya melihat **landing page**, apa pun alamatnya; landing itu sudah menampilkan hitung mundur
  exhibit 05, papan peringkat dengan kolom *Withheld*, dan tiga kartu penjelas. Explorer (`#/tasks`, `#/task/:id`,
  `#/model/:id`, `#/costs`, `#/connect`) terbuka setelah **connect wallet testnet** (tanpa transaksi). Deep link menyimpan
  hash-nya, jadi setelah login kamu mendarat di halaman yang dituju. **Login wallet sebelum mulai merekam.**
- Istilah di situs: tugas = *exhibit*, model = *specimen*, skor = *readings*; menu Exhibits / Method / Connect.
- Exhibit 05 (`near-retention`) **tutup 12 Nov 2026 11:59 UTC**. Dua versi shot 1:10 di bawah: sebelum tutup (race masih
  berjalan, pakai exhibit 03 untuk cerita menang-kalah) atau sesudah tutup (exhibit 05 sendiri sudah membuka split B).
- Komitmen tim (tertulis di `tasks/near-retention/README.md`): **tidak ada entri tim baru di task 5**, akun mana pun. Shot
  submit live memakai **task 4** (`credit-risk-open`, tutup 25 Nov).

Id yang dipakai (sudah ada di kontrak):

| Apa | Id | Keterangan |
|---|---|---|
| Exhibit data mainnet (terbuka) | **task 5** `near-retention` | 6 entri (#7–#12), semua split B *Withheld*; #7 dan #10 memimpin split A 83.50; #10 dan #12 dibuat agen otonom |
| Exhibit tertutup (cerita menang-kalah) | **task 3** `credit-risk` | #5 shallow memimpin split A (75.50) tetapi kalah di B (61.50); #4 deep menang di B (66.50) → champion |
| Exhibit untuk submit live | **task 4** `credit-risk-open` | berisi #6; akun TEAM punya 0 dari 3 entri, saldo 8.4 NEAR; ±0.33 NEAR per take, sebagian kembali |
| Champion yang dipanggil | **submission #4** | halaman `#/model/4`; `predict_task(3, …)` |
| Agen pemanggil | `agent.laurel-team-mw0x0c8g.testnet` | function-call key hanya `predict`/`predict_task`; kredit 0.079 NEAR (±79 prediksi) |
| Agen pembuat model | `maker.laurel-team-mw0x0c8g.testnet` | pemilik #10 dan #12 di task 5 |
| Kontrak konsumen | `desk3.laurel-team-mw0x0c8g.testnet` | sudah didanai; `consumer.mjs 3` memakainya |

## Siapkan sebelum rekam (±10 menit, sekali saja)

```bash
# 1. Latihan shot 0:40 tanpa mengirim apa pun (8 langkah tercetak, berhenti setelah kutipan biaya):
node tools/quickstart.mjs --task 4 --as TEAM --trees 30 --depth 3 --dry
# 2. Shot 2:00 (MCP di Claude Code). Isi env dengan kunci agen SEBELUM membuka claude, lalu daftarkan servernya:
#    PowerShell: $env:LAUREL_ACCOUNT_ID="agent.laurel-team-mw0x0c8g.testnet"; $env:LAUREL_PRIVATE_KEY="<AGENT_PRIVATE_KEY dari .env>"
#    claude mcp add laurel -- npx -y laurel-mcp        # laurel-mcp 0.2.0 di npm, 10 tool
#    Prompt yang dipakai: "Use laurel: download model 4, predict holdout row 0 of task 3 locally, then call the champion of
#    task 3 on-chain with the same features and compare the two raw scores."
# 3. Buka transkrip agen untuk shot 1:30 di editor dengan font besar: agents/out/competitor-2026-11-06T07-05-20.md
# 4. Kalau fastnear membatasi (429), RPC cadangan untuk tulis: PowerShell $env:WRITE_RPC="https://near-testnet.drpc.org"
# 5. agent.mjs / consumer.mjs menulis ulang docs/AGENT.md dan docs/CONSUMER.md: commit dulu, atau git checkout keduanya setelah rekam.
```

## Shot list

| Waktu | Layar | Narasi (EN) |
|---|---|---|
| 0:00–0:20 | Web, **landing** (`https://laurel-near.vercel.app`, boleh sebelum login): hitung mundur exhibit 05, papan dengan kolom *Public split* / *Sealed split* (*Withheld*), tiga kartu: *Submit a model as data*, *Judged inside a TEE*, *The sealed split decides* | "Small ML models live on someone else's server, and nobody can verify how good they are. On NEAR a model can be a contract: a few kilobytes of integers, ranked on a test set nobody can read, called by agents and by other contracts. This is Laurel." |
| 0:20–0:40 | Web, **exhibit 05** (`#/task/5`, sudah login): deskripsi "fresh .near account's first seven days on NEAR mainnet", papan 6 entri, tautan *The 22 features and how the data was pulled* (buka sebentar `tasks/near-retention/README.md` di GitHub: 4,407 akun dari 43,927, BigQuery public dataset) | "The current task is real NEAR data: will a brand-new account that acted in its first week still be active after day 30? Twenty-two integer features from BigQuery's public NEAR dataset. Six models compete. The leaderboard shows the public split; the sealed split stays withheld until the task closes." |
| 0:40–1:10 | Terminal: `node tools/quickstart.mjs --task 4 --as TEAM --trees 30 --depth 3` — 8 langkah bergulir: environment, saldo, task (entries left), training, export (`model.bin: 10051 bytes, 30 trees`), `validate … ok · storage 0.1045 NEAR + fee 0.1 NEAR`, dua tx `submit_model` / `request_score`, lalu `scored` dengan `bal_acc_a_bps` dan peringkat | "Entering is one command. It trains a gradient-boosted model on the public rows, exports it to the contract's integer format, asks the contract to validate the bytes and quote the cost, stores the model on-chain, and asks OutLayer to run the pinned evaluator inside a TEE on the private rows. The reading comes back in about a minute." Tunjuk baris `validate … ok` dan skor akhir. |
| 1:10–1:30 | **Sebelum 12 Nov:** Web, **exhibit 03** (`#/task/3`): race, #5 memimpin split A, segel lewat, #4 mengambil laurel di split B (tombol *Run it again*). **Sesudah 12 Nov:** Web, **exhibit 05** sendiri: kolom *Sealed split* terbuka, champion ditandai oleh kontrak | Sebelum: "This task already closed. The shallow model led on the public split, but the sealed split decided it: the deep model won, and it is now a fixed address, `predict_task(3, features)`." Sesudah: "On the 12th the contract closed the task and unsealed split B: this model is the champion of the real-data task, now `predict_task(5, features)`." |
| 1:30–2:00 | Editor, **transkrip agen** `agents/out/competitor-2026-11-06T07-05-20.md`: scroll cepat melewati `laurel_exhibit`, cross-validation yang ditulis agen sendiri, keputusan 40 pohon × depth 2, `laurel_submit_model`, `laurel_wait_score` → 8300; lalu kembali ke **exhibit 05** dan tunjuk #10 dan #12 (owner `maker.laurel-team-…`) | "Two of those six entries were not made by a person. An agent built on the Claude Agent SDK, given only Laurel's MCP tools, a sandboxed workspace with the public files and a funded account, read the exhibit, ran its own cross-validation, chose a compact model, paid the storage and the fee, entered it and waited for the TEE. It tied for the lead, then declined to spend its remaining entries because the difference would be noise. Fourteen turns, thirty-four cents." |
| 2:00–2:25 | **Claude Code dengan MCP** (`npx -y laurel-mcp`, env = kunci agen): ketik prompt dari persiapan nomor 2; tunjuk `laurel_download_model`, `laurel_predict_local` → 811014, `laurel_predict` → 811014, ±4.3 Tgas, fee 0.001 NEAR. Cadangan: `node agents/caller.mjs --task 3 --submission 4 --rows 3` | "Any agent can use the champion as a tool. This one downloads the model's bytes from the contract, runs them locally, then calls `predict_task` on-chain with a key the protocol limits to that one method. Same bytes, same number. Every call pays the model's owner." |
| 2:25–2:40 | Terminal: `node tools/consumer.mjs 3 --funder TEAM` (atau buka `docs/CONSUMER.md`): credit-desk memanggil model lewat promise, ±9 Tgas termasuk callback | "Not only agents: another contract calls the model through a cross-contract promise and pays from its own credit. One decision, about nine Tgas." |
| 2:40–2:55 | Web, **specimen #4** (`#/model/4`): satu dari 50 pohon, satu panggilan berjalan dari akar ke daun; pelat provenance. Lalu nearblocks: tx `request_score` dari shot 0:40, log `near-outlayer execution_completed` dengan hash evaluator `8b80010f…` | "Everything is checkable: the model's trees are drawn from the bytes the contract stores; the evaluator's hash is pinned in the contract, and the TEE receipt carries it. The score it returns equals the local computation bit for bit." |
| 2:55–3:00 | Web, **Method** (`#/costs`) atau README bagian *Limits* | "Testnet, small models, honest limits in the README. Everything replays from a fresh account with one script. Laurel, built at NEAR HACKATHON." |

## Catatan rekam

- Shot 0:40 adalah satu-satunya yang bergantung pada OutLayer saat rekam. Kalau `scored` lewat dari 20 detik, potong jedanya
  di editing, jangan dipercepat. Kalau gagal total (RPC 429 / worker lambat), tampilkan `#/model/6` (entri di task 4) dengan
  narasi yang sama dan coba lagi nanti dengan `WRITE_RPC` cadangan. Akun TEAM punya 3 kesempatan di task 4; `--dry` tidak
  memakai kuota.
- `quickstart.mjs` menulis `tasks/german-credit/quickstart_<stamp>.pkl` dan `.report.json` (keduanya di-ignore git) dan
  `tasks/german-credit/out/quickstart_<stamp>/` (di-ignore).
- Shot 1:30 memakai transkrip yang sudah ada; tidak perlu run agen baru saat rekam. Kalau ingin run live, `node
  agents/competitor.mjs --task 4` (bukan task 5) memakai `ANTHROPIC_API_KEY` di `.env` dan ±$0.3; durasinya 2–3 menit, jadi
  rekam terpisah dan potong.
- Shot 2:00: kredit agen 0.079 NEAR cukup untuk puluhan take. Isi ulang kalau perlu:
  `node tools/predict.mjs 3 --row 0 --as AGENT --deposit 0.05`.
- `agent.mjs` dan `consumer.mjs` aman diulang (fee 0.001 NEAR per prediksi), tetapi menulis ulang `docs/AGENT.md` /
  `docs/CONSUMER.md`; lihat persiapan nomor 5.
- Tx yang bisa ditunjuk kalau perlu (semua di testnet.nearblocks.io/txns/…): upgrade v1.1 `GU37HBpW6aXVZ57dkDacTspfPLHdsjnCnByhgbBw6uFF`;
  agen pembuat `submit_model` `HygFCbMvR1gJEaPMJ7uUh1SxuCiXR9QU9U65krZ4Yi4V` dan `request_score` `DoKU6Rn6HadWmmj1bh7bPrmQabk9iApzn1ZZoApmKoVD`;
  agen pemanggil `predict` `GAJmtrGQhzuKF13iRtraa4kgQGyn5yUDVWKJ8se75j7N`; `close_task` task 3 `Fx7k6sDCUgVoVdVpjWLqGHoxcNE3tppEs2m8YYHD5EbB`;
  beli kredit dari browser `4YHqm8GPUpv6kvMSiBzUP3UwTnhLoWp6tK3BoKrj8rfd`.
- Yang **tidak** boleh dilakukan saat rekam: entri baru di task 5 oleh akun tim mana pun; `tools/upgrade.mjs`; transaksi
  mainnet.
