// Everything below the stage. Words are Dave's, taken from web/src/Landing.jsx; every figure comes from contract state.
// No line separates one section from the next, and nothing small sits above a heading.
import { treeLayout, LEAF } from "../model.js";
import { yoctoToNear, pad2, bpsText, titleOf } from "./data.js";
import { contractId, EXPLORER_ACCOUNT } from "../rpc.js";
import { askSection } from "./ask.js";

const APP = "";
const REPO = "https://github.com/agadape/laurel";
const UNDO = "https://github.com/agadape/undo";
const MCP = "https://laurel-near.vercel.app/api/mcp";

const STEPS = [
  ["Submit a model as data", "A gradient-boosted tree model, exported to a few kilobytes of integers, is stored by the contract itself. No server, no API key, no hosting bill."],
  ["Judged inside a TEE", "An evaluator whose hash the contract pins runs in OutLayer's TEE on two private test splits that never leave the enclave."],
  ["The sealed split decides", "Split A is public while a task is open. Split B's rows never leave the enclave and its score is withheld from the leaderboard until close; it alone picks the champion."],
  ["Served and paid per call", "The champion answers predict_task for agents and other contracts. Every call is paid in NEAR, from prepaid credit, to the model's owner."],
];

const ASET = `${import.meta.env.BASE_URL}aset/`;
const scoreBar = (bps) => Math.max(0, Math.min(1, (bps - 5000) / 5000));
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const seg = (p, a, b) => clamp((p - a) / (b - a));
const ease = (t) => t * t * (3 - 2 * t);

const LAUREL_ICON = `<svg viewBox="0 0 40 34" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">${Array.from({ length: 5 }, (_, i) => { const a = 2.3 + i * 0.36, x = 20 + Math.cos(a) * 15, y = 18 + Math.sin(a) * -15 + 0; return `<path d="M${x.toFixed(1)} ${(36 - y).toFixed(1)}l-3 -5"/><path d="M${(40 - x).toFixed(1)} ${(36 - y).toFixed(1)}l3 -5"/>`; }).join("")}<path d="M20 30C8 29 4 20 6 9"/><path d="M20 30c12-1 16-10 14-21"/></g></svg>`;

