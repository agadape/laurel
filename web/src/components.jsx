import React, { useEffect, useMemo, useState } from "react";
import { view, nsToDate, bps, statusText, statusDetail } from "./rpc.js";
import { decodeModel, treeLayout, LEAF } from "./model.js";

/** One RPC view call with loading / error / retry. */
export function useView(method, args, deps) {
  const [state, set] = useState({ loading: true });
  const [n, setN] = useState(0);
  useEffect(() => {
    let alive = true;
    set({ loading: true });
    view(method, args).then((data) => alive && set({ data })).catch((e) => alive && set({ error: String(e.message || e) }));
    return () => { alive = false; };
  }, [...deps, n]); // eslint-disable-line
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
      <pre>{children}</pre>
      <button onClick={() => { navigator.clipboard?.writeText(children); setOk(true); setTimeout(() => setOk(false), 1200); }}>{ok ? "copied" : "copy"}</button>
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
  return <Pill kind={kind}>{t === "Scored" ? "scored in TEE" : t}</Pill>;
}
export const Sec = ({ n, title }) => <div className="sec">{n} — {title}</div>;
export const Fig = ({ v, unit, l }) => (
  <div className="fig"><span className="v">{v}{unit && <small> {unit}</small>}</span><span className="l">{l}</span></div>
);

export const Countdown = ({ ns, closed }) => {
  const d = nsToDate(ns); const ms = d - Date.now();
  if (closed || ms <= 0) return <span>passed · {d.toLocaleString()}</span>;
  const dd = Math.floor(ms / 864e5), h = Math.floor((ms % 864e5) / 3.6e6), m = Math.floor((ms % 3.6e6) / 6e4);
  return <span>{dd > 0 ? `${dd}d ${h}h` : `${h}h ${m}m`} left · {d.toLocaleString()}</span>;
};

export const fmtDate = (ns) => nsToDate(ns).toISOString().replace("T", " ").slice(0, 16) + " UTC";
export const shortHash = (s, n = 8) => (s && s.length > 2 * n + 1 ? `${s.slice(0, n)}…${s.slice(-4)}` : s);

/** Instrument scale 50–100 %: one needle per entry {id, bps, href, accent, muted, label}. `sealed` = band text while hidden. */
export function Scale({ variant = "a", title, note, entries = [], sealed = null }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => { const t = setTimeout(() => setArmed(true), 60); return () => clearTimeout(t); }, []);
  const pos = (v) => Math.max(0, Math.min(1, (v / 100 - 50) / 50)) * 100;
  const ticks = []; for (let v = 50; v <= 100; v += 5) ticks.push(v);
  const sorted = entries.filter((e) => e.bps != null).slice().sort((a, b) => a.bps - b.bps);
  // raise a needle that would collide with its left neighbour
  let lastX = -100, lastUp = false;
  const placed = sorted.map((e) => { const x = pos(e.bps); const up = x - lastX < 7 && !lastUp; lastX = x; lastUp = up; return { ...e, x, up }; });
  return (
    <div className={`scale ${variant}`}>
      <div className="head"><span>{title}</span><span className="mono mist">{note}</span></div>
      <div className="track">
        {ticks.map((v) => (
          <React.Fragment key={v}>
            <div className="tick" style={{ left: `${pos(v * 100)}%`, height: v % 10 === 0 ? 18 : 9 }} />
            {v % 10 === 0 && <div className="tl" style={{ left: `${pos(v * 100)}%` }}>{v}</div>}
          </React.Fragment>
        ))}
        {!sealed && placed.map((e) => (
          <a key={e.id} href={e.href} className={`needle ${e.accent ? "accent" : ""} ${e.muted ? "muted" : ""} ${e.up ? "up" : ""}`} style={{ left: `${armed ? e.x : 0}%` }}>
            <span className="v">{(e.bps / 100).toFixed(2)}</span>
            <span className="id">{e.label}</span>
            <svg width="14" height="10" viewBox="0 0 14 10" aria-hidden="true"><path d="M7 10L0 0h14z" fill="currentColor" /></svg>
          </a>
        ))}
        {sealed && (
          <div className="band">
            <svg width="10" height="12" viewBox="0 0 10 12" aria-hidden="true"><rect x="1" y="5" width="8" height="6.5" fill="currentColor" /><path d="M2.5 5V3.5a2.5 2.5 0 0 1 5 0V5" fill="none" stroke="currentColor" strokeWidth="1.4" /></svg>
            {sealed}
          </div>
        )}
      </div>
    </div>
  );
}

