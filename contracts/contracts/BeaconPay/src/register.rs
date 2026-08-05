use crate::errors::Error;
use crate::types::TokenAllowance;
use soroban_sdk::{contracttype, Address, BytesN, Env, String};

#[contracttype]
pub enum AllowanceDataKey {
    Allowance(BytesN<32>, Address, Address),
}

// Soroban archives persistent storage entries that go too long without
// activity, independent of any application-level `expires_at` you store —
// so allowances need their own TTL bumped on write/read or they can be
// evicted from the ledger even while still logically valid, requiring a
// restore before they're usable again.
//
// Tune these to your app's actual usage pattern; these are conservative
// defaults (assumes ~5s average ledger close time, per Soroban's current
// mainnet parameters):
const DAY_IN_LEDGERS: u32 = 17_280;
/// Extend the TTL once it drops below this many ledgers remaining.
const ALLOWANCE_TTL_THRESHOLD: u32 = DAY_IN_LEDGERS * 30;
/// When extending, push the TTL out to this many ledgers from now.
const ALLOWANCE_TTL_EXTEND_TO: u32 = DAY_IN_LEDGERS * 90;

pub struct AllowanceModule;

impl AllowanceModule {
    /// Grants `spender` an allowance of `amount` against `owner`'s tokens.
    ///
    /// Requires `owner`'s authorization — without this, any address could
    /// grant allowances on behalf of any other address, which is exactly
    /// the bug this fixes.
    pub fn approve(
        env: &Env,
        token_id: &BytesN<32>,
        owner: &Address,
        spender: &Address,
        amount: i128,
        expires_at: Option<u64>,
    ) -> Result<(), Error> {
        owner.require_auth();

        if amount <= 0 {
            return Err(Error::InvalidPaymentAmount);
        }
        if owner == spender {
            return Err(Error::Unauthorized);
        }
        if let Some(expiry) = expires_at {
            if expiry <= env.ledger().timestamp() {
                return Err(Error::InvalidExpiryDate);
            }
        }

        let allowance = TokenAllowance {
            token_id: token_id.clone(),
            owner: owner.clone(),
            spender: spender.clone(),
            amount,
            expires_at,
            updated_at: env.ledger().timestamp(),
        };

        let key =
            AllowanceDataKey::Allowance(token_id.clone(), owner.clone(), spender.clone());
        env.storage().persistent().set(&key, &allowance);
        env.storage().persistent().extend_ttl(
            &key,
            ALLOWANCE_TTL_THRESHOLD,
            ALLOWANCE_TTL_EXTEND_TO,
        );

        env.events().publish(
            (
                String::from_str(env, "Approval"),
                token_id.clone(),
                owner.clone(),
                spender.clone(),
            ),
            (amount, expires_at, allowance.updated_at),
        );

        Ok(())
    }

    /// Revokes any existing allowance from `owner` to `spender`.
    ///
    /// Requires `owner`'s authorization — same reasoning as `approve`:
    /// without this, any address could revoke any other allowance,
    /// griefing spenders by yanking allowances they were relying on.
    pub fn revoke_allowance(env: &Env, token_id: &BytesN<32>, owner: &Address, spender: &Address) {
        owner.require_auth();

        env.storage()
            .persistent()
            .remove(&AllowanceDataKey::Allowance(
                token_id.clone(),
                owner.clone(),
                spender.clone(),
            ));

        env.events().publish(
            (
                String::from_str(env, "AllowanceRevoked"),
                token_id.clone(),
                owner.clone(),
                spender.clone(),
            ),
            env.ledger().timestamp(),
        );
    }

    /// Reads the current allowance from `owner` to `spender`, if any.
    ///
    /// Note: this has a write side effect — an expired entry is deleted
    /// from storage as it's discovered, and a still-valid entry has its
    /// TTL bumped on read (`extend_ttl`) so allowances that are actively
    /// being checked don't get archived purely from inactivity between
    /// `approve`/`consume_allowance` calls. Both are intentional storage
    /// hygiene, not incidental — but worth knowing if you call this from a
    /// context where you don't expect a "read" to touch storage.
    pub fn get_allowance(
        env: &Env,
        token_id: &BytesN<32>,
        owner: &Address,
        spender: &Address,
    ) -> Option<TokenAllowance> {
        let key = AllowanceDataKey::Allowance(token_id.clone(), owner.clone(), spender.clone());
        let allowance: Option<TokenAllowance> = env.storage().persistent().get(&key);

        if let Some(current) = allowance {
            if Self::is_expired(env, &current) {
                env.storage().persistent().remove(&key);
                return None;
            }
            env.storage().persistent().extend_ttl(
                &key,
                ALLOWANCE_TTL_THRESHOLD,
                ALLOWANCE_TTL_EXTEND_TO,
            );
            return Some(current);
        }

        None
    }

    /// Spends `amount` from the allowance `owner` granted to `spender`.
    ///
    /// Requires `spender`'s authorization — without this, any address
    /// could drain any allowance regardless of who it was actually granted
    /// to, which defeats the entire purpose of an allowance system.
    pub fn consume_allowance(
        env: &Env,
        token_id: &BytesN<32>,
        owner: &Address,
        spender: &Address,
        amount: i128,
    ) -> Result<(), Error> {
        spender.require_auth();

        if amount <= 0 {
            return Err(Error::InvalidPaymentAmount);
        }

        let key = AllowanceDataKey::Allowance(token_id.clone(), owner.clone(), spender.clone());
        let mut allowance: TokenAllowance = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(Error::Unauthorized)?;

        if Self::is_expired(env, &allowance) {
            env.storage().persistent().remove(&key);
            return Err(Error::Unauthorized);
        }

        if allowance.amount < amount {
            return Err(Error::InsufficientBalance);
        }

        // Safe: the check above (`allowance.amount < amount` -> early
        // return) already guarantees `allowance.amount >= amount`, so this
        // subtraction cannot underflow. The previous `checked_sub(...)
        // .ok_or(Error::TimestampOverflow)` both mapped an unreachable
        // failure to a misleadingly-named error (this has nothing to do
        // with timestamps) and needlessly obscured that the arithmetic
        // here is already proven safe.
        allowance.amount -= amount;
        allowance.updated_at = env.ledger().timestamp();

        if allowance.amount == 0 {
            env.storage().persistent().remove(&key);
        } else {
            env.storage().persistent().set(&key, &allowance);
            env.storage().persistent().extend_ttl(
                &key,
                ALLOWANCE_TTL_THRESHOLD,
                ALLOWANCE_TTL_EXTEND_TO,
            );
        }

        env.events().publish(
            (
                String::from_str(env, "AllowanceUsed"),
                token_id.clone(),
                owner.clone(),
                spender.clone(),
            ),
            (amount, allowance.amount, allowance.updated_at),
        );

        Ok(())
    }

    fn is_expired(env: &Env, allowance: &TokenAllowance) -> bool {
        if let Some(expiry) = allowance.expires_at {
            return env.ledger().timestamp() >= expiry;
        }
        false
    }
}