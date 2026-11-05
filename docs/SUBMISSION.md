# Checklist submit (D-6) — target Sabtu 14 Nov 2026 12:00 UTC (19:00 WIB)

Aturan di [HACKATHON.md](../HACKATHON.md): submit **sekali** per repo, tidak bisa diedit, hanya 1–14 Nov. Ambil ulang versi live https://nearhackathon.com/HACKATHON.md pada hari H.

## Sebelum hari H (manusia)
- [x] Nama project final (lihat `docs/NAMING.md`) dan rename selesai.
- [ ] Akun NEAR **mainnet** tim untuk payout (buat di wallet mana pun; jangan pernah dibuat oleh agent).
- [x] 4 Nov: akun tim `laurel-team-mw0x0c8g.testnet` terisi 21,79 NEAR → kontrak final `laurel.laurel-team-mw0x0c8g.testnet` dideploy (evaluator dipin lewat `new`), tugas 3 `credit-risk` (demo, ditutup) dengan 2 model terskor, tugas 4 `credit-risk-open` (untuk juri, sampai 25 Nov) dengan 1 model (tugas 1/2 berjudul Indonesia digantikan); `close_task` + 5 `predict_task` oleh agent. Rincian di `docs/TESTNET.md`.
- [x] Default `web/src/rpc.js` → `laurel.laurel-team-mw0x0c8g.testnet`; web dideploy ulang 4 Nov.
- [ ] README Undo menyebut project ini, dan README ini menyebut Undo dengan tautan repo (Q-015).
- [x] 5 Nov: beli kredit dari browser dengan Meteor Wallet di `#/connect` → tx `4YHqm8GPUpv6kvMSiBzUP3UwTnhLoWp6tK3BoKrj8rfd` (0.05 NEAR, akun `smoothicon6710.testnet`), dicatat di CLAIMS baris 22.
- [ ] Video ≤ 3 menit sesuai `DEMO.md` direkam, diunggah.
- [ ] Repo GitHub dibuat publik (manusia), `git push`.
- [ ] Post X oleh manusia: menyebut "built at NEAR HACKATHON", tag @NEARProtocol dan #NEARHackathon, lampirkan video. Simpan URL post.

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

Draf `idea` (≤ 2000 karakter, Inggris, untuk disetujui manusia):
> Compete. Verify. Deploy. Laurel — small decision models as on-chain infrastructure: trained off-chain, ranked on a private TEE benchmark, served from a NEAR contract to agents and other contracts. Small ML models are stuck on someone else's server, and nobody can verify how good they are. Laurel is a registry contract where anyone publishes a task with a private test set, anyone submits a gradient-boosted-tree model, an OutLayer TEE worker scores it against the secret test set (bound to the pinned evaluator hash), the score is written back on-chain, and the winning model becomes `predict_task(task_id, features)` — called by AI agents holding a function-call key limited to that method, and by other contracts through a promise, for ~4 Tgas per prediction with fees flowing to the model owner. Any AI agent can also use it as a tool: the published MCP server (npx -y laurel-mcp) lists exhibits, downloads a model's bytes from the contract, runs them locally with the contract's integer arithmetic, and calls the champion on-chain; local and on-chain scores are equal. Two tasks: NEAR account retention on real mainnet data (22 features from a new .near account's first week, label = still active after day 30; the private test rows are accounts nobody can look up) and credit-risk classification on UCI German Credit (simulation). Everything is reproducible from a fresh testnet account with one script (`tools/e2e.mjs`): 23 steps, 17 negative paths rejected, TEE scores equal to local ones, all transaction hashes in the repo.
