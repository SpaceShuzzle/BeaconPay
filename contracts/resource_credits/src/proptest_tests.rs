extern crate std;

use crate::ResourceCreditsContract;
use crate::ResourceCreditsContractClient;
use proptest::prelude::*;
use soroban_sdk::{
    testutils::Address as _,
    Address, Env,
};

/// `Env` isn't `'static`, but `ResourceCreditsContractClient` borrows it —
/// so returning both from one function normally ties the client's lifetime
/// to a local that's about to be dropped. `Box::leak` gives the `Env` a
/// genuine `'static` lifetime instead of relying on the client's `'static`
/// annotation happening to be sound anyway: the leak is real (the `Env`
/// lives for the rest of the test process), but it's scoped to a single
/// short-lived proptest case, which is a fine trade for actually being
/// correct rather than hoping `Env`'s internal representation tolerates
/// the move.
fn setup_test() -> (&'static Env, Address, ResourceCreditsContractClient<'static>) {
    let env: &'static Env = Box::leak(Box::new(Env::default()));
    let contract_id = env.register(ResourceCreditsContract, ());
    let client = ResourceCreditsContractClient::new(env, &contract_id);
    let admin = Address::generate(env);
    let token = Address::generate(env);
    env.mock_all_auths();
    client.initialize(&admin, &token);
    (env, admin, client)
}

proptest! {
    #[test]
    fn spend_never_results_in_negative_balance(
        mint_amount in 1_000u128..1_000_000u128,
        spend_amount in 1u128..2_000_000u128,
    ) {
        let (env, admin, client) = setup_test();
        let user = Address::generate(env);

        let mint_result = client.try_mint_credits(&admin, &user, &mint_amount);
        if mint_result.is_err() {
            return Ok(());
        }

        let spend_result = client.try_spend_credits(&user, &spend_amount);

        let balance = client.balance(&user);

        if spend_amount > mint_amount {
            prop_assert!(
                spend_result.is_err(),
                "Spend should fail: amount {} > balance {}",
                spend_amount, mint_amount,
            );
            prop_assert_eq!(balance, mint_amount, "Balance must not change on failed spend");
        } else {
            prop_assert!(spend_result.is_ok());
            prop_assert_eq!(balance, mint_amount - spend_amount);
        }
    }

    #[test]
    fn sum_of_credits_equals_minted_minus_spent(
        mint_amounts in proptest::collection::vec(100u128..100_000u128, 1..5),
        spend_fractions in proptest::collection::vec(0u128..100u128, 1..5),
    ) {
        let (env, admin, client) = setup_test();
        let mut users = std::vec::Vec::new();
        let mut total_minted: u128 = 0;
        let mut total_spent: u128 = 0;

        for (i, &amount) in mint_amounts.iter().enumerate() {
            let user = Address::generate(env);

            // Only count this mint toward `total_minted` if it actually
            // succeeded — previously this was unconditional (`let _ =
            // ...`), so a call that failed for any reason would still get
            // counted, silently drifting the test's own bookkeeping away
            // from what's actually true on-chain.
            let mint_result = client.try_mint_credits(&admin, &user, &amount);
            if mint_result.is_ok() {
                total_minted += amount;
            }
            users.push(user);

            let fraction = spend_fractions.get(i % spend_fractions.len()).copied().unwrap_or(0);
            let spend_amount = (amount * fraction) / 100;
            if spend_amount > 0 {
                // Same fix: only count spent amount if the spend actually
                // succeeded. If the preceding mint failed, this spend
                // would presumably also fail (nothing to spend) — without
                // checking, that failure would previously still have been
                // added to total_spent.
                let spend_result = client.try_spend_credits(&user, &spend_amount);
                if spend_result.is_ok() {
                    total_spent += spend_amount;
                }
            }
        }

        let mut total_user_balances: u128 = 0;
        for user in &users {
            total_user_balances += client.balance(user);
        }

        prop_assert_eq!(
            total_user_balances,
            total_minted - total_spent,
            "Sum of user balances ({}) != total minted ({}) - total spent ({})",
            total_user_balances, total_minted, total_spent,
        );
    }

    #[test]
    fn transfer_preserves_total_supply(
        supply in 1_000u128..1_000_000u128,
        transfer_amount in 1u128..500_000u128,
    ) {
        let (env, admin, client) = setup_test();
        let sender = Address::generate(env);
        let recipient = Address::generate(env);

        let mint_result = client.try_mint_credits(&admin, &sender, &supply);
        if mint_result.is_err() {
            return Ok(());
        }

        let initial_supply = client.total_supply();
        prop_assert_eq!(initial_supply, supply);

        let transfer_result = client.try_transfer_credits(&sender, &recipient, &transfer_amount);

        let final_supply = client.total_supply();

        if transfer_amount > supply {
            prop_assert!(
                transfer_result.is_err(),
                "Transfer should fail: amount {} > balance {}",
                transfer_amount, supply,
            );
            prop_assert_eq!(final_supply, supply, "Supply must not change on failed transfer");
        } else {
            prop_assert!(transfer_result.is_ok());
            prop_assert_eq!(final_supply, supply, "Transfer must preserve total supply");

            let sender_balance = client.balance(&sender);
            let recipient_balance = client.balance(&recipient);
            prop_assert_eq!(
                sender_balance + recipient_balance,
                supply,
                "Balances must sum to supply after transfer",
            );
        }
    }
}

