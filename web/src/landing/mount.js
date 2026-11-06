// One value p (0..1) drives the stage. One rAF loop. Nothing on the stage has a timeline of its own.
import Lenis from "lenis";
import "./style.css";
import { loadData } from "./data.js";
import { createWorld, PLATE } from "./world.js";
import { renderPage, wreath, startLoops } from "./sections.js";

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const seg = (p, a, b) => clamp((p - a) / (b - a));
const ease = (t) => t * t * (3 - 2 * t);
const out3 = (t) => 1 - (1 - t) ** 3;

/** Catmull-Rom through keyed rows, so the camera never visibly stops at a key. */
function track(keys, p) {
  const n = keys.length;
  if (p <= keys[0][0]) return keys[0].slice(1);
  if (p >= keys[n - 1][0]) return keys[n - 1].slice(1);
  let i = 0;
  while (i < n - 2 && p > keys[i + 1][0]) i++;
  const k1 = keys[i], k2 = keys[i + 1], k0 = keys[Math.max(0, i - 1)], k3 = keys[Math.min(n - 1, i + 2)];
  const h = k2[0] - k1[0], t = (p - k1[0]) / h, t2 = t * t, t3 = t2 * t, o = [];
  for (let c = 1; c < k1.length; c++) {
    const m1 = ((k2[c] - k0[c]) / Math.max(1e-4, k2[0] - k0[0])) * h, m2 = ((k3[c] - k1[c]) / Math.max(1e-4, k3[0] - k1[0])) * h;
    o.push((2 * t3 - 3 * t2 + 1) * k1[c] + (t3 - 2 * t2 + t) * m1 + (-2 * t3 + 3 * t2) * k2[c] + (t3 - t2) * m2);
  }
  return o;
}

const ASET = `${import.meta.env.BASE_URL}aset/`;
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const LETTERS = [[0.075, 0.214], [0.206, 0.372], [0.358, 0.514], [0.522, 0.672], [0.672, 0.81], [0.81, 0.95]];
const WORD = { x: 0.084, w: 0.856, y: 0.36 };
const FLICKER = [
  [0.08, 0, .7, 0, .2, 0, .9, .4, 1],
  [0, .9, .1, 1, .3, 1, .7, 1, 1],
  [0, 0, 0, .3, 0, .5, 0, .8, 1],
  [0, .1, .6, 0, .9, .2, 1, .7, 1],
  [0, 0, 0, 0, .4, 0, .7, .2, 1],
  [0, 0, .2, 0, 0, .6, 0, .9, 1],
];

