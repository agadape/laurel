# Recon 01 — Hackathon intel, past winners, judges (as of 2026-10-26)

Source: research subagent. Web-search cap was hit partway; Devpost (403) and X (402) blocked fetching, so overall winners of [REDACTED] 2024 and 1T Agents are unverified.

## Site facts

- **Dates** unchanged: build Nov 1 00:00 → Nov 14 23:59 UTC; judging Nov 16–18; results by Nov 18 23:59 UTC (matches near.org announcement, Oct 19 2026).
- **Prizes** (USD, paid in NEAR; no conversion rate or vesting stated) — total $250K:
  - Grand prize: $55K (one)
  - Each of 13 tracks: 1st $10K · 2nd $3K · 3rd $2K
- **Judges (public)**: Illia Polosukhin (NEAR), Eddy Lazzarin (a16z crypto), Mert Mumtaz (Helius), Avichal Garg (Electric Capital), Kain Warwick (Synthetix/Infinex), Haseeb Qureshi (Dragonfly), Stepan Gershuni (cyber•Fund). **AI judges: Claude Code and Codex.**
- **Rules beyond basics**: one submission per team, not editable; unique name + email; multiple tracks in one submission; payout to NEAR mainnet account; repo public before deadline; X demo post mentioning NEAR HACKATHON with video/screenshots; description 20–2000 chars.
- **No scoring rubric.** FAQ points to past criteria: technical implementation, design, impact, originality, sustainability.
- Track-specific judging lines: Games "game loop, not the token"; Thesis "evidence, not the conviction"; Memecoins "mechanic, not the chart".
- **README**: what it is, problem, how to run as "do X → see Y" steps with expected result; name the NEAR tools used. "No marketing."
- Hackathon X account: @NEAR_hckthn.
- Recent news to align with: Oct 14 Mert joins NEAR Foundation Council · Oct 20 NEAR Business (confidential multisig treasury on SputnikDAO + Intents + MPC + confidential shard) · Oct 23 all Chain Signatures ops inside TEEs · Oct 1–2 NEAR Intents exploited ~$3.8M (patched, repaying) — relevant to defi/security.

## Past winners

| Yr · Event | Project | Prize | NEAR tech | Demo | Cplx | Why it likely won |
|---|---|---|---|---|---|---|
| 2024 ETHGlobal Singapore | Nearer | Control EVM accounts via NEAR | Chain Signatures + AI yield mover | GitHub | High | One NEAR account steering many EVM wallets, plus AI |
| 2024 Singapore | AuditGPT | User-owned AI | Forked NEAR CLI, Phala TEE agent | Loom | Med | Practical dev tool |
| 2024 Singapore | BlockElf | User-owned AI | NL queries over chain data | Live Vercel app | Med | Instantly usable |
| 2024 ETHGlobal SF | MAO One | User-owned AI | SGX enclave AI-run DAO | Live site + repo | High | Verifiable autonomous treasury (author pvolnov, likely HOT founder — unverified) |
| 2024 ETHGlobal Bangkok | NexusFi | Chain Signatures | Rust contract, Chain Sigs on EVM + BTC | Live app | Med-High | Cross-chain index funds without bridges |
| 2024 Bangkok | AIlice | User-owned AI | Chain Sigs wallets in XMTP chat agent | Live bot | Med-High | Agent controls real BTC/ETH wallets |
| 2024 ETHGlobal Brussels | Near AI Assistant | User-owned AI | py-near, open model | Web chat | Med | Agent sends real txs |
| 2025 ETHGlobal Unite | MOBINCH | Shade solver runner-up | Shade Agent in TEE | GitHub | High | Deep sponsor-tech match |
| 2025 Unite | 1Prime | Solver runner-up | NEAR escrow, EVM↔NEAR swaps | Live app + iOS | High | Siri-driven swaps |
| 2025 Useful Agents (NEAR AI/Electric) | Postt | 1st | NEAR AI inference + Agent Hub | Metrics-heavy | Med | Hard numbers (92% approval) |
| 2025 Useful Agents | DiligenceAI | 2nd | 7-agent pipeline | Metrics | Med-High | Multi-agent with measured gains |
| 2025 Useful Agents | NEAR Food | 3rd | TEE privacy | Metrics | Low-Med | Fun idea, privacy design |
| 2025 1T Agents | Ping Pay subscription agent | Absurd Agents | Shade Agent / TEE | ? | Med-High | Autonomous recurring payments |
| 2025 1T Agents | Bitcoin Agent | DeFi Agents | Chain Sigs → BTC L1 | ? | Med | Native BTC from an agent |
| 2024 [REDACTED] | Betvex | Native track (uncertain) | Bitte agent | ? | Med | Chat-native betting agent |

## Winner patterns

