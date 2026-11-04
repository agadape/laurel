# Testnet: akun, dana, dan siapa yang mengisi (S-3)

Status 3 Nov 2026: **belum terisi**. API faucet `helper.nearprotocol.com` menjawab HTTP 429 ("retry in 6 hours") sejak 2 Nov, jadi pengisian harus dilakukan manusia lewat browser.

## Yang dibutuhkan sebelum M1 (deploy pertama, 4 Nov)

| Akun | Peran | Kebutuhan NEAR | Catatan |
|---|---|---|---|
| `<tim>.testnet` (akun utama tim, baru) | pembuat tugas, pemilik kontrak, membayar storage kontrak | **≥ 6 NEAR** | kode kontrak ±1,8 NEAR terkunci + tugas + gas |
| `bursa-dev.<tim>.testnet` | kontrak (sub-account, dibuat skrip dari akun utama) | dari akun utama | deploy ulang bebas selama dev |
| `peserta1.<tim>.testnet`, `peserta2.<tim>.testnet` | mengirim model (storage ±0,6 NEAR per model demo ≤ 60 KB + fee 0,1 + gas) | **≥ 2 NEAR masing-masing** | sub-account dari akun utama |
| `agent.<tim>.testnet` | FC key `predict_task`, prabayar kredit | **≥ 1 NEAR** | sub-account |
| akun pembuat secret OutLayer | `outlayer secrets set` (0,1 NEAR per baris secret; mungkin lebih untuk ±15 KB) | **≥ 1 NEAR** | bisa = akun utama tim |

**Total aman: 15 NEAR** di akun utama; sub-account didanai dari sana oleh `tools/accounts.mjs` (M1).

## Cara mengisi (manusia)