export function mountLanding(root, { onGuest, signIn }) {
const $ = (q) => root.querySelector(q);
root.classList.add("ld-root");
root.innerHTML = `<a class="skip" href="#exhibits">Skip to exhibits</a>
  <a class="logo" href="#/" id="logo">LAUREL</a>
  <span class="status" id="status"><i></i>Live on NEAR testnet</span>
  <nav class="nav" id="nav" aria-label="primary"><a class="src" href="https://github.com/agadape/laurel" target="_blank" rel="noreferrer">Source</a><a class="btn" href="#/tasks" data-signin><span>Connect wallet</span><i aria-hidden="true">↗</i></a></nav>
  <i class="topbar" id="bar"></i>
  <div id="boot" aria-hidden="true">
    <div class="boot-scene" id="scene">
      <img id="off" src="${ASET}frame-1-mati.webp" alt="" />
      ${LETTERS.map(([a, b]) => `<div class="boot-strip" style="--m:linear-gradient(90deg, transparent ${(a - 0.012) * 100}%, #000 ${(a + 0.012) * 100}%, #000 ${(b - 0.012) * 100}%, transparent ${(b + 0.012) * 100}%)"></div>`).join("")}
    </div>
    <i class="boot-line" id="line"></i>
  </div>
  <div class="stage-track" id="top">
    <div class="stage" id="stage">
      <img class="l-plate" id="plate-ruang" src="${ASET}latar-ruang.webp" alt="" />
      <img class="l-plate" id="plate-balok" src="${ASET}latar-balok.webp" alt="" />
      <img class="l-plate" id="plate-studio" src="${ASET}latar-studio.webp" alt="" />
      <canvas id="gl"></canvas>
      <i class="wipe" id="wipe"></i>
      <i class="blade" id="blade"></i>
      <div class="say scene-c" id="c"><h1 aria-label="Models, observed."></h1><p class="sub">An observatory of small models.</p></div>
      <span class="scroll-hint" id="hint">Scroll</span>
      <div class="say scene-wall" id="wall">
        <div class="tally"><span><b id="n-checked">0</b>trees read</span><span class="blue"><b id="n-blue">0</b>champion</span><span class="orange"><b id="n-orange">0</b>awaiting close</span></div>
        <p>Not an illustration: each pane is one decision tree, decoded from the bytes the contract stores. Each star is one of its leaves.</p>
      </div>
      <i class="stage-fade" id="sfade"></i>
      <div class="say scene-a" id="a">
        <h2><span class="ln"><span>Small models,</span></span><span class="ln"><span>judged in the dark,</span></span><span class="ln"><span>paid in the open.</span></span></h2>
        <p class="lede">Laurel is a registry on NEAR for small decision models. You submit a model as data, a TEE scores it on a test set nobody can read, and the best one becomes a contract method that agents and other contracts pay to call.</p>
        <div class="cta"><a class="btn" href="#proof" id="see"><span>See who won</span><i aria-hidden="true">↗</i></a><a class="btn" href="#/tasks" data-guest><span>Browse without a wallet</span><i aria-hidden="true">↗</i></a></div>
      </div>
    </div>
  </div>
  <div id="rest"></div>`;

const h1 = $("#c h1");
let idx = 0;
h1.innerHTML = "Models,|observed.".split("|").map((l) => `<span style="display:block" aria-hidden="true">${[...l].map((c) => `<span class="ch" style="--i:${idx++}">${c}</span>`).join("")}</span>`).join("");

const canvas = $("#gl"), track_ = $("#top"), stage = $("#stage");
const plateS = $("#plate-studio"), plateB = $("#plate-balok"), blade = $("#blade");
plateB.style.opacity = 0;
const bar = $("#bar"), logo = $("#logo"), nav = $("#nav"), statusEl = $("#status"), wipe = $("#wipe"), sfade = $("#sfade"), c = $("#c"), wall = $("#wall"), a = $("#a"), hint = $("#hint");

let world = null, keys = null, shared = null, intro = 0, p = 0, pTarget = 0, wreathDraw = null;
let dead = false;
const lenis = new Lenis({ lerp: 0.11, wheelMultiplier: 1, smoothWheel: !reduced });
lenis.stop();

// the camera: first the four specimens, then sideways along the wall, then it turns to face the block
function buildKeys() {
  const L = world.length, tall = innerHeight > innerWidth;
  const end = L * 0.9;
  const hero = tall ? [-6.2, 1.2, 12.5, 1.6, 0.25, 3.4, 40] : [-5.5, 1.02, 9.4, -0.75, 0.84, 4.4, 23];
  keys = [
    [0, ...hero],
    [0.05, hero[0] + 0.5, hero[1] + 0.05, hero[2] + 0.2, hero[3] + 0.7, hero[4], hero[5], hero[6]],
    [0.2, L * 0.08, 2.9, 8.5, L * 0.26, 0.4, -9, 42],
    [0.42, L * 0.38, 3.1, 9, L * 0.56, 0.4, -9, 42],
    [0.6, L * 0.66, 3.1, 10, L * 0.84, 0.5, -9, 42],
    [0.74, end, 2.8, 12, end + 14, 1.4, -9, 42],
    [1, end + 3, 2.6, 11, end + 17, 1.6, -9, 42],
  ];
}

// the plate is object-fit: cover, so its uv maps to the screen by one scale and one offset
let cover = null;
function measure() {
  const W = innerWidth, H = innerHeight, sc = Math.max(W / PLATE.w, H / PLATE.h);
  const ox = (W - PLATE.w * sc) * (H > W ? 0.8 : 0.5), oy = (H - PLATE.h * sc) / 2;
  const iw = PLATE.w * sc, ih = PLATE.h * sc;
  cover = {
    uv: [(2 * iw) / W, (-2 * ih) / H, (2 * ox) / W - 1, 1 - (2 * oy) / H],
    dotPx: Math.max(5, sc * 8.6),
    seam: PLATE.seam.map(([x, y]) => [ox + x * sc, oy + y * sc]),
  };
  const [a, b] = cover.seam;
  blade.style.width = `${Math.hypot(b[0] - a[0], b[1] - a[1])}px`;
  blade.style.left = `${a[0]}px`; blade.style.top = `${a[1]}px`;
  cover.angle = Math.atan2(b[1] - a[1], b[0] - a[0]);
  if (world) world.resize();
}

function frame(now) {
  if (dead) return;
  const rect = track_.getBoundingClientRect();
  const range = rect.height - innerHeight;
  pTarget = clamp(-rect.top / range);
  p += (pTarget - p) * 0.32;
  if (Math.abs(pTarget - p) < 1e-5) p = pTarget;
  const inStage = rect.bottom > -40;
  bar.classList.toggle("on", pTarget >= 0.999);
  if (world && inStage) paint(now / 1000);
  if (wreathDraw && closeEl) {
    const r = closeEl.getBoundingClientRect();
    if (r.top < innerHeight && r.bottom > 0) wreathDraw(clamp(1 - (r.top + r.height * 0.2) / innerHeight));
  }
  requestAnimationFrame(frame);
}

let lastTally = -1, lastFg = "", lastFn = "";
function paint(time) {
  const [ex, ey, ez, lx, ly, lz, fov] = track(keys, p);
  const eye = [ex, ey, ez], look = [lx, ly, lz];
  const L = world.length;
  const sweep = lerp(-30, ex + 17, seg(p, 0.05, 0.16)) + ease(seg(p, 0.46, 0.6)) * L * 0.25;
  const front = sweep + 26;
  // the light goes out from the right, the glass goes with it, and only the stars are left
  const dark = ease(seg(p, 0.6, 0.72));
  const fade = 1 - ease(seg(p, 0.62, 0.72));
  const dots = seg(p, 0.68, 0.88);
  world.draw({ eye, look, fov, plate: cover.uv, dotPx: cover.dotPx, front, sweep, intro, dots, dark, time, fade, shadow: 1 - dark, line: ease(seg(p, 0.1, 0.2)) * fade });

  const wx = lerp(44, -44, ease(seg(p, 0.58, 0.74)));
  wipe.style.transform = `translate3d(${wx}%, 0, 0)`;
  plateS.style.visibility = p > 0.76 ? "hidden" : "visible";
  wipe.style.opacity = (1 - seg(p, 0.77, 0.82)).toFixed(3);

  // the floor line of the plate stays on the far wall of the world, so the panes stand in the room
  if (p < 0.76) {
    const qx = lx * 0.5 + ex * 0.5, vp = world.vpOf(eye, look, fov), w_ = vp[3] * qx - vp[11] * 34 + vp[15], y_ = vp[1] * qx - vp[9] * 34 + vp[13];
    const hf = 0.5 - (y_ / w_) * 0.5, fit = ease(seg(p, 0.04, 0.16));
    const S = lerp(1.05, 1.05 + Math.max(0, 0.67 - hf) * 2.9, fit), ty = lerp(0, (hf - 0.67 * S) * 100, fit);
    plateS.style.transform = `translate3d(${-p * 1.6}%, ${ty}%, 0) scale(${S})`;
  }

  // the seam of light is drawn along the top edge, then the glass comes up under it
  const bladeIn = ease(seg(p, 0.76, 0.84));
  blade.style.opacity = (seg(p, 0.75, 0.78) * (1 - seg(p, 0.875, 0.895))).toFixed(3);
  blade.style.transform = `rotate(${cover.angle}rad) scaleX(${bladeIn})`;
  plateB.style.opacity = ease(seg(p, 0.8, 0.885)).toFixed(3);
  sfade.style.opacity = seg(p, 0.78, 0.9).toFixed(3);

  // who owns the brand colour
  const fg = p > 0.69 || intro < 0.02 ? "#F4F2EC" : "#0E1013";
  if (fg !== lastFg) { lastFg = fg; logo.style.setProperty("--brand", fg); statusEl.style.setProperty("--brand", fg); }
  const fn = p > 0.66 ? "#F4F2EC" : "#0E1013";
  if (fn !== lastFn) { lastFn = fn; nav.style.setProperty("--brand", fn); }

  // words
  const cOut = ease(seg(p, 0.02, 0.09));
  c.style.opacity = (1 - cOut).toFixed(3);
  c.style.transform = `translateX(${-cOut * 22}vw)`;
  hint.style.opacity = intro > 0.9 ? (1 - seg(p, 0, 0.02)).toFixed(3) : 0;
  const wv = ease(seg(p, 0.16, 0.22)) * (1 - ease(seg(p, 0.6, 0.65)));
  wall.style.opacity = wv.toFixed(3);
  wall.style.transform = `translateY(${(1 - wv) * 18}px)`;
  wall.style.visibility = wv < 0.01 ? "hidden" : "visible";
  if (wv > 0) {
    const [n, b, o] = world.tally(sweep);
    if (n !== lastTally) { lastTally = n; $("#n-checked").textContent = n; $("#n-blue").textContent = b; $("#n-orange").textContent = o; }
  }
  const st = (n, x, y) => a.style.setProperty(n, out3(seg(p, x, y)).toFixed(3));
  a.style.opacity = p > 0.76 ? 1 : 0;
  a.querySelectorAll(".ln > span").forEach((el, i) => { el.style.setProperty("--t", out3(seg(p, 0.77 + i * 0.03, 0.83 + i * 0.03)).toFixed(3)); });
  st("--t4", 0.87, 0.91); st("--t5", 0.89, 0.93);
  a.classList.toggle("live", p > 0.9);
}

// ---- opening, on the clock
function boot() {
  const scene = $("#scene"), off = $("#off"), line = $("#line"), bootEl = $("#boot"), strips = [...scene.querySelectorAll(".boot-strip")];
  const sw = scene.offsetWidth, sh = scene.offsetHeight, sx = (innerWidth - sw) / 2, sy = (innerHeight - sh) / 2;
  const lr = logo.getBoundingClientRect();
  const s = lr.width / (WORD.w * sw);
  const tx = lr.left - sx - WORD.x * sw * s, ty = lr.top - sy - WORD.y * sh * s;
  const T0 = performance.now();
  const step = (now) => {
    const t = (now - T0) / 1000;
    // a tube warming up: one thin line, then the letters catch one by one
    line.style.opacity = t < 0.5 ? (1 - seg(t, 0.26, 0.5)).toFixed(3) : 0;
    line.style.transform = `scaleX(${out3(seg(t, 0.02, 0.24))}) scaleY(${1 - seg(t, 0.26, 0.5)})`;
    off.style.opacity = (ease(seg(t, 0.28, 0.7)) * (0.82 + 0.18 * Math.sin(t * 61) * Math.sin(t * 23))).toFixed(3);
    const fl = seg(t, 0.55, 1.75);
    strips.forEach((el, i) => {
      const k = FLICKER[i], f = fl * (k.length - 1), j = Math.min(k.length - 2, Math.floor(f));
      const v = fl >= 1 ? 1 : lerp(k[j], k[j + 1], f - j > 0.5 ? 1 : 0);
      el.style.opacity = v.toFixed(2);
    });
    // the word shrinks and settles top left; its reflection is cut away on the way
    const sh_ = ease(seg(t, 2.0, 2.75));
    if (t > 2.0) {
      scene.style.setProperty("--cut", `${lerp(100, 58, seg(t, 2.0, 2.3))}%`);
      scene.style.translate = "0 0"; scene.style.left = sx + "px"; scene.style.top = sy + "px";
      scene.style.transform = `translate(${tx * sh_}px, ${ty * sh_}px) scale(${lerp(1, s, sh_)})`;
    }
    if (t > 2.72) { logo.style.opacity = 1; scene.style.opacity = 1 - seg(t, 2.72, 2.86); }
    // then the room arrives from below
    if (t > 2.86) {
      bootEl.style.background = "#000";
      bootEl.style.clipPath = `inset(0 0 ${ease(seg(t, 2.86, 3.5)) * 100}% 0)`;
      intro = Math.max(intro, 0.015);
    }
    if (t > 3.3) { c.classList.add("on"); nav.style.opacity = 1; statusEl.style.opacity = 1; }
    intro = Math.max(intro, ease(seg(t, 3.75, 5.0)));
    if (t < 5.05) requestAnimationFrame(step);
    else finish();
  };
  const finish = () => { intro = 1; bootEl.classList.add("done"); };
  requestAnimationFrame(step);
  setTimeout(() => lenis.start(), 3400);
  const skip = () => { removeEventListener("keydown", skip); bootEl.classList.add("done"); logo.style.opacity = 1; nav.style.opacity = 1; statusEl.style.opacity = 1; c.classList.add("on"); intro = 1; lenis.start(); };
  addEventListener("keydown", skip, { once: true });
  bootEl.addEventListener("pointerdown", skip, { once: true });
}

let closeEl = null;
function afterRender(info) {
  closeEl = $("#close");
  if (info.champModel) wreathDraw = wreath($("#wreath"), info.champModel.model);
  startLoops(lenis);
  $("#see").addEventListener("click", (e) => { e.preventDefault(); lenis.scrollTo("#proof", { duration: 2, offset: -40 }); });
}

const onResize = () => { measure(); if (world) buildKeys(); };
const onClick = (e) => {
  const a = e.target.closest?.("a");
  if (!a) return;
  if (a.hasAttribute("data-signin")) { e.preventDefault(); signIn(); }
  else if (a.hasAttribute("data-guest")) { e.preventDefault(); onGuest?.(); }
  else if (a.id === "logo") { e.preventDefault(); lenis.scrollTo(0, { duration: 1.4 }); }
  else if (a.classList.contains("skip")) { e.preventDefault(); lenis.scrollTo("#exhibits", { duration: 1.2 }); }
};
root.addEventListener("click", onClick);

async function start() {
  addEventListener("resize", onResize);
  function raf(t) { if (dead) return; lenis.raf(t); requestAnimationFrame(raf); }
  requestAnimationFrame(raf);
  const skipIntro = reduced || (() => { try { return sessionStorage.getItem("laurel-intro") && !location.search.includes("intro"); } catch { return false; } })();
  if (!skipIntro) boot();
  try { sessionStorage.setItem("laurel-intro", "1"); } catch {}
  const data = await loadData();
  if (dead) return;
  shared = data;
  world = createWorld(canvas, data);
  measure();
  if (world) buildKeys();
  afterRender(renderPage($("#rest"), data));
  // no WebGL or reduced motion: one still hero, the rest of the page unchanged
  if (!world || reduced) {
    $(".stage-track").style.height = "100svh";
    [plateS, c, wall, hint, canvas].forEach((el) => { el.style.display = "none"; });
    plateB.style.opacity = 1; a.style.opacity = 1; a.classList.add("live"); sfade.style.opacity = 1;
    ["--t4", "--t5"].forEach((n) => a.style.setProperty(n, 1));
    a.querySelectorAll(".ln > span").forEach((el) => el.style.setProperty("--t", 1));
    logo.style.setProperty("--brand", "#F4F2EC"); statusEl.style.setProperty("--brand", "#F4F2EC"); nav.style.setProperty("--brand", "#F4F2EC");
    world = null;
  }
  if (skipIntro) { $("#boot").classList.add("done"); logo.style.opacity = 1; nav.style.opacity = 1; statusEl.style.opacity = 1; c.classList.add("on"); intro = 1; lenis.start(); }
    requestAnimationFrame(frame);
}
start();
return () => {
  dead = true;
  removeEventListener("resize", onResize);
  root.removeEventListener("click", onClick);
  lenis.destroy();
  root.innerHTML = "";
};
}
