use soroban_sdk::{contracttype, Address, String};

/// Denominator for basis-point fields throughout this module.
/// 10_000 bps = 100%.
pub const BPS_DENOMINATOR: u32 = 10_000;

/// Staking tier defining lock duration and reward multiplier.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq, Hash)]
pub struct StakingTier {
    /// Unique identifier for this tier (e.g. "bronze", "gold").
    pub id: String,
    /// Human-readable display name.
    pub name: String,
    /// Minimum amount (in the staking token's smallest unit) required to
    /// enter this tier.
    pub min_stake_amount: i128,
    /// Lock duration in seconds from the moment of staking.
    pub lock_duration: u64,
    /// Multiplier applied to `base_rate_bps`, in basis points (10_000 =
    /// 1.0x / no change, 15_000 = 1.5x boost). Confirm this matches how
    /// your reward-calculation logic actually applies it.
    pub reward_multiplier_bps: u32,
    /// Base reward rate in basis points (10_000 = 100%). Confirm the
    /// intended period (per-year, per-epoch, etc.) against your
    /// reward-calculation logic — not specified by this type alone.
    pub base_rate_bps: u32,
}

impl StakingTier {
    /// A tier requiring a non-positive minimum stake is meaningless.
    /// Doesn't validate `reward_multiplier_bps`/`base_rate_bps` against
    /// `BPS_DENOMINATOR` since, unlike a penalty, a multiplier or rate
    /// legitimately exceeding 100% (a >1.0x boost, or a high APY) is
    /// often the entire point of a tier.
    pub fn is_valid(&self) -> bool {
        self.min_stake_amount > 0
    }
}

/// Represents an active stake held by a user.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq, Hash)]
pub struct StakeInfo {
    pub staker: Address,
    /// Amount staked, in the staking token's smallest unit. `i128` (not
    /// `u128`) to stay consistent with the token-transfer convention used
    /// elsewhere (SEP-41 `transfer` takes `i128` amounts), even though a
    /// stake amount is never actually negative in practice.
    pub amount: i128,
    pub tier_id: String,
    /// Unix timestamp the stake was created.
    pub staked_at: u64,
    /// Unix timestamp after which the stake may be withdrawn without the
    /// emergency-unstake penalty.
    pub unlock_at: u64,
    pub claimed_rewards: i128,
    pub emergency_unstaked: bool,
}

impl StakeInfo {
    /// Whether the lock period has elapsed as of `now`.
    pub fn is_unlocked(&self, now: u64) -> bool {
        now >= self.unlock_at
    }

    /// Seconds remaining until unlock, or 0 if already unlocked.
    /// `saturating_sub` rather than `-`: if `now` is ever somehow already
    /// past `unlock_at`, this returns 0 instead of underflowing u64 and
    /// panicking.
    pub fn time_until_unlock(&self, now: u64) -> u64 {
        self.unlock_at.saturating_sub(now)
    }
}

/// Global staking configuration set by admin.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq, Hash)]
pub struct StakingConfig {
    pub staking_enabled: bool,
    /// Penalty applied to an emergency (pre-unlock) withdrawal, in basis
    /// points. Capped at `BPS_DENOMINATOR` (100%) by `is_valid()` — a
    /// penalty above 100% of the staked amount isn't something that can
    /// actually be applied.
    pub emergency_unstake_penalty_bps: u32,
    pub staking_token: Address,
    pub reward_pool: Address,
}

impl StakingConfig {
    pub fn is_valid(&self) -> bool {
        self.emergency_unstake_penalty_bps <= BPS_DENOMINATOR
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::testutils::Address as _;
    use soroban_sdk::Env;

    #[test]
    fn staking_tier_validity() {
        let env = Env::default();
        let valid = StakingTier {
            id: String::from_str(&env, "gold"),
            name: String::from_str(&env, "Gold Tier"),
            min_stake_amount: 1_000,
            lock_duration: 2_592_000,
            reward_multiplier_bps: 15_000,
            base_rate_bps: 500,
        };
        assert!(valid.is_valid());

        let invalid = StakingTier {
            min_stake_amount: 0,
            ..valid.clone()
        };
        assert!(!invalid.is_valid());
    }

    #[test]
    fn staking_config_validity() {
        let env = Env::default();
        let token = Address::generate(&env);
        let reward_pool = Address::generate(&env);

        let valid = StakingConfig {
            staking_enabled: true,
            emergency_unstake_penalty_bps: 2_000,
            staking_token: token,
            reward_pool,
        };
        assert!(valid.is_valid());

        let over_100_percent = StakingConfig {
            emergency_unstake_penalty_bps: BPS_DENOMINATOR + 1,
            ..valid.clone()
        };
        assert!(!over_100_percent.is_valid());

        // Exactly 100% is the allowed boundary, not rejected.
        let exactly_100_percent = StakingConfig {
            emergency_unstake_penalty_bps: BPS_DENOMINATOR,
            ..valid.clone()
        };
        assert!(exactly_100_percent.is_valid());
    }

    #[test]
    fn stake_info_unlock_timing() {
        let env = Env::default();
        let staker = Address::generate(&env);

        let stake = StakeInfo {
            staker,
            amount: 5_000,
            tier_id: String::from_str(&env, "gold"),
            staked_at: 1_000,
            unlock_at: 2_000,
            claimed_rewards: 0,
            emergency_unstaked: false,
        };

        assert!(!stake.is_unlocked(1_500));
        assert_eq!(stake.time_until_unlock(1_500), 500);

        assert!(stake.is_unlocked(2_000), "unlock_at itself should count as unlocked");
        assert_eq!(stake.time_until_unlock(2_000), 0);

        assert!(stake.is_unlocked(3_000));
        assert_eq!(
            stake.time_until_unlock(3_000),
            0,
            "should saturate to 0, not underflow"
        );
    }
}