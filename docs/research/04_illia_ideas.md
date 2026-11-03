# Daftar ide Illia Polosukhin — pemetaan ke hasil spike (2026-10-28)

Sumber: post X Illia (x.com/ilblackdragon/status/2106269343881519444), teks ditempel oleh tim 28 Okt. Dari ID post, perkiraan tanggal posting ≈ 2 Okt 2026 — jadi semua peserta sudah melihatnya ±4 minggu. Ringkasan di bawah memakai kata-kata kita sendiri.

Pesan utama Illia: membangun di NEAR sudah mudah; yang menentukan adalah **apa yang dibangun dan bagaimana mendapat distribusi**.

## 1. Pemetaan + skor (aturan skor sama dengan IDEAS.md)

Judge Fit sekarang boleh > 5 untuk ide di daftar ini: juri bernama (Illia) + bukti tertulis. Uniqueness diturunkan karena daftar ini publik.

| # | Ide Illia (ringkas) | Spike yang menopang | Belum di-spike | F | U | D | J | R | B | Total |
|---|---|---|---|---|---|---|---|---|---|---|
| 6 | **Registrasi event ber-escrow (gaya Kickback)**: tamu setor dana, host check-in, yang hadir membagi setoran yang tidak hadir; lintas chain & aset | S13 kontrak sendiri ✅, S14 USDC ✅, S10 gasless ✅, S7 key terbatas untuk scanner host ✅, S6a quote 1Click ✅ | Setor dari chain lain lewat widget Aurora (opsional) | 8 | 5 | 8 | 8 | 8 | 6 | **43** |
| 1 | **AI Tamagotchi**: karakter = NFT berisi NEAR yang membayar inferensinya sendiri di NEAR AI; feeding, dressing, arena | S13 NFT/MT ✅, S5a atestasi ✅, S9 OutLayer ✅ | **S5b inferensi NEAR AI (butuh API key + kredit)** | 5* | 7 | 9 | 9 | 5 | 6 | **41** (≈43 jika S5b lolos) |
| 2 | **Universal checkout widget** untuk merchant (bayar dari chain/wallet apa pun via Intents, target Shopify) | S6a ✅, S14 ✅; widget Aurora sudah ada (lihat §3) | Eksekusi Intents nyata (⚠️ S6), app Shopify | 7 | 4 | 6 | 8 | 8 | 8 | **41** |
| 4 | **Pasar OTC privat** memakai "private deals" NEAR Intents (cari lawan transaksi, isi lewat Intents) | S6c ✅ (intent bertanda tangan diterima verifier) | **API private deals / Confidential Intents** | 4* | 8 | 6 | 9 | 7 | 7 | **41** |
| 11 | **Second opinion medis privat** (E2EE ke NEAR AI; prompt khusus sebagai NFT) | S13 ✅, S14 ✅, skrip S5b siap (SDK E2EE) | **S5b** | 5* | 6 | 7 | 8 | 7 | 5 | **38** |
| 3 | **Ensiklopedia AI + prediction market** per fakta (gaya Augur) | — | Kontrak market + resolusi | 4* | 9 | 7 | 8 | 5 | 5 | **38** |
| 10 | **Copy-trade privat**: jual viewing key posisi Confidential Intents, PnL publik | — | Viewing key Confidential Intents | 3* | 8 | 6 | 8 | 5 | 7 | **37** |
| 12 | **"Granola" privat**: transkripsi rapat di NEAR AI, data tetap di user, bayar via staking | — | Model audio NEAR AI, app desktop | 4* | 6 | 6 | 7 | 7 | 6 | **36** |
| 7 | **Code review privat** di NEAR AI | — | — | 6 | 2 | 6 | 8 | 7 | 6 | **35** |
| 13 | **Benchmark AI dengan test set privat** | — | Hosting model/harness di TEE | 3* | 8 | 5 | 7 | 6 | 6 | **35** |
| 5 | **"Never get liquidated"** (kelola posisi lending/perp via Intents) | — | Integrasi lending/perp, dana nyata | 3* | 6 | 5 | 7 | 7 | 7 | **35** |
| 8 | **Cap table perusahaan** + instrumen penggalangan dana | — | Aspek legal, perbankan | 4* | 5 | 4 | 6 | 7 | 7 | **33** |
| 9 | **Delta neutral anything** (spot + perp dikelola kontrak via Intents) | — | Perp via Intents, dana nyata | 3* | 5 | 4 | 7 | 6 | 7 | **32** |

