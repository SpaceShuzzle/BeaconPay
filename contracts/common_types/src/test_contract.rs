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
    fn setup() -> (Env, TestTypesContractClient<'static>) {
        let env = Env::default();
        let contract_id = env.register(TestTypesContract, ());
        let client = TestTypesContractClient::new(&env, &contract_id);

        // Extend lifetime for convenience in tests
        let client = unsafe {
            core::mem::transmute::<
                TestTypesContractClient<'_>,
                TestTypesContractClient<'static>,
            >(client)
        };

        (env, client)
    }

    #[test]
    fn test_subscription_plan_variants() {
        let (_, client) = setup();

        let plans = [
            SubscriptionPlan::Daily,
            SubscriptionPlan::Monthly,
            SubscriptionPlan::PayPerUse,
        ];

        for plan in plans {
            assert_eq!(client.test_subscription(&plan), plan);
        }
    }

    #[test]
    fn test_attendance_action_variants() {
        let (_, client) = setup();

        let actions = [
            AttendanceAction::ClockIn,
            AttendanceAction::ClockOut,
        ];

        for action in actions {
            assert_eq!(client.test_attendance(&action), action);
        }
    }

    #[test]
    fn test_user_role_variants() {
        let (_, client) = setup();

        let roles = [
            UserRole::Admin,
            UserRole::Staff,
        ];

        for role in roles {
            assert_eq!(client.test_role(&role), role);
        }
    }

    #[test]
    fn test_membership_status_variants() {
        let (_, client) = setup();

        let statuses = [
            MembershipStatus::Active,
            MembershipStatus::Revoked,
        ];

        for status in statuses {
            assert_eq!(client.test_status(&status), status);
        }
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

        assert_eq!(result, Symbol::new(&env, SUCCESS));
    }
}