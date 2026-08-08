// contracts/payment_escrow/src/errors.rs
use soroban_sdk::contracterror;

/// Payment escrow contract errors.
///
/// Error code range: 5000–5999
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord, Hash)]
#[repr(u32)]
pub enum Error {
    /// No admin has been set on the contract.
    AdminNotSet = 5000,
    /// Caller is not authorised to perform this action.
    Unauthorized = 5001,
    /// Contract has already been initialised.
    AlreadyInitialized = 5002,
    /// Escrow ID does not exist.
    EscrowNotFound = 5003,
    /// An escrow with this ID already exists.
    EscrowAlreadyExists = 5004,
    /// Action requires the escrow to have Pending status.
    EscrowNotPending = 5005,
    /// resolve_dispute requires the escrow to have Disputed status.
    EscrowNotDisputed = 5006,
    /// Dispute window has closed — too late to raise a dispute.
    DisputeWindowClosed = 5007,
    /// release_after timestamp has not been reached yet.
    ClaimTooEarly = 5008,
    /// Auto-claim is disabled for this escrow (release_after == 0).
    AutoClaimDisabled = 5009,
    /// Escrow amount must be greater than zero.
    InvalidAmount = 5010,
    /// Payment token address has not been set.
    PaymentTokenNotSet = 5011,
    /// Contract is paused.
    ContractPaused = 5012,
    /// release_after is non-zero but not strictly in the future at
    /// creation time, which would make the escrow immediately
    /// auto-claimable and defeats the point of setting it at all.
    InvalidReleaseTime = 5013,
}

impl Error {
    /// Human-readable description of the error.
    pub fn description(&self) -> &'static str {
        match self {
            Error::AdminNotSet => "No admin has been set on the contract",
            Error::Unauthorized => "Caller is not authorised to perform this action",
            Error::AlreadyInitialized => "Contract has already been initialised",
            Error::EscrowNotFound => "Escrow ID does not exist",
            Error::EscrowAlreadyExists => "An escrow with this ID already exists",
            Error::EscrowNotPending => "Action requires the escrow to have Pending status",
            Error::EscrowNotDisputed => {
                "resolve_dispute requires the escrow to have Disputed status"
            }
            Error::DisputeWindowClosed => {
                "Dispute window has closed — too late to raise a dispute"
            }
            Error::ClaimTooEarly => "release_after timestamp has not been reached yet",
            Error::AutoClaimDisabled => {
                "Auto-claim is disabled for this escrow (release_after == 0)"
            }
            Error::InvalidAmount => "Escrow amount must be greater than zero",
            Error::PaymentTokenNotSet => "Payment token address has not been set",
            Error::ContractPaused => "Contract is paused",
            Error::InvalidReleaseTime => {
                "release_after must be strictly in the future, or zero to disable auto-claim"
            }
        }
    }

    /// Raw numeric error code (5000–5999).
    pub fn code(&self) -> u32 {
        *self as u32
    }

    /// Errors indicating a systemic/configuration problem rather than a bad
    /// individual call — the contract isn't usable at all until these are
    /// addressed (set an admin, set the payment token, unpause).
    pub fn is_critical(&self) -> bool {
        matches!(
            self,
            Error::AdminNotSet | Error::PaymentTokenNotSet | Error::ContractPaused
        )
    }

    /// Errors caused by the caller lacking permission for the action.
    pub fn is_permission_error(&self) -> bool {
        matches!(self, Error::Unauthorized)
    }

    /// Errors caused by the escrow record being in the wrong state for the
    /// requested action (already exists, doesn't exist, wrong status).
    pub fn is_state_error(&self) -> bool {
        matches!(
            self,
            Error::AlreadyInitialized
                | Error::EscrowNotFound
                | Error::EscrowAlreadyExists
                | Error::EscrowNotPending
                | Error::EscrowNotDisputed
        )
    }

    /// Errors specific to the dispute-raising/resolution flow.
    ///
    /// `EscrowNotDisputed` deliberately appears in both this and
    /// `is_state_error` — it's genuinely both a state-mismatch error *and*
    /// specific to the dispute flow. Documented here so it isn't "cleaned
    /// up" into just one bucket later.
    pub fn is_dispute_error(&self) -> bool {
        matches!(self, Error::EscrowNotDisputed | Error::DisputeWindowClosed)
    }

    /// Errors specific to the auto-claim/release flow.
    pub fn is_claim_error(&self) -> bool {
        matches!(self, Error::ClaimTooEarly | Error::AutoClaimDisabled)
    }

    /// Errors caused by invalid input to an otherwise well-formed,
    /// well-authorized call.
    pub fn is_validation_error(&self) -> bool {
        matches!(self, Error::InvalidAmount | Error::InvalidReleaseTime)
    }
}

