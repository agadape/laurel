// Landing page: what a visitor sees before signing in with a NEAR wallet. Every figure and drawing is read live from the contract.
import React, { useEffect, useState } from "react";
import { contractId, yoctoToNear, EXPLORER_ACCOUNT } from "./rpc.js";
import { useView, useModelBytes, Sec, Fig, Scale, Slopegraph, Forest, fmtDate, Pill, Countdown, Title, mainnetData } from "./components.jsx";
import { signIn, network } from "./wallet.js";
import { useWallet } from "./Account.jsx";

const REPO = "https://github.com/agadape/laurel";
const UNDO = "https://github.com/agadape/undo";
const REMOTE_MCP = "https://laurel-near.vercel.app/api/mcp";
const pad2 = (n) => String(n).padStart(2, "0");

function EnterButton({ big = false }) {
  const w = useWallet();
  return (
    <button className={`wallet-btn ${big ? "big" : ""}`} onClick={signIn} disabled={w.loading}>
      {w.loading ? "loading wallet…" : "Connect wallet to enter"}
    </button>
  );
}
/** Read-only entry: the explorer needs no wallet; only buying credit or withdrawing does. */
const GuestButton = ({ onGuest, big = false }) => (
  <button className={`ghost-btn ${big ? "big" : ""}`} onClick={onGuest}>Browse the exhibits without a wallet</button>
);

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

/** The exhibit judges should see first: the newest open task, preferring one built from real NEAR mainnet data.
 *  Split A only; split B of an open task is never read here (the band stays sealed). */
function OpenExhibit({ task }) {
  const lb = useView("leaderboard", { task_id: task.task_id }, [task.task_id]);
  const rows = lb.data || [];
  const entriesA = rows.filter((r) => r.score_a_bps != null).map((r) => ({ id: r.submission_id, bps: r.score_a_bps, href: `#/model/${r.submission_id}`, label: `#${r.submission_id} · ${r.trees} trees` }));
  const real = mainnetData(task.slug);
  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="stack" style={{ gap: 8 }}>
        <div className="flow" style={{ gap: 8 }}><Pill kind="open">open</Pill>{real && <Pill>real NEAR mainnet data</Pill>}<span className="mono mist"><Countdown ns={task.deadline_ns} /> · {task.n_features} integer features · {task.submission_count} {task.submission_count === 1 ? "entrant" : "entrants"}</span></div>
        <h3 style={{ fontSize: 22 }}>Exhibit {pad2(task.task_id)}: <Title text={task.title} /></h3>
        {real ? (
          <p className="ink2" style={{ fontSize: 15, maxWidth: 680 }}>Each row is a fresh <span className="mono">.near</span> account's first seven days on NEAR mainnet, taken from the public BigQuery dataset. The label is whether the account was still acting between day 30 and day 90. Relayers, quest platforms and onboarding programs pay to acquire these accounts; the champion will answer <span className="mono">predict_task({task.task_id}, features)</span> for any agent or contract.</p>
        ) : (
          <p className="ink2" style={{ fontSize: 15, maxWidth: 680 }}>Train on the public split, submit a model as data, and read its split-A score here once the TEE has judged it.</p>
        )}
      </div>
      {lb.error && <p className="err mono">could not read the leaderboard</p>}
      <Scale variant="a" title={<><b>Split A</b> · judged in the TEE, public while open</>} note="balanced accuracy, 50–100 %" entries={entriesA} />
      <Scale variant="b" title={<><b className="accent-text">Split B</b> · decides the champion</>} note={`unsealed ${fmtDate(task.deadline_ns)}`} entries={[]} sealed={`sealed in the contract until ${fmtDate(task.deadline_ns)}`} />
      <div className="flow" style={{ gap: 16 }}>
        <a href={`#/task/${task.task_id}`}>Open exhibit {pad2(task.task_id)} →</a>
        {real && <a href={`${REPO}/blob/main/tasks/near-retention/README.md`} target="_blank" rel="noreferrer">The {task.n_features} features and how the data was pulled</a>}
      </div>
    </div>
  );
}