/** One dot per test row from the evaluator's confusion counts; orange = misjudged. */
export function DotPlate({ counts, caption }) {
  if (!counts) return <div className="mist mono">not scored yet</div>;
  const n = counts.n ?? (counts.tp + counts.tn + counts.fp + counts.fn);
  const correct = counts.tp + counts.tn;
  const dots = []; for (let i = 0; i < n; i++) dots.push(i < correct ? "" : "x");
  return (
    <div className="stack" style={{ gap: 6 }}>
      {caption && <div className="label">{caption}</div>}
      <div className="dots" role="img" aria-label={`${n} rows, ${n - correct} misjudged`}>{dots.map((c, i) => <i key={i} className={c} />)}</div>
      <div className="mono ink2">tp {counts.tp} · tn {counts.tn} · fp {counts.fp} · fn {counts.fn} → bal. acc. {bps(counts.bal_acc_bps)}{counts.f1_bps != null && <> · F1 {bps(counts.f1_bps)}</>}</div>
    </div>
  );
}

/** The model drawn from its bytes: one glyph per tree (first `limit`), split feature readable on hover. */
export function Forest({ bytes, limit = 50, cols = 10, featureNames = [], accent = false, draw = false, cell = 60 }) {
  const model = useMemo(() => { try { return bytes ? decodeModel(bytes) : null; } catch { return null; } }, [bytes]);
  if (!bytes) return <div className="mist mono">loading model bytes…</div>;
  if (!model) return <div className="err mono">could not decode model</div>;
  const trees = model.trees.slice(0, limit);
  const rows = Math.ceil(trees.length / cols);
  const ch = cell * 0.8, pad = cell * 0.08;
  const stroke = accent ? "var(--accent)" : "var(--ink)";
  return (
    <div className="forest">
      <svg viewBox={`0 0 ${cols * cell} ${rows * ch}`} role="img" aria-label={`${model.trees.length} decision trees of this model`}>
        {trees.map((t, i) => {
          const L = treeLayout(t);
          const ox = (i % cols) * cell + pad, oy = Math.floor(i / cols) * ch + pad;
          const w = cell - 2 * pad, h = ch - 2 * pad;
          const root = t.nodes[0];
          const title = root && root.left !== LEAF ? `tree ${i + 1} · root split: ${featureNames[root.feature] ?? "f" + root.feature} < ${root.threshold}` : `tree ${i + 1} · single leaf`;
          return (
            <g key={i} className="tree">
              <title>{title}</title>
              {L.edges.map((e, k) => (
                <path key={k} className={draw ? "draw" : ""} d={`M${ox + e.x1 * w} ${oy + e.y1 * h}L${ox + e.x2 * w} ${oy + e.y2 * h}`} stroke={e.y1 === 0 ? "var(--accent)" : stroke} strokeWidth={e.y1 === 0 ? 1.8 : 1.2} style={draw ? { animationDelay: `${i * 12}ms` } : undefined} />
              ))}
              {root && <circle cx={ox + (L.nodes.find((n) => n.y === 0)?.x ?? 0.5) * w} cy={oy} r={cell * 0.035} fill="var(--accent)" />}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export const treesOf = (bytes) => { try { return bytes ? decodeModel(bytes).trees.length : null; } catch { return null; } };
export const depthOf = (bytes) => { try { const m = decodeModel(bytes); return Math.max(...m.trees.map((t) => treeLayout(t).depth)); } catch { return null; } };
export { statusDetail };
