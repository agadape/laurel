# DEMO — naskah video 3 menit (D-3), versi kontrak final (4 Nov)

Semua yang tampil adalah transaksi testnet asli di kontrak final **`laurel.laurel-team-mw0x0c8g.testnet`**. Rekam layar 1080p, terminal font besar, browser di **https://laurel-near.vercel.app** (UI bahasa Inggris, arah visual `docs/UI_DIRECTION.md`: pengunjung yang belum login melihat landing page, explorer terbuka setelah login wallet testnet, jadi login dulu sebelum merekam; menu Exhibits / Method; tugas = *exhibit*, model = *specimen*, skor = *readings* pada skala split A dan B). Narasi di bawah berbahasa Inggris karena juri internasional; boleh diucapkan dalam bahasa Indonesia dengan subtitle Inggris.

Id yang dipakai (sudah ada di kontrak, tidak perlu dibuat ulang):

| Apa | Id | Keterangan |
|---|---|---|
| Tugas demo (tertutup) | **task 3** `credit-risk` | pemenang submission #4 (deep, split B 66.50 %); #5 shallow unggul di split A (75.50 %) tapi kalah di B (61.50 %) |
| Tugas terbuka | **task 4** `credit-risk-open` | berisi submission #6; terbuka sampai 25 Nov 2026 23:59 UTC; di sini kita submit model baru secara live |
| Model pemenang | **submission #4** | halaman `#/model/4` |
| Agent | `agent.laurel-team-mw0x0c8g.testnet` | FC key hanya `predict_task`/`predict`, kredit sudah terisi |
| Kontrak konsumen | `desk3.laurel-team-mw0x0c8g.testnet` | sudah dideploy dan didanai; `consumer.mjs 3` memakainya lagi |

## Siapkan sebelum rekam (±10 menit, sekali saja)

```bash
# 1. model "peserta baru" untuk shot live: latih dengan parameter beda supaya skornya beda dari #6
python tasks/german-credit/train.py --trees 30 --depth 3
python tools/export.py --task german-credit --model tasks/german-credit/model_baseline.pkl --out tasks/german-credit/out/demo
# 2. shot MCP (1:35): Claude Code membaca .mcp.json di repo ini otomatis; isi env dengan kunci agent SEBELUM membuka claude:
#    PowerShell: $env:LAUREL_ACCOUNT_ID="agent.laurel-team-mw0x0c8g.testnet"; $env:LAUREL_PRIVATE_KEY="<AGENT_FC_PRIVATE_KEY dari .env>"
#    lalu di Claude Code: "Use laurel: download model 4, predict holdout row 0 locally, then call the champion of task 3 on-chain with the same features"
#    kredit agent tersisa ±0,03 NEAR (±30 prediksi); isi ulang: node tools/predict.mjs 3 --row 0 --as AGENT --deposit 0.05
# 3. kalau fastnear membatasi (429), pakai RPC cadangan untuk tulis:
#    set WRITE_RPC=https://near-testnet.drpc.org   (PowerShell: $env:WRITE_RPC="https://near-testnet.drpc.org")
```

`submit.mjs` memanggil `validate_model` (view, gratis) sebelum mengirim, jadi model yang salah ditolak tanpa biaya.

## Shot list

