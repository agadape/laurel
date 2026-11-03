//! `credit-desk` — an example of another contract using a Bursa model as decision infrastructure.
//!
//! Simulation only (see tasks/german-credit/README.md). The desk holds prepaid credit at Bursa and, for
//! each applicant, asks the task's winning model through `predict_task`; the callback turns the raw score
//! into a desk decision and stores it. No human is scored by this; the demo data is UCI German Credit.
use near_sdk::json_types::U64;
use near_sdk::serde_json::json;
use near_sdk::store::{LookupMap, Vector};
use near_sdk::{env, ext_contract, near, AccountId, BorshStorageKey, Gas, NearToken, PanicOnDefault, Promise, PromiseError};

const PREDICT_GAS: Gas = Gas::from_tgas(30);
const CALLBACK_GAS: Gas = Gas::from_tgas(10);
const MAX_RECENT: u32 = 50;

#[ext_contract(ext_bursa)]
trait Bursa {
    fn deposit_credit(&mut self) -> NearToken;
    fn predict_task(&mut self, task_id: u32, features: Vec<i64>) -> i64;
}

#[derive(BorshStorageKey)]
#[near]
enum Key {
    Decisions,
    Recent,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, PartialEq)]
pub enum Outcome {
    /// score <= 0: model predicts good risk → simulated 30-day payment terms
    Approve,
    /// score > 0: model predicts bad risk → simulated upfront deposit required
    RequireDeposit,
    /// the model call failed (no credit, task not closed, wrong feature count, …)
    Error { reason: String },
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub struct Decision {
    pub applicant: String,
    pub score: Option<i64>,
    pub outcome: Outcome,
    pub decided_at_ns: U64,
    pub block_height: u64,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Contract {
    owner: AccountId,
    bursa: AccountId,
    task_id: u32,
    decisions: LookupMap<String, Decision>,
    recent: Vector<String>,
    screened: u64,
}

#[near]
impl Contract {
    #[init]
    pub fn new(owner: AccountId, bursa: AccountId, task_id: u32) -> Self {
        Self { owner, bursa, task_id, decisions: LookupMap::new(Key::Decisions), recent: Vector::new(Key::Recent), screened: 0 }
    }

    /// Forward the attached deposit to Bursa as prepaid credit for THIS contract (the fee payer).
    #[payable]
    pub fn fund(&mut self) -> Promise {
        assert_eq!(env::predecessor_account_id(), self.owner, "owner only");
        let amount = env::attached_deposit();
        assert!(amount.as_yoctonear() > 0, "attach a deposit");
        ext_bursa::ext(self.bursa.clone()).with_attached_deposit(amount).with_static_gas(Gas::from_tgas(10)).deposit_credit()
    }

    /// Screen one applicant: ask the winning model, decide in the callback. Anyone may call (demo).
    pub fn screen(&mut self, applicant: String, features: Vec<i64>) -> Promise {
        assert!(!applicant.is_empty() && applicant.len() <= 64, "applicant: 1..=64 chars");
        ext_bursa::ext(self.bursa.clone())
            .with_static_gas(PREDICT_GAS)
            .predict_task(self.task_id, features)
            .then(Self::ext(env::current_account_id()).with_static_gas(CALLBACK_GAS).on_prediction(applicant))
    }

    #[private]
    pub fn on_prediction(&mut self, applicant: String, #[callback_result] result: Result<i64, PromiseError>) -> Decision {
        let (score, outcome) = match result {
            Ok(s) if s > 0 => (Some(s), Outcome::RequireDeposit),
            Ok(s) => (Some(s), Outcome::Approve),
            Err(e) => (None, Outcome::Error { reason: format!("predict_task failed: {e:?}") }),
        };
        let d = Decision { applicant: applicant.clone(), score, outcome, decided_at_ns: U64(env::block_timestamp()), block_height: env::block_height() };
        if !self.decisions.contains_key(&applicant) {
            self.recent.push(applicant.clone());
            if self.recent.len() > MAX_RECENT {
                self.recent.swap_remove(0);
            }
        }
        self.decisions.insert(applicant, d.clone());
        self.screened += 1;
        self.decisions.flush();
        self.recent.flush();
        env::log_str(&format!("EVENT_JSON:{}", json!({ "standard": "credit-desk", "version": "1.0.0", "event": "decision", "data": [d] })));
        d
    }

    pub fn get_decision(&self, applicant: String) -> Option<Decision> {
        self.decisions.get(&applicant).cloned()
    }

    pub fn recent_decisions(&self, limit: u32) -> Vec<Decision> {
        self.recent.iter().rev().take(limit as usize).filter_map(|a| self.decisions.get(a).cloned()).collect()
    }

    pub fn get_config(&self) -> (AccountId, AccountId, u32, u64) {
        (self.owner.clone(), self.bursa.clone(), self.task_id, self.screened)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::{accounts, VMContextBuilder};
    use near_sdk::testing_env;

    fn desk() -> Contract {
        Contract::new(accounts(0), accounts(1), 2)
    }

    fn private_ctx() -> VMContextBuilder {
        let mut b = VMContextBuilder::new();
        b.current_account_id(accounts(0)).predecessor_account_id(accounts(0)).block_timestamp(1_000).block_height(7);
        b
    }

    #[test]
    fn callback_maps_score_to_outcome_and_records() {
        testing_env!(private_ctx().build());
        let mut c = desk();
        let d = c.on_prediction("A-001".into(), Ok(-1_865_183));
        assert_eq!(d.outcome, Outcome::Approve);
        let d = c.on_prediction("A-002".into(), Ok(811_014));
        assert_eq!(d.outcome, Outcome::RequireDeposit);
        let d = c.on_prediction("A-003".into(), Err(PromiseError::Failed));
        assert!(matches!(d.outcome, Outcome::Error { .. }) && d.score.is_none());
        assert_eq!(c.recent_decisions(10).len(), 3);
        assert_eq!(c.recent_decisions(10)[0].applicant, "A-003");
        assert_eq!(c.get_decision("A-002".into()).unwrap().score, Some(811_014));
        assert_eq!(c.get_config().3, 3);
    }

    #[test]
    fn rescreening_same_applicant_overwrites_without_duplicating() {
        testing_env!(private_ctx().build());
        let mut c = desk();
        c.on_prediction("A-001".into(), Ok(5));
        c.on_prediction("A-001".into(), Ok(-5));
        assert_eq!(c.recent_decisions(10).len(), 1);
        assert_eq!(c.get_decision("A-001".into()).unwrap().outcome, Outcome::Approve);
    }

    #[test]
    #[should_panic(expected = "owner only")]
    fn fund_is_owner_only() {
        let mut b = VMContextBuilder::new();
        b.predecessor_account_id(accounts(2)).attached_deposit(NearToken::from_millinear(10));
        testing_env!(b.build());
        desk().fund();
    }
}
