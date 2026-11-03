# IDEAS — Project 2, NEAR HACKATHON (Fase 2: audit lintas-model + konsep baru), 2 Nov 2026

Masukan: riset kita ([docs/research/](docs/research/), [SPIKE_LOG.md](SPIKE_LOG.md)) dan dokumen Grok (22 konsep, `GROK_RESEARCH.md`). Aturan skor sama dengan [docs/research/10_ideas_v1_project1.md](docs/research/10_ideas_v1_project1.md): Feasibility maks 5 kalau dependensi inti belum di-spike; Judge Fit maks 5 tanpa juri bernama + bukti; Business maks 4 tanpa model bisnis satu kalimat.

Batasan khusus project 2: tidak boleh tumpang tindih dengan Undo (pembayaran reversibel + sidang AI di TEE), dan harus bisa dibangun tim pemula dalam 12 hari (3–14 Nov) di testnet.

**Koreksi aturan (HACKATHON.md versi 2 Nov):** sekarang tertulis *"One submission per project"*, satu email boleh **2 submission** untuk project yang independen dan saling menyebut di README (Q-015). Jadi tim yang sama boleh mengirim Undo dan project 2. Catatan "harus tim lain" di [START_HERE.md](START_HERE.md) sudah tidak berlaku.

---

## 1. Audit dokumen Grok

### 1.1 Sumber dan klaim riset

| Klaim Grok | Status | Catatan |
|---|---|---|
| Post @NEARProtocol `2107187818573222154` berisi ide Illia | ✅ ada (5 Okt 2026) | Post itu mengutip daftar ide Illia 3 Okt. Daftar aslinya sudah kami petakan di [docs/research/04_illia_ideas.md](docs/research/04_illia_ideas.md); publik sejak 4 minggu lalu → semua peserta sudah membacanya. |
| "Leash" sudah muncul di hackathon | ✅ | Bukan satu, tapi **~45 klon** ([docs/research/06](docs/research/06_competition_live.md)). Grok tidak menangkap tingkat kejenuhannya. |
| "PrivatePay-style restricted agent payments" | ❌ tidak ditemukan | Pencarian web tidak menemukan project bernama itu di NEAR. Yang mirip: CyberNanoPay (TON), UnWallet. Perlakukan sebagai spekulasi. |
| Artikel altcoindesk "wildest pilots" | ✅ ada (29 Agt 2025) | Isinya sapi RFID, pisang, pernikahan on-chain; "fart-to-earn" disebut **satire** oleh artikel itu sendiri. Nilai riset rendah. |
| Keluhan berulang (counterparty privat, agent tanpa kunci, sybil, prompt injection) | ✅ sejalan dengan recon kita | Tapi Grok tidak memberi sumber per keluhan. |

Yang **tidak** dilakukan Grok: tidak ada pencarian prior art per mekanisme, tidak ada pemetaan juri, tidak ada model bisnis, tidak ada bukti teknis, dan tidak menyentuh primitive NEAR yang baru (CKD, `verify_foreign_transaction`, akun deterministik, NEP-641, yield-with-id; lihat [docs/research/07](docs/research/07_new_primitives.md)). Hampir semua konsepnya memakai "TEE inference" sebagai sihir serbaguna.

### 1.2 Pemenang Grok: Artificial Life Colony — ditolak

