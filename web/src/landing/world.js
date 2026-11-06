// The glass wall: one WebGL2 canvas, no libraries. Every pane is one real decision tree, every star one real leaf.
// All motion lives in uniforms, so a frame costs a handful of draw calls and dragging back replays it exactly.
import { treeLayout } from "../model.js";

export const CARD = { w: 1, h: 1.62, t: 0.05 };
const PITCH = { x: 1.42, z: 2.2 };
const CELL = { w: 136, h: 220, cols: 30, rows: 13 };
const HERO_CELL = 1024;
const GRID = { cols: 10, rows: 15 };
/** Where the points sit inside the glass, in pixels of latar-balok.webp (1586×992): the plate's own perspective. */
export const PLATE = { w: 1586, h: 992, tl: [925, 112], tr: [1385, 78], bl: [926, 830], br: [1388, 856], seam: [[890, 70], [1415, 25]] };

const VS_CARD = `#version 300 es
precision highp float;
layout(location=0) in vec3 aP;
layout(location=1) in vec3 aN;
layout(location=2) in vec3 iPos;
layout(location=3) in vec4 iUv;
layout(location=4) in vec4 iData; // state, revealX, hero (-1 or index), spare
uniform mat4 uVP;
uniform float uFront, uIntro, uFade;
out vec3 vN; out vec3 vW; out vec3 vL; out vec2 vT; out float vR; out float vState; out float vX;
void main(){
  float hero = iData.z;
  float r = hero >= 0. ? clamp(uIntro*5. - hero*1.15, 0., 1.) : clamp((uFront - iData.y)/7., 0., 1.);
  r = r*r*(3.-2.*r);
  vec3 base = iPos; base.y -= (1.-r)*.9;
  vec3 w = base + vec3(aP.x*${CARD.w.toFixed(1)}, (aP.y+.5)*${CARD.h}, aP.z*${CARD.t});
  vN = aN; vW = w; vL = aP; vT = iUv.xy + vec2(aP.x+.5, .5-aP.y)*iUv.zw; vR = r*uFade; vState = iData.x; vX = iData.y;
  gl_Position = uVP*vec4(w,1.);
}`;

const FS_CARD = `#version 300 es
precision highp float;
in vec3 vN; in vec3 vW; in vec3 vL; in vec2 vT; in float vR; in float vState; in float vX;
uniform sampler2D uTree; uniform vec3 uCam; uniform float uDark, uSweep;
out vec4 o;
const vec3 BLUE=vec3(0.,.749,1.), ORANGE=vec3(1.,.478,.31);
void main(){
  vec3 V = normalize(uCam-vW);
  float chk = clamp((uSweep-vX)/2.5, 0., 1.);
  bool hero = vX < -50.;
  bool warm = vState>1.5;
  vec3 state = warm ? ORANGE : BLUE;
  float lit = vState>.5 ? chk*(vState<1.9 && warm ? .22 : 1.) : 0.;
  vec3 edge = mix(mix(vec3(.42,.74,.82), vec3(.46,.62,.7), uDark), hero ? mix(state, vec3(1.), .28) : state, lit);
  float glow = (hero || warm) ? 0. : lit;
  float a; vec3 c;
  if(abs(vN.z)>.5){
    vec2 q = vL.xy+.5;
    float d = min(min(q.x,1.-q.x)*${CARD.w.toFixed(2)}, min(q.y,1.-q.y)*${CARD.h.toFixed(2)});
    float rim = smoothstep(.014,.0,d);
    float inner = smoothstep(.06,.0,d)*.08;
    float fres = pow(1.-abs(dot(normalize(vN),V)), 3.);
    float band = smoothstep(.0,.14,fract((q.x*.7+q.y*.4)+vX*.13+uSweep*.018)-.8)*.12;
    float ink = texture(uTree, vT).a;
    vec3 inkC = mix(mix(vec3(.2,.25,.28), vec3(.7,.85,.95), uDark), state, glow);
    float body = mix(.05, .1, uDark) + glow*.1;
    vec3 tint = mix(mix(vec3(.93,.97,.98), vec3(.08,.1,.13), uDark), state, glow*.55);
    a = body + rim*.85 + inner + fres*.25 + band;
    c = tint*body + edge*(rim*.85+inner) + vec3(1.)*(fres*.25+band);
    float inkA = ink*(.5+glow*.4);
    c = mix(c, inkC, inkA); a = min(mix(a, 1., inkA), 1.);
  } else {
    float g = vN.y>.5 ? 1. : .78+.22*sin(vL.y*18.+vX);
    a = .92; c = mix(edge, vec3(1.), vN.y>.5 ? .55 : .12)*g*a;
  }
  o = vec4(c*vR, a*vR);
}`;