export function renderPage(root, data) {
  const open = data.tasks.filter((t) => !t.closed && /^near-retention/.test(t.slug)).pop() || data.tasks.filter((t) => !t.closed).pop();
  const champ = data.tasks.filter((t) => t.closed && t.winner != null).pop();
  const winRow = champ?.board.find((r) => r.submission_id === champ.winner);
  const rows = open ? open.board.filter((r) => r.score_a_bps != null) : [];
  const leadA = champ ? champ.board.slice().sort((a, b) => b.score_a_bps - a.score_a_bps)[0] : null;
  const fee = yoctoToNear(champ?.fee_per_call || "0", 3);
  const earned = data.earned ? yoctoToNear(data.earned.yocto, 3) : "—";
  const words = [
    ["n", data.config.task_count], "exhibits,", ["n", data.config.submission_count], "models judged in a TEE.", "The", "champion", "has", "served", ["n", winRow?.calls, "calls"], "predictions", "and", "earned", "its", "owner", ["n", earned, "earned"], "NEAR", "on-chain,", "at", ["n", "4.3"], "Tgas", "a", "call.",
  ];

  root.innerHTML = `
  <main id="exhibits" class="page">
    ${askSection(champ, winRow, earned)}
    ${open ? `<section class="l-sec board-sec"><i class="aura a1"></i><div class="l-wrap">
      <div class="board-head">
        <h2 class="rise">Exhibit ${pad2(open.task_id)}: ${titleOf(open)}</h2>
        <div class="until rise" style="--d:100ms">
          <div class="clock" id="clock" data-ns="${open.deadline_ns}"></div>
          <p>until the leaderboard shows split B</p>
        </div>
      </div>
      <p class="body rise" style="--d:120ms">${/^near-retention/.test(open.slug) ? `Each row is a fresh <span class="code">.near</span> account's first seven days on NEAR mainnet, taken from the public BigQuery dataset. The label is whether the account was still acting between day 30 and day 90.` : "Train on the public split, submit a model as data, and read its split-A score here once the TEE has judged it."}</p>
      <div class="board" role="table">
        <div class="brow head rise" role="row"><span></span><span>Model</span><span class="glyph">Trees</span><span>Public split</span><span class="b-col">Sealed split</span></div>
        ${rows.map((r, i) => `<div class="brow rise" role="row" style="--d:${140 + i * 70}ms">
          <span class="rank">${i + 1}</span><span class="id">#${r.submission_id}</span>
          <span class="glyph"><canvas data-forest="${r.submission_id}" width="440" height="88"></canvas></span>
          <span class="pub"><span class="bar"><i data-to="${scoreBar(r.score_a_bps)}" style="--d:${260 + i * 90}ms"></i></span><b>${bpsText(r.score_a_bps)}</b></span>
          <span class="b-col"><span class="hatch"><em>Withheld</em></span></span></div>`).join("")}
      </div>
      <div class="links rise">${/^near-retention/.test(open.slug) ? `<a href="${REPO}/blob/main/tasks/near-retention/README.md" target="_blank" rel="noreferrer">The ${open.n_features} features and how the data was pulled ↗</a>` : ""}</div>
    </div></section>` : ""}

    <section class="l-sec how-sec"><i class="aura a2"></i><div class="l-wrap how">
      <ol class="how-steps" id="steps">${STEPS.map(([h, p], i) => `<li data-i="${i}"><h2>${h}</h2><p>${p}</p></li>`).join("")}</ol>
      <div class="how-panel" id="panel">
        <div class="how-view v1"><div class="hex" id="hex" aria-hidden="true"></div><div class="hero-num"><b>${winRow?.bytes.toLocaleString("en-US")}</b><span>bytes, stored by the contract itself. This is model #${champ?.winner}.</span></div></div>
        <div class="how-view v2"><img src="${ASET}latar-balok.webp" alt="" /><div class="hero-num"><span>Evaluator hash pinned by the contract</span><code>${data.evaluator[1]}</code></div></div>
        <div class="how-view v3"><div class="two"><div><span>Split A, public while open</span><i class="line a"></i></div><div><span>Split B, withheld until close</span><i class="line b"></i></div></div></div>
        <div class="how-view v4"><div class="ledger"><div><b>${fee}</b><span>NEAR per prediction</span></div><div><b data-live="calls">${winRow?.calls}</b><span>predictions served</span></div><div><b data-live="earned">${earned}</b><span>NEAR earned by its owner</span></div></div></div>
      </div>
    </div></section>

    ${champ ? `<section class="l-sec proof-sec" id="proof"><i class="aura a3"></i><div class="l-wrap">
      <h2 class="rise">${leadA.submission_id === champ.winner ? `#${champ.winner} led the public split and held the sealed one.` : `#${leadA.submission_id} led the public split. #${champ.winner} won the sealed one.`}</h2>
      ${race(champ)}
      <p class="body rise">Exhibit ${pad2(champ.task_id)}, read live. Split B is the reading taken on rows no entrant has ever seen, so it decides.</p>
    </div></section>` : ""}

    <section class="l-sec sum-sec"><div class="l-wrap"><p class="sum" id="sum">${words.map((w) => Array.isArray(w) ? `<span class="w num"${w[2] ? ` data-live="${w[2]}"` : ""}>${w[1]}</span>` : w.split(" ").map((x) => `<span class="w">${x}</span>`).join(" ")).join(" ")}</p></div></section>

    <section class="l-sec who-sec"><div class="l-wrap who">
      <div class="side">
        <svg class="tree-art" id="art-grow" viewBox="0 0 600 420" aria-hidden="true"></svg>
        <h2 class="rise">Model makers</h2>
        <p class="rise">Train on the public split, submit the model as data, get scored in a TEE on a sealed test set. Win and every prediction an agent or contract buys pays you the task's fee, withdrawable on-chain.</p>
        <button class="l-copy rise" data-copy="node tools/quickstart.mjs --task ${open?.task_id || 5}"><span class="code">node tools/quickstart.mjs --task ${open?.task_id || 5}</span><i>Copy</i></button>
      </div>
      <div class="side">
        <svg class="tree-art" id="art-call" viewBox="0 0 600 420" aria-hidden="true"></svg>
        <h2 class="rise">Agents and contracts</h2>
        <p class="rise">Prepay credit with NEAR, hand your agent a key that can only spend it on predictions, and call the champion through MCP or from your own contract. The model, its score and its evaluator are all verifiable.</p>
        <button class="l-copy rise" data-copy="${MCP}"><span class="code">${MCP}</span><i>Copy</i></button>
      </div>
    </div></section>

    <section class="close" id="close">
      <canvas id="wreath" width="1400" height="1400" aria-hidden="true"></canvas>
      <div class="close-in">
        <h2>Enter the observatory.</h2>
        <p>Connect a NEAR testnet wallet to open every exhibit, model and tree. Signing in creates no transaction.</p>
        <div class="cta">
          <a class="btn solid" href="#/tasks" data-signin><span>Connect wallet to enter</span><i aria-hidden="true">↗</i></a>
        </div>
      </div>
    </section>
  </main>
  <footer class="foot"><div class="foot-grid">
    <p class="foot-line">Small models, judged in the dark, paid in the open.</p>
    <nav aria-label="Enter"><b>Enter</b><a href="#/tasks" data-signin>Connect wallet</a><span>Meteor, Intear or Nightly, on testnet</span></nav>
    <nav aria-label="Verify"><b>Verify</b><a href="${REPO}" target="_blank" rel="noreferrer">Source on GitHub</a><a href="${EXPLORER_ACCOUNT(contractId())}" target="_blank" rel="noreferrer">Contract on NearBlocks</a><a href="${MCP}" target="_blank" rel="noreferrer">Remote MCP</a></nav>
    <nav aria-label="Team"><b>Team</b><a href="${UNDO}" target="_blank" rel="noreferrer">Undo, our sister project</a><span>NEAR HACKATHON 2026</span></nav>
  </div>
  <p class="foot-note">${data.live ? "Every figure on this page is read live from the contract." : `The RPC was slow, so this page shows a saved copy of the same contract views${data.taken_at ? ` (taken ${data.taken_at})` : ""}; every explorer page reads live.`} No mock data.</p>
  <div class="foot-word" aria-hidden="true">LAUREL</div></footer>`;

  const hex = root.querySelector("#hex");
  const champModel = champ?.models.find((m) => m.id === champ.winner);
  if (hex && champModel) {
    const bin = atob(champModel.rawB64).slice(0, 1800);
    hex.textContent = Array.from(bin, (c) => c.charCodeAt(0).toString(16).padStart(2, "0")).join(" ");
  }
  root.querySelectorAll("canvas[data-forest]").forEach((c) => {
    const m = open.models.find((x) => x.id === +c.dataset.forest);
    if (!m) return;
    const g = c.getContext("2d"), trees = m.model.trees, rowsN = trees.length > 25 ? 2 : 1, cols = Math.ceil(trees.length / rowsN);
    const w = c.width / 25, h = c.height / 2;
    g.strokeStyle = "rgba(120,220,255,.85)"; g.lineWidth = 1;
    trees.forEach((t, i) => {
      const x = (i % cols) * w, y = Math.floor(i / cols) * h + (rowsN === 1 ? h / 2 : 0);
      g.beginPath();
      for (const e of treeLayout(t).edges) { g.moveTo(x + 2 + e.x1 * (w - 4), y + 3 + e.y1 * (h - 6)); g.lineTo(x + 2 + e.x2 * (w - 4), y + 3 + e.y2 * (h - 6)); }
      g.stroke();
    });
  });
  if (champModel) trees(root, champModel.model);
  return { open, champ, champModel };
}