1. **Prior art langsung yang terlewat: Spore.fun** (Phala, 2024–25): agent AI di TEE yang harus menghasilkan uang untuk membayar servernya, bereproduksi di atas ambang valuasi, dan "mati" di bawahnya; sifat diwariskan ke anak. Ini persis "metabolisme, kematian, reproduksi" yang Grok sebut belum ada. Studi kasus arXiv menyimpulkan evolusinya pendek (5 generasi) dan tidak open-ended. Sumber: [cloud.phala.network/cases/spore-fun](https://cloud.phala.network/cases/spore-fun), [arXiv 2506.04236](https://arxiv.org/html/2506.04236v2). Di hackathon ini sendiri **Kibble** sudah di mainnet (AI pet yang membayar inferensinya sendiri).
2. **Mekanismenya tidak jalan seperti ditulis.** "Anak bersaing memperebutkan bounty" dan "fork kode dengan mutasi" berarti tiap organisme = kontrak baru. Dari S13: tiap kontrak mengunci ~1,6–2,3 NEAR storage; akun baru ~0,007 NEAR. Tidak ada tekanan seleksi nyata karena tidak ada pekerjaan nyata, jadi "evolusi" cuma counter yang berubah.
3. **Demo = menonton angka berubah.** Tidak ada hal yang bisa dilakukan juri.
4. **Juri:** Haseeb ("agents don't need crypto, humans do"), Kain ("too early for trading agents"), Mert ("99.99% it's AI") skeptis pada agent-untuk-agent tanpa pengguna nyata ([docs/research/05](docs/research/05_judges_x.md), tema 3).
5. Tidak ada model bisnis.

### 1.3 Ke-22 konsep, satu baris masing-masing

| # | Konsep | Verdict | Alasan (prior art / mekanisme) |
|---|---|---|---|
| 1 | Echo Chamber Engine | ❌ | Butuh graf sosial + embedding dari nol; abstrak; tidak ada pengguna. |
| 2 | Behavioral Residue | ❌ | = analitik on-chain (Arkham/Nansen) dibungkus NFT; bertentangan dengan tema privasi Mert. |
| 3 | Memetic Mutation Market | ❌ | Launchpad meme + generasi AI (Zerebro). Mert anti konten AI. |
| 4 | Artificial Life Colony | ❌ | Lihat §1.2. |
| 5 | Irrationality Oracle | ⚠️ mekanik inti bagus | Ini *meta-prediksi* (Keynesian beauty contest, Bayesian Truth Serum). Produk Grok kabur, tapi mekaniknya dipakai di konsep baru B4. |
| 6 | Ownership of Absence | ⚠️ mekanik inti bagus | Sebagai "hak negatif" tidak bisa ditegakkan. Tapi di NEAR, akun bisa **membuang kemampuannya sendiri** (hapus full-access key) → komitmen ala Ulysses. Dipakai di B6. |
| 7 | Collective Dream | ❌ | Seni kolaboratif AI; kualitas generasi; tidak ada loop. |
| 8 | Parasite Tokens | ❌ | Optik malware; tidak ada yang mau jadi inang. |
| 9 | Reputation Decay | ⚠️ fitur, bukan produk | Peluruhan itu ide ekonomi tua (demurrage Gesell). Dipakai di B7. |
| 10 | Emergent Language | ❌ | Terlalu abstrak untuk demo 3 menit. |
| 11 | Sacrifice Economy | ❌ | Proof-of-burn + generatif; terlihat boros. |
| 12 | Mirror Agents | ❌ | Tidak ada kegunaan; optik aneh. |
| 13 | Attention Debt Bonds | ❌ | = balasan berbayar (21.co/Earn.com, 2017). |
| 14 | Tournament of Rules | ❌ | 0xMonaco/Core War; terlalu kompleks untuk 12 hari. |
| 15 | Private Collective Unconscious | ⚠️ | = kueri agregat dengan privasi di TEE; produk nyata-nya adalah koperasi data (B10). |
| 16 | Amnesia Tokens | ❌ | Riwayat publik tidak bisa dibuat tak terbaca setelah fakta; hanya jalan kalau terenkripsi sejak awal. |
| 17 | Symbiosis Contracts | ❌ | Multisig dengan pembagian PnL. |
| 18 | Folklore Propagation | ❌ | Sama dengan #3. |
| 19 | Anti-Sybil Bloodline | ❌ | Umur/biaya akun sebagai anti-sybil sudah umum; friksi onboarding. |
| 20 | Chaos Injection | ❌ | Demo tak bisa diprediksi. |
| 21 | Residual Self Image | ❌ | Pasar avatar. |
| 22 | Uncanny Valley Auction | ❌ | Seni generatif; subjektif. |

Hasil cross-pollination yang berguna dari Grok: hanya **mekanik tersembunyi** di #5, #6, #9, #15. Tidak ada produknya yang layak dibangun apa adanya.

---

## 2. Konsep baru (12), bukan varian dari 22 Grok maupun daftar v1/v2 kita

Semua konsep hanya memakai kemampuan ✅ di [SPIKE_LOG.md](SPIKE_LOG.md) atau primitive yang ditandai perlu spike baru (S30+).

| # | Konsep | Mekanik yang tidak biasa | NEAR load-bearing? | Spike | Nasib |
|---|---|---|---|---|---|
| B1 | **Bursa Model** — turnamen model keputusan kecil; skor di test set rahasia; **model pemenang jadi smart contract** yang dipanggil kontrak/agent lain, pemiliknya dapat fee per panggilan | Model ML berjalan *di dalam* konsensus (wasm murah), bukan oracle; test set rahasia dinilai di TEE partner dan hasilnya masuk tx yang sama | Ya: wasm NEAR membuat inferensi pohon keputusan murah (di EVM satu regresi logistik memakan 30–50% blok, [arXiv 2510.16024](https://arxiv.org/html/2510.16024v1)); OutLayer S9; NFT royalti S13; FC key agent S7 | S30 publish wasm OutLayer sendiri; S31 GBDT di wasm | **Shortlist** |
| B2 | **Siapa Manusia?** — ruang obrolan 5 orang, 2 di antaranya AI di TEE; semua bertaruh siapa manusia; AI dapat uang kalau berhasil menyamar dan membayar inferensinya sendiri | Deteksi sosial dengan taruhan; TEE membuktikan bandar tidak bisa mengintip peran | Sedang: sub-account AI dengan FC key, atestasi NEAR AI (S5a/S21), kontrak taruhan | — (semua ✅) | **Shortlist** |
| B3 | **Kabut** — informasi tersembunyi tanpa dealer: nilai kartu/petak = hash dari rahasia CKD yang hanya boleh diturunkan kontrak untuk pemain berhak | MPC NEAR sebagai dealer; tidak ada server yang tahu peta/kartu | Ya: CKD domain 2 (`request_app_private_key`), varian publicly-verifiable untuk reveal yang adil | S32 port klien BLS CKD ke JS (Med–High) | Digabung ke B2 sebagai pembagi peran, atau jadi lanjutan |
| B4 | **Juri Tanpa Oracle** — resolusi klaim subjektif dengan Bayesian Truth Serum ("jawabanmu" + "tebakan jawaban orang"); surat suara disegel lewat CKD yang baru bisa dibuka kontrak setelah tutup | Jawaban "surprisingly popular" lebih akurat dari mayoritas (Prelec; Science 2017); segel tanpa keyper (beda dari Shutter) | Ya: CKD sebagai timelock bergantung state kontrak | S32 | Shortlist cadangan (evolusi Pasar Pendapat 42) |
| B5 | **Capit Chain** — mesin capit fisik di Jakarta, livestream; ESP32 memegang FC key yang hanya bisa `start_play`/`report_result`; bayar dari chain mana pun; agent juga boleh main | Benda fisik bergerak karena kontrak | Ya: FC key di perangkat (S7), gasless (S10), Chain Signatures (S4) | Hardware | **Shortlist** |
| B6 | **Kunci Dibuang** — komitmen ala Ulysses: pengguna menghapus full-access key sendiri, menyisakan FC key berbatas; pemulihan lewat DAO teman atau timelock | Bukan membungkus aset, tapi membuang kemampuan bertindak di level protokol | Ya: access key model | — | Ditolak: terlalu dekat tema Undo ("kunci dicuri, uang tak bisa cair"); prior art stickK, lockup.near |
| B7 | **Uang Membusuk** — memecoin dengan demurrage; yang meluruh mengalir ke kas Sputnik komunitas | Freigeld Gesell; supply bereaksi pada waktu | Sedang | — | Ditolak: Circles UBI dan Freicoin sudah melakukannya; cuma mekanik lama di track baru |
| B8 | **Notaris Lintas Chain** — kontrak NEAR memverifikasi tx di Base/Solana (`verify_foreign_transaction`, 0 repo) lalu menerbitkan kredensial/struk/poin NEP-245 | NEAR sebagai saksi chain lain tanpa indexer | Ya | S33 (High) | Ditolak sebagai produk: Galxe-like; demo kering; cocok jadi *fitur* B5/B1 |
| B9 | **Masuk dengan DAO** — resolver NEP-641 TypeScript (yang di NEP masih "TBD") + demo login SaaS memakai Sputnik DAO | Kontrak sebagai identitas login | Ya | S34 | Ditolak: public good yang bagus, tapi demo developer-facing; track lemah |
| B10 | **Gaji Jujur** — koperasi data gaji: slip gaji di-parse di TEE, hanya agregat yang keluar; kontributor dibayar saat data dikueri | Privasi dengan taruhan emosional | Ya: NEAR AI E2EE (S21) | — | Ditolak untuk 12 hari: butuh ≥30 slip nyata; nilai demo sedang |
| B11 | **Second Opinion Medis Privat** (Illia #11, 0 pesaing) | E2EE ke model TEE; prompt dokter sebagai NFT | Ya | — | Ditolak: tooling sama persis dengan Undo (E2EE + S22); demo teks; regulasi |
| B12 | **Kredit Gotong Royong** — time-banking komunitas dengan kredit yang kedaluwarsa | Demurrage pada kredit kerja | Sedang | — | Ditolak: Ithaca Hours; adopsi butuh komunitas nyata |

Ditambah satu cadangan dari daftar lama: **Anti Jam Karet** (event escrow, 0 pesaing, semua ✅) sebagai pilihan paling aman.

---

## 3. Lima kandidat terkuat

### 3.1 Bursa Model — "Kaggle yang pemenangnya jadi smart contract"

- **Konsep:** siapa pun memasang **tugas** (misal "apakah akun testnet ini bot?" atau "harga cabai Jakarta minggu depan naik/turun?") dengan dataset latih publik dan **test set rahasia**. Peserta mengunggah model keputusan kecil (pohon/GBDT/regresi, ≤ ~200 KB). Model dinilai di OutLayer (TEE) yang menyimpan test set sebagai secret; skornya masuk ke tx NEAR yang sama (S9). Model teratas **di-deploy sebagai kontrak** dengan method `predict(features) -> label`. Kontrak lain dan agent (FC key, S7) memanggilnya; tiap panggilan membayar fee kecil ke pemilik **NFT model** (S13). NFT bisa dijual → aliran fee ikut pindah.
- **Mekanik pembeda:** (1) model *adalah* kontrak, dipanggil sinkron tanpa oracle; (2) skor dari test set yang tidak pernah terlihat siapa pun, hasilnya on-chain; (3) hak inferensi sebagai aset berroyalti.
- **Prior art terdekat:** Numerai (turnamen dengan data terenkripsi, bayar NMR; **tidak** menjalankan model on-chain) [K]; OpenGradient / Giza / Modulus (inferensi on-chain dengan bukti zkML/TEE, EVM) — terlihat di pencarian sebagai "backed by inference validity proofs"; Cortex (2018, model sebagai kontrak di chain sendiri, mati) [K]; Kaggle. Posisi jujur: "Numerai + Cortex, di NEAR, tanpa bukti kriptografis karena wasm menjalankan modelnya di dalam konsensus, dan pemenangnya jadi infrastruktur yang berroyalti." Kesamaan yang disisakan: format turnamen dan test set rahasia bukan hal baru.
- **Peran NEAR yang tak tergantikan:** biaya eksekusi wasm membuat 100 pohon kedalaman 6 masuk dalam beberapa Tgas (perlu dibuktikan S31); OutLayer (partner resmi) mengembalikan hasil TEE ke dalam tx; FC/gas key memberi agent akses terukur; NEP-171 untuk royalti.
- **Track:** `agents` (agent membayar untuk keputusan), `nfts` (NFT yang menghasilkan), `open`. Hindari `security` meski use case bot-detection menggoda: track itu merah.
- **Juri (bukti):** Haseeb — *"LLMs too unreliable to embed in software at runtime… a decision model will beat an LLM"* (10 Okt; Dragonfly investasi di Typesafe/Jev). Kain — *"I need this real bad"* tentang decision model (17 Sep). Illia — *"turn judgement into code"* (29 Sep) dan ide #13 "benchmark AI dengan test set privat" (0 pesaing). Stepan — *"anyone can invest directly into AI model inference profits"* (tesis 2025) → NFT model persis itu. Eddy — evaluator yang terdesentralisasi, *"no single locus of control"* (23 Sep). Avichal — EC #8 jaringan data. Mert — tidak ada teks AI, AI-nya deterministik: aman dari "AI dekoratif".
- **MVP 12 hari:** §5.
- **Demo:** (0:00) "Model ML biasanya hidup di server. Di NEAR, model bisa jadi kontrak." (0:20) unggah model → 10 detik → skor muncul on-chain (link tx OutLayer) → leaderboard berubah. (1:00) klik *deploy* → kontrak `model-7.bursa.testnet` lahir. (1:20) agent dengan FC key memanggil `predict` → jawaban + fee masuk ke pemilik NFT (dua tx di explorer). (2:00) transfer NFT ke akun lain → panggilan berikutnya membayar pemilik baru. (2:30) tabel biaya: Tgas per prediksi vs angka EVM dari paper.
- **Risiko teknis:** publish wasm sendiri di OutLayer belum dicoba (S9 hanya memanggil contoh orang lain); ukuran model vs storage (~2 NEAR per model, deploy ke akun faucet); test set rahasia bisa "dibocorkan" lewat submit berulang → batasi submit per akun + biaya per submit (cara Numerai). Fallback kalau S30 gagal: skor di test set **publik** on-chain, bagian rahasia jadi roadmap; produk tetap utuh.
- **Keberatan terkuat:** "model kecil saja" (bukan LLM), dan kesannya infrastruktur. Jawaban: tesis Haseeb/Kain justru soal model kecil di runtime; LLM besar masuk tier 2 (skor teratestasi via NEAR AI, pola S21/S22) sebagai roadmap.
- **Bisnis:** 10% dari fee per panggilan + biaya pasang tugas.

### 3.2 Siapa Manusia? — deteksi sosial berbayar melawan AI di TEE

- **Konsep:** ruang 5 kursi, ronde 3 menit chat, lalu semua memilih siapa manusia. Dua kursi diisi agent NEAR AI di TEE dengan sub-account sendiri (FC key). Tebakan benar dibayar dari pot; AI yang lolos mengambil bagian dan **membayar inferensinya sendiri** dari situ. Atestasi TEE (S5a) membuktikan operator tidak bisa membaca prompt/peran.
- **Pembeda:** taruhan + bukti bahwa bandar tidak curang + AI yang hidup dari kemampuannya menipu.
- **Prior art:** Human or Not (AI21, 2023, puluhan juta sesi; tanpa taruhan, tanpa bukti) [K]; Kibble (AI yang membayar inferensinya sendiri, mainnet, hackathon ini); Crucible/Freysa (bujuk AI agar membayar). Yang tersisa mirip: format "tebak siapa bot".
- **Track:** `games` (loop jelas, chain tak terlihat), `privacy`, `social`.
- **Juri:** Kain (*"making it easy and fun"*, agent e-sports, 27–28 Okt), Illia (private verifiable AI; tamagotchi), Haseeb (proof-of-human; "humans need crypto"), Stepan (*"game that does NOT have AI generated assets?"*).
- **Risiko:** multiplayer real-time oleh tim pemula; optik judi (pakai poin untuk demo publik); akun AI terlihat di explorer → pakai akun segar per ronde (0,007 NEAR).
- **Keberatan terkuat:** game web2 dengan kontrak pembayaran; NEAR tidak wajib. Benar sebagian; yang NEAR-spesifik hanya sub-account AI dan atestasi.
- **Bisnis:** rake 5% pot.

### 3.3 Capit Chain — mesin capit yang digerakkan kontrak

- **Konsep:** mesin capit mini sungguhan, kamera livestream, pembayaran dari HP (gasless, S10) atau dari chain lain (S4/S6a). ESP32 memegang FC key yang hanya bisa `start_play` dan `report_result` (S7). Agent AI juga boleh menyewa giliran.
- **Pembeda:** satu-satunya kandidat dengan momen fisik, pola juara umum (Unruggable, CrowdBrain, LensMint; [docs/research/08](docs/research/08_winner_patterns.md)).
- **Prior art:** Clawee/Toreba (fiat, jutaan unduhan) [K]; mesin capit kripto di konferensi [K]; NEAR Tap dan Tapproved (ESP32 di hackathon ini). Mekanismenya tidak baru; yang baru adalah kunci berbatas di perangkat + bayar dari chain mana pun.
- **Track:** `games`, `realworld`, `open`.
- **Risiko:** pengadaan dan modifikasi hardware dalam 12 hari, keandalan saat penjurian (video boleh, Q-012). Tim pemula + hardware = risiko tertinggi di daftar ini.
- **Keberatan terkuat:** "Clawee pakai kripto".

### 3.4 Juri Tanpa Oracle — kebenaran subjektif lewat Bayesian Truth Serum + segel CKD

- **Konsep:** untuk pertanyaan yang tidak punya oracle ("apakah penjual ini amanah?", "sambal terbaik di Bandung"), tiap peserta menjawab dua hal: jawabannya sendiri dan tebakan distribusi jawaban orang lain. Jawaban yang *lebih populer dari yang diprediksi* dianggap benar (Prelec). Surat suara dienkripsi ke kunci CKD `poll:42` yang baru boleh diturunkan kontrak setelah tutup, jadi tidak ada herding dan tidak ada keyper.
- **Prior art:** BTS (Prelec 2004; "surprisingly popular", Science 2017) [K]; UMA, Kleros, Augur; Shutter shielded voting (threshold keyper) dan Fairblock (conditional decryption) — keduanya butuh jaringan khusus, di sini MPC NEAR yang sudah ada. Pasar Pendapat (v2, 42) adalah kakaknya.
- **Track:** `social`, `open`, `privacy`.
- **Juri:** Eddy (desain mekanisme), Avichal (EC #16 opinion markets), Haseeb (PM). Mert (segel = privasi sebagai properti sistem).
- **Risiko:** port klien CKD (S32) belum ada di JS; mekanisme butuh penjelasan 2 kalimat (melanggar "30 detik"?). Sebagai *produk* kabur: apa yang dilakukan orang hari Senin pagi?
- **Keberatan terkuat:** ini mekanisme resolusi, bukan produk.

### 3.5 Anti Jam Karet — event escrow (cadangan paling aman)

- Dari [docs/research/11](docs/research/11_ideas_v2_project1.md): 0 pesaing, semua komponen ✅, bisa diuji di acara kampus nyata. Kelemahan: ada di daftar publik Illia, konsep Kickback sudah dikenal (ditutup 2023), peluang grand prize kecil, peluang track `social` (hijau) besar.

### Perbandingan

| Kandidat | F | U | D | J | R | B | Total | Catatan |
|---|---|---|---|---|---|---|---|---|
| **Bursa Model** | 5* | 8 | 7 | 9 | 7 | 7 | **43** (→46 bila S30/S31 lolos) | * dibatasi aturan: OutLayer publish + GBDT wasm belum di-spike |
| Siapa Manusia? | 7 | 6 | 9 | 8 | 5 | 6 | **41** | Demo terbaik; NEAR kurang load-bearing |
| Capit Chain | 4 | 6 | 10 | 7 | 5 | 6 | 38 | Hardware oleh tim pemula |
| Juri Tanpa Oracle | 5* | 8 | 5 | 8 | 5 | 5 | 36 | Mekanisme kuat, produk lemah |
| Anti Jam Karet | 9 | 5 | 8 | 7 | 8 | 6 | 43 | Aman, bukan "baru" |

Secara angka Anti Jam Karet seri dengan Bursa Model, tapi tujuan fase ini adalah ide yang **tidak akan diusulkan kedua model di sesi awal** dan punya bentuk "primitive baru" (pola grand prize), bukan aplikasi dari daftar publik. Anti Jam Karet tetap jadi fallback kalau gerbang §5 gagal.

---

## 4. Keputusan: **Bursa Model**

Kenapa ini, bukan yang lain:

1. **Tidak ada di daftar siapa pun.** Bukan di 22 Grok, bukan di v1/v2 kita, bukan di daftar Illia (yang paling dekat, #13 "private benchmark", 0 pesaing), bukan di 213 repo pesaing. Lahir dari persilangan tema juri (decision models, judgement-as-code, inference profits) dengan dua fakta spike: OutLayer mengembalikan hasil TEE ke dalam tx (S9) dan wasm NEAR murah (S13/S22).
2. **Membuat NEAR terlihat unik** dengan klaim yang bisa diukur: "model ML ini adalah kontrak; satu prediksi X Tgas" vs angka EVM dari paper. Juri AI bisa memverifikasi klaimnya dari kode dan tx.
3. **Empat juri punya kutipan yang langsung cocok** (Haseeb, Kain, Illia, Stepan), dua lagi sejalan (Eddy, Avichal), dan tidak ada yang menyinggung alergi Mert.
4. **Hidup setelah hackathon:** agent dan kontrak butuh penilai murah, deterministik, dan tak bisa dimatikan; penulis model butuh cara dibayar per pemakaian.
5. Risikonya **teknis dan bisa diuji dalam 2 hari** (gerbang di §5), bukan risiko pasar atau hardware.

Kasus tandingan yang jujur: **Siapa Manusia?** punya demo yang lebih menggugah dan lebih mudah dicintai juri manusia. Kalau tim lebih mementingkan video demo yang viral daripada posisi "primitive baru", pilih itu. Tapi untuk pertanyaan "apakah ini bisa eksis tanpa NEAR?", jawabannya "ya" untuk Siapa Manusia? dan "sulit" untuk Bursa Model.

---

## 5. Scope MVP 12 hari (3–14 Nov, target submit 14 Nov 12:00 UTC)

**Gerbang G1 (selesai 4 Nov malam).** Dua spike wajib; kalau salah satu gagal dan tidak ada fallback, pindah ke Anti Jam Karet pada 5 Nov pagi.

| Spike | Isi | Lolos jika | Fallback |
|---|---|---|---|
| **S30** OutLayer sendiri | Publish wasm scorer (wasm32-wasip2) + daftarkan secret berisi test set kecil; `request_execution` dari kontrak kita; hasil (skor) terbaca di callback | Skor muncul di tx yang sama, ≤ 15 detik, biaya ≤ 0,01 NEAR | Skor di test set publik dihitung di kontrak; "rahasia" masuk roadmap |
| **S31** GBDT di wasm | Kontrak Rust dengan 100 pohon kedalaman 6 (format borsh), `predict(features)` | ≤ 10 Tgas per prediksi, wasm ≤ 300 KB, deploy ke akun faucet | Kurangi ke 30 pohon / regresi logistik |

**Build (5–11 Nov).**
- Kontrak `bursa` (Rust, near-sdk 5.30): `create_task`, `submit_model` (menyimpan hash wasm + metadata, memicu S30), callback skor → leaderboard, `deploy_winner` (deploy ke sub-account `model-N.bursa.testnet` dari wasm yang disimpan), `register_call_fee`. Pola `yield/resume` tidak diperlukan karena OutLayer sudah callback.
- Kontrak `model-template`: `predict` + fee routing ke pemilik token di kontrak NFT (`nft_token` view, S13) + event NEP-297 per panggilan.
- Exporter Python: sklearn/xgboost → borsh; dua tugas demo dengan data publik (akun testnet bot-vs-manusia dari fitur tx; harga cabai dari PIHPS). Dataset dan skrip latih masuk repo (juri bisa reproduksi).
- Skrip agent: akun dengan FC key hanya ke `predict`, memanggil 20× → fee terkumpul (S7).
- Frontend minimal (Next.js): daftar tugas, unggah, leaderboard live, tombol deploy, log panggilan.

**Dokumen (12–13 Nov):** README "do X → see Y", `CLAIMS.md` (klaim → file:baris → tes), `SPIKE_LOG.md` S30–S31, tabel Tgas per prediksi, disclosure project saudara (Undo) sesuai Q-015, LICENSE MIT, video 3 menit. **14 Nov:** repo publik, post X oleh manusia, payload submit dicetak dan menunggu "ya".

**Dipotong dari MVP (roadmap di README, tidak diklaim):** tier 2 skor LLM teratestasi via NEAR AI; marketplace NFT model; gas key untuk fleet agent; dataset privat milik pemasang tugas; penilaian ulang berkala.

**Yang tidak boleh dilakukan sampai tim memutuskan:** menulis kode produk, memasang dependensi baru, commit, deploy. Dokumen ini hanya hasil riset.

---

## Sumber yang dicek 2 Nov 2026 (di luar recon/)

- Spore.fun: https://cloud.phala.network/cases/spore-fun · https://arxiv.org/html/2506.04236v2
- Biaya inferensi ML on-chain di EVM: https://arxiv.org/html/2510.16024v1
- Insta-Pok3r (dealer tanpa pihak tepercaya via komite kunci): https://eprint.iacr.org/2024/1061
- Shutter shielded voting: https://www.theblock.co/post/158084/security · Fairblock: https://blockworks.co/news/fairblock-fundraising-conditional-decryption-privacy
- Post @NEARProtocol 5 Okt 2026 (mengutip ide Illia): https://x.com/NEARProtocol/status/2107187818573222154
- Staking for Inference (NEAR AI): https://docs.near.ai/cloud/staking-for-inference/overview
- Inference.net (ex-Kuzco), jaringan inferensi di Mac/GPU: https://solanacompass.com/projects/kuzco
- Artikel altcoindesk yang dikutip Grok: https://altcoindesk.com/news/blockchain/wildest-blockchain-pilots-2025/article-5759/

[K] = dari pengetahuan umum, belum dicek ulang hari ini.
