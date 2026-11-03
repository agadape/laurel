//! Laurel registry contract (codename `bursa`).
//!
//! ABI: `docs/ABI.md`. Tasks, submissions, OutLayer scoring, closing/winner, prepaid inference (C-1 … C-5).
use gbdt_core::{Model, Node, Tree, LEAF};
use near_sdk::json_types::{Base64VecU8, U64};
use near_sdk::serde_json::{json, Value};
use near_sdk::store::{LookupMap, Vector};
use near_sdk::{env, ext_contract, near, AccountId, BorshStorageKey, Gas, NearToken, PanicOnDefault, Promise, PromiseError};

pub mod events;

/// Gas reserved for `on_score`; the rest of the prepaid gas goes to OutLayer.
pub const CALLBACK_GAS: Gas = Gas::from_tgas(15);
/// Minimum deposit forwarded to OutLayer with a score request (S30 charged ~0.0011 NEAR; the rest is refunded by OutLayer).
pub const MIN_SCORE_DEPOSIT: NearToken = NearToken::from_millinear(50);
/// Resource limits sent to OutLayer (S30 used 21 M instructions / 550 ms for 2×45 rows).
const OUTLAYER_MAX_INSTRUCTIONS: u64 = 20_000_000_000;
const OUTLAYER_MAX_MEMORY_MB: u32 = 256;
const OUTLAYER_MAX_SECONDS: u32 = 60;
/// Evaluator output is ≤ 900 bytes; keep at most this much on-chain.
const MAX_RAW_LEN: usize = 900;

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

/// Hard limits (see PLAN.md §2.3).
pub const MAX_MODEL_BYTES: usize = 250 * 1024;
pub const MAX_TREES: usize = 500;
/// A `Pending` score older than this many blocks may be requested again (OutLayer yield timeout is 200).
pub const PENDING_TIMEOUT_BLOCKS: u64 = 300;
pub const MAX_FEATURES: u16 = 64;
pub const MAX_SLUG_LEN: usize = 40;
pub const MAX_TITLE_LEN: usize = 80;

#[derive(BorshStorageKey)]
#[near]
enum Key {
    Tasks,
    TaskIds,
    Slugs,
    Submissions,
    ModelBytes,
    TaskSubmissionsIndex,
    TaskSubmissions { task_id: u32 },
    PerAccount,
    Credit,
    Earnings,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, PartialEq)]
