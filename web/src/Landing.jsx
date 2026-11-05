// Landing page: what a visitor sees before signing in with a NEAR wallet. Every figure and drawing is read live from the contract.
import React, { useEffect, useState } from "react";
import { contractId, yoctoToNear, EXPLORER_ACCOUNT } from "./rpc.js";
import { useView, useModelBytes, Sec, Fig, Scale, Slopegraph, Forest, fmtDate } from "./components.jsx";
import { signIn, network } from "./wallet.js";
import { useWallet } from "./Account.jsx";

const REPO = "https://github.com/agadape/laurel";
const UNDO = "https://github.com/agadape/undo";
const REMOTE_MCP = "https://laurel-near.vercel.app/api/mcp";
const pad2 = (n) => String(n).padStart(2, "0");

/** Name of the screen a deep link asked for, so the landing can say what opens after sign-in. */
const targetName = ({ page, id }) =>
  page === "task" && id ? `Exhibit ${pad2(id)}` : page === "model" && id ? `Specimen #${id}` : page === "costs" || page === "biaya" ? "the Method page" : page === "connect" ? "Connect your agent" : null;

function EnterButton({ big = false }) {
  const w = useWallet();
  return (
    <button className={`wallet-btn ${big ? "big" : ""}`} onClick={signIn} disabled={w.loading}>
      {w.loading ? "loading wallet…" : "Connect wallet to enter"}
    </button>
  );
}

const STEPS = [
  ["Submit a model as data", "A gradient-boosted tree model, exported to a few kilobytes of integers, is stored by the contract itself. No server, no API key, no hosting bill."],
  ["Judged inside a TEE", "An evaluator whose hash the contract pins runs in OutLayer's TEE on two private test splits that never leave the enclave."],
  ["The sealed split decides", "Split A is public while a task is open. Split B stays sealed until close, so nobody can tune against it, and it alone picks the champion."],
  ["Served and paid per call", "The champion answers predict_task for agents and other contracts. Every call is paid in NEAR, from prepaid credit, to the model's owner."],
];

/** Split A vs split B of the most recent closed exhibit, with the seal lifting once. Closed tasks only: split B of an open task is never read here. */
function Proof({ task }) {
  const lb = useView("leaderboard", { task_id: task.task_id }, [task.task_id]);
  const [revealed, setRevealed] = useState(false);
  const rows = lb.data || [];
  const bestA = Math.max(-1, ...rows.map((x) => x.score_a_bps ?? -1));
  const entriesA = rows.filter((r) => r.score_a_bps != null).map((r) => ({ id: r.submission_id, bps: r.score_a_bps, href: undefined, label: `#${r.submission_id}${r.submission_id !== task.winner && r.score_a_bps === bestA ? " · led" : ""}`, muted: r.submission_id !== task.winner }));
  const entriesB = rows.filter((r) => r.score_b_bps != null).map((r) => ({ id: r.submission_id, bps: r.score_b_bps, href: undefined, label: r.submission_id === task.winner ? `#${r.submission_id} · champion` : `#${r.submission_id}`, accent: r.submission_id === task.winner, muted: r.submission_id !== task.winner }));
  const leadA = entriesA.slice().sort((a, b) => b.bps - a.bps)[0];
  return (
    <div className="stack" style={{ gap: 18 }}>
      {lb.error && <p className="err mono">could not read the leaderboard</p>}
      <Scale variant="a" title={<><b>Split A</b> · public while the task was open</>} note="balanced accuracy, 50–100 %" entries={entriesA} />
      <Slopegraph entries={rows.map((r) => ({ id: r.submission_id, a: r.score_a_bps, b: r.score_b_bps }))} winner={task.winner} drawn={revealed} />
      <Scale variant="b" title={<><b className="accent-text">Split B</b> · sealed until close · decides</>} note={`unsealed ${fmtDate(task.deadline_ns)}`} entries={entriesB} reveal onRevealed={() => setRevealed(true)} />
      {leadA && task.winner != null && leadA.id !== task.winner && (
        <p className="ink2" style={{ fontSize: 15, maxWidth: 680 }}>Exhibit {pad2(task.task_id)}, read live: #{leadA.id} led the public split, #{task.winner} won the sealed one. The sealed reading is the only one a model could not have been tuned against, so it decides.</p>
      )}
    </div>
  );
}

