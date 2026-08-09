// contracts/payment_escrow/src/test.rs
#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token::{Client as TokenClient, StellarAssetClient},
    Address, Env, String,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const DISPUTE_WINDOW: u64 = 86_400;

fn setup_contract(env: &Env) -> Address {
    env.register(PaymentEscrowContract, ())
}

fn setup_token(env: &Env, admin: &Address, recipient: &Address, amount: i128) -> Address {
    let token_address = env
        .register_stellar_asset_contract_v2(admin.clone())
        .address();
    StellarAssetClient::new(env, &token_address)
        .mock_all_auths()
        .mint(recipient, &amount);
    token_address
}

fn advance_time(env: &Env, seconds: u64) {
    env.ledger().with_mut(|l| l.timestamp += seconds);
}

fn init<'a>(
    env: &'a Env,
    contract_id: &Address,
    admin: &Address,
    token: &Address,
) -> PaymentEscrowContractClient<'a> {
    let client = PaymentEscrowContractClient::new(env, contract_id);
    client.initialize(admin, token, &DISPUTE_WINDOW);
    client
}

// ── Initialisation ────────────────────────────────────────────────────────────

#[test]
fn test_initialize_success() {
    let env = Env::default();
    let contract_id = setup_contract(&env);
    let admin = Address::generate(&env);
    let token = Address::generate(&env);

    env.mock_all_auths();
    let client = init(&env, &contract_id, &admin, &token);

    assert_eq!(client.admin(), admin);
    assert_eq!(client.payment_token(), token);
    assert_eq!(client.dispute_window(), DISPUTE_WINDOW);
}

#[test]
#[should_panic(expected = "Error(Contract, #5002)")]
fn test_initialize_twice_fails() {
    let env = Env::default();
    let contract_id = setup_contract(&env);
    let admin = Address::generate(&env);
    let token = Address::generate(&env);

    env.mock_all_auths();
    let client = PaymentEscrowContractClient::new(&env, &contract_id);
    client.initialize(&admin, &token, &DISPUTE_WINDOW);
    client.initialize(&admin, &token, &DISPUTE_WINDOW);
}

#[test]
#[should_panic(expected = "Error(Contract, #5000)")]
fn test_action_before_initialize_fails() {
    // Nothing has called initialize() yet — any admin-gated action should
    // fail with AdminNotSet rather than, say, panicking on a missing
    // payment token or succeeding against an unset admin.
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = setup_contract(&env);
    let client = PaymentEscrowContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);

    client.pause(&admin);
}

// ── Escrow creation ───────────────────────────────────────────────────────────

#[test]
fn test_create_escrow_success() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let depositor = Address::generate(&env);
    let beneficiary = Address::generate(&env);
    let token = setup_token(&env, &admin, &depositor, 10_000);

    let contract_id = setup_contract(&env);
    let client = init(&env, &contract_id, &admin, &token);

    client.create_escrow(
        &depositor,
        &String::from_str(&env, "esc-001"),
        &beneficiary,
        &5_000i128,
        &String::from_str(&env, "Security deposit – booking ws-001"),
        &0u64,
    );

    let escrow = client.get_escrow(&String::from_str(&env, "esc-001"));
    assert_eq!(escrow.depositor, depositor);
    assert_eq!(escrow.beneficiary, beneficiary);
    assert_eq!(escrow.amount, 5_000i128);
    assert_eq!(escrow.status, EscrowStatus::Pending);
    assert_eq!(escrow.dispute_window, DISPUTE_WINDOW);
    assert_eq!(escrow.release_after, 0u64);

    assert_eq!(TokenClient::new(&env, &token).balance(&contract_id), 5_000);
    assert_eq!(TokenClient::new(&env, &token).balance(&depositor), 5_000);
}

#[test]
#[should_panic(expected = "Error(Contract, #5004)")]
fn test_create_escrow_duplicate_id_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let depositor = Address::generate(&env);
    let beneficiary = Address::generate(&env);
    let token = setup_token(&env, &admin, &depositor, 20_000);

    let contract_id = setup_contract(&env);
    let client = init(&env, &contract_id, &admin, &token);

    client.create_escrow(
        &depositor,
        &String::from_str(&env, "esc-001"),
        &beneficiary,
        &5_000i128,
        &String::from_str(&env, "Deposit A"),
        &0u64,
    );
    client.create_escrow(
        &depositor,
        &String::from_str(&env, "esc-001"),
        &beneficiary,
        &5_000i128,
        &String::from_str(&env, "Deposit B"),
        &0u64,
    );
}