const VS_STAR = `#version 300 es
precision highp float;
layout(location=0) in vec3 aCard;
layout(location=1) in vec4 aUv; // u, v on the pane, then the star's final place in plate uv
layout(location=2) in vec4 aData; // state, revealX, hero, row in the grid (0..1)
layout(location=3) in float aSeed;
uniform mat4 uVP; uniform vec4 uPlate; // plate uv to ndc: scale x, scale y, offset x, offset y
uniform float uFront, uSweep, uIntro, uDots, uPx, uDotPx, uTime;
out float vState; out float vChk; out float vFlash; out float vDot; out float vR; out float vHot; out float vWave;
const float PI = 3.14159265;
void main(){
  float hero = aData.z; float seed = fract(aSeed); vHot = step(2., aSeed);
  float r = hero >= 0. ? clamp(uIntro*5. - hero*1.15 - 1., 0., 1.) : clamp((uFront - aData.y)/7., 0., 1.);
  vec3 p = aCard + vec3(aUv.x*${CARD.w.toFixed(1)}, (aUv.y+.5)*${CARD.h}, ${(CARD.t / 2 + 0.002).toFixed(3)});
  p.y -= (1.-r)*.9;
  vec4 clip = uVP*vec4(p,1.);
  float depth = max(clip.w, .5);
  float big = hero >= 0. ? 1.5 : 1.;
  float lit0 = step(.5, aData.x)*(aData.x>1.5 && aData.x<1.9 ? .4 : 1.);
  float tw = .82+.3*sin(uTime*2.3+seed*91.);
  float s = clamp(uPx*big*(40.+lit0*120.*tw)/depth, 1.8*uPx, 30.*uPx);
  // leaving the room: each star lets go on its own beat and curves into its place inside the glass
  float t = clamp(uDots*1.65 - seed*.65, 0., 1.);
  float d = t*t*t*(t*(t*6.-15.)+10.);
  vec2 from = clip.w > .1 ? clamp(clip.xy/clip.w, vec2(-2.4), vec2(2.4)) : vec2(-2.4, -.4);
  vec2 to = aUv.zw*uPlate.xy + uPlate.zw;
  vec2 dir = to - from;
  vec2 side = vec2(-dir.y, dir.x);
  vec2 ndc = mix(from, to, d) + side*sin(d*PI)*(.1+.26*seed)*(seed>.5?1.:-1.);
  gl_Position = d > 0. ? vec4(ndc, 0., 1.) : clip;
  vWave = .62+.38*sin(uTime*1.25 - aData.w*9.);
  gl_PointSize = mix(s, uPx*uDotPx*(1.+vHot*.45), smoothstep(.5,1.,d));
  float q = uSweep - aData.y;
  vState = aData.x; vChk = hero >= 0. ? clamp(uIntro*3.-1.5,0.,1.)*step(.5,aData.x) : clamp(q/2.5, 0., 1.);
  vFlash = hero >= 0. ? 0. : exp(-pow((q-.6)/1.3, 2.)); vDot = d; vR = r;
}`;

