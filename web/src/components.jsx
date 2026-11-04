import React, { useEffect, useMemo, useRef, useState } from "react";
import { view, nsToDate, bps, statusText, statusDetail } from "./rpc.js";
import { decodeModel, treeLayout, maxLeaf, LEAF } from "./model.js";

const reducedMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** One RPC view call with loading / error / retry. Skipped (stays loading) while a required id is null. */
export function useView(method, args, deps, { skip = false } = {}) {
  const [state, set] = useState({ loading: true });
  const [n, setN] = useState(0);
  useEffect(() => {
    if (skip) { set({ loading: true }); return; }
    let alive = true;
    set({ loading: true });
    view(method, args).then((data) => alive && set({ data })).catch((e) => alive && set({ error: String(e.message || e) }));
    return () => { alive = false; };
  }, [...deps, n, skip]); // eslint-disable-line
  return { ...state, reload: () => setN((x) => x + 1) };
}

export const Err = ({ error, reload }) => (
  <p className="err" style={{ fontSize: 13 }}>RPC error: {error}{reload && <button className="retry" onClick={reload}>retry</button>}</p>
);
export const Loading = ({ what = "reading the contract" }) => <p className="mist mono">{what}…</p>;

export function Cmd({ children }) {
  const [ok, setOk] = useState(false);
  return (
    <div className="cmd">
      <button onClick={() => { navigator.clipboard?.writeText(children); setOk(true); setTimeout(() => setOk(false), 1200); }}>{ok ? "copied" : "copy"}</button>
      <pre>{children}</pre>
    </div>
  );
}

export function CopyBtn({ text, label }) {
  const [ok, setOk] = useState(false);
  return (
    <button className="copy" aria-label={label || "copy"} title={ok ? "copied" : "copy"} onClick={() => { navigator.clipboard?.writeText(text); setOk(true); setTimeout(() => setOk(false), 1200); }}>
      {ok ? <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2 6.5l2.5 2.5L10 3.5" fill="none" stroke="currentColor" strokeWidth="1.5"/></svg>
          : <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><rect x="3.5" y="3.5" width="7" height="7" fill="none" stroke="currentColor" strokeWidth="1.2"/><path d="M1.5 8.5v-7h7" fill="none" stroke="currentColor" strokeWidth="1.2"/></svg>}
    </button>
  );
}

export const Pill = ({ kind, children }) => <span className={`pill ${kind || ""}`}>{children}</span>;
export function StatusPill({ status }) {
  const t = statusText(status);
  const kind = t === "Scored" ? "scored" : t === "Pending" ? "pending" : t === "Failed" ? "failed" : "uploaded";
  return <Pill kind={kind}>{t === "Scored" ? "scored in TEE" : t === "Pending" ? "in the TEE" : t.toLowerCase()}</Pill>;
}
/** Numbered section label (an h2 for structure, styled as the mono eyebrow). */
export const Sec = ({ n, title }) => <h2 className="sec">{n} — {title}</h2>;
export const Fig = ({ v, unit, l }) => (
  <div className="fig"><span className="v">{v}{unit && <small> {unit}</small>}</span><span className="l">{l}</span></div>
);

export function Countdown({ ns, closed }) {
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((x) => x + 1), 60000); return () => clearInterval(t); }, []);
  const d = nsToDate(ns); const ms = d - Date.now();
  if (closed || ms <= 0) return <span>passed · {d.toLocaleString()}</span>;
  const dd = Math.floor(ms / 864e5), h = Math.floor((ms % 864e5) / 3.6e6), m = Math.floor((ms % 3.6e6) / 6e4);
  return <span>{dd > 0 ? `${dd}d ${h}h` : `${h}h ${m}m`} left · {d.toLocaleString()}</span>;
}

export const fmtDate = (ns) => nsToDate(ns).toISOString().replace("T", " ").slice(0, 16) + " UTC";
export const shortHash = (s, n = 8) => (s && s.length > 2 * n + 1 ? `${s.slice(0, n)}…${s.slice(-4)}` : s);
/** On-chain titles may carry a leading "[tag]"; the pill carries the state, so render the tag muted. */
export function Title({ text }) {
  const m = /^\[(\w+)\]\s*(.*)$/.exec(text || "");
  return m ? <><span className="mono mist" style={{ fontWeight: 400, letterSpacing: 0 }}>[{m[1]}] </span>{m[2]}</> : <>{text}</>;
}

export const pos = (v) => Math.max(0, Math.min(1, (v / 100 - 50) / 50)) * 100;

/** Instrument scale 50–100 %: one needle per entry {id, bps, href, accent, muted, label}.
 *  `sealed` = band text while hidden; `reveal` = closed task: show the band for a beat, then lift it and raise the needles. */
