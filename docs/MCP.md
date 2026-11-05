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

**Publication status:** the package is prepared in `mcp/` (`laurel-mcp@0.1.0`, name free on npm as of 5 Nov). Publishing to npm is a human step (`npm login`, then `npm publish` from `mcp/`); until then use the clone command.

## Tools

See `mcp/README.md` for the table. Design notes:
- Read-only tools use the same JSON-RPC views as the web explorer (`list_tasks`, `get_task`, `leaderboard`, `get_submission`, `get_model_bytes`, `get_credit`), with fastnear + dRPC failover.
- `laurel_specimen` nulls `score_b_bps` / `f1_b_bps` and masks `last_outlayer_raw.b` while the task is open, because the contract's `get_submission` view still returns them (known limit, README "Limits").
- `mcp/gbdt.mjs` is a 60-line port of `crates/gbdt-core::raw_score` (BigInt, `feature <= threshold` goes left, bias + one leaf per tree). The web explorer's `web/src/model.js` shares the decoder layout.
- Errors from `predict_task` are passed through with a hint: insufficient credit, task not closed, wrong key.

## Dependencies

`@modelcontextprotocol/sdk`, `near-api-js` 7.4, `zod`. They live in `mcp/package.json` only; the web explorer and the contract tooling are unchanged.
