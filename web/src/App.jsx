import React, { useEffect, useState } from "react";
import { view, contractId, yoctoToNear, statusText, EXPLORER_ACCOUNT, modelBytes, parseRaw, nsToDate, short } from "./rpc.js";
import { decodeModel } from "./model.js";
import { Lanes, Clock, TreeExplorer, CostBars, Journey, LaurelIcon, Explainer, Facts, ScoreKey } from "./inner.jsx";
import { network } from "./wallet.js";
import { useView, Err, Loading, Cmd, CopyBtn, StatusPill, Countdown, fmtDate, shortHash, DotPlate, Forest, statusDetail, useModelBytes, mainnetData } from "./components.jsx";
import Connect from "./Connect.jsx";
import { WalletButton, AccountPanel, useWallet } from "./Account.jsx";
import Landing from "./Landing.jsx";
import { hasSavedSession } from "./wallet.js";

// The site has two parts. Signed-out visitors only ever see the landing page, whatever the address; the explorer
// (#/tasks, #/task/:id, #/model/:id, #/costs, #/connect) opens after a NEAR wallet sign-in (connect only, no
// transaction). A deep link keeps its hash, so after signing in the visitor lands on the page the link pointed to.

const REPO = "https://github.com/agadape/laurel";
const UNDO = "https://github.com/agadape/undo";
// task slug → dataset folder in the repo (slugs may differ from folder names)
const datasetDir = (slug) => (/^(credit-risk|german-credit)/.test(slug || "") ? "german-credit" : (slug || "").replace(/-open$/, ""));
const pad2 = (n) => String(n).padStart(2, "0");

