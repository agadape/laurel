// Integer GBDT model as stored on-chain by Laurel (crates/gbdt-core, borsh, model version 1), decoded and scored in
// JavaScript with the same arithmetic the contract uses, so a local prediction equals the on-chain one bit for bit.
// Layout: version u8 · n_features u16 · feature_scale i64 · out_scale i64 · bias i64 · trees: u32 count, each tree:
// u32 node count, each node: feature u16 · threshold i64 · left u16 · right u16 · value i64. A leaf has left == 0xffff.
import { createHash } from "node:crypto";

export const LEAF = 0xffff;

export function decodeModel(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let o = 0;
  const u8 = () => dv.getUint8(o++);
  const u16 = () => { const v = dv.getUint16(o, true); o += 2; return v; };
  const u32 = () => { const v = dv.getUint32(o, true); o += 4; return v; };
  const i64 = () => { const v = dv.getBigInt64(o, true); o += 8; return v; };
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
  if (o !== bytes.byteLength) throw new Error(`trailing bytes: ${bytes.byteLength - o}`);
  return { version, n_features, feature_scale, out_scale, bias, trees };
}

/** Same as gbdt-core::raw_score: bias + one leaf per tree; go left when feature <= threshold. Returns a BigInt. */
export function rawScore(model, features) {
  if (features.length !== model.n_features) throw new Error(`feature count: expected ${model.n_features}, got ${features.length}`);
  const x = features.map((v) => BigInt(Math.trunc(Number(v))));
  let acc = model.bias;
  for (const tree of model.trees) {
    let i = 0;
    for (let guard = 0; guard < 64; guard++) {
      const n = tree.nodes[i];
      if (!n) throw new Error("bad tree");
      if (n.left === LEAF) { acc += n.value; break; }
      i = x[n.feature] <= n.threshold ? n.left : n.right;
    }
  }
  return acc;
}

export const predictLabel = (model, features) => (rawScore(model, features) > 0n ? 1 : 0);

export function stats(model) {
  let nodes = 0, maxDepth = 0;
  const depth = (tree, i) => { const n = tree.nodes[i]; if (!n || n.left === LEAF) return 0; return 1 + Math.max(depth(tree, n.left), depth(tree, n.right)); };
  for (const t of model.trees) { nodes += t.nodes.length; maxDepth = Math.max(maxDepth, depth(t, 0)); }
  return { trees: model.trees.length, nodes, max_depth: maxDepth, n_features: model.n_features, out_scale: model.out_scale.toString(), bias: model.bias.toString() };
}

export const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
export const b64ToBytes = (b64) => Uint8Array.from(Buffer.from(b64, "base64"));
