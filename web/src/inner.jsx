// Objects for the inner pages, in the landing's language: one object per page that explains it.
// Lanes = the exhibit race, TreeExplorer = a model you can walk through, CostBars and Journey for the method.
// Every value comes from the contract or from a measured transaction; nothing here is sample data.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { LEAF, treeDepth } from "./model.js";
import { nsToDate, EXPLORER_TX } from "./rpc.js";

const reducedMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const pct = (bps) => (bps / 100).toFixed(2);

/** true once the element has been on screen. */
export function useSeen(ref, threshold = 0.3) {
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el || seen) return;
    if (typeof IntersectionObserver !== "function") { setSeen(true); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setSeen(true); io.disconnect(); } }, { threshold });
    io.observe(el); return () => io.disconnect();
  }, [seen]); // eslint-disable-line
  return seen;
}

export const LaurelIcon = () => (
  <svg viewBox="0 0 40 34" aria-hidden="true"><g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
    {Array.from({ length: 5 }, (_, i) => { const a = 2.3 + i * 0.36, x = 20 + Math.cos(a) * 15, y = 18 - Math.sin(a) * 15; return <React.Fragment key={i}><path d={`M${x.toFixed(1)} ${(36 - y).toFixed(1)}l-3 -5`} /><path d={`M${(40 - x).toFixed(1)} ${(36 - y).toFixed(1)}l3 -5`} /></React.Fragment>; })}
    <path d="M20 30C8 29 4 20 6 9" /><path d="M20 30c12-1 16-10 14-21" /></g></svg>
);

/** Days, hours, minutes, seconds until `ns`, ticking each second. */
export function Clock({ ns }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const s = Math.max(0, Math.floor((nsToDate(ns) - now) / 1000));
  const parts = [[Math.floor(s / 86400), "d"], [Math.floor(s / 3600) % 24, "h"], [Math.floor(s / 60) % 60, "m"], [s % 60, "s"]];
  return <div className="x-clock" role="timer" aria-label={`${parts[0][0]} days ${parts[1][0]} hours ${parts[2][0]} minutes left`}>{parts.map(([v, l]) => <span key={l}>{String(v).padStart(2, "0")}<small>{l}</small></span>)}</div>;
}

/** A glass button: blue rises from below on hover, the arrow steps out. */
export const Btn = ({ href, onClick, children, solid = false, ext = false, disabled }) => {
  const cls = `x-btn ${solid ? "solid" : ""}`;
  const inner = <><span>{children}</span><i aria-hidden="true">↗</i></>;
  return href ? <a className={cls} href={href} target={ext ? "_blank" : undefined} rel={ext ? "noreferrer" : undefined}>{inner}</a>
    : <button className={cls} onClick={onClick} disabled={disabled}>{inner}</button>;
};

/** The exhibit as a race. rows: [{id, a, b, trees, href}] (b null while open).
 *  Open: split A runs, split B is a withheld band. Closed: split A runs, the seal passes, everyone settles on split B, the laurel moves. */
export function Lanes({ rows, closed, winner }) {
  const ref = useRef(null);
  const seen = useSeen(ref);
  const list = rows.filter((r) => r.a != null).slice().sort((x, y) => y.a - x.a || x.id - y.id);
  const vals = list.flatMap((r) => (closed && r.b != null ? [r.a, r.b] : [r.a]));
  const lo = Math.max(5000, Math.floor((Math.min(...vals, 10000) - 600) / 500) * 500);
  const hi = Math.min(10000, Math.max(lo + 1500, Math.ceil((Math.max(...vals, 0) + 300) / 500) * 500));
  const X = (v) => Math.max(0, Math.min(1, (v - lo) / (hi - lo)));
  // stage: idle → a (public run) → seal (band passes) → b (final). Open exhibits stop at a.
  const [stage, setStage] = useState("idle");
  const [run, setRun] = useState(0);
  useEffect(() => {
    if (!seen || !list.length) return;
    if (reducedMotion()) { setStage(closed ? "b" : "a"); return; }
    setStage("idle");
    const t = [setTimeout(() => setStage("a"), 80)];
    if (closed) { t.push(setTimeout(() => setStage("seal"), 2300)); t.push(setTimeout(() => setStage("b"), 3300)); }
    return () => t.forEach(clearTimeout);
  }, [seen, run, closed, list.length]); // eslint-disable-line
  const final = closed && stage === "b";
  const leadA = list[0];
  const win = list.find((r) => r.id === winner);
  const title = !closed ? "Public split" : final ? "Split B, revealed at close" : stage === "seal" ? "Split B" : "Public split";
  const note = final && leadA && win
    ? (leadA.id === win.id ? `#${win.id} led the public split and kept the laurel.` : `#${leadA.id} fell ${pct(leadA.a - leadA.b)} points. #${win.id} fell ${pct(win.a - win.b)} and took the laurel.`)
    : !closed ? "balanced accuracy on the public split, judged in the TEE" : "";
  if (!list.length) return <div className="x-race" ref={ref}><p className="x-mut">No entry has been scored yet.</p></div>;
  return (
    <div className={`x-race ${closed ? "closed" : "open"} st-${stage}`} ref={ref}>
      <div className="x-race-state"><span aria-live="polite">{title}</span><span className="x-mut">{note}</span></div>
      <div className="x-lanes" role="list">
        {list.map((r) => {
          const v = final && r.b != null ? r.b : r.a;
          const lit = final ? r.id === winner : r.id === leadA.id && stage !== "idle";
          const fell = final && r.id !== winner;
          const label = `#${r.id}: split A ${pct(r.a)} %${closed && r.b != null ? `, split B ${pct(r.b)} %` : ", split B withheld"}${closed && r.id === winner ? ", champion" : ""}`;
          return (
            <a key={r.id} href={r.href} className={`x-lane ${lit ? "lit" : ""} ${fell ? "fell" : ""}`} role="listitem" aria-label={label}>
              <span className="who"><b>#{r.id}</b><span>{r.trees} trees</span></span>
              <span className="x-track">
                <i className="x-fill" style={{ transform: `scaleX(${stage === "idle" ? 0 : X(v)})` }} />
                {(closed ? r.id === (final ? winner : leadA.id) : r.id === leadA.id) && stage !== "idle" && <span className="x-crown" style={{ left: `${X(v) * 100}%` }}><LaurelIcon /></span>}
              </span>
              <b className="val">{stage === "idle" ? "—" : pct(v)}</b>
              {!closed && <span className="x-hatch"><em>Withheld</em></span>}
            </a>
          );
        })}
      </div>
      {closed && <i className="x-seal" aria-hidden="true"><em>Sealed rows</em></i>}
      <div className="x-race-foot">
        <span className="x-mut">{lo / 100} %</span>
        {closed && (stage === "b" || reducedMotion()) && !reducedMotion() && <button className="x-link" onClick={() => setRun((n) => n + 1)}>Run it again</button>}
        <span className="x-mut">{hi / 100} %</span>
      </div>
    </div>
  );
}

// ---------- a tree you can walk ----------

/** Layout keeping node indices: nodes {i, x, y, leaf, feature, threshold, value, parent, side}. */
function layoutTree(tree) {
  const depth = Math.max(1, treeDepth(tree));
  const out = [];
  let cursor = 0;
  const leaves = (i) => { const n = tree.nodes[i]; return !n || n.left === LEAF ? 1 : leaves(n.left) + leaves(n.right); };
  const total = leaves(0);
  const place = (i, level, parent, side) => {
    const n = tree.nodes[i]; if (!n) return 0.5;
    const node = { i, y: level / depth, parent, side, leaf: n.left === LEAF, feature: n.feature, threshold: n.threshold, value: n.value };
    if (node.leaf) { node.x = (cursor + 0.5) / total; cursor += 1; }
    else { const xl = place(n.left, level + 1, i, "le"); const xr = place(n.right, level + 1, i, "gt"); node.x = (xl + xr) / 2; }
    out.push(node); return node.x;
  };
  place(0, 0, null, null);
  const byI = new Map(out.map((n) => [n.i, n]));
  return { nodes: out, byI, depth };
}

const pathTo = (L, i) => { const p = []; let n = L.byI.get(i); while (n) { p.unshift(n); n = n.parent == null ? null : L.byI.get(n.parent); } return p; };

