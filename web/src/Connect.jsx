import React, { useEffect, useState } from "react";
import { Cmd, Sec } from "./components.jsx";

const REMOTE = "https://laurel-near.vercel.app/api/mcp";
const os = () => { const u = navigator.userAgent; return /Mac/i.test(u) ? "mac" : /Win/i.test(u) ? "win" : "linux"; };

const jsonLocal = (env = false) => JSON.stringify({ mcpServers: { laurel: { command: "npx", args: ["-y", "laurel-mcp"], ...(env ? { env: { LAUREL_ACCOUNT_ID: "<your account>", LAUREL_PRIVATE_KEY: "ed25519:<function-call key>" } } : {}) } } }, null, 2);
const jsonRemote = JSON.stringify({ mcpServers: { laurel: { url: REMOTE } } }, null, 2);

const PATHS = {
  mac: "~/Library/Application Support/Claude/claude_desktop_config.json",
  win: "%APPDATA%\\Claude\\claude_desktop_config.json",
  linux: "~/.config/Claude/claude_desktop_config.json",
};

const CLIENTS = [
  { id: "claude-ai", name: "Claude.ai / Claude Desktop (remote, no install)", body: (o) => (
    <>
      <p className="ink2">Settings → Connectors → <b>Add custom connector</b> → paste the URL. Nothing to install; the server runs on Vercel and only reads the contract.</p>
      <Cmd>{REMOTE}</Cmd>
      <p className="mist" style={{ fontSize: 13 }}>Read-only tools: exhibits, leaderboards, specimens, model bytes, local prediction. For on-chain <span className="mono">predict_task</span> use the local package below.</p>
    </>
  ) },
  { id: "claude-desktop", name: "Claude Desktop (local, npx)", body: (o) => (
    <>
      <p className="ink2">Needs Node 18+. Edit <span className="mono">{PATHS[o]}</span> (Settings → Developer → Edit Config), then restart Claude Desktop.</p>
      <Cmd>{jsonLocal(false)}</Cmd>
      <p className="mist" style={{ fontSize: 13 }}>To let it call the champion on-chain, add <span className="mono">env</span> with a NEAR account and a function-call key limited to <span className="mono">predict_task</span>:</p>
      <Cmd>{jsonLocal(true)}</Cmd>
    </>
  ) },
  { id: "claude-code", name: "Claude Code", body: () => (
    <>
      <p className="ink2">One command, local (npx) or remote (URL):</p>
      <Cmd>{`claude mcp add laurel -- npx -y laurel-mcp`}</Cmd>
      <Cmd>{`claude mcp add --transport http laurel ${REMOTE}`}</Cmd>
      <p className="mist" style={{ fontSize: 13 }}>Cloning the repo is enough too: it ships a <span className="mono">.mcp.json</span> that Claude Code loads automatically.</p>
    </>
  ) },
  { id: "cursor", name: "Cursor", body: () => (
    <>
      <p className="ink2">Settings → MCP → Add, or put this in <span className="mono">.cursor/mcp.json</span> (project) or <span className="mono">~/.cursor/mcp.json</span> (global):</p>
      <Cmd>{jsonLocal(false)}</Cmd>
      <p className="ink2">Or the remote URL:</p>
      <Cmd>{jsonRemote}</Cmd>
    </>
  ) },
  { id: "vscode", name: "VS Code (Copilot agent mode)", body: () => (
    <>
      <p className="ink2">Create <span className="mono">.vscode/mcp.json</span> in your workspace:</p>
      <Cmd>{JSON.stringify({ servers: { laurel: { type: "stdio", command: "npx", args: ["-y", "laurel-mcp"] } } }, null, 2)}</Cmd>
      <p className="ink2">Or remote:</p>
      <Cmd>{JSON.stringify({ servers: { laurel: { type: "http", url: REMOTE } } }, null, 2)}</Cmd>
    </>
  ) },
  { id: "windsurf", name: "Windsurf", body: () => (
    <>
      <p className="ink2">Windsurf → Settings → MCP → Manage, or edit <span className="mono">~/.codeium/windsurf/mcp_config.json</span>:</p>
      <Cmd>{jsonLocal(false)}</Cmd>
    </>
  ) },
  { id: "codex", name: "OpenAI Codex CLI", body: () => (
    <>
      <p className="ink2">Add to <span className="mono">~/.codex/config.toml</span>:</p>
      <Cmd>{`[mcp_servers.laurel]\ncommand = "npx"\nargs = ["-y", "laurel-mcp"]`}</Cmd>
    </>
  ) },
  { id: "gemini", name: "Gemini CLI", body: () => (
    <>
      <p className="ink2">Add to <span className="mono">~/.gemini/settings.json</span>:</p>
      <Cmd>{jsonLocal(false)}</Cmd>
    </>
  ) },
  { id: "any", name: "Any MCP client / your own code", body: () => (
    <>
      <p className="ink2">Stdio: run <span className="mono">npx -y laurel-mcp</span> and speak MCP over stdin/stdout. HTTP: POST JSON-RPC to the remote URL (Streamable HTTP, stateless). Example with the TypeScript SDK:</p>
      <Cmd>{`import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
const client = new Client({ name: "me", version: "0.0.0" });
await client.connect(new StreamableHTTPClientTransport(new URL("${REMOTE}")));
console.log(await client.callTool({ name: "laurel_list_exhibits", arguments: {} }));`}</Cmd>
    </>
  ) },
];

