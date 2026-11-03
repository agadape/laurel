# CLAUDE.md — Laurel (project ke-2, NEAR HACKATHON)

Project **kedua** tim di NEAR HACKATHON (deadline 2026-11-14T23:59:00Z, target submit 14 Nov 12:00 UTC). Ide **sudah dipilih: Laurel** (nama kerja Bursa Model; codename kontrak `bursa` tidak diubah, lihat `docs/NAMING.md`) — model keputusan kecil sebagai infrastruktur on-chain, dinilai di benchmark privat lewat OutLayer. Project pertama (Undo) ada di `C:\Project_Dave\NEAR_Hackathon`; baca saja kalau perlu, jangan diubah dari sini. README kedua project wajib saling menyebut (Q-015).

## Baca dulu, sesuai urutan
1. [PLAN.md](PLAN.md) — rencana kerja, arsitektur, tugas per ID (S-, C-, E-, ML-, I-, F-, T-, D-), milestone, freeze 11 Nov.
2. [docs/ABI.md](docs/ABI.md) — ABI kontrak yang dibekukan. Ubah di sini dulu sebelum mengubah kode.
3. [SPIKE_LOG.md](SPIKE_LOG.md) — bukti teknis + gotcha (S30/S31 = dasar project ini). Cek sebelum menulis kode NEAR/OutLayer.
4. [tasks/german-credit/README.md](tasks/german-credit/README.md) — spesifikasi tugas demo (label, 18 fitur, split, metrik, batasan).
5. [HACKATHON.md](HACKATHON.md) — aturan resmi; ambil ulang versi live sebelum submit. Konteks lain: [START_HERE.md](START_HERE.md), [IDEAS.md](IDEAS.md), [ARCH_STRESS_TEST.md](ARCH_STRESS_TEST.md), [docs/TESTNET.md](docs/TESTNET.md), riset di `docs/research/`.

## Struktur
`contracts/bursa` (kontrak Rust, near-sdk 5.30) · `crates/gbdt-core` (GBDT integer, dipakai kontrak + evaluator) · `evaluator/` (wasm32-wasip2 untuk OutLayer) · `tools/` (export.py, skrip Node) · `tasks/german-credit/` (data publik + spesifikasi; file `private_*.json` gitignored) · `web/` (Next.js baca-saja) · `docs/` · `spikes/` (bukti; **jangan diubah**, salin kalau perlu) · `wasm/` (hasil build).

## Aturan keras
- Tanpa konfirmasi eksplisit manusia: jangan submit, posting ke X, membuat repo publik, push, commit, menandatangani tx mainnet, memakai dana nyata, atau mempublikasikan file.
- Rahasia hanya di `.env` (gitignored; berisi kunci testnet yang dipakai bersama project 1). Test set privat tidak pernah masuk repo.
- Juri AI mencocokkan klaim README ↔ kode ↔ tx: hanya klaim fitur yang sudah jalan; `CLAIMS.md` wajib.
- Scope dikunci di PLAN.md §3: ekstensi X-* hanya setelah M3 selesai ≤ 9 Nov.
- Satu orang memegang `contracts/bursa/src/lib.rs` per hari; ABI hanya berubah lewat `docs/ABI.md`.

## Cara build/test (WSL Ubuntu-24.04, dari Git Bash)
```bash
MSYS_NO_PATHCONV=1 wsl.exe -d Ubuntu-24.04 --exec /bin/bash /mnt/c/Project_Dave/NEAR_Hackathon_2/build.sh test
MSYS_NO_PATHCONV=1 wsl.exe -d Ubuntu-24.04 --exec /bin/bash /mnt/c/Project_Dave/NEAR_Hackathon_2/build.sh contract
MSYS_NO_PATHCONV=1 wsl.exe -d Ubuntu-24.04 --exec /bin/bash /mnt/c/Project_Dave/NEAR_Hackathon_2/build.sh evaluator
```
Distro default WSL adalah `docker-desktop` (tanpa bash) — selalu sebut `-d Ubuntu-24.04`. Python/sklearn ada di Windows (`python`), bukan di WSL. CLI OutLayer sudah terpasang di WSL (`outlayer`), login via `spikes/s31/s30_outlayer.sh login <pubkey>`.

## Konvensi
- Spike baru: nomor lanjut (S32+), skrip di `spikes/`, satu baris di `SPIKE_LOG.md`.
- Testnet saja (RPC `https://rpc.testnet.fastnear.com`). Skor/uang dalam bps dan yoctoNEAR string di JSON (lihat ABI).
- Bahasa dokumen tim: Indonesia; kode, log, dan ABI boleh Inggris.