pub enum Status {
    Uploaded,
    Pending { requested_at_block: u64 },
    Scored,
    Failed { reason: String },
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub struct Task {
    pub task_id: u32,
    pub creator: AccountId,
    pub title: String,
    pub slug: String,
    pub description_url: String,
    pub n_features: u16,
    pub feature_names: Vec<String>,
    pub secrets_account: AccountId,
    pub secrets_profile: String,
    pub deadline_ns: U64,
    pub fee_per_call: NearToken,
    pub submission_fee: NearToken,
    pub max_per_account: u8,
    pub winner: Option<u32>,
    pub closed: bool,
    pub created_at_ns: U64,
    pub submission_count: u32,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub struct Submission {
    pub submission_id: u32,
    pub task_id: u32,
    pub owner: AccountId,
    pub model_hash: Base64VecU8,
    pub bytes: u32,
    pub trees: u16,
    pub nodes: u32,
    pub submitted_at_ns: U64,
    pub status: Status,
    /// Balanced accuracy in basis points (split A = public leaderboard, split B = final ranking).
    pub score_a_bps: Option<u32>,
    pub score_b_bps: Option<u32>,
    /// F1 of the positive class, informational only.
    pub f1_a_bps: Option<u32>,
    pub f1_b_bps: Option<u32>,
    pub calls: u64,
    pub last_outlayer_raw: Option<String>,
    /// sha256 of the evaluator wasm that produced the stored scores (set on `Scored`).
    pub scored_by: Option<String>,
}

#[near(serializers = [json])]
pub struct LeaderboardRow {
    pub submission_id: u32,
    pub owner: AccountId,
    pub score_a_bps: Option<u32>,
    pub f1_a_bps: Option<u32>,
    /// Only filled after the task is closed.
    pub score_b_bps: Option<u32>,
    pub bytes: u32,
    pub trees: u16,
    pub status: Status,
    pub calls: u64,
}

#[near(serializers = [json])]
pub struct Config {
    pub owner: AccountId,
    pub outlayer: AccountId,
    pub evaluator_url: String,
    pub evaluator_hash: String,
    pub max_model_bytes: u32,
    pub max_trees: u32,
    pub pending_timeout_blocks: u64,
    pub task_count: u32,
    pub submission_count: u32,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Contract {
    owner: AccountId,
    outlayer: AccountId,
    evaluator_url: String,
    evaluator_hash: String,
    next_task: u32,
    next_submission: u32,
    tasks: LookupMap<u32, Task>,
    task_ids: Vector<u32>,
    slugs: LookupMap<String, u32>,
    submissions: LookupMap<u32, Submission>,
    model_bytes: LookupMap<u32, Vec<u8>>,
    task_submissions: LookupMap<u32, Vector<u32>>,
    per_account_count: LookupMap<(u32, AccountId), u8>,
    credit: LookupMap<AccountId, NearToken>,
    earnings: LookupMap<u32, NearToken>,
}

fn truncate(s: &str, max: usize) -> String {
    if s.len() <= max {
        return s.to_string();
    }
    let mut end = max;
    while !s.is_char_boundary(end) {
        end -= 1;
    }
    s[..end].to_string()
}

/// Scores parsed from the evaluator's JSON. Split B is optional (the spike evaluator always sends it).
#[derive(Debug, PartialEq, Eq)]
pub struct ParsedScores {
    pub a_bps: u32,
    pub a_f1: Option<u32>,
    pub b_bps: Option<u32>,
    pub b_f1: Option<u32>,
}

/// Accepts the ABI format (`a.bal_acc_bps`, `a.f1_bps`) and the S30 spike format (`a.score_bps`).
pub fn parse_evaluator_output(text: &str) -> Result<ParsedScores, String> {
    let v: Value = near_sdk::serde_json::from_str(text.trim()).map_err(|e| format!("evaluator output is not JSON: {e}"))?;
    if v.get("ok").and_then(Value::as_bool) != Some(true) {
        let err = v.get("error").and_then(Value::as_str).unwrap_or("evaluator returned ok:false");
        return Err(format!("evaluator: {err}"));
    }
    let bps = |split: &str, key: &str| -> Option<u32> { v.get(split)?.get(key)?.as_u64().map(|x| x.min(10_000) as u32) };
    let a_bps = bps("a", "bal_acc_bps").or_else(|| bps("a", "score_bps")).ok_or("evaluator output missing a.bal_acc_bps")?;
    Ok(ParsedScores {
        a_bps,
        a_f1: bps("a", "f1_bps"),
        b_bps: bps("b", "bal_acc_bps").or_else(|| bps("b", "score_bps")),
        b_f1: bps("b", "f1_bps"),
    })
}

/// Charge exactly the storage used since `before` plus `fee` from the attached deposit; refund the rest.
/// `fee` is forwarded to `fee_to` (if any). Panics with `storage deposit: …` when the deposit is too small.
/// Returns the storage cost charged.
fn settle_storage(before: u64, fee: NearToken, fee_to: Option<AccountId>) -> NearToken {
    let after = env::storage_usage();
    let used = after.saturating_sub(before);
    let cost = env::storage_byte_cost().saturating_mul(used as u128);
    let need = cost.saturating_add(fee);
    let deposit = env::attached_deposit();
    assert!(
        deposit >= need,
        "storage deposit: need {} yoctoNEAR ({} bytes storage + {} fee), attached {}",
        need.as_yoctonear(),
        used,
        fee.as_yoctonear(),
        deposit.as_yoctonear()
    );
    if fee.as_yoctonear() > 0 {
        if let Some(to) = fee_to {
            Promise::new(to).transfer(fee);
        }
    }
    let refund = deposit.saturating_sub(need);
    if refund.as_yoctonear() > 0 {
        Promise::new(env::predecessor_account_id()).transfer(refund);
    }
    cost
}

#[near]
impl Contract {
    // ---------- admin ----------

    #[init]
    pub fn new(owner: AccountId, outlayer: AccountId, evaluator_url: String, evaluator_hash: String) -> Self {
        Self {
            owner,
            outlayer,
            evaluator_url,
            evaluator_hash,
            next_task: 1,
            next_submission: 1,
            tasks: LookupMap::new(Key::Tasks),
            task_ids: Vector::new(Key::TaskIds),
            slugs: LookupMap::new(Key::Slugs),
            submissions: LookupMap::new(Key::Submissions),
            model_bytes: LookupMap::new(Key::ModelBytes),
            task_submissions: LookupMap::new(Key::TaskSubmissionsIndex),
            per_account_count: LookupMap::new(Key::PerAccount),
            credit: LookupMap::new(Key::Credit),
            earnings: LookupMap::new(Key::Earnings),
        }
    }

    /// Owner only. Changes the pinned evaluator (URL may change, e.g. FastFS ↔ Vercel; hash is the gate).
    pub fn set_evaluator(&mut self, url: String, hash: String) {
        self.assert_owner();
        assert!(hash.len() == 64 && hash.bytes().all(|b| b.is_ascii_hexdigit()), "hash must be 64 hex chars");
        assert!(url.starts_with("https://"), "url must be https");
        self.evaluator_url = url;
        self.evaluator_hash = hash.to_ascii_lowercase();
        events::emit("evaluator_set", json!({ "url": self.evaluator_url, "hash": self.evaluator_hash }));
    }

    // ---------- tasks (C-1) ----------

    /// Publish a model challenge. Caller pays the storage of the task record (excess refunded).
    #[payable]
    #[allow(clippy::too_many_arguments)]
    pub fn create_task(
        &mut self,
        title: String,
        slug: String,
        description_url: String,
        n_features: u16,
        feature_names: Vec<String>,
        secrets_account: AccountId,
        secrets_profile: String,
        deadline_ns: U64,
        fee_per_call: NearToken,
        submission_fee: NearToken,
        max_per_account: u8,
    ) -> u32 {
        let before = env::storage_usage();
        let now = env::block_timestamp();
        assert!(!title.is_empty() && title.len() <= MAX_TITLE_LEN, "title: 1..={MAX_TITLE_LEN} bytes");
        assert!(
            !slug.is_empty() && slug.len() <= MAX_SLUG_LEN && slug.bytes().all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-'),
            "slug: lowercase letters, digits, '-' only"
        );
        assert!(!self.slugs.contains_key(&slug), "slug taken");
        assert!(n_features >= 1 && n_features <= MAX_FEATURES, "n_features: 1..={MAX_FEATURES}");
        assert!(feature_names.len() == n_features as usize, "n_features mismatch: {} names for {} features", feature_names.len(), n_features);
        assert!(deadline_ns.0 > now, "deadline in the past");
        assert!(max_per_account >= 1, "max_per_account >= 1");
        assert!(!secrets_profile.is_empty(), "secrets_profile required");

        let task_id = self.next_task;
        self.next_task += 1;
        let task = Task {
            task_id,
            creator: env::predecessor_account_id(),
            title,
            slug: slug.clone(),
            description_url,
            n_features,
            feature_names,
            secrets_account,
            secrets_profile,
            deadline_ns,
            fee_per_call,
            submission_fee,
            max_per_account,
            winner: None,
            closed: false,
            created_at_ns: U64(now),
            submission_count: 0,
        };
        self.tasks.insert(task_id, task.clone());
        self.task_ids.push(task_id);
        self.slugs.insert(slug.clone(), task_id);
        self.task_submissions.insert(task_id, Vector::new(Key::TaskSubmissions { task_id }));
        self.tasks.flush();
        self.task_ids.flush();
        self.slugs.flush();
        self.task_submissions.flush();
        settle_storage(before, NearToken::from_yoctonear(0), None);
        events::emit("task_created", json!({ "task_id": task_id, "creator": task.creator, "slug": slug, "deadline_ns": deadline_ns }));
        task_id
    }

    // ---------- submissions (C-2) ----------

    /// Submit a borsh `gbdt-core` model to an open task. Deposit = model storage + `submission_fee`
    /// (fee goes to the task creator); the excess is refunded. Returns the submission id (status `Uploaded`).
    #[payable]
    pub fn submit_model(&mut self, task_id: u32, bytes: Base64VecU8) -> u32 {
        let before = env::storage_usage();
        let now = env::block_timestamp();
        let owner = env::predecessor_account_id();
        let mut task = self.tasks.get(&task_id).cloned().unwrap_or_else(|| env::panic_str("no such task"));
        assert!(!task.closed, "task closed");
        assert!(now < task.deadline_ns.0, "deadline passed");
        let key = (task_id, owner.clone());
        let count = self.per_account_count.get(&key).copied().unwrap_or(0);
        assert!(count < task.max_per_account, "quota: {} submissions per account", task.max_per_account);

        let (model, stats) = Self::check_model(&bytes.0, task.n_features);

        let submission_id = self.next_submission;
        self.next_submission += 1;
        let sub = Submission {
            submission_id,
            task_id,
            owner: owner.clone(),
            model_hash: Base64VecU8(env::sha256(&bytes.0)),
            bytes: bytes.0.len() as u32,
            trees: stats.trees as u16,
            nodes: stats.nodes as u32,
            submitted_at_ns: U64(now),
            status: Status::Uploaded,
            score_a_bps: None,
            score_b_bps: None,
            f1_a_bps: None,
            f1_b_bps: None,
            calls: 0,
            last_outlayer_raw: None,
            scored_by: None,
        };
        self.model_bytes.insert(submission_id, bytes.0);
        self.submissions.insert(submission_id, sub);
        self.per_account_count.insert(key, count + 1);
        task.submission_count += 1;
        self.tasks.insert(task_id, task.clone());
        let list = self.task_submissions.get_mut(&task_id).unwrap_or_else(|| env::panic_str("task index missing"));
        list.push(submission_id);
        list.flush();
        self.model_bytes.flush();
        self.submissions.flush();
        self.per_account_count.flush();
        self.tasks.flush();
        self.task_submissions.flush();

        let storage_cost = settle_storage(before, task.submission_fee, Some(task.creator.clone()));
        events::emit(
            "model_submitted",
            json!({ "submission_id": submission_id, "task_id": task_id, "owner": owner, "bytes": model.encode().len(), "trees": stats.trees, "nodes": stats.nodes, "max_depth": stats.max_depth, "storage_cost": storage_cost }),
        );
        submission_id
    }

    /// Decode + validate untrusted model bytes against a task's feature count and the registry limits.
    fn check_model(bytes: &[u8], n_features: u16) -> (Model, gbdt_core::Stats) {
        assert!(!bytes.is_empty() && bytes.len() <= MAX_MODEL_BYTES, "invalid model: size {} not in 1..={}", bytes.len(), MAX_MODEL_BYTES);
        let model = Model::decode(bytes).unwrap_or_else(|e| env::panic_str(&format!("invalid model: decode {e:?}")));
        assert!(model.trees.len() <= MAX_TREES, "invalid model: {} trees > {}", model.trees.len(), MAX_TREES);
        let stats = model.validate(n_features).unwrap_or_else(|e| env::panic_str(&format!("invalid model: {e:?}")));
        (model, stats)
    }

    // ---------- scoring via OutLayer (C-3) ----------

    /// Ask OutLayer to run the pinned evaluator against this submission. Owner of the submission only.
    /// Allowed from `Uploaded`, `Failed`, or a `Pending` older than `PENDING_TIMEOUT_BLOCKS`.
    /// Deposit (≥ 0.05 NEAR) is forwarded to OutLayer, which refunds the unused part to the caller.
    #[payable]
    pub fn request_score(&mut self, submission_id: u32) -> Promise {
        let deposit = env::attached_deposit();
        assert!(deposit >= MIN_SCORE_DEPOSIT, "deposit: at least {} yoctoNEAR", MIN_SCORE_DEPOSIT.as_yoctonear());
        let caller = env::predecessor_account_id();
        let sub = self.submissions.get_mut(&submission_id).unwrap_or_else(|| env::panic_str("no such submission"));
        assert_eq!(sub.owner, caller, "owner only");
        let block = env::block_height();
        let requestable = match &sub.status {
            Status::Uploaded | Status::Failed { .. } => true,
            Status::Pending { requested_at_block } => block >= requested_at_block.saturating_add(PENDING_TIMEOUT_BLOCKS),
            Status::Scored => false,
        };
        assert!(requestable, "not requestable: status {:?}", sub.status);
        let task_id = sub.task_id;
        let task = self.tasks.get(&task_id).cloned().unwrap_or_else(|| env::panic_str("no such task"));
        assert!(!task.closed, "task closed");
        sub.status = Status::Pending { requested_at_block: block };
        self.submissions.flush();
        events::emit("score_requested", json!({ "submission_id": submission_id, "task_id": task_id, "by": caller, "evaluator_hash": self.evaluator_hash }));

        let source = json!({ "WasmUrl": { "url": self.evaluator_url, "hash": self.evaluator_hash, "build_target": "wasm32-wasip2" } });
        let resource_limits = json!({ "max_instructions": OUTLAYER_MAX_INSTRUCTIONS, "max_memory_mb": OUTLAYER_MAX_MEMORY_MB, "max_execution_seconds": OUTLAYER_MAX_SECONDS });
        // `model_id` duplicates `submission_id` for the S30 spike evaluator.
        let input_data = json!({ "contract": env::current_account_id(), "submission_id": submission_id, "model_id": submission_id, "task_slug": task.slug }).to_string();
        let secrets_ref = json!({ "profile": task.secrets_profile, "account_id": task.secrets_account });
        let gas_for_outlayer = env::prepaid_gas().saturating_sub(CALLBACK_GAS).saturating_sub(Gas::from_tgas(25));
        ext_outlayer::ext(self.outlayer.clone())
            .with_attached_deposit(deposit)
            .with_static_gas(gas_for_outlayer)
            .request_execution(source, resource_limits, input_data, Some(secrets_ref), "Text".into(), Some(caller.clone()))
            .then(Self::ext(env::current_account_id()).with_static_gas(CALLBACK_GAS).on_score(submission_id, caller, deposit))
    }

    /// Settles a score request. Idempotent: only a `Pending` submission changes state.
    /// `payer`/`deposit`: when the OutLayer call itself fails (promise error), the deposit bounced back to this
    /// contract, so it is returned to the payer here. Worker-level failures are refunded by OutLayer itself.
    #[private]
    pub fn on_score(&mut self, submission_id: u32, payer: AccountId, deposit: NearToken, #[callback_result] result: Result<Option<String>, PromiseError>) -> Status {
        let evaluator_hash = self.evaluator_hash.clone();
        let sub = self.submissions.get_mut(&submission_id).unwrap_or_else(|| env::panic_str("no such submission"));
        if !matches!(sub.status, Status::Pending { .. }) {
            env::log_str(&format!("on_score ignored: submission {submission_id} is {:?}", sub.status));
            return sub.status.clone();
        }
        let (status, scores, raw) = match result {
            Ok(Some(text)) => {
                let raw = truncate(&text, MAX_RAW_LEN);
                match parse_evaluator_output(&text) {
                    Ok(s) => (Status::Scored, Some(s), Some(raw)),
                    Err(reason) => (Status::Failed { reason }, None, Some(raw)),
                }
            }
            Ok(None) => (Status::Failed { reason: "outlayer: empty output".into() }, None, None),
            Err(e) => {
                if deposit.as_yoctonear() > 0 {
                    Promise::new(payer.clone()).transfer(deposit);
                }
                (Status::Failed { reason: format!("outlayer: promise error {e:?} (deposit returned to {payer})") }, None, None)
            }
        };
        if let Some(s) = scores {
            sub.score_a_bps = Some(s.a_bps);
            sub.f1_a_bps = s.a_f1;
            sub.score_b_bps = s.b_bps;
            sub.f1_b_bps = s.b_f1;
            sub.scored_by = Some(evaluator_hash);
        }
        sub.status = status.clone();
        sub.last_outlayer_raw = raw;
        let (task_id, a, f1a) = (sub.task_id, sub.score_a_bps, sub.f1_a_bps);
        self.submissions.flush();
        let ok = matches!(status, Status::Scored);
        events::emit("model_scored", json!({ "submission_id": submission_id, "task_id": task_id, "ok": ok, "score_a_bps": a, "f1_a_bps": f1a, "status": status }));
        status
    }

    // ---------- closing and winner (C-4) ----------

    /// After the deadline, anyone may close a task: the `Scored` submission with the best final score
    /// (split B, else split A) wins; ties go to the earlier submission. The winner serves `predict_task`.
    pub fn close_task(&mut self, task_id: u32) -> Option<u32> {
        let mut task = self.tasks.get(&task_id).cloned().unwrap_or_else(|| env::panic_str("no such task"));
        assert!(!task.closed, "already closed");
        assert!(env::block_timestamp() >= task.deadline_ns.0, "before deadline");
        let mut ranked: Vec<(u32, u64, u32)> = self // (final score, submitted_at, id)
            .task_submissions
            .get(&task_id)
            .map(|v| v.iter().filter_map(|id| self.submissions.get(id)).filter(|s| s.status == Status::Scored).map(|s| (Self::final_score(s), s.submitted_at_ns.0, s.submission_id)).collect())
            .unwrap_or_default();
        assert!(!ranked.is_empty(), "no scored submission");
        ranked.sort_by(|x, y| y.0.cmp(&x.0).then(x.1.cmp(&y.1)).then(x.2.cmp(&y.2)));
        let winner = ranked[0].2;
        task.winner = Some(winner);
        task.closed = true;
        self.tasks.insert(task_id, task);
        self.tasks.flush();
        events::emit("task_closed", json!({ "task_id": task_id, "winner": winner, "final_score_bps": ranked[0].0, "scored": ranked.len(), "by": env::predecessor_account_id() }));
        Some(winner)
    }

    /// Final ranking score: split B when the evaluator produced it, otherwise split A.
    fn final_score(s: &Submission) -> u32 {
        s.score_b_bps.or(s.score_a_bps).unwrap_or(0)
    }

    // ---------- prepaid credit, inference, fees (C-5) ----------

    /// Prepay inference fees. Needed because function-call keys cannot attach deposits (S7).
    #[payable]
    pub fn deposit_credit(&mut self) -> NearToken {
        let caller = env::predecessor_account_id();
        let amount = env::attached_deposit();
        assert!(amount.as_yoctonear() > 0, "attach a deposit");
        let before = env::storage_usage();
        let balance = self.credit.get(&caller).copied().unwrap_or(NearToken::from_yoctonear(0)).saturating_add(amount);
        self.credit.insert(caller.clone(), balance);
        self.credit.flush();
        // First deposit creates a storage row: keep it funded from the deposit itself.
        let used = env::storage_usage().saturating_sub(before);
        let storage = env::storage_byte_cost().saturating_mul(used as u128);
        assert!(balance > storage, "deposit too small for storage");
        let balance = balance.saturating_sub(storage);
        self.credit.insert(caller.clone(), balance);
        self.credit.flush();
        events::emit("credit_deposited", json!({ "account": caller, "amount": amount, "balance": balance }));
        balance
    }

    pub fn withdraw_credit(&mut self, amount: NearToken) -> Promise {
        let caller = env::predecessor_account_id();
        let balance = self.credit.get(&caller).copied().unwrap_or(NearToken::from_yoctonear(0));
        assert!(amount.as_yoctonear() > 0 && balance >= amount, "insufficient credit: have {} yoctoNEAR", balance.as_yoctonear());
        self.credit.insert(caller.clone(), balance.saturating_sub(amount));
        self.credit.flush();
        events::emit("credit_withdrawn", json!({ "account": caller, "amount": amount }));
        Promise::new(caller).transfer(amount)
    }

    /// Change method on purpose: inference is metered. Charges `task.fee_per_call` from the caller's prepaid
    /// credit to the submission's earnings. Returns the raw score (log-odds × out_scale); > 0 ⇒ positive class.
    pub fn predict(&mut self, submission_id: u32, features: Vec<i64>) -> i64 {
        let caller = env::predecessor_account_id();
        self.run_prediction(submission_id, &features, &caller)
    }

    /// Stable per-task entry point: routes to the task's winning model (task must be closed).
    pub fn predict_task(&mut self, task_id: u32, features: Vec<i64>) -> i64 {
        let task = self.tasks.get(&task_id).unwrap_or_else(|| env::panic_str("no such task"));
        assert!(task.closed, "task not closed");
        let winner = task.winner.unwrap_or_else(|| env::panic_str("no winner"));
        let caller = env::predecessor_account_id();
        self.run_prediction(winner, &features, &caller)
    }

    /// Owner of the submission pulls the fees it earned.
    pub fn withdraw_earnings(&mut self, submission_id: u32) -> Promise {
        let caller = env::predecessor_account_id();
        let sub = self.submissions.get(&submission_id).unwrap_or_else(|| env::panic_str("no such submission"));
        assert_eq!(sub.owner, caller, "owner only");
        let amount = self.earnings.get(&submission_id).copied().unwrap_or(NearToken::from_yoctonear(0));
        assert!(amount.as_yoctonear() > 0, "nothing to withdraw");
        self.earnings.insert(submission_id, NearToken::from_yoctonear(0));
        self.earnings.flush();
        events::emit("earnings_withdrawn", json!({ "submission_id": submission_id, "to": caller, "amount": amount }));
        Promise::new(caller).transfer(amount)
    }

    fn run_prediction(&mut self, submission_id: u32, features: &[i64], caller: &AccountId) -> i64 {
        let sub = self.submissions.get(&submission_id).unwrap_or_else(|| env::panic_str("no such submission"));
        assert!(sub.status == Status::Scored, "not scored: status {:?}", sub.status);
        let task = self.tasks.get(&sub.task_id).unwrap_or_else(|| env::panic_str("no such task"));
        assert!(features.len() == task.n_features as usize, "feature count: expected {}, got {}", task.n_features, features.len());
        let fee = task.fee_per_call;
        let (task_id, owner) = (sub.task_id, sub.owner.clone());
        // charge first
        let balance = self.credit.get(caller).copied().unwrap_or(NearToken::from_yoctonear(0));
        assert!(balance >= fee, "insufficient credit: need {} yoctoNEAR, have {}", fee.as_yoctonear(), balance.as_yoctonear());
        self.credit.insert(caller.clone(), balance.saturating_sub(fee));
        let earned = self.earnings.get(&submission_id).copied().unwrap_or(NearToken::from_yoctonear(0)).saturating_add(fee);
        self.earnings.insert(submission_id, earned);
        // then run the model
        let bytes = self.model_bytes.get(&submission_id).unwrap_or_else(|| env::panic_str("model bytes missing"));
        let model = Model::decode(bytes).unwrap_or_else(|_| env::panic_str("corrupt model"));
        let score = model.raw_score(features).unwrap_or_else(|e| env::panic_str(&format!("predict: {e:?}")));
        let sub = self.submissions.get_mut(&submission_id).unwrap();
        sub.calls += 1;
        let calls = sub.calls;
        self.credit.flush();
        self.earnings.flush();
        self.submissions.flush();
        events::emit("prediction", json!({ "submission_id": submission_id, "task_id": task_id, "caller": caller, "owner": owner, "fee": fee, "score": score, "label": (score > 0) as u8, "calls": calls }));
        score
    }

    // ---------- views ----------

    pub fn get_config(&self) -> Config {
        Config {
            owner: self.owner.clone(),
            outlayer: self.outlayer.clone(),
            evaluator_url: self.evaluator_url.clone(),
            evaluator_hash: self.evaluator_hash.clone(),
            max_model_bytes: MAX_MODEL_BYTES as u32,
            max_trees: MAX_TREES as u32,
            pending_timeout_blocks: PENDING_TIMEOUT_BLOCKS,
            task_count: self.next_task - 1,
            submission_count: self.next_submission - 1,
        }
    }

    pub fn get_evaluator(&self) -> (String, String) {
        (self.evaluator_url.clone(), self.evaluator_hash.clone())
    }

    pub fn get_task(&self, task_id: u32) -> Option<Task> {
        self.tasks.get(&task_id).cloned()
    }

    pub fn get_task_by_slug(&self, slug: String) -> Option<Task> {
        self.slugs.get(&slug).and_then(|id| self.tasks.get(id).cloned())
    }

    pub fn list_tasks(&self, from: u32, limit: u32) -> Vec<Task> {
        self.task_ids.iter().skip(from as usize).take(limit as usize).filter_map(|id| self.tasks.get(id).cloned()).collect()
    }

    pub fn get_submission(&self, submission_id: u32) -> Option<Submission> {
        self.submissions.get(&submission_id).cloned()
    }

    /// Open task: sorted by split-A score (unscored last), then submission time; split B hidden.
    /// Closed task: sorted by the final score (B, else A), then submission time; split B shown.
    pub fn leaderboard(&self, task_id: u32) -> Vec<LeaderboardRow> {
        let Some(task) = self.tasks.get(&task_id) else { return vec![] };
        let Some(ids) = self.task_submissions.get(&task_id) else { return vec![] };
        let mut subs: Vec<&Submission> = ids.iter().filter_map(|id| self.submissions.get(id)).collect();
        let key = |s: &Submission| -> (u32, u64, u32) {
            let score = if task.closed { if s.status == Status::Scored { Self::final_score(s) } else { 0 } } else { s.score_a_bps.unwrap_or(0) };
            (score, s.submitted_at_ns.0, s.submission_id)
        };
        subs.sort_by(|x, y| { let (a, b) = (key(x), key(y)); b.0.cmp(&a.0).then(a.1.cmp(&b.1)).then(a.2.cmp(&b.2)) });
        subs.into_iter()
            .map(|s| LeaderboardRow {
                submission_id: s.submission_id,
                owner: s.owner.clone(),
                score_a_bps: s.score_a_bps,
                f1_a_bps: s.f1_a_bps,
                score_b_bps: if task.closed { s.score_b_bps } else { None },
                bytes: s.bytes,
                trees: s.trees,
                status: s.status.clone(),
                calls: s.calls,
            })
            .collect()
    }

    /// Read by the OutLayer evaluator through the `view` host function.
    /// `model_id` is accepted as an alias so the S30 spike evaluator keeps working.
    pub fn get_model_bytes(&self, submission_id: Option<u32>, model_id: Option<u32>) -> Base64VecU8 {
        let id = submission_id.or(model_id).unwrap_or_else(|| env::panic_str("submission_id required"));
        Base64VecU8(self.model_bytes.get(&id).unwrap_or_else(|| env::panic_str("no such submission")).clone())
    }

    pub fn get_credit(&self, account_id: AccountId) -> NearToken {
        self.credit.get(&account_id).copied().unwrap_or(NearToken::from_yoctonear(0))
    }

    pub fn get_earnings(&self, submission_id: u32) -> NearToken {
        self.earnings.get(&submission_id).copied().unwrap_or(NearToken::from_yoctonear(0))
    }

    /// Convenience for tooling: validate model bytes against a task without storing them.
    /// Never panics: returns `{ok:false, error}` instead.
    pub fn validate_model(&self, task_id: u32, bytes: Base64VecU8) -> Value {
        let Some(task) = self.tasks.get(&task_id) else {
            return json!({ "ok": false, "error": "no such task" });
        };
        if bytes.0.is_empty() || bytes.0.len() > MAX_MODEL_BYTES {
            return json!({ "ok": false, "error": format!("size {} not in 1..={}", bytes.0.len(), MAX_MODEL_BYTES) });
        }
        let model = match Model::decode(&bytes.0) {
            Ok(m) => m,
            Err(e) => return json!({ "ok": false, "error": format!("decode {e:?}") }),
        };
        if model.trees.len() > MAX_TREES {
            return json!({ "ok": false, "error": format!("{} trees > {}", model.trees.len(), MAX_TREES) });
        }
        match model.validate(task.n_features) {
            Ok(s) => json!({ "ok": true, "bytes": bytes.0.len(), "trees": s.trees, "nodes": s.nodes, "max_depth": s.max_depth, "n_features": model.n_features,
                             "storage_cost": env::storage_byte_cost().saturating_mul((bytes.0.len() + 400) as u128), "submission_fee": task.submission_fee }),
            Err(e) => json!({ "ok": false, "error": format!("{e:?}"), "n_features_expected": task.n_features, "n_features_model": model.n_features }),
        }
    }

    pub fn list_submissions(&self, task_id: u32) -> Vec<Submission> {
        self.task_submissions
            .get(&task_id)
            .map(|v| v.iter().filter_map(|id| self.submissions.get(id).cloned()).collect())
            .unwrap_or_default()
    }

    // ---------- internals ----------

    fn assert_owner(&self) {
        assert_eq!(env::predecessor_account_id(), self.owner, "owner only");
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::{accounts, get_logs, VMContextBuilder};
    use near_sdk::testing_env;

    const HASH: &str = "dcc4aa66c31fc634e43514accf2b46e111fa5243b3288f7a951d48268b9456c6";

    fn ctx(predecessor: AccountId, deposit_near: &str, ts_ns: u64) -> VMContextBuilder {
        let mut b = VMContextBuilder::new();
        b.predecessor_account_id(predecessor).attached_deposit(NearToken::from_near(deposit_near.parse().unwrap())).block_timestamp(ts_ns);
        b
    }

    fn contract() -> Contract {
        Contract::new(accounts(0), "outlayer.testnet".parse().unwrap(), "https://x.test/e.wasm".into(), HASH.into())
    }

    fn names(n: usize) -> Vec<String> {
        (0..n).map(|i| format!("f{i}")).collect()
    }

    fn create(c: &mut Contract, slug: &str, n: u16, deadline: u64) -> u32 {
        c.create_task("Risiko kredit".into(), slug.into(), "https://doc".into(), n, names(n as usize), accounts(1), slug.into(), U64(deadline), NearToken::from_millinear(1), NearToken::from_millinear(100), 3)
    }

    #[test]
    fn creates_two_tasks_and_lists_them() {
        testing_env!(ctx(accounts(1), "1", 1_000).build());
        let mut c = contract();
        assert_eq!(create(&mut c, "german-credit", 18, 10_000), 1);
        assert_eq!(create(&mut c, "second", 4, 20_000), 2);
        let t = c.get_task(1).unwrap();
        assert_eq!(t.slug, "german-credit");
        assert_eq!(t.n_features, 18);
        assert_eq!(t.creator, accounts(1));
        assert!(!t.closed && t.winner.is_none());
        assert_eq!(c.list_tasks(0, 10).len(), 2);
        assert_eq!(c.list_tasks(1, 10)[0].task_id, 2);
        assert_eq!(c.get_task_by_slug("second".into()).unwrap().task_id, 2);
        assert_eq!(c.get_config().task_count, 2);
        let logs = get_logs();
        assert!(logs.iter().any(|l| l.starts_with("EVENT_JSON:") && l.contains("task_created")), "{logs:?}");
    }

    #[test]
    #[should_panic(expected = "slug taken")]
    fn rejects_duplicate_slug() {
        testing_env!(ctx(accounts(1), "1", 1_000).build());
        let mut c = contract();
        create(&mut c, "german-credit", 18, 10_000);
        create(&mut c, "german-credit", 18, 10_000);
    }

    #[test]
    #[should_panic(expected = "deadline in the past")]
    fn rejects_past_deadline() {
        testing_env!(ctx(accounts(1), "1", 5_000).build());
        let mut c = contract();
        create(&mut c, "german-credit", 18, 5_000);
    }

    #[test]
    #[should_panic(expected = "n_features mismatch")]
    fn rejects_feature_name_count_mismatch() {
        testing_env!(ctx(accounts(1), "1", 1_000).build());
        let mut c = contract();
        c.create_task("t".into(), "s".into(), "u".into(), 3, names(2), accounts(1), "p".into(), U64(10_000), NearToken::from_millinear(1), NearToken::from_millinear(1), 1);
    }

    #[test]
    #[should_panic(expected = "storage deposit")]
    fn rejects_insufficient_storage_deposit() {
        testing_env!(ctx(accounts(1), "0", 1_000).build());
        let mut c = contract();
        create(&mut c, "german-credit", 18, 10_000);
    }

    #[test]
    #[should_panic(expected = "slug: lowercase")]
    fn rejects_bad_slug() {
        testing_env!(ctx(accounts(1), "1", 1_000).build());
        let mut c = contract();
        create(&mut c, "German Credit", 18, 10_000);
    }

    // ----- C-2 -----

    /// Two-feature model: tree 0 splits on f0 <= 10, tree 1 splits on f1 <= 5.
    fn small_model(n_features: u16) -> Model {
        let leaf = |v: i64| Node { feature: 0, threshold: 0, left: LEAF, right: LEAF, value: v };
        Model {
            version: 1,
            n_features,
            feature_scale: 1,
            out_scale: 1_000_000,
            bias: -100_000,
            trees: vec![
                Tree { nodes: vec![Node { feature: 0, threshold: 10, left: 1, right: 2, value: 0 }, leaf(-500_000), leaf(900_000)] },
                Tree { nodes: vec![Node { feature: 1, threshold: 5, left: 1, right: 2, value: 0 }, leaf(200_000), leaf(-300_000)] },
            ],
        }
    }

    fn b64(m: &Model) -> Base64VecU8 {
        Base64VecU8(m.encode())
    }

    fn setup_task() -> Contract {
        testing_env!(ctx(accounts(1), "1", 1_000).build());
        let mut c = contract();
        create(&mut c, "two-feat", 2, 10_000);
        c
    }

    #[test]
    fn submits_valid_model_and_indexes_it() {
        let mut c = setup_task();
        testing_env!(ctx(accounts(2), "1", 2_000).build());
        let id = c.submit_model(1, b64(&small_model(2)));
        assert_eq!(id, 1);
        let s = c.get_submission(1).unwrap();
        assert_eq!(s.owner, accounts(2));
        assert_eq!(s.trees, 2);
        assert_eq!(s.nodes, 6);
        assert_eq!(s.status, Status::Uploaded);
        assert_eq!(s.bytes as usize, small_model(2).encode().len());
        assert_eq!(c.get_task(1).unwrap().submission_count, 1);
        assert_eq!(c.list_submissions(1).len(), 1);
        assert_eq!(c.get_model_bytes(Some(1), None).0, small_model(2).encode());
        assert_eq!(c.get_model_bytes(None, Some(1)).0, small_model(2).encode());
        let v = c.validate_model(1, b64(&small_model(2)));
        assert_eq!(v["ok"], true);
        assert_eq!(v["nodes"], 6);
        assert!(get_logs().iter().any(|l| l.contains("model_submitted")));
    }

    #[test]
    #[should_panic(expected = "invalid model: WrongFeatureCount")]
    fn rejects_feature_count_mismatch() {
        let mut c = setup_task();
        testing_env!(ctx(accounts(2), "1", 2_000).build());
        c.submit_model(1, b64(&small_model(3)));
    }

    #[test]
    #[should_panic(expected = "invalid model: BadChildIndex")]
    fn rejects_backward_child_index() {
        let mut c = setup_task();
        let mut m = small_model(2);
        m.trees[0].nodes[0].left = 0; // points at itself
        testing_env!(ctx(accounts(2), "1", 2_000).build());
        c.submit_model(1, b64(&m));
    }

    #[test]
    #[should_panic(expected = "invalid model: decode")]
    fn rejects_garbage_bytes() {
        let mut c = setup_task();
        testing_env!(ctx(accounts(2), "1", 2_000).build());
        c.submit_model(1, Base64VecU8(vec![1, 2, 3]));
    }

    #[test]
    #[should_panic(expected = "quota: 3 submissions per account")]
    fn rejects_fourth_submission_from_same_account() {
        let mut c = setup_task();
        for _ in 0..4 {
            testing_env!(ctx(accounts(2), "1", 2_000).build());
            c.submit_model(1, b64(&small_model(2)));
        }
    }

    #[test]
    fn other_account_has_its_own_quota() {
        let mut c = setup_task();
        for _ in 0..3 {
            testing_env!(ctx(accounts(2), "1", 2_000).build());
            c.submit_model(1, b64(&small_model(2)));
        }
        testing_env!(ctx(accounts(3), "1", 2_000).build());
        assert_eq!(c.submit_model(1, b64(&small_model(2))), 4);
    }

    #[test]
    #[should_panic(expected = "deadline passed")]
    fn rejects_after_deadline() {
        let mut c = setup_task();
        testing_env!(ctx(accounts(2), "1", 10_000).build());
        c.submit_model(1, b64(&small_model(2)));
    }

    #[test]
    #[should_panic(expected = "storage deposit")]
    fn rejects_when_deposit_below_storage_plus_fee() {
        let mut c = setup_task();
        // fee is 0.1 NEAR; attach exactly 0.1 → nothing left for storage
        let mut b = ctx(accounts(2), "0", 2_000);
        b.attached_deposit(NearToken::from_millinear(100));
        testing_env!(b.build());
        c.submit_model(1, b64(&small_model(2)));
    }

    #[test]
    fn validate_model_reports_errors_without_panicking() {
        let c = setup_task();
        assert_eq!(c.validate_model(9, b64(&small_model(2)))["ok"], false);
        assert_eq!(c.validate_model(1, Base64VecU8(vec![]))["ok"], false);
        let v = c.validate_model(1, b64(&small_model(5)));
        assert_eq!(v["ok"], false);
        assert_eq!(v["n_features_expected"], 2);
    }

    // ----- C-3 -----

    const EVAL_OK: &str = r#"{"ok":true,"eval_version":"1","submission_id":1,"a":{"n":150,"n_pos":45,"tp":30,"tn":90,"fp":15,"fn":15,"bal_acc_bps":7600,"f1_bps":6650},"b":{"n":150,"bal_acc_bps":7200,"f1_bps":6100}}"#;
    const EVAL_SPIKE: &str = r#"{"a":{"correct":40,"n":45,"score_bps":8850},"b":{"correct":41,"n":45,"score_bps":9100},"model_id":1,"ok":true,"trees":100}"#;
    const EVAL_FAIL: &str = r#"{"ok":false,"submission_id":1,"error":"secret TEST_SET_A missing"}"#;

    /// Task + one uploaded submission owned by accounts(2); returns the contract.
    fn with_submission() -> Contract {
        let mut c = setup_task();
        testing_env!(ctx(accounts(2), "1", 2_000).build());
        c.submit_model(1, b64(&small_model(2)));
        c
    }

    fn owner_ctx(block: u64) -> VMContextBuilder {
        let mut b = ctx(accounts(2), "0", 3_000);
        b.attached_deposit(MIN_SCORE_DEPOSIT).block_height(block).prepaid_gas(Gas::from_tgas(300));
        b
    }

    fn callback_ctx() -> VMContextBuilder {
        let mut b = ctx(accounts(0), "0", 4_000);
        // #[private]: predecessor must be the contract itself
        b.current_account_id(accounts(0)).predecessor_account_id(accounts(0));
        b
    }

    #[test]
    fn request_score_sets_pending_and_calls_outlayer() {
        let mut c = with_submission();
        testing_env!(owner_ctx(100).build());
        c.request_score(1);
        assert_eq!(c.get_submission(1).unwrap().status, Status::Pending { requested_at_block: 100 });
        assert!(get_logs().iter().any(|l| l.contains("score_requested") && l.contains(HASH)));
    }

    #[test]
    #[should_panic(expected = "owner only")]
    fn request_score_rejects_non_owner() {
        let mut c = with_submission();
        let mut b = owner_ctx(100);
        b.predecessor_account_id(accounts(3));
        testing_env!(b.build());
        c.request_score(1);
    }

    #[test]
    #[should_panic(expected = "deposit: at least")]
    fn request_score_rejects_small_deposit() {
        let mut c = with_submission();
        let mut b = owner_ctx(100);
        b.attached_deposit(NearToken::from_millinear(1));
        testing_env!(b.build());
        c.request_score(1);
    }

    #[test]
    #[should_panic(expected = "not requestable")]
    fn request_score_rejects_fresh_pending() {
        let mut c = with_submission();
        testing_env!(owner_ctx(100).build());
        c.request_score(1);
        testing_env!(owner_ctx(150).build());
        c.request_score(1);
    }

    #[test]
    fn request_score_allowed_after_pending_timeout() {
        let mut c = with_submission();
        testing_env!(owner_ctx(100).build());
        c.request_score(1);
        testing_env!(owner_ctx(100 + PENDING_TIMEOUT_BLOCKS).build());
        c.request_score(1);
        assert_eq!(c.get_submission(1).unwrap().status, Status::Pending { requested_at_block: 100 + PENDING_TIMEOUT_BLOCKS });
    }

    #[test]
    fn on_score_parses_abi_format() {
        let mut c = with_submission();
        testing_env!(owner_ctx(100).build());
        c.request_score(1);
        testing_env!(callback_ctx().build());
        let st = c.on_score(1, accounts(2), MIN_SCORE_DEPOSIT, Ok(Some(EVAL_OK.into())));
        assert_eq!(st, Status::Scored);
        let s = c.get_submission(1).unwrap();
        assert_eq!((s.score_a_bps, s.f1_a_bps, s.score_b_bps, s.f1_b_bps), (Some(7600), Some(6650), Some(7200), Some(6100)));
        assert_eq!(s.scored_by.as_deref(), Some(HASH));
        assert!(s.last_outlayer_raw.unwrap().contains("bal_acc_bps"));
        assert!(get_logs().iter().any(|l| l.contains("model_scored") && l.contains("\"ok\":true")));
    }

    #[test]
    fn on_score_promise_error_mentions_refund_to_payer() {
        let mut c = with_submission();
        testing_env!(owner_ctx(100).build());
        c.request_score(1);
        testing_env!(callback_ctx().build());
        match c.on_score(1, accounts(2), MIN_SCORE_DEPOSIT, Err(PromiseError::Failed)) {
            Status::Failed { reason } => assert!(reason.contains(&format!("deposit returned to {}", accounts(2))), "{reason}"),
            other => panic!("{other:?}"),
        }
        assert!(c.get_submission(1).unwrap().scored_by.is_none());
    }

    #[test]
    fn on_score_parses_spike_format() {
        let mut c = with_submission();
        testing_env!(owner_ctx(100).build());
        c.request_score(1);
        testing_env!(callback_ctx().build());
        assert_eq!(c.on_score(1, accounts(2), MIN_SCORE_DEPOSIT, Ok(Some(EVAL_SPIKE.into()))), Status::Scored);
        let s = c.get_submission(1).unwrap();
        assert_eq!((s.score_a_bps, s.f1_a_bps, s.score_b_bps), (Some(8850), None, Some(9100)));
    }

    #[test]
    fn on_score_failure_paths_then_retry() {
        let mut c = with_submission();
        for (result, expect) in [
            (Ok(Some(EVAL_FAIL.to_string())), "evaluator: secret TEST_SET_A missing"),
            (Ok(Some("not json".to_string())), "evaluator output is not JSON"),
            (Ok(None), "outlayer: empty output"),
            (Err(PromiseError::Failed), "outlayer: promise error"),
        ] {
            testing_env!(owner_ctx(100).build());
            c.request_score(1); // allowed again after each failure
            testing_env!(callback_ctx().build());
            match c.on_score(1, accounts(2), MIN_SCORE_DEPOSIT, result) {
                Status::Failed { reason } => assert!(reason.starts_with(expect), "{reason} vs {expect}"),
                other => panic!("expected Failed, got {other:?}"),
            }
            assert!(c.get_submission(1).unwrap().score_a_bps.is_none());
        }
    }

    #[test]
    fn on_score_ignores_duplicate_callback() {
        let mut c = with_submission();
        testing_env!(owner_ctx(100).build());
        c.request_score(1);
        testing_env!(callback_ctx().build());
        c.on_score(1, accounts(2), MIN_SCORE_DEPOSIT, Ok(Some(EVAL_OK.into())));
        // a second (stale) callback must not overwrite the score
        let st = c.on_score(1, accounts(2), MIN_SCORE_DEPOSIT, Ok(Some(EVAL_FAIL.into())));
        assert_eq!(st, Status::Scored);
        assert_eq!(c.get_submission(1).unwrap().score_a_bps, Some(7600));
    }

    #[test]
    #[should_panic(expected = "not requestable: status Scored")]
    fn scored_submission_cannot_be_rescored() {
        let mut c = with_submission();
        testing_env!(owner_ctx(100).build());
        c.request_score(1);
        testing_env!(callback_ctx().build());
        c.on_score(1, accounts(2), MIN_SCORE_DEPOSIT, Ok(Some(EVAL_OK.into())));
        testing_env!(owner_ctx(1000).build());
        c.request_score(1);
    }

    #[test]
    fn parse_clamps_and_requires_a() {
        assert!(parse_evaluator_output(r#"{"ok":true,"b":{"bal_acc_bps":1}}"#).is_err());
        let p = parse_evaluator_output(r#"{"ok":true,"a":{"bal_acc_bps":99999}}"#).unwrap();
        assert_eq!(p, ParsedScores { a_bps: 10_000, a_f1: None, b_bps: None, b_f1: None });
    }

    // ----- C-4 -----

    fn eval_json(a: u32, b: Option<u32>) -> String {
        match b {
            Some(b) => format!(r#"{{"ok":true,"a":{{"bal_acc_bps":{a},"f1_bps":1}},"b":{{"bal_acc_bps":{b},"f1_bps":2}}}}"#),
            None => format!(r#"{{"ok":true,"a":{{"bal_acc_bps":{a}}}}}"#),
        }
    }

    /// Submit from `who` at `ts`, then score it with the given split scores. Returns submission id.
    fn submit_and_score(c: &mut Contract, who: AccountId, ts: u64, a: u32, b: Option<u32>) -> u32 {
        testing_env!(ctx(who.clone(), "1", ts).build());
        let id = c.submit_model(1, b64(&small_model(2)));
        let mut o = ctx(who, "0", ts);
        o.attached_deposit(MIN_SCORE_DEPOSIT).prepaid_gas(Gas::from_tgas(300));
        testing_env!(o.build());
        c.request_score(id);
        testing_env!(callback_ctx().build());
        assert_eq!(c.on_score(id, accounts(2), MIN_SCORE_DEPOSIT, Ok(Some(eval_json(a, b)))), Status::Scored);
        id
    }

    #[test]
    fn close_task_picks_best_b_and_ties_go_to_earlier() {
        let mut c = setup_task(); // deadline 10_000
        let s1 = submit_and_score(&mut c, accounts(2), 2_000, 9000, Some(7000)); // best A, weak B
        let s2 = submit_and_score(&mut c, accounts(3), 3_000, 7000, Some(7500)); // best B, earlier
        let s3 = submit_and_score(&mut c, accounts(4), 4_000, 7100, Some(7500)); // ties B, later
        // before close: ordered by A, B hidden
        let lb = c.leaderboard(1);
        assert_eq!(lb.iter().map(|r| r.submission_id).collect::<Vec<_>>(), vec![s1, s3, s2]);
        assert!(lb.iter().all(|r| r.score_b_bps.is_none()));
        testing_env!(ctx(accounts(5), "0", 10_000).build());
        assert_eq!(c.close_task(1), Some(s2));
        let t = c.get_task(1).unwrap();
        assert!(t.closed && t.winner == Some(s2));
        // after close: ordered by B, B visible
        let lb = c.leaderboard(1);
        assert_eq!(lb.iter().map(|r| r.submission_id).collect::<Vec<_>>(), vec![s2, s3, s1]);
        assert_eq!(lb[0].score_b_bps, Some(7500));
        assert!(get_logs().iter().any(|l| l.contains("task_closed")));
    }

    #[test]
    fn close_task_falls_back_to_a_when_b_missing_and_skips_unscored() {
        let mut c = setup_task();
        let s1 = submit_and_score(&mut c, accounts(2), 2_000, 6000, None);
        let s2 = submit_and_score(&mut c, accounts(3), 3_000, 8000, None);
        testing_env!(ctx(accounts(4), "1", 4_000).build());
        let s3 = c.submit_model(1, b64(&small_model(2))); // never scored
        testing_env!(ctx(accounts(5), "0", 10_000).build());
        assert_eq!(c.close_task(1), Some(s2));
        let lb = c.leaderboard(1);
        assert_eq!(lb.iter().map(|r| r.submission_id).collect::<Vec<_>>(), vec![s2, s1, s3]);
        assert_eq!(lb[2].status, Status::Uploaded);
    }

    #[test]
    #[should_panic(expected = "before deadline")]
    fn close_task_rejects_before_deadline() {
        let mut c = setup_task();
        submit_and_score(&mut c, accounts(2), 2_000, 6000, None);
        testing_env!(ctx(accounts(5), "0", 9_999).build());
        c.close_task(1);
    }

    #[test]
    #[should_panic(expected = "already closed")]
    fn close_task_rejects_double_close() {
        let mut c = setup_task();
        submit_and_score(&mut c, accounts(2), 2_000, 6000, None);
        testing_env!(ctx(accounts(5), "0", 10_000).build());
        c.close_task(1);
        c.close_task(1);
    }

    #[test]
    #[should_panic(expected = "no scored submission")]
    fn close_task_rejects_without_scores() {
        let mut c = with_submission();
        testing_env!(ctx(accounts(5), "0", 10_000).build());
        c.close_task(1);
    }

    #[test]
    #[should_panic(expected = "task closed")]
    fn closed_task_rejects_new_submissions_and_scores() {
        let mut c = setup_task();
        submit_and_score(&mut c, accounts(2), 2_000, 6000, None);
        testing_env!(ctx(accounts(5), "0", 10_000).build());
        c.close_task(1);
        testing_env!(ctx(accounts(3), "1", 10_001).build());
        c.submit_model(1, b64(&small_model(2))); // `task closed` is checked before `deadline passed`
    }

    #[test]
    fn leaderboard_empty_for_unknown_task() {
        let c = contract();
        assert!(c.leaderboard(9).is_empty());
    }

    // ----- C-5 -----

    /// Closed task whose winner is submission 1 (owned by accounts(2)); fee_per_call = 1 mNEAR.
    fn closed_task() -> Contract {
        let mut c = setup_task();
        submit_and_score(&mut c, accounts(2), 2_000, 8000, Some(8000));
        testing_env!(ctx(accounts(5), "0", 10_000).build());
        assert_eq!(c.close_task(1), Some(1));
        c
    }

    fn agent_ctx(deposit_near: &str) -> VMContextBuilder {
        ctx(accounts(4), deposit_near, 11_000)
    }

    #[test]
    fn credit_deposit_and_withdraw() {
        let mut c = contract();
        testing_env!(agent_ctx("1").build());
        let bal = c.deposit_credit();
        assert!(bal > NearToken::from_millinear(990) && bal < NearToken::from_near(1), "{bal}");
        assert_eq!(c.get_credit(accounts(4)), bal);
        testing_env!(agent_ctx("0").build());
        c.withdraw_credit(NearToken::from_millinear(500));
        assert_eq!(c.get_credit(accounts(4)), bal.saturating_sub(NearToken::from_millinear(500)));
    }

    #[test]
    #[should_panic(expected = "insufficient credit")]
    fn withdraw_credit_rejects_overdraw() {
        let mut c = contract();
        testing_env!(agent_ctx("0").build());
        c.withdraw_credit(NearToken::from_millinear(1));
    }

    #[test]
    fn predict_charges_fee_and_credits_owner() {
        let mut c = closed_task();
        testing_env!(agent_ctx("1").build());
        let bal = c.deposit_credit();
        testing_env!(agent_ctx("0").build());
        // small_model: f0 <= 10 → -0.5 else +0.9 ; f1 <= 5 → +0.2 else -0.3 ; bias -0.1 (×1e6)
        assert_eq!(c.predict(1, vec![3, 2]), -400_000);
        assert_eq!(c.predict_task(1, vec![20, 9]), 500_000);
        let fee = NearToken::from_millinear(1);
        assert_eq!(c.get_credit(accounts(4)), bal.saturating_sub(fee).saturating_sub(fee));
        assert_eq!(c.get_earnings(1), NearToken::from_millinear(2));
        assert_eq!(c.get_submission(1).unwrap().calls, 2);
        assert!(get_logs().iter().any(|l| l.contains("\"event\":\"prediction\"") && l.contains("\"label\":1")));
        // owner pulls earnings; a second pull has nothing
        testing_env!(ctx(accounts(2), "0", 12_000).build());
        c.withdraw_earnings(1);
        assert_eq!(c.get_earnings(1), NearToken::from_yoctonear(0));
    }

    #[test]
    #[should_panic(expected = "insufficient credit")]
    fn predict_rejects_without_credit() {
        let mut c = closed_task();
        testing_env!(agent_ctx("0").build());
        c.predict(1, vec![3, 2]);
    }

    #[test]
    #[should_panic(expected = "feature count: expected 2, got 3")]
    fn predict_rejects_wrong_feature_count() {
        let mut c = closed_task();
        testing_env!(agent_ctx("1").build());
        c.deposit_credit();
        c.predict(1, vec![1, 2, 3]);
    }

    #[test]
    #[should_panic(expected = "not scored")]
    fn predict_rejects_unscored_submission() {
        let mut c = with_submission();
        testing_env!(agent_ctx("1").build());
        c.deposit_credit();
        c.predict(1, vec![3, 2]);
    }

    #[test]
    #[should_panic(expected = "task not closed")]
    fn predict_task_rejects_open_task() {
        let mut c = setup_task();
        submit_and_score(&mut c, accounts(2), 2_000, 8000, None);
        testing_env!(agent_ctx("1").build());
        c.deposit_credit();
        c.predict_task(1, vec![3, 2]);
    }

    #[test]
    #[should_panic(expected = "owner only")]
    fn withdraw_earnings_rejects_non_owner() {
        let mut c = closed_task();
        testing_env!(agent_ctx("1").build());
        c.deposit_credit();
        c.predict(1, vec![3, 2]);
        testing_env!(agent_ctx("0").build());
        c.withdraw_earnings(1);
    }

    #[test]
    #[should_panic(expected = "nothing to withdraw")]
    fn withdraw_earnings_rejects_empty() {
        let mut c = closed_task();
        testing_env!(ctx(accounts(2), "0", 12_000).build());
        c.withdraw_earnings(1);
    }

    // ----- T-1 gap fillers -----

    #[test]
    fn on_score_truncates_raw_output_to_900_bytes() {
        let mut c = with_submission();
        testing_env!(owner_ctx(100).build());
        c.request_score(1);
        testing_env!(callback_ctx().build());
        let padding = "x".repeat(2000);
        let text = format!(r#"{{"ok":true,"a":{{"bal_acc_bps":7000}},"pad":"{padding}"}}"#);
        assert_eq!(c.on_score(1, accounts(2), MIN_SCORE_DEPOSIT, Ok(Some(text))), Status::Scored);
        let raw = c.get_submission(1).unwrap().last_outlayer_raw.unwrap();
        assert!(raw.len() <= 900, "{}", raw.len());
    }

    #[test]
    #[should_panic(expected = "task closed")]
    fn request_score_rejects_after_close() {
        let mut c = setup_task();
        submit_and_score(&mut c, accounts(2), 2_000, 7000, None);
        testing_env!(ctx(accounts(3), "1", 3_000).build());
        let late = c.submit_model(1, b64(&small_model(2)));
        testing_env!(ctx(accounts(5), "0", 10_000).build());
        c.close_task(1);
        let mut o = ctx(accounts(3), "0", 10_001);
        o.attached_deposit(MIN_SCORE_DEPOSIT).prepaid_gas(Gas::from_tgas(300));
        testing_env!(o.build());
        c.request_score(late);
    }

    #[test]
    #[should_panic(expected = "attach a deposit")]
    fn deposit_credit_requires_deposit() {
        let mut c = contract();
        testing_env!(agent_ctx("0").build());
        c.deposit_credit();
    }

    #[test]
    #[should_panic(expected = "not scored: status Failed")]
    fn predict_rejects_failed_submission() {
        let mut c = with_submission();
        testing_env!(owner_ctx(100).build());
        c.request_score(1);
        testing_env!(callback_ctx().build());
        c.on_score(1, accounts(2), MIN_SCORE_DEPOSIT, Ok(Some(EVAL_FAIL.into())));
        testing_env!(agent_ctx("1").build());
        c.deposit_credit();
        c.predict(1, vec![3, 2]);
    }

    #[test]
    fn list_submissions_follows_submit_order_and_unknown_task_is_empty() {
        let mut c = setup_task();
        for (i, who) in [accounts(2), accounts(3), accounts(4)].into_iter().enumerate() {
            testing_env!(ctx(who, "1", 2_000 + i as u64).build());
            c.submit_model(1, b64(&small_model(2)));
        }
        let ids: Vec<u32> = c.list_submissions(1).iter().map(|s| s.submission_id).collect();
        assert_eq!(ids, vec![1, 2, 3]);
        assert!(c.list_submissions(9).is_empty());
        assert_eq!(c.get_config().submission_count, 3);
    }

    #[test]
    fn set_evaluator_owner_only() {
        testing_env!(ctx(accounts(0), "0", 1_000).build());
        let mut c = contract();
        c.set_evaluator("https://host/new.wasm".into(), HASH.to_uppercase());
        assert_eq!(c.get_evaluator().1, HASH);
    }

    #[test]
    #[should_panic(expected = "owner only")]
    fn set_evaluator_rejects_non_owner() {
        testing_env!(ctx(accounts(2), "0", 1_000).build());
        let mut c = contract();
        c.set_evaluator("https://host/new.wasm".into(), HASH.into());
    }
}