| Waktu | Layar | Narasi (EN) |
|---|---|---|
| 0:00–0:20 | Web, halaman **Exhibits** (`https://laurel-near.vercel.app/#/`) — hero menggambar 50 pohon model #4 dari byte on-chain; indeks memperlihatkan exhibit 03 *closed* dan 04 *open* | "Small ML models usually live on someone else's server, and nobody can verify how good they are. On NEAR a model can be a contract: called by agents and by other contracts, ranked on a private benchmark nobody can read. This is Laurel." |
| 0:20–0:55 | Terminal: `node tools/submit.mjs 4 tasks/german-credit/out/demo/model.bin --as TEAM` | "A participant trains a credit-risk model on public data, exports it as a 30-tree integer decision forest, and submits it to the open task. The contract validates the structure, then asks OutLayer to run the pinned evaluator inside a TEE against the private test set." Tunjuk `validate_model -> {"ok":true`, lalu `scored in ~10000 ms` dan `bal_acc_a_bps`. |
| 0:55–1:10 | Web, **exhibit 04** (`#/task/4`) — reload: jarum baru muncul di skala split A; skala split B masih berpita *sealed*. Lalu buka tx `request_score`-nya di nearblocks (tautan dari output terminal) dan tunjuk log `near-outlayer execution_completed` dengan hash evaluator `8b80010f…` | "Here it is on the provisional leaderboard. Split B stays hidden until the task closes, so nobody can overfit to the final score." |
| 1:10–1:35 | Web, **exhibit 03** (`#/task/3`) — dua skala: jarum #5 di depan pada split A, jarum #4 (champion, oranye) di depan pada split B yang sudah terbuka; pelat spesimen di bawahnya | "This task already closed. The shallow model led on split A, but the hidden split B decided it: the deep model won. The winner is now a fixed address, `predict_task(3, features)`." |
| 1:35–2:05 | **Claude Code dengan MCP** (`claude mcp add laurel -- npx -y laurel-mcp`, env `LAUREL_ACCOUNT_ID`/`LAUREL_PRIVATE_KEY` = agent FC key): ketik "Use laurel: download model 4, predict holdout row 0 locally, then call the champion of task 3 on-chain with the same features and compare" | "Any AI agent can use the champion as a tool. This one downloads the model's bytes from the contract, runs them locally, then calls `predict_task` on-chain with a function-call key that may do nothing else. Same bytes, same number: 811014, about 4.3 Tgas, fee to the model owner." Cadangan kalau MCP rewel saat rekam: `node tools/agent.mjs 3 --rows 5 --funder TEAM` dan tunjuk 4 baris `[rejected]`. |
| 2:05–2:30 | Terminal: `node tools/consumer.mjs 3 --funder TEAM` (atau buka `docs/CONSUMER.md`) | "Not only agents: another contract, credit-desk, calls the model through a cross-contract promise and pays from its own credit. One decision, about 9 Tgas including the callback." |
| 2:30–2:45 | Web, **Connect** (`#/connect`), wallet testnet sudah masuk: klik **Buy credit** 0.05 NEAR, setujui di wallet, saldo kredit naik | "Using a model is a purchase in NEAR: prepay credit from your wallet, give your agent a key that can only spend it on predictions, and every call pays the model's owner." |
| 2:45–2:55 | Web, **specimen #4** (`#/model/4`): 50 pohon tergambar, pelat confusion, provenance, in service | "The scorer is an evaluator whose hash is pinned in the contract; the secret test set opens only for that hash. The TEE score equals the local computation bit for bit." |
| 2:55–3:00 | Web, **Method** (`#/costs`) | "The dataset is a 1994 simulation, not a credit tool. The repo contains an end-to-end run from a fresh account that a judge can replay in six minutes. Laurel, built at NEAR HACKATHON." |

## Catatan rekam

- Urutan shot sengaja: submit live ke **task 4** (terbuka), cerita menang-kalah di **task 3** (sudah tertutup). Tidak ada deadline yang harus ditunggu saat rekam.
- Shot 0:20 adalah satu-satunya yang bergantung pada OutLayer. Kalau `scored in` lewat dari 20 detik, potong jedanya di editing, jangan dipercepat. Kalau gagal total (RPC 429 / worker lambat), ganti dengan halaman `#/model/6` (submission deep di task 4) dan ucapkan narasi yang sama; coba lagi nanti dengan `WRITE_RPC` cadangan.
- `agent.mjs` dan `consumer.mjs` aman diulang berapa kali pun (hanya fee 0,001 NEAR per prediksi); keduanya menulis ulang `docs/AGENT.md` / `docs/CONSUMER.md`, jadi **commit dulu** sebelum take, atau `git checkout docs/AGENT.md docs/CONSUMER.md` setelah rekam kalau tidak ingin hash di dokumen berubah.
- Kuota submit 3 per akun per tugas: akun TEAM punya 3 kesempatan di task 4 untuk take ulang shot 0:20. Biaya per submit ±0,35 NEAR (storage + fee + deposit skor, sebagian kembali).
- Tx yang bisa ditunjuk kalau perlu: `close_task` task 3 `Fx7k6sDCUgVoVdVpjWLqGHoxcNE3tppEs2m8YYHD5EbB`, `predict_task` pertama oleh agent `C4zYEtAHPhJJChZJdVAqMwMb8AZsd4HSmSzZZFYgbpn7`, deploy + `new` `4ThoX7csa7GsmJCAA4V4CgNbaMEepqoHvG6jUfVuVZNf`.
