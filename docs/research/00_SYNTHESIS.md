# Recon Synthesis — NEAR HACKATHON (2026-10-26)

Detail: [01_hackathon_intel.md](01_hackathon_intel.md) · [02_partner_tech.md](02_partner_tech.md) · [03_narrative_and_gaps.md](03_narrative_and_gaps.md) · bukti spike: [../SPIKE_LOG.md](../../SPIKE_LOG.md)

Tim: 4+ orang · stack campuran · baru pertama di NEAR · terbuka ke semua track.
Waktu: 6 hari sebelum kickoff (1 Nov) + 14 hari build (sampai 14 Nov 23:59 UTC).

## 1. Intel Brief

- **Hadiah $250K**: grand prize $55K + 13 track × ($10K / $3K / $2K). Satu submission boleh pilih banyak track, jadi satu proyek bisa bersaing di 2–4 track sekaligus.
- **Juri**: Illia Polosukhin (NEAR), Haseeb Qureshi (Dragonfly), Mert Mumtaz (Helius, baru masuk NEAR Foundation Council), Avichal Garg (Electric), Eddy Lazzarin (a16z), Kain Warwick (Synthetix/Infinex), Stepan Gershuni (cyber•Fund) **+ juri AI: Claude Code dan Codex**. Tidak ada rubrik resmi; FAQ menyebut: teknis, desain, dampak, orisinalitas, keberlanjutan.
- **Narasi NEAR saat ini**: "confidential by default" (Confidential Intents, NEAR Business 20 Okt), private AI yang bisa diverifikasi (NEAR AI Cloud + attestation TEE), pembayaran agent (x402, MPP via Intents), Chain Signatures sekarang di dalam TEE (23 Okt).
- **Pola pemenang NEAR sebelumnya**: satu primitive NEAR dipakai dalam (Chain Signatures atau TEE) + lapisan AI; arketipe dominan = agent AI yang memegang dan memindahkan uang nyata lintas chain; demo live dengan transaksi nyata dan angka dampak terukur.
- **Juri AI** membaca repo: README harus bisa dijalankan, langkah "lakukan X → lihat Y", sebut tool NEAR yang dipakai, tanpa marketing.
- **Jebakan**: Shade Agent Framework sudah deprecated (Apr 2026); FastAuth lama diarsipkan; MyNearWallet tutup 31 Okt; NEAR Intents tidak punya testnet; Intents di-hack $3.8M (1 Okt) dan Rhea di-hack (Apr) — klaim keamanan harus jujur, jangan oversell "TEE-attested".
- **Risiko kelayakan**: aturan bilang "build during the hackathon". Skrip spike sebelum 1 Nov sebaiknya dipisah dari repo produk; repo produk mulai bersih 1 Nov. Tanyakan di Discord NEAR.

## 2. Judge Dossier (ringkas)

| Juri | Fokus publik terbaru | Akan suka | Bukti |
|---|---|---|---|
| Illia Polosukhin | Private user-owned AI, Intents, confidential compute | Agent di atas private inference + Intents / Chain Signatures | Posting daftar ide proyek di X (status 2106269343881519444) — **belum terbaca, baca manual** |
| Haseeb Qureshi | "Crypto was not made for humans" (18 Feb 2026) | Perdagangan agent-ke-agent, "self-driving wallets" | haseebq.com |
| Mert Mumtaz | Privasi, pembayaran shielded, interop Solana–ZEC–NEAR | Pembayaran privat, pasar terbuka lewat Intents | near.org 14 Okt |
| Avichal Garg | Co-organizer NEAR AI Useful Agents (wajib metrik) | Agent berguna dengan angka dampak; private pay-per-use | "26 Opportunities in 2026" |
| Eddy Lazzarin | Desain token/mekanisme, zkVM | Mekanisme yang ketat | Akan menghukum tokenomics lemah (memecoins/NFT) |
| Kain Warwick | Perps, margin, RWA (inferensi) | DeFi dengan volume nyata | tidak ada kutipan terverifikasi |
| Claude Code, Codex | Membaca repo | Repo yang jalan dari README | HACKATHON.md |

## 3. Competition Map (sinyal pra-hackathon, ~25 repo GitHub 12–26 Okt)

| Track | Saturasi | Sinyal |
|---|---|---|
| security (spend-limit wallet, agent guard) | 🔴 Tinggi | near-agent-guard, nearvault, agent-sentinel + OutLayer custody sudah ada |
| agents (agent economy) | 🔴 Tinggi | CEOClaw, veilio, Agent Market, fastnear x402 |
| business (treasury agent) | 🔴/🟡 | MultiAgency/treasury, NEAR Business, Trezu |
| thesis | 🟡 | ≥4 repo (nearbooks, near-intents-analysis) |
| defi | 🟡 | trading agent ramai; vault/risk infra sepi |
| privacy | 🟡 | infra ada, aplikasi konsumen sedikit (jurat) |
| swarms | 🟡 | Agent Market sudah punya bidding/escrow |
| realworld | 🟡 | payroll sudah ada; invoicing/AR, merchant/POS, remittance sepi |
| memecoins | 🟢 untuk mekanik / 🔴 untuk launchpad | nearagents.fun; launchpad jenuh |
| social | 🟢 | Sputnik/Trezu ada, aplikasi komunitas di atasnya hampir kosong |
| nfts | 🟢 | tidak ada repo NEP-171/245; belum ada "NFT sebagai akun" |
| games | 🟢 | hanya game judi; belum ada game loop dengan NPC ber-wallet |
| open | ? | formal verification assistant belum ada |