const FS_STAR = `#version 300 es
precision highp float;
in float vState; in float vChk; in float vFlash; in float vDot; in float vR; in float vHot; in float vWave;
uniform float uDark;
out vec4 o;
const vec3 BLUE=vec3(0.,.749,1.), ORANGE=vec3(1.,.478,.31);
void main(){
  float d = length(gl_PointCoord-.5)*2.;
  if(d>1.) discard;
  vec2 q = (gl_PointCoord-.5)*2.;
  vec3 state = vState>1.5 ? ORANGE : BLUE;
  float lit = vState>.5 ? vChk*(vState>1.5 && vState<1.9 ? .35 : 1.) : 0.;
  float core = 1.-smoothstep(.12,.3,d);
  float flare = (1./(1.+60.*abs(q.x*q.y)))*pow(1.-d,1.6);
  float halo = pow(1.-d,2.2)*.55 + flare*.9;
  float ring = smoothstep(.22,.36,d)*(1.-smoothstep(.5,.7,d));
  vec3 idle = mix(vec3(.22,.27,.3), vec3(.72,.86,.94), uDark);
  float idleA = mix(ring*.8, core*.55, uDark);
  vec3 c = mix(idle, mix(state, vec3(1.), core*.8), lit);
  float a = mix(idleA, min(1., core+halo), lit);
  c = mix(c, vec3(1.), vFlash*.75*(1.-uDark)); a = max(a, (core+halo)*vFlash*(1.-uDark));
  float dotA = (1.-smoothstep(.35,.62,d)) + pow(1.-d,3.)*.5;
  vec3 dotC = vHot>.5 ? ORANGE : mix(BLUE, vec3(.72,.93,1.), (1.-smoothstep(.1,.42,d))*.55);
  float settled = smoothstep(.75,1.,vDot);
  c = mix(c, dotC, settled); a = mix(a, min(1.,dotA)*(vHot>.5 ? 1. : vWave), settled);
  a *= vR;
  o = vec4(c*a, a);
}`;

const VS_SHADOW = `#version 300 es
precision highp float;
layout(location=0) in vec2 aQ;
layout(location=1) in vec3 iPos;
layout(location=2) in vec4 iData;
uniform mat4 uVP; uniform float uFront, uIntro;
out vec2 vQ; out float vR;
void main(){
  float hero = iData.z;
  float r = hero >= 0. ? clamp(uIntro*5. - hero*1.15, 0., 1.) : clamp((uFront - iData.y)/7., 0., 1.);
  vec3 w = iPos + vec3((aQ.x-.5)*${CARD.w.toFixed(1)} + aQ.y*2.5, .002, aQ.y*1.9);
  vQ = aQ; vR = r; gl_Position = uVP*vec4(w,1.);
}`;

const FS_SHADOW = `#version 300 es
precision highp float;
in vec2 vQ; in float vR;
uniform float uShadow;
out vec4 o;
void main(){
  float streak = .72+.28*sin(vQ.x*19.+vQ.y*7.);
  float a = (pow(1.-vQ.y, 2.)*.2*streak + smoothstep(.05,.0,vQ.y)*.35)*vR*uShadow*smoothstep(0.,.08,vQ.x)*smoothstep(1.,.92,vQ.x);
  o = vec4(vec3(.16,.2,.26)*a, a);
}`;

const VS_LINE = `#version 300 es
precision highp float;
layout(location=0) in vec3 aP;
layout(location=1) in float aX;
uniform mat4 uVP; uniform float uFront, uLine;
out float vR;
void main(){ vR = clamp((uFront-aX)/9.,0.,1.)*uLine; gl_Position = uVP*vec4(aP,1.); }`;

const FS_LINE = `#version 300 es
precision highp float;
in float vR; out vec4 o;
void main(){ vec3 c = vec3(.3,.36,.42); float a = vR*.62; o = vec4(c*a, a); }`;

function program(gl, vs, fs) {
  const mk = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  const p = gl.createProgram();
  gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) { const a = gl.getActiveUniform(p, i); u[a.name] = gl.getUniformLocation(p, a.name); }
  return { p, u };
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const norm = (a) => { const l = Math.hypot(...a) || 1; return a.map((x) => x / l); };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
function lookAt(e, c) {
  const z = norm(sub(e, c)), x = norm(cross([0, 1, 0], z)), y = cross(z, x);
  return [x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, e), -dot(y, e), -dot(z, e), 1];
}
function persp(fov, asp, n, f) { const t = 1 / Math.tan((fov * Math.PI) / 360); return [t / asp, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) / (n - f), -1, 0, 0, (2 * f * n) / (n - f), 0]; }
function mul(a, b) { const o = new Float32Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; } return o; }