// ---------- tiny hash router: #/ , #/task/3 , #/model/4 , #/costs (alias #/biaya) ----------
function useRoute() {
  const [hash, setHash] = useState(window.location.hash || "#/");
  useEffect(() => {
    const f = () => { setHash(window.location.hash || "#/"); window.scrollTo(0, 0); document.getElementById("main")?.focus({ preventScroll: true }); };
    window.addEventListener("hashchange", f);
    return () => window.removeEventListener("hashchange", f);
  }, []);
  const parts = hash.replace(/^#\/?/, "").split("?")[0].split("/");
  const known = ["tasks", "task", "model", "costs", "biaya", "connect"];
  return { page: known.includes(parts[0]) ? parts[0] : "tasks", id: Number(parts[1]) || null };
}
const skipToMain = (e) => { e.preventDefault(); const m = document.getElementById("main"); m?.focus({ preventScroll: true }); m?.scrollIntoView(); };
function useTitle(t) { useEffect(() => { document.title = t ? `${t} · Laurel` : "Laurel"; }, [t]); }

// ---------- shared bits ----------
const pct = (bps) => (bps / 100).toFixed(2);
const plain = (title) => (title || "").replace(/^\[\w+\]\s*/, "");
const day = (ns) => nsToDate(ns).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const bar = (bps) => (bps == null ? 0 : Math.max(0, Math.min(1, (bps - 5000) / 5000)));
const left = (ns) => { const ms = nsToDate(ns) - Date.now(); if (ms <= 0) return "closing"; const d = Math.floor(ms / 864e5), h = Math.floor((ms % 864e5) / 3.6e6); return d > 0 ? `${d}d ${h}h` : `${h}h`; };
const Skel = () => <span className="sk" />;
// what each contest asks, in plain words (the on-chain title stays the heading)
const question = (slug) => (/^near-retention/.test(slug || "") ? "Will a new NEAR account still be active a month later?" : /^(credit-risk|german-credit)/.test(slug || "") ? "Will a borrower repay? A 1994 dataset, used as a simulation." : null);

/** One score as a bar, or the band while it is withheld. */
function Reading({ name, bps: v, withheld, blue = false }) {
  return (
    <div className="x-reading">
      <div className="top"><span>{name}</span>{withheld ? null : <b className={blue ? "x-blue" : ""}>{v != null ? <>{pct(v)}<small> %</small></> : <small>not scored</small>}</b>}</div>
      {withheld ? <span className="x-hatch"><em>{withheld}</em></span> : <span className="x-track thin"><i className={`x-fill ${blue ? "blue" : ""}`} style={{ transform: `scaleX(${bar(v)})` }} /></span>}
    </div>
  );
}

// ---------- Home: exhibits ----------
function Home() {
  useTitle("Exhibits");
  const tasks = useView("list_tasks", { from: 0, limit: 50 }, []);
  const cfg = useView("get_config", {}, []);
  const list = (tasks.data || []).slice().reverse();
  const open = list.find((t) => !t.closed && mainnetData(t.slug)) || list.find((t) => !t.closed);
  const recent = list.filter((t) => t.task_id > 2), earlier = list.filter((t) => t.task_id <= 2);
  return (
    <>
      <section className="block wrap x-hero">
        <h1>Models,<br />observed.</h1>
        <p className="x-lede">A contest for small AI models on NEAR. The winner gets paid every time someone uses it.</p>
      </section>

      <section className="block wrap"><Explainer /></section>

      <section className="block wrap">
        <div className="x-sec-row">
          <h2 className="x-sec">Exhibits</h2>
          <span className="x-mut">{cfg.data ? `${cfg.data.task_count} contests · ${cfg.data.submission_count} models judged` : <Skel />}</span>
        </div>
        {tasks.error && <Err error={tasks.error} reload={tasks.reload} />}
        {tasks.loading && <Loading />}
        <div className="x-board">{recent.map((t) => <ExhibitRow key={t.task_id} t={t} />)}</div>
        {earlier.length > 0 && <div className="x-earlier"><span>Earlier</span>{earlier.map((t) => <a key={t.task_id} href={`#/task/${t.task_id}`}>{pad2(t.task_id)}</a>)}</div>}
        {tasks.data && tasks.data.length === 0 && <p className="x-mut">No contests on this contract yet.</p>}
      </section>

      <section className="block wrap x-two x-choose">
        <a className="x-door" href={open ? `#/task/${open.task_id}` : "#/tasks"}><b>I build models</b><span className="x-mut">Enter a contest</span><i aria-hidden="true">↗</i></a>
        <a className="x-door" href="#/connect"><b>I build agents</b><span className="x-mut">Use the winners</span><i aria-hidden="true">↗</i></a>
      </section>
    </>
  );
}

function ExhibitRow({ t }) {
  const lb = useView("leaderboard", { task_id: t.task_id }, [t.task_id]);
  const rows = lb.data || [];
  const leadA = rows.filter((r) => r.score_a_bps != null).sort((a, b) => b.score_a_bps - a.score_a_bps)[0];
  const win = rows.find((r) => r.submission_id === t.winner);
  return (
    <a href={`#/task/${t.task_id}`} className={`x-ex ${t.closed ? "closed" : "open"}`}>
      <span className="n" aria-hidden="true">{pad2(t.task_id)}</span>
      <span className="what">
        <h3>{/^(credit-risk|german-credit)/.test(t.slug) ? "Will a borrower repay?" : plain(t.title)}</h3>
        <Facts items={[mainnetData(t.slug) ? ["Real NEAR data", "blue"] : ["Simulation, 1994 credit data"], [`${t.submission_count} ${t.submission_count === 1 ? "model" : "models"}`]]} />
      </span>
      <span className="lead">
        <span className="top"><span>{leadA ? `#${leadA.submission_id} ${t.closed ? "led" : "leads"}` : lb.loading ? "…" : "no score yet"}</span><b>{leadA ? pct(leadA.score_a_bps) : "—"}</b></span>
        <span className="x-track thin"><i className="x-fill" style={{ transform: `scaleX(${bar(leadA?.score_a_bps)})` }} /></span>
      </span>
      <span className="end">
        {t.closed
          ? (win ? <span className="champ"><LaurelIcon />#{win.submission_id} won</span> : <span className="x-mut">closed</span>)
          : <span className="x-hatch"><em>Winner in {left(t.deadline_ns)}</em></span>}
      </span>
    </a>
  );
}

// ---------- Task: exhibit ----------
function Task({ id }) {
  const t = useView("get_task", { task_id: id }, [id]);
  const lb = useView("leaderboard", { task_id: id }, [id]);
  const cfg = useView("get_config", {}, []);
  const task = t.data; const rows = lb.data || [];
  useTitle(task ? `Exhibit ${pad2(task.task_id)} · ${task.slug}` : `Exhibit ${pad2(id || 0)}`);
  const [subs, setSubs] = useState({});
  const [retryN, setRetryN] = useState(0);
  useEffect(() => {
    let alive = true;
    Promise.all(rows.map(async (r) => {
      const [s, b] = await Promise.all([view("get_submission", { submission_id: r.submission_id }).catch(() => null), modelBytes(r.submission_id).catch(() => undefined)]);
      return [r.submission_id, { sub: s, bytes: b }];
    })).then((xs) => alive && setSubs(Object.fromEntries(xs))).catch(() => {});
    return () => { alive = false; };
  }, [lb.data, retryN]); // eslint-disable-line
  const earnings = useView("get_earnings", { submission_id: task?.winner }, [task?.winner], { skip: task?.winner == null });
  if (t.loading) return <section className="block wrap"><Loading /></section>;
  if (t.error || !task) return <section className="block wrap"><Err error={t.error || `Exhibit ${id} does not exist on this contract.`} plain={!t.error} reload={t.reload} /></section>;
  const champ = rows.find((r) => r.submission_id === task.winner);
  const ds = datasetDir(task.slug);
  // split B is passed only for a closed exhibit, whatever the views return
  const lanes = rows.map((r) => ({ id: r.submission_id, a: r.score_a_bps, b: task.closed ? r.score_b_bps : null, trees: r.trees, href: `#/model/${r.submission_id}` }));
  const real = mainnetData(task.slug);
  const about = task.description_url && !/^https:\/\/github\.com\/?$/.test(task.description_url) ? task.description_url : null;
  const st = task.closed ? "closed" : "open";
  return (
    <>
      <section className="block wrap x-head">
        <div className="stack" style={{ gap: 22 }}>
          <span className={`x-num ${st}`} aria-hidden="true">{pad2(task.task_id)}</span>
          <h1 className="h2">{plain(task.title)}</h1>
          {question(task.slug) && real === false && <p className="x-lede" style={{ margin: 0 }}>{question(task.slug)}</p>}
          <Facts items={[real && ["Real NEAR mainnet data", "blue"], [`${task.n_features} inputs per row`], [`${task.submission_count} ${task.submission_count === 1 ? "model" : "models"}`], ["Judged in a TEE", "tee"]]} />
        </div>
        <div className="stack" style={{ gap: 12 }}>
          {task.closed
            ? (champ ? <><span className="x-big"><LaurelIcon /><b>#{champ.submission_id}</b> won</span><span className="x-mut">{pct(champ.score_b_bps)} % final score · closed {day(task.deadline_ns)}</span></> : <p className="x-sum">Closed without a scored entry.</p>)
            : <><Clock ns={task.deadline_ns} /><span className="x-mut">until the winner is revealed</span></>}
        </div>
      </section>

      <section className="block wrap">
        <div className="x-sec-row"><h2 className="x-sec">Scores</h2><ScoreKey /></div>
        {lb.error && <Err error={lb.error} reload={lb.reload} />}
        {lb.loading ? <Loading /> : <Lanes rows={lanes} closed={task.closed} winner={task.winner} />}
      </section>

      {task.closed && champ && (
        <section className="block wrap">
          <p className="x-sum">#{champ.submission_id} has answered <b>{champ.calls}</b> paid calls and earned its owner <b>{earnings.data ? yoctoToNear(earnings.data, 3) : "…"}</b> NEAR.</p>
        </section>
      )}

      <section className="block wrap">
        <div className="x-sec-row"><h2 className="x-sec">Models</h2><span className="x-key"><span><i className="dot-ok" />right</span><span><i className="dot-x" />wrong</span><span><i className="dot-ring" />ring = actual no</span></span></div>
        {rows.length === 0 && !lb.loading && <p className="x-mut">No entries yet.</p>}
        <div className="x-cards">
          {rows.map((r) => {
            const s = subs[r.submission_id]; const raw = parseRaw(s?.sub?.last_outlayer_raw);
            const isChamp = task.closed && r.submission_id === task.winner;
            const split = task.closed ? "b" : "a"; const counts = raw ? raw[split] : null;
            const scored = statusText(r.status) === "Scored";
            return (
              <a key={r.submission_id} href={`#/model/${r.submission_id}`} className={`x-card ${isChamp ? "champ" : ""}`}>
                <div className="top"><b>#{r.submission_id}</b>{isChamp ? <span className="x-state closed">winner</span> : <span className="x-mut">{r.trees} trees</span>}</div>
                <Forest bytes={s === undefined ? null : s.bytes} trees={r.trees} limit={10} cols={10} cell={60} accent={isChamp} featureNames={task.feature_names} onRetry={() => setRetryN((x) => x + 1)} />
                {scored
                  ? (s === undefined ? <DotPlate counts={null} ghostText="reading…" compact />
                    : s.sub === null ? <DotPlate counts={null} ghostText="could not read the evaluator output" onRetry={() => setRetryN((x) => x + 1)} compact />
                    : <DotPlate counts={counts} compact />)
                  : <p className="x-mut">{statusText(r.status) === "Failed" ? `failed: ${statusDetail(r.status)}` : statusText(r.status) === "Pending" ? "in the TEE…" : "not scored yet"}</p>}
              </a>
            );
          })}
        </div>
      </section>

      <section className="block wrap">
        <details className="x-dev">
          <summary><b>Build a model for this contest</b><span className="x-mut">inputs, rules and commands</span></summary>
          <div className="x-two" style={{ marginTop: 28 }}>
            <div className="stack" style={{ gap: 18 }}>
              <div className="x-chips">{task.feature_names.map((f) => <span key={f}>{f}</span>)}</div>
              <dl className="x-terms">
                <div><dt>Entry</dt><dd>{yoctoToNear(task.submission_fee, 2)} NEAR + storage · {task.max_per_account} per account</dd></div>
                <div><dt>Paid per call</dt><dd>{yoctoToNear(task.fee_per_call, 4)} NEAR to the owner</dd></div>
                <div><dt>Limits</dt><dd>{cfg.data ? (cfg.data.max_model_bytes / 1024).toFixed(0) : "…"} KB · {cfg.data?.max_trees ?? "…"} trees</dd></div>
                <div><dt>Evaluator</dt><dd className="mono">{cfg.data ? shortHash(cfg.data.evaluator_hash) : "…"}</dd></div>
                <div><dt>Private rows</dt><dd className="mono">{task.secrets_account} / {task.secrets_profile}</dd></div>
                {about && <div><dt>Data</dt><dd><a href={about} target="_blank" rel="noreferrer">About the dataset</a></dd></div>}
              </dl>
            </div>
            <div className="stack" style={{ gap: 14 }}>
              <Cmd>{`python tasks/${ds}/train.py --trees 50 --depth 4
python tools/export.py --task ${ds} --model tasks/${ds}/model_baseline.pkl --out tasks/${ds}/out/mine
node tools/submit.mjs ${task.task_id} tasks/${ds}/out/mine/model.bin --as TEAM      # contract: ${contractId()}`}</Cmd>
              <details><summary>Create a contest like this one</summary>
                <Cmd>{`python tasks/${ds}/split.py
bash tools/secrets.sh ${ds} ${task.secrets_profile} <evaluator hash>
node tools/create_task.mjs ${ds} --slug-override ${task.slug} --minutes 1440 --as TEAM`}</Cmd>
              </details>
              {task.closed && champ && <details><summary>Call the winner from an agent</summary>
                <Cmd>{`node tools/predict.mjs ${task.task_id} --row 0 --as AGENT --deposit 0.02
node tools/agent.mjs ${task.task_id} --rows 10`}</Cmd>
              </details>}
            </div>
          </div>
        </details>
      </section>
    </>
  );
}

// ---------- Model: specimen ----------
function Model({ id }) {
  const s = useView("get_submission", { submission_id: id }, [id]);
  const sub = s.data;
  const t = useView("get_task", { task_id: sub?.task_id }, [sub?.task_id], { skip: sub?.task_id == null });
  const e = useView("get_earnings", { submission_id: id }, [id]);
  const cfg = useView("get_config", {}, []);
  const [bytes, retry] = useModelBytes(sub ? id : null);
  const model = React.useMemo(() => { try { return bytes ? decodeModel(bytes) : null; } catch { return null; } }, [bytes]);
  useTitle(`Specimen #${id || ""}`);
  if (s.loading) return <section className="block wrap"><Loading /></section>;
  if (s.error || !sub) return <section className="block wrap"><Err error={s.error || `Specimen ${id} does not exist on this contract.`} plain={!s.error} reload={s.reload} /></section>;
  const task = t.data; const raw = parseRaw(sub.last_outlayer_raw);
  const isChamp = !!task?.closed && task.winner === sub.submission_id;
  // split B is shown only once the task is closed, whatever the submission view returns
  const bVisible = sub.score_b_bps != null && !!task?.closed;
  const rawShown = raw && !bVisible ? { ...raw, b: "withheld until the exhibit closes" } : raw;
  const st = statusText(sub.status);
  const sealedLine = task ? `Final at close, ${day(task.deadline_ns)}` : "Final at close";
  const reached = st === "Scored" ? 3 : st === "Pending" || st === "Failed" ? 2 : 1;
  const nf = task?.n_features ?? model?.n_features ?? 18;
  return (
    <>
      <section className="block wrap x-head">
        <div className="stack" style={{ gap: 22 }}>
          <h1 className="h2">Specimen <span className={isChamp ? "x-blue" : ""}>#{sub.submission_id}</span></h1>
          <Facts items={[isChamp && ["Winner", "blue"], [`${sub.trees} trees`], [`${(sub.bytes / 1024).toFixed(1)} KB on-chain`], [<a href={`#/task/${sub.task_id}`}>Exhibit {pad2(sub.task_id)}</a>], [<a href={EXPLORER_ACCOUNT(sub.owner)} target="_blank" rel="noreferrer">{short(sub.owner, 18)}</a>]]} />
          <div className="x-steps">
            {["uploaded", "in the TEE", "scored"].map((step, i) => (
              <React.Fragment key={step}>
                {i > 0 && <span className="sep" aria-hidden="true" />}
                <span className={`${i < reached ? "on" : ""} ${st === "Failed" && i === 1 ? "bad" : ""}`}><i />{st === "Failed" && i === 1 ? "failed" : step}</span>
              </React.Fragment>
            ))}
          </div>
        </div>
        <div className="stack" style={{ gap: 22 }}>
          <Reading name="Live score" bps={sub.score_a_bps} />
          <Reading name="Final score" bps={bVisible ? sub.score_b_bps : null} blue={isChamp} withheld={bVisible ? null : sealedLine} />
        </div>
      </section>

      <section className="block wrap">
        <h2 className="x-sec">How it decides</h2>
        {model ? <TreeExplorer model={model} featureNames={task?.feature_names || []} accent={isChamp} />
          : bytes === undefined ? <Err error="model bytes unavailable" plain reload={retry} />
          : bytes ? <Err error="could not decode the model" plain /> : <Loading what="reading the model" />}
      </section>

      <section className="block wrap">
        <div className="x-sec-row"><h2 className="x-sec">Its answers on hidden rows</h2><span className="x-key"><span><i className="dot-ok" />right</span><span><i className="dot-x" />wrong</span><span><i className="dot-ring" />ring = actual no</span></span></div>
        <div className="x-two">
          <DotPlate counts={raw?.a} caption="Live score rows" compact />
          <DotPlate counts={bVisible ? raw?.b : null} caption="Final score rows" ghost={raw?.a?.n || 150} ghostText={bVisible ? undefined : sealedLine} compact />
        </div>
      </section>

      <section className="block wrap">
        <details className="x-dev">
          <summary><b>For developers</b><span className="x-mut">hashes, raw output, how to call it</span></summary>
          <div className="x-two" style={{ marginTop: 28 }}>
            <div className="stack" style={{ gap: 14 }}>
              <dl className="x-terms">
                <div><dt>Model sha256</dt><dd className="mono">{sub.model_hash}<CopyBtn text={sub.model_hash} label="copy model hash" /></dd></div>
                <div><dt>Evaluator sha256</dt><dd className="mono">{cfg.data?.evaluator_hash ?? "…"}{cfg.data && <CopyBtn text={cfg.data.evaluator_hash} label="copy evaluator hash" />}{sub.scored_by && cfg.data && <span className="x-mut"> {sub.scored_by === cfg.data.evaluator_hash ? "· the pinned one" : "· not the pinned one"}</span>}</dd></div>
                <div><dt>Scored at</dt><dd>{raw ? `block ${raw.block} by ${cfg.data?.outlayer ?? "OutLayer"}` : st === "Failed" ? statusDetail(sub.status) : "not yet"}</dd></div>
                <div><dt>Earned</dt><dd>{sub.calls} calls · {e.data ? yoctoToNear(e.data, 3) : "…"} NEAR</dd></div>
              </dl>
              {raw && <div className="stack" style={{ gap: 6 }}><span className="mono ink2">tp {raw.a.tp} · fn {raw.a.fn} · tn {raw.a.tn} · fp {raw.a.fp} (split A){bVisible && raw.b ? ` · tp ${raw.b.tp} · fn ${raw.b.fn} · tn ${raw.b.tn} · fp ${raw.b.fp} (split B)` : ""}</span></div>}
              <details><summary>Raw evaluator output stored on-chain{!bVisible && raw ? " (split B withheld until close)" : ""}</summary><pre>{rawShown ? JSON.stringify(rawShown, null, 2) : (sub.last_outlayer_raw || "not scored yet")}</pre></details>
            </div>
            <div className="stack" style={{ gap: 14 }}>
              <p className="x-mut">Call it with {nf} integers in the task's order. Score above 0 = positive class.</p>
              <Cmd>{`node tools/predict.mjs ${sub.task_id} --submission ${sub.submission_id} --row 0 --as AGENT`}</Cmd>
              <Cmd>{`near contract call-function as-transaction ${contractId()} predict json-args '{"submission_id":${sub.submission_id},"features":[${Array(nf).fill(0).join(",")}]}' prepaid-gas '30 Tgas' attached-deposit '0 NEAR' sign-as <agent> network-config testnet`}</Cmd>
            </div>
          </div>
        </details>
      </section>
    </>
  );
}

// ---------- Method / costs ----------
const COSTS = [
  ["An agent calls a model", "predict_task, 50 trees", 4.31, "4.31 Tgas", "8tTi9dbVnZfwMZkmqgMVG1FfXyihUs8MssCXraNELFMS"],
  ["A large model", "predict, 100 trees, 197 KB", 13.2, "13.20 Tgas", "F8Az4MKFdqRYHRw6Pq4RZDrSUs7RJ4nuZZ9qv46Tuqd8"],
  ["Submit a model", "submit_model, 33 KB", 10.2, "10.20 Tgas", "14BSwbzAViKnu7esMQTf9bN1L3vQiywjMQGqAEX5Tcmv"],
  ["Score it in the TEE", "request_score + callback, ~10 s", 12.5, "12.5 Tgas", "593SvaUAZLXjrQ2f5XkCnpKTnW8EkYT7h1o1Xmski3oq"],
  ["Close the contest", "close_task", 2.23, "2.23 Tgas", "2VLWMbGvyKTJgtekf5Bd4q1F73oSyFpbsM61LAum2cZP"],
  ["A contract calls a model", "promise + callback", 8.85, "8.85 Tgas", "BNR63PPUcD6RgjQyN8nQ1i2iP9uJQfGPcLrozsHAcGz6"],
];

function Costs() {
  useTitle("Method");
  return (
    <>
      <section className="block wrap x-hero">
        <h1 className="h2">How a model becomes infrastructure.</h1>
        <p className="x-lede">Seven steps, all on NEAR. Every cost below is a real testnet transaction.</p>
      </section>
      <section className="block wrap">
        <Journey />
      </section>
      <section className="block wrap">
        <div className="x-sec-row"><h2 className="x-sec">What it costs</h2><span className="x-mut">1 Tgas ≈ 0.0001 NEAR</span></div>
        <CostBars rows={COSTS} />
        <p className="x-mut" style={{ marginTop: 28 }}>Full run from a fresh account: 23 steps, 232 s, 17 misuse attempts rejected (<a href={`${REPO}/blob/main/docs/E2E.md`} target="_blank" rel="noreferrer">docs/E2E.md</a>).</p>
      </section>
      <section className="block wrap">
        <div className="x-two">
          <div className="x-panel blue">
            <h3>Guaranteed</h3>
            <ul className="x-guar">
              <li>The contract picks the judge, not the players.</li>
              <li>The model's answer on-chain equals the judge's and Python's.</li>
              <li>An agent's key can only buy predictions.</li>
            </ul>
          </div>
          <div className="x-panel orange">
            <h3>Not guaranteed</h3>
            <ul className="x-guar not">
              <li>Sybil resistance: only 3 entries per account and a fee.</li>
              <li>Final scores are readable on-chain before close; only the leaderboard hides them. The rows stay sealed.</li>
              <li>Both datasets are public; the split only keeps test rows out of training.</li>
            </ul>
          </div>
        </div>
        <p className="x-mut" style={{ marginTop: 28 }}>Details and proofs: <a href={`${REPO}#security-model-and-trust-boundaries`} target="_blank" rel="noreferrer">security model</a> · <a href={`${REPO}/blob/main/CLAIMS.md`} target="_blank" rel="noreferrer">CLAIMS.md</a>. Data: UCI German Credit (1994, a simulation, not a credit tool) and NEAR mainnet account retention (<a href={`${REPO}/blob/main/tasks/near-retention/README.md`} target="_blank" rel="noreferrer">real on-chain data</a>).</p>
      </section>
    </>
  );
}

export default function App() {
  const route = useRoute();
  const { page, id } = route;
  const w = useWallet();
  if (!w.accountId) {
    if (hasSavedSession() && !w.ready && !w.error) {
      return <main id="main" tabIndex={-1} className="restoring wrap"><span className="brand-word">LAUREL</span><p className="mist mono">restoring your wallet session…</p></main>;
    }
    return <Landing />;
  }
  const isMethod = page === "costs" || page === "biaya";
  const isConnect = page === "connect";
  const isExhibits = !isMethod && !isConnect;
  return (
    <>
      <a className="skip" href="#main" onClick={skipToMain}>Skip to content</a>
      <header>
        <div className="wrap">
          <div className="brand"><a href="#/">LAUREL</a><span>Observatory of small models</span></div>
          <nav aria-label="primary"><a href="#/" className={isExhibits ? "on" : ""} aria-current={isExhibits ? "page" : undefined}>Exhibits</a><a href="#/costs" className={isMethod ? "on" : ""} aria-current={isMethod ? "page" : undefined}>Method</a><a href="#/connect" className={isConnect ? "on" : ""} aria-current={isConnect ? "page" : undefined}>Connect your agent</a><a href={REPO} target="_blank" rel="noreferrer">Source</a></nav>
          <span className="x-status"><i />Live on NEAR {network}</span>
          <WalletButton />
        </div>
      </header>
      <main id="main" tabIndex={-1}>
        {page === "tasks" && <Home />}
        {page === "task" && <Task id={id} />}
        {page === "model" && <Model id={id} />}
        {isMethod && <Costs />}
        {isConnect && <Connect />}
      </main>
      <footer className="x-foot"><div className="x-foot-grid">
        <p className="x-foot-line">Small models, judged in the dark, paid in the open.</p>
        <nav aria-label="Explore"><b>Explore</b><a href="#/tasks">Exhibits</a><a href="#/costs">Method</a><a href="#/connect">Connect your agent</a></nav>
        <nav aria-label="Verify"><b>Verify</b><a href={REPO} target="_blank" rel="noreferrer">Source on GitHub</a><a href={EXPLORER_ACCOUNT(contractId())} target="_blank" rel="noreferrer">Contract on NearBlocks</a><a href="/api/mcp" target="_blank" rel="noreferrer">Remote MCP</a></nav>
        <nav aria-label="Team"><b>Team</b><a href={UNDO} target="_blank" rel="noreferrer">Undo, our sister project</a><span>NEAR HACKATHON 2026</span></nav>
      </div>
      <p className="x-foot-note">Every number is read live from <span className="mono">{contractId()}</span> on NEAR {network}. No mock data.</p>
      <div className="x-foot-word" aria-hidden="true">LAUREL</div></footer>
    </>
  );
}
