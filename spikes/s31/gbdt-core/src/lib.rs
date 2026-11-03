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
}

impl Model {
    pub fn decode(bytes: &[u8]) -> Result<Model, Error> {
        Model::try_from_slice(bytes).map_err(|_| Error::Decode)
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
    }

    /// Vectors produced by export.py (Python reimplementation on the quantized model).
    /// Proves Python == Rust on the same bytes; the evaluator and the contract both use this crate.
    #[test]
    fn matches_python_vectors() {
        let path = concat!(env!("CARGO_MANIFEST_DIR"), "/../out/vectors.json");
        let Ok(txt) = fs::read_to_string(path) else {
            std::eprintln!("skip: {path} missing (run export.py)");
            return;
        };
        let v: Vectors = serde_json::from_str(&txt).unwrap();
        let m = Model::decode(&hex(&v.model_hex)).unwrap();
        for (i, r) in v.rows.iter().enumerate() {
            assert_eq!(m.raw_score(&r.x).unwrap(), r.raw, "row {i} raw");
            assert_eq!(m.predict_label(&r.x).unwrap(), r.label, "row {i} label");
        }
        std::eprintln!("ok: {} rows, {} trees, {} nodes", v.rows.len(), m.trees.len(), m.node_count());
    }
}
