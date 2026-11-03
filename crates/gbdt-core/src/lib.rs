//! Integer-only gradient-boosted decision trees.
//!
//! The same crate is compiled into the NEAR contract (wasm32-unknown-unknown) and the
//! OutLayer evaluator (wasm32-wasip2). No floats anywhere, so both targets must agree
//! bit for bit. Model bytes are borsh; see `export.py` for the writer.
#![no_std]
extern crate alloc;

use alloc::vec::Vec;
use borsh::{BorshDeserialize, BorshSerialize};

/// A leaf has `left == LEAF`.
pub const LEAF: u16 = u16::MAX;

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, PartialEq, Eq)]
pub struct Node {
    pub feature: u16,
    /// Compared as `x[feature] <= threshold` (sklearn convention). Scaled by `Model::feature_scale`.
    pub threshold: i64,
    pub left: u16,
    pub right: u16,
    /// Leaf value, already multiplied by learning rate and `OUT_SCALE`.
    pub value: i64,
}

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, PartialEq, Eq)]
pub struct Tree {
    pub nodes: Vec<Node>,
}

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, PartialEq, Eq)]
pub struct Model {
    pub version: u8,
    pub n_features: u16,
    /// Features are passed as `round(x * feature_scale)`.
    pub feature_scale: i64,
    /// Output scale for `bias` and leaf values (e.g. 1_000_000).
    pub out_scale: i64,
    /// Initial raw score (log-odds prior for binary classification), scaled by `out_scale`.
    pub bias: i64,
    pub trees: Vec<Tree>,
}

#[derive(Debug, PartialEq, Eq)]
pub enum Error {
    Decode,
    WrongFeatureCount,
    BadTree,
    /// `validate` findings, with the tree index.
    EmptyTree(usize),
    /// A child index that is not strictly greater than its parent (cycle / forward reference) or out of range.
    BadChildIndex(usize, usize),
    FeatureOutOfRange(usize, usize),
    UnsupportedVersion(u8),
    BadScale,
    /// `bias` or a leaf value outside ±MAX_ABS_VALUE (keeps `raw_score` sums far from i64 overflow).
    ValueOutOfRange(usize, usize),
}

/// Largest |bias| / |leaf value| accepted by `validate`: 2^40 ≈ 1.1e12 (= 1.1e6 in out_scale 1e6 units).
/// 501 such terms stay below 2^49, far from i64::MAX, so a validated model can never overflow `raw_score`.
pub const MAX_ABS_VALUE: i64 = 1 << 40;

/// Facts about a validated model, for logs and the registry record.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Stats {
    pub trees: usize,
    pub nodes: usize,
    pub max_depth: usize,
}

impl Model {
    pub fn decode(bytes: &[u8]) -> Result<Model, Error> {
        Model::try_from_slice(bytes).map_err(|_| Error::Decode)
    }

    /// Structural validation for untrusted models (the registry runs this on every submission).
    /// Accepts only trees whose child indices strictly increase (as `export.py` writes them), so a walk
    /// always terminates, every feature index is below `n_features`, and scales are positive.
    pub fn validate(&self, n_features: u16) -> Result<Stats, Error> {
        if self.version != 1 {
            return Err(Error::UnsupportedVersion(self.version));
        }
        if self.n_features != n_features {
            return Err(Error::WrongFeatureCount);
        }
        if self.feature_scale <= 0 || self.out_scale <= 0 {
            return Err(Error::BadScale);
        }
        if self.bias.abs() > MAX_ABS_VALUE {
            return Err(Error::ValueOutOfRange(usize::MAX, 0));
        }
        let mut nodes = 0usize;
        let mut max_depth = 0usize;
        for (t, tree) in self.trees.iter().enumerate() {
            let len = tree.nodes.len();
            if len == 0 || len >= LEAF as usize {
                return Err(Error::EmptyTree(t));
            }
            // depth[i] = depth of node i; children come after parents, so one forward pass suffices.
            let mut depth: Vec<usize> = alloc::vec![0; len];
            for (i, n) in tree.nodes.iter().enumerate() {
                if n.left == LEAF {
                    if n.value.abs() > MAX_ABS_VALUE {
                        return Err(Error::ValueOutOfRange(t, i));
                    }
                    continue;
                }
                let (l, r) = (n.left as usize, n.right as usize);
                if l <= i || r <= i || l >= len || r >= len || n.right == LEAF {
                    return Err(Error::BadChildIndex(t, i));
                }
                if n.feature >= n_features {
                    return Err(Error::FeatureOutOfRange(t, i));
                }
                depth[l] = depth[i] + 1;
                depth[r] = depth[i] + 1;
            }
            let d = depth.iter().copied().max().unwrap_or(0);
            if d >= 64 {
                return Err(Error::BadChildIndex(t, 0));
            }
            max_depth = max_depth.max(d);
            nodes += len;
        }
        Ok(Stats { trees: self.trees.len(), nodes, max_depth })
    }

