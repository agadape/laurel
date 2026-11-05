# laurel-mcp

An [MCP](https://modelcontextprotocol.io) server for **Laurel**: small decision models as on-chain infrastructure on NEAR. It lets an AI agent browse the exhibits (tasks) and their leaderboards, download a submitted model's bytes straight from the contract, run that model locally with the contract's own integer arithmetic, and call the champion **on-chain** through `predict_task`.

Live contract (testnet): `laurel.laurel-team-mw0x0c8g.testnet` · explorer https://laurel-near.vercel.app · source https://github.com/agadape/laurel

## Install

Claude Desktop / Claude Code / Cursor (any MCP client), read-only:

```json
{
  "mcpServers": {
    "laurel": { "command": "npx", "args": ["-y", "laurel-mcp"] }
  }
}
```

To call the champion on-chain, give the server a NEAR account whose key may call `predict_task` (a function-call key limited to `predict_task`/`predict` is enough) and some prepaid credit on the contract:

```json
{
  "mcpServers": {
    "laurel": {
      "command": "npx", "args": ["-y", "laurel-mcp"],
      "env": { "LAUREL_ACCOUNT_ID": "agent.example.testnet", "LAUREL_PRIVATE_KEY": "ed25519:…" }
    }
  }
}
```

Claude Code, one line: `claude mcp add laurel -- npx -y laurel-mcp`

From a clone of the repo instead of npm: `node mcp/server.mjs`.

## Environment

| Variable | Default | Meaning |
|---|---|---|
| `LAUREL_CONTRACT` | `laurel.laurel-team-mw0x0c8g.testnet` | the registry contract |
| `LAUREL_NETWORK` | from the contract suffix | `testnet` or `mainnet` |
| `LAUREL_RPC` | fastnear + dRPC | comma-separated JSON-RPC URLs, tried in order |
| `LAUREL_ACCOUNT_ID`, `LAUREL_PRIVATE_KEY` | — | only for `laurel_predict` / `laurel_credit` |

## Tools

| Tool | What it does | Key needed |
|---|---|---|
| `laurel_list_exhibits` | tasks with state, deadline, entrants | no |
| `laurel_exhibit(task_id)` | task + feature names + leaderboard (split B only once closed) | no |
| `laurel_specimen(submission_id)` | one model: owner, size, status, readings, evaluator record | no |
| `laurel_download_model(submission_id, out_path?)` | saves the borsh bytes, returns sha256 and structure | no |
| `laurel_predict_local(submission_id, features)` | runs the model here; raw score identical to on-chain | no |
| `laurel_credit()` | prepaid credit of the configured account | account id |
| `laurel_predict(task_id, features)` | `predict_task` on-chain, fee to the model owner, returns the tx | yes |

Features are integers in the task's feature order (`laurel_exhibit` lists the names). A raw score > 0 is the positive class; for the credit-risk demo that means *bad credit* (simulation only, not a credit tool).

## Why both local and on-chain

`laurel_download_model` reads the same `get_model_bytes` view the TEE evaluator reads, and `laurel_predict_local` uses the same arithmetic as the contract (`crates/gbdt-core`), so an agent can verify for itself that the number the chain returns is the number the bytes produce. The on-chain call is the one other contracts and agents can rely on without trusting this package.

MIT · built at NEAR HACKATHON 2026.
