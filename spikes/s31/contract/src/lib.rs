//! S31/S30 spike contract: stores GBDT models as bytes, runs `predict` on-chain, and asks
//! OutLayer to score a model against a secret test set (proxy-contract pattern).
use gbdt_core::Model;
use near_sdk::json_types::Base64VecU8;
use near_sdk::serde_json::{json, Value};
use near_sdk::store::LookupMap;
use near_sdk::{
    env, ext_contract, near, AccountId, BorshStorageKey, Gas, NearToken, PanicOnDefault, Promise,
    PromiseError,
};

const CALLBACK_GAS: Gas = Gas::from_tgas(15);

#[ext_contract(ext_outlayer)]
trait OutLayer {
    fn request_execution(
        &mut self,
        source: Value,
        resource_limits: Value,
        input_data: String,
        secrets_ref: Option<Value>,
        response_format: String,
        payer_account_id: Option<AccountId>,
    );
}

#[derive(BorshStorageKey)]
#[near]
enum Key {
    Models,
    Scores,
}

#[near(serializers = [borsh, json])]
#[derive(Clone)]
pub struct ScoreRecord {
    pub ok: bool,
    pub raw: String,
    pub block_height: u64,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Contract {
    outlayer: AccountId,
    next_id: u32,
    models: LookupMap<u32, Vec<u8>>,
    scores: LookupMap<u32, ScoreRecord>,
}

#[near]
impl Contract {
    #[init]
    pub fn new(outlayer: AccountId) -> Self {
        Self {
            outlayer,
            next_id: 1,
            models: LookupMap::new(Key::Models),
            scores: LookupMap::new(Key::Scores),
        }
    }

    /// Store a borsh model. Caller pays storage (checked before/after) plus nothing else.
    #[payable]
    pub fn upload_model(&mut self, bytes: Base64VecU8) -> u32 {
        let before = env::storage_usage();
        let model = Model::decode(&bytes.0).unwrap_or_else(|_| env::panic_str("bad model bytes"));
        assert!(model.trees.len() <= 1_000, "too many trees");
        let id = self.next_id;
        self.next_id += 1;
        self.models.insert(id, bytes.0);
        self.models.flush();
        let used = env::storage_usage() - before;
        let cost = env::storage_byte_cost().saturating_mul(used as u128);
        let deposit = env::attached_deposit();
        assert!(deposit >= cost, "attach at least {} yoctoNEAR for {} bytes", cost.as_yoctonear(), used);
        let refund = deposit.saturating_sub(cost);
        if refund > NearToken::from_yoctonear(0) {
            Promise::new(env::predecessor_account_id()).transfer(refund);
        }
        env::log_str(&format!("model {id}: {} trees, {} nodes, {} bytes, storage {} yN", model.trees.len(), model.node_count(), used, cost.as_yoctonear()));
        id
    }

    /// Raw additive score in out_scale units. View or call (call it as a tx to measure gas).
    pub fn predict(&self, model_id: u32, features: Vec<i64>) -> i64 {
        let m = self.model(model_id);
        m.raw_score(&features).unwrap_or_else(|e| env::panic_str(&format!("{e:?}")))
    }

    pub fn predict_label(&self, model_id: u32, features: Vec<i64>) -> u8 {
        let m = self.model(model_id);
        m.predict_label(&features).unwrap_or_else(|e| env::panic_str(&format!("{e:?}")))
    }

    /// Batch: labels for many rows in one call (for gas-per-row measurement).
    pub fn predict_batch(&self, model_id: u32, rows: Vec<Vec<i64>>) -> Vec<u8> {
        let m = self.model(model_id);
        rows.iter()
            .map(|x| m.predict_label(x).unwrap_or_else(|e| env::panic_str(&format!("{e:?}"))))
            .collect()
    }

    /// Read by the OutLayer evaluator through the `view` host function.
    pub fn get_model_bytes(&self, model_id: u32) -> Base64VecU8 {
        Base64VecU8(self.models.get(&model_id).unwrap_or_else(|| env::panic_str("no such model")).clone())
    }

    pub fn model_info(&self, model_id: u32) -> Value {
        let bytes = self.models.get(&model_id).unwrap_or_else(|| env::panic_str("no such model"));
        let m = Model::decode(bytes).unwrap();
        json!({ "model_id": model_id, "trees": m.trees.len(), "nodes": m.node_count(), "n_features": m.n_features, "bytes": bytes.len() })
    }

    /// Ask OutLayer to run the published evaluator against this model. The evaluator fetches the
    /// model bytes back from this contract (`get_model_bytes`) and reads the secret test set.
    #[payable]
    pub fn request_score(
        &mut self,
        model_id: u32,
        wasm_url: String,
        wasm_hash: String,
        secrets_account: Option<AccountId>,
        secrets_profile: Option<String>,
    ) -> Promise {
        assert!(self.models.contains_key(&model_id), "no such model");
        let source = json!({ "WasmUrl": { "url": wasm_url, "hash": wasm_hash, "build_target": "wasm32-wasip2" } });
        let resource_limits = json!({ "max_instructions": 20_000_000_000u64, "max_memory_mb": 256, "max_execution_seconds": 60 });
        let input_data = json!({ "contract": env::current_account_id(), "model_id": model_id }).to_string();
        let secrets_ref = secrets_account.map(|a| json!({ "profile": secrets_profile.unwrap_or_else(|| "default".into()), "account_id": a }));
        let gas_for_outlayer = env::prepaid_gas().saturating_sub(CALLBACK_GAS).saturating_sub(Gas::from_tgas(10));
        ext_outlayer::ext(self.outlayer.clone())
            .with_attached_deposit(env::attached_deposit())
            .with_static_gas(gas_for_outlayer)
            .request_execution(source, resource_limits, input_data, secrets_ref, "Text".into(), Some(env::predecessor_account_id()))
            .then(Self::ext(env::current_account_id()).with_static_gas(CALLBACK_GAS).on_score(model_id))
    }

    #[private]
    pub fn on_score(&mut self, model_id: u32, #[callback_result] result: Result<Option<String>, PromiseError>) -> ScoreRecord {
        let rec = match result {
            Ok(Some(text)) => ScoreRecord { ok: true, raw: text, block_height: env::block_height() },
            Ok(None) => ScoreRecord { ok: false, raw: "empty output".into(), block_height: env::block_height() },
            Err(e) => ScoreRecord { ok: false, raw: format!("promise error: {e:?}"), block_height: env::block_height() },
        };
        env::log_str(&format!("score model {model_id}: ok={} raw={}", rec.ok, rec.raw));
        self.scores.insert(model_id, rec.clone());
        rec
    }

    pub fn get_score(&self, model_id: u32) -> Option<ScoreRecord> {
        self.scores.get(&model_id).cloned()
    }

    fn model(&self, model_id: u32) -> Model {
        let bytes = self.models.get(&model_id).unwrap_or_else(|| env::panic_str("no such model"));
        Model::decode(bytes).unwrap_or_else(|_| env::panic_str("corrupt model"))
    }
}