export default function Connect() {
  const [o, setO] = useState("mac");
  const [c, setC] = useState("claude-ai");
  useEffect(() => { setO(os()); document.title = "Connect · Laurel"; }, []);
  const client = CLIENTS.find((x) => x.id === c);
  return (
    <>
      <section className="block wrap g12" style={{ alignItems: "end" }}>
        <div className="c8 stack" style={{ gap: 12 }}>
          <h1 className="h2">Give the models to your agent.</h1>
          <p className="ink2" style={{ fontSize: 15, maxWidth: 620 }}>Laurel speaks <a href="https://modelcontextprotocol.io" target="_blank" rel="noreferrer">MCP</a>. Any AI agent can list the exhibits, read a leaderboard, download a model's bytes from the contract, run the model locally with the contract's own integer arithmetic, and, with a key, call the champion on-chain. Pick your client; the snippet is ready to paste.</p>
        </div>
        <div className="c4 stack" style={{ gap: 6 }}>
          <span className="label">operating system</span>
          <div className="seg" role="radiogroup" aria-label="operating system">
            {[["mac", "macOS"], ["win", "Windows"], ["linux", "Linux"]].map(([k, l]) => <button key={k} role="radio" aria-checked={o === k} className={o === k ? "on" : ""} onClick={() => setO(k)}>{l}</button>)}
          </div>
        </div>
      </section>

      <section className="block wrap g12">
        <div className="c2"><Sec n="01" title="Your client" /></div>
        <div className="c10 stack">
          <div className="seg wrap-seg" role="tablist" aria-label="MCP client">
            {CLIENTS.map((x) => <button key={x.id} role="tab" aria-selected={c === x.id} className={c === x.id ? "on" : ""} onClick={() => setC(x.id)}>{x.name}</button>)}
          </div>
          <div className="stack" role="tabpanel" style={{ gap: 12 }}>{client.body(o)}</div>
        </div>
      </section>

      <section className="block wrap g12">
        <div className="c2"><Sec n="02" title="What to ask" /></div>
        <div className="c10 stack">
          <p className="ink2" style={{ fontSize: 15 }}>Once connected, your agent has seven tools (five on the remote endpoint). Try:</p>
          <ul className="plain">
            <li>"Which exhibits are open on Laurel, and who leads split A?"</li>
            <li>"Download model 4, run it on these 18 features, and tell me the raw score and label."</li>
            <li>"Compare the split-A and split-B readings on exhibit 3 and explain who won and why."</li>
            <li>With a key: "Call the champion of exhibit 3 on-chain with the same features and show me the transaction."</li>
          </ul>
          <p className="mist" style={{ fontSize: 13 }}>Tools: <span className="mono">laurel_list_exhibits · laurel_exhibit · laurel_specimen · laurel_download_model · laurel_predict_local</span> (remote and local) · <span className="mono">laurel_credit · laurel_predict</span> (local package with a key). Split B of an open exhibit is withheld by the tools, like on this site. Package: <a href="https://www.npmjs.com/package/laurel-mcp" target="_blank" rel="noreferrer">laurel-mcp on npm</a> · source in <a href="https://github.com/agadape/laurel/tree/main/mcp" target="_blank" rel="noreferrer">mcp/</a>.</p>
        </div>
      </section>
    </>
  );
}