export function Scale({ variant = "a", title, note, entries = [], sealed = null, reveal = false }) {
  const trackRef = useRef(null);
  const [width, setWidth] = useState(900);
  const [lifted, setLifted] = useState(!reveal || reducedMotion());
  const [armed, setArmed] = useState(reducedMotion());
  useEffect(() => {
    const el = trackRef.current; if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth || 900)); ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    if (reducedMotion()) return;
    const t1 = setTimeout(() => setLifted(true), reveal ? 450 : 0);
    const t2 = setTimeout(() => setArmed(true), reveal ? 520 : 60);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [reveal]);
  const ticks = []; for (let v = 50; v <= 100; v += 5) ticks.push(v);
  const sorted = entries.filter((e) => e.bps != null).slice().sort((a, b) => a.bps - b.bps);
  const minPx = 92; // widest label plus air
  let lastX = -1e9, level = 0;
  const placed = sorted.map((e) => {
    const x = pos(e.bps); const px = (x / 100) * width;
    level = px - lastX < minPx ? (level + 1) % 2 : 0; lastX = px;
    return { ...e, x, up: level === 1 };
  });
  const showBand = sealed || (reveal && !lifted);
  return (
    <div className={`scale ${variant}`}>
      <div className="head"><span>{title}</span><span className="mono mist">{note}</span></div>
      <div className="track" ref={trackRef}>
        {ticks.map((v) => (
          <React.Fragment key={v}>
            <div className="tick" style={{ left: `${pos(v * 100)}%`, height: v % 10 === 0 ? 18 : 9 }} />
            {v % 10 === 0 && <div className="tl" style={{ left: `${pos(v * 100)}%` }}>{v}</div>}
          </React.Fragment>
        ))}
        {!sealed && placed.map((e) => (
          <a key={e.id} href={e.href} className={`needle ${e.accent ? "accent" : ""} ${e.muted ? "muted" : ""} ${e.up ? "up" : ""} ${armed && lifted ? "on" : ""}`} style={{ left: `${e.x}%` }} aria-label={`${e.label}: ${(e.bps / 100).toFixed(2)} %`}>
            <span className="v">{(e.bps / 100).toFixed(2)}</span>
            <span className="id">{e.label}</span>
            <svg width="14" height="10" viewBox="0 0 14 10" aria-hidden="true"><path d="M7 10L0 0h14z" fill="currentColor" /></svg>
          </a>
        ))}
        {showBand && (
          <div className={`band ${reveal && lifted ? "lift" : ""}`}>
            <svg width="10" height="12" viewBox="0 0 10 12" aria-hidden="true"><rect x="1" y="5" width="8" height="6.5" fill="currentColor" /><path d="M2.5 5V3.5a2.5 2.5 0 0 1 5 0V5" fill="none" stroke="currentColor" strokeWidth="1.4" /></svg>
            {sealed || "sealed until close · unsealing"}
          </div>
        )}
      </div>
    </div>
  );
}

/** Lines from each entry's split-A position to its split-B position, drawn between the two scales. Crossing lines are the story. */
export function Slopegraph({ entries, winner }) {
  const rows = entries.filter((e) => e.a != null && e.b != null);
  if (rows.length < 2) return null;
  return (
    <svg className="slope" viewBox="0 0 100 24" preserveAspectRatio="none" role="img" aria-label="each entry's move from its split-A reading to its split-B reading">
      {rows.map((e) => <line key={e.id} x1={pos(e.a)} y1={0} x2={pos(e.b)} y2={24} stroke={e.id === winner ? "var(--accent)" : "var(--mist)"} strokeWidth={e.id === winner ? 0.6 : 0.35} vectorEffect="non-scaling-stroke" />)}
    </svg>
  );
}

/** One dot per test row, ordered by true class: filled = actually positive, ring = actually negative, orange = misjudged. */
export function DotPlate({ counts, caption, ghost = 150, ghostText }) {
  if (!counts) {
    return (
      <div className="stack" style={{ gap: 6 }}>
        {caption && <div className="label">{caption}</div>}
        <div className="dots" aria-hidden="true">{Array.from({ length: ghost }).map((_, i) => <i key={i} className="na" />)}</div>
        <div className="mono mist">{ghostText || "not scored yet"}</div>
      </div>
    );
  }
  const dots = [...Array(counts.tp).fill("pos"), ...Array(counts.fn).fill("pos x"), ...Array(counts.tn).fill("neg"), ...Array(counts.fp).fill("neg x")];
  const n = dots.length, wrong = counts.fp + counts.fn;
  return (
    <div className="stack" style={{ gap: 6 }}>
      {caption && <div className="label">{caption}</div>}
      <div className="dots" role="img" aria-label={`${n} rows: ${counts.tp} true positive, ${counts.fn} missed positive, ${counts.tn} true negative, ${counts.fp} false alarm`}>{dots.map((c, i) => <i key={i} className={c} />)}</div>
      <div className="mono ink2">tp {counts.tp} · fn {counts.fn} · tn {counts.tn} · fp {counts.fp} → bal. acc. {bps(counts.bal_acc_bps)}{counts.f1_bps != null && <> · F1 {bps(counts.f1_bps)}</>} · {wrong} of {n} misjudged</div>
      <div className="mono mist key"><i className="pos" /> actually positive <i className="neg" /> actually negative <i className="pos x" /> misjudged</div>
    </div>
  );
}

