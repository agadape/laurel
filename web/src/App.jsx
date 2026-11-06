import React, { useEffect, useState } from "react";
import { view, contractId, yoctoToNear, statusText, EXPLORER_ACCOUNT, modelBytes, parseRaw, nsToDate } from "./rpc.js";
import { decodeModel } from "./model.js";
import { Lanes, Clock, TreeExplorer, CostBars, Journey, Btn, LaurelIcon } from "./inner.jsx";
import { network } from "./wallet.js";
import { useView, Err, Loading, Cmd, CopyBtn, StatusPill, Countdown, fmtDate, shortHash, DotPlate, Forest, statusDetail, useModelBytes, mainnetData } from "./components.jsx";
import Connect from "./Connect.jsx";
import { WalletButton, AccountPanel, useWallet } from "./Account.jsx";
import Landing from "./Landing.jsx";
import { hasSavedSession } from "./wallet.js";

// Signed-out visitors opening the site root get the landing page; from there "Browse the exhibits without a wallet"
// opens the explorer read-only (guest mode, kept for the browser session). A deep link (#/task/3, #/model/4, #/costs,
// #/connect, #/tasks) opens its page directly as a guest, so a link from the README or CLAIMS needs no click and no
// wallet. A wallet is needed only to buy prediction credit or withdraw.
const GUEST_KEY = "laurel-guest";
const readGuest = () => { try { return sessionStorage.getItem(GUEST_KEY) === "1"; } catch { return false; } };
const saveGuest = () => { try { sessionStorage.setItem(GUEST_KEY, "1"); } catch {} };
const isDeepLink = (page) => page !== "tasks" || /^#\/tasks(\/|$)/.test(window.location.hash);

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
const Skel = () => <span className="sk" />;

