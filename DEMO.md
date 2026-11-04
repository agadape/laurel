# DEMO — naskah video 3 menit (D-3)

Semua yang tampil adalah transaksi testnet asli. Rekam layar 1080p; terminal font besar; browser di https://laurel-near.vercel.app (UI berbahasa Inggris: Tasks / Costs & how it works). Siapkan sebelum rekam: tugas baru `german-credit-demo` dengan deadline 4 menit (`node tools/create_task.mjs german-credit --minutes 4 --secrets-account nh-spike-mvp62mw4.testnet --profile german-credit --as TEAM --slug-override german-credit-demo`), model `deep` dan `shallow` sudah diekspor, agent sudah punya kredit.

| Waktu | Layar | Ucapan (ID) |
|---|---|---|
| 0:00–0:20 | Halaman Tugas di web | "Model machine learning biasanya hidup di server orang lain. Di NEAR, model bisa jadi kontrak: dipanggil agent dan kontrak lain, dan mutunya diuji di benchmark privat yang tidak bisa dibaca siapa pun. Ini Laurel: model yang memenangkan sayembara, melayani on-chain." |
| 0:20–0:50 | Terminal: `node tools/submit.mjs <id> tasks/german-credit/out/deep/model.bin --as TEAM` | "Peserta melatih model risiko kredit di data publik, mengekspornya jadi pohon keputusan integer 33 KB, dan mengirimnya ke kontrak. Kontrak memvalidasi strukturnya, lalu meminta OutLayer menjalankan evaluator di TEE." Tunjuk `scored in ~10 s` dan `bal_acc_a_bps`. |
| 0:50–1:10 | Terminal: submit `shallow` sebagai akun kedua; lalu web Leaderboard | "Model kedua masuk. Di leaderboard sementara model dangkal justru unggul di split A…" |
| 1:10–1:30 | Terminal: `node tools/close_task.mjs <id> --wait` → web Leaderboard (closed) | "…tapi setelah deadline, split B yang baru dibuka memutuskan: model dalam menang. Pemenang jadi alamat tetap `predict_task(id, fitur)`." |
| 1:30–2:05 | Terminal: `node tools/agent.mjs <id> --rows 5` | "Agent ini hanya memegang function-call key: boleh `predict_task`, tidak boleh yang lain. Lima pemohon, ±4,3 Tgas per panggilan, fee masuk ke pemilik model." Tunjuk 4 baris `[rejected]`: "Protokol NEAR sendiri yang menolak `withdraw_credit`, deposit, kontrak lain, transfer." |
| 2:05–2:30 | Terminal: `node tools/consumer.mjs <id> --funder TEAM` atau tunjukkan docs/CONSUMER.md | "Bukan cuma agent: kontrak lain pun memanggilnya lewat promise dan membayar dari kreditnya sendiri. Satu keputusan ±9 Tgas termasuk callback." |
| 2:30–2:50 | Web: halaman Model #pemenang (output evaluator, hash evaluator terpin) | "Yang menilai model adalah evaluator yang hash-nya dipin di kontrak; secret test set hanya terbuka untuk hash itu. Skor dari TEE sama persis dengan hitungan lokal." |
| 2:50–3:00 | Halaman Biaya | "Dataset ini simulasi, bukan alat kredit. Repo berisi e2e dari nol yang bisa dijalankan juri dalam 6 menit. Laurel, dibangun di NEAR HACKATHON." |

Catatan rekam: jalankan `tools/submit.mjs` untuk `shallow` dengan `--as P1` (akun kedua) agar pemilik berbeda; kalau OutLayer lambat (> 20 s), potong jeda di editing, jangan dipercepat.
