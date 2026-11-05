# laurel-mcp — the model as a tool for AI agents (5 Nov 2026)

`mcp/` holds an [MCP](https://modelcontextprotocol.io) server (stdio) so any agent host (Claude Desktop, Claude Code, Cursor, …) can use Laurel without the repo's scripts: browse exhibits and leaderboards, download a model's bytes from the contract, run the model locally with the contract's integer arithmetic, and call the champion on-chain through `predict_task`.

## Verified on 5 Nov 2026 (`mcp/test/smoke.mjs`, run with `--onchain`)

| Step | Result |
|---|---|
| `laurel_list_exhibits` | 4 tasks (1 closed, 2 open, 3 closed, 4 open) |
| `laurel_exhibit(3)` | champion #4, 2 entries, split B shown (closed) |
| `laurel_specimen(6)` (task 4, open) | `score_b_bps: null`, raw `b` replaced by "sealed until the task closes" — the sealed rule is enforced client-side too |
| `laurel_download_model(4)` | 33,011 B, sha256 `214f89a6c774…`, 50 trees, depth 4 |
| `laurel_predict_local(4, holdout row 0)` | raw score **811014**, label 1 |
| `laurel_credit` (agent `agent.laurel-team-mw0x0c8g.testnet`) | 0.034 NEAR prepaid |
| `laurel_predict(3, holdout row 0)` on-chain | raw score **811014**, label 1, tx [`ZockCH1Mn22p3BmMCPpucmj1zx2PvmUioiykqkKe6Hs`](https://testnet.nearblocks.io/txns/ZockCH1Mn22p3BmMCPpucmj1zx2PvmUioiykqkKe6Hs), 4.34 Tgas |

Local == on-chain for the same bytes, which is the point: an agent can check the chain's answer against the model it downloaded, and other contracts can rely on the on-chain call without trusting this package. The same row produced 811014 through `tools/agent.mjs` on 4 Nov (`docs/AGENT.md`).

The on-chain call was signed with the demo agent's **function-call key** (allowed methods `predict_task`, `predict` on the final contract only), the same key `docs/AGENT.md` proves is rejected by the protocol for anything else.

## Install

```json
{ "mcpServers": { "laurel": { "command": "npx", "args": ["-y", "laurel-mcp"] } } }
```

Claude Code: `claude mcp add laurel -- npx -y laurel-mcp`. From a clone: `cd mcp && npm install && node server.mjs`. To predict on-chain add `LAUREL_ACCOUNT_ID` and `LAUREL_PRIVATE_KEY` (a function-call key is enough) to the server's `env`; credit is prepaid with `deposit_credit` (see README E).

**Publication status:** published 5 Nov 2026 as [`laurel-mcp@0.1.0`](https://www.npmjs.com/package/laurel-mcp) (4 files, 6.2 kB) by the team's npm account with 2FA. Verified after publishing (PowerShell, neutral working directory): a stdio client started `npx -y laurel-mcp@0.1.0` from the registry, listed 7 tools and `laurel_predict_local(4, <README sample row>)` returned 1016620, the same raw score the README's `near contract call-function … predict` example documents for that row. Gotcha: `npx laurel-mcp` must not be run from inside `mcp/` itself (npx then resolves the folder's own package and finds no installed bin); from any other folder it works. The registry also shows a `0.0.0-stage` placeholder that npm's web-authenticated publish flow created before `0.1.0` landed; `latest` points at `0.1.0`.

## Remote endpoint (added 5 Nov, later the same day)

`web/api/mcp.mjs` serves the five read-only tools over **Streamable HTTP, stateless** (a new `McpServer` + `StreamableHTTPServerTransport` per POST, no session, GET/DELETE answer 405) as a Vercel Node function at **https://laurel-near.vercel.app/api/mcp**, with CORS open so browser-based clients can use it. It shares `gbdt.mjs` (copied to `web/api/_lib/`) and uses plain `fetch` JSON-RPC with the same RPC fallbacks as the explorer. Verified after deploy with `StreamableHTTPClientTransport`: 5 tools, `laurel_list_exhibits` → tasks 1–4, `laurel_specimen(6)` → `score_b_bps: null` and `split_b: "sealed until the task closes"`, `laurel_predict_local(4, <README sample row>)` → 1016620, `laurel_download_model(5)` → 1,611 B sha256 `f8dc08b5cab0…` 10 trees. Claude.ai / Claude Desktop add it under Settings → Connectors → Add custom connector; Claude Code: `claude mcp add --transport http laurel https://laurel-near.vercel.app/api/mcp`. The explorer's **Connect your agent** page (`#/connect`, `web/src/Connect.jsx`) detects the OS and shows the snippet for Claude.ai/Desktop, Claude Code, Cursor, VS Code, Windsurf, Codex CLI, Gemini CLI and a generic SDK example, remote and local.

## Tools

See `mcp/README.md` for the table. Design notes:
- Read-only tools use the same JSON-RPC views as the web explorer (`list_tasks`, `get_task`, `leaderboard`, `get_submission`, `get_model_bytes`, `get_credit`), with fastnear + dRPC failover.
- `laurel_specimen` nulls `score_b_bps` / `f1_b_bps` and masks `last_outlayer_raw.b` while the task is open, because the contract's `get_submission` view still returns them (known limit, README "Limits").
- `mcp/gbdt.mjs` is a 60-line port of `crates/gbdt-core::raw_score` (BigInt, `feature <= threshold` goes left, bias + one leaf per tree). The web explorer's `web/src/model.js` shares the decoder layout.
- Errors from `predict_task` are passed through with a hint: insufficient credit, task not closed, wrong key.
- Added 5 Nov (evening) for the autonomous agents in `agents/`: `laurel_submit_model` (validate → `submit_model` with storage + fee deposit → `request_score` with 0.1 NEAR, refunds included), `laurel_wait_score` (polls `get_submission`, applies the sealed rule) and `laurel_predict_model` (`predict` against one entry while its task is still open). Only `laurel_submit_model` needs a full-access key, because function-call keys cannot attach deposits; the agents keep that key in the MCP subprocess's environment, never in the model's context.

## Dependencies

`@modelcontextprotocol/sdk`, `near-api-js` 7.4, `zod`. They live in `mcp/package.json` only; the web explorer and the contract tooling are unchanged.