    pub fn encode(&self) -> Vec<u8> {
        borsh::to_vec(self).expect("borsh")
    }

    /// Raw additive score (bias + sum of leaf values), in `out_scale` units.
    pub fn raw_score(&self, x: &[i64]) -> Result<i64, Error> {
        if x.len() != self.n_features as usize {
            return Err(Error::WrongFeatureCount);
        }
        let mut acc: i64 = self.bias;
        for tree in &self.trees {
            let mut i: usize = 0;
            // Bounded loop: a well-formed tree is walked at most depth times; the guard
            // keeps a malicious model from spinning.
            for _ in 0..64 {
                let n = tree.nodes.get(i).ok_or(Error::BadTree)?;
                if n.left == LEAF {
                    acc = acc.checked_add(n.value).ok_or(Error::BadTree)?;
                    break;
                }
                let f = *x.get(n.feature as usize).ok_or(Error::BadTree)?;
                i = if f <= n.threshold { n.left as usize } else { n.right as usize };
            }
        }
        Ok(acc)
    }

    /// Binary label: 1 if raw score > 0 (probability > 0.5), else 0.
    pub fn predict_label(&self, x: &[i64]) -> Result<u8, Error> {
        Ok((self.raw_score(x)? > 0) as u8)
    }

    pub fn node_count(&self) -> usize {
        self.trees.iter().map(|t| t.nodes.len()).sum()
    }
}

/// Confusion counts for binary labels (positive class = 1). All metrics are integer basis points.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct Confusion {
    pub tp: u32,
    pub tn: u32,
    pub fp: u32,
    pub fn_: u32,
}

impl Confusion {
    pub fn n(&self) -> u32 {
        self.tp + self.tn + self.fp + self.fn_
    }
    pub fn n_pos(&self) -> u32 {
        self.tp + self.fn_
    }
    pub fn n_neg(&self) -> u32 {
        self.tn + self.fp
    }
    /// True-positive rate (recall of the positive class), bps. 0 when there are no positives.
    pub fn tpr_bps(&self) -> u32 {
        bps(self.tp, self.n_pos())
    }
    pub fn tnr_bps(&self) -> u32 {
        bps(self.tn, self.n_neg())
    }
    /// Balanced accuracy = (TPR + TNR) / 2. The primary metric (classes are 70/30 in German Credit).
    pub fn bal_acc_bps(&self) -> u32 {
        (self.tpr_bps() + self.tnr_bps()) / 2
    }
    /// F1 of the positive class = 2TP / (2TP + FP + FN).
    pub fn f1_bps(&self) -> u32 {
        bps(2 * self.tp, 2 * self.tp + self.fp + self.fn_)
    }
    pub fn accuracy_bps(&self) -> u32 {
        bps(self.tp + self.tn, self.n())
    }
}

fn bps(num: u32, den: u32) -> u32 {
    if den == 0 { 0 } else { ((num as u64) * 10_000 / (den as u64)) as u32 }
}