#[test]
#[should_panic(expected = "Error(Contract, #5010)")]
fn test_create_escrow_zero_amount_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let depositor = Address::generate(&env);
    let beneficiary = Address::generate(&env);
    let token = setup_token(&env, &admin, &depositor, 10_000);

    let contract_id = setup_contract(&env);
    let client = init(&env, &contract_id, &admin, &token);

    client.create_escrow(
        &depositor,
        &String::from_str(&env, "esc-001"),
        &beneficiary,
        &0i128,
        &String::from_str(&env, "Zero deposit"),
        &0u64,
    );
}

#[test]
#[should_panic(expected = "Error(Contract, #5010)")]
fn test_create_escrow_negative_amount_fails() {
    // Boundary case alongside the zero-amount test above — the contract
    // checks `amount <= 0`, so this guards against a future refactor
    // narrowing that to `== 0` and silently letting negative amounts (and
    // whatever nonsense a negative transfer means) through.
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let depositor = Address::generate(&env);
    let beneficiary = Address::generate(&env);
    let token = setup_token(&env, &admin, &depositor, 10_000);

    let contract_id = setup_contract(&env);
    let client = init(&env, &contract_id, &admin, &token);

    client.create_escrow(
        &depositor,
        &String::from_str(&env, "esc-001"),
        &beneficiary,
        &-100i128,
        &String::from_str(&env, "Negative deposit"),
        &0u64,
    );
}

// NOTE: this test assumes `create_escrow` validates that a non-zero
// `release_after` is strictly in the future (returning the new
// `Error::InvalidReleaseTime` / #5013) — see the errors.rs addition and the
// corresponding lib.rs check suggested alongside it. If that validation
// hasn't been merged into create_escrow yet, this test will fail (the call
// will succeed instead of panicking). Remove or adjust once that lands.
#[test]
#[should_panic(expected = "Error(Contract, #5013)")]
fn test_create_escrow_release_after_in_past_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let depositor = Address::generate(&env);
    let beneficiary = Address::generate(&env);
    let token = setup_token(&env, &admin, &depositor, 10_000);

    let contract_id = setup_contract(&env);
    let client = init(&env, &contract_id, &admin, &token);

    // Advance the ledger first so `now > 0`, making a `release_after` of 1
    // unambiguously in the past rather than relying on the default
    // timestamp already being past 1.
    advance_time(&env, 10_000);
    let now = env.ledger().timestamp();

    client.create_escrow(
        &depositor,
        &String::from_str(&env, "esc-001"),
        &beneficiary,
        &5_000i128,
        &String::from_str(&env, "Already-claimable deposit"),
        &(now - 1),
    );
}

#[test]
#[should_panic(expected = "Error(Contract, #5003)")]
fn test_get_escrow_not_found_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let token = Address::generate(&env);

    let contract_id = setup_contract(&env);
    let client = init(&env, &contract_id, &admin, &token);

    client.get_escrow(&String::from_str(&env, "does-not-exist"));
}

// ── Admin release / refund ────────────────────────────────────────────────────

#[test]
fn test_release_sends_funds_to_beneficiary() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let depositor = Address::generate(&env);
    let beneficiary = Address::generate(&env);
    let token = setup_token(&env, &admin, &depositor, 10_000);

    let contract_id = setup_contract(&env);
    let client = init(&env, &contract_id, &admin, &token);

    client.create_escrow(
        &depositor,
        &String::from_str(&env, "esc-001"),
        &beneficiary,
        &5_000i128,
        &String::from_str(&env, "Deposit"),
        &0u64,
    );

    client.release(&admin, &String::from_str(&env, "esc-001"));

    assert_eq!(TokenClient::new(&env, &token).balance(&beneficiary), 5_000);
    assert_eq!(TokenClient::new(&env, &token).balance(&contract_id), 0);

    let escrow = client.get_escrow(&String::from_str(&env, "esc-001"));
    assert_eq!(escrow.status, EscrowStatus::Released);
    assert!(escrow.resolved_at.is_some());
}

