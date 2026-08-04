//! Contract and tests for verifying common shared types.
//!
//! These tests ensure that all shared enums are correctly serialized and
//! deserialized across the Soroban contract boundary.

use crate::{AttendanceAction, MembershipStatus, SubscriptionPlan, UserRole};
use soroban_sdk::{contract, contractimpl, Env, Symbol};

const SUCCESS: &str = "success";

#[contract]
pub struct TestTypesContract;

#[contractimpl]
impl TestTypesContract {
    /// Echoes the supplied subscription plan.
    pub fn test_subscription(plan: SubscriptionPlan) -> SubscriptionPlan {
        plan
    }

    /// Echoes the supplied attendance action.
    pub fn test_attendance(action: AttendanceAction) -> AttendanceAction {
        action
    }

    /// Echoes the supplied user role.
    pub fn test_role(role: UserRole) -> UserRole {
        role
    }

    /// Echoes the supplied membership status.
    pub fn test_status(status: MembershipStatus) -> MembershipStatus {
        status
    }

    /// Verifies that all shared types can be passed through a contract call.
    pub fn test_all_types(
        env: Env,
        _plan: SubscriptionPlan,
        _action: AttendanceAction,
        _role: UserRole,
        _status: MembershipStatus,
    ) -> Symbol {
        Symbol::new(&env, SUCCESS)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Creates a fresh contract client for each test.
    ///
    /// `Env` isn't `'static`, but `TestTypesContractClient` borrows it — so
    /// returning both from one function normally means the client's
    /// lifetime is tied to a local that's about to be dropped. `Box::leak`
    /// gives the `Env` a genuine `'static` lifetime instead of transmuting
    /// one into existence: the leak is real (the `Env` lives for the rest
    /// of the process), but it's scoped to a single short-lived test
    /// process, sound, and doesn't rely on `Env`'s internal representation
    /// happening to survive being transmuted.
    fn setup() -> (&'static Env, TestTypesContractClient<'static>) {
        let env: &'static Env = Box::leak(Box::new(Env::default()));
        let contract_id = env.register(TestTypesContract, ());
        let client = TestTypesContractClient::new(env, &contract_id);
        (env, client)
    }

    /// Asserts that every value in `values` round-trips unchanged through
    /// `call`, with the failing value shown on assertion failure instead of
    /// a bare `left != right` with no indication of which variant broke.
    fn assert_round_trip<T, F>(values: &[T], call: F)
    where
        T: PartialEq + core::fmt::Debug + Clone,
        F: Fn(&T) -> T,
    {
        for value in values {
            let result = call(value);
            assert_eq!(
                &result, value,
                "round-trip failed: sent {value:?}, got back {result:?}"
            );
        }
    }

    // ── Exhaustiveness guards ────────────────────────────────────────────
    // Each of these matches every variant with no wildcard arm. That means
    // if a variant is ever added to the enum elsewhere in the crate without
    // also being added to the corresponding `all_*` list below, THIS FILE
    // FAILS TO COMPILE — so round-trip coverage can't silently go stale as
    // the shared types evolve. If you hit a compile error here after adding
    // a variant, that's the point: add it to the matching list too.

    fn all_subscription_plans() -> [SubscriptionPlan; 3] {
        fn _exhaustive(p: SubscriptionPlan) {
            match p {
                SubscriptionPlan::Daily => {}
                SubscriptionPlan::Monthly => {}
                SubscriptionPlan::PayPerUse => {}
            }
        }
        [
            SubscriptionPlan::Daily,
            SubscriptionPlan::Monthly,
            SubscriptionPlan::PayPerUse,
        ]
    }

    fn all_attendance_actions() -> [AttendanceAction; 2] {
        fn _exhaustive(a: AttendanceAction) {
            match a {
                AttendanceAction::ClockIn => {}
                AttendanceAction::ClockOut => {}
            }
        }
        [AttendanceAction::ClockIn, AttendanceAction::ClockOut]
    }

    fn all_user_roles() -> [UserRole; 2] {
        fn _exhaustive(r: UserRole) {
            match r {
                UserRole::Admin => {}
                UserRole::Staff => {}
            }
        }
        [UserRole::Admin, UserRole::Staff]
    }

    fn all_membership_statuses() -> [MembershipStatus; 2] {
        fn _exhaustive(s: MembershipStatus) {
            match s {
                MembershipStatus::Active => {}
                MembershipStatus::Revoked => {}
            }
        }
        [MembershipStatus::Active, MembershipStatus::Revoked]
    }

    #[test]
    fn test_subscription_plan_variants() {
        let (_, client) = setup();
        assert_round_trip(&all_subscription_plans(), |plan| {
            client.test_subscription(plan)
        });
    }

    #[test]
    fn test_attendance_action_variants() {
        let (_, client) = setup();
        assert_round_trip(&all_attendance_actions(), |action| {
            client.test_attendance(action)
        });
    }

    #[test]
    fn test_user_role_variants() {
        let (_, client) = setup();
        assert_round_trip(&all_user_roles(), |role| client.test_role(role));
    }

    #[test]
    fn test_membership_status_variants() {
        let (_, client) = setup();
        assert_round_trip(&all_membership_statuses(), |status| {
            client.test_status(status)
        });
    }

    #[test]
    fn test_all_shared_types_round_trip() {
        let (env, client) = setup();

        let result = client.test_all_types(
            &SubscriptionPlan::PayPerUse,
            &AttendanceAction::ClockOut,
            &UserRole::Staff,
            &MembershipStatus::Active,
        );

        assert_eq!(result, Symbol::new(env, SUCCESS));
    }

    /// `test_all_types` above only exercises one specific combination of
    /// variants. This sweeps every combination across all four enums
    /// through the single multi-arg call, since a bug that only shows up
    /// when e.g. `AttendanceAction::ClockIn` is combined with
    /// `MembershipStatus::Revoked` specifically (argument-ordering /
    /// XDR-encoding interaction) wouldn't be caught by testing each type in
    /// isolation.
    #[test]
    fn test_all_shared_types_combinatorial() {
        let (env, client) = setup();
        let expected = Symbol::new(env, SUCCESS);

        for plan in all_subscription_plans() {
            for action in all_attendance_actions() {
                for role in all_user_roles() {
                    for status in all_membership_statuses() {
                        let result =
                            client.test_all_types(&plan, &action, &role, &status);
                        assert_eq!(
                            result, expected,
                            "test_all_types failed for ({plan:?}, {action:?}, {role:?}, {status:?})"
                        );
                    }
                }
            }
        }
    }
}