/** All trees as a strip to pick from, and the picked tree large: hover or focus a leaf to read its rule; when idle, a call walks from root to a leaf. */
export function TreeExplorer({ model, featureNames = [], accent = false }) {
  const [t, setT] = useState(0);
  const [pick, setPick] = useState(null);      // leaf index chosen by the visitor
  const [walk, setWalk] = useState(null);      // leaf index the idle walk is heading to
  const [step, setStep] = useState(0);
  const ref = useRef(null);
  const seen = useSeen(ref, 0.2);
  const tree = model.trees[t];
  const L = useMemo(() => layoutTree(tree), [tree]);
  const leaves = L.nodes.filter((n) => n.leaf).sort((a, b) => a.x - b.x);
  const target = pick ?? walk;
  const path = target != null ? pathTo(L, target) : [];
  const fname = (f) => featureNames[f] ?? `f${f}`;
  const scale = model.out_scale || 1;
  const leafText = (v) => `${v >= 0 ? "+" : "−"}${Math.abs(v / scale).toFixed(3)}`;
  // idle walk: a new leaf every 3.2 s, edges light one by one
  useEffect(() => {
    if (!seen || pick != null || reducedMotion()) return;
    let k = 0;
    const go = () => { const lf = leaves[Math.floor(Math.random() * leaves.length)]; setWalk(lf.i); setStep(0); k = 0; };
    go();
    const tick = setInterval(() => { k += 1; setStep(k); if (k > L.depth + 4) go(); }, 420);
    return () => clearInterval(tick);
  }, [seen, pick, t]); // eslint-disable-line
  const shown = pick != null || reducedMotion() ? path.length : Math.min(path.length, step + 1);
  const on = new Set(path.slice(0, shown).map((n) => n.i));
  const W = 1000, H = 120 + Math.max(3, L.depth) * 120, px = (u) => 40 + u * (W - 80), py = (v) => 40 + v * (H - 120);
  const head = path[shown - 1];
  const rule = path.slice(0, -1).map((n, k) => `${fname(n.feature)} ${path[k + 1].side === "le" ? "≤" : ">"} ${n.threshold}`);
  const leaf = path.length && path[path.length - 1].leaf && shown === path.length ? path[path.length - 1] : null;
  const onLeafKey = (e, idx) => {
    const m = { ArrowRight: idx + 1, ArrowLeft: idx - 1, Home: 0, End: leaves.length - 1 };
    if (e.key in m) { e.preventDefault(); const j = Math.max(0, Math.min(leaves.length - 1, m[e.key])); setPick(leaves[j].i); ref.current?.querySelector(`[data-leaf="${leaves[j].i}"]`)?.focus(); }
    if (e.key === "Escape") setPick(null);
  };
  return (
    <div className="x-explore" ref={ref}>
      <div className="x-strip" role="tablist" aria-label={`${model.trees.length} trees; pick one to open it`}>
        {model.trees.map((tr, k) => <TreeChip key={k} tree={tr} on={k === t} accent={accent} onPick={() => { setT(k); setPick(null); }} idx={k} />)}
      </div>
      <div className="x-tree-wrap">
        <svg viewBox={`0 0 ${W} ${H}`} className="x-tree" role="group" aria-label={`tree ${t + 1} of ${model.trees.length}: ${leaves.length} leaves, depth ${L.depth}. Use the arrow keys on a leaf to move between leaves.`} onMouseLeave={() => setPick(null)}>
          {L.nodes.filter((n) => n.parent != null).map((n) => {
            const p = L.byI.get(n.parent);
            return <line key={`e${n.i}`} x1={px(p.x)} y1={py(p.y)} x2={px(n.x)} y2={py(n.y)} className={on.has(n.i) && on.has(p.i) ? "on" : ""} />;
          })}
          {L.nodes.map((n) => n.leaf
            ? <g key={n.i} data-leaf={n.i} className={`leaf ${n.value >= 0 ? "pos" : "neg"} ${on.has(n.i) ? "on" : ""}`} tabIndex={n.i === (leaves[0]?.i) ? 0 : -1} role="button"
                 aria-label={`leaf ${leafText(n.value)}: ${pathTo(L, n.i).slice(0, -1).map((m, k, arr) => `${fname(m.feature)} ${(arr[k + 1] || n).side === "le" ? "at most" : "above"} ${m.threshold}`).join(", ")}`}
                 onMouseEnter={() => setPick(n.i)} onFocus={() => setPick(n.i)} onClick={() => setPick(n.i)} onKeyDown={(e) => onLeafKey(e, leaves.findIndex((l) => l.i === n.i))}>
                <rect x={px(n.x) - 22} y={py(n.y) - 22} width={44} height={60} fill="transparent" />
                <circle cx={px(n.x)} cy={py(n.y)} r={on.has(n.i) ? 9 : 6} />
              </g>
            : <circle key={n.i} cx={px(n.x)} cy={py(n.y)} r={n.i === 0 ? 8 : 5} className={`split ${on.has(n.i) ? "on" : ""} ${n.i === 0 && accent ? "root-accent" : ""}`} />)}
          {path.slice(0, shown).filter((n) => !n.leaf).map((n, k) => {
            const next = path[k + 1];
            const anchor = n.x < 0.2 ? "start" : n.x > 0.8 ? "end" : "middle";
            return <text key={`t${n.i}`} x={px(n.x)} y={py(n.y) - 16} textAnchor={anchor} className="lbl">{fname(n.feature)} {next ? (next.side === "le" ? "≤" : ">") : "≤"} {n.threshold}</text>;
          })}
          {leaf && <text x={px(leaf.x)} y={py(leaf.y) + 40} textAnchor={leaf.x < 0.15 ? "start" : leaf.x > 0.85 ? "end" : "middle"} className={`lbl val ${leaf.value >= 0 ? "pos" : "neg"}`}>{leafText(leaf.value)}</text>}
          {head && pick == null && <circle cx={px(head.x)} cy={py(head.y)} r={11} className="walker" />}
        </svg>
      </div>
      <p className="x-rule" aria-live="polite">
        {leaf
          ? <>Tree {t + 1}: {rule.length ? rule.join(", then ") : "a single leaf"} → adds <b className={leaf.value >= 0 ? "pos" : "neg"}>{leafText(leaf.value)}</b> to the score{leaf.value >= 0 ? " (toward the positive class)" : ""}.</>
          : <>Tree {t + 1} of {model.trees.length}: {leaves.length} leaves, depth {L.depth}. A call starts at the top and goes left when the feature is at most the threshold. Point at a leaf to read its rule.</>}
      </p>
    </div>
  );
}

