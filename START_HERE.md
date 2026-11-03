# START HERE — NEAR HACKATHON, project ke-2: **Laurel**

> **Status 3 Nov 2026:** ide dipilih (**Laurel**, nama kerja Bursa Model; `docs/NAMING.md`), kontrak + evaluator + tools + web sudah jadi dan terbukti end-to-end di testnet (`docs/E2E.md`). Baca [README.md](README.md) (produk, cara coba), [PLAN.md](PLAN.md) (status per milestone), [CLAUDE.md](CLAUDE.md) (aturan kerja). Yang tersisa: akun tim + faucet → `node tools/deploy_final.mjs`, video (`DEMO.md`), repo publik, submit (`docs/SUBMISSION.md`). Dokumen di bawah ini adalah konteks awal (riset + spike) dan tetap berlaku.

Folder ini adalah titik mulai **project kedua** tim untuk NEAR HACKATHON. Isinya hasil spike dan riset dari project pertama, tanpa rencana produk project pertama.

- **Project 1 (Undo, "Ctrl+Z untuk uang kripto")** ada di `C:\Project_Dave\NEAR_Hackathon` — track `privacy` + `realworld`. Jangan diubah dari sini.
- **Deadline:** Sabtu 14 Nov 2026 23:59 UTC (= Minggu 15 Nov 06:59 WIB). Repo harus publik sebelum itu. Penjurian mulai 16 Nov.
- **Aturan lengkap:** [HACKATHON.md](HACKATHON.md) (salinan 26 Okt; versi live di https://nearhackathon.com/HACKATHON.md — baca ulang sebelum submit).

## ⚠️ Aturan dua project (dikoreksi 2 Nov)

HACKATHON.md versi 2 Nov: *"One submission per project"*. Satu email boleh **2 submission** untuk project yang independen, dan **README masing-masing harus menyebut project yang lain** (Q-015). Tiap repo hanya bisa disubmit sekali. Jadi tim yang sama boleh mengirim Undo dan project ini; yang wajib adalah repo terpisah, nama berbeda, dan saling disebut di README. (Versi HACKATHON.md 26 Okt yang menulis "one submission per team" sudah usang; ambil ulang versi live sebelum submit.)

## Isi folder

| Path | Isi |
|---|---|
| [SPIKE_LOG.md](SPIKE_LOG.md) | Log 20+ spike (S0–S22): apa yang dicoba, hasil, tx hash, gotcha. **Sumber utama "apa yang sudah terbukti jalan".** |
| [spikes/](spikes/) | Skrip spike Node (`near-api-js` 7.4) + `lib.mjs` (helper akun/RPC). Dependency sudah terpasang (`npm ci`). |
| [spikes/out/](spikes/out/) | Output mentah tiap spike (bukti). |
| [spikes/contracts/](spikes/contracts/) | Workspace Rust: FT (NEP-141), NFT (NEP-171/177/178/181), MT (NEP-245) + wasm siap deploy. |
| [spikes/contracts-undo/](spikes/contracts-undo/) | Workspace Rust dari project 1: `undo-token` (S20, versi spike) dan `s22-verifier` (verifikasi tanda tangan NEAR AI TEE + dekripsi putusan on-chain, S21/S22) + wasm. |
| [docs/research/](docs/research/) | Riset: intel hackathon, tech partner, narasi, ide Illia, juri di X, pesaing live (213 repo), primitive baru NEAR, pola pemenang. |
| [docs/research/10_ideas_v1_project1.md](docs/research/10_ideas_v1_project1.md), [docs/research/11_ideas_v2_project1.md](docs/research/11_ideas_v2_project1.md) | Skor ide dari project 1 (dulunya `IDEAS.md` / `IDEAS_V2.md`). Berguna untuk memilih ide project ini. |
| `.env` | Kunci testnet + `NEAR_AI_API_KEY` (disalin dari project 1, gitignored). Daftar key ada di [.env.example](.env.example). |

Tidak disalin: `PLAN_UNDO.md` dan `PLAN_VAULT_CARD.md` (rencana khusus project 1, ada di folder project 1 kalau perlu referensi).

## Yang sudah terbukti di testnet (ringkas)

Detail, tx hash, dan biaya ada di [SPIKE_LOG.md](SPIKE_LOG.md).

- **Akun:** akun testnet gratis 10 NEAR tanpa CAPTCHA (S3a); transfer + function call ~2,5 dtk (S3b).
- **Kunci agent:** sub-account, function-call key dengan whitelist method, revoke instan, **gas key** dengan saldo sendiri (S7).
- **DAO:** Sputnik DAO create → proposal → vote → payout NEAR/USDC, ~15 dtk (S8, S14).
- **Stablecoin:** `usdc.fakes.testnet` mint bebas (S14); **pembayaran USDC gasless** lewat meta-tx + relayer sendiri, saldo NEAR pembayar tidak berubah (S10).
- **Kontrak sendiri:** FT/NFT/MT dibangun di WSL < 1 menit dan di-deploy (S13).
- **Chain Signatures:** sign EVM + Solana ~6 dtk, alamat turunan cocok (S4; broadcast belum, karena tidak ada dana faucet).
- **NEAR Intents:** quote 1Click (mainnet, dry) dan intent bertanda tangan divalidasi verifier mainnet lewat `simulate_intents` tanpa dana (S6a, S6c).
- **Off-chain compute:** OutLayer menjalankan wasm dengan secret, hasilnya masuk tx yang sama, ~0,002 NEAR (S9).
- **NEAR AI TEE:** attestation dicek tanpa API key (S5a); chat E2EE ke model TEE, tanda tangannya diverifikasi **dan putusannya didekripsi di kontrak** (~2,4 Tgas, S21/S22).
- **Undo token:** transfer dengan jendela undo + pembalikan lewat vote DAO (S20 — inti project 1).

**Belum terbukti (butuh manusia):** broadcast Chain Signatures (perlu dana faucet, S4), eksekusi NEAR Intents sungguhan (perlu wallet mainnet berisi, S6b), social login (S11), wallet connect di browser (S12). **NEAR Intents tidak ada di testnet** (S1b).

## Akun testnet (saldo dicek 2 Nov 2026)

| Akun | Saldo | Catatan |
|---|---|---|
| `nh-spike-mvp62mw4.testnet` (utama) | ~2,36 NEAR | **Dipakai bersama project 1** (kunci yang sama). |
| `agent.nh-spike-mvp62mw4.testnet` | ~0,40 NEAR | + 15 USDC, token spike, NFT, MT. |
| `user.nh-spike-mvp62mw4.testnet` | ~0,003 NEAR | 17 USDC; untuk demo gasless. |
| `nh-ft-…`, `nh-nft-…`, `nh-mt-…`, `nh-undo-…`, `nh-s22-…`, `nh-s21-…` | ~10 NEAR masing-masing | Kontrak spike yang sudah live. |

Saran: buat **akun utama baru** khusus project ini (10 NEAR gratis dari faucet, lihat `spikes/s3_create_account.mjs`) dan simpan dengan nama key sendiri, misalnya `P2_ACCOUNT_ID` / `P2_PRIVATE_KEY`. Dengan begitu dua tim tidak berebut saldo atau nonce. `s3_create_account.mjs` menolak jalan kalau `NEAR_ACCOUNT_ID` sudah ada di `.env`, jadi sesuaikan dulu.

## Cara pakai

```bash
cd spikes
node s3b_transfer_call.mjs        # contoh: transfer + function call di testnet
node s6c_simulate_intents.mjs     # contoh: validasi intent di verifier mainnet, gratis
```

Build kontrak Rust (di WSL, dari Git Bash):

```bash
MSYS_NO_PATHCONV=1 wsl.exe --exec bash spikes/contracts/build.sh
```

`s21a_e2ee_call.mjs` memanggil NEAR AI berbayar dan sengaja menolak jalan ulang (hasilnya sudah ada di `spikes/out/s21_raw.json`).

## Gotcha terpenting

Daftar lengkap ada di kolom "Gotcha" [SPIKE_LOG.md](SPIKE_LOG.md). Yang paling sering menjebak:

1. Pakai RPC fastnear (~0,3 dtk), bukan `rpc.*.near.org` (~3 dtk).
2. `account.callFunction` mengembalikan nilai, bukan tx; pakai `signAndSendTransaction` kalau butuh hash.
3. `FailoverRpcProvider` mengulang error deterministik 3× lalu menampilkan `RetriesExceeded`; lihat error di dalamnya.
4. Penerima FT harus `storage_deposit` dulu; `ft_transfer` butuh tepat 1 yocto. Token dari contract-tools: daftarkan dengan ≥ 0,01 NEAR.
5. `ft_transfer_call` ke Sputnik DAO dikembalikan penuh; isi kas DAO dengan `ft_transfer` biasa.
6. Satu kontrak mengunci ~1,6–2,3 NEAR storage; deploy ke akun faucet baru.
7. Chain Signatures testnet: `v1.signer-prod.testnet` (bukan `v1.signer.testnet`).
8. Mainnet upgrade protocol 86 → 88 sekitar 7 Nov; ulangi tes mainnet setelahnya.

## Kandidat ide dari riset (selain Undo)

Dari [docs/research/11_ideas_v2_project1.md](docs/research/11_ideas_v2_project1.md) — skor dari 60:

| Ide | Track | Skor | Catatan |
|---|---|---|---|
| Anti Jam Karet — event escrow (Kickback) | social, realworld | 44 | 0 pesaing, semua komponen sudah ✅. |
| Rekber AI — escrow P2P dengan putusan AI | realworld, social | 44 | Satu keluarga mekanisme dengan Undo → rawan tumpang tindih dengan project 1. |
| Pasar Pendapat — opinion market commit-reveal | social, memecoins | 42 | Hati-hati kesan judi. |
| Bonded Calls — call KOL wajib bertaruhan | social, nfts, memecoins | 41 | Butuh KOL sungguhan. |
| Rain Bond — asuransi hujan ojol | realworld | 41 | |
| Vault Card — NFT yang punya dompet | nfts | 40 | Lane NFT-berdompet masih kosong. |

Lane yang masih kosong (2 Nov): event escrow, social di atas Sputnik/Trezu, NFT yang punya dompet, DeFi di luar swap. Lane yang penuh: vault "leash" agent (~30 klon), x402 paywall, escrow kerja agent, invoice freelancer, OTC privat, pet AI. Juri AI mengecek setiap klaim README terhadap kode — hanya klaim yang sudah jalan.

## Langkah berikutnya

1. Tentukan tim dan orang untuk project ini (lihat aturan satu submission per tim).
2. Pilih ide → tulis `IDEAS.md` dan `PLAN.md` di root folder ini.
3. Kalau butuh spike baru, beri nomor mulai **S30** supaya tidak bentrok dengan S0–S22, dan catat di [SPIKE_LOG.md](SPIKE_LOG.md) dengan format yang sama.