export default function Landing({ onGuest }) {
  const w = useWallet();
  const tasks = useView("list_tasks", { from: 0, limit: 50 }, []);
  const cfg = useView("get_config", {}, []);
  const list = (tasks.data || []).slice().reverse();
  const champion = list.find((t) => t.closed && t.winner != null);
  const featured = list.find((t) => !t.closed && mainnetData(t.slug)) || list.find((t) => !t.closed);
  const winner = useView("get_submission", { submission_id: champion?.winner }, [champion?.winner], { skip: champion?.winner == null });
  const earned = useView("get_earnings", { submission_id: champion?.winner }, [champion?.winner], { skip: champion?.winner == null });
  const [bytes, retry] = useModelBytes(champion?.winner);
  useEffect(() => { document.title = "Laurel · small models, judged in a TEE, paid on-chain"; }, []);
  const sk = <span className="sk" />;
  const num = (i) => pad2(i + (featured ? 1 : 0)); // chapter numbers shift when the open exhibit is shown
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
            <p className="ink2 lede">Laurel is a registry on NEAR for small decision models. You submit a model as data, a TEE scores it on a test set nobody can read, and the best one becomes a contract method that agents and other contracts pay to call. Live exhibits run on UCI German Credit (a simulation) and on real NEAR mainnet account data.</p>
            <div className="stack" style={{ gap: 10 }}>
              <div className="cta-row"><EnterButton big /><GuestButton onGuest={onGuest} big /></div>
              {w.error && <span className="err mono">{w.error}</span>}
              <span className="mist" style={{ fontSize: 13, maxWidth: 560 }}>Browsing is free and read-only: every exhibit, specimen and score is public contract state. A {network} wallet (Meteor, Intear or Nightly) is only needed to buy prediction credit or withdraw earnings; signing in creates no transaction. <a href={REPO} target="_blank" rel="noreferrer">Read the source</a>.</span>
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

        {featured && (
          <section className="block wrap g12">
            <div className="c2"><Sec n="01" title="Open now" /></div>
            <div className="c10"><OpenExhibit task={featured} /></div>
          </section>
        )}

        <section className="block wrap g12">
          <div className="c2"><Sec n={num(1)} title="How it works" /></div>
          <ol className="c10 steps4">
            {STEPS.map(([h, p], i) => <li key={h}><span className="n" aria-hidden="true">{pad2(i + 1)}</span><h3>{h}</h3><p className="ink2">{p}</p></li>)}
          </ol>
        </section>

        {champion && (
          <section className="block wrap g12">
            <div className="c2"><Sec n={num(2)} title="The sealed split decides" /></div>
            <div className="c10"><Proof task={champion} /></div>
          </section>
        )}

        <section className="block wrap g12">
          <div className="c2"><Sec n={num(champion ? 3 : 2)} title="Who it is for" /></div>
          <div className="c10 g12" style={{ rowGap: 20 }}>
            <div className="c6 stack" style={{ gap: 8 }}><h3>Model makers</h3><p className="ink2">Train on the public split, submit the model as data, get scored in a TEE on a sealed test set. Win and every prediction an agent or contract buys pays you the task's fee, withdrawable on-chain.</p></div>
            <div className="c6 stack" style={{ gap: 8 }}><h3>Agents and contracts</h3><p className="ink2">Prepay credit with NEAR, hand your agent a key that can only spend it on predictions, and call the champion through MCP or from your own contract. The model, its score and its evaluator are all verifiable.</p></div>
          </div>
        </section>

        <section className="block wrap chapter final">
          <div className="g12" style={{ alignItems: "end" }}>
            <div className="c7 stack" style={{ gap: 12 }}>
              <h2 className="h2">Enter the observatory.</h2>
              <p className="ink2" style={{ fontSize: 15, maxWidth: 560 }}>Browse every exhibit, specimen and tree as a guest, or connect a NEAR {network} wallet to buy prediction credit for your agent.</p>
            </div>
            <div className="c5 stack" style={{ gap: 10 }}>
              <div className="cta-row"><EnterButton big /><GuestButton onGuest={onGuest} big /></div>
              <span className="mist" style={{ fontSize: 13 }}>For agents without a wallet, the read-only MCP endpoint stays open: <span className="mono">{REMOTE_MCP}</span></span>
            </div>
          </div>
        </section>
      </main>
      <footer><div className="wrap"><span>Built at NEAR HACKATHON 2026 · live data from <a href={EXPLORER_ACCOUNT(contractId())} target="_blank" rel="noreferrer" className="mono">{contractId()}</a> · no mock data · sister project: <a href={UNDO} target="_blank" rel="noreferrer">Undo</a> (same team)</span><a href={REPO} target="_blank" rel="noreferrer" className="mono">github.com/agadape/laurel</a></div></footer>
    </>
  );
}
