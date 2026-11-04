import React, { useEffect, useState } from "react";
import { view, contractId, yoctoToNear, bps, short, statusText, EXPLORER_ACCOUNT, EXPLORER_TX, modelBytes, parseRaw } from "./rpc.js";
import { useView, Err, Loading, Cmd, CopyBtn, Pill, StatusPill, Sec, Fig, Countdown, fmtDate, shortHash, Title, Scale, Slopegraph, DotPlate, Forest, statusDetail } from "./components.jsx";

const REPO = "https://github.com/agadape/laurel";
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
  return { page: parts[0] || "tasks", id: Number(parts[1]) || null };
}
function useTitle(t) { useEffect(() => { document.title = t ? `${t} · Laurel` : "Laurel"; }, [t]); }

/** Bytes of a submission's model, fetched once; undefined on error. */
function useModelBytes(submissionId) {
  const [bytes, setBytes] = useState(null);
  const [n, setN] = useState(0);
  useEffect(() => {
    let alive = true; setBytes(null);
    if (submissionId == null) return;
    modelBytes(submissionId).then((b) => alive && setBytes(b)).catch(() => alive && setBytes(undefined));
    return () => { alive = false; };
  }, [submissionId, n]);
  return [bytes, () => setN((x) => x + 1)];
}

// ---------- Home: exhibits ----------
function LeaderSig({ taskId, closed }) {
  const lb = useView("leaderboard", { task_id: taskId }, [taskId]);
  const lead = lb.data?.[0];
  const [bytes, retry] = useModelBytes(lead?.submission_id);
  if (!lead) return <span className="mono mist">{lb.loading ? "…" : "no entries"}</span>;
  return (
    <div className="stack" style={{ gap: 4 }}>
      <Forest bytes={bytes} trees={lead.trees} limit={16} cols={8} cell={40} accent={closed} onRetry={retry} />
      <span className="mono mist">#{lead.submission_id} · {lead.trees} trees{closed ? " · champion" : " · leads split A"}</span>
    </div>
  );
}

function Home() {
  useTitle("Exhibits");
  const tasks = useView("list_tasks", { from: 0, limit: 50 }, []);
  const cfg = useView("get_config", {}, []);
  const list = (tasks.data || []).slice().reverse();
  const champion = list.find((t) => t.closed && t.winner != null);
  const winner = useView("get_submission", { submission_id: champion?.winner }, [champion?.winner], { skip: champion?.winner == null });
  const [bytes, retry] = useModelBytes(champion?.winner);
  const recent = list.filter((t) => t.task_id > 2), earlier = list.filter((t) => t.task_id <= 2);
  return (
    <>
      <section className="block wrap g12">
        <div className="c6 stack" style={{ gap: 18, justifyContent: "space-between" }}>
          <div className="stack" style={{ gap: 18 }}>
            <h1>Models,<br />observed.</h1>
            <p className="ink2" style={{ maxWidth: 520, fontSize: 17 }}>A registry on NEAR where small decision models are submitted as data, judged inside a TEE on a test set nobody can read, and the best one is served on-chain to agents and other contracts. Every number on this site is read from the contract.</p>
          </div>
          <div className="figs">
            <Fig v={cfg.data ? cfg.data.task_count : <span className="sk" />} l="exhibits (tasks)" />
            <Fig v={cfg.data ? cfg.data.submission_count : <span className="sk" />} l="models judged in a TEE" />
            <Fig v="4.3" unit="Tgas" l="per on-chain prediction" />
          </div>
        </div>
        <div className="c6 stack" style={{ gap: 10 }}>
          <div className="between mono mist">
            <span className="accent-text">{champion ? `Specimen · entry #${champion.winner} · champion of exhibit ${pad2(champion.task_id)}` : "Specimen"}</span>
            <span>{winner.data ? `${winner.data.trees} trees · ${winner.data.bytes.toLocaleString()} B · drawn from the bytes on-chain` : ""}</span>
          </div>
          <div className={`plate ${champion ? "accent" : ""}`} style={{ padding: 14 }}>
            {champion ? <Forest bytes={bytes} trees={winner.data?.trees || 50} limit={50} cols={10} accent onRetry={retry} /> : <div className="mist mono">{tasks.loading ? "reading the contract…" : "no closed exhibit yet"}</div>}
          </div>
          <p className="mist" style={{ fontSize: 13 }}>Each glyph is one of the model's decision trees, decoded from the borsh bytes the contract stores: stroke = leaf weight, tone = split feature. <a href={champion ? `#/model/${champion.winner}` : "#/"}>Open the specimen</a> to read each tree's root split.</p>
        </div>
      </section>

      <section className="block wrap">
        <div className="row-head"><span className="accent-text">02 — Exhibits</span><span>Task</span><span className="sig">Leader's signature</span><span className="right">Split A · observed</span><span className="right">Split B · at close</span><span className="right state">State</span></div>
        {tasks.error && <Err error={tasks.error} reload={tasks.reload} />}
        {recent.map((t) => <ExhibitRow key={t.task_id} t={t} />)}
        {earlier.length > 0 && (
          <div className="flow" style={{ paddingTop: 12 }}>
            <span className="label">earlier exhibits</span>
            {earlier.map((t) => <a key={t.task_id} href={`#/task/${t.task_id}`} className="mono mist">{pad2(t.task_id)} · {t.slug} · {t.closed ? `closed · champion #${t.winner}` : "open"}</a>)}
          </div>
        )}
        {tasks.data && tasks.data.length === 0 && <p className="mist" style={{ paddingTop: 12 }}>No tasks on this contract yet.</p>}
      </section>

      <section className="block wrap g12" style={{ alignItems: "baseline" }}>
        <div className="c2"><Sec n="03" title="Method" /></div>
        <div className="c10 stack">
          <FlowDiagram />
          <div className="flow"><span>submit a model as data</span><span className="arrow">→</span><span>judged in a TEE by the pinned evaluator <span className="mono">{cfg.data ? shortHash(cfg.data.evaluator_hash) : "…"}</span></span><span className="arrow">→</span><span>split A public, split B sealed until close</span><span className="arrow">→</span><span>the champion serves <span className="mono">predict_task</span></span><a href="#/costs" className="mono">measured costs and guarantees →</a></div>
        </div>
      </section>
    </>
  );
}