1. Buat akun testnet baru di wallet apa pun (mis. https://testnet.mynearwallet.com sudah ditutup 31 Okt — pakai Meteor/HOT testnet atau `near-cli-rs`: `near account create-account sponsor-by-faucet-service <nama>.testnet autogenerate-new-keypair save-to-keychain network-config testnet create`).
2. Isi lewat browser faucet: https://near-faucet.io (butuh login/CAPTCHA; ulangi beberapa kali bila per permintaan dibatasi).
3. Ekspor private key akun itu ke `.env` sebagai `TEAM_ACCOUNT_ID` / `TEAM_PRIVATE_KEY` (jangan dibagikan di chat).
4. Beri tahu integrator; `tools/accounts.mjs` membuat sub-account dan FC key.

## Fallback kalau faucet tetap gagal

Saldo akun tim 4 Nov setelah deploy akhir, consumer, agent, dan e2e ulang (cleanup): ≈ 9,6 NEAR.

Sisa akun spike (kunci ada di `.env`): `nh-ft-mvp6pidf.testnet` ≈ 8,4 NEAR bebas, `nh-nft-mvp6py9i.testnet` ≈ 7,8 NEAR, `nh-mt-mvp6qbyw.testnet` ≈ 2,3 NEAR bebas, `nh-s22-mvz0oawn.testnet` ≈ 8,9 NEAR (kontrak spike Undo, jangan ditimpa — tapi boleh mentransfer sisa), `s31.nh-mt-mvp6qbyw.testnet` ≈ 2,2 NEAR bebas. Total ≈ 29 NEAR dapat dipindahkan ke akun tim lewat transfer biasa. `nh-s21-mvz19hwe.testnet` menyimpan bukti S21 untuk Undo — jangan disentuh.

## Yang sudah live
- **Kontrak final (4 Nov): `laurel.laurel-team-mw0x0c8g.testnet`** (owner `laurel-team-mw0x0c8g.testnet`; `BURSA_CONTRACT_ID` / `FINAL_*` di `.env`). Deploy + `new` tx `4ThoX7csa7GsmJCAA4V4CgNbaMEepqoHvG6jUfVuVZNf`. **Tugas 3 = `credit-risk`** (demo, deadline 30 menit, ditutup; submission #4 deep `p1.…` A 7100 / B 6650 = pemenang, #5 shallow `p2.…` A 7550 / B 6150), **tugas 4 = `credit-risk-open`** (terbuka untuk juri sampai 25 Nov 2026 23:59 UTC; submission #6 deep). Tugas 1 `german-credit` (ditutup, pemenang #1) dan tugas 2 `german-credit-open` (#3) dibuat lebih dulu dengan judul berbahasa Indonesia; keduanya tetap di kontrak sebagai riwayat dan digantikan tugas 3/4 berjudul Inggris (keputusan tim 4 Nov, biaya ±1,2 NEAR). Tugas 3/4 dibuat lewat RPC dRPC karena fastnear sempat membatasi pengiriman tx (429); submission #4 terkirim lalu diskor terpisah (`request_score` tx `pU1FFm5kwhPsYg99kThw5oEubKEPmkaoCmoynftjnfD`), #5 tx `2s3NzoTbbWpef97kHqfKDErc42JHWp9XHjBVfwVvPChd`. Agent `agent.laurel-team-mw0x0c8g.testnet` dengan FC key terbatas `predict_task`/`predict`, kredit 0,05 NEAR. Run pertama berhenti di submission tugas 2 karena `p1` kurang 0,04 NEAR (anggaran 1,0 untuk dua submission deep); ditambah 0,6 NEAR dari akun tim (tx `F9aHbFx2Xapm9KbNUrYTuNuze2c9UX1aJFDbUKdvZh74`), skrip dijalankan ulang (idempoten), anggaran `p1` di skrip dinaikkan ke 1,6.
- Kontrak dev (3 Nov): `bursa-dev.nh-ft-mvp6pidf.testnet` (owner `nh-ft-mvp6pidf.testnet`; `BURSA_DEV_ID` di `.env`). Tugas 1 = gas-probe sintetis (ditutup), tugas 2 = `german-credit` (ditutup, pemenang submission 3).
- Agent: `agent.nh-ft-mvp6pidf.testnet` dengan FC key (`AGENT_*` di `.env`).
- Repo publik: **https://github.com/agadape/laurel** (dibuat dan di-push 4 Nov). `description_url` tugas 3/4 di kontrak masih `https://github.com/` (placeholder saat dibuat, tidak bisa diubah); tugas baru memakai URL repo.
- Web baca-saja: **https://laurel-near.vercel.app** (Vercel project `laurel-near` (renamed from `bursa-model` on 4 Nov; the old URL https://bursa-model.vercel.app still resolves), build `web/`). Kontrak lain bisa dilihat dengan `?contract=<akun>`.
- Evaluator v1 di Vercel project `nh-spike-wasm` (lihat `docs/EVALUATOR.md`).

## Dana yang hilang (catatan jujur)
- 3 Nov, run e2e pertama (tag `mw0kfrrl`, funder `nh-nft`) berhenti di tengah sebelum cleanup dan kunci akun segar belum disimpan: ±5,6 NEAR testnet terkunci di `own-/bursa-/p1-/p2-/agent-mw0kfrrl.nh-nft-mvp6py9i.testnet` dan tidak bisa diambil. `nh-nft` tersisa ±0,4 NEAR. Sejak itu `tools/e2e.mjs` menyimpan kunci ke `tools/out/e2e-keys.json`, membersihkan di `finally`, dan punya `--cleanup-only <tag>`.

## Deploy akhir (satu perintah, setelah akun tim terisi)
```bash
node tools/deploy_final.mjs --name laurel --minutes 30          # buat laurel.<tim>.testnet + p1/p2/agent, deploy, pin evaluator, tugas, 2 model + skor
node tools/deploy_final.mjs --name laurel --close               # setelah deadline: close_task + 5 predict_task oleh agent (FC key)
```
Akun dan kunci yang dibuat disimpan ke `.env` sebagai `FINAL_*`; `BURSA_CONTRACT_ID` ikut diarahkan ke kontrak baru sehingga `tools/agent.mjs`, `tools/consumer.mjs`, `tools/submit.mjs` langsung memakainya. Kebutuhan dana ≈ 6,6 NEAR (3,4 kontrak + 1,6 p1 + 0,6 p2 + 0,6 agent), plus ±2 NEAR untuk `consumer.mjs` dan 1 NEAR cadangan.

FastFS testnet (`test.fastfs.io`) masih 502 pada 3 Nov malam; evaluator tetap di Vercel.

## Hal yang sudah ada dan tetap dipakai

- OutLayer: login CLI dengan `nh-spike-mvp62mw4.testnet` (lihat `spikes/s31/s30_outlayer.sh login`); evaluator spike hash `dcc4aa66…` tersimpan di Vercel `nh-spike-wasm`.
- RPC: `https://rpc.testnet.fastnear.com` (+ failover `test.rpc.fastnear.com`, `rpc.testnet.near.org`).