impl core::fmt::Display for Error {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        write!(f, "[{}] {}", self.code(), self.description())
    }
}

/// Result type for payment escrow operations.
pub type EscrowResult<T> = Result<T, Error>;

#[cfg(test)]
mod tests {
    use super::*;

    const ALL_VARIANTS: &[Error] = &[
        Error::AdminNotSet,
        Error::Unauthorized,
        Error::AlreadyInitialized,
        Error::EscrowNotFound,
        Error::EscrowAlreadyExists,
        Error::EscrowNotPending,
        Error::EscrowNotDisputed,
        Error::DisputeWindowClosed,
        Error::ClaimTooEarly,
        Error::AutoClaimDisabled,
        Error::InvalidAmount,
        Error::PaymentTokenNotSet,
        Error::ContractPaused,
        Error::InvalidReleaseTime,
    ];

    #[test]
    fn test_all_variants_have_nonempty_descriptions() {
        for variant in ALL_VARIANTS {
            assert!(
                !variant.description().is_empty(),
                "{variant:?} has an empty description"
            );
        }
    }

    #[test]
    fn test_error_codes_in_range() {
        for variant in ALL_VARIANTS {
            assert!(
                (5000..6000).contains(&variant.code()),
                "{variant:?} code {} is outside the 5000-5999 range",
                variant.code()
            );
        }
    }

    #[test]
    fn test_error_codes_are_unique() {
        for (i, a) in ALL_VARIANTS.iter().enumerate() {
            for b in &ALL_VARIANTS[i + 1..] {
                assert_ne!(
                    a.code(),
                    b.code(),
                    "duplicate error code between {a:?} and {b:?}"
                );
            }
        }
    }

    #[test]
    fn test_specific_codes() {
        assert_eq!(Error::AdminNotSet.code(), 5000);
        assert_eq!(Error::ContractPaused.code(), 5012);
        assert_eq!(Error::InvalidReleaseTime.code(), 5013);
    }

    #[test]
    fn test_categories() {
        assert!(Error::AdminNotSet.is_critical());
        assert!(!Error::Unauthorized.is_critical());

        assert!(Error::Unauthorized.is_permission_error());
        assert!(!Error::AdminNotSet.is_permission_error());

        assert!(Error::EscrowNotFound.is_state_error());
        assert!(!Error::InvalidAmount.is_state_error());

        assert!(Error::DisputeWindowClosed.is_dispute_error());
        assert!(!Error::ClaimTooEarly.is_dispute_error());

        assert!(Error::ClaimTooEarly.is_claim_error());
        assert!(!Error::DisputeWindowClosed.is_claim_error());

        assert!(Error::InvalidAmount.is_validation_error());
        assert!(Error::InvalidReleaseTime.is_validation_error());
        assert!(!Error::EscrowNotFound.is_validation_error());
    }

    #[test]
    fn test_categories_overlap_by_design() {
        assert!(Error::EscrowNotDisputed.is_state_error());
        assert!(Error::EscrowNotDisputed.is_dispute_error());
    }

    #[test]
    fn test_display_includes_code_and_description() {
        let err = Error::EscrowNotFound;
        let rendered = format!("{err}");
        assert!(rendered.contains("5003"));
        assert!(rendered.contains(err.description()));
    }
}