// ── Deterministic boundary regression tests ─────────────────────────────────
//
// These live outside the `proptest!` block on purpose: they target exact
// boundary values (spend precisely the full balance, mint near u128::MAX)
// that a continuous random range essentially never samples by chance, no
// matter how many cases proptest runs. Random property tests are great at
// covering the general shape of a property across the input space; they're
// bad at reliably hitting one specific edge — that's what plain #[test]s
// are for.

#[test]
fn spend_exact_balance_succeeds_and_zeroes_out() {
    let (env, admin, client) = setup_test();
    let user = Address::generate(env);

    let mint_amount: u128 = 5_000;
    client.mint_credits(&admin, &user, &mint_amount);

    // Spending exactly the full balance — the `spend_amount > mint_amount`
    // vs `spend_amount <= mint_amount` boundary from the property test
    // above, pinned to its exact edge instead of hoping a random sample
    // lands on it.
    let result = client.try_spend_credits(&user, &mint_amount);
    assert!(result.is_ok(), "spending exactly the full balance should succeed");
    assert_eq!(client.balance(&user), 0, "balance should be exactly zero after spending it all");
}

#[test]
fn spend_one_more_than_balance_fails() {
    let (env, admin, client) = setup_test();
    let user = Address::generate(env);

    let mint_amount: u128 = 5_000;
    client.mint_credits(&admin, &user, &mint_amount);

    let result = client.try_spend_credits(&user, &(mint_amount + 1));
    assert!(result.is_err(), "spending one more than the balance should fail");
    assert_eq!(client.balance(&user), mint_amount, "balance must be unchanged after a rejected spend");
}

#[test]
fn mint_never_silently_wraps_balance_on_overflow() {
    let (env, admin, client) = setup_test();
    let user = Address::generate(env);

    // Deliberately near u128::MAX rather than a randomly-sampled value —
    // a uniform random u128 strategy would need to be extraordinarily
    // lucky to land anywhere near the top of that range, so overflow
    // behavior specifically needs a targeted boundary test like this one.
    let huge = u128::MAX - 1;

    let first_mint = client.try_mint_credits(&admin, &user, &huge);
    if first_mint.is_err() {
        // The contract may legitimately cap mint size below u128::MAX —
        // that's an acceptable design choice. Nothing further to check in
        // that case; the balance should simply be untouched.
        assert_eq!(client.balance(&user), 0);
        return;
    }
    let balance_after_first = client.balance(&user);

    let second_mint = client.try_mint_credits(&admin, &user, &2u128);
    let balance_after_second = client.balance(&user);

    if second_mint.is_ok() {
        // If the second mint was accepted, the balance must reflect a
        // real addition — NOT a wraparound that produced a number smaller
        // than the balance before this call, which is what silent u128
        // overflow would look like.
        assert!(
            balance_after_second >= balance_after_first,
            "balance decreased after a successful mint — looks like silent overflow wraparound: {} -> {}",
            balance_after_first, balance_after_second,
        );
    } else {
        // Rejecting the overflowing mint (e.g. via checked_add) is the
        // correct, safe behavior — balance should be left untouched.
        assert_eq!(balance_after_second, balance_after_first);
    }
}