#[test]
fn test_refund_returns_funds_to_depositor() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let depositor = Address::generate(&env);
    let beneficiary = Address::generate(&env);
    let token = setup_token(&env, &admin, &depositor, 10_000);

    let contract_id = setup_contract(&env);
    let client = init(&env, &contract_id, &admin, &token);

    client.create_escrow(
        &depositor,
        &String::from_str(&env, "esc-001"),
        &beneficiary,
        &5_000i128,
        &String::from_str(&env, "Deposit"),
        &0u64,
    );

    client.refund(&admin, &String::from_str(&env, "esc-001"));

    assert_eq!(TokenClient::new(&env, &token).balance(&depositor), 10_000); // fully restored
    assert_eq!(TokenClient::new(&env, &token).balance(&contract_id), 0);

    let escrow = client.get_escrow(&String::from_str(&env, "esc-001"));
    assert_eq!(escrow.status, EscrowStatus::Refunded);
}

#[test]
#[should_panic(expected = "Error(Contract, #5001)")]
fn test_release_non_admin_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let depositor = Address::generate(&env);
    let beneficiary = Address::generate(&env);
    let token = setup_token(&env, &admin, &depositor, 10_000);

    let contract_id = setup_contract(&env);
    let client = init(&env, &contract_id, &admin, &token);

    client.create_escrow(
        &depositor,
        &String::from_str(&env, "esc-001"),
        &beneficiary,
        &5_000i128,
        &String::from_str(&env, "Deposit"),
        &0u64,
    );

    // Depositor is not the admin — Unauthorized.
    client.release(&depositor, &String::from_str(&env, "esc-001"));
}

#[test]
#[should_panic(expected = "Error(Contract, #5001)")]
fn test_refund_non_admin_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let depositor = Address::generate(&env);
    let beneficiary = Address::generate(&env);
    let token = setup_token(&env, &admin, &depositor, 10_000);

    let contract_id = setup_contract(&env);
    let client = init(&env, &contract_id, &admin, &token);

    client.create_escrow(
        &depositor,
        &String::from_str(&env, "esc-001"),
        &beneficiary,
        &5_000i128,
        &String::from_str(&env, "Deposit"),
        &0u64,
    );

    // Beneficiary is not the admin — Unauthorized. refund() has its own
    // require_admin call independent of release()'s, so this exercises a
    // genuinely different code path even though the error is the same.
    client.refund(&beneficiary, &String::from_str(&env, "esc-001"));
}

#[test]
#[should_panic(expected = "Error(Contract, #5005)")]
fn test_release_already_released_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let depositor = Address::generate(&env);
    let beneficiary = Address::generate(&env);
    let token = setup_token(&env, &admin, &depositor, 10_000);

    let contract_id = setup_contract(&env);
    let client = init(&env, &contract_id, &admin, &token);

    client.create_escrow(
        &depositor,
        &String::from_str(&env, "esc-001"),
        &beneficiary,
        &5_000i128,
        &String::from_str(&env, "Deposit"),
        &0u64,
    );

    client.release(&admin, &String::from_str(&env, "esc-001"));
    // Already Released, not Pending — EscrowNotPending.
    client.release(&admin, &String::from_str(&env, "esc-001"));
}

// ── Dispute flow ──────────────────────────────────────────────────────────────

#[test]
fn test_raise_dispute_within_window() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let depositor = Address::generate(&env);
    let beneficiary = Address::generate(&env);
    let token = setup_token(&env, &admin, &depositor, 10_000);

    let contract_id = setup_contract(&env);
    let client = init(&env, &contract_id, &admin, &token);

    client.create_escrow(
        &depositor,
        &String::from_str(&env, "esc-001"),
        &beneficiary,
        &5_000i128,
        &String::from_str(&env, "Deposit"),
        &0u64,
    );

    // Advance by 1 hour — still within 24-hour window
    advance_time(&env, 3_600);
    client.raise_dispute(&depositor, &String::from_str(&env, "esc-001"));

    let escrow = client.get_escrow(&String::from_str(&env, "esc-001"));
    assert_eq!(escrow.status, EscrowStatus::Disputed);
    assert!(escrow.dispute_raised_at.is_some());
}

