# Checklist submit (D-6) — target Sabtu 14 Nov 2026 12:00 UTC (19:00 WIB)

Aturan di [HACKATHON.md](../HACKATHON.md): submit **sekali** per repo, tidak bisa diedit, hanya 1–14 Nov. Ambil ulang versi live https://nearhackathon.com/HACKATHON.md pada hari H.

## Sebelum hari H (manusia)
- [x] Nama project final (lihat `docs/NAMING.md`) dan rename selesai.
- [ ] Akun NEAR **mainnet** tim untuk payout (buat di wallet mana pun; jangan pernah dibuat oleh agent). **Keputusan 9 Nov: tidak ada deploy ke mainnet**; kontrak tetap di testnet, akun mainnet hanya dipakai sebagai alamat payout di payload.
- [x] 4 Nov: akun tim `laurel-team-mw0x0c8g.testnet` terisi 21,79 NEAR → kontrak final `laurel.laurel-team-mw0x0c8g.testnet` dideploy (evaluator dipin lewat `new`), tugas 3 `credit-risk` (demo, ditutup) dengan 2 model terskor, tugas 4 `credit-risk-open` (untuk juri, sampai 25 Nov) dengan 1 model (tugas 1/2 berjudul Indonesia digantikan); `close_task` + 5 `predict_task` oleh agent. Rincian di `docs/TESTNET.md`.
- [x] Default `web/src/rpc.js` → `laurel.laurel-team-mw0x0c8g.testnet`; web dideploy ulang 4 Nov.
- [ ] README Undo menyebut project ini, dan README ini menyebut Undo dengan tautan repo (Q-015).
- [x] 5 Nov: beli kredit dari browser dengan Meteor Wallet di `#/connect` → tx `4YHqm8GPUpv6kvMSiBzUP3UwTnhLoWp6tK3BoKrj8rfd` (0.05 NEAR, akun `smoothicon6710.testnet`), dicatat di CLAIMS baris 22.
- [ ] Video ≤ 3 menit sesuai `DEMO.md` direkam, diunggah.
- [ ] Repo GitHub dibuat publik (manusia), `git push`.
- [ ] Post X oleh manusia: menyebut "built at NEAR HACKATHON", tag @NEARProtocol dan #NEARHackathon, lampirkan video. Simpan URL post.

## 12 Nov, segera setelah 12:00 UTC (agent, dengan persetujuan)

- [ ] `node tools/close_task.mjs 5` (siapa pun boleh; pemenang = split B terbaik). Catat tx, juara, skor B yang terungkap.
- [ ] `node agents/caller.mjs --task 5 --submission <juara> --rows 3` lalu satu panggilan `predict_task(5, …)` lewat MCP (`laurel_predict`) supaya rute juara terbukti, bukan hanya `predict`.
- [ ] Perbarui README (What is live, tabel bukti), CLAIMS (baris baru), tasks/near-retention/README.md (tabel hasil: kolom split B), docs/AGENTS.md. Commit, push.
- [ ] Health check seperti 13 Nov di bawah bisa digabung di sini.

## 13 Nov (agent, dengan persetujuan)
- [x] 4 Nov: `bash build.sh test` hijau (50+3+4+1); `node tools/e2e.mjs --funder TEAM --cleanup` hijau (run `mw1xpamc`, 23 langkah, 17/17, 232 s) → `docs/E2E.md`. Ulangi 13 Nov hanya kalau ada perubahan kode/kontrak.
- [x] 4 Nov: `docs/AGENT.md`, `docs/CONSUMER.md` merujuk kontrak final (tugas 3); `docs/GAS.md` tetap pengukuran di kontrak dev dan menyebutnya.
- [x] 4 Nov: `CLAIMS.md` nomor baris dicek ulang (`grep -n "pub fn"`).
- [x] 4 Nov (ulangi sebelum push): Tidak ada secret di repo: `git ls-files | xargs grep -lE "PRIVATE_KEY=ed25519"` kosong; `.env`, `private_*.json`, `tools/out/`, `*.pkl` tetap di-ignore.

## Payload (diisi manusia, dicetak agent, dikirim setelah "ya")
```json
{
  "requestId": "<uuid dibuat sekali: node -e \"console.log(crypto.randomUUID())\">",
  "projectName": "Laurel",
  "leadName": "<nama ketua tim>",
  "email": "<email kontak; maks 2 submission per email>",
  "size": "<1 | 2 - 4 | 4 - 6 | 6 - 8 | 8+>",
  "tracks": ["agents", "privacy", "open"],
  "nearAddress": "<akun mainnet payout, huruf kecil>",
  "projectUrl": "https://github.com/agadape/laurel",
  "demoUrl": "https://x.com/<akun>/status/<id>",
  "idea": "<20–2000 karakter: masalah, produk, peran NEAR>",
  "consent": true
}
```
Jangan tambahkan field lain (`website` adalah jebakan spam). Kirim: `curl -sS -X POST https://nearhackathon.com/api/applications -H 'Content-Type: application/json' -d @payload.json` → **201** = tersimpan. 400 → perbaiki field, kirim ulang dengan `requestId` sama. 503 → tunggu 1 menit, kirim ulang dengan `requestId` sama. Jangan commit `payload.json` (sudah di-ignore oleh pola `submission*.json`; beri nama `submission_payload.json`).

Draf `idea` (1236 karakter dari batas 2000, Inggris, untuk disetujui manusia; ditulis ulang 10 Nov supaya kalimat pertamanya menyebut *private test set in a TEE* dan *agents pay per prediction*). Tiap angka dicek 10 Nov: 13 model = `get_config`, 52 test = `#[test]` di `contracts/bursa`, entri agent #10 (seri di puncak tugas 5) dan #13 (pertama dari dua di tugas 4) = CLAIMS baris 25. **Cek ulang 12 Nov setelah tugas 5 ditutup**: kalimat "its entries top the public leaderboard of both open tasks (one of them tied)" dan angka "13 models" harus disesuaikan dengan keadaan saat itu.
> Nobody grades their own test. Every AI model reports its own benchmark, and buyers just believe it. Laurel is an open competition on NEAR where small models are scored on a private test set inside a TEE (OutLayer): the test rows are a secret that only the evaluator pinned in the contract can read, and a sealed split alone picks the champion. The winning model lives in the contract as data, so inference runs on-chain (about 4 Tgas), and AI agents pay per prediction: an agent holding a function-call key limited to predict buys answers from prepaid credit, another contract buys them through a promise, and each prediction fee goes to the model's owner. Agents can also compete: an autonomous agent built on the Claude Agent SDK trained and entered models through our MCP server (npx -y laurel-mcp) with no human in the loop, and its entries top the public leaderboard of both open tasks (one of them tied). Live on NEAR testnet, with a task on real mainnet data (will a new .near account still be active after day 30?): 13 models, 52 contract tests, a one-command entry, every claim mapped to code, tests and transaction hashes, and one read-only command (node tools/verify_claims.mjs) that re-checks the on-chain ones against NEAR.