/** One split as a bar, or the withheld band while the exhibit is open. */
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
  const champion = list.find((t) => t.closed && t.winner != null);
  const open = list.find((t) => !t.closed && mainnetData(t.slug)) || list.find((t) => !t.closed);
  const winner = useView("get_submission", { submission_id: champion?.winner }, [champion?.winner], { skip: champion?.winner == null });
  const earned = useView("get_earnings", { submission_id: champion?.winner }, [champion?.winner], { skip: champion?.winner == null });
  const recent = list.filter((t) => t.task_id > 2), earlier = list.filter((t) => t.task_id <= 2);
  const n = (v) => (v == null ? <Skel /> : <b>{v}</b>);
  return (
    <>
      <section className="block wrap x-head">
        <div>
          <h1>Models,<br />observed.</h1>
          <p className="x-lede">A registry on NEAR where small decision models are submitted as data, judged inside a TEE on a test set nobody can read, and the best one is served on-chain to agents and other contracts.</p>
        </div>
        <p className="x-sum">{n(cfg.data?.task_count)} exhibits, {n(cfg.data?.submission_count)} models judged in a TEE.{champion && <> The champion of exhibit {pad2(champion.task_id)} has served {n(winner.data?.calls)} predictions and earned its owner {n(earned.data ? yoctoToNear(earned.data, 3) : null)} NEAR, at <b>4.3</b> Tgas a call.</>}</p>
      </section>

      <section className="block wrap">
        <h2 className="x-sec">Exhibits</h2>
        {tasks.error && <Err error={tasks.error} reload={tasks.reload} />}
        {tasks.loading && <Loading />}
        <div className="x-board">{recent.map((t) => <ExhibitRow key={t.task_id} t={t} />)}</div>
        {earlier.length > 0 && <div className="x-earlier"><span>Earlier exhibits</span>{earlier.map((t) => <a key={t.task_id} href={`#/task/${t.task_id}`}>{pad2(t.task_id)} · {t.closed ? `closed, champion #${t.winner}` : "open"}</a>)}</div>}
        {tasks.data && tasks.data.length === 0 && <p className="x-mut">No tasks on this contract yet.</p>}
      </section>

      <section className="block wrap x-two">
        <div className="x-panel stack" style={{ gap: 16 }}>
          <h3>For model makers</h3>
          <p className="ink2">Train on the public split, submit the model as data, and get scored inside a TEE on rows nobody has seen. Win the exhibit and every prediction an agent or contract buys pays you the task's fee, withdrawable on-chain.</p>
          {open && <div><Btn href={`#/task/${open.task_id}`}>Enter exhibit {pad2(open.task_id)}</Btn></div>}
        </div>
        <div className="x-panel stack" style={{ gap: 16 }}>
          <h3>For agents and contracts</h3>
          <p className="ink2">Prepay credit with NEAR, hand your agent a key that can only spend it on predictions, and call the champion through MCP or from your own contract.{champion && <> A call costs {yoctoToNear(champion.fee_per_call, 4)} NEAR to the model's owner, plus about 0.0004 NEAR of gas.</>}</p>
          <div><Btn href="#/connect">Connect your agent</Btn></div>
        </div>
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
      <span>
        <h3>{plain(t.title)}</h3>
        <span className="meta">{mainnetData(t.slug) && <span className="tag">Real NEAR mainnet data · </span>}{t.n_features} features · {t.submission_count} {t.submission_count === 1 ? "entrant" : "entrants"} · {t.closed ? `closed ${day(t.deadline_ns)}` : "open"}</span>
      </span>
      <span className="lead">
        <span className="top"><span>{leadA ? `#${leadA.submission_id} ${t.closed ? "led" : "leads"} the public split` : lb.loading ? "reading…" : "no scored entry yet"}</span><b>{leadA ? pct(leadA.score_a_bps) : "—"}</b></span>
        <span className="x-track thin"><i className="x-fill" style={{ transform: `scaleX(${bar(leadA?.score_a_bps)})` }} /></span>
      </span>
      <span className="end">
        {t.closed
          ? (win ? <><span className="champ"><LaurelIcon />#{win.submission_id} · {pct(win.score_b_bps)}</span><span className="x-mut">champion on split B</span></> : <span className="x-mut">closed</span>)
          : <><span className="x-hatch"><em>Split B withheld</em></span><span className="x-mut"><Countdown ns={t.deadline_ns} /></span></>}
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
  const leadA = rows.filter((r) => r.score_a_bps != null).sort((a, b) => b.score_a_bps - a.score_a_bps)[0];
  // split B is passed only for a closed exhibit, whatever the views return
  const lanes = rows.map((r) => ({ id: r.submission_id, a: r.score_a_bps, b: task.closed ? r.score_b_bps : null, trees: r.trees, href: `#/model/${r.submission_id}` }));
  const real = mainnetData(task.slug);
  const about = task.description_url && !/^https:\/\/github\.com\/?$/.test(task.description_url) ? task.description_url : null;
  const st = task.closed ? "closed" : "open";
  return (
    <>
      <section className="block wrap x-head">
        <div>
          <span className={`x-num ${st}`} aria-hidden="true">{pad2(task.task_id)}</span>
          <h1 className="h2">{plain(task.title)}</h1>
          <p className="x-lede">
            {real ? "Built from real NEAR mainnet data. " : ""}{task.n_features} integer features per row, scored by balanced accuracy; {task.submission_count} {task.submission_count === 1 ? "entrant" : "entrants"}. Judged in OutLayer's TEE by the evaluator <span className="mono">{cfg.data ? shortHash(cfg.data.evaluator_hash) : "…"}</span> that the contract pins; the private rows never leave the enclave.{about && <> <a href={about} target="_blank" rel="noreferrer">About the data</a>.</>}
          </p>
        </div>
        <div className="stack" style={{ gap: 10 }}>
          {task.closed
            ? <p className="x-sum">Closed on {day(task.deadline_ns)}. {champ ? <>Champion <b>#{champ.submission_id}</b>, {pct(champ.score_b_bps)} % on split B.</> : "No entry was scored."}</p>
            : <><Clock ns={task.deadline_ns} /><p className="x-mut" style={{ margin: 0 }}>until the leaderboard shows split B and names the champion</p></>}
        </div>
      </section>

      <section className="block wrap">
        <h2 className="x-sec">Readings</h2>
        {lb.error && <Err error={lb.error} reload={lb.reload} />}
        {lb.loading ? <Loading /> : <Lanes rows={lanes} closed={task.closed} winner={task.winner} />}
        <p className="x-lede">{task.closed
          ? (champ && leadA && leadA.submission_id !== champ.submission_id
            ? <>The public split and the private one disagree: #{leadA.submission_id} led split A, #{champ.submission_id} won split B. Split B is the reading taken on rows no entrant has ever seen, so it decides.</>
            : <>Split B is the reading taken on rows no entrant has ever seen, so it decides.</>)
          : <>Split A is the public reading. Split B is scored at the same time, but the leaderboard withholds it until the deadline passes and someone calls <span className="mono">close_task</span>; the champion is the best split-B reading.</>}</p>
      </section>

      <section className="block wrap">
        <h2 className="x-sec">Specimens</h2>
        {rows.length === 0 && !lb.loading && <p className="x-mut">No entries yet.</p>}
        <div className="x-cards">
          {rows.map((r) => {
            const s = subs[r.submission_id]; const raw = parseRaw(s?.sub?.last_outlayer_raw);
            const isChamp = task.closed && r.submission_id === task.winner;
            const split = task.closed ? "b" : "a"; const counts = raw ? raw[split] : null;
            const scored = statusText(r.status) === "Scored";
            const cap = `Split ${split.toUpperCase()}, one dot per private test row`;
            return (
              <a key={r.submission_id} href={`#/model/${r.submission_id}`} className={`x-card ${isChamp ? "champ" : ""}`}>
                <div className="top"><b>#{r.submission_id}</b>{isChamp ? <span className="x-state closed">champion</span> : <StatusPill status={r.status} />}</div>
                <span className="who">{r.owner} · {r.trees} trees · {r.bytes.toLocaleString("en-US")} bytes</span>
                <Forest bytes={s === undefined ? null : s.bytes} trees={r.trees} limit={10} cols={10} cell={60} accent={isChamp} featureNames={task.feature_names} onRetry={() => setRetryN((x) => x + 1)} />
                {scored
                  ? (s === undefined ? <DotPlate counts={null} caption={cap} ghostText="reading the evaluator record…" />
                    : s.sub === null ? <DotPlate counts={null} caption={cap} ghostText="could not read the evaluator output" onRetry={() => setRetryN((x) => x + 1)} />
                    : <DotPlate counts={counts} caption={cap} />)
                  : <p className="x-mut">{statusText(r.status) === "Failed" ? `failed: ${statusDetail(r.status)}` : statusText(r.status) === "Pending" ? "in the TEE…" : "not scored yet"}</p>}
              </a>
            );
          })}
        </div>
      </section>

      {task.closed && champ && (
        <section className="block wrap x-two" style={{ alignItems: "end" }}>
          <div>
            <h2 className="x-sec">In service</h2>
            <p className="x-sum">#{champ.submission_id} has served <b>{champ.calls}</b> predictions and earned its owner <b>{earnings.data ? yoctoToNear(earnings.data, 3) : "…"}</b> NEAR.</p>
          </div>
          <div className="stack" style={{ gap: 12 }}>
            <p className="ink2">Agents call it with a function-call key, contracts through a promise; about 4.3 Tgas a call, and {yoctoToNear(task.fee_per_call, 4)} NEAR to the owner.</p>
            <Cmd>{`predict_task(${task.task_id}, features)   →   #${champ.submission_id}`}</Cmd>
          </div>
        </section>
      )}

      <section className="block wrap">
        <h2 className="x-sec">Enter this exhibit</h2>
        <div className="x-two">
          <div className="x-panel stack" style={{ gap: 18 }}>
            <h3>What a model sees</h3>
            <div className="x-chips">{task.feature_names.map((f) => <span key={f}>{f}</span>)}</div>
            <dl className="x-terms">
              <div><dt>Entry</dt><dd>{yoctoToNear(task.submission_fee, 2)} NEAR plus model storage, {task.max_per_account} entries per account</dd></div>
              <div><dt>Fee per call</dt><dd>{yoctoToNear(task.fee_per_call, 4)} NEAR from prepaid credit, to the model's owner</dd></div>
              <div><dt>Limits</dt><dd>up to {cfg.data ? (cfg.data.max_model_bytes / 1024).toFixed(0) : "…"} KB and {cfg.data?.max_trees ?? "…"} trees, child indices strictly increasing</dd></div>
              <div><dt>Private rows</dt><dd><span className="mono">{task.secrets_account} / {task.secrets_profile}</span></dd></div>
              <div><dt>Creator</dt><dd><a href={EXPLORER_ACCOUNT(task.creator)} target="_blank" rel="noreferrer">{task.creator}</a></dd></div>
            </dl>
          </div>
          <div className="x-panel stack" style={{ gap: 14 }}>
            <h3>Train, export, submit</h3>
            <p className="x-mut">Scripts in the repo; no browser wallet needed.</p>
            <Cmd>{`python tasks/${ds}/train.py --trees 50 --depth 4
python tools/export.py --task ${ds} --model tasks/${ds}/model_baseline.pkl --out tasks/${ds}/out/mine
node tools/submit.mjs ${task.task_id} tasks/${ds}/out/mine/model.bin --as TEAM      # contract: ${contractId()}`}</Cmd>
            <details><summary>Create a task like this one</summary>
              <Cmd>{`python tasks/${ds}/split.py                                   # public data + private splits + sha256 manifest
bash tools/secrets.sh ${ds} ${task.secrets_profile} <evaluator hash>   # (WSL) store the private test set, bound to the evaluator hash
node tools/create_task.mjs ${ds} --slug-override ${task.slug} --minutes 1440 --as TEAM`}</Cmd>
            </details>
            {task.closed && <details><summary>Call the champion from an agent</summary>
              <Cmd>{`node tools/predict.mjs ${task.task_id} --row 0 --as AGENT --deposit 0.02     # prepay once; later calls only use the function-call key
node tools/agent.mjs ${task.task_id} --rows 10                                 # 10 rows + proof that the restricted key is rejected by the protocol`}</Cmd>
            </details>}
          </div>
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
  const sealedLine = task ? `withheld from the leaderboard until ${fmtDate(task.deadline_ns)}` : "withheld until the exhibit closes";
  const reached = st === "Scored" ? 3 : st === "Pending" || st === "Failed" ? 2 : 1;
  const nf = task?.n_features ?? model?.n_features ?? 18;
  return (
    <>
      <section className="block wrap x-head">
        <div>
          <h1 className="h2">Specimen <span className={isChamp ? "x-blue" : ""}>#{sub.submission_id}</span></h1>
          <p className="x-lede">A {sub.trees}-tree model by <a href={EXPLORER_ACCOUNT(sub.owner)} target="_blank" rel="noreferrer">{sub.owner}</a>, {sub.bytes.toLocaleString("en-US")} bytes stored by the contract, entered in <a href={`#/task/${sub.task_id}`}>exhibit {pad2(sub.task_id)}</a>{task ? `, ${plain(task.title)}` : ""}, on {day(sub.submitted_at_ns)}.{isChamp && <> It is the champion and answers <span className="mono">predict_task({sub.task_id}, …)</span>.</>}</p>
        </div>
        <div className="stack" style={{ gap: 18 }}>
          <Reading name="Split A, public" bps={sub.score_a_bps} />
          <Reading name="Split B, decides" bps={bVisible ? sub.score_b_bps : null} blue={isChamp} withheld={bVisible ? null : sealedLine} />
        </div>
      </section>

      <section className="block wrap" style={{ paddingTop: 0 }}>
        <div className="x-steps">
          {["uploaded", "in the TEE", "scored"].map((step, i) => (
            <React.Fragment key={step}>
              {i > 0 && <span className="sep" aria-hidden="true" />}
              <span className={`${i < reached ? "on" : ""} ${st === "Failed" && i === 1 ? "bad" : ""}`}><i />{st === "Failed" && i === 1 ? "failed" : step}</span>
            </React.Fragment>
          ))}
          <span className="x-mut">{raw ? `block ${raw.block}, evaluator ` : st === "Failed" ? statusDetail(sub.status) : "no evaluator output yet"}{raw && sub.scored_by && <><span className="mono">{shortHash(sub.scored_by)}</span>{cfg.data && (sub.scored_by === cfg.data.evaluator_hash ? ", the pinned one" : ", not the pinned one")}</>}</span>
        </div>
      </section>

      <section className="block wrap">
        <h2 className="x-sec">Walk through the model</h2>
        {model ? <TreeExplorer model={model} featureNames={task?.feature_names || []} accent={isChamp} />
          : bytes === undefined ? <Err error="model bytes unavailable" plain reload={retry} />
          : bytes ? <Err error="could not decode the model" plain /> : <Loading what="reading the model bytes" />}
      </section>

      <section className="block wrap">
        <h2 className="x-sec">Every private row it was judged on</h2>
        <div className="x-two">
          <DotPlate counts={raw?.a} caption="Split A, one dot per private test row" />
          <DotPlate counts={bVisible ? raw?.b : null} caption="Split B, one dot per private test row" ghost={raw?.a?.n || 150} ghostText={bVisible ? undefined : sealedLine} />
        </div>
      </section>

      <section className="block wrap x-two">
        <div className="x-panel stack" style={{ gap: 14 }}>
          <h3>Provenance</h3>
          <dl className="x-terms">
            <div><dt>Model sha256</dt><dd className="mono">{sub.model_hash}<CopyBtn text={sub.model_hash} label="copy model hash" /></dd></div>
            <div><dt>Evaluator sha256</dt><dd className="mono">{cfg.data?.evaluator_hash ?? "…"}{cfg.data && <CopyBtn text={cfg.data.evaluator_hash} label="copy evaluator hash" />}</dd></div>
            <div><dt>Evaluator wasm</dt><dd><a href={cfg.data?.evaluator_url} target="_blank" rel="noreferrer">{cfg.data ? cfg.data.evaluator_url.replace(/^https?:\/\//, "").slice(0, 48) + "…" : "…"}</a></dd></div>
            <div><dt>Scored by</dt><dd>{cfg.data ? `${cfg.data.outlayer} (TEE worker)` : "…"}</dd></div>
            <div><dt>Calls, earnings</dt><dd>{sub.calls} calls, {e.data ? yoctoToNear(e.data, 3) : "…"} NEAR (the owner withdraws with <span className="mono">withdraw_earnings</span>)</dd></div>
          </dl>
          <details><summary>Raw evaluator output stored on-chain{!bVisible && raw ? ", split B withheld until close" : ""}</summary><pre>{rawShown ? JSON.stringify(rawShown, null, 2) : (sub.last_outlayer_raw || "not scored yet")}</pre></details>
        </div>
        <div className="x-panel stack" style={{ gap: 14 }}>
          <h3>Call it</h3>
          <p className="ink2">A metered change method: the fee comes from the caller's prepaid credit. Features are {nf} integers in the task's feature order; a raw score above 0 means the positive class. Replace the zeros with your row.</p>
          <Cmd>{`node tools/predict.mjs ${sub.task_id} --submission ${sub.submission_id} --row 0 --as AGENT`}</Cmd>
          <Cmd>{`near contract call-function as-transaction ${contractId()} predict json-args '{"submission_id":${sub.submission_id},"features":[${Array(nf).fill(0).join(",")}]}' prepaid-gas '30 Tgas' attached-deposit '0 NEAR' sign-as <agent> network-config testnet`}</Cmd>
        </div>
      </section>
    </>
  );
}

// ---------- Method / costs ----------
const COSTS = [
  ["predict_task from an agent", "function-call key, German Credit 50 trees, 33 KB", 4.31, "4.31 Tgas", "8tTi9dbVnZfwMZkmqgMVG1FfXyihUs8MssCXraNELFMS"],
  ["predict, a large model", "synthetic 100 trees × depth 6, 197 KB", 13.2, "13.20 Tgas", "F8Az4MKFdqRYHRw6Pq4RZDrSUs7RJ4nuZZ9qv46Tuqd8"],
  ["submit_model", "validation and storage, 33 KB", 10.2, "10.20 Tgas", "14BSwbzAViKnu7esMQTf9bN1L3vQiywjMQGqAEX5Tcmv"],
  ["request_score → TEE → callback", "33 KB, 2 × 150 private rows, about 10 s", 12.5, "12.5 Tgas", "593SvaUAZLXjrQ2f5XkCnpKTnW8EkYT7h1o1Xmski3oq"],
  ["close_task", "picks the champion on split B", 2.23, "2.23 Tgas", "2VLWMbGvyKTJgtekf5Bd4q1F73oSyFpbsM61LAum2cZP"],
  ["contract → predict_task → callback", "another contract pays from its own credit", 8.85, "8.85 Tgas", "BNR63PPUcD6RgjQyN8nQ1i2iP9uJQfGPcLrozsHAcGz6"],
];

function Costs() {
  useTitle("Method");
  return (
    <>
      <section className="block wrap x-head">
        <div>
          <h1 className="h2">How a model becomes infrastructure.</h1>
          <p className="x-lede">From a few kilobytes of integers to a contract method that agents pay to call. Every cost below was measured on NEAR testnet on 2–4 Nov 2026 and links to its transaction; 1 Tgas is about 0.0001 NEAR at the base gas price.</p>
        </div>
      </section>
      <section className="block wrap">
        <h2 className="x-sec">The path of a model</h2>
        <Journey />
      </section>
      <section className="block wrap">
        <h2 className="x-sec">What each step costs</h2>
        <CostBars rows={COSTS} />
        <p className="x-lede">From a fresh account, the whole journey, 23 steps with 17 misuse attempts rejected, took 232 seconds (<a href={`${REPO}/blob/main/docs/E2E.md`} target="_blank" rel="noreferrer">docs/E2E.md</a>).</p>
      </section>
      <section className="block wrap">
        <h2 className="x-sec">Guaranteed, and not</h2>
        <div className="x-two">
          <div className="x-panel blue">
            <h3>Guaranteed</h3>
            <ul className="x-guar">
              <li>The contract fixes the scoring evaluator by its hash; participants cannot choose it. The private rows open only for that hash: any other build gets <span className="mono">TEST_SET_A missing</span> (tested 2 Nov).</li>
              <li>The model runs inside NEAR consensus: <span className="mono">predict</span> gives the same result as the evaluator and as Python, vector by vector.</li>
              <li>An agent's function-call key can only call <span className="mono">predict_task</span> and <span className="mono">predict</span>; the protocol rejects withdrawals, deposits, other contracts and transfers from it (<a href={`${REPO}/blob/main/docs/AGENT.md`} target="_blank" rel="noreferrer">docs/AGENT.md</a>).</li>
            </ul>
          </div>
          <div className="x-panel orange">
            <h3>Not guaranteed</h3>
            <ul className="x-guar not">
              <li>Sybil resistance: only a 3-per-account quota and the submission fee.</li>
              <li>Secrecy of split-B scores while a task is open: they are readable through the <span className="mono">get_submission</span> / <span className="mono">list_submissions</span> views and the OutLayer receipt of every <span className="mono">request_score</span> transaction. The leaderboard withholds them, and so do this site and the MCP tools; what stays sealed are the rows.</li>
              <li>Secrecy of a dataset that is public anyway: both datasets are public, so the private split keeps the test rows out of training, not the original data out of reach.</li>
            </ul>
          </div>
        </div>
        <p className="x-lede">Two datasets. UCI German Credit (1994, Germany) is used as a simulation; this is not a tool for scoring real people's credit. NEAR mainnet account retention (exhibit 05) is real on-chain data: fresh <span className="mono">.near</span> accounts' first seven days, from the public BigQuery dataset (<a href={`${REPO}/blob/main/tasks/near-retention/README.md`} target="_blank" rel="noreferrer">tasks/near-retention</a>).</p>
      </section>
    </>
  );
}

export default function App() {
  const route = useRoute();
  const { page, id } = route;
  const w = useWallet();
  const [guestChosen, setGuestChosen] = useState(readGuest);
  const guest = guestChosen || isDeepLink(page);
  useEffect(() => { if (guest && !guestChosen) { saveGuest(); setGuestChosen(true); } }, [guest, guestChosen]);
  const enterAsGuest = () => { saveGuest(); setGuestChosen(true); window.scrollTo(0, 0); };
  if (!w.accountId && !guest) {
    if (hasSavedSession() && !w.ready && !w.error) {
      return <main id="main" tabIndex={-1} className="restoring wrap"><span className="brand-word">LAUREL</span><p className="mist mono">restoring your wallet session…</p></main>;
    }
    return <Landing onGuest={enterAsGuest} />;
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
