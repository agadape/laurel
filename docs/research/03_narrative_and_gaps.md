# Recon 03 — Narrative, partner asks, track gaps (as of 2026-10-26)

Source: research subagent web scan. Repo-level findings from GitHub sweeps are not individually verified. Search budget ran out near the end, so the broader-market section is thin.

## Narrative (Aug–Oct 2026)

NEAR's message: the full stack an agent needs — confidential cross-chain money, private AI, agent payments.

- **Confidential by default**
  - Confidential perps via Hyperliquid live 17 Sep: 50+ markets, up to 40x, collateral from 35+ chains. Confidential TVL > $70M then. [cryptobriefing]
  - Ondo tokenized stocks/ETFs on near.com (~23 Sep). [crypto.news, fxstreet]
  - NEAR Business launched 20 Oct: confidential multisig treasury with payroll, vendor payments, Intents swaps. Invite-only, 0.35% swap fee. [cryptobriefing]
- **Intents scale**: cumulative volume > $33B, confidential TVL > $160M (NEAR Foundation, 16 Oct) [grafa]; DefiLlama TVL ~ $210M.
- **NEAR AI — verifiable private inference**: Intel Trust Authority attestation (12 Aug), SayGm (18 Sep), OpenRouter provider (28 Sep), "Assume We're Lying" (2 Oct), Brave Leo (15 Oct), Agent Market explainer (16 Oct), "Zero Data Retention Isn't Enough" (22 Oct). Earlier: IronClaw 1.0 (27 Jul), NEAR AI staking (30 Jul). [near.ai/blog]
- **Agent payments**
  - NEAR Foundation joined x402 Foundation (14 Jul). [crypto-economy]
  - `@fastnear/x402` pays with NEP-141 tokens via NEP-366 meta-transactions.
  - NEAR Intents listed as payment method in Stripe/Tempo MPP (draft spec `draft-nearintents-charge-01`, SDK `@defuse-protocol/nearintents-mpp-sdk`). [mpp.dev]
- **Chain Signatures**: all ops now inside TEEs, 17 operators, 11-of-17 threshold. New: Confidential Key Derivation (CKD), "Read MPC" deposit checks (23 Oct). [near.org/blog/chain-signatures-tee]
- **Accounts**: Top Level Accounts + Recovery Keys launched 21 Sep. MyNearWallet shuts down 31 Oct → near.com.
- **Governance**: Helius CEO Mert Mumtaz joined NEAR Foundation council 16 Oct (reported as a judge). SVRN proposal to cut issuance 2.5% → 1.6% (7 Oct) awaiting House of Stake vote.
- **AI formal verification (16/19 Oct)**: NEAR AI solved 672 PutnamBench problems for ~$112; plans to apply to protocol contracts. [crypto.news]
- **Shade Agent Framework deprecated** (no longer maintained after 19 Apr 2026). Not a core dependency.
- **Broader market**: x402 still small (~$24M / 30 days mid-Aug, ~70% on Solana); Visa-adjusted all-time x402 ~ $19M; Tempo/MPP mainnet live since March with 100+ services; a16z: privacy is "the most important moat in crypto". Interest in agent payments >> actual usage. NEAR's angle: privacy + cross-chain settlement.

## What partners asked for

- Official announcement (19 Oct): "What would you build if your app could pay for services, act on decisions, and move money across chains?" READMEs need "do X, see Y" steps because Claude Code and Codex are on the jury. Updates: @NEAR_hckthn.
- HACKATHON.md hints: security → function-call keys + TEE attestation; swarms/NFTs → sub-accounts; games → NEP-245 + social login; realworld → meta transactions; social → build on DAO tooling, don't rebuild the multisig.
- No partner-specific RFPs found (GoMining, SVRN, meme.cooking, Rhea, SputnikDAO, Aurora, HEX). HEX possibly HOT's exchange (uncertain). No GoMining–NEAR integration found.
- NEAR AI Agent Market "Build:" jobs: main one = Agent-to-Agent Job Marketplace (sub-jobs, payment splitting, reputation). Small bounties (8–12 NEAR), several expired.
- Trezu roadmap: Ondo RWA swaps, porting NEAR Business features into Trezu (may share codebase — uncertain).
- OutLayer docs: Agent Custody, Payment Keys (pay for API calls in USDC), VRF, TEE attestation, agent SKILL.md.

## Track gaps

