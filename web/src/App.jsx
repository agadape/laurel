import React, { useEffect, useState } from "react";
import { view, contractId, yoctoToNear, bps, nsToDate, short, statusText, statusDetail, EXPLORER_ACCOUNT, EXPLORER_TX } from "./rpc.js";

// ---------- tiny hash router: #/ , #/task/2 , #/model/3 , #/costs ----------
function useRoute() {
  const [hash, setHash] = useState(window.location.hash || "#/");
  useEffect(() => {
    const f = () => setHash(window.location.hash || "#/");
    window.addEventListener("hashchange", f);
    return () => window.removeEventListener("hashchange", f);
  }, []);
  const parts = hash.replace(/^#\/?/, "").split("/");
  return { page: parts[0] || "tasks", id: Number(parts[1]) || null };
}

function useView(method, args, deps) {
  const [state, set] = useState({ loading: true });
  useEffect(() => {
    let alive = true;
    set({ loading: true });
    view(method, args).then((data) => alive && set({ data })).catch((e) => alive && set({ error: String(e.message || e) }));
    return () => { alive = false; };
  }, deps); // eslint-disable-line
  return state;
}

function Cmd({ children }) {
  const [ok, setOk] = useState(false);
  return (
    <div className="cmd">
      <pre>{children}</pre>
      <button onClick={() => { navigator.clipboard?.writeText(children); setOk(true); setTimeout(() => setOk(false), 1200); }}>{ok ? "copied" : "copy"}</button>
    </div>
  );
}

const Countdown = ({ ns }) => {
  const d = nsToDate(ns); const ms = d - Date.now();
  if (ms <= 0) return <span>passed ({d.toLocaleString()})</span>;
  const h = Math.floor(ms / 3.6e6), m = Math.floor((ms % 3.6e6) / 6e4);
  return <span>{h} h {m} m left ({d.toLocaleString()})</span>;
};

// task slug → dataset folder in the repo (slugs may differ from folder names)
const datasetDir = (slug) => (/^(credit-risk|german-credit)/.test(slug) ? "german-credit" : slug.replace(/-open$/, ""));

// ---------- screens ----------
function Tasks() {
  const { data, error, loading } = useView("list_tasks", { from: 0, limit: 50 }, []);
  return (
    <>
      <h2>Tasks</h2>
      <p className="sub">Decision-model challenges. Participants train on public data; an evaluator running in a TEE (OutLayer) scores each model on a private test set bound to the evaluator hash. The winner becomes <code>predict_task</code>, callable by contracts and agents.</p>
      {loading && <p className="muted">loading…</p>}
      {error && <p className="err">RPC: {error}</p>}
      <div className="grid">
        {(data || []).slice().reverse().map((t) => (
          <div className="card" key={t.task_id}>
            <h3><a href={`#/task/${t.task_id}`}>#{t.task_id} · {t.title}</a></h3>
            <p className="sub">{t.closed ? <span className="badge closed">closed · winner #{t.winner}</span> : <span className="badge open">open</span>} <span className="badge">{t.n_features} features</span> <span className="badge">{t.submission_count} submissions</span></p>
            <dl className="kv">
              <dt>slug</dt><dd className="mono">{t.slug}</dd>
              <dt>deadline</dt><dd><Countdown ns={t.deadline_ns} /></dd>
              <dt>fee per call</dt><dd>{yoctoToNear(t.fee_per_call, 4)} NEAR</dd>
              <dt>submission fee</dt><dd>{yoctoToNear(t.submission_fee, 2)} NEAR + model storage</dd>
              <dt>creator</dt><dd className="mono">{t.creator}</dd>
            </dl>
          </div>
        ))}
      </div>
      {data && data.length === 0 && <p className="muted">No tasks on this contract yet.</p>}
    </>
  );
}

function Task({ id }) {
  const t = useView("get_task", { task_id: id }, [id]);
  const lb = useView("leaderboard", { task_id: id }, [id]);
  const task = t.data;
  if (t.loading) return <p className="muted">loading…</p>;
  if (t.error || !task) return <p className="err">Task {id} not found. {t.error}</p>;
  const rows = lb.data || [];
  const best = Math.max(1, ...rows.map((r) => (task.closed ? r.score_b_bps : r.score_a_bps) || 0));
  return (
    <>
      <p className="sub"><a href="#/">← all tasks</a></p>
      <h2>#{task.task_id} · {task.title} {task.closed ? <span className="badge closed">closed</span> : <span className="badge open">open</span>}</h2>
      <dl className="kv card">
        <dt>slug</dt><dd className="mono">{task.slug}</dd>
        <dt>features ({task.n_features})</dt><dd className="mono">{task.feature_names.join(", ")}</dd>
        <dt>deadline</dt><dd><Countdown ns={task.deadline_ns} /></dd>
        <dt>metric</dt><dd>balanced accuracy (bps) · provisional ranking = split A, final = split B (revealed when the task closes)</dd>
        <dt>private test set</dt><dd className="mono">{task.secrets_account} / profile {task.secrets_profile} (readable only by the evaluator with the pinned hash)</dd>
        <dt>fee per call</dt><dd>{yoctoToNear(task.fee_per_call, 4)} NEAR · quota {task.max_per_account} submissions per account</dd>
        {task.closed && <><dt>winner</dt><dd><a href={`#/model/${task.winner}`}>submission #{task.winner}</a> → <code>predict_task({task.task_id}, features)</code></dd></>}
      </dl>
      <h3>Leaderboard {task.closed ? "— final (split B)" : "— provisional (split A)"}</h3>
      {lb.error && <p className="err">{lb.error}</p>}
      <table>
        <thead><tr><th>#</th><th>submission</th><th>owner</th><th className="num">bal. acc. A</th><th className="num">F1 A</th>{task.closed && <th className="num">bal. acc. B</th>}<th className="num">bytes</th><th className="num">trees</th><th>status</th><th className="num">calls</th></tr></thead>
        <tbody>
          {rows.map((r, i) => {
            const score = task.closed ? r.score_b_bps : r.score_a_bps;
            return (
              <tr key={r.submission_id}>
                <td>{i + 1} {task.closed && r.submission_id === task.winner && <span className="badge win">winner</span>}</td>
                <td><a href={`#/model/${r.submission_id}`}>#{r.submission_id}</a></td>
                <td className="mono">{short(r.owner, 14)}</td>
                <td className="num">{bps(r.score_a_bps)}</td>
                <td className="num">{bps(r.f1_a_bps)}</td>
                {task.closed && <td className="num">{bps(r.score_b_bps)}</td>}
                <td className="num">{r.bytes.toLocaleString()}</td>
                <td className="num">{r.trees}</td>
                <td><span className={`badge ${statusText(r.status) === "Failed" ? "fail" : ""}`}>{statusText(r.status)}</span>{score != null && <div className="bar" title={bps(score)}><i style={{ width: `${(score / best) * 100}%` }} /></div>}</td>
                <td className="num">{r.calls}</td>
              </tr>
            );
          })}
          {rows.length === 0 && !lb.loading && <tr><td colSpan={10} className="muted">no submissions yet</td></tr>}
        </tbody>
      </table>
      <h3>Create a task like this (CLI, task creator)</h3>
      <Cmd>{`python tasks/${datasetDir(task.slug)}/split.py                                   # public data + private splits + sha256 manifest
bash tools/secrets.sh ${datasetDir(task.slug)} ${task.secrets_profile} <evaluator hash>   # (WSL) store the private test set, bound to the evaluator hash
node tools/create_task.mjs ${datasetDir(task.slug)} --slug-override ${task.slug} --minutes 1440 --as TEAM`}</Cmd>
      <h3>Participate (CLI, participant)</h3>
      <p className="sub">All writes go through scripts in the repo (no browser wallet). Train on <code>tasks/{datasetDir(task.slug)}/public_train.csv</code>, export, then submit:</p>
      <Cmd>{`python tasks/${datasetDir(task.slug)}/train.py --trees 50 --depth 4
python tools/export.py --task ${datasetDir(task.slug)} --model tasks/${datasetDir(task.slug)}/model_baseline.pkl --out tasks/${datasetDir(task.slug)}/out/mine
node tools/submit.mjs ${task.task_id} tasks/${datasetDir(task.slug)}/out/mine/model.bin --as P1      # contract: ${contractId()}`}</Cmd>
      {task.closed && (<>
        <h3>Call the winning model from an agent</h3>
        <Cmd>{`node tools/predict.mjs ${task.task_id} --row 0 --as AGENT --deposit 0.02     # prepay once; later calls only use the function-call key
node tools/agent.mjs ${task.task_id} --rows 10                                 # 10 applicants + proof that the restricted key is rejected by the protocol`}</Cmd>
      </>)}
    </>
  );
}

function Model({ id }) {
  const s = useView("get_submission", { submission_id: id }, [id]);
  const e = useView("get_earnings", { submission_id: id }, [id]);
  const cfg = useView("get_config", {}, []);
  const sub = s.data;
  if (s.loading) return <p className="muted">loading…</p>;
  if (s.error || !sub) return <p className="err">Submission {id} not found. {s.error}</p>;
  let raw = null; try { raw = sub.last_outlayer_raw ? JSON.parse(sub.last_outlayer_raw) : null; } catch { raw = null; }
  return (
    <>
      <p className="sub"><a href={`#/task/${sub.task_id}`}>← task #{sub.task_id}</a></p>
      <h2>Model #{sub.submission_id} <span className={`badge ${statusText(sub.status) === "Failed" ? "fail" : ""}`}>{statusText(sub.status)}</span></h2>
      <dl className="kv card">
        <dt>owner</dt><dd className="mono"><a href={EXPLORER_ACCOUNT(sub.owner)} target="_blank" rel="noreferrer">{sub.owner}</a></dd>
        <dt>size</dt><dd>{sub.bytes.toLocaleString()} bytes · {sub.trees} trees · {sub.nodes.toLocaleString()} nodes</dd>
        <dt>model sha256</dt><dd className="mono">{sub.model_hash}</dd>
        <dt>submitted</dt><dd>{nsToDate(sub.submitted_at_ns).toLocaleString()}</dd>
        <dt>split A</dt><dd>bal. acc. {bps(sub.score_a_bps)} · F1 {bps(sub.f1_a_bps)}</dd>
        <dt>split B</dt><dd>{sub.score_b_bps != null ? <>bal. acc. {bps(sub.score_b_bps)} · F1 {bps(sub.f1_b_bps)}</> : <span className="muted">hidden until the task closes</span>}</dd>
        <dt>calls</dt><dd>{sub.calls} · earnings {e.data ? yoctoToNear(e.data, 4) : "…"} NEAR (withdrawn by the owner via <code>withdraw_earnings</code>)</dd>
        <dt>pinned evaluator</dt><dd className="mono">{cfg.data ? <>{short(cfg.data.evaluator_hash, 12)} · <a href={cfg.data.evaluator_url} target="_blank" rel="noreferrer">wasm</a></> : "…"}</dd>
        {statusDetail(sub.status) && <><dt>status detail</dt><dd className="mono">{statusDetail(sub.status)}</dd></>}
      </dl>
      <h3>Evaluator output (stored on-chain, ≤ 900 B)</h3>
      <pre>{raw ? JSON.stringify(raw, null, 2) : (sub.last_outlayer_raw || "not scored yet")}</pre>
      <h3>Call this model</h3>
      <p className="sub">Metered change method: the fee is taken from the caller's prepaid credit. Features are integers in the task's feature order (German Credit: 18 integers, scale 1). Raw score &gt; 0 ⇒ positive class.</p>
      <Cmd>{`node tools/predict.mjs ${sub.task_id} --submission ${sub.submission_id} --row 0 --as AGENT`}</Cmd>
      <Cmd>{`near contract call-function as-transaction ${contractId()} predict json-args '{"submission_id":${sub.submission_id},"features":[0,24,2,3,2500,0,2,3,0,2,1,35,2,1,1,2,1,0]}' prepaid-gas '30 Tgas' attached-deposit '0 NEAR' sign-as <agent> network-config testnet`}</Cmd>
    </>
  );
}

function Costs() {
  const cfg = useView("get_config", {}, []);
  return (
    <>
      <h2>Costs and how it works</h2>
      <p className="sub">Numbers below were measured on testnet on 2–3 Nov 2026 (transactions in <code>docs/GAS.md</code> and <code>docs/AGENT.md</code> in the repo). 1 Tgas ≈ 0.0001 NEAR at the base gas price.</p>
      <table>
        <thead><tr><th>Operation</th><th>Model</th><th className="num">Tgas (function receipt)</th><th>Proof</th></tr></thead>
        <tbody>
          <tr><td><code>predict_task</code> (agent, FC key)</td><td>German Credit 50×4, 33 KB</td><td className="num">4.31</td><td><a href={EXPLORER_TX("8tTi9dbVnZfwMZkmqgMVG1FfXyihUs8MssCXraNELFMS")} target="_blank" rel="noreferrer">tx</a></td></tr>
          <tr><td><code>predict</code></td><td>synthetic 100×6, 197 KB</td><td className="num">13.20</td><td><a href={EXPLORER_TX("F8Az4MKFdqRYHRw6Pq4RZDrSUs7RJ4nuZZ9qv46Tuqd8")} target="_blank" rel="noreferrer">tx</a></td></tr>
          <tr><td><code>submit_model</code> (validation + storage)</td><td>33 KB</td><td className="num">10.20</td><td><a href={EXPLORER_TX("14BSwbzAViKnu7esMQTf9bN1L3vQiywjMQGqAEX5Tcmv")} target="_blank" rel="noreferrer">tx</a></td></tr>
          <tr><td><code>request_score</code> → OutLayer → callback</td><td>33 KB, 2×150 rows</td><td className="num">12.5 total · ~10 s</td><td><a href={EXPLORER_TX("593SvaUAZLXjrQ2f5XkCnpKTnW8EkYT7h1o1Xmski3oq")} target="_blank" rel="noreferrer">tx</a></td></tr>
          <tr><td><code>close_task</code></td><td>—</td><td className="num">2.23</td><td><a href={EXPLORER_TX("2VLWMbGvyKTJgtekf5Bd4q1F73oSyFpbsM61LAum2cZP")} target="_blank" rel="noreferrer">tx</a></td></tr>
          <tr><td>another contract → <code>predict_task</code> → callback (<code>credit-desk</code>)</td><td>German Credit 50×4</td><td className="num">8.85 total</td><td><a href={EXPLORER_TX("BNR63PPUcD6RgjQyN8nQ1i2iP9uJQfGPcLrozsHAcGz6")} target="_blank" rel="noreferrer">tx</a></td></tr>
          <tr><td>end-to-end from zero (23 steps, 17 negative tests)</td><td>—</td><td className="num">232 s</td><td><a href="https://github.com/" target="_blank" rel="noreferrer">docs/E2E.md</a></td></tr>
        </tbody>
      </table>
      <h3>Flow</h3>
      <pre>{`task creator   ─ outlayer secrets set --wasm-hash <EVALUATOR> ─►  OutLayer (private test set, encrypted)
               ─ create_task ──────────────────────────────────►  bursa (registry contract)
participant    ─ export.py → model.bin ─ submit_model ─────────►  bursa stores the model as DATA (borsh), validates its structure
               ─ request_score ────────────────────────────────►  bursa → OutLayer.request_execution(pinned evaluator, task secrets_ref)
                                                                  TEE worker: evaluator view(get_model_bytes) → scores A/B → on_score callback
anyone         ─ close_task (after the deadline) ───────────────►  winner = highest split-B score
agent/contract ─ predict_task(task_id, features) ───────────────►  inference inside consensus; fee from prepaid credit → owner earnings`}</pre>
      <h3>What is guaranteed and what is not</h3>
      <ul>
        <li>The scoring evaluator is fixed by the contract (hash pinned by the owner), not chosen by participants. The secret opens only for that hash: any other build gets <code>TEST_SET_A missing</code> (tested 2 Nov).</li>
        <li>The model runs inside NEAR consensus: <code>predict</code> results are identical to the evaluator and to Python (tested vector by vector).</li>
        <li>The agent uses a function-call key: the protocol rejects <code>withdraw_credit</code>, deposits, other contracts and transfers from that key (see <code>docs/AGENT.md</code>).</li>
        <li><b>Not guaranteed:</b> Sybil resistance (only the 3-per-account quota + submission fee), secrecy of split-B scores from OutLayer logs, and secrecy of a dataset that is public anyway (German Credit: the private split protects against overfitting through feedback, not against downloading the original data).</li>
        <li>The German Credit dataset (1994, Germany) is used as a <b>simulation</b>; this is not a tool for scoring real people's credit.</li>
      </ul>
      {cfg.data && <p className="muted mono">contract {contractId()} · evaluator {cfg.data.evaluator_hash} · model limits {cfg.data.max_model_bytes.toLocaleString()} B / {cfg.data.max_trees} trees</p>}
    </>
  );
}

export default function App() {
  const { page, id } = useRoute();
  return (
    <>
      <header>
        <div className="wrap">
          <h1><a href="#/">Laurel</a></h1>
          <nav><a href="#/">Tasks</a><a href="#/costs">Costs &amp; how it works</a></nav>
          <span className="contract"><a href={EXPLORER_ACCOUNT(contractId())} target="_blank" rel="noreferrer">{contractId()}</a> · testnet · read-only</span>
        </div>
      </header>
      <main className="wrap">
        {page === "tasks" && <Tasks />}
        {page === "task" && <Task id={id} />}
        {page === "model" && <Model id={id} />}
        {(page === "costs" || page === "biaya") && <Costs />}
      </main>
      <footer>Built at NEAR HACKATHON 2026 · every number comes from the contract's view RPC, no mock data · sister project: Undo</footer>
    </>
  );
}
