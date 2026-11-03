# Recon 06: Live competition scan (2026-11-02, build day 2)

Snapshot taken 2026-11-02 ~03:45 UTC. Read-only research: GitHub search API through `gh`, nearhackathon.com, HACKATHON.md, web search.

**What this covers and what it misses**
- GitHub: 30+ repo searches plus a few code searches. That gave 374 candidate repos. I pulled every README and kept the **213 that are clearly NEAR-related**. Of those, 148 name "NEAR HACKATHON" outright and 76 were created on or after Nov 1.
- Private repos can't be seen. Many teams will stay private until Nov 14, so read every count here as a **lower bound**.
- X/socials: **blocked**. xcancel.com returned HTTP 451. Nitter has shut down (its 10 Oct notice cites cease-and-desist letters from X). Web search indexes no x.com posts with #NEARHackathon. The Telegram builders chat (741 members) shows only its landing page, not its messages. There is **no social-media signal** in this file.
- Maturity labels: **working** = deployed contract or live URL, plus real code (>~200 KB). **scaffold** = code exists but is thin or incomplete. **idea** = README or plan only, or an empty repo. These come from README claims, repo size and live links. I did not run any of them.

---

## 1. Site updates since 26 Oct (matter for us)

| Date seen | Item | Source | Why it matters |
|---|---|---|---|
| 2026-11-02 03:43 UTC | **Submitted-projects counter = 45** (public `GET /api/applications` → `{"count":45}`; the homepage widget "SUBMITTED PROJECTS" reads it) | https://nearhackathon.com/api/applications | 45 final, non-editable submissions inside the first ~28 h. Many teams pre-built from Oct 19 and shipped on day 1. Re-check this counter daily to track field size. |
| live | **Q-001: code written before Nov 1 is allowed**, counting from the Oct 19 announcement. Earlier commits are treated as baseline. | https://nearhackathon.com/HACKATHON.md | Removes the eligibility worry in 00_SYNTHESIS (spike code before Nov 1 is OK). It also explains why so many repos are dated Oct 20–31. |
| live | Q-007: there is **no Intents testnet**, and none is planned. Use mainnet with tiny amounts and `dry: true` quotes. Q-006: no JWT needed (without one, the fee is 0.2%). | HACKATHON.md | Intents demos need mainnet dust. |
| live | Q-015: one person may enter **at most 2 independent projects**, and each README must name the other. Example: Hothit1 has DeadDrop + PinPay. | HACKATHON.md | Option to run two entries. |
| live | Q-017: Claude Code and Codex only **screen** entries (reproducibility, feature check, preliminary score). Humans decide. | HACKATHON.md | The README "do X → see Y" format is still critical. |
| live | The demo post must say "built at NEAR HACKATHON" and tag **@NEARProtocol + #NEARHackathon**. @NearLegion and @NearBuilders are optional. | HACKATHON.md, homepage | Replaces the older note about @NEAR_hckthn. |
| live | **Submission API**: `POST /api/applications`, one shot, can't be edited. Each repo can be submitted once; each email at most twice. The `website` field is a spam trap. | HACKATHON.md | Submit last. |
| live | Q-000: NEAR AI credits. Buy them, or claim **$10 free by joining NEAR Builders** (nearbuilders.org/join). | HACKATHON.md | Unblocks our S5b (NEAR AI inference) spike. |
| 2026-10-27 → 10-30 | **Official starter prompts per track**: `nearai/near-hackathon-prompt-examples`, updated Oct 30 with the Agent API, x402, TLA, near.social and Aurora Intents. Each prompt carries a default idea (table in §3). | https://github.com/nearai/near-hackathon-prompt-examples | **The biggest crowding driver.** Teams copy these default ideas almost verbatim (see §3). |
| live | DevHub YouTube walkthroughs of the track prompts, "as they come out" | https://www.youtube.com/channel/UCq0iWZQuXhvP8yQzDZsmWfQ | More pull toward the default ideas. Not checked. |
| live | **Agent API** (docs.agentsonintents.com): a policy-bound agent wallet with temporary demo keys from the partner dashboard. Named in the agents and security prompts. | 07-agents.md, 06-security.md | This is an official product of the "leash" idea, so the ~45 leash clones compete with it as well. |
| live | Partner table now also lists **GoMining, HEX, SVRN, Agent Market, NEAR Builders**. Partner notes: Rhea suggests CLMM/AMM pools, its swap API and **vaults on top of its lending**; Agent Market says "list your agent". | HACKATHON.md | No partner bounties or side prizes are listed anywhere. |
| — | No team gallery, no registration (only the final form), no new tracks, no rubric. `/tracks`, `/faq`, `/rules`, `/teams`, `/projects`, `/api/projects` all return 404. | curl of each path | Field size is visible only through the counter. |
| 2026-10-26 | NEAR Builders runs @NearHackathonBot (Telegram/Discord Q&A on NEAR AI Cloud) | https://github.com/NEARBuilders/hackathon-bot | — |

---

## 2. Projects found (most relevant 160 of 213, by track)

Track = the main track (from the README when stated, otherwise my guess). Date = repo creation date. I didn't re-check whether each live link still loads.

### security: AI Security & Defense (🔴🔴, ≈50 repos; ~30 are the same "leash" vault)
The security tagline "Give AI money without giving it the keys to everything" shows up word for word in dozens of READMEs.

| Name | Link | Idea | Created | Maturity |
|---|---|---|---|---|
| agent-leash | https://github.com/tab-for-akshay/agent-leash | on-chain spending policy for agents (built by an AI assistant) | 11-01 | working (vercel + `agent-leash.testnet`) |
| near-leash | https://github.com/halfabillion/near-leash | spending-cap vault + payee reputation registry | 11-02 | working |
| leash (Mattbusel) | https://github.com/Mattbusel/leash | policy wallet + shared blocklist + counterparty check (the official prompt) | 11-01 | working |
| leash (frankolien) | https://github.com/frankolien/leash | USDC spending account with caps and an allowlist | 11-01 | working |
| leash (apexweb-adam) | https://github.com/apexweb-adam/leash | spending firewall that is aware of prompt injection | 11-01 | scaffold |
| leash (MusaAis) | https://github.com/MusaAis/leash | vault-only spend layer | 10-31 | scaffold |
| leash-near | https://github.com/mesh-pch/leash-near | function-call key policy vault | 10-28 | scaffold |
| LeashPay | https://github.com/hassaanraja282-lgtm/leashpay | contract-enforced leash | 10-29 | working |
| tridon / AgentSpend | https://github.com/sufianweb3/tridon | per-user vaults + scoped keys | 10-24 | working |
| PolicyVault | https://github.com/CloudCorpRecords/policyvault | policy-gated agent wallet | 10-27 | scaffold |
| SpendGuard AI | https://github.com/Anhmy1312/spend-guard-ai | intercept + limits | 10-27 | scaffold |
| near-agent-spend-guard | https://github.com/mubudot/near-agent-spend-guard | allowlist, caps, owner approval | 10-30 | working |
| Semilla1 Guard | https://github.com/semilla1lab/semilla1-guard-near | spending policy vault | 10-31 | scaffold |
| bound-wallet | https://github.com/blocknbull/bound-wallet | limits the agent cannot change | 10-31 | working |
| Veto | https://github.com/Bronxydrone/Veto | policy-as-data firewall + hash-chained audit | 10-31 | working |
| Kyrona | https://github.com/thesithunyein/kyrona | list, cap, lock | 11-01 | working |
| tollgate (kimdooo-a) | https://github.com/kimdooo-a/tollgate | vault + blocklist + human queue | 11-01 | scaffold |
| Agent Toll | https://github.com/devx-agent/near-agent-toll | FC key + policy contract | 11-02 | working (hosted) |
| Countersign | https://github.com/team-attention/countersign | auto-pay inside limits, everything else waits for a human | 10-31 | working |
| Allowance | https://github.com/soldanoandrea/allowance | sandboxed agent treasury | 10-31 | working |
| agent-allowance | https://github.com/KC-137/agent-allowance | same | 11-01 | scaffold |
| Banbo | https://github.com/Mhiah/Banbo | wallet firewall, shared treasury | 11-01 | working |
| Scopeguard | https://github.com/Sergeo01/Scopeguard | scoped passkeys for agents | 11-01 | working |
| claw-guard-near | https://github.com/metafrogmeme-droid/claw-guard-near | signing gate before chain signatures | 11-01 | working |
| Sana Guard | https://github.com/0xjume/sana-guard | NEAR contract as sole signer of an agent's Solana wallet | 10-30 | working |
| Tapproved / TapLock | https://github.com/manex-tech/tapproved | ESP32 hardware button approves large spends | 11-01 | scaffold |
| intented | https://github.com/furqaannabi/intented | actions gated by TEE-signed verdicts (NEAR AI Cloud) | 11-01 | scaffold |
| IntentGuard | https://github.com/tim963852741/intentguard | policy-gated rail on Intents | 11-01 | scaffold |
| Mandate (×2) | https://github.com/bimataylorjoy/Mandate · https://github.com/blessedorji3/mandate | mandate-bound agent authority | 10-31/11-01 | scaffold |
| AgentGuard (×3), Sentinel, AI Wallet Guardian, Rootbound, near-agent-guard (×2), VaultAI, nearallowance | nimrid/agentGuard, Ibrahimjibril/agentguard, BigWave45/agentguard, NathanOyewole/sentinel, muhammad884/near-ai-wallet-guardian, wahab09033/rootbound, hahahahahahahahah6/near-agent-guard, song11071696/near-agent-guard, emmyloyal/* | more variants of the same thing | 10-26→11-01 | idea/scaffold |
| agent-pay-public | https://github.com/tmdry4530/agent-pay-public | policy plus human approval, PayPal + NEAR rails | 11-01 | working |
| CircuitsAI | https://github.com/hackcat29/CircuitsAI | scoped wallets, chain sigs, private inference | 10-31 | working |
| near-hermes-browser | https://github.com/TerexitariusStomp/near-hermes-browser | agent in a browser tab with a non-extractable vault | 11-01 | working |
| **Tripwire** | https://github.com/Afar88/tripwire | open scam/risk registry + checker (the official prompt) | 11-01 | working (Rust, testnet) |
| AEGIS | https://github.com/Rainyy99/aegis | gate against injected third-party instructions | 11-01 | working |
| Hushmark | https://github.com/Ritapossible/Hushmark | GitHub check that blocks hidden agent instructions | 11-01 | scaffold |
| near-key-scope | https://github.com/DesignMaster-Solutions/near-key-scope | read-only audit of an agent key's permissions | 10-31 | scaffold |
| Key Doctor | https://github.com/BLV-Labs/keydoctor | key-risk scoring for Sputnik DAO councils | 10-29 | working |
| rector-arena | https://github.com/RECTOR-LABS/rector-arena | "Damn Vulnerable Agent Wallets" arena | 10-31 | scaffold |
| **Clearance** | https://github.com/Selliksss/clearance | crash test + on-chain spending certificate for agents, listed on market.near.ai | 10-26 | working |
| Crucible | https://github.com/1momoh/crucible | talk the AI treasurer into paying you (bounty game) | 11-01 | working |
| KAIGEN | https://github.com/Andrew-Kevin-007/KAIGEN | post-quantum, self-retiring keys | 11-01 | working |
| blackbox | https://github.com/tenxagent/blackbox | flight recorder for agent money decisions, head anchored on SocialDB | 10-31 | working |
| settled | https://github.com/let-the-dreamers-rise/settled | an idempotent "pay once" contract | 11-01 | scaffold |
| near-agent-payment-checker, Warden, euthyna-signer, OmniSwarm | fliptrigga13/…, smog123/Warden, Euthyna-wallets/…, recferret-bit/OmniSwarm | approval validity check / auth testing / signer / audit swarm | 10-26→11-02 | idea/scaffold |

### agents: Agent Economy (🔴, ≈25)
| Name | Link | Idea | Created | Maturity |
|---|---|---|---|---|
| CEOClaw agent-economy | https://github.com/CEOClaw/agent-economy-near | agents hire agents over MCP | 10-21 | idea |
| tollgate (Mattbusel) | https://github.com/Mattbusel/tollgate | x402 micropayment channels with signed vouchers | 11-01 | working |
| gliana-near-x402 | https://github.com/Gliana-Labs/gliana-near-x402 | chain sigs pay x402 on Base | 10-28 | scaffold |
| Penstock | https://github.com/ace-coderr/penstock | x402 paywall in front of any API/MCP, paid via Intents | 11-01 | scaffold |
| x402Interop | https://github.com/the3rdweblabs/x402Interop | x402 cross-chain settlement | 11-01 | scaffold |
| PayPerCall | https://github.com/devx-agent/near-paypercall | escrowed pay-per-call | 11-02 | working |
| near-bot-desk | https://github.com/kwelx/near-bot-desk | pay 1 NEAR per bot skill | 10-31 | scaffold |
| **PatchBond** | https://github.com/PatchBond/patchbond | refundable PR bonds; an AI judge in a TEE refunds or forfeits | 10-28 | working (railway) |
| proof-of-done | https://github.com/team-attention/proof-of-done | coding agents stake on "done", hidden tests decide | 10-31 | working |
| judge-near / trust-toll / escrow-market | vijaygopalbalasa/judge-near, nnyycc77-ship-it/trust-toll-near, Fuma2514/near-agent-escrow-market | judge-gated escrow for agent work | 11-01 | idea/scaffold |
| Sealwork | https://github.com/NSEVEjk0/sealwork | private agent jobs, attested acceptance, escrow | 10-30 | working |
| ACH | https://github.com/NSEVEjk0/ach | multilateral netting of agent micro-debts | 10-26 | working |
| Loca | https://github.com/redaicodes/loca | credit layer: agents borrow against paid work | 11-01 | working |
| AgentHub | https://github.com/scribbler421/agenthub | certified agents (SBT résumé) get hired | 11-01 | scaffold |
| **Ballast** | https://github.com/olliechap/near-autobalancer | auto-balances NEAR AI stake-for-inference vs a staking pool | 11-01 | working |
| Bouncer | https://github.com/Greatmujey/Bouncer | autonomous procurement of compute/storage/API | 10-26 | working |
| datagent | https://github.com/harjaapdhillon16/datagent | private data paid per access | 10-27 | working |
| nearswaps-agents | https://github.com/nearswaps/nearswaps-agents | bot trades from a 1-click balance only the owner can withdraw | 10-28 | working |
| PinPay | https://github.com/Hothit1/pinpay | pay-per-result marketing by agents | 10-30 | working |
| labounty | https://github.com/tantasui/labounty | bounty hunters in a TEE | 10-30 | scaffold |
| EarnScout, IntentPilot, nexus-aios | 1Hustle/earnscout, midnightmichigan/intentpilot, ykbojak-alt/nexus-aios | vet opportunities / Intents payment agent / agent OS | 10-28→11-01 | idea/scaffold |

### business: Autonomous Business (🟡, ≈10)
| Name | Link | Idea | Created | Maturity |
|---|---|---|---|---|
| Tune Up Research Desk | https://github.com/tuneupargentina/tuneup-research-desk | on-chain receipts for research reports (≈ the official "research shop" prompt) | 11-01 | working |
| Greed Machine | https://github.com/greyw0rks/greed-machine | agents debate opportunities, bounded treasury | 10-26 | working |
| Throughput Treasury | https://github.com/khrisdidukh/throughput-treasury | AI CFO pays only for work at the constraint | 10-31 | scaffold |
| DAO Command Center | https://github.com/ayushsingh82/dao-command-center | AI strategies for a DAO treasury | 10-30 | scaffold |
| Nnetics | https://github.com/Technique-S/Nnetics | contractor invoice desk run by an agent | 10-29 | scaffold |
| SUNSET | https://github.com/luch91/sunset | finite-purpose treasuries | 10-29 | scaffold |
| Nearchant | https://github.com/vlmoon99/nearchant | AI shop assistant: posts, insights, buyers pay through NEAR | 10-31 | working |
| SymbioChain, Allocard | SuyashAlphaC/symbiochain-core, Stoneybro/Allocard-near | agent treasury backend / delegation | 10-27/11-01 | scaffold |

### thesis: Investment Thesis (🔴, ≈13; ≥6 test the official prompt's hypothesis)
| Name | Link | Idea | Created | Maturity |
|---|---|---|---|---|
| near-thesis | https://github.com/soldanoandrea/near-thesis | reproducible thesis (20 MB) | 10-31 | working |
| near-thesis-data | https://github.com/nikolaskahris-png/near-thesis-data | fee → holder value chain | 10-31 | working |
| near-agent-economy | https://github.com/tenxagent/near-agent-economy | pre-registered tests, hash on NEAR (written by an autonomous agent) | 10-31 | working |
| usage-before-price | https://github.com/minorCoder/near-usage-before-price | **the exact prompt hypothesis** | 11-01 | working |
| near-usage-thesis | https://github.com/lisaaai200/near-usage-thesis | same | 11-01 | scaffold |
| near-investment-thesis | https://github.com/ridakalam52-design/near-investment-thesis | dashboard + model | 11-01 | working |
| IndiciaDesk | https://github.com/Lvalentine16/near-thesis-indiciadesk | 10 falsifiable claims re-scored daily | 11-01 | working |
| near-intents-thesis (×2) | https://github.com/Apihpih96/near-intents-thesis · https://github.com/HATWHY4041/near-intents-thesis | does Intents volume accrue to NEAR? | 10-29/11-01 | scaffold |
| NearQuery | https://github.com/EmekaManuel/nearquery | Intents as a value driver | 10-30 | working |
| Popper / tripwire / thesis-tested | trinnode/popper, daniels-martins/tripwire, Alamutu1/near-thesis-tested | falsifiable thesis / route scoreboard / claim checker | 10-28→11-02 | idea/scaffold |

### defi: Unstoppable DeFi (🟡, ≈15; nobody found on the default DCA vault)
| Name | Link | Idea | Created | Maturity |
|---|---|---|---|---|
| **Intercept** | https://github.com/eugenennamdi/Intercept | Kamino (Solana) liquidation defense using idle Base funds: NEAR AI TEE + chain sigs + 1Click | 10-28 | working |
| KINU LP Guardian | https://github.com/kinuonnear/kinu-lp-guardian | agent keeps a Rhea DCL position in range, within contract rules (OutLayer) | 10-28 | working |
| **Confidential Trenches / Blindfill** | https://github.com/UNRLZD/confidential-trenches | private trading engine, keyless vault, `@blindfill/kit` | 11-01 | working (17 MB) |
| Sealwell | https://github.com/Godwin-web3/sealwell | sealed-bid batch auctions for Intents solver quotes (MPC CKD) | 10-26 | working |
| terra-matcher | https://github.com/archtum66-dev/terra-matcher | non-custodial order matching for an Intents exchange | 10-30 | scaffold |
| HyperFlow, Plainswap, XAUConnect | apariel777-ui/HyperFlow, hms1499/Plainswap, akhilexx/xauconnect-gold-router | spot marketplace / chat swaps / gold router | 10-28→11-01 | scaffold |
| **Pearn** | https://github.com/pearn-protocol/pearn | no-loss prediction market betting stNEAR yield | 10-30 | working |
| DragonsMarket | https://github.com/SHC-Labs/DragonsMarket | rules-first prediction market, jury of holders | 11-02 | idea (empty repo) |
| AEGIS (Ayan1816) | https://github.com/Ayan1816/aegis | private DeFi copilot with a budget firewall | 11-02 | scaffold |
| Intents swap tracing cluster | https://github.com/AustinChris1/quittance · https://github.com/cryppit/wheres-my-swap · https://github.com/onlysniper447-stack/neer · https://github.com/ShalyX/intent-rescue | receipts, tracing, preflight and incident response for 1Click swaps (**4 repos**) | 10-20→11-01 | working |
| Tidepool | https://github.com/zer0plugyut-afk/tidepool-examples | community testnet 1Click-compatible sandbox | 10-27 | working (infra) |

### privacy: Privacy & Private AI (🟡; "sell encrypted data/secrets" sub-lane 🔴, ≈20 total)
| Name | Link | Idea | Created | Maturity |
|---|---|---|---|---|
| **NEAR Private OTC** | https://github.com/Watchmeecryt/near-private-otc | OTC deal board, sealed terms, atomic Intents fill (**cites Illia's list**) | 10-20 | working (live railway app) |
| Darkroom | https://github.com/nice-bills/darkroom | market for secrets in an enclave, agents negotiate (NDAI) | 11-01 | working |
| DeadDrop | https://github.com/Hothit1/deaddrop | sell encrypted files, escrowed key, dead-man switch | 10-30 | working |
| annon | https://github.com/defdone/annon | SDK: files only the buyer can open | 11-02 | idea |
| Blindsight | https://github.com/Prosperlinho/Blindsight | confidential data marketplace | 10-27 | working |
| Sirius | https://github.com/alibenyezza/sirius-near | dataset NFTs with a keyless vault, TEE training escrow | 10-31 | working |
| Jurat | https://github.com/nftkingiii/jurat | prove a confidential balance ≥ X without revealing it | 10-22 | working |
| Skyll | https://github.com/FalkramHQ/skyll-private-grading | private AI exam grading (minors) on NEAR AI Cloud | 11-01 | working (real company) |
| **Sir Near** | https://github.com/buterbro-cell/knight-site | verifiably private voice assistant for clinics, banks, law firms | 11-01 | working |
| VeilProcure | https://github.com/Olalekan2345/veilprocure | sealed bids + attested AI evaluation | 10-29 | working |
| Veridom Pay | https://github.com/khrisdidukh/veridom-pay | private AI inspector releases construction milestone pay | 10-31 | working |
| tee-receipts | https://github.com/tmdry4530/tee-receipts | NEAR AI Cloud signatures anchored as on-chain receipts | 11-01 | working |
| Zcash/Intents linkability (×3) | https://github.com/KristenAB/lethe-zcash · https://github.com/nickthelegend/zec-unlinkable-swaps · https://github.com/softalpha0/Crowdline | unlinkable ZEC swaps through 1Click | 10-25→10-28 | working |
| moopay, BioSeal, Private Flex Inference Auctions, private-ai chat | UnclePhil1/moopay, Abdulazeez41/BioSeal, SPIKESPIGEL404/…, Zoldenburg-me/private-ai | private payments MCP / condition settlement / inference auction / TEE chat | 10-29→11-01 | idea→working |

### swarms: AI Swarms (🟢/🟡, ≈5; nobody found on the default group-buying swarm)
| Name | Link | Idea | Created | Maturity |
|---|---|---|---|---|
| Swarm Bazaar | https://github.com/HATWHY4041/swarm-bazaar | agent bazaar | 10-30 | scaffold |
| sage-sentinel | https://github.com/kryptokora69-dot/sage-sentinel | paper-only agent swarm | 11-01 | idea |
| OmniSwarm | https://github.com/recferret-bit/OmniSwarm | multi-agent security review swarm | 11-01 | scaffold |
| (ACH, Sealwell, flex-inference auctions above also touch on swarms) | | | | |

### realworld: Real-World Money (🔴 on freelancer invoicing; 🟡 overall, ≈20)
| Name | Link | Idea | Created | Maturity |
|---|---|---|---|---|
| settl | https://github.com/ZSP111/settl | freelancer invoices in USDC with splits (**prompt clone**) | 10-28 | working |
| Invoice Link | https://github.com/ayinmodeolarewaju-bot/invoice-link | get paid from any chain (**prompt clone**) | 10-26 | working |
| Pay Me in Anything | https://github.com/HATWHY4041/pay-me-in-anything | one payment link, receive USDC (**prompt clone**) | 10-29 | working |
| InvoiceFlow | https://github.com/miku-wwl/invoiceflow-near | cross-chain invoicing (**prompt clone**) | 10-29 | idea |
| Lancer, Taskora, Clear to Pay | Paru-Saha/Lancer, R-byte028/taskora-, joezzy-web3/clear-to-pay | freelance milestones / job prep / payment clearing | 10-25→11-01 | idea→working |
| NairaRails | https://github.com/Esimuda/nairarails | pay Nigerian bills in USDC through Intents | 10-29 | working |
| BillSettle | https://github.com/Techfrontiers/billsettle | small-shop bills with receipts | 11-01 | scaffold |
| OpenRamp | https://github.com/Ikwame91/near-momo-p2p | P2P mobile money ↔ USDC escrow | 11-01 | scaffold |
| Bolsillos | https://github.com/tuneupargentina/bolsillos | household USDC pockets with allowances | 11-01 | working |
| Ajo on NEAR | https://github.com/HATWHY4041/ajo-on-near | rotating savings (ROSCA) | 10-30 | working |
| NEARPay (×2) | https://github.com/ethcryptohub/nearpay-app | testnet POS + checkout portal | 10-31 | scaffold |
| taply | https://github.com/KendineCrypto/taply | merchant "handshake" payments, protected pay | 10-31 | scaffold (says no deployment yet) |
| TabWrit | https://github.com/Lesnak1/tabwrit | contract-enforced spending tabs for merchants and agents | 11-01 | working |
| Hearthold, Hindsight, Trustpal, TurnLoop | jaywon111/hearthold, Nnadijoshuac/hindsight, omni6nt/trustpal-agent, khdadadyalyas2-arch/turnloop | rent escrow / cashflow forecast / trust agent / school-walk rotation | 10-26→11-01 | idea/scaffold |
| Sluice (not a NEAR HACKATHON entry) | https://github.com/swiftbotlabs/sluice-pay | checkout link for Solana merchants via Aurora Intents (Encode Solana hackathon) | 11-02 | working |

### games: Games With Real Economies (🟡, was 🟢; ≈15; "NPC merchant market town" sub-lane 🔴)
| Name | Link | Idea | Created | Maturity |
|---|---|---|---|---|
| **Kibble** | https://github.com/isaacessuman/kibble | AI pet NFT that pays for its own TEE inference; arena, odds, market (**Illia's tamagotchi**) | 10-21 | working (**mainnet**, playkibble.com, 292 MB repo) |
| NEARLIFE | https://github.com/TeevincsCrypt/nearlife | mobile 3D life sim, player-to-player economy | 10-20 | working (nearlife.vercel.app) |
| MarketTown | https://github.com/Mercy-Macco5/market-town | pixel-art market sim (**prompt clone**) | 11-01 | idea |
| Hearthmarket | https://github.com/nguyenkhangph/hearthmarket | AI NPC village, real weather moves prices | 10-27 | scaffold |
| Genesis Town | https://github.com/leutenantKiya/Genesis-Town | town economy | 10-31 | scaffold |
| Near Genesis / Agentic | https://github.com/EcosystemNetwork/Agentic | pirate black-market trading | 10-21 | scaffold |
| Bazaar of Liars | https://github.com/lopeselio/bazaar-of-liars | haggle with bluffing AI merchants; the chain proves the bluffs were fair | 10-31 | idea |
| Grudgebound | https://github.com/abhishiv17/GrudgeBound | creature-binding; players rewrite the rules | 11-01 | working (12 MB) |
| TerraAgent | https://github.com/recferret-bit/terraagent | autonomous colony builder | 10-29 | working |
| RobinHoot Heist / Kingdom | https://github.com/HuRiKh4n/robinhoot-heist | crash game that burns a memecoin into a prize pool | 11-01 | scaffold |
| NEAR Agent Arena | https://github.com/yohunshadow/NEAR_AGENT_ARENA | back AI fighter agents with escrowed treasuries | 10-31 | working |
| fe2VI | https://github.com/Yorxsm/fe26 | arena where AI agents play and humans watch | 10-27 | working |
| Dino Escape, nyrgo, QuestLayer | BrendaCali/ppreueba1din, PoorInfz/nyrgo, promptstudio3000/questlayer-hackathon | puzzle duels / geo creature RPG / exploration | 10-29→10-31 | scaffold |

### nfts: NFTs That Do Something (🟡, was 🟢; ≈8)
| Name | Link | Idea | Created | Maturity |
|---|---|---|---|---|
| perp-agent-nft | https://github.com/Jadenprosper/perp-agent-nft | the NFT *is* a Hyperliquid perp-trading agent | 11-01 | working |
| MuSecure Beats | https://github.com/Fsk8/musecure-beats | beat NFT owns money, cascading royalties, cross-chain account | 10-21 | working |
| Sirius | (above) | dataset NFT with a vault | 10-31 | working |
| Stash | https://github.com/buterbro-cell/stash | no-code NFT collections that hold tokens | 10-29 | scaffold |
| OpenNear | https://github.com/ONOSPETER/OpenNear | bridge NEAR NFTs to OpenSea via chain sigs | 10-28 | scaffold |
| Autonomous Business NFT | https://github.com/Kenniseofficial/autonomous-business-nft | NFT that runs its own business | 10-31 | idea |
| Vessel | https://github.com/trinnode/vessel | cross-chain portfolio NFTs | 11-02 | idea |

### memecoins: Memecoins With Mechanics (🟢/🟡, ≈5)
| Name | Link | Idea | Created | Maturity |
|---|---|---|---|---|
| WARBAND | https://github.com/alibenyezza/warband-near | holders level up the longer they hold; war chest run by Sputnik | 10-31 | working |
| $GREMLIN | https://github.com/0xdfinity/gremlin | ritual streak token (**≈ prompt "streak coin"**) | 10-31 | idea |
| RobinHoot Heist | (above) | burn on loss + Sunday prize pool | 11-01 | scaffold |
| NEAR Analyzer Bot / Wallet Tracker | https://github.com/LoveTon-crypto/near-analyzer-bot | degen toolkit | 10-25 | working |
| Safe Near entity tracker | https://github.com/poppingbean/entity-tracker | who buys launchpad tokens early | 10-20 | working |

### social: Social Money (🟢, ≈4)
| Name | Link | Idea | Created | Maturity |
|---|---|---|---|---|
| Njangi | https://github.com/mbanyadev/njangi | ROSCA where each circle is its own Sputnik DAO | 11-01 | working |
| Ajo on NEAR | (above) | ROSCA | 10-30 | working |
| Key Doctor | (above) | Sputnik council key risk | 10-29 | working |
| DAO Command Center | (above) | AI strategies for a DAO | 10-30 | scaffold |

Trezu appears only in passing in 3 READMEs, and near.social only as blackbox's anchor. I found **no clone** of the default "bounty board with earned trust".

### open: Open Innovation (🟡, ≈8; inheritance sub-lane 🔴)
| Name | Link | Idea | Created | Maturity |
|---|---|---|---|---|
| Morrowseal | https://github.com/zer0plugyut-afk/morrowseal | inheritance vault with a dead-man timer and OutLayer TEE (**prompt clone**) | 10-31 | working |
| Pal | https://github.com/Pal-networks/Contract | inheritance vaults over ETH via chain sigs (**prompt clone**) | 11-01 | working |
| Shelflife | https://github.com/Savage27z/Shelflife | verify that deployed wasm matches GitHub source | 11-01 | scaffold |
| NEAR Tap | https://github.com/manex-tech/near-tap | ESP32 proof-of-presence attendance on NEAR (no escrow) | 10-29 | working |
| CONTRA | https://github.com/kellyxy110/CONTRA | NEAR-native adjudication protocol | 10-28 | idea |
| NEAR AI for VS Code, PROCTOR runner | VitalPointAI/near-ai-vscode, egbujor-emmanuel/proctor-runner | dev tooling / OutLayer exam runner | 10-26/11-01 | working/idea |

---

## 3. The official prompts drive crowding

`nearai/near-hackathon-prompt-examples` gives each track a default idea. Counts are how many public repos were found building it.

| Track | Default idea in the official prompt | Copies found | Verdict |
|---|---|---|---|
| security | counterparty check / spending-limit leash ("money without the keys") | **~45** leash-type + Tripwire, Mattbusel/leash, halfabillion | 🔴🔴 avoid |
| thesis | "Intents volume leads usage better than price" | **≥6** use the same hypothesis | 🔴 |
| realworld | crypto invoicing for freelancers | **≥5** (settl, invoice-link, pay-me-in-anything, invoiceflow, Lancer) | 🔴 |
| open | inheritance account through chain sigs | **2–3** (Morrowseal, Pal; DeadDrop has a dead-man switch) | 🟡 |
| games | market-town with NPC merchants | **4–5** (MarketTown, Hearthmarket, Genesis Town, Agentic, Bazaar of Liars) | 🔴 for this sub-lane |
| business | one-agent research shop | 1–2 (Tune Up Research Desk) | 🟡 |
| memecoins | streak / check-in coin | 1–2 (GREMLIN, WARBAND is similar) | 🟡 |
| defi | cross-chain DCA vault | **0** | 🟢 |
| privacy | private expense auditor | **0** | 🟢 |
| swarms | group-buying GPU swarm with sealed bids | **0** (only loosely related) | 🟢 |
| agents | general contractor agent that hires agents | 1–2 loose (CEOClaw, Bouncer) | 🟡 |
| nfts | membership NFT that carries its own wallet + share of event tickets | **0** | 🟢 |
| social | bounty board with earned-trust tiers on Sputnik/Trezu | **0** | 🟢 |

## 4. Crowding by track

| Track | Rating | Evidence (public repos, lower bound) |
|---|---|---|
| security | 🔴🔴 | ≈50 repos, ≥30 near-identical leash vaults; the official Agent API productizes the same idea |
| agents | 🔴 | ≈25: x402 paywalls (×5), judge-gated work escrow (×6), agent credit/netting/arena |
| thesis | 🔴 | ≈13, ≥6 on the identical hypothesis, several already polished (20 MB repos) |
| realworld | 🟡 overall / 🔴 invoicing | ≈20. Invoicing ×5, ROSCA ×2, bill pay ×2, POS ×2 |
| privacy | 🟡 / 🔴 "sell secrets/data" | ≈20. Data/secret markets ×6, Zcash linkability ×3, private OTC already live |
| defi | 🟡 | ≈15, but spread thin. Intents swap-tracing tools ×4. No DCA, no delta-neutral, no lending/perps venue |
| games | 🟡 (was 🟢) | ≈15. Market-town clones ×4–5. Kibble (mainnet) and NEARLIFE are strong |
| business | 🟡 | ≈10, mostly agent-treasury variants |
| open | 🟡 | ≈8. Inheritance ×2–3 |
| nfts | 🟡 (was 🟢) | ≈8, mostly "NFT owns money". Nobody on TLA names-as-NFT or membership + tickets |
| swarms | 🟢 | ≈5, weak |
| memecoins | 🟢 | ≈5 |
| social | 🟢 | ≈4. Trezu effectively unused |

## 5. Crowding for each of Illia's ideas

| # | Illia idea | Rating | Who (link, date, maturity) |
|---|---|---|---|
| 1 | AI tamagotchi (NEAR AI) | 🔴 | **Kibble** https://github.com/isaacessuman/kibble (10-21, working on mainnet, cites Illia). One dominant, very mature entry. |
| 2 | Universal Intents checkout widget | 🟡 | Nobody has an embeddable Shopify-style widget. Nearby: payment links (Pay Me in Anything, Invoice Link), POS (NEARPay, taply), Penstock (x402 for APIs), Sluice (Solana, other hackathon). |
| 3 | AI encyclopedia + prediction markets | 🟢 for encyclopedia + PM | Prediction markets only: Pearn (no-loss, working), DragonsMarket (empty), Kibble's odds contract. No knowledge/encyclopedia angle. |
| 4 | Private OTC via Intents private deals | 🔴 | **NEAR Private OTC** https://github.com/Watchmeecryt/near-private-otc (10-20, live, cites Illia). Nearby: Darkroom, Blindfill, Sealwell, terra-matcher. |
| 5 | Never-get-liquidated manager | 🟡 | **Intercept** (Kamino on Solana, working); KINU LP Guardian (Rhea DCL range, working). Nobody protects Rhea/Burrow **lending** positions on NEAR. |
| 6 | Kickback-style event escrow | 🟢 | **None found.** The closest is NEAR Tap (ESP32 attendance proof, no deposits). The NFT prompt mentions event ticket sales, but no one has built it. |
| 7 | Private code review | 🔴 (already built) | MultiAgency Private Investigator exists. PatchBond (TEE AI judge on PRs, working), labounty, Hushmark, OmniSwarm. |
| 8 | Company cap table | 🟢 | None |
| 9 | Delta-neutral via Intents | 🟢 | None |
| 10 | Private copy-trading via viewing keys | 🟢 | None. "viewing key" in recent NEAR READMEs gives zero relevant hits. |
| 11 | Private medical second opinion | 🟢/🟡 | None direct. Sir Near (private assistant for clinics etc., working) and pii-sanitizer (medical PII + NEAR AI Sage, not a hackathon entry) are close. |
| 12 | Private Granola (transcription) | 🟢 | None on NEAR. Off-NEAR on-device tools exist (Hushpad, motetto). |
| 13 | Private AI benchmarking | 🟢 | None direct. Clearance (agent crash test) and neo-sky/near-geo-benchmark are only adjacent. |

Only Kibble and NEAR Private OTC cite Illia's list (https://x.com/ilblackdragon/status/2106269343881519444) in their READMEs.

## 6. White space: gaps nobody seems to be building

1. **Kickback-style event escrow (Illia #6)**: zero repos. Our spikes S13, S14, S10, S7 and S6a already cover it. It fits **social** (🟢) plus **realworld**, and it overlaps the NFT prompt's "membership + event tickets". No public competitor yet.
2. **Social track on Sputnik/Trezu**: the default "bounty board with earned trust" has no taker, and Trezu is effectively unused. Community-money apps with reputation tiers are open. Only ROSCAs (Njangi, Ajo) are there.
3. **NFTs as accounts via Top Level Accounts (TLA)**: no one builds on the TLA contracts that the prompts link (houseofstake/tla-contracts), and no membership NFT carries its own sub-account. The track is 🟡 but this angle is empty.
4. **DeFi beyond swaps**: no DCA vault (the default), **no delta-neutral via Intents (#9)**, no Rhea-lending liquidation guard on NEAR (#5 on NEAR), no lending or perps venue. Rhea's partner note asks for "vaults on top of its lending" and nobody answers it.
5. **Private AI for professionals**: no **medical second opinion (#11)**, no **private meeting transcription / Granola (#12)**, no **private AI benchmarking (#13)**, no **cap table (#8)**, no **private copy-trading by viewing key (#10)**, and nobody on the privacy default (private expense auditor). Privacy is busy, but only around data markets and Zcash.
6. **Swarms**: the default group-buying sealed-bid swarm has no taker. The track is thin overall.
7. **Embeddable merchant checkout widget (#2)**: payment links and invoices are crowded, but no drop-in widget or Shopify plugin on NEAR Intents was found.

Avoid: leash/spending-limit vaults, x402 paywalls, judge-gated agent escrow, freelancer invoices, the "Intents vs price" thesis, encrypted-file or secret marketplaces, inheritance vaults, NPC market-town games, AI pets (Kibble), and private OTC.

## 7. Method notes and sources
- Searches (all 2026-11-02): `near hackathon created:>=2026-10-25`; `"NEAR HACKATHON" in:readme,description created:>=2026-10-25` (138 hits); `near intents created:>=2026-10-25` (28); README searches for each Illia keyword; partner/tech keywords (NEAR AI Cloud 58, chain signatures 82, near-api-js 56, NEP-171 16, NEP-245 10, Sputnik 8, Trezu 3, Agent API 3). Raw output is in the scratchpad (not kept).
- Official: https://nearhackathon.com · https://nearhackathon.com/HACKATHON.md · https://nearhackathon.com/api/applications · https://github.com/nearai/near-hackathon-prompt-examples · https://github.com/NEARBuilders/hackathon-bot · launch post https://x.com/NEARProtocol/status/2112257967818997891 (Oct 19, seen through search results, not fetched).
- Blocked or empty: xcancel.com (451), nitter.net (shut down), x.com (not fetched), t.me/s/nearbuilderschat (landing page only), nearbuilders.org/projects (0 entries loaded), web search (no x.com posts indexed for #NEARHackathon).
- Not verified: live URLs, mainnet claims (e.g. Kibble's), and any repo's track or maturity beyond README and size.