/** Lay every real tree out on the floor: exhibits along x, models as blocks, trees as panes. */
export function layout(data) {
  const cards = [], lines = [];
  const open = new Set(data.tasks.filter((t) => !t.closed).map((t) => t.task_id));
  const lanes = [{ x: 0, z: 0 }, { x: 7, z: -14 }];
  const featured = data.tasks.filter((t) => !t.closed).pop();
  data.tasks.forEach((t, ti) => {
    const lane = t === featured ? lanes[0] : lanes[ti % 2 ? 1 : 0];
    const centers = [];
    t.models.forEach((m, mi) => {
      const L = t === featured ? lanes[mi % 2] : lane;
      const n = m.model.trees.length, cols = Math.min(8, Math.max(4, Math.ceil(Math.sqrt(n) * 1.1)));
      const state = t.winner === m.id ? 1 : open.has(t.task_id) ? (t === featured ? 2 : 1.6) : 0;
      m.model.trees.forEach((tree, i) => {
        const col = i % cols, row = Math.floor(i / cols);
        cards.push({ x: L.x + col * PITCH.x, z: L.z - row * PITCH.z, state, tree, model: m.id, task: t.task_id, hero: -1 });
      });
      const w = (cols - 1) * PITCH.x, y = CARD.h + 0.34, z = L.z + 0.04;
      lines.push([L.x, y, z, L.x + w, y, z], [L.x + w / 2, y, z, L.x + w / 2, y + 0.55, z]);
      for (let c = 0; c < cols; c++) lines.push([L.x + c * PITCH.x, CARD.h, z, L.x + c * PITCH.x, y, z]);
      if (L === lane) centers.push(L.x + w / 2);
      L.x += cols * PITCH.x + 1.5;
    });
    const y = CARD.h + 0.89, top = y + 0.5, mid = (centers[0] + centers[centers.length - 1]) / 2, z = lane.z + 0.04;
    lines.push([centers[0], y, z, centers[centers.length - 1], y, z], [mid, y, z, mid, top, z]);
    lane.x += 3;
    if (t === featured) lanes[1].x += 3;
  });
  const cursor = Math.max(lanes[0].x, lanes[1].x);
  // the four specimens of the first screen step out of their blocks: three of the champion, one still sealed
  const champion = data.tasks.filter((t) => t.closed && t.winner != null).pop();
  const fit = (c) => Math.abs(c.tree.nodes.length - 21);
  const blue = cards.filter((c) => c.model === champion.winner).sort((a, b) => fit(a) - fit(b));
  const sealed = cards.filter((c) => c.state === 2).sort((a, b) => fit(a) - fit(b));
  [blue[0], sealed[0], blue[1], blue[2]].forEach((c, i) => { c.hero = i; c.x = -1.0 + i * 1.55; c.z = 5; });
  return { cards, lines, length: cursor };
}

function drawTree(g, tree, x, y, w, h, lw, r) {
  const { nodes, edges } = treeLayout(tree);
  const px = (u) => x + (0.14 + u * 0.72) * w, py = (v) => y + (0.14 + v * 0.72) * h;
  g.lineWidth = lw; g.beginPath();
  for (const e of edges) { g.moveTo(px(e.x1), py(e.y1)); g.lineTo(px(e.x2), py(e.y2)); }
  g.stroke();
  for (const n of nodes) if (!n.leaf) { g.beginPath(); g.arc(px(n.x), py(n.y), r, 0, 7); g.stroke(); }
}

const mix2 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
/** A grid cell's place on the plate, in plate uv, following the glass's own perspective. */
function gridUv(gi) {
  const col = gi % GRID.cols, row = Math.floor(gi / GRID.cols);
  const u = (col + 0.5) / GRID.cols, v = (row + 0.5) / GRID.rows;
  const p = mix2(mix2(PLATE.tl, PLATE.tr, u), mix2(PLATE.bl, PLATE.br, u), v);
  return [p[0] / PLATE.w, p[1] / PLATE.h, v];
}

