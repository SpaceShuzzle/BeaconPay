extern crate std;

use crate::{BookingStatus, WorkspaceType};
use proptest::prelude::*;
use soroban_sdk::{
    testutils::Address as _, token::StellarAssetClient, Address, Env, String,
};

use super::WorkspaceBookingContract;
use super::WorkspaceBookingContractClient;

fn setup_test() -> (Env, Address, WorkspaceBookingContractClient<'static>) {
    let env = Env::default();
    let admin = Address::generate(&env);
    env.mock_all_auths();
    let contract_id = env.register(WorkspaceBookingContract, ());
    let client = WorkspaceBookingContractClient::new(&env, &contract_id);
    (env, admin, client)
}

fn setup_token(env: &Env, admin: &Address, recipient: &Address, amount: i128) -> Address {
    let token_address = env
        .register_stellar_asset_contract_v2(admin.clone())
        .address();
    StellarAssetClient::new(env, &token_address).mint(recipient, &amount);
    token_address
}

fn register_test_workspace(env: &Env, client: &WorkspaceBookingContractClient, admin: &Address) {
    client.register_workspace(
        admin,
        &String::from_str(env, "ws-test"),
        &String::from_str(env, "Test Workspace"),
        &WorkspaceType::HotDesk,
        &1u32,
        &500u128,
    );
}

/// Bundles the common per-test setup shared by every property below: a
/// fresh env/contract, an initialized token, a funded member, and one
/// registered capacity-1 workspace. Cuts the same five lines out of each
/// property test.
fn setup_ready_environment() -> (Env, Address, WorkspaceBookingContractClient<'static>) {
    let (env, admin, client) = setup_test();
    let member = Address::generate(&env);
    let token = setup_token(&env, &admin, &member, i128::MAX / 2);
    client.initialize(&admin, &token);
    register_test_workspace(&env, &client, &admin);
    (env, member, client)
}

proptest! {
    // Run with an explicit case count rather than relying on proptest's
    // implicit default — makes the intended thoroughness visible here and
    // gives an obvious knob to turn down for a fast local loop or up for
    // a pre-release run (`PROPTEST_CASES` env var still overrides this).
    #![proptest_config(ProptestConfig::with_cases(256))]

    /// Invariant: two bookings for the same capacity-1 workspace must be
    /// rejected if their time ranges overlap, and must both succeed as
    /// Active if they don't.
    #[test]
    fn no_two_active_bookings_overlap(
        start1 in 100u64..100_000u64,
        duration1 in 3_600u64..86_400u64,
        start2 in 100u64..100_000u64,
        duration2 in 3_600u64..86_400u64,
    ) {
        let (env, member, client) = setup_ready_environment();

        let end1 = start1.saturating_add(duration1);
        let end2 = start2.saturating_add(duration2);
        if start1 >= end1 || start2 >= end2 || end1 <= env.ledger().timestamp() || end2 <= env.ledger().timestamp() {
            return Ok(());
        }

        let booking1_result = client.try_book_workspace(
            &member,
            &String::from_str(&env, "b1"),
            &String::from_str(&env, "ws-test"),
            &start1,
            &end1,
        );

        if booking1_result.is_err() {
            return Ok(());
        }

        let booking2_result = client.try_book_workspace(
            &member,
            &String::from_str(&env, "b2"),
            &String::from_str(&env, "ws-test"),
            &start2,
            &end2,
        );

        let b1 = client.get_booking(&String::from_str(&env, "b1"));
        let slots_overlap = start1 < end2 && start2 < end1;

        if slots_overlap {
            prop_assert!(
                booking2_result.is_err(),
                "Booking conflict not detected: slots [{}, {}) and [{}, {}) overlap",
                start1, end1, start2, end2,
            );
        } else {
            // Previously this branch only checked status *if* booking2
            // happened to succeed, so a contract bug that wrongly rejected
            // a valid non-overlapping booking would pass silently. With a
            // single member booking a capacity-1 workspace across two
            // non-overlapping windows, there's no legitimate reason for
            // this to fail — assert it explicitly.
            prop_assert!(
                booking2_result.is_ok(),
                "Non-overlapping booking incorrectly rejected: slots [{}, {}) and [{}, {}) do not overlap",
                start1, end1, start2, end2,
            );

            let b2 = client.get_booking(&String::from_str(&env, "b2"));
            prop_assert_eq!(b1.status, BookingStatus::Active);
            prop_assert_eq!(b2.status, BookingStatus::Active);
        }
    }

    /// Invariant: cancelling an active booking marks it Cancelled and
    /// actually frees the slot for a new booking — not just reports it as
    /// available.
    #[test]
    fn cancelling_booking_frees_slot(
        start in 100u64..100_000u64,
        duration in 3_600u64..86_400u64,
    ) {
        let (env, member, client) = setup_ready_environment();

        let end = start.saturating_add(duration);
        if start >= end || end <= env.ledger().timestamp() {
            return Ok(());
        }

        let book_result = client.try_book_workspace(
            &member,
            &String::from_str(&env, "b1"),
            &String::from_str(&env, "ws-test"),
            &start,
            &end,
        );
        if book_result.is_err() {
            return Ok(());
        }

        let cancel_result = client.try_cancel_booking(&member, &String::from_str(&env, "b1"));
        prop_assert!(cancel_result.is_ok(), "Cancel failed on active booking");

        let booking = client.get_booking(&String::from_str(&env, "b1"));
        prop_assert_eq!(booking.status, BookingStatus::Cancelled);

        let available = client.check_availability(
            &String::from_str(&env, "ws-test"),
            &start,
            &end,
        );
        prop_assert!(available, "Slot should be free after cancellation");

        // check_availability reporting `true` isn't proof the slot is
        // actually bookable — assert the stronger claim by rebooking it.
        let rebook_result = client.try_book_workspace(
            &member,
            &String::from_str(&env, "b2"),
            &String::from_str(&env, "ws-test"),
            &start,
            &end,
        );
        prop_assert!(
            rebook_result.is_ok(),
            "Slot reported available after cancellation but rebooking it failed"
        );
    }

    /// Invariant: a booking only ever moves Active -> Cancelled, exactly
    /// once, with `cancelled_at` set on the transition; a second cancel
    /// attempt on an already-cancelled booking must be rejected.
    #[test]
    fn booking_status_transitions_are_valid(
        start in 100u64..50_000u64,
        duration in 3_600u64..86_400u64,
    ) {
        let (env, member, client) = setup_ready_environment();

        let end = start.saturating_add(duration);
        if start >= end || end <= env.ledger().timestamp() {
            return Ok(());
        }

        let book_result = client.try_book_workspace(
            &member,
            &String::from_str(&env, "b1"),
            &String::from_str(&env, "ws-test"),
            &start,
            &end,
        );
        if book_result.is_err() {
            return Ok(());
        }

        let booking = client.get_booking(&String::from_str(&env, "b1"));
        prop_assert_eq!(booking.status, BookingStatus::Active);

        let cancel_result = client.try_cancel_booking(&member, &String::from_str(&env, "b1"));
        if cancel_result.is_ok() {
            let booking = client.get_booking(&String::from_str(&env, "b1"));
            prop_assert_eq!(booking.status, BookingStatus::Cancelled);
            prop_assert!(booking.cancelled_at.is_some());

            // A booking cannot be cancelled twice — this is the invalid
            // transition the test's name implies but never actually
            // checked before.
            let second_cancel_result =
                client.try_cancel_booking(&member, &String::from_str(&env, "b1"));
            prop_assert!(
                second_cancel_result.is_err(),
                "Cancelling an already-cancelled booking should be rejected"
            );
        }
    }
}