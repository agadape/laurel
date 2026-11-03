//! OutLayer evaluator (wasm32-wasip2). Reads `{"contract":..,"model_id":..}` from stdin, fetches the
//! model bytes from the NEAR contract via the `view` host function, scores it against the secret test
//! sets in env (`TEST_SET_A`, `TEST_SET_B`, injected by OutLayer secrets) and prints <= 900 bytes JSON.
use gbdt_core::{accuracy_bps, Model};
use serde::Deserialize;
use std::io::{self, Read, Write};

#[cfg(feature = "host")]
wit_bindgen::generate!({ world: "rpc-test", path: "wit" });

#[derive(Deserialize)]
struct Input {
    #[serde(default)]
    contract: String,
    #[serde(default)]
    model_id: u32,
    /// Local-run only (no host): model bytes as hex.
    #[serde(default)]
    model_hex: Option<String>,
}

#[derive(Deserialize)]
struct TestSet {
    rows: Vec<Vec<i64>>,
}

fn load_split(name: &str) -> Option<Vec<(Vec<i64>, u8)>> {
    let txt = std::env::var(name).ok()?;
    let ts: TestSet = serde_json::from_str(&txt).ok()?;
    Some(ts.rows.into_iter().map(|mut r| { let y = r.pop().unwrap_or(0) as u8; (r, y) }).collect())
}

fn fetch_model(input: &Input) -> Result<Vec<u8>, String> {
    if let Some(hex) = &input.model_hex {
        return (0..hex.len()).step_by(2).map(|i| u8::from_str_radix(&hex[i..i + 2], 16).map_err(|e| e.to_string())).collect();
    }
    #[cfg(feature = "host")]
    {
        let args = format!("{{\"model_id\":{}}}", input.model_id);
        let (result, error) = near::rpc::api::view(&input.contract, "get_model_bytes", &args, "");
        if !error.is_empty() {
            return Err(format!("view error: {error}"));
        }
        // view returns the method's JSON result: a base64 string in quotes
        let b64: String = serde_json::from_str(&result).map_err(|e| format!("view result not a json string: {e}; got {}", &result[..result.len().min(80)]))?;
        use base64::Engine;
        return base64::engine::general_purpose::STANDARD.decode(b64).map_err(|e| e.to_string());
    }
    #[allow(unreachable_code)]
    Err("no model_hex and no host feature".into())
}

fn main() {
    let mut raw = String::new();
    io::stdin().read_to_string(&mut raw).ok();
    let input: Input = serde_json::from_str(raw.trim()).unwrap_or(Input { contract: String::new(), model_id: 0, model_hex: None });

    let out = match run(&input) {
        Ok(v) => v,
        Err(e) => serde_json::json!({ "ok": false, "model_id": input.model_id, "error": e }),
    };
    let s = out.to_string();
    let s = if s.len() > 880 { s[..880].to_string() } else { s };
    print!("{s}");
    io::stdout().flush().ok();
}

fn run(input: &Input) -> Result<serde_json::Value, String> {
    let bytes = fetch_model(input)?;
    let model = Model::decode(&bytes).map_err(|e| format!("decode: {e:?}"))?;
    let a = load_split("TEST_SET_A").ok_or("secret TEST_SET_A missing")?;
    let (ca, bps_a) = accuracy_bps(&model, &a).map_err(|e| format!("score A: {e:?}"))?;
    let b = load_split("TEST_SET_B");
    let (cb, bps_b, nb) = match &b {
        Some(rows) => { let (c, bps) = accuracy_bps(&model, rows).map_err(|e| format!("score B: {e:?}"))?; (c, bps, rows.len()) }
        None => (0, 0, 0),
    };
    // Round to 50 bps to leak less per submission.
    let round = |x: u32| (x / 50) * 50;
    Ok(serde_json::json!({
        "ok": true,
        "eval_build": option_env!("EVAL_BUILD_TAG").unwrap_or("v1"),
        "model_id": input.model_id,
        "model_bytes": bytes.len(),
        "trees": model.trees.len(),
        "a": { "n": a.len(), "correct": ca, "score_bps": round(bps_a) },
        "b": { "n": nb, "correct": cb, "score_bps": round(bps_b) },
        "sender": std::env::var("NEAR_SENDER_ID").unwrap_or_default(),
        "block": std::env::var("NEAR_BLOCK_HEIGHT").unwrap_or_default(),
    }))
}