**Open tracks: games, nfts, social, memecoins (mekanik), realworld (invoicing/merchant). Crowded: security, agents, business, thesis.**
Catatan posisi: grand prize kemungkinan jatuh ke proyek yang paling pas dengan narasi (private AI + pembayaran agent + Intents/Chain Signatures). Kombinasi terbaik = track sepi + primitive yang sedang didorong NEAR + daftar ke beberapa track.

## 4. Spike Target List (prioritas)

Sudah selesai (read-only): S0 RPC ✅ · S1a 1Click token list ✅ · S1b Intents testnet ❌ (mainnet only) · S2a MPC testnet ✅ · S2b Sputnik factory ✅ · S2c test token ✅.

| # | Target | Jaringan | Butuh dari manusia | Kenapa |
|---|---|---|---|---|
| **P1 — sponsor inti + juri** ||||
| S3 | Akun testnet sekali pakai + faucet + transfer & function call via near-api-js 7.4 | testnet | OK untuk membuat akun testnet | Fondasi semua spike |
| S4 | Chain Signatures: derive address → `sign` → broadcast ke Base Sepolia / Solana devnet | testnet | Faucet Base Sepolia (CAPTCHA) atau airdrop Solana devnet | Primitive favorit pemenang + Illia |
| S5 | NEAR AI Cloud: `/v1/models`, attestation (tanpa key) → chat + verifikasi signature TEE (dengan key) | mainnet API | API key cloud.near.ai + kredit | Privacy track + Illia; narasi utama |
| S6 | NEAR Intents 1Click: quote `dry:true` (gratis) → swap nyata ~0.05 USD | mainnet | Wallet mainnet + OK per transaksi | Disebut di 5 track; tidak ada testnet |
| S7 | Function-call access key + sub-account (kunci agent yang dibatasi) | testnet | — | security/swarms/nfts/agents |
| S8 | Sputnik DAO: create → add_proposal → act_proposal | testnet (~7 NEAR) | — | social track, NEAR Business dibangun di atasnya |
| S9 | OutLayer: `estimate_execution_cost` → `request_execution` | testnet | — | Sponsor "secure tx untuk agent" |
| **P2 — dibutuhkan banyak arah** ||||
| S10 | Meta-transaction NEP-366 dengan relayer sendiri (gasless) | testnet | — | realworld, games, UX konsumen |
| S11 | NEAR Auth social login (Google/email) → tx | testnet | Login Google di browser | games ("pemain tidak sadar ada chain") |
| S12 | Wallet connect `@hot-labs/near-connect` (Meteor/Intear) di browser | testnet | Install wallet testnet | Semua frontend |
| S13 | Build + deploy kontrak Rust (near-sdk 5.29.1) di WSL: NEP-171 / NEP-141 / NEP-245 | testnet | OK install Rust di WSL Ubuntu | nfts, memecoins, games |
| S14 | Stablecoin testnet (`usdc.fakes.testnet` atau faucet Circle) + `ft_transfer_call` | testnet | Faucet Circle (CAPTCHA) bila perlu | realworld, agents |
| **P3 — fitur baru/beta (pembeda)** ||||
| S15 | Verifier TEE on-chain dengan quote NEAR AI | testnet | key NEAR AI | Bukti privasi on-chain, langka |
| S16 | MPC CKD (domain 2) / `verify_foreign_transaction` | testnet | — | Fitur baru 23 Okt |
| S17 | Pembayaran agent: `@fastnear/x402` (NEP-141 + meta-tx) / Intents MPP | testnet / mainnet | — | Narasi pembayaran agent |
| S18 | Trezu API baca + treasury mainnet (gratis disponsori) | mainnet | Wallet mainnet | social/business |
| **P4 — hanya jika arah membutuhkan** ||||
| — | Rhea testnet swap, meme.cooking testnet, Aurora XCC, HOT Omni, Shade Agents (deprecated), HEX/SVRN/GoMining | campuran | — | Lewati kecuali ide memerlukannya |

### Pembagian spike untuk tim 4+ (usulan)
- Orang A: S3, S7, S10 (akun, kunci, meta-tx)
- Orang B: S4, S16 (Chain Signatures)
- Orang C: S5, S15 (NEAR AI + TEE)
- Orang D: S6, S14, S17 (uang: Intents, stablecoin, pembayaran agent)
- Orang E/F: S8, S9, S18 (DAO, OutLayer, Trezu) + S11, S12, S13 (frontend & kontrak)

Claude bisa menjalankan sebagian besar spike testnet langsung dari laptop ini. Timebox per spike ±45 menit; yang gagal dicatat ❌ dan ditinggal.