F = Feasibility, U = Uniqueness, D = Demo Power, J = Judge Fit, R = Real-World Value, B = Business Viability. `*` = dibatasi aturan (dependensi inti belum di-spike).

## 2. Sinyal persaingan (GitHub, repo dibuat sejak 15 Sep 2026)

- Hampir semua ide di daftar: **0 repo publik** (tamagotchi, kickback/escrow event, checkout Intents, OTC, cap table, delta neutral, copy trading). Sinyal lemah — tim yang taat aturan baru mulai 1 Nov.
- **Code review privat sudah dibangun dengan matang**: `MultiAgency/private-ai` ("Private Investigator") — GitHub App, review di enclave TEE, tanda tangan per jawaban, receipt yang bisa dicek, eval bug. Dibuat 4 Okt, aktif 27 Okt. → coret ide #7.
- Kickback asli (Ethereum) ditutup 2023; Unlock Protocol punya fitur serupa ("I'm Going!") di EVM. Di NEAR / lintas chain belum ada.
- Asumsi: karena daftar ini publik, ide yang paling mudah (#6) dan paling seru (#1) akan dipilih banyak tim. Pembeda harus datang dari eksekusi + distribusi nyata.

## 3. Saran distribusi Illia → yang bisa kita pakai

| Saran | Artinya untuk kita |
|---|---|
| Libatkan NEAR Legion | Rekrut pengguna awal / peserta uji dari komunitas NEAR Legion |
| Dukung semua wallet lewat Aurora (Intents Connect) | Paket npm sudah ada: `@aurora-is-near/intents-swap-widget` 7.27.1 (update 26 Okt; komponen Widget, WidgetDeposit, WidgetWithdraw; memakai 1Click) dan `@aurora-is-near/intents-connect-sdk` 1.1.0. Perlu spike baru (**S18: widget deposit Aurora**) |
| Cross-pollination komunitas | Mis. komunitas kampus/kripto Indonesia |
| Product Hunt dan sejenisnya | Rencanakan launch PH di minggu ke-2 |
| X | Post demo wajib (aturan submission) + thread build-in-public |

## 4. Dampak ke IDEAS.md

- **Arisan DAO** ↔ ide #6 (event escrow): sama-sama "uang komunitas yang dititipkan", tapi #6 lebih sederhana dan ada di daftar Illia → #6 menggantikan Arisan sebagai pilihan aman.
- **Tagih** ↔ ide #2 (checkout): Judge Fit naik, tapi widget Aurora + PingPay/HOT Pay membuat Uniqueness rendah.
- **Vault Card** ↔ ide #1 dan #4: "NFT berisi NEAR yang membayar inferensinya sendiri" adalah bentuk sederhana dari Vault Card; Vault Card bisa jadi pembeda di dalam Tamagotchi (peliharaan punya dompet lintas chain sendiri) atau di pasar OTC.
- **Uang Saku Agent**: tidak ada di daftar; track tetap ramai.

## 5. Spike baru yang dibutuhkan (jadwal 1 Nov, kecuali tim memutuskan lain)

- **S5b** NEAR AI inferensi + verifikasi tanda tangan — skrip siap, butuh `NEAR_AI_API_KEY` + kredit (pendaftaran dilakukan manusia).
- **S18** widget deposit Aurora (bayar dari chain lain ke kontrak kita).
- **S19** (hanya jika memilih #4/#10) API private deals / viewing key Confidential Intents.