export function createWorld(canvas, data) {
  const gl = canvas.getContext("webgl2", { alpha: true, antialias: true, premultipliedAlpha: true, powerPreference: "high-performance" });
  if (!gl) return null;
  const world = layout(data);
  // back to front: far rows first, so glass composites correctly as the camera passes
  const cards = world.cards.slice().sort((a, b) => a.z - b.z || b.x - a.x);
  const atlas = document.createElement("canvas"); atlas.width = 4096; atlas.height = HERO_CELL + CELL.h * CELL.rows;
  const g = atlas.getContext("2d");
  g.strokeStyle = "#fff"; g.lineCap = "round";
  const stars = [];
  const hotTree = cards.find((c) => c.state === 2 && c.hero >= 0)?.tree;
  let slot = 0;
  const cardData = new Float32Array(cards.length * 11);
  cards.forEach((c, i) => {
    let ax, ay, aw, ah;
    if (c.hero >= 0) { ah = HERO_CELL; aw = Math.round(HERO_CELL / 1.62); ax = c.hero * (aw + 8); ay = 0; drawTree(g, c.tree, ax, ay, aw, ah, 2.2, 6); }
    else { const col = slot % CELL.cols, row = Math.floor(slot / CELL.cols); slot++; aw = CELL.w; ah = CELL.h; ax = col * CELL.w; ay = HERO_CELL + row * CELL.h; drawTree(g, c.tree, ax, ay, aw, ah, 1.2, 1.9); }
    const revealX = c.hero >= 0 ? -100 : c.x;
    cardData.set([c.x, 0, c.z, ax / atlas.width, ay / atlas.height, aw / atlas.width, ah / atlas.height, c.state, revealX, c.hero, 0], i * 11);
    for (const n of treeLayout(c.tree).nodes) {
      if (!n.leaf) continue;
      const k = stars.length / 12;
      const hot = c.tree === hotTree;
      const gi = hot ? 67 : ((k * 2654435761) >>> 0) % (GRID.cols * GRID.rows);
      const [px, py, row] = gridUv(gi);
      stars.push(c.x, 0, c.z, (0.14 + n.x * 0.72) - 0.5, 0.5 - (0.14 + n.y * 0.72), px, py, c.state, revealX, c.hero, row, ((k * 0.61803) % 1) + (hot ? 2 : 0));
    }
  });

  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  const aniso = gl.getExtension("EXT_texture_filter_anisotropic");
  if (aniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, 8);

  const box = [];
  const face = (n, a, b) => { // two triangles on the plane spanned by a and b, centred on n/2
    for (const [s, t] of [[-1, -1], [1, -1], [1, 1], [-1, -1], [1, 1], [-1, 1]])
      box.push(...[0, 1, 2].map((k) => (n[k] + s * a[k] + t * b[k]) * 0.5), ...n);
  };
  face([0, 0, 1], [1, 0, 0], [0, 1, 0]); face([0, 0, -1], [-1, 0, 0], [0, 1, 0]);
  face([1, 0, 0], [0, 0, -1], [0, 1, 0]); face([-1, 0, 0], [0, 0, 1], [0, 1, 0]);
  face([0, 1, 0], [1, 0, 0], [0, 0, -1]); face([0, -1, 0], [1, 0, 0], [0, 0, 1]);

  const cardP = program(gl, VS_CARD, FS_CARD), starP = program(gl, VS_STAR, FS_STAR), shadowP = program(gl, VS_SHADOW, FS_SHADOW), lineP = program(gl, VS_LINE, FS_LINE);
  const buffer = (d) => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, d, gl.STATIC_DRAW); return b; };
  const attr = (loc, size, stride, off, div = 0) => { gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride, off); gl.vertexAttribDivisor(loc, div); };

  const boxB = buffer(new Float32Array(box)), instB = buffer(cardData);
  const cardVao = gl.createVertexArray(); gl.bindVertexArray(cardVao);
  gl.bindBuffer(gl.ARRAY_BUFFER, boxB); attr(0, 3, 24, 0); attr(1, 3, 24, 12);
  gl.bindBuffer(gl.ARRAY_BUFFER, instB); attr(2, 3, 44, 0, 1); attr(3, 4, 44, 12, 1); attr(4, 4, 44, 28, 1);

  const starVao = gl.createVertexArray(); gl.bindVertexArray(starVao);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer(new Float32Array(stars)));
  attr(0, 3, 48, 0); attr(1, 4, 48, 12); attr(2, 4, 48, 28); attr(3, 1, 48, 44);

  const quadB = buffer(new Float32Array([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1]));
  const shadowVao = gl.createVertexArray(); gl.bindVertexArray(shadowVao);
  gl.bindBuffer(gl.ARRAY_BUFFER, quadB); attr(0, 2, 8, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, instB); attr(1, 3, 44, 0, 1); attr(2, 4, 44, 28, 1);

  const lineData = [];
  for (const [a, b, c, d, e, f] of world.lines) lineData.push(a, b, c, a, d, e, f, a);
  const lineVao = gl.createVertexArray(); gl.bindVertexArray(lineVao);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer(new Float32Array(lineData)));
  attr(0, 3, 16, 0); attr(1, 1, 16, 12);
  gl.bindVertexArray(null);

  gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE);
  gl.clearColor(0, 0, 0, 0);

  let dpr = 1;
  const resize = () => {
    const css = canvas.clientWidth * canvas.clientHeight;
    // never more than about 2.6 million pixels: the wall is detail, not a place to spend a laptop's whole GPU
    dpr = Math.min(window.devicePixelRatio || 1, 1.5, Math.sqrt(2600000 / Math.max(1, css)));
    const w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    gl.viewport(0, 0, canvas.width, canvas.height);
  };

  const vpOf = (eye, look, fov) => mul(persp(fov, canvas.width / canvas.height, 0.1, 400), lookAt(eye, look));
  const set = (P, s) => {
    gl.useProgram(P.p);
    const u = P.u, f = (n, v) => { if (u[n] != null) gl.uniform1f(u[n], v); };
    if (u.uVP != null) gl.uniformMatrix4fv(u.uVP, false, s.vp);
    if (u.uCam != null) gl.uniform3fv(u.uCam, s.eye);
    if (u.uPlate != null) gl.uniform4fv(u.uPlate, s.plate);
    for (const k of ["Front", "Sweep", "Intro", "Dots", "Dark", "Time", "Fade", "Shadow", "Line"]) f("u" + k, s[k.toLowerCase()]);
    f("uPx", dpr); f("uDotPx", s.dotPx);
    if (u.uTree != null) gl.uniform1i(u.uTree, 0);
  };

  /** s: { eye, look, fov, plate, dotPx, front, sweep, intro, dots, dark, time, fade, shadow, line } */
  const draw = (s) => {
    s.vp = vpOf(s.eye, s.look, s.fov);
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (s.fade > 0.003) {
      if (s.shadow > 0.01) { set(shadowP, s); gl.bindVertexArray(shadowVao); gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, cards.length); }
      set(cardP, s); gl.bindVertexArray(cardVao);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 36, cards.length);
      if (s.line > 0.003) { set(lineP, s); gl.bindVertexArray(lineVao); gl.drawArrays(gl.LINES, 0, lineData.length / 4); }
    }
    set(starP, s); gl.bindVertexArray(starVao); gl.drawArrays(gl.POINTS, 0, stars.length / 12);
  };

  return { vpOf, draw, resize, length: world.length, tally: (x) => { let n = 0, b = 0, o = 0; for (const c of cards) if (c.hero >= 0 || c.x <= x) { n++; if (c.state === 1) b++; else if (c.state >= 1.5) o++; } return [n, b, o]; }, count: { cards: cards.length, stars: stars.length / 12, blue: cards.filter((c) => c.state === 1).length, orange: cards.filter((c) => c.state >= 1.5).length, models: new Set(cards.map((c) => c.model)).size } };
}