#[test]
#[should_panic(expected = "Error(Contract, #5001)")]
fn test_raise_dispute_non_depositor_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let depositor = Address::generate(&env);
    let beneficiary = Address::generate(&env);
    let token = setup_token(&env, &admin, &depositor, 10_000);

    let contract_id = setup_contract(&env);
    let client = init(&env, &contract_id, &admin, &token);

    client.create_escrow(
        &depositor,
        &String::from_str(&env, "esc-001"),
        &beneficiary,
        &5_000i128,
        &String::from_str(&env, "Deposit"),
        &0u64,
    );

    // Beneficiary did not deposit these funds — only the depositor may
    // raise a dispute. Unauthorized.
    client.raise_dispute(&beneficiary, &String::from_str(&env, "esc-001"));
}

#[test]
#[should_panic(expected = "Error(Contract, #5007)")]
fn test_raise_dispute_after_window_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let depositor = Address::generate(&env);
    let beneficiary = Address::generate(&env);
    let token = setup_token(&env, &admin, &depositor, 10_000);

    let contract_id = setup_contract(&env);
    let client = init(&env, &contract_id, &admin, &token);

    client.create_escrow(
        &depositor,
        &String::from_str(&env, "esc-001"),
        &beneficiary,
        &5_000i128,
        &String::from_str(&env, "Deposit"),
        &0u64,
    );

    // Advance past the 24-hour window
    advance_time(&env, DISPUTE_WINDOW + 1);
    client.raise_dispute(&depositor, &String::from_str(&env, "esc-001"));
}

#[test]
#[should_panic(expected = "Error(Contract, #5007)")]
fn test_raise_dispute_when_window_zero_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let depositor = Address::generate(&env);
    let beneficiary = Address::generate(&env);
    let token = setup_token(&env, &admin, &depositor, 10_000);

    let contract_id = setup_contract(&env);
    // Initialise with dispute window = 0 (disputes disabled)
    let client = PaymentEscrowContractClient::new(&env, &contract_id);
    client.initialize(&admin, &token, &0u64);

    client.create_escrow(
        &depositor,
        &String::from_str(&env, "esc-001"),
        &beneficiary,
        &5_000i128,
        &String::from_str(&env, "No-dispute deposit"),
        &0u64,
    );

    // window == 0 for this escrow — DisputeWindowClosed.
    client.raise_dispute(&depositor, &String::from_str(&env, "esc-001"));
}

#[test]
fn test_resolve_dispute_releases_to_beneficiary() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let depositor = Address::generate(&env);
    let beneficiary = Address::generate(&env);
    let token = setup_token(&env, &admin, &depositor, 10_000);

    let contract_id = setup_contract(&env);
    let client = init(&env, &contract_id, &admin, &token);

    client.create_escrow(
        &depositor,
        &String::from_str(&env, "esc-001"),
        &beneficiary,
        &5_000i128,
        &String::from_str(&env, "Deposit"),
        &0u64,
    );

    client.raise_dispute(&depositor, &String::from_str(&env, "esc-001"));
    client.resolve_dispute(&admin, &String::from_str(&env, "esc-001"), &true);

    assert_eq!(TokenClient::new(&env, &token).balance(&beneficiary), 5_000);
    let escrow = client.get_escrow(&String::from_str(&env, "esc-001"));
    assert_eq!(escrow.status, EscrowStatus::Released);
}

#[test]
fn test_resolve_dispute_refunds_to_depositor() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let depositor = Address::generate(&env);
    let beneficiary = Address::generate(&env);
    let token = setup_token(&env, &admin, &depositor, 10_000);

    let contract_id = setup_contract(&env);
    let client = init(&env, &contract_id, &admin, &token);

    client.create_escrow(
        &depositor,
        &String::from_str(&env, "esc-001"),
        &beneficiary,
        &5_000i128,
        &String::from_str(&env, "Deposit"),
        &0u64,
    );

    client.raise_dispute(&depositor, &String::from_str(&env, "esc-001"));
    client.resolve_dispute(&admin, &String::from_str(&env, "esc-001"), &false);

    assert_eq!(TokenClient::new(&env, &token).balance(&depositor), 10_000); // full refund
    let escrow = client.get_escrow(&String::from_str(&env, "esc-001"));
    assert_eq!(escrow.status, EscrowStatus::Refunded);
}

