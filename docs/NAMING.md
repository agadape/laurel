# Keputusan nama — 3 Nov 2026 (sesi naming, diputuskan bersama pengguna)

| Hal | Keputusan |
|---|---|
| **Nama project (submission, README, repo)** | **Laurel** |
| Tagline (baris 1 README + kolom `idea` submission) | *Laurel — small decision models as on-chain infrastructure: trained off-chain, ranked on a private TEE benchmark, served from a NEAR contract to agents and other contracts.* |
| Kalimat pengingat (video/pitch) | "The model that earns the laurel serves on-chain." |
| Nama repo GitHub | `laurel` (pilihan kedua bila dipakai: `laurel-near`) — dicek 3 Nov: tidak ada proyek NEAR bernama Laurel di GitHub; npm `laurel` bebas (tidak dipakai, kita tidak publish paket) |
| Akun NEAR demo akhir | kontrak `laurel.<akun-tim>.testnet`, agent `agent.<akun-tim>.testnet`, konsumen contoh `desk.<akun-tim>.testnet` (sub-account dari akun tim yang diisi lewat faucet, S-3). `bursa-dev.nh-ft-mvp6pidf.testnet` tetap sebagai lingkungan dev sampai deploy akhir |
| Web explorer | **https://laurel-near.vercel.app** (Vercel project renamed `bursa-model` → `laurel-near` on 4 Nov; `laurel.vercel.app` was taken; the old URL https://bursa-model.vercel.app still resolves). UI text switched to English on 4 Nov for the international jury |
| Nama internal kode | **Tidak diubah**: crate `contracts/bursa`, `wasm/bursa.wasm`, `ext_bursa`, env `BURSA_*`, akun `bursa-dev`, variabel `bursa` di tools/web. README menyebut sekali: "contract codename: `bursa` (Indonesian for *exchange*)". Rename identifier kode = risiko regresi tanpa nilai untuk juri |

Alasan pilihan: nama Inggris sesuai permintaan pengguna; satu kata, 6 huruf, mudah diucapkan semua juri; metaforanya persis mekanisme produk (pemenang sayembara mendapat mahkota daun lalu "melayani"); tidak bentrok dengan kota, protokol, atau peserta hackathon mana pun; alternatif yang ditimbang: Podium, Proving Ground, Incumbent (Inggris); Sayembara, Juara (Indonesia); Bursa Model (nama kerja).

## Checklist rename (dijalankan sesi induk; hanya teks yang dilihat pengguna/juri)

| # | File | Ubah | Catatan |
|---|---|---|---|
| 1 | `README.md` baris 1 | `# Laurel — small decision models as on-chain infrastructure on NEAR` | tambahkan kalimat pengingat di bawah judul; di bagian "How it works"/"Repository map" tambahkan: *contract codename `bursa` (Indonesian for exchange) is kept in code and account names* |
| 2 | `README.md` isi | ganti sisa "Bursa Model" → "Laurel"; biarkan `bursa` di nama akun/file/perintah | `grep -n "Bursa Model" README.md` harus kosong setelahnya |
| 3 | `CLAIMS.md` | judul/kalimat pembuka bila menyebut nama; baris klaim tetap (merujuk file `contracts/bursa`) | — |
| 4 | `DEMO.md` | kalimat pembuka adegan 0:00 → "Ini Laurel." ; kalimat penutup | — |
| 5 | `docs/SUBMISSION.md` | nama project `Laurel`; teks `idea` memakai tagline di atas; nama repo `laurel` | periksa batas 20–2000 karakter |
| 6 | `PLAN.md` baris 1 | `# PLAN — Laurel (Project 2, …)` + satu baris status: "Nama final: Laurel (docs/NAMING.md)" | isi PLAN lain tidak perlu |
| 7 | `CLAUDE.md` baris 1 & 3 | `# CLAUDE.md — Laurel (project ke-2, …)`; "Ide sudah dipilih: **Laurel** (nama kerja Bursa Model)" | — |
| 8 | `web/index.html` | `<title>Laurel</title>`; meta description tetap atau mulai dengan "Laurel:" | — |
| 9 | `web/src/App.jsx` ~L215 | `<h1><a href="#/">Laurel</a></h1>`; footer boleh tetap | — |
| 10 | `web/package.json` | `"name": "laurel-web"`, description "Read-only explorer for the Laurel contract (NEAR testnet)…" | nama project Vercel tidak ikut berubah |
| 11 | `tools/package.json` | description → "… for the Laurel contract (testnet)" | `name` boleh tetap `bursa-tools` |
| 12 | `contracts/bursa/Cargo.toml` | `description = "Laurel (contract codename bursa): tasks, model submissions, …"` | nama crate tetap `bursa` |
| 13 | `ARCH_STRESS_TEST.md`, `IDEAS.md` | **tidak diubah** — dokumen sejarah keputusan; tambahkan satu baris di atas masing-masing: "Nama final project: Laurel (lihat docs/NAMING.md); di bawah ini masih memakai nama kerja Bursa Model." | opsional |
| 14 | `tools/create_task.mjs` | tidak perlu | judul tugas berasal dari `features.json` |
| 15 | Vercel | tidak wajib. Bila pindah: `cd web && vercel deploy --prod --yes --name laurel-near`, lalu ganti URL di README A.1, PLAN status, docs/TESTNET.md, docs/SUBMISSION.md | lakukan hanya sebelum video direkam |
| 16 | Setelah rename | `git grep -n "Bursa Model"` → hanya boleh tersisa di `ARCH_STRESS_TEST.md`, `IDEAS.md`, `docs/research/`, `spikes/` | commit: "Rename user-facing name to Laurel (docs/NAMING.md)" |

Pengungkapan Q-015 tetap: README Laurel menyebut project saudara **Undo**, dan README Undo harus menyebut **Laurel** (bukan "Bursa Model") saat keduanya dipublikasikan.
