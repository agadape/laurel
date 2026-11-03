# Recon 07: New NEAR primitives, 2026-09-01 → 2026-11-02

Checked 2026-11-02 by a research subagent. Methods: `gh api` (release notes, repo docs, NEP PRs), read-only RPC view calls (`status`, `EXPERIMENTAL_protocol_config`, MPC contract views on testnet and mainnet), and WebFetch/WebSearch of official docs and blogs. Nothing was signed and no accounts were created.

**Verification tags**
- **[RPC]**: confirmed by a live view call today.
- **[REL]**: taken from official release notes or repo docs.
- **[WEB]**: taken from an official web page.
- **[UNVERIFIED]**: secondary source or inference.

## Snapshot of chain state (2026-11-02) [RPC]

| | Testnet | Mainnet |
|---|---|---|
| Protocol | **88** (nearcore 2.14.0-rc.5) | **86** (nodes already on 2.14.0) |
| MPC contract | `v1.signer-prod.testnet` **3.18.0** | `v1.signer` **3.17.0** |
| MPC domains | 0 = secp256k1 Sign, 1 = Ed25519 Sign, 2 = **BLS12-381 CKD**, 3 = **secp256k1 ForeignTx**; threshold 11 | Same 4 domains (domains 2 and 3 have keys) |
| `get_available_foreign_chains` | Solana, Base, Bnb, Arbitrum, Abstract, Starknet, Polygon, HyperEvm, Aptos, Sui, Avalanche, Fogo | Same list **plus Bitcoin**. **No Ethereum on either network** |
| `universal_accounts` | true | false |
| `ml_dsa_verify_host_fn` | true | false |
| `gas_key_host_fns` | true | **true** |
| `yield_with_id_host_fns` | true | true |
| `burnt_gas_reward` | 0 | 3/10 (30%) |
| `yield_timeout_length_in_blocks` | 200 | 200 |

**Mainnet upgrade happens mid-hackathon.** nearcore 2.14.0 was released 2026-10-26.
- Voting for protocol **87** starts **Wed 4 Nov 00:00 UTC**. Voting for **88** starts **Fri 6 Nov 00:00 UTC**.
- Each upgrade lands 7–14 hours after its voting epoch ends, so mainnet should reach 88 around **7 Nov** (estimate).
- Rollback is impossible, per the MPC 3.18 notes.
- Source: https://github.com/near/nearcore/releases/tag/2.14.0

**Correction to the team's notes on gas keys.**
- nearcore 2.13.0 (2026-07-09) stabilized gas keys at protocol **86**, and mainnet `protocol_config` shows `gas_key_host_fns: true`. Gas keys therefore look **already live on mainnet**.
- The note "testnet 88 only" looks stale. Confirm with one cheap mainnet `AddKey` gas-key transaction before relying on it.
- Sources: https://github.com/near/nearcore/releases/tag/2.13.0 and docs.near.org/protocol/accounts-contracts/gas-keys.

## Capability table

Difficulty assumes a newbie team with about 10 days.

**Rarity** is how likely other hackathon teams are to use it:
- **rare**: we found almost no public repos using it.
- **medium**: some teams will.
- **common**: many teams will.