function TreeChip({ tree, on, accent, onPick, idx }) {
  const L = useMemo(() => layoutTree(tree), [tree]);
  return (
    <button role="tab" aria-selected={on} className={`x-chip ${on ? "on" : ""} ${accent ? "accent" : ""}`} onClick={onPick} title={`tree ${idx + 1}`} aria-label={`tree ${idx + 1}`}>
      <svg viewBox="0 0 100 70" aria-hidden="true">
        {L.nodes.filter((n) => n.parent != null).map((n) => { const p = L.byI.get(n.parent); return <line key={n.i} x1={8 + p.x * 84} y1={8 + p.y * 54} x2={8 + n.x * 84} y2={8 + n.y * 54} />; })}
      </svg>
    </button>
  );
}

// ---------- method ----------

/** Measured gas per operation, as bars; every bar links to its transaction. rows: [op, model, tgas, label, tx|href] */
export function CostBars({ rows }) {
  const max = Math.max(...rows.map((r) => r[2] || 0));
  return (
    <ol className="x-costs">
      {rows.map(([op, what, tg, label, proof]) => (
        <li key={op}>
          <span className="op"><b>{op}</b><span className="x-mut">{what}</span></span>
          <span className="x-track thin"><i className="x-fill" style={{ transform: `scaleX(${tg ? tg / max : 0})` }} /></span>
          <span className="tg">{label}</span>
          <a className="mono proof" href={proof.startsWith("http") ? proof : EXPLORER_TX(proof)} target="_blank" rel="noreferrer">{proof.startsWith("http") ? "docs/E2E.md" : `${proof.slice(0, 6)}…`}</a>
        </li>
      ))}
    </ol>
  );
}

const STATIONS = [
  ["Submit as data", "A few kilobytes of integers, stored by the contract. No server."],
  ["Validated", "Size, tree count, child order and feature range are checked on-chain."],
  ["request_score", "The contract asks OutLayer to run the evaluator whose hash it pinned."],
  ["Judged in the TEE", "The evaluator reads the model through RPC and scores both private splits inside the enclave."],
  ["A public, B withheld", "Split A shows on the leaderboard at once; split B is withheld until close."],
  ["Close", "After the deadline anyone calls close_task; the best split B becomes the champion."],
  ["predict_task", "Agents and contracts call the champion and pay its owner per call."],
];

/** The path a model travels, with a light that keeps moving along it. */
export function Journey() {
  return (
    <ol className="x-journey">
      {STATIONS.map(([h, p], i) => (
        <li key={h} className={i === 3 ? "tee" : i === 4 ? "withheld" : i === 6 ? "last" : ""} style={{ "--i": i }}>
          <span className="dot" aria-hidden="true" />
          <b>{h}</b>
          <span className="x-mut">{p}</span>
        </li>
      ))}
    </ol>
  );
}
