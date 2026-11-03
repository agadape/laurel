//! Bursa evaluator v1 (wasm32-wasip2, runs inside OutLayer's TEE worker).
//!
//! stdin:  {"contract":"bursa.testnet","submission_id":7,"task_slug":"german-credit"}   (model_id accepted as alias)
//! env:    TEST_SET_A, TEST_SET_B — the task's private splits, injected by OutLayer secrets. Formats:
//!           {"rows":[[f1..fn,label],…]}                      (JSON, spike format)
//!           {"n":18,"b64":"<base64 of i16 LE, n+1 per row>"}  (compact)
//! stdout: ≤ 900 B JSON, see docs/ABI.md:
//!   {"ok":true,"eval_version":"1","submission_id":7,"model_bytes":…,"trees":…,
//!    "a":{"n","n_pos","tp","tn","fp","fn","bal_acc_bps","f1_bps"},"b":{…}}  |  {"ok":false,"submission_id":7,"error":"…"}
//! Scores are rounded down to 50 bps to leak less per submission.
use gbdt_core::{confusion, Confusion, Model};
use serde::Deserialize;
use std::io::{self, Read, Write};

pub const EVAL_VERSION: &str = "1";
const ROUND_BPS: u32 = 50;

#[cfg(feature = "host")]
wit_bindgen::generate!({ world: "rpc-test", path: "wit" });

#[derive(Deserialize, Default)]
struct Input {
    #[serde(default)]
    contract: String,
    #[serde(default)]
    submission_id: Option<u32>,
    #[serde(default)]
    model_id: Option<u32>,
    #[serde(default)]
    task_slug: String,
    /// Local-run only (no host): model bytes as hex.
    #[serde(default)]
    model_hex: Option<String>,
}

#[derive(Deserialize)]
#[serde(untagged)]
enum TestSet {
    Rows { rows: Vec<Vec<i64>> },
    Compact { n: usize, b64: String },
}

fn decode_split(txt: &str) -> Result<Vec<(Vec<i64>, u8)>, String> {
    let ts: TestSet = serde_json::from_str(txt).map_err(|e| format!("test set json: {e}"))?;
    let rows: Vec<Vec<i64>> = match ts {
        TestSet::Rows { rows } => rows,
        TestSet::Compact { n, b64 } => {
            use base64::Engine;
            let bytes = base64::engine::general_purpose::STANDARD.decode(b64.trim()).map_err(|e| format!("test set b64: {e}"))?;
            let per_row = (n + 1) * 2;
            if per_row == 0 || bytes.len() % per_row != 0 {
                return Err(format!("test set b64: {} bytes not a multiple of {per_row}", bytes.len()));
            }
            bytes.chunks(per_row).map(|r| r.chunks(2).map(|c| i16::from_le_bytes([c[0], c[1]]) as i64).collect()).collect()
        }
    };
    rows.into_iter()
        .map(|mut r| {
            let y = r.pop().ok_or("empty row")?;
            if y != 0 && y != 1 {
                return Err(format!("label {y} is not 0/1"));
            }
            Ok((r, y as u8))
        })
        .collect()
}

fn load_split(name: &str) -> Result<Option<Vec<(Vec<i64>, u8)>>, String> {
    match std::env::var(name) {
        Ok(txt) if !txt.trim().is_empty() => decode_split(&txt).map(Some).map_err(|e| format!("{name}: {e}")),
        _ => Ok(None),
    }
}

fn fetch_model(input: &Input, id: u32) -> Result<Vec<u8>, String> {
    if let Some(hex) = &input.model_hex {
        return (0..hex.len()).step_by(2).map(|i| u8::from_str_radix(&hex[i..i + 2], 16).map_err(|e| e.to_string())).collect();
    }
    #[cfg(feature = "host")]
    {
        if input.contract.is_empty() {
            return Err("input.contract missing".into());
        }
        let args = format!("{{\"submission_id\":{id}}}");
        let (result, error) = near::rpc::api::view(&input.contract, "get_model_bytes", &args, "");
        if !error.is_empty() {
            return Err(format!("view error: {}", &error[..error.len().min(200)]));
        }
        let b64: String = serde_json::from_str(&result).map_err(|e| format!("view result not a json string: {e}; got {}", &result[..result.len().min(80)]))?;
        use base64::Engine;
        return base64::engine::general_purpose::STANDARD.decode(b64).map_err(|e| e.to_string());
    }
    #[allow(unreachable_code)]
    Err("no model_hex and no host feature".into())
}

fn split_json(c: &Confusion) -> serde_json::Value {
    let round = |x: u32| (x / ROUND_BPS) * ROUND_BPS;
    serde_json::json!({ "n": c.n(), "n_pos": c.n_pos(), "tp": c.tp, "tn": c.tn, "fp": c.fp, "fn": c.fn_, "bal_acc_bps": round(c.bal_acc_bps()), "f1_bps": round(c.f1_bps()) })
}

fn run(input: &Input, id: u32) -> Result<serde_json::Value, String> {
    let bytes = fetch_model(input, id)?;
    let model = Model::decode(&bytes).map_err(|e| format!("decode: {e:?}"))?;
    let a = load_split("TEST_SET_A")?.ok_or("secret TEST_SET_A missing")?;
    let ca = confusion(&model, &a).map_err(|e| format!("score A: {e:?}"))?;
    let cb = match load_split("TEST_SET_B")? {
        Some(rows) => Some(confusion(&model, &rows).map_err(|e| format!("score B: {e:?}"))?),
        None => None,
    };
    Ok(serde_json::json!({
        "ok": true,
        "eval_version": EVAL_VERSION,
        "submission_id": id,
        "task_slug": input.task_slug,
        "model_bytes": bytes.len(),
        "trees": model.trees.len(),
        "a": split_json(&ca),
        "b": cb.map(|c| split_json(&c)),
        "block": std::env::var("NEAR_BLOCK_HEIGHT").unwrap_or_default(),
    }))
}

fn main() {
    let mut raw = String::new();
    io::stdin().read_to_string(&mut raw).ok();
    let input: Input = serde_json::from_str(raw.trim()).unwrap_or_default();
    let id = input.submission_id.or(input.model_id).unwrap_or(0);
    let out = match run(&input, id) {
        Ok(v) => v,
        Err(e) => serde_json::json!({ "ok": false, "eval_version": EVAL_VERSION, "submission_id": id, "error": e }),
    };
    let mut s = out.to_string();
    if s.len() > 880 {
        s.truncate(880);
    }
    print!("{s}");
    io::stdout().flush().ok();
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn compact_and_json_splits_agree() {
        // two rows, n = 2: [1, 2, label 1], [3, 4, label 0]
        let vals: Vec<i16> = vec![1, 2, 1, 3, 4, 0];
        let bytes: Vec<u8> = vals.iter().flat_map(|v| v.to_le_bytes()).collect();
        use base64::Engine;
        let b64 = base64::engine::general_purpose::STANDARD.encode(bytes);
        let compact = decode_split(&format!(r#"{{"n":2,"b64":"{b64}"}}"#)).unwrap();
        let json = decode_split(r#"{"rows":[[1,2,1],[3,4,0]]}"#).unwrap();
        assert_eq!(compact, json);
        assert_eq!(compact[0], (vec![1, 2], 1));
        assert!(decode_split(r#"{"rows":[[1,2,7]]}"#).is_err());
    }
}