- **Complexity**: medium–high, but each winner used ONE NEAR primitive deeply + an AI layer, not many integrations. Past NEAR prizes were $2–5K; with $10K/track + $55K grand, expect a higher bar.
- **Rewarded features**: Chain Signatures (one account/agent controlling wallets on many chains) and TEEs (Shade Agents, Phala/SGX, private inference) dominate; Intents is the newest favourite. Current push: TEE-everything, confidential Intents, NEAR AI Cloud attestation, SputnikDAO treasuries.
- **Dominant archetype**: AI agent holding + moving real money across chains, used through chat (XMTP, Telegram, web).
- **Winning demos**: live deployed app/bot running real txs; quantitative proof of usefulness (Useful Agents demanded benchmarks — Avichal Garg co-ran it); many winners stacked 2–3 sponsor prizes → multi-track selection gives same leverage here.
- **For AI judges**: repo must run from README; reproducible steps, expected output per step, NEAR tools named.

## Judge dossier

| Judge | Org | Recent focus | Would champion | Would dislike | Quote (source) |
|---|---|---|---|---|---|
| Illia Polosukhin | NEAR co-founder, Foundation Council, NEAR AI | Private user-owned AI (NEAR AI Cloud enclaves + signed attestations), Intents, confidential compute. Posted a project-ideas list (x.com/ilblackdragon/status/2106269343881519444 — not yet read) | Agents on private inference + Intents / Chain Signatures | Centralized AI wrappers (inferred) | "Mert is a rare force in crypto, with a unique ability to be correct and vocal about it" (near.org, Oct 14 2026) |
| Mert Mumtaz | Helius CEO; NEAR Foundation Council since Oct 14 2026 | Privacy, Zcash/shielded payments, Solana–ZEC–NEAR interop | Private payments; open markets via Intents | CEX gatekeeping | "There is no world in which crypto succeeds but distinct markets are gatekept exclusively through CEXes" (near.org, Oct 14 2026) |
| Haseeb Qureshi | Dragonfly | "Crypto was not made for humans" (Feb 18 2026): agents with "self-driving wallets" transacting with each other | Agent-to-agent commerce | — | "When agents can discover other agents and enter into economic agreements autonomously, they will prefer crypto" (haseebq.com) |
| Avichal Garg | Electric Capital | Co-organized NEAR AI Useful Agents (metrics-driven). Co-authored "26 Opportunities in 2026" (Jan 2026): private AI agents, private pay-per-use, agent commerce, privacy-native L1s | Useful agents with measured impact; private pay-per-use | Toys without metrics (inferred) | "The service knows someone paid and how much, but not their identity" (data.electriccapital.com, co-authored) |
| Eddy Lazzarin | a16z crypto (GP since May 5 2026; ex-CTO, led Jolt zkVM; token design) | No first-person quote verified | Rigorous mechanism design | Weak tokenomics (matters for memecoins/NFTs) | Chris Dixon: "asks the right questions, pushes on weak assumptions" (a16zfrontier.com) |
| Kain Warwick | Synthetix / Infinex | Synthetix 2026: perps, multi-collateral margin, RWA markets (inferred) | DeFi with real volume | — | none verified |
| Stepan Gershuni | cyber•Fund | "The First Monastery for AI-native Founders" | AI-native founders | — | none verified |
| Claude Code, Codex | AI judges | Read repo + README | Runnable repo, "do X → see Y", named NEAR tools | Marketing copy, unrunnable code | — |

## Sources

- https://nearhackathon.com · https://nearhackathon.com/HACKATHON.md
- https://www.near.org/blog/near-hackathon-build-beyond-boundaries
- https://www.near.org/blog/mert-mumtaz-joins-near-foundation-council
- https://www.near.org/blog/introducing-near-business
- https://www.near.org/blog/chain-signatures-tee
- https://www.near.org/blog/building-useful-agents-sf-hackathon-shows-the-power-of-practical-ai
- https://www.near.org/blog/near-protocol-rewards-what-it-means-to-graduate-from-a-hackathon
- https://bitteprotocol.substack.com/p/from-experiment-to-adoption-how-bittes
- https://alphagrowth.io/spaces/one-trillion-agents-hackathon-winners-showcase-ns2
- ethglobal.com/showcase/: nearer-bwbft, auditgpt-0fti1, blockelf-qxtw5, mao-one-wyviu, nexusfi-x2cf5, ailice-8vst7, near-ai-assistant-jmwgf, mobinch-3fv20, 1prime-tf1g3
- https://decrypt.co/379929/morning-minute-near-intents-hacked-for-3-8m-was-it-a-bullish-hack
- https://haseebq.com/crypto-was-not-made-for-humans/
- https://data.electriccapital.com/posts/investing-in-user-owned-technology-26-opportunities-in-2026
- https://a16zfrontier.com/posts/article/eddy-lazzarin-general-partner/
- https://near.ai