/// Confusion matrix of `model` over `rows` of `(features, label)`.
pub fn confusion(model: &Model, rows: &[(Vec<i64>, u8)]) -> Result<Confusion, Error> {
    let mut c = Confusion::default();
    for (x, y) in rows {
        match (model.predict_label(x)?, *y) {
            (1, 1) => c.tp += 1,
            (0, 0) => c.tn += 1,
            (1, _) => c.fp += 1,
            (_, _) => c.fn_ += 1,
        }
    }
    Ok(c)
}

/// Accuracy in basis points over `rows` of `(features, label)`.
pub fn accuracy_bps(model: &Model, rows: &[(Vec<i64>, u8)]) -> Result<(u32, u32), Error> {
    let mut correct: u32 = 0;
    for (x, y) in rows {
        if model.predict_label(x)? == *y {
            correct += 1;
        }
    }
    let n = rows.len() as u32;
    let bps = if n == 0 { 0 } else { ((correct as u64) * 10_000 / (n as u64)) as u32 };
    Ok((correct, bps))
}

#[cfg(test)]
mod tests {
    extern crate std;
    use super::*;
    use alloc::vec;
    use std::{fs, string::String};

    #[derive(serde::Deserialize)]
    struct Vectors {
        model_hex: String,
        rows: Vec<Row>,
    }
    #[derive(serde::Deserialize)]
    struct Row {
        x: Vec<i64>,
        raw: i64,
        label: u8,
    }

    fn hex(s: &str) -> Vec<u8> {
        (0..s.len()).step_by(2).map(|i| u8::from_str_radix(&s[i..i + 2], 16).unwrap()).collect()
    }

    #[test]
    fn tiny_handmade_tree() {
        // one tree: x0 <= 5 -> -1.0 else +2.0 ; bias 0.5 ; scale 1e6
        let m = Model {
            version: 1,
            n_features: 1,
            feature_scale: 1,
            out_scale: 1_000_000,
            bias: 500_000,
            trees: vec![Tree {
                nodes: vec![
                    Node { feature: 0, threshold: 5, left: 1, right: 2, value: 0 },
                    Node { feature: 0, threshold: 0, left: LEAF, right: LEAF, value: -1_000_000 },
                    Node { feature: 0, threshold: 0, left: LEAF, right: LEAF, value: 2_000_000 },
                ],
            }],
        };
        let bytes = m.encode();
        let m2 = Model::decode(&bytes).unwrap();
        assert_eq!(m2.raw_score(&[5]).unwrap(), -500_000);
        assert_eq!(m2.raw_score(&[6]).unwrap(), 2_500_000);
        assert_eq!(m2.predict_label(&[5]).unwrap(), 0);
        assert_eq!(m2.predict_label(&[6]).unwrap(), 1);
        assert_eq!(m2.raw_score(&[1, 2]), Err(Error::WrongFeatureCount));
        assert_eq!(m2.validate(1), Ok(Stats { trees: 1, nodes: 3, max_depth: 1 }));
        assert_eq!(m2.validate(2), Err(Error::WrongFeatureCount));
    }

    #[test]
    fn confusion_metrics() {
        // model: x0 <= 5 -> label 0, else label 1 (bias 0)
        let m = Model {
            version: 1, n_features: 1, feature_scale: 1, out_scale: 1_000_000, bias: 0,
            trees: vec![Tree { nodes: vec![
                Node { feature: 0, threshold: 5, left: 1, right: 2, value: 0 },
                Node { feature: 0, threshold: 0, left: LEAF, right: LEAF, value: -1 },
                Node { feature: 0, threshold: 0, left: LEAF, right: LEAF, value: 1 },
            ] }],
        };
        // positives: 6 (ok), 7 (ok), 3 (missed) ; negatives: 1 (ok), 2 (ok), 9 (false alarm), 4 (ok)
        let rows = vec![(vec![6], 1u8), (vec![7], 1), (vec![3], 1), (vec![1], 0), (vec![2], 0), (vec![9], 0), (vec![4], 0)];
        let c = confusion(&m, &rows).unwrap();
        assert_eq!(c, Confusion { tp: 2, tn: 3, fp: 1, fn_: 1 });
        assert_eq!(c.tpr_bps(), 6666);
        assert_eq!(c.tnr_bps(), 7500);
        assert_eq!(c.bal_acc_bps(), 7083);
        assert_eq!(c.f1_bps(), 6666);
        assert_eq!(c.accuracy_bps(), 7142);
        assert_eq!(Confusion::default().bal_acc_bps(), 0);
    }