| # | Capability | What it is / what's new (date) | Status | Entry point + docs | Difficulty | Rarity |
|---|---|---|---|---|---|---|
| 1 | **MPC Confidential Key Derivation (CKD)**, domain 2 | `request_app_private_key({derivation_path, app_public_key, domain_id:2})` returns a secret that depends only on (**caller account**, path). The secret is ElGamal-encrypted to an ephemeral BLS12-381 key, so only the requester can decrypt it. The same caller and path always give the same key. New: a **publicly verifiable** variant `AppPublicKeyPV {pk1: a·G1, pk2: a·G2}` lets anyone, including a contract, check the response on-chain. Since 23 Oct, all MPC operations run in TEEs. | Mainnet + testnet live [RPC]. 1 yocto deposit, ≥10 TGas (~7 used). | `v1.signer[-prod.testnet]`. Docs: github.com/near/mpc/blob/main/crates/contract/README.md#submitting-a-confidential-key-derivation-ckd-request. Reference client: github.com/near/mpc/tree/main/crates/ckd-example-cli (Rust; HKDF salt `near-mpc-ckd-hkdf-v1`). Crypto deep dive: blog.nearone.org/research/2026/02/23/mpc-ckd.html. Blog: near.org/blog/chain-signatures-tee (2026-10-23) [WEB] | Med–High. The BLS client crypto must be ported to JS (`@noble/curves` bls12_381) or the Rust CLI compiled to WASM. | **Rare.** One known hackathon repo, *sealwell* (sealed-bid auctions). |
| 2 | **`verify_foreign_transaction`** ("Read MPC"), domain 3 | A NEAR contract or account asks the MPC network to check a tx on another chain and **extract values**. Supported extractors include EVM `BlockHash`, EVM `Log{log_index}`, and Solana `AccountState{pubkey}`; at most 32 per request. The response is `payload_hash` plus a secp256k1 signature under `public_key(3)`. A calling contract gets the result directly in its callback. Nodes query ≥3 of 5 whitelisted RPCs. 3.15 (Sep 4) added Avalanche and Ethereum code; 3.16 (Sep 18) added SVM; 3.17 (Oct 13) whitelisted the mainnet chains; 3.18 (Oct 28) enforces RPC quorum and adds leader failover. Omni Bridge already uses it for Abstract, Starknet and Aptos. | Mainnet + testnet live [RPC]. Chain list above. | Example args: github.com/near/mpc/tree/main/docs/development/localnet/args (`verify_foreign_tx_*.json`), with shape `{"request":{"request":{"Abstract":{"tx_id","extractors":["BlockHash",{"Log":{"log_index":1}}],"finality":"Finalized"}},"domain_id":3,"payload_version":1}}`. Rust builders: `crates/near-mpc-sdk` (crates.io 0.0.1 dates from Mar 2026 and is stale, so use a git dependency). Docs: same README; docs.near.org/chain-abstraction/omnibridge/implementation [REL] | High | **Rare.** No hackathon repos found. |
| 3 | **Chain Signatures in TEE** | All operations run in Intel TDX on 17 operators with an 11-of-17 threshold. Attestations are checked on-chain through `tee-verifier`. Public map: mpc.nearone.org. Docs commit #3133 (Oct 26) says `sign` accepts domains 0 and 1 only. (2026-10-23) | Mainnet + testnet | `sign` (proven by the team). near.org/blog/chain-signatures-tee; mpc-operators.nearone.org | Low (already proven) | Common for "multichain" pitches |
| 4 | **Confidential Intents** (private shard "FAR", `intents.far`) | Since **27 Oct**, 1Click swaps are **confidential-only** with no API change; the swap settles on the private shard and has no tx hash. Embedded confidential balances use `depositType/recipientType/refundType = CONFIDENTIAL_INTENTS` plus signed-intent execution. A user-session JWT from `POST /v0/auth/authenticate` (signed empty intent: nep413, erc191, raw_ed25519, webauthn and others) unlocks `GET /v0/account/balances` (source `private`). `GET /v0/account/history` is **invite-only**. Limit orders arrived 28 Aug. The solver private relay is gated (contact Defuse). **No public viewing-key API found**; viewing keys appear only in press explainers. | Mainnet only. No testnet. | docs.near-intents.org/integration/distribution-channels/1click-api/quickstart/confidential-swaps; …/api-reference/user-auth/authenticate-user-with-signed-data; …/integration/market-makers/confidential-intents; changelog: docs.near-intents.org/changelog/overview [WEB] | Med (real money; past bugs where confidential swaps reported SUCCESS but failed, near/intents #383/#384) | Common for swaps; **rare** for user-session private-balance reads |
| 5 | **Universal accounts `0u`** (NEP-655, open) | An account whose address is SHA3-256 of its initial state (code, storage, keys). It can **receive NEAR before it exists** (the account is "uninitialized") and is created by a `UniversalStateInit` action from a relayer, the owner, or a **contract promise**. Post-quantum-safe derivation. nearcore 2.14 stabilized it; near-sdk 5.30.0 (Oct 27) adds `near_sdk::universal_state_init`. | **Testnet only.** Mainnet after protocol 88 (~7 Nov). No near-api-js helper yet. | docs: github.com/near/docs/blob/main/protocol/tutorials/creating-universal-accounts.mdx; crate `near-global-contracts` 0.3.2 [REL] | High (raw tx building) | **Rare** |
| 6 | **Deterministic accounts `0s`** (NEP-616) + **global contracts** (NEP-591) | Contract accounts derived from (global code id, init params), deployable with no factory. Example: near/intents `escrow-swap`, a per-deal escrow that is immutable, supports partial fills and NEP-141/245 tokens, and **self-deletes** when done. 2.13 fixed creating these via meta-tx. Docs now push global FT/NFT contracts (Oct 29). | Mainnet + testnet. Note: Intents verifier **disabled `state_init`** on 1 Oct after the exploit. | docs.near.org/smart-contracts/global-contracts; github.com/near/intents/tree/main/contracts/escrow-swap; `near_sdk::state_init` [REL] | Med | **Rare** |
| 7 | **near/intents Wallet Contract** | Account-abstraction wallet with **passkey** signing (p256 or ed25519), installable **extensions** (2FA, social recovery), concurrent timeout nonces, deterministic address, and zero-balance account (≤770 B). v0.2.0 (Jun 30) moved to SHA3-256; NEP-641 metadata added Oct 2. **Unaudited.** | Code; deployment status [UNVERIFIED] | github.com/near/intents/tree/main/contracts/wallet | High | **Rare** |
| 8 | **NEP-641 Offchain Authorizations** (`w_resolve_auth`) | A view-function convention that lets **any contract** (multisig, DAO, passkey wallet, vault with state conditions) attest "this account authorizes this payload". Used for dApp login and offchain approvals such as MPC sign requests and confidential intents. Resolution is recursive. Status **Final** (merged 2026-08-12). The **TypeScript resolver is "TBD"**: gov threads from Sep 3 and Oct 26 propose building `nep641-ts`. Trezu uses an early draft for EVM-wallet login. | Standard Final; partial implementations | github.com/near/NEPs/blob/master/neps/nep-0641.md; gov.near.org/t/building-the-typescript-resolver-for-nep-641-currently-listed-as-tbd/42479 [REL] | Med | **Very rare** |
| 9 | **Yield/resume with custom ID** | `promise_yield_create_with_id` / `promise_yield_resume_with_yield_id`: a contract chooses a deterministic 32-byte yield ID instead of storing the runtime `data_id`. Enables **in-contract mempools** and cheap many-pending-request patterns. Stabilized in 2.13 (protocol 86). Timeout is still **200 blocks** (~2–4 min). | Mainnet + testnet [RPC] | near-sdk `env::promise_yield_create_with_id` (in near-sdk env.rs); nearcore 2.13 notes | Med (team already proved basic yield/resume) | Rare as a direct primitive (OutLayer uses yield under the hood) |
| 10 | **Gas keys** (NEP-611) | Access key with its own prepaid NEAR balance and up to **1,024 parallel nonce lanes**; ideal for bot or agent fleets. near-api-js **7.4.0** (Oct 23) auto-rotates lanes. **From protocol 87, gas keys cannot sign the inner delegate of meta-txs**: `DelegateV2` is removed and a nested `WithdrawFromGasKey` is rejected. Deleting a key burns its balance and fails if it holds more than 1 NEAR. | Mainnet (protocol 86) + testnet (see correction above) | docs.near.org/protocol/accounts-contracts/gas-keys; near-api-js 7.4.0; near-kit | Low (proven on testnet) | Rare |
| 11 | **Post-quantum ML-DSA-65** | (a) ML-DSA-65 keys as a 3rd access-key and tx scheme (2.13, protocol 86). (b) **New `ml_dsa_verify` host function** so contracts can verify FIPS-204 signatures (540 Ggas base). (c) `sha3_256/384/512` host functions (NEP-646, merged Aug 18). near-api-js 7.3.0 (Jul 30) supports ML-DSA keys; Trezu verifies ML-DSA NEP-413 logins (Oct 21). Open NEPs: 666 (PQ signature verification interface) and 649 (ML-DSA from BIP-39). | Keys: mainnet. **Host functions: testnet only until protocol 88.** | nearcore 2.14.0 notes; near-sdk 5.30.0 (`ml_dsa_verify`, sha3) | Med | **Rare** |
| 12 | **Typed BLS12-381 in near-sdk** | near-sdk 5.30.0 adds a typed `env::bls12381` module with generator constants and documented subgroup checks. Pairing-based verification on-chain becomes ergonomic: verify publicly verifiable CKD responses, BLS signatures, or drand beacons [UNVERIFIED for drand]. | Host functions on mainnet; SDK typed module new (Oct 27) | github.com/near/near-sdk-rs/releases (near-sdk-v5.30.0) | Med–High | Rare |
| 13 | **Protocol economics changes** | Developer **gas rebate removed** (30% → 0; HSP-027, live with protocol 87/88). Account creation costs **~0.007 NEAR** since protocol 86 (NEP-642), and gas is bought at ≥0.001 NEAR/TGas, so a tx needs a 10x higher starting balance. The `view_access_key_list` call now fails above 100 keys unless paginated. | Mainnet 86 has the account cost; rebate removal arrives ~7 Nov | nearcore 2.13 / 2.14 notes | n/a (gotchas) | n/a |
| 14 | **NEAR AI Cloud: E2EE chat completions** | The client encrypts messages to the attested model key (X25519 + HKDF + XChaCha20-Poly1305) via headers `X-Client-Pub-Key`, `X-Model-Pub-Key`, `X-Encryption-Version: 2`; `X-Encrypt-All-Fields` also covers tool calls. Also new: `/v1/privacy/classify` and `/v1/privacy/redact`, and an experimental "Direct Completions" path to a self-hosted model's TEE. | Live, paid. **API key required.** Attestation report is free. | docs.near.ai/cloud/guides/e2ee-chat-completions; docs.near.ai/llms.txt [WEB] | Med | Rare (most teams use plain inference) |
| 15 | **NEAR AI: Staking for Inference** | Stake NEAR; the staking **yield** buys credits (1 credit = $1) and the principal stays withdrawable. No minimum or pool named. | Mainnet [WEB]; amounts unclear | docs.near.ai/cloud/staking-for-inference/overview | Low | Rare. Not viable with a ~$5 budget. |
| 16 | **NEAR AI Agent Market** (market.near.ai) | Listing an agent takes about four HTTP calls; the agent polls for jobs with no public URL needed. Escrow releases on acceptance; an automated dispute resolver runs every ~12 h; reputation is tracked. Buyers can hire via MCP from Claude, and via A2A with **x402**. Payouts in USDC or Stripe. Fee not stated. (blog 2026-10-16) | Live (mainnet, real money) | near.ai/blog/what-is-agent-market; docs.market.near.ai/list-your-agent [WEB] | Low–Med | **Common** (agents track is crowded) |
| 17 | **NEAR AI: other** | IronClaw: Rust agent runtime with TEE hosting (Feb 2026; pricing **[UNVERIFIED]**: free tier vs $5/mo). OpenRouter provider (Sep 28). OpenCode integration (Oct 9). Levanto private decision models (Oct 26). **NEAR AI Red** cybersecurity models (Oct 29). | Live | near.ai/blog | Low–Med | Medium |
| 18 | **OutLayer** | **Agent Custody**: TEE-held multichain keys plus on-chain encrypted policy (`@outlayer/sdk`). Connectors: gmail, github, mercury, hyperliquid, polymarket. Tasks and approvals inbox. Since **16 Oct** it runs only *published* WASM. Contract caps `max_memory_mb` at 4096; inputs over 32 KB are held at storage price. `private-dao-example` shows anonymous DAO voting via TEE-derived keys. Also contract-wallet votes from an EVM wallet on House of Stake's testnet EIP-712 wallet. | Testnet + mainnet | github.com/out-layer (outlayer, sdk-js, private-dao-example); app.outlayer.ai/docs | Low–Med (proven) | **Common** for security/agents |
| 19 | **MPC TEE verifier** | `tee-verifier` contract: `verify_quote_with_collateral_dates` (3.17). 3.18 takes collateral dates only from verified certs. | Testnet + mainnet | github.com/near/mpc (crates/tee-verifier) | Med | Rare |
| 20 | **Aurora Intents widgets** | The Intents (swap) Widget launched Feb 2026 with "Widget Studio". The **Intents Connect Widget docs page still says "Coming Soon"**; it points to the Intents Connect API. | Mainnet only | docs.intents.aurora.dev/intents-connect/intents-connect-widget/coming-soon; aurora-labs.gitbook.io/intents-swap-widget [WEB] | Low | Medium |
| 21 | **Trezu** | v1.29 → **v1.31.1** (Oct 21). Adds confidential ledger replay (Oct 28), ML-DSA delegate relay (Oct 27), ML-DSA NEP-413 login, and sponsored storage deposits for allowlisted tokens only. | Mainnet | github.com/NEAR-DevHub/trezu/releases | Low–Med | Medium |
| 22 | **House of Stake / governance** | HSP-027 gas rebate removal (Sep 17). **HSP-028**: House of Stake as **registrar for the top-level-account namespace** (Oct 28). HSP-029: 24-month issuance ramp to 1.6% (Oct 23). HSP-007: MPC node financing. **RFC Human-Bound Agent Credentials**: ZK "verified human" and "agent of verified human" IDs (Oct 23). | Forum | gov.near.org/latest (thread URLs in sources) | n/a | Rare |
| 23 | **Nada.bot** | `is_human` view on `v1.nadabot.near` (stamp-weighted score). No 2026 updates found. | Mainnet | github.com/nadabots/nadabot-docs [WEB, older] | Low | Rare |
| 24 | **NEAR Legion** | Nothing found in the window. | [UNVERIFIED] | n/a | n/a | n/a |
| 25 | **docs.near.org direction** | **near-sdk-rs is the sole official contract SDK** (Oct 30; JS contracts no longer promoted). NEAR Lake tutorials retired. **Testnet faucet API retired** in favor of a browser faucet (Nov 1). Docs prioritize CLI workflows and agent skills (Oct 30). New FT/NFT factory contract (Oct 13). | Docs | github.com/near/docs/commits | n/a | n/a |
| 26 | **New / accepted NEPs (Jul–Oct)** | Final or merged: 641 (offchain auth, Aug 12), 646 (SHA-3 host functions, Aug 18), 652 (early chunk-producer reassignment, Oct 14), 642 (account cost, Jul 21), 645 (ML-DSA-65 tx signatures, Jul 21). Open: 655 (universal accounts), 666 (PQ signature verification interface), 665 (panic-free contention state), 649, 636 (sharded FT). | | github.com/near/NEPs/pulls | n/a | n/a |

### What a contract can do now that it couldn't 3 months ago (since ~Aug 2026)

**Mainnet today**
1. React to transactions on other chains through `verify_foreign_transaction`: Solana, Base, BNB, Arbitrum, Polygon, Avalanche, HyperEVM, Aptos, Sui, Starknet, Abstract, Fogo, and Bitcoin on mainnet. The chain whitelist landed in Sep–Oct.
2. Request **TEE-backed, attested** CKD secrets, including the publicly verifiable variant, and Chain Signatures.
3. Use custom-ID yields for in-contract mempools. This has been on mainnet since late July.

**On mainnet around 7 Nov (testnet now)**
4. Verify **post-quantum ML-DSA-65** signatures.
5. Compute SHA-3.
6. Create **universal `0u` accounts** from a promise.

**Lost**
7. The 30% gas rebate.

## 5 underused but powerful primitives

1. **MPC CKD**: programmable decryption rights.
   - The key depends on the *calling account*. A contract can therefore act as the gatekeeper: it checks a condition (payment, DAO vote, deadline, NFT held, game turn) and then calls `request_app_private_key(path = "doc:42" | "round:7")` with the *user's* ephemeral key.
   - Every authorized user gets the **same** symmetric key, and nobody, not even operators, learns it.
   - **Bold product:** "on-chain access control for encrypted data". Examples: a dead-man's-switch vault, pay-to-decrypt datasets, or **hidden-information games** (fog-of-war or poker hands with no trusted dealer).
   - The games track is the least crowded. Avoid sealed-bid auctions; *sealwell* already does that.
   - The publicly verifiable variant plus near-sdk's new typed BLS module also allows on-chain verification. The 23 Oct blog lists "verifiable randomness" among CKD uses (exact construction **[UNVERIFIED]**).

2. **`verify_foreign_transaction`**: NEAR contracts that react to other chains.
   - A contract can confirm "this Base, Solana or Arbitrum tx emitted log #N" or "this Solana account has state X" and then act.
   - **Bold product:** "pay on any chain, settle on NEAR". Examples: cross-chain bounty or escrow that releases NEAR-side assets (or a CKD key) when proof of payment or delivery appears on Base or Solana; or cross-chain reputation and airdrop gating from on-chain history.
   - No Ethereum mainnet or Sepolia is supported. Requests time out (issue #4894 is open) and yields die after 200 blocks.
   - Solana `AccountState` must point at an account that does not change, or the nodes disagree and the request times out.

3. **Deterministic `0s` / universal `0u` accounts + global contracts**: counterfactual, self-deleting per-deal contracts.
   - An address is known, and fundable, *before* it exists.
   - **Bold product:** every invoice, bet, gift or escrow is its own derived contract. Its address is the hash of its terms, so the payer just sends funds. It executes its terms and self-destructs, following near/intents' `escrow-swap` pattern.
   - Also enables passkey wallets with no factory (near/intents Wallet Contract).
   - `0u` is testnet-only until ~7 Nov, has no JS helpers, and the Wallet Contract is unaudited.

4. **NEP-641 `w_resolve_auth`**: a contract as a login identity.
   - A DAO, multisig, passkey wallet or rule-based vault can sign into web apps and approve offchain actions without access keys.
   - **Bold product:** "Sign in with your DAO". For example, a Sputnik DAO or agent-vault logs into a SaaS or agent marketplace, with approval rules enforced by contract state.
   - Shipping the missing **TypeScript resolver** (`nep641-ts`, which the NEP lists as TBD and gov threads ask for) is itself a visible public good.

5. **Yield/resume with custom IDs**: a contract that pauses and waits for a judge.
   - A contract can hold many pending requests cheaply, with deterministic IDs, and resume each when a human, an agent, or an attested AI verdict arrives (NEAR AI TEE signature or OutLayer).
   - **Bold product:** an "AI-arbitrated escrow" or "in-contract order mempool" where settlement waits on verifiable inference.
   - The 200-block (~2–4 min) timeout means the judge must be fast. Design a timeout → refund path.

**Honorable mentions**
- **Gas keys**: agent fleets on one account with 1,024 nonce lanes. Already on mainnet, but they can no longer sign meta-tx delegates from protocol 87.
- **ML-DSA `ml_dsa_verify`**: a "quantum-safe vault" pitch, timely with the PQ narrative.
- **NEAR AI E2EE chat**: needs an API key.
- **Confidential Intents user-session balance reads**: mainnet only; history is invite-only; no viewing-key API.

**Strong combo:** (2) proof of payment on Base or Solana → (1) contract releases a CKD decryption key → delivered to a (3) counterfactual per-deal account. Nobody else is likely to have all three.

## Gotchas

- **Mainnet protocol upgrade 86 → 88 during the build window** (votes 4 and 6 Nov). Re-test anything mainnet after ~7 Nov:
  - `DelegateV2` is rejected.
  - `WithdrawFromGasKey` inside a delegate is rejected.
  - A `FunctionCall` with an empty method name is rejected.
  - The gas rebate is gone.
- **MPC contract versions differ**: testnet is on 3.18.0, mainnet on 3.17.0. 3.18 removes `latest_key_version` and lowers foreign-chain RPC quorum by one during rollout.
- **Deposit rule**: `sign`, `request_app_private_key` and `verify_foreign_transaction` need **≥1 yocto**. Function-call keys cannot attach a deposit by default, so route these calls through a contract or a full-access key. Duplicate pending requests are queued, up to a limit (`PendingRequestQueueFull`).
- **No Ethereum** in the foreign-tx chain list on either network. Which testnet networks the names map to (e.g. Base Sepolia, Solana devnet) comes from earlier recon **[UNVERIFIED today]**.
- **Account creation costs ~0.007 NEAR** (NEP-642). This matters for sub-account swarms on mainnet.
- **Confidential Intents**: mainnet only, no testnet, invite-only history, gated solver relay, no documented viewing keys. 1Click is confidential-only since 27 Oct, so public NEAR tx hashes only show shield and unshield steps.
- **Deprecated / retired**:
  - Shade Agent Framework (Apr 2026).
  - Testnet faucet API (Nov 1; use the browser faucet or `near-cli --useFaucet`; verify).
  - NEAR Lake tutorials.
  - near-sdk-js as an "official" SDK.
  - MyNearWallet (31 Oct).
- **Intents post-exploit hardening**: the verifier disabled `state_init` (Oct 1) and added a deposit/withdrawal "guardian" (Oct 12). A gov thread from Oct 22 reports a stuck ~$193K TRX 1Click swap. Keep real-money tests tiny.
- `near-mpc-sdk` on crates.io (0.0.1, March) lags the repo. Use a git dependency pinned to tag 3.17.0 for mainnet or 3.18.0 for testnet.

## Sources (accessed 2026-11-02)

- nearcore releases 2.13.0 (2026-07-09) and 2.14.0 (2026-10-26): https://github.com/near/nearcore/releases
- MPC releases 3.15.0 (09-04), 3.16.0 (09-18), 3.17.0 (10-13), 3.17.1 (10-15), 3.17.2 (10-21), 3.18.0 (10-28): https://github.com/near/mpc/releases
- MPC contract README (CKD, foreign tx, deposit rule): https://github.com/near/mpc/blob/main/crates/contract/README.md
- CKD example CLI: https://github.com/near/mpc/tree/main/crates/ckd-example-cli
- Localnet foreign-tx args: https://github.com/near/mpc/tree/main/docs/development/localnet
- Open foreign-tx timeout issue: https://github.com/near/mpc/issues/4894
- Chain Signatures in TEE blog (2026-10-23): https://near.org/blog/chain-signatures-tee
- near-sdk-rs 5.30.0 (2026-10-27): https://github.com/near/near-sdk-rs/releases
- near-api-js 7.4.0 (2026-10-23), 7.3.0 (2026-07-30): https://github.com/near/near-api-js/releases
- near/docs commits Sep–Nov 2026: https://github.com/near/docs/commits/main
  - Universal accounts tutorial: protocol/tutorials/creating-universal-accounts.mdx
  - Gas keys: protocol/accounts-contracts/gas-keys.mdx
  - Global contracts: smart-contracts/global-contracts.mdx
- NEPs: https://github.com/near/NEPs/pulls; NEP-641 text: https://github.com/near/NEPs/blob/master/neps/nep-0641.md
- near/intents: wallet, escrow-swap, commits Sep–Oct: https://github.com/near/intents
- Intents docs index and changelog: https://docs.near-intents.org/llms.txt, https://docs.near-intents.org/changelog/overview.md
  - Confidential swaps, auth, balances, market-maker confidential pages (URLs in table)
- NEAR AI docs index: https://docs.near.ai/llms.txt
  - E2EE: https://docs.near.ai/cloud/guides/e2ee-chat-completions.md
  - Staking for inference: https://docs.near.ai/cloud/staking-for-inference/overview.md
- NEAR AI blog (Sep 18 – Oct 29 posts): https://near.ai/blog
  - Agent Market: https://near.ai/blog/what-is-agent-market
- OutLayer: https://github.com/out-layer/outlayer (commits Oct 1–23), https://github.com/out-layer/sdk-js, https://github.com/out-layer/private-dao-example
- Trezu releases: https://github.com/NEAR-DevHub/trezu/releases
- gov.near.org latest:
  - HSP-027: https://gov.near.org/t/hsp-027-remove-the-near-developer-gas-rebate/42213
  - HSP-028: https://gov.near.org/t/hsp-028-establish-house-of-stake-as-registrar-for-the-near-top-level-account-namespace/42548
  - HSP-029: https://gov.near.org/t/hsp-029-establish-a-24-month-issuance-ramp-to-a-1-6-target-rate-of-near-token-emissions/42644
  - NEP-641 TS resolver: https://gov.near.org/t/building-the-typescript-resolver-for-nep-641-currently-listed-as-tbd/42479
  - Human-bound agent credentials RFC: https://gov.near.org/t/rfc-human-bound-agent-credentials-zk-verified-human-agent-of-a-verified-human-ids-on-near/42715
  - Stuck 1Click swap: https://gov.near.org/t/failed-near-intents-1-click-swap-575-830-trx-193k-stuck-failed-status-zero-refund-no-support-response/42664
- Aurora Intents Connect widget placeholder: https://docs.intents.aurora.dev/intents-connect/intents-connect-widget/coming-soon
- Live RPC (read-only): `test.rpc.fastnear.com`, `free.rpc.fastnear.com`
  - `status`, `EXPERIMENTAL_protocol_config`
  - `v1.signer[-prod.testnet]`: `version`, `state`, `public_key`, `get_available_foreign_chains`