function ExhibitRow({ t }) {
  const lb = useView("leaderboard", { task_id: t.task_id }, [t.task_id]);
  const rows = lb.data || [];
  const leadA = rows.slice().sort((a, b) => (b.score_a_bps ?? -1) - (a.score_a_bps ?? -1))[0];
  const win = rows.find((r) => r.submission_id === t.winner);
  return (
    <a href={`#/task/${t.task_id}`} className="row">
      <span className={`n ${t.closed ? "accent" : ""}`}>{pad2(t.task_id)}</span>
      <span className="t"><b><Title text={t.title} /></b><span className="mono mist">{t.slug} · {t.n_features} features · {t.closed ? `closed ${fmtDate(t.deadline_ns)}` : <Countdown ns={t.deadline_ns} />} · {t.submission_count} {t.submission_count === 1 ? "entrant" : "entrants"}</span></span>
      <span className="sig"><LeaderSig taskId={t.task_id} closed={t.closed} /></span>
      <span className="r" style={t.closed ? { color: "var(--mist)" } : undefined}><small className="ab">A</small>{leadA ? <>{bps(leadA.score_a_bps)}<span className="sub">#{leadA.submission_id}{t.closed && leadA.submission_id !== t.winner ? " led here" : ""}</span></> : <small>—</small>}</span>
      <span className="r"><small className="ab">B</small>{t.closed ? (win ? <span className="accent">{bps(win.score_b_bps)}<span className="sub">#{win.submission_id} decided here</span></span> : <small>—</small>) : <Pill kind="sealed">not yet observed</Pill>}</span>
      <span className="state">{t.closed ? <Pill>closed</Pill> : <Pill kind="open">open</Pill>}</span>
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
  if (t.error || !task) return <section className="block wrap"><Err error={t.error || `task ${id} not found`} reload={t.reload} /></section>;
  const champ = rows.find((r) => r.submission_id === task.winner);
  const ds = datasetDir(task.slug);
  const bestA = Math.max(-1, ...rows.map((x) => x.score_a_bps ?? -1));
  const entriesA = rows.filter((r) => r.score_a_bps != null).map((r) => ({ id: r.submission_id, bps: r.score_a_bps, href: `#/model/${r.submission_id}`, label: `#${r.submission_id}${task.closed && r.submission_id !== task.winner && r.score_a_bps === bestA ? " · led" : ""}`, muted: task.closed && r.submission_id !== task.winner, accent: false }));
  const entriesB = rows.filter((r) => r.score_b_bps != null).map((r) => ({ id: r.submission_id, bps: r.score_b_bps, href: `#/model/${r.submission_id}`, label: r.submission_id === task.winner ? `#${r.submission_id} · champion` : `#${r.submission_id}`, accent: r.submission_id === task.winner, muted: r.submission_id !== task.winner }));
  const leadA = entriesA.slice().sort((a, b) => b.bps - a.bps)[0];
  const sealedText = `sealed in the contract's leaderboard until ${fmtDate(task.deadline_ns)}`;
  const one = rows.length === 1;
  return (
    <>
      <section className="block wrap g12" style={{ alignItems: "end" }}>
        <div className="c2"><span className={`numeral ${task.closed ? "accent" : ""}`} aria-hidden="true">{pad2(task.task_id)}</span></div>
        <div className="c6 stack" style={{ gap: 8 }}>
          <a href="#/" className="mono mist">← Exhibits</a>
          <h1 className="h2">Exhibit {pad2(task.task_id)}: <Title text={task.title} /></h1>
          <div className="mono mist">{task.slug} · {task.n_features} integer features · balanced accuracy · {task.closed ? `closed ${fmtDate(task.deadline_ns)}` : <Countdown ns={task.deadline_ns} />} · {task.submission_count} {task.submission_count === 1 ? "entrant" : "entrants"}{task.closed && task.winner != null && <> · champion #{task.winner}</>} {task.closed ? <Pill>closed</Pill> : <Pill kind="open">open</Pill>}</div>
        </div>
        <div className="c4 stack aside" style={{ gap: 10, fontSize: 13 }}>
          <div className="stack" style={{ gap: 2 }}><span className="label">Instrument</span><span>OutLayer TEE · evaluator <span className="mono tee">{cfg.data ? shortHash(cfg.data.evaluator_hash) : "…"}</span> pinned by the contract</span></div>
          <div className="stack" style={{ gap: 2 }}><span className="label">Specimen set</span><span><span className="mono">{task.secrets_account} / {task.secrets_profile}</span> · two sealed splits, never leave the enclave</span></div>
        </div>
      </section>

      <section className="block wrap g12 chapter">
        <div className="c2"><Sec n="01" title="Readings" /></div>
        <div className="c10 stack" style={{ gap: 18 }}>
          {lb.error && <Err error={lb.error} reload={lb.reload} />}
          <Scale variant="a" title={<><b>Split A</b> · observed in public while the exhibit is open</>} note="balanced accuracy, 50–100 %" entries={entriesA} />
          {task.closed && <Slopegraph entries={rows.map((r) => ({ id: r.submission_id, a: r.score_a_bps, b: r.score_b_bps }))} winner={task.winner} />}
          <Scale variant="b" title={<><b className="accent-text">Split B</b> · observed once at close · decides the champion</>} note={task.closed ? `unsealed ${fmtDate(task.deadline_ns)}` : sealedText} entries={entriesB} sealed={task.closed ? null : sealedText} reveal={task.closed} />
          {task.closed && champ && leadA && leadA.id !== champ.submission_id && (
            <p className="ink2" style={{ fontSize: 14, maxWidth: 760 }}>The lines cross: #{leadA.id} read higher on the public split, #{champ.submission_id} on the sealed one, and the sealed reading is the only one a model could not have been tuned against, so it decides.</p>
          )}
          {!task.closed && <p className="ink2" style={{ fontSize: 14, maxWidth: 760 }}>Split A is the public reading. Split B is scored at the same time, but the leaderboard withholds it until the deadline passes and someone calls <span className="mono">close_task</span>; the champion is the best split-B reading.</p>}
        </div>
      </section>

      <section className="block wrap g12">
        <div className="c2"><Sec n="02" title="Specimens" /></div>
        <div className="c10 g12" style={{ rowGap: 28 }}>
          {rows.length === 0 && !lb.loading && <p className="mist c12">no entries yet</p>}
          {rows.map((r) => {
            const s = subs[r.submission_id]; const raw = parseRaw(s?.sub?.last_outlayer_raw);
            const isChamp = task.closed && r.submission_id === task.winner;
            const split = task.closed ? "b" : "a"; const counts = raw ? raw[split] : null;
            const scored = statusText(r.status) === "Scored";
            return (
              <a key={r.submission_id} href={`#/model/${r.submission_id}`} className={`spec ${one ? "c12 wide" : "c6"} ${isChamp ? "accent" : ""}`}>
                <div className="head"><b>#{r.submission_id}{isChamp ? " · champion" : ""}</b><span className="mono mist">{short(r.owner, 12)} · {r.bytes.toLocaleString()} B · <StatusPill status={r.status} /></span></div>
                <div className="body">
                  <div>{scored ? <DotPlate counts={counts} caption={`split ${split.toUpperCase()} · ${counts?.n ?? ""} rows · one dot per private test row`} /> : <div className="mist mono">{statusText(r.status) === "Failed" ? `failed: ${statusDetail(r.status)}` : statusText(r.status) === "Pending" ? "in the TEE…" : "not scored yet"}</div>}</div>
                  <div className="stack" style={{ gap: 4 }}>
                    <span className="label">signature</span>
                    <Forest bytes={s?.bytes} trees={r.trees} limit={one ? 50 : 30} cols={10} cell={40} accent={isChamp} featureNames={task.feature_names} onRetry={() => setRetryN((x) => x + 1)} />
                    <span className="mono mist">{r.trees} trees{s?.sub ? ` · ${s.sub.nodes.toLocaleString()} nodes` : ""}{r.trees > (one ? 50 : 30) ? ` (${one ? 50 : 30} shown)` : ""}</span>
                  </div>
                </div>
              </a>
            );
          })}
        </div>
      </section>

      {task.closed && champ && (
        <section className="block wrap g12" style={{ alignItems: "center" }}>
          <div className="c2"><Sec n="03" title="In service" /></div>
          <div className="c6 between"><span className="mono" style={{ fontSize: 15 }}>predict_task({task.task_id}, features) → #{champ.submission_id}</span><span className="mist" style={{ fontSize: 13 }}>agents with a function-call key · contracts via promise · ≈ 4.3 Tgas</span></div>
          <div className="c4 figs-r">
            <Fig v={champ.calls} l="predictions served" />
            <Fig v={earnings.data ? yoctoToNear(earnings.data, 3) : <span className="sk" />} l={`NEAR earned by ${short(champ.owner, 8)}`} />
          </div>
        </section>
      )}

      <section className="block wrap g12">
        <div className="c2"><Sec n={task.closed ? "04" : "03"} title="Enter" /></div>
        <div className="c5 stack">
          <dl className="kv">
            <dt>features</dt><dd className="mono">{task.feature_names.join(", ")}</dd>
            <dt>entry</dt><dd>{yoctoToNear(task.submission_fee, 2)} NEAR + model storage · {task.max_per_account} entries per account</dd>
            <dt>fee per call</dt><dd>{yoctoToNear(task.fee_per_call, 4)} NEAR, paid from prepaid credit to the model owner</dd>
            <dt>limits</dt><dd>≤ {cfg.data ? (cfg.data.max_model_bytes / 1024).toFixed(0) : "…"} KB · ≤ {cfg.data?.max_trees ?? "…"} trees · strictly increasing child indices</dd>
            <dt>creator</dt><dd className="mono"><a href={EXPLORER_ACCOUNT(task.creator)} target="_blank" rel="noreferrer">{task.creator}</a></dd>
          </dl>
        </div>
        <div className="c5 stack">
          <span className="label">train on the public split, export, submit (no browser wallet; scripts in the repo)</span>
          <Cmd>{`python tasks/${ds}/train.py --trees 50 --depth 4
python tools/export.py --task ${ds} --model tasks/${ds}/model_baseline.pkl --out tasks/${ds}/out/mine
node tools/submit.mjs ${task.task_id} tasks/${ds}/out/mine/model.bin --as TEAM      # contract: ${contractId()}`}</Cmd>
          <details><summary>create a task like this (task creator)</summary>
            <Cmd>{`python tasks/${ds}/split.py                                   # public data + private splits + sha256 manifest
bash tools/secrets.sh ${ds} ${task.secrets_profile} <evaluator hash>   # (WSL) store the private test set, bound to the evaluator hash
node tools/create_task.mjs ${ds} --slug-override ${task.slug} --minutes 1440 --as TEAM`}</Cmd>
          </details>
          {task.closed && <details><summary>call the champion from an agent</summary>
            <Cmd>{`node tools/predict.mjs ${task.task_id} --row 0 --as AGENT --deposit 0.02     # prepay once; later calls only use the function-call key
node tools/agent.mjs ${task.task_id} --rows 10                                 # 10 applicants + proof that the restricted key is rejected by the protocol`}</Cmd>
          </details>}
        </div>
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
  useTitle(`Specimen #${id || ""}`);
  if (s.loading) return <section className="block wrap"><Loading /></section>;
  if (s.error || !sub) return <section className="block wrap"><Err error={s.error || `submission ${id} not found`} reload={s.reload} /></section>;
  const task = t.data; const raw = parseRaw(sub.last_outlayer_raw);
  const isChamp = !!task?.closed && task.winner === sub.submission_id;
  // split B is shown only once the task is closed, whatever the submission view returns
  const bVisible = sub.score_b_bps != null && !!task?.closed;
  const rawShown = raw && !bVisible ? { ...raw, b: "sealed until the exhibit closes" } : raw;
  const st = statusText(sub.status);
  const sealedLine = task ? `sealed in the leaderboard until ${fmtDate(task.deadline_ns)}` : "sealed until the exhibit closes";
  return (
    <>
      <section className="block wrap g12" style={{ alignItems: "end" }}>
        <div className="c7 stack" style={{ gap: 8 }}>
          <a href={`#/task/${sub.task_id}`} className="mono mist">← Exhibit {pad2(sub.task_id)}{task ? ` · ${task.slug}` : ""}</a>
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}><h1 className="h2">Specimen <span className={isChamp ? "accent" : ""}>#{sub.submission_id}</span></h1>{isChamp && <Pill kind="champion">champion · in service</Pill>}<StatusPill status={sub.status} /></div>
          <div className="mono mist"><a href={EXPLORER_ACCOUNT(sub.owner)} target="_blank" rel="noreferrer">{sub.owner}</a> · {sub.trees} trees · {sub.nodes.toLocaleString()} nodes · {sub.bytes.toLocaleString()} B · submitted {fmtDate(sub.submitted_at_ns)}</div>
        </div>
        <div className="c5 stack" style={{ gap: 8 }}>
          <span className="label">evaluation record</span>
          <div className="stepper">
            {["uploaded", "in the TEE", "scored"].map((step, i) => {
              const reached = st === "Scored" ? 3 : st === "Pending" ? 2 : st === "Failed" ? 2 : 1;
              const on = i < reached, bad = st === "Failed" && i === 1;
              const col = on ? (bad ? "var(--fault)" : "var(--tee-text)") : "var(--rule)";
              return (
                <React.Fragment key={step}>
                  {i > 0 && <span className="line" style={{ background: col }} />}
                  <span className="step"><span className="dot" style={{ background: col }} /><span className="label" style={{ color: on ? col : undefined }}>{bad ? "failed" : step}</span></span>
                </React.Fragment>
              );
            })}
          </div>
          <span className="mono mist">{raw ? `block ${raw.block} · eval_version ${raw.eval_version}` : st === "Failed" ? statusDetail(sub.status) : "no evaluator output yet"}{sub.scored_by ? ` · by evaluator ${shortHash(sub.scored_by)}` : ""}</span>
        </div>
      </section>

      <section className="block wrap g12 chapter">
        <div className="c2"><Sec n="01" title="Readings" /></div>
        <div className="c10 g12">
          <div className="c6 reading sep">
            <span className="label">split A · open · balanced accuracy</span>
            <span className="v" style={{ color: "var(--ink-2)" }}>{sub.score_a_bps != null ? <>{(sub.score_a_bps / 100).toFixed(2)}<small> %</small></> : <small>not scored</small>}</span>
            <span className="mono mist">{raw?.a ? `F1 ${bps(sub.f1_a_bps)} · ${raw.a.n} rows · ${raw.a.n_pos} positive` : ""}</span>
          </div>
          <div className="c6 reading">
            <span className="label accent-text">split B · final · balanced accuracy</span>
            <span className="v accent">{bVisible ? <>{(sub.score_b_bps / 100).toFixed(2)}<small> %</small></> : <Pill kind="sealed">not yet observed · {sealedLine}</Pill>}</span>
            <span className="mono mist">{bVisible && raw?.b ? `F1 ${bps(sub.f1_b_bps)} · ${raw.b.n} rows · ${raw.b.n_pos} positive · unsealed at close` : ""}</span>
          </div>
        </div>
      </section>

      <section className="block wrap g12">
        <div className="c2"><Sec n="02" title="The model" /></div>
        <div className="c10 stack">
          <div className="between mono mist"><span className="accent-text">all {sub.trees} trees, drawn from the bytes on-chain</span><span>{isChamp ? "champion: orange roots" : ""}</span></div>
          <div className={`plate ${isChamp ? "accent" : ""}`} style={{ padding: 14 }}><Forest bytes={bytes} trees={sub.trees} limit={500} cols={10} draw featureNames={task?.feature_names || []} accent={isChamp} onRetry={retry} readout /></div>
        </div>
      </section>

      <section className="block wrap g12">
        <div className="c2"><Sec n="03" title="Specimen plates" /></div>
        <div className="c10 g12">
          <div className="c6"><DotPlate counts={raw?.a} caption="split A · one dot per private test row" /></div>
          <div className="c6"><DotPlate counts={bVisible ? raw?.b : null} caption="split B · one dot per private test row" ghost={raw?.a?.n || 150} ghostText={bVisible ? undefined : sealedLine} /></div>
        </div>
      </section>

      <section className="block wrap g12">
        <div className="c2"><Sec n="04" title="Provenance" /></div>
        <div className="c10 stack">
          <dl className="kv">
            <dt>model sha256</dt><dd className="mono">{sub.model_hash}<CopyBtn text={sub.model_hash} label="copy model hash" /></dd>
            <dt>evaluator sha256</dt><dd className="mono tee">{cfg.data?.evaluator_hash ?? "…"}{cfg.data && <CopyBtn text={cfg.data.evaluator_hash} label="copy evaluator hash" />}</dd>
            <dt>evaluator wasm</dt><dd className="mono"><a href={cfg.data?.evaluator_url} target="_blank" rel="noreferrer">{cfg.data ? cfg.data.evaluator_url.replace(/^https?:\/\//, "").slice(0, 60) + "…" : "…"}</a></dd>
            <dt>scored by</dt><dd className="mono">{cfg.data ? `${cfg.data.outlayer} (TEE worker)` : "…"}{sub.scored_by ? ` · evaluator ${shortHash(sub.scored_by)}${cfg.data && sub.scored_by === cfg.data.evaluator_hash ? " = pinned" : " ≠ pinned"}` : ""}</dd>
            <dt>owner</dt><dd className="mono"><a href={EXPLORER_ACCOUNT(sub.owner)} target="_blank" rel="noreferrer">{sub.owner}</a></dd>
            <dt>calls · earnings</dt><dd>{sub.calls} · {e.data ? yoctoToNear(e.data, 3) : "…"} NEAR (owner withdraws via <span className="mono">withdraw_earnings</span>)</dd>
          </dl>
          <details><summary>raw evaluator output stored on-chain (≤ 900 B){!bVisible && raw ? " · split B withheld until close" : ""}</summary><pre>{rawShown ? JSON.stringify(rawShown, null, 2) : (sub.last_outlayer_raw || "not scored yet")}</pre></details>
        </div>
      </section>

      <section className="block wrap g12">
        <div className="c2"><Sec n="05" title="Call it" /></div>
        <div className="c10 stack">
          <p className="ink2" style={{ fontSize: 14 }}>Metered change method: the fee is taken from the caller's prepaid credit. Features are integers in the task's feature order. Raw score &gt; 0 ⇒ positive class.</p>
          <Cmd>{`node tools/predict.mjs ${sub.task_id} --submission ${sub.submission_id} --row 0 --as AGENT`}</Cmd>
          <Cmd>{`near contract call-function as-transaction ${contractId()} predict json-args '{"submission_id":${sub.submission_id},"features":[0,24,2,3,2500,0,2,3,0,2,1,35,2,1,1,2,1,0]}' prepaid-gas '30 Tgas' attached-deposit '0 NEAR' sign-as <agent> network-config testnet`}</Cmd>
        </div>
      </section>
    </>
  );
}

// ---------- Method / costs ----------
const STAGES = ["submit as data", "validate", "request_score", "TEE evaluator", "A public · B sealed", "close → champion", "predict_task"];
function FlowDiagram() {
  return (
    <>
      <svg className="only-wide" viewBox="0 0 1000 110" role="img" aria-label="flow from submission to on-chain prediction">
        {STAGES.map((s, i) => {
          const x = 10 + i * 141, w = 128, sealed = i === 4, tee = i === 3, last = i === 6;
          return (
            <g key={s}>
              <rect x={x} y={30} width={w} height={54} fill={last ? "var(--accent)" : "var(--plate)"} stroke={sealed ? "var(--sealed)" : tee ? "var(--tee-text)" : "var(--ink)"} strokeWidth={tee ? 2.5 : 1.5} strokeDasharray={sealed ? "4 3" : undefined} />
              <text x={x + w / 2} y={61} textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="11" fill={last ? "var(--paper)" : tee ? "var(--tee-text)" : "var(--ink)"}>{s}</text>
              {i < STAGES.length - 1 && <path d={`M${x + w} 57 l13 0`} stroke="var(--ink)" strokeWidth={1.5} />}
            </g>
          );
        })}
        <text x={10} y={104} fontFamily="JetBrains Mono, monospace" fontSize="11" fill="var(--mist)">participant → contract → OutLayer worker (TEE) → contract → anyone (close) → agents and contracts (calls, fee to the owner)</text>
      </svg>
      <ol className="flow-v only-narrow">{STAGES.map((s, i) => <li key={s} className={i === 4 ? "sealed" : i === 3 ? "tee" : i === 6 ? "last" : ""}>{s}</li>)}</ol>
    </>
  );
}

function Costs() {
  useTitle("Method");
  const cfg = useView("get_config", {}, []);
  const rows = [
    ["predict_task from an agent (function-call key)", "German Credit 50×4, 33 KB", "4.31", "8tTi9dbVnZfwMZkmqgMVG1FfXyihUs8MssCXraNELFMS"],
    ["predict", "synthetic 100×6, 197 KB", "13.20", "F8Az4MKFdqRYHRw6Pq4RZDrSUs7RJ4nuZZ9qv46Tuqd8"],
    ["submit_model (validation + storage)", "33 KB", "10.20", "14BSwbzAViKnu7esMQTf9bN1L3vQiywjMQGqAEX5Tcmv"],
    ["request_score → OutLayer → callback", "33 KB, 2×150 rows", "12.5 total · ~10 s", "593SvaUAZLXjrQ2f5XkCnpKTnW8EkYT7h1o1Xmski3oq"],
    ["close_task", "—", "2.23", "2VLWMbGvyKTJgtekf5Bd4q1F73oSyFpbsM61LAum2cZP"],
    ["another contract → predict_task → callback (credit-desk)", "German Credit 50×4", "8.85 total", "BNR63PPUcD6RgjQyN8nQ1i2iP9uJQfGPcLrozsHAcGz6"],
  ];
  return (
    <>
      <section className="block wrap g12" style={{ alignItems: "end" }}>
        <div className="c7 stack" style={{ gap: 12 }}><h1 className="h2">How a model becomes infrastructure.</h1><p className="ink2" style={{ fontSize: 15, maxWidth: 560 }}>Numbers below were measured on NEAR testnet on 2–4 Nov 2026; each row links to its transaction. 1 Tgas ≈ 0.0001 NEAR at the base gas price.</p></div>
      </section>
      <section className="block wrap g12">
        <div className="c2"><Sec n="01" title="Flow" /></div>
        <div className="c10"><FlowDiagram /></div>
      </section>
      <section className="block wrap g12">
        <div className="c2"><Sec n="02" title="Measured cost" /></div>
        <div className="c10 scrollx">
          <table>
            <thead><tr><th>Operation</th><th>Model</th><th className="num">Tgas (function receipt)</th><th>Proof</th></tr></thead>
            <tbody>
              {rows.map((r) => <tr key={r[0]}><td><span className="mono" style={{ fontSize: 13 }}>{r[0]}</span></td><td>{r[1]}</td><td className="num">{r[2]}</td><td><a href={EXPLORER_TX(r[3])} target="_blank" rel="noreferrer" className="mono">{shortHash(r[3], 6)}</a></td></tr>)}
              <tr><td>end-to-end from a fresh account (23 steps, 17 negative tests)</td><td>—</td><td className="num">232 s</td><td><a href={`${REPO}/blob/main/docs/E2E.md`} target="_blank" rel="noreferrer" className="mono">docs/E2E.md</a></td></tr>
            </tbody>
          </table>
        </div>
      </section>
      <section className="block wrap g12">
        <div className="c2"><Sec n="03" title="Guaranteed, and not" /></div>
        <ul className="plain c10">
          <li>The scoring evaluator is fixed by the contract (hash pinned by the owner), not chosen by participants. The secret opens only for that hash: any other build gets <span className="mono">TEST_SET_A missing</span> (tested 2 Nov).</li>
          <li>The model runs inside NEAR consensus: <span className="mono">predict</span> results are identical to the evaluator and to Python, vector by vector.</li>
          <li>The agent uses a function-call key: the protocol rejects <span className="mono">withdraw_credit</span>, deposits, other contracts and transfers from that key (see <span className="mono">docs/AGENT.md</span>).</li>
          <li><b>Not guaranteed:</b> Sybil resistance (only the 3-per-account quota + submission fee), secrecy of split-B scores from OutLayer logs or from the <span className="mono">get_submission</span> view (the leaderboard withholds them; this site withholds them too), and secrecy of a dataset that is public anyway (German Credit: the private split protects against overfitting through feedback, not against downloading the original data).</li>
          <li>The German Credit dataset (1994, Germany) is used as a <b>simulation</b>; this is not a tool for scoring real people's credit.</li>
        </ul>
      </section>
      {cfg.data && <section className="block wrap"><p className="mono mist" style={{ overflowWrap: "anywhere" }}>contract {contractId()} · evaluator {shortHash(cfg.data.evaluator_hash, 10)}<CopyBtn text={cfg.data.evaluator_hash} label="copy evaluator hash" /> · model limits {cfg.data.max_model_bytes.toLocaleString()} B / {cfg.data.max_trees} trees · {cfg.data.outlayer}</p></section>}
    </>
  );
}

export default function App() {
  const { page, id } = useRoute();
  const isMethod = page === "costs" || page === "biaya";
  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <header>
        <div className="wrap">
          <div className="brand"><a href="#/">LAUREL</a><span>Observatory of small models</span></div>
          <nav aria-label="primary"><a href="#/" className={!isMethod ? "on" : ""}>Exhibits</a><a href="#/costs" className={isMethod ? "on" : ""}>Method</a><a href={REPO} target="_blank" rel="noreferrer">Source</a></nav>
          <span className="contract"><a href={EXPLORER_ACCOUNT(contractId())} target="_blank" rel="noreferrer">{contractId()}</a> · testnet · read-only</span>
        </div>
      </header>
      <main id="main" tabIndex={-1}>
        {page === "tasks" && <Home />}
        {page === "task" && <Task id={id} />}
        {page === "model" && <Model id={id} />}
        {isMethod && <Costs />}
      </main>
      <footer><div className="wrap"><span>Built at NEAR HACKATHON 2026 · every number is read live from <a href={EXPLORER_ACCOUNT(contractId())} target="_blank" rel="noreferrer" className="mono">{contractId()}</a> · no mock data · sister project: Undo (same team)</span><a href={REPO} target="_blank" rel="noreferrer" className="mono">github.com/agadape/laurel</a></div></footer>
    </>
  );
}