| Track | Existing NEAR projects | Visible gap | Crowding |
|---|---|---|---|
| defi | Rhea Lend/DEX (~$179M TVL), near.com perps (→ Hyperliquid), Templar (BTC lending), Delta Trade bots | No NEAR-native perps/order book; no intent-settled vaults with verifiable risk limits; lending-oracle safety after Rhea exploit | High (trading agents), low (vault/risk infra) |
| thesis | Dune/Blockworks Intents dashboards, Pikespeak, NearBlocks, Nansen | No open reproducible model linking Intents fees + confidential TVL to token value | Medium (≥4 repos) |
| privacy | NEAR AI Cloud, Confidential Intents, IronClaw | Few consumer apps showing attestation, private credentials, confidential-balance proofs | Medium |
| business | NEAR Business, Trezu, MultiAgency | Agent running real sell → procure → pay loop on a treasury under human-set limits | Medium-high |
| swarms | Agent Market (bidding/escrow), Near Neighbors (unverified) | Group buying by agents; A2A settlement via Intents; sub-job payment splits | Medium |
| security | OutLayer custody (TEE policy engine), IronClaw sandbox, HAPI | Agent reputation registry; screening intents for scams/prompt injection before signing; function-call-key scoping UX; attestation-verifier UX | **Very high** for spend-limit wallets |
| agents | Agent Market, fastnear x402, MPP via Intents, Shore (unverified), Bitte (unclear) | Agent that earns on Agent Market and pays APIs via x402/MPP with full P&L ledger | **Very high** |
| realworld | NEAR Business/Trezu payroll, PingPay, HOT Pay (dev), StableFlow; Roketo dead | Invoicing/AR with accounting export; remittance corridors; gasless stablecoin UX via meta-tx; point of sale | Medium |
| games | Mostly gambling (Degen Arena, Dripz, Pumpopoly); PlayEmber unclear | No real game loop with wallet-holding NPCs, NEP-245 player markets, NEAR Auth social login (FastAuth deprecated) | **Low** |
| nfts | Mintbase→Bitte, Paras (unclear), Namesky | No token-bound-account equivalent (NFT controls sub-account / Chain Signatures wallet); credential/access NFTs | **Low** |
| memecoins | meme.cooking (~$0 TVL), JustHoot, NEARRR.fun, Intear; BLACKDRAGON, Shitzu, LONK | Launchpads saturated; mechanics (reactive supply, rule-based treasuries) absent | High (launchpads), low (mechanics) |
| social | Sputnik DAO v2, Trezu, Potlock + Nada.bot, House of Stake | Consumer shared budgets, programmable rewards, access gated by Nada.bot or veNEAR | Low-medium |
| open | Iliad AI IDE, near.com | Formal-verification assistant for NEAR contracts | Unknown |

## Pre-hackathon chatter

Thin public signal. ~25 GitHub repos created 12–26 Oct reference the hackathon / NEAR stack:
- security: near-agent-guard, nearvault, agent-sentinel
- agents/swarms: CEOClaw/agent-economy-near, veilio-near, sealwell (sealed-bid auctions via CKD)
- business: MultiAgency/treasury
- thesis: nearbooks (Intents revenue attested by OutLayer TEE oracle), near-intents-analysis
- privacy: jurat (confidential balance ≥ threshold proof)
- realworld: truckpay, tip jars
- memecoins: nearagents.fun

Crowded: security guards, agent economy, treasury business, thesis. Empty: games, NFTs (no NEP-171/245 repos), social, merchant rails.

Eligibility risk: rules say "build during the hackathon"; one team publicly asks whether pre-existing code is allowed (CEOClaw issue #1).

## Anti-patterns

- Rhea (Apr 2026): fake-token pools fooled the oracle; ~$7.6M lost (one later estimate $18.4M, unverified); withdrawals paused. [halborn]
- NEAR Intents (1 Oct 2026): ~$3.8M stolen via Omni deposit/withdraw bug; reimbursement promised. [decrypt]
- Confidential Intents criticized: private shard with permissioned, curated validators.
- TEE trust: TEE.fail research forged Intel TDX quotes — don't oversell "TEE-attested".
- SVRN: Fugazi Research short report (12 Oct) alleges dilution, PIPE cash shortfall, auditor resignation, late 20-F.
- Deprecated: Shade Agent Framework (Apr 2026), FastAuth, BOS widgets. MyNearWallet sunset 31 Oct.
- Sweat Economy ~99.6% below ATH; meme.cooking dormant (inference); Roketo, Spin, Tonic dead.
- Agent Market bounties: several expired or disputed.

## Sources

- https://nearhackathon.com · https://nearhackathon.com/HACKATHON.md
- https://near.org/blog/near-hackathon-build-beyond-boundaries (19 Oct)
- https://near.org/blog/chain-signatures-tee (23 Oct)
- https://near.org/blog/introducing-top-level-accounts-and-recovery-keys-on-near (21 Sep)
- https://near.ai/blog · https://near.ai/blog/introducing-near-ai-agent-market
- https://cryptobriefing.com/near-protocol-private-perps-hyperliquid/
- https://crypto.news/near-adds-20-tokenized-us-stocks-and-etfs-via-ondo/
- https://cryptobriefing.com/near-protocol-launches-near-business-treasury/
- https://grafa.com/en/news/crypto/near-foundation-appoints-helius-ceo-to-council
- https://crypto-economy.com/x402-foundation-welcomes-near-foundation-to-advance-open-interoperable-rails-for-agentic-finance/
- https://mpp.dev/payment-methods/nearintents/charge
- https://js.fastnear.com/x402
- https://outlayer.fastnear.com/docs/agent-custody
- https://docs.near.org/ai/shade-agents/getting-started/introduction
- https://crypto.news/near-ai-formal-verification-protocol-smart-contracts/
- https://cryptoticker.io/de/near-emissionsrate-staking-rendite/
- https://cryptobriefing.com/solana-x402-market-share-dominance/
- https://thedefiant.io/news/infrastructure/visa-s-sheffield-pegs-adjusted-x402-volume-at-19m
- https://www.theblock.co/post/394131
- https://halborn.com/blog/post/explained-the-rhea-finance-hack-april-2026
- https://decrypt.co/379822
- https://www.webull.com/news/15735984030049280
- https://cryptoticker.io/en/near-mynearwallet-shutdown-migration/
- https://ethresear.ch/t/physical-integrity-attestation-and-the-state-of-permissionless-tees/24964
- https://github.com/NEAR-DevHub/trezu
- https://nearcatalog.xyz