    #[test]
    fn validate_rejects_bad_structure() {
        let leaf = |v: i64| Node { feature: 0, threshold: 0, left: LEAF, right: LEAF, value: v };
        let mk = |nodes: Vec<Node>| Model { version: 1, n_features: 2, feature_scale: 1, out_scale: 1_000_000, bias: 0, trees: vec![Tree { nodes }] };
        // backward child reference (would loop without the guard)
        let m = mk(vec![Node { feature: 0, threshold: 1, left: 0, right: 1, value: 0 }, leaf(1)]);
        assert_eq!(m.validate(2), Err(Error::BadChildIndex(0, 0)));
        // child out of range
        let m = mk(vec![Node { feature: 0, threshold: 1, left: 1, right: 5, value: 0 }, leaf(1)]);
        assert_eq!(m.validate(2), Err(Error::BadChildIndex(0, 0)));
        // feature out of range
        let m = mk(vec![Node { feature: 7, threshold: 1, left: 1, right: 2, value: 0 }, leaf(1), leaf(2)]);
        assert_eq!(m.validate(2), Err(Error::FeatureOutOfRange(0, 0)));
        // empty tree
        assert_eq!(mk(vec![]).validate(2), Err(Error::EmptyTree(0)));
        // wrong version
        let mut m = mk(vec![leaf(1)]);
        m.version = 2;
        assert_eq!(m.validate(2), Err(Error::UnsupportedVersion(2)));
        // adversarial magnitudes: a leaf or bias beyond ±2^40 is rejected (would risk raw_score overflow)
        assert_eq!(mk(vec![leaf(MAX_ABS_VALUE + 1)]).validate(2), Err(Error::ValueOutOfRange(0, 0)));
        let mut m = mk(vec![leaf(1)]);
        m.bias = -(MAX_ABS_VALUE + 1);
        assert_eq!(m.validate(2), Err(Error::ValueOutOfRange(usize::MAX, 0)));
        assert!(mk(vec![leaf(MAX_ABS_VALUE)]).validate(2).is_ok());
    }

    /// Vectors produced by export.py (Python reimplementation on the quantized model).
    /// Proves Python == Rust on the same bytes; the evaluator and the contract both use this crate.
    #[test]
    fn matches_python_vectors() {
        // Default: vectors exported by tools/export.py for the demo task; override with GBDT_VECTORS=/path.
        let path = std::env::var("GBDT_VECTORS").unwrap_or_else(|_| {
            std::format!("{}/../../tasks/german-credit/vectors.json", env!("CARGO_MANIFEST_DIR"))
        });
        let Ok(txt) = fs::read_to_string(&path) else {
            std::eprintln!("skip: {path} missing (run tools/export.py)");
            return;
        };
        let v: Vectors = serde_json::from_str(&txt).unwrap();
        let m = Model::decode(&hex(&v.model_hex)).unwrap();
        let st = m.validate(m.n_features).expect("exported model validates");
        std::eprintln!("stats: {st:?}");
        for (i, r) in v.rows.iter().enumerate() {
            assert_eq!(m.raw_score(&r.x).unwrap(), r.raw, "row {i} raw");
            assert_eq!(m.predict_label(&r.x).unwrap(), r.label, "row {i} label");
        }
        std::eprintln!("ok: {} rows, {} trees, {} nodes", v.rows.len(), m.trees.len(), m.node_count());
    }
}