/** The race: both models run the public split, the seal lifts, and the same models run the one that counts. */
function race(task) {
  const r = task.board.filter((x) => x.score_a_bps != null && x.score_b_bps != null).sort((a, b) => b.score_a_bps - a.score_a_bps);
  return `<div class="race" id="race" data-win="${task.winner}" data-rows='${JSON.stringify(r.map((x) => ({ id: x.submission_id, a: x.score_a_bps, b: x.score_b_bps, trees: x.trees })))}'>
    <div class="race-state"><span id="race-title">Public split</span><span id="race-note"></span></div>
    <div class="race-rows">${r.map((x) => `<div class="lane" data-id="${x.submission_id}"><div class="who-tag"><b>#${x.submission_id}</b><span>${x.trees} trees</span></div><div class="track"><i class="fill"></i><span class="crown">${LAUREL_ICON}</span></div><b class="val">0.00</b></div>`).join("")}</div>
    <i class="seal" id="seal"><em>Sealed</em></i>
  </div>`;
}

function runRace() {
  const el = document.querySelector("#race");
  if (!el) return;
  const rows = JSON.parse(el.dataset.rows), win = +el.dataset.win, lanes = [...el.querySelectorAll(".lane")];
  const seal = el.querySelector("#seal"), title = el.querySelector("#race-title"), note = el.querySelector("#race-note");
  const lo = 5500, hi = 8000, X = (v) => clamp((v - lo) / (hi - lo));
  const leadA = rows[0], winner = rows.find((x) => x.id === win);
  const LOOP = 11;
  let visible = false, t0 = 0, raf = 0, lastPhase = -1;
  const scene = (t) => {
    const up = ease(seg(t, 0.4, 2.0));            // both run the public split
    const close = ease(seg(t, 3.0, 3.7));         // the seal slides across
    const lift = ease(seg(t, 4.2, 5.0));          // and lifts, revealing the second run
    const drop = ease(seg(t, 4.6, 6.4));          // everyone settles on what the sealed split says
    const out = ease(seg(t, 10.2, 10.9));
    lanes.forEach((ln, i) => {
      const r = rows[i], v = (r.a + (r.b - r.a) * drop) * up + lo * (1 - up);
      const isWin = r.id === win;
      ln.querySelector(".fill").style.transform = `scaleX(${X(v)})`;
      ln.querySelector(".val").textContent = (v / 100).toFixed(2);
      ln.classList.toggle("lit", drop > 0.72 ? isWin : r.id === leadA.id && up > 0.92);
      ln.classList.toggle("fell", drop > 0.72 && !isWin);
      const crown = ln.querySelector(".crown");
      const has = drop > 0.72 ? isWin : r.id === leadA.id && up > 0.92;
      crown.style.opacity = has ? 1 : 0;
      crown.style.left = `${X(v) * 100}%`;
    });
    seal.style.transform = `translate3d(${(1 - close) * 104 - lift * 104}%, 0, 0)`;
    el.style.opacity = (1 - out).toFixed(3);
    const phase = t < 3 ? 0 : t < 4.6 ? 1 : drop < 0.72 ? 1 : 2;
    if (phase !== lastPhase) {
      lastPhase = phase;
      title.textContent = ["Public split", "Sealed split", "Sealed split, final"][phase];
      note.textContent = phase < 2 ? "" : leadA.id === winner.id ? `#${winner.id} kept the laurel.` : `#${leadA.id} fell ${((leadA.a - leadA.b) / 100).toFixed(2)} points. #${winner.id} fell ${((winner.a - winner.b) / 100).toFixed(2)} and took the laurel.`;
    }
  };
  const tick = (now) => { if (!visible) return; scene(((now - t0) / 1000) % LOOP); raf = requestAnimationFrame(tick); };
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) { scene(9); return; }
  new IntersectionObserver(([e]) => {
    if (e.isIntersecting && !visible) { visible = true; t0 = performance.now(); raf = requestAnimationFrame(tick); }
    else if (!e.isIntersecting) { visible = false; cancelAnimationFrame(raf); }
  }, { threshold: 0.35 }).observe(el);
}