/** The model drawn from its bytes: one glyph per tree (first `limit`). Stroke weight = leaf weight, tone = split feature,
 *  leaf tick direction = sign of the leaf value. Click or focus a tree to read its root split. */
export function Forest({ bytes, trees: treesHint, limit = 50, cols = 10, featureNames = [], accent = false, draw = false, cell = 60, onRetry, readout = false }) {
  const model = useMemo(() => { try { return bytes ? decodeModel(bytes) : null; } catch { return null; } }, [bytes]);
  const [picked, setPicked] = useState(null);
  const count = model ? Math.min(model.trees.length, limit) : Math.min(treesHint || cols, limit);
  const rows = Math.max(1, Math.ceil(count / cols));
  const ch = cell * 0.8, pad = cell * 0.08;
  const box = { aspectRatio: `${cols * cell} / ${rows * ch}` };
  if (bytes === undefined) return <div className="forest" style={box}><div className="err mono">model bytes unavailable{onRetry && <button className="retry" onClick={onRetry}>retry</button>}</div></div>;
  if (!bytes) return <div className="forest" style={box}><div className="mist mono">loading model bytes…</div></div>;
  if (!model) return <div className="forest" style={box}><div className="err mono">could not decode model</div></div>;
  const mx = maxLeaf(model);
  const list = model.trees.slice(0, limit);
  const tones = ["var(--ink)", "var(--ink-2)", "var(--mist)"];
  const pickedTree = picked != null ? model.trees[picked] : null;
  const pickedRoot = pickedTree?.nodes[0];
  return (
    <div className={`forest ${draw ? "draw" : ""}`}>
      <svg viewBox={`0 0 ${cols * cell} ${rows * ch}`} role="img" aria-label={`${model.trees.length} decision trees of this model`} style={box}>
        {list.map((t, i) => {
          const L = treeLayout(t);
          const ox = (i % cols) * cell + pad, oy = Math.floor(i / cols) * ch + pad;
          const w = cell - 2 * pad, h = ch - 2 * pad;
          const root = t.nodes[0];
          const title = root && root.left !== LEAF ? `tree ${i + 1} · root split: ${featureNames[root.feature] ?? "f" + root.feature} < ${root.threshold}` : `tree ${i + 1} · single leaf`;
          const byPos = new Map(L.nodes.map((n) => [`${n.x},${n.y}`, n]));
          return (
            <g key={i} className={`tree ${picked === i ? "picked" : ""}`} tabIndex={readout ? 0 : -1} role={readout ? "button" : undefined} aria-label={title}
               onClick={readout ? () => setPicked(i) : undefined} onFocus={readout ? () => setPicked(i) : undefined} onMouseEnter={readout ? () => setPicked(i) : undefined}>
              {!readout && <title>{title}</title>}
              {L.edges.map((e, k) => {
                const child = byPos.get(`${e.x2},${e.y2}`);
                const sw = child?.leaf ? 0.7 + 1.6 * Math.abs(child.value) / mx : 1.1;
                return <path key={k} d={`M${ox + e.x1 * w} ${oy + e.y1 * h}L${ox + e.x2 * w} ${oy + e.y2 * h}`} stroke={tones[e.feature % 3]} strokeWidth={sw} style={draw ? { animationDelay: `${i * 12}ms` } : undefined} />;
              })}
              {L.nodes.filter((n) => n.leaf).map((n, k) => (
                <path key={`l${k}`} d={`M${ox + n.x * w} ${oy + n.y * h}v${n.value >= 0 ? h * 0.1 : -h * 0.1}`} stroke={tones[0]} strokeWidth={0.9} />
              ))}
              {root && <circle cx={ox + (L.nodes.find((n) => n.y === 0)?.x ?? 0.5) * w} cy={oy} r={cell * 0.035} fill={accent ? "var(--accent)" : "var(--ink)"} />}
            </g>
          );
        })}
      </svg>
      {readout && (
        <div className="mono mist readout" aria-live="polite">
          {pickedTree ? `tree ${picked + 1} · ${pickedRoot && pickedRoot.left !== LEAF ? `root split: ${featureNames[pickedRoot.feature] ?? "f" + pickedRoot.feature} < ${pickedRoot.threshold}` : "single leaf"} · ${pickedTree.nodes.length} nodes · depth ${treeLayout(pickedTree).depth}` : "stroke = leaf weight · tone = split feature · tick = direction of the leaf · click or tab to a tree for its root split"}
        </div>
      )}
    </div>
  );
}

export { statusDetail };
