// Borsh decoder for the integer GBDT model stored on-chain (crates/gbdt-core, model version 1), plus a tree layout
// used to draw each tree faithfully. Layout: version u8 · n_features u16 · feature_scale i64 · out_scale i64 · bias i64 ·
// trees: u32 count, each tree: u32 count of nodes, each node: feature u16 · threshold i64 · left u16 · right u16 · value i64.
export const LEAF = 0xffff;

export function decodeModel(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let o = 0;
  const u8 = () => dv.getUint8(o++);
  const u16 = () => { const v = dv.getUint16(o, true); o += 2; return v; };
  const u32 = () => { const v = dv.getUint32(o, true); o += 4; return v; };
  const i64 = () => { const v = dv.getBigInt64(o, true); o += 8; return Number(v); };
  const version = u8();
  const n_features = u16();
  const feature_scale = i64();
  const out_scale = i64();
  const bias = i64();
  const nTrees = u32();
  const trees = [];
  for (let t = 0; t < nTrees; t++) {
    const n = u32();
    const nodes = [];
    for (let i = 0; i < n; i++) nodes.push({ feature: u16(), threshold: i64(), left: u16(), right: u16(), value: i64() });
    trees.push({ nodes });
  }
  return { version, n_features, feature_scale, out_scale, bias, trees };
}

/** Depth of a tree (root = level 0). */
export function treeDepth(tree, i = 0) {
  const n = tree.nodes[i];
  if (!n || n.left === LEAF) return 0;
  return 1 + Math.max(treeDepth(tree, n.left), treeDepth(tree, n.right));
}

/** Positions in a unit box: nodes {x, y, leaf, feature, threshold, value}, edges {x1, y1, x2, y2, feature}. */
export function treeLayout(tree) {
  const depth = Math.max(1, treeDepth(tree));
  const nodes = [], edges = [];
  const leaves = (i) => { const n = tree.nodes[i]; return !n || n.left === LEAF ? 1 : leaves(n.left) + leaves(n.right); };
  const total = leaves(0);
  let cursor = 0;
  const place = (i, level) => {
    const n = tree.nodes[i];
    if (!n) return 0.5;
    const y = level / depth;
    if (n.left === LEAF) {
      const x = (cursor + 0.5) / total; cursor += 1;
      nodes.push({ x, y, leaf: true, value: n.value });
      return x;
    }
    const xl = place(n.left, level + 1);
    const xr = place(n.right, level + 1);
    const x = (xl + xr) / 2;
    nodes.push({ x, y, leaf: false, feature: n.feature, threshold: n.threshold });
    edges.push({ x1: x, y1: y, x2: xl, y2: (level + 1) / depth, feature: n.feature });
    edges.push({ x1: x, y1: y, x2: xr, y2: (level + 1) / depth, feature: n.feature });
    return x;
  };
  place(0, 0);
  return { nodes, edges, depth };
}

/** Max |leaf value| across the model, for stroke weighting. */
export function maxLeaf(model) {
  let m = 1;
  for (const t of model.trees) for (const n of t.nodes) if (n.left === LEAF) m = Math.max(m, Math.abs(n.value));
  return m;
}

export const b64ToBytes = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