/** Two real trees: one grows as you arrive, on the other a call keeps walking from root to leaf. */
function trees(root, model) {
  const sorted = model.trees.slice().sort((a, b) => b.nodes.length - a.nodes.length);
  const draw = (svg, tree) => {
    const { nodes, edges } = treeLayout(tree);
    const px = (u) => 24 + u * 552, py = (v) => 24 + v * 372;
    svg.innerHTML = edges.map((e, i) => `<line pathLength="1" x1="${px(e.x1)}" y1="${py(e.y1)}" x2="${px(e.x2)}" y2="${py(e.y2)}" style="--i:${i}"/>`).join("") + nodes.filter((n) => n.leaf).map((n) => `<circle cx="${px(n.x)}" cy="${py(n.y)}" r="3"/>`).join("");
  };
  const grow = root.querySelector("#art-grow"), call = root.querySelector("#art-call");
  if (!grow || !call) return;
  draw(grow, sorted[0]);
  draw(call, sorted[1] || sorted[0]);
  // the walk follows the tree's own node structure
  const tree = sorted[1] || sorted[0], lay = treeLayout(tree);
  const pos = new Map();
  (function place(i, level) { const n = tree.nodes[i]; if (!n) return; if (n.left !== LEAF) { place(n.left, level + 1); place(n.right, level + 1); } })(0, 0);
  const lines = [...call.querySelectorAll("line")].map((l) => ({ el: l, x1: +l.getAttribute("x1"), y1: +l.getAttribute("y1"), x2: +l.getAttribute("x2"), y2: +l.getAttribute("y2") }));
  const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle"); dot.setAttribute("r", "7"); dot.setAttribute("class", "walker"); call.appendChild(dot);
  let cur = [], k = 0, born = 0, visible = false;
  const pick = () => {
    const top = lines.reduce((m, l) => Math.min(m, l.y1), 1e9);
    let at = lines.filter((l) => l.y1 === top);
    const path = [];
    while (at.length) { const n = at[Math.floor(Math.random() * at.length)]; path.push(n); at = lines.filter((l) => Math.abs(l.x1 - n.x2) < .01 && Math.abs(l.y1 - n.y2) < .01); }
    return path;
  };
  const tick = (now) => {
    if (!visible) return;
    if (!cur.length || (k >= cur.length && now - born > 900)) { lines.forEach((l) => l.el.classList.remove("on")); cur = pick(); k = 0; born = now; }
    const q = (now - born) / 340;
    if (k < cur.length) {
      const l = cur[k], t = Math.min(1, q - k);
      dot.setAttribute("cx", l.x1 + (l.x2 - l.x1) * t); dot.setAttribute("cy", l.y1 + (l.y2 - l.y1) * t);
      l.el.classList.add("on");
      if (q - k >= 1) { k++; if (k === cur.length) born = now; }
    }
    requestAnimationFrame(tick);
  };
  new IntersectionObserver(([e]) => { const was = visible; visible = e.isIntersecting; if (visible && !was) requestAnimationFrame(tick); grow.classList.toggle("drawn", e.isIntersecting || grow.classList.contains("drawn")); }, { threshold: 0.2 }).observe(call);
}