export default function Landing({ route }) {
  const w = useWallet();
  const tasks = useView("list_tasks", { from: 0, limit: 50 }, []);
  const cfg = useView("get_config", {}, []);
  const list = (tasks.data || []).slice().reverse();
  const champion = list.find((t) => t.closed && t.winner != null);
  const winner = useView("get_submission", { submission_id: champion?.winner }, [champion?.winner], { skip: champion?.winner == null });
  const earned = useView("get_earnings", { submission_id: champion?.winner }, [champion?.winner], { skip: champion?.winner == null });
  const [bytes, retry] = useModelBytes(champion?.winner);
  const target = targetName(route);
  useEffect(() => { document.title = "Laurel · small models, judged in a TEE, paid on-chain"; }, []);
  const sk = <span className="sk" />;
  return (
    <>
      <a className="skip" href="#main" onClick={(e) => { e.preventDefault(); const m = document.getElementById("main"); m?.focus({ preventScroll: true }); m?.scrollIntoView(); }}>Skip to content</a>
      <header className="landing-head">
        <div className="wrap">
          <div className="brand"><span className="word">LAUREL</span><span>Observatory of small models</span></div>
          <nav aria-label="primary"><a href={REPO} target="_blank" rel="noreferrer">Source</a></nav>
          <button className="wallet-btn" onClick={signIn} disabled={w.loading}>{w.loading ? "loading wallet…" : "Connect wallet"}</button>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="landing">
        <section className="block wrap g12 hero">
          <div className="c7 stack" style={{ gap: 22 }}>
            <span className="label">NEAR {network} · OutLayer TEE · every number read live from the contract</span>
            <h1>Small models,<br />judged in the dark,<br />paid in the open.</h1>
            <p className="ink2 lede">Laurel is a registry on NEAR for small decision models. You submit a model as data, a TEE scores it on a test set nobody can read, and the best one becomes a contract method that agents and other contracts pay to call.</p>
            <div className="stack" style={{ gap: 10 }}>
              {target && <span className="mono">Connect a wallet to open {target}.</span>}
              <div className="cta-row"><EnterButton big /><a href={REPO} target="_blank" rel="noreferrer" className="mono">read the source →</a></div>
              {w.error && <span className="err mono">{w.error}</span>}
              <span className="mist" style={{ fontSize: 13, maxWidth: 520 }}>A {network} wallet: Meteor, Intear or Nightly. Signing in creates no transaction and costs nothing; purchases are approved one by one in the wallet.</span>
            </div>
          </div>
          <div className="c5 stack" style={{ gap: 10 }}>
            <div className="between mono mist">
              <span>{champion ? <>Champion of exhibit {pad2(champion.task_id)} · specimen #{champion.winner}</> : "Specimen"}</span>
              <span>{winner.data ? `${winner.data.trees} trees · ${winner.data.bytes.toLocaleString()} B` : ""}</span>
            </div>
            <div className={`plate ${champion ? "accent" : ""}`} style={{ padding: 14 }}>
              {champion ? <Forest bytes={bytes} trees={winner.data?.trees || 50} limit={50} cols={10} accent onRetry={retry} />
                : <div className="mist mono">{tasks.loading ? "reading the contract…" : tasks.error ? "could not read the contract" : "no closed exhibit yet"}</div>}
            </div>
            <p className="mist" style={{ fontSize: 13 }}>Not an illustration: each glyph is one decision tree of the winning model, decoded from the bytes the contract stores.</p>
          </div>
        </section>

        <section className="block wrap chapter">
          <div className="figs figs-5">
            <Fig v={cfg.data ? cfg.data.task_count : sk} l="exhibits (tasks)" />
            <Fig v={cfg.data ? cfg.data.submission_count : sk} l="models judged in a TEE" />
            <Fig v={winner.data ? winner.data.calls : sk} l={champion ? `predictions served by #${champion.winner}` : "predictions served"} />
            <Fig v={earned.data ? yoctoToNear(earned.data, 3) : sk} unit="NEAR" l="earned by its owner, on-chain" />
            <Fig v="4.3" unit="Tgas" l="per on-chain prediction (measured)" />
          </div>
        </section>

        <section className="block wrap g12">
          <div className="c2"><Sec n="01" title="How it works" /></div>
          <ol className="c10 steps4">
            {STEPS.map(([h, p], i) => <li key={h}><span className="n" aria-hidden="true">{pad2(i + 1)}</span><h3>{h}</h3><p className="ink2">{p}</p></li>)}
          </ol>
        </section>

        {champion && (
          <section className="block wrap g12">
            <div className="c2"><Sec n="02" title="The sealed split decides" /></div>
            <div className="c10"><Proof task={champion} /></div>
          </section>
        )}

        <section className="block wrap g12">
          <div className="c2"><Sec n={champion ? "03" : "02"} title="Who it is for" /></div>
          <div className="c10 g12" style={{ rowGap: 20 }}>
            <div className="c6 stack" style={{ gap: 8 }}><h3>Model makers</h3><p className="ink2">Train on the public split, submit the model as data, get scored in a TEE on a sealed test set. Win and every prediction an agent or contract buys pays you the task's fee, withdrawable on-chain.</p></div>
            <div className="c6 stack" style={{ gap: 8 }}><h3>Agents and contracts</h3><p className="ink2">Prepay credit with NEAR, hand your agent a key that can only spend it on predictions, and call the champion through MCP or from your own contract. The model, its score and its evaluator are all verifiable.</p></div>
          </div>
        </section>

        <section className="block wrap chapter final">
          <div className="g12" style={{ alignItems: "end" }}>
            <div className="c7 stack" style={{ gap: 12 }}>
              <h2 className="h2">Enter the observatory.</h2>
              <p className="ink2" style={{ fontSize: 15, maxWidth: 560 }}>Connect a NEAR {network} wallet to browse the exhibits, read every specimen and its trees, and buy prediction credit.</p>
            </div>
            <div className="c5 stack" style={{ gap: 10 }}>
              <EnterButton big />
              <span className="mist" style={{ fontSize: 13 }}>For agents without a wallet, the read-only MCP endpoint stays open: <span className="mono">{REMOTE_MCP}</span></span>
            </div>
          </div>
        </section>
      </main>
      <footer><div className="wrap"><span>Built at NEAR HACKATHON 2026 · live data from <a href={EXPLORER_ACCOUNT(contractId())} target="_blank" rel="noreferrer" className="mono">{contractId()}</a> · no mock data · sister project: <a href={UNDO} target="_blank" rel="noreferrer">Undo</a> (same team)</span><a href={REPO} target="_blank" rel="noreferrer" className="mono">github.com/agadape/laurel</a></div></footer>
    </>
  );
}