#[test]
#[should_panic(expected = "Error(Contract, #5006)")]
fn test_resolve_dispute_on_pending_escrow_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let depositor = Address::generate(&env);
    let beneficiary = Address::generate(&env);
    let token = setup_token(&env, &admin, &depositor, 10_000);

    let contract_id = setup_contract(&env);
    let client = init(&env, &contract_id, &admin, &token);

    client.create_escrow(
        &depositor,
        &String::from_str(&env, "esc-001"),
        &beneficiary,
        &5_000i128,
        &String::from_str(&env, "Deposit"),
        &0u64,
    );

    // Escrow is still Pending, no dispute raised — EscrowNotDisputed.
    client.resolve_dispute(&admin, &String::from_str(&env, "esc-001"), &true);
}

// ── Auto-claim ────────────────────────────────────────────────────────────────

#[test]
fn test_claim_after_release_time_succeeds() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let depositor = Address::generate(&env);
    let beneficiary = Address::generate(&env);
    let token = setup_token(&env, &admin, &depositor, 10_000);

    let contract_id = setup_contract(&env);
    let client = init(&env, &contract_id, &admin, &token);

    let now = env.ledger().timestamp();
    let release_after = now + 3_600; // 1 hour from now

    client.create_escrow(
        &depositor,
        &String::from_str(&env, "esc-001"),
        &beneficiary,
        &5_000i128,
        &String::from_str(&env, "Time-locked payment"),
        &release_after,
    );

    // Advance past release_after
    advance_time(&env, 3_601);
    client.claim(&beneficiary, &String::from_str(&env, "esc-001"));

    assert_eq!(TokenClient::new(&env, &token).balance(&beneficiary), 5_000);
    let escrow = client.get_escrow(&String::from_str(&env, "esc-001"));
    assert_eq!(escrow.status, EscrowStatus::Released);
}

#[test]
#[should_panic(expected = "Error(Contract, #5008)")]
fn test_claim_before_release_time_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let depositor = Address::generate(&env);
    let beneficiary = Address::generate(&env);
    let token = setup_token(&env, &admin, &depositor, 10_000);

    let contract_id = setup_contract(&env);
    let client = init(&env, &contract_id, &admin, &token);

    let now = env.ledger().timestamp();
    let release_after = now + 3_600;

    client.create_escrow(
        &depositor,
        &String::from_str(&env, "esc-001"),
        &beneficiary,
        &5_000i128,
        &String::from_str(&env, "Time-locked payment"),
        &release_after,
    );

    // Not enough time has passed — ClaimTooEarly.
    client.claim(&beneficiary, &String::from_str(&env, "esc-001"));
}

#[test]
#[should_panic(expected = "Error(Contract, #5009)")]
fn test_claim_when_auto_claim_disabled_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let depositor = Address::generate(&env);
    let beneficiary = Address::generate(&env);
    let token = setup_token(&env, &admin, &depositor, 10_000);

    let contract_id = setup_contract(&env);
    let client = init(&env, &contract_id, &admin, &token);

    // release_after = 0 disables auto-claim
    client.create_escrow(
        &depositor,
        &String::from_str(&env, "esc-001"),
        &beneficiary,
        &5_000i128,
        &String::from_str(&env, "Admin-only deposit"),
        &0u64,
    );

    // AutoClaimDisabled.
    client.claim(&beneficiary, &String::from_str(&env, "esc-001"));
}

#[test]
#[should_panic(expected = "Error(Contract, #5001)")]
fn test_claim_non_beneficiary_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let depositor = Address::generate(&env);
    let beneficiary = Address::generate(&env);
    let token = setup_token(&env, &admin, &depositor, 10_000);

    let contract_id = setup_contract(&env);
    let client = init(&env, &contract_id, &admin, &token);

    let now = env.ledger().timestamp();
    let release_after = now + 3_600;

    client.create_escrow(
        &depositor,
        &String::from_str(&env, "esc-001"),
        &beneficiary,
        &5_000i128,
        &String::from_str(&env, "Time-locked payment"),
        &release_after,
    );

    advance_time(&env, 3_601);
    // Depositor is not the beneficiary — Unauthorized, even though
    // release_after has passed and the escrow is otherwise claimable.
    client.claim(&depositor, &String::from_str(&env, "esc-001"));
}