export function startLoops(lenis) {
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting) return;
    e.target.classList.add("seen"); io.unobserve(e.target);
    e.target.querySelectorAll?.(".bar i").forEach((i) => { i.style.transform = `scaleX(${i.dataset.to})`; });
  }), { threshold: 0.12 });
  document.querySelectorAll(".rise").forEach((el) => io.observe(el));

  const steps = [...document.querySelectorAll("#steps li")], views = [...document.querySelectorAll("#panel .how-view")];
  const set = (i) => { steps.forEach((s, k) => s.classList.toggle("on", k === i)); views.forEach((v, k) => v.classList.toggle("on", k === i)); };
  set(0);
  const so = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) set(+e.target.dataset.i); }), { rootMargin: "-45% 0px -45% 0px" });
  steps.forEach((s) => so.observe(s));

  const clock = document.querySelector("#clock");
  if (clock) {
    const end = Number(BigInt(clock.dataset.ns) / 1000000n);
    let timer = 0;
    const tick = () => {
      if (!clock.isConnected) { clearInterval(timer); return; }
      const s = Math.max(0, Math.floor((end - Date.now()) / 1000));
      const parts = [[Math.floor(s / 86400), "d"], [Math.floor(s / 3600) % 24, "h"], [Math.floor(s / 60) % 60, "m"], [s % 60, "s"]];
      clock.innerHTML = parts.map(([v, l]) => `<span>${String(v).padStart(2, "0")}<small>${l}</small></span>`).join("");
    };
    tick(); timer = setInterval(tick, 1000);
  }

  // the sentence lights up word by word as it crosses the screen
  const sum = document.querySelector("#sum"), sumWords = sum ? [...sum.querySelectorAll(".w")] : [];
  const onScroll = () => {
    if (!sum) return;
    const r = sum.getBoundingClientRect(), H = innerHeight;
    if (r.bottom < 0 || r.top > H) return;
    const prog = clamp((H * 0.82 - r.top) / (r.height + H * 0.36));
    sumWords.forEach((w, i) => w.classList.toggle("on", i / sumWords.length < prog));
  };
  lenis.on("scroll", onScroll); onScroll();

  document.querySelectorAll(".l-copy").forEach((b) => b.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(b.dataset.copy); } catch {}
    const i = b.querySelector("i"); i.textContent = "Copied"; setTimeout(() => { i.textContent = "Copy"; }, 1400);
  }));
  runRace();
}

