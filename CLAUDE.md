# CLAUDE.md — working in the Laurel repository

Laurel is a model competition on NEAR: small gradient-boosted-tree models are submitted as data, scored inside a TEE (OutLayer, Intel TDX) on sealed private rows, and the winner runs inside the contract for paid predictions. Start with [README.md](README.md); every claim in it is mapped to code, tests and transactions in [CLAIMS.md](CLAIMS.md).

## Layout
- `contracts/bursa` — the contract (Rust, near-sdk 5.30); `contracts/consumer-example` — a contract that buys predictions.
- `crates/gbdt-core` — integer GBDT decoding and inference, shared by the contract and the evaluator.
- `evaluator/` — the scoring wasm (wasm32-wasip2) that OutLayer runs in the TEE; its sha256 is pinned in the contract.
- `wasm/` — the deployed builds (`bursa.wasm`, `evaluator.wasm`).
- `tools/` — Node and Python scripts: verification (`verify_claims.mjs`, `verify_tee.mjs`), training and export, deployment, the quickstart.
- `mcp/` — the `laurel-mcp` npm package; `web/` — the site, `web/api/` — its serverless functions (page API and remote MCP).
- `tasks/` — the two datasets (public splits, feature specs; private splits are never committed).
- `docs/` — design and evidence documents; `docs/internal/` — the team's planning notes (Indonesian).

## Read-only checks (no key, no account)
```bash
node tools/verify_claims.mjs                 # the README's on-chain claims, testnet and mainnet
cd tools && npm ci && node verify_tee.mjs    # every score's Intel TDX attestation (add --network mainnet --contract laurel.ikantongkolmangut.near)
```

## Build and test
Rust 1.99.0 (pinned in `rust-toolchain.toml`) with targets `wasm32-unknown-unknown` and `wasm32-wasip2`:
```bash
bash build.sh test        # unit tests: contract, consumer example, gbdt-core, evaluator
bash build.sh contract    # wasm/bursa.wasm
bash build.sh evaluator   # wasm/evaluator.wasm
```
The site: `cd web && npm ci && npm run dev`. CI runs the same tests on every push (`.github/workflows/test.yml`).

## Conventions
- Keys live only in `.env` (git-ignored); `.env.example` lists the names. Never print or commit a key.
- Testnet contract `laurel.laurel-team-mw0x0c8g.testnet`; mainnet contract `laurel.ikantongkolmangut.near` (same code hash).
- Scores are basis points; NEAR amounts are yoctoNEAR strings in JSON (see `docs/ABI.md`).
- A README claim needs a matching CLAIMS.md row and, where it is on-chain, a check in `tools/verify_claims.mjs`.