// ── Pause controls ───────────────────────────────────────────────────────────

#[test]
fn test_pause_blocks_state_changing_calls_then_unpause_restores() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let depositor = Address::generate(&env);
    let beneficiary = Address::generate(&env);
    let token = setup_token(&env, &admin, &depositor, 10_000);

    let contract_id = setup_contract(&env);
    let client = init(&env, &contract_id, &admin, &token);

    assert!(!client.is_paused());

    client.pause(&admin);
    assert!(client.is_paused());

    let create_result = client.try_create_escrow(
        &depositor,
        &String::from_str(&env, "esc-001"),
        &beneficiary,
        &5_000i128,
        &String::from_str(&env, "Deposit"),
        &0u64,
    );
    assert_eq!(
        create_result,
        Err(Ok(Error::ContractPaused)),
        "create_escrow should be rejected while paused"
    );

    client.unpause(&admin);
    assert!(!client.is_paused());

    // Same call now succeeds post-unpause, confirming pause/unpause
    // actually gates behavior rather than just flipping a flag nothing
    // reads.
    client.create_escrow(
        &depositor,
        &String::from_str(&env, "esc-001"),
        &beneficiary,
        &5_000i128,
        &String::from_str(&env, "Deposit"),
        &0u64,
    );
    let escrow = client.get_escrow(&String::from_str(&env, "esc-001"));
    assert_eq!(escrow.status, EscrowStatus::Pending);
}

#[test]
#[should_panic(expected = "Error(Contract, #5001)")]
fn test_pause_non_admin_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let depositor = Address::generate(&env);
    let token = setup_token(&env, &admin, &depositor, 10_000);

    let contract_id = setup_contract(&env);
    let client = init(&env, &contract_id, &admin, &token);

    // Depositor is not the admin — Unauthorized.
    client.pause(&depositor);
}

// ── Indexes ───────────────────────────────────────────────────────────────────

#[test]
fn test_depositor_and_beneficiary_indexes() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let depositor = Address::generate(&env);
    let beneficiary = Address::generate(&env);
    let token = setup_token(&env, &admin, &depositor, 50_000);

    let contract_id = setup_contract(&env);
    let client = init(&env, &contract_id, &admin, &token);

    let ids = [
        String::from_str(&env, "esc-001"),
        String::from_str(&env, "esc-002"),
        String::from_str(&env, "esc-003"),
    ];

    for id in &ids {
        client.create_escrow(
            &depositor,
            id,
            &beneficiary,
            &1_000i128,
            &String::from_str(&env, "Deposit"),
            &0u64,
        );
    }

    // Checks exact contents, not just length — a length-only assertion
    // would still pass even if, say, the wrong ID or a duplicate ended up
    // in the list instead of the correct set.
    let mut expected = Vec::new(&env);
    for id in &ids {
        expected.push_back(id.clone());
    }

    assert_eq!(client.get_depositor_escrows(&depositor), expected);
    assert_eq!(client.get_beneficiary_escrows(&beneficiary), expected);
}

// ── Dispute window update ─────────────────────────────────────────────────────

#[test]
fn test_set_dispute_window_applies_to_new_escrows() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let depositor = Address::generate(&env);
    let beneficiary = Address::generate(&env);
    let token = setup_token(&env, &admin, &depositor, 20_000);

    let contract_id = setup_contract(&env);
    let client = init(&env, &contract_id, &admin, &token);

    // Change window to 48 hours
    client.set_dispute_window(&admin, &172_800u64);
    assert_eq!(client.dispute_window(), 172_800u64);

    client.create_escrow(
        &depositor,
        &String::from_str(&env, "esc-002"),
        &beneficiary,
        &5_000i128,
        &String::from_str(&env, "Deposit"),
        &0u64,
    );

    let escrow = client.get_escrow(&String::from_str(&env, "esc-002"));
    // New escrow picks up the updated window
    assert_eq!(escrow.dispute_window, 172_800u64);
}