/** The closing wreath: the champion's real trees as leaves on two branches. Returns draw(t), t 0..1. */
export function wreath(canvas, model) {
  const g = canvas.getContext("2d");
  const S = canvas.width, C = S / 2, list = model.trees.slice(0, 50), n = list.length;
  const LW = 44, LH = 112;
  const sprites = list.map((t, i) => {
    const c = document.createElement("canvas"); c.width = LW * 2; c.height = LH * 2;
    const x = c.getContext("2d"); x.scale(2, 2);
    const lead = i % 7 === 3;
    const leaf = () => { x.beginPath(); x.moveTo(LW / 2, 1); x.quadraticCurveTo(LW + 6, LH * .46, LW / 2, LH - 1); x.quadraticCurveTo(-6, LH * .46, LW / 2, 1); x.closePath(); };
    const fill = x.createLinearGradient(0, 0, LW, LH); fill.addColorStop(0, "rgba(0,191,255,.26)"); fill.addColorStop(1, "rgba(0,191,255,.05)");
    x.fillStyle = fill; x.strokeStyle = lead ? "#bdeeff" : "rgba(0,191,255,.9)"; x.lineWidth = 1;
    leaf(); x.fill(); x.stroke();
    x.save(); leaf(); x.clip();
    x.strokeStyle = "rgba(205,242,255,.9)"; x.lineWidth = .7; x.beginPath();
    for (const e of treeLayout(t).edges) { x.moveTo(11 + e.x1 * (LW - 22), 24 + e.y1 * (LH - 48)); x.lineTo(11 + e.x2 * (LW - 22), 24 + e.y2 * (LH - 48)); }
    x.stroke(); x.restore();
    return c;
  });
  const side = Math.ceil(n / 2), R = S * 0.385;
  const leaves = list.map((_, i) => {
    const left = i % 2 === 0, k = Math.floor(i / 2) / (side - 1), alt = Math.floor(i / 2) % 2 === 0 ? 1 : -1;
    const a = (Math.PI / 2) + (left ? 1 : -1) * (0.1 + k * 2.56);
    const r = R + alt * S * 0.034;
    return { x: C + Math.cos(a) * r, y: C + Math.sin(a) * r, rot: (left ? a + Math.PI : a) + (left ? -1 : 1) * alt * 0.46, delay: (i / n) * 0.55, scale: 1.2 - k * 0.5 };
  });
  return (t) => {
    g.clearRect(0, 0, S, S);
    g.strokeStyle = "rgba(0,191,255,.45)"; g.lineWidth = 2;
    const grown = Math.min(1, t / 0.75) * 2.66;
    g.beginPath(); g.arc(C, C, R, Math.PI / 2 + 0.03, Math.PI / 2 + 0.03 + grown); g.stroke();
    g.beginPath(); g.arc(C, C, R, Math.PI / 2 - 0.03, Math.PI / 2 - 0.03 - grown, true); g.stroke();
    leaves.forEach((l, i) => {
      let q = Math.max(0, Math.min(1, (t - l.delay) / 0.45)); q = 1 - (1 - q) ** 3;
      if (q <= 0) return;
      const x = C + (l.x - C) * q, y = C + S * 0.3 * (1 - q) + (l.y - C) * q;
      g.save(); g.translate(x, y); g.rotate(l.rot * q); g.scale(l.scale, l.scale); g.globalAlpha = q;
      g.drawImage(sprites[i], -LW / 2, -LH / 2, LW, LH);
      g.restore();
    });
  };
}
