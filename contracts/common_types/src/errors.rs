use soroban_sdk::contracterror;

/// Errors returned by the Membership Token contract.
///
/// Error Code Range:
/// - 3000–3099: Administrative errors
/// - 3100–3199: Token lifecycle errors
///
/// Each error code is stable and should never be reused for a different
/// error to preserve backward compatibility with clients and indexers.
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum MembershipTokenError {
    // ---------------------------------------------------------------------
    // Administrative Errors (3000–3099)
    // ---------------------------------------------------------------------

    /// No administrator has been configured for the contract.
    ///
    /// Returned when an operation requiring an admin is attempted before
    /// the contract has been initialized.
    AdminNotSet = 3000,

    // ---------------------------------------------------------------------
    // Token Lifecycle Errors (3100–3199)
    // ---------------------------------------------------------------------

    /// A membership token with the specified identifier already exists.
    TokenAlreadyIssued = 3100,

    /// The supplied expiry timestamp is invalid.
    ///
    /// Membership tokens must expire at a future ledger timestamp.
    InvalidExpiryDate = 3101,

    /// No membership token exists for the supplied identifier.
    TokenNotFound = 3102,

    /// The membership token has expired and is no longer valid.
    TokenExpired = 3103,
}