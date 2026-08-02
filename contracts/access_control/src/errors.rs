use soroban_sdk::contracterror;

/// Access control specific errors
///
/// Error code range: 2000–2999
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord, Hash)]
#[repr(u32)]
pub enum AccessControlError {
    /// Caller is not authorized to perform this action
    Unauthorized = 2000,
    /// Caller does not have admin privileges
    AdminRequired = 2001,
    /// Invalid role specified
    InvalidRole = 2002,
    /// User does not have the required role
    InsufficientRole = 2003,
    /// Role assignment failed
    RoleAssignmentFailed = 2004,
    /// Membership token contract not configured
    MembershipTokenNotSet = 2005,
    /// Cross-contract call to membership token failed
    MembershipTokenCallFailed = 2006,
    /// User does not have required membership token
    InsufficientMembership = 2007,
    /// Invalid membership token balance
    InvalidTokenBalance = 2008,
    /// Access control not initialized
    NotInitialized = 2009,
    /// Configuration error
    ConfigurationError = 2010,
    /// Storage operation failed
    StorageError = 2011,
    /// Invalid address provided
    InvalidAddress = 2012,
    /// Role hierarchy violation
    RoleHierarchyViolation = 2013,
    /// Maximum roles per user exceeded
    MaxRolesExceeded = 2014,
    /// Contract is paused
    ContractPaused = 2015,
    /// Multisig not enabled for this operation
    MultisigNotEnabled = 2016,
    /// Insufficient approvals for proposal execution
    InsufficientApprovals = 2017,
    /// Proposal not found
    ProposalNotFound = 2018,
    /// Proposal already executed
    ProposalAlreadyExecuted = 2019,
    /// Proposal has expired
    ProposalExpired = 2020,
    /// Time-lock not yet passed
    TimeLockActive = 2021,
    /// Already approved this proposal
    AlreadyApproved = 2022,
    /// Already rejected this proposal
    AlreadyRejected = 2023,
    /// Cannot execute proposal yet
    CannotExecuteProposal = 2024,
    /// Maximum pending proposals reached
    MaxProposalsReached = 2025,
    /// Invalid proposal type for this action
    InvalidProposalType = 2026,
    /// Invalid multisig configuration
    InvalidMultisigConfig = 2027,
    /// Threshold too high for number of admins
    ThresholdTooHigh = 2028,
    /// Threshold too low for security requirements
    ThresholdTooLow = 2029,
    /// Cannot remove last admin
    CannotRemoveLastAdmin = 2030,
    /// Duplicate admin address
    DuplicateAdmin = 2031,
    /// Not authorized as multisig admin
    NotMultisigAdmin = 2032,
    /// Proposal rejection threshold reached
    ProposalRejected = 2033,
}

impl AccessControlError {
    /// Get a human-readable description of the error
    pub fn description(&self) -> &'static str {
        match self {
            AccessControlError::Unauthorized => "Caller is not authorized to perform this action",
            AccessControlError::AdminRequired => "Admin privileges required for this operation",
            AccessControlError::InvalidRole => "Invalid role specified",
            AccessControlError::InsufficientRole => "User does not have the required role",
            AccessControlError::RoleAssignmentFailed => "Failed to assign role to user",
            AccessControlError::MembershipTokenNotSet => "Membership token contract not configured",
            AccessControlError::MembershipTokenCallFailed => {
                "Cross-contract call to membership token failed"
            }
            AccessControlError::InsufficientMembership => {
                "User does not have required membership token"
            }
            AccessControlError::InvalidTokenBalance => "Invalid membership token balance",
            AccessControlError::NotInitialized => "Access control system not initialized",
            AccessControlError::ConfigurationError => "Access control configuration error",
            AccessControlError::StorageError => "Storage operation failed",
            AccessControlError::InvalidAddress => "Invalid address provided",
            AccessControlError::RoleHierarchyViolation => "Role hierarchy violation",
            AccessControlError::MaxRolesExceeded => "Maximum roles per user exceeded",
            AccessControlError::ContractPaused => "Contract is currently paused",
            AccessControlError::MultisigNotEnabled => "Multisig not enabled for this operation",
            AccessControlError::InsufficientApprovals => {
                "Insufficient approvals for proposal execution"
            }
            AccessControlError::ProposalNotFound => "Proposal not found",
            AccessControlError::ProposalAlreadyExecuted => "Proposal already executed",
            AccessControlError::ProposalExpired => "Proposal has expired",
            AccessControlError::TimeLockActive => "Time-lock period not yet passed",
            AccessControlError::AlreadyApproved => "Already approved this proposal",
            AccessControlError::AlreadyRejected => "Already rejected this proposal",
            AccessControlError::CannotExecuteProposal => "Cannot execute proposal yet",
            AccessControlError::MaxProposalsReached => "Maximum pending proposals reached",
            AccessControlError::InvalidProposalType => "Invalid proposal type for this action",
            AccessControlError::InvalidMultisigConfig => "Invalid multisig configuration",
            AccessControlError::ThresholdTooHigh => "Threshold too high for number of admins",
            AccessControlError::ThresholdTooLow => "Threshold too low for security requirements",
            AccessControlError::CannotRemoveLastAdmin => "Cannot remove the last admin",
            AccessControlError::DuplicateAdmin => "Duplicate admin address",
            AccessControlError::NotMultisigAdmin => "Not authorized as multisig admin",
            AccessControlError::ProposalRejected => "Proposal rejection threshold reached",
        }
    }

    /// Get the raw numeric error code (2000–2999).
    ///
    /// Equivalent to `self as u32`, but named so call sites don't need an
    /// inline cast, and so the range invariant is documented in one place.
    pub fn code(&self) -> u32 {
        *self as u32
    }

    /// Check if this is a critical error that should halt execution
    pub fn is_critical(&self) -> bool {
        matches!(
            self,
            AccessControlError::NotInitialized
                | AccessControlError::ConfigurationError
                | AccessControlError::StorageError
                | AccessControlError::ContractPaused
        )
    }

    /// Check if this error is related to permissions (role/admin/membership
    /// checks failing on the caller).
    pub fn is_permission_error(&self) -> bool {
        matches!(
            self,
            AccessControlError::Unauthorized
                | AccessControlError::AdminRequired
                | AccessControlError::InsufficientRole
                | AccessControlError::InsufficientMembership
                | AccessControlError::NotMultisigAdmin
        )
    }

    /// Check if this error is related to membership tokens
    pub fn is_membership_error(&self) -> bool {
        matches!(
            self,
            AccessControlError::MembershipTokenNotSet
                | AccessControlError::MembershipTokenCallFailed
                | AccessControlError::InsufficientMembership
                | AccessControlError::InvalidTokenBalance
        )
    }

    /// Check if this error is related to proposal lifecycle (creation,
    /// approval/rejection, execution, expiry, time-locks).
    pub fn is_proposal_error(&self) -> bool {
        matches!(
            self,
            AccessControlError::InsufficientApprovals
                | AccessControlError::ProposalNotFound
                | AccessControlError::ProposalAlreadyExecuted
                | AccessControlError::ProposalExpired
                | AccessControlError::TimeLockActive
                | AccessControlError::AlreadyApproved
                | AccessControlError::AlreadyRejected
                | AccessControlError::CannotExecuteProposal
                | AccessControlError::MaxProposalsReached
                | AccessControlError::InvalidProposalType
                | AccessControlError::ProposalRejected
        )
    }

    /// Check if this error is related to multisig configuration or admin
    /// set management (as opposed to an individual proposal's lifecycle).
    pub fn is_multisig_error(&self) -> bool {
        matches!(
            self,
            AccessControlError::MultisigNotEnabled
                | AccessControlError::InvalidMultisigConfig
                | AccessControlError::ThresholdTooHigh
                | AccessControlError::ThresholdTooLow
                | AccessControlError::CannotRemoveLastAdmin
                | AccessControlError::DuplicateAdmin
                | AccessControlError::NotMultisigAdmin
        )
    }
}

impl core::fmt::Display for AccessControlError {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        write!(f, "[{}] {}", self.code(), self.description())
    }
}

/// Result type for access control operations
pub type AccessControlResult<T> = Result<T, AccessControlError>;

#[cfg(test)]
mod tests {
    use super::*;

    /// All variants in declaration order, kept in sync manually — the
    /// exhaustive match in `description()` will fail to compile if a new
    /// variant is added without a description, but this list is what lets
    /// the tests below iterate every variant without maintaining a second
    /// giant match by hand.
    const ALL_VARIANTS: &[AccessControlError] = &[
        AccessControlError::Unauthorized,
        AccessControlError::AdminRequired,
        AccessControlError::InvalidRole,
        AccessControlError::InsufficientRole,
        AccessControlError::RoleAssignmentFailed,
        AccessControlError::MembershipTokenNotSet,
        AccessControlError::MembershipTokenCallFailed,
        AccessControlError::InsufficientMembership,
        AccessControlError::InvalidTokenBalance,
        AccessControlError::NotInitialized,
        AccessControlError::ConfigurationError,
        AccessControlError::StorageError,
        AccessControlError::InvalidAddress,
        AccessControlError::RoleHierarchyViolation,
        AccessControlError::MaxRolesExceeded,
        AccessControlError::ContractPaused,
        AccessControlError::MultisigNotEnabled,
        AccessControlError::InsufficientApprovals,
        AccessControlError::ProposalNotFound,
        AccessControlError::ProposalAlreadyExecuted,
        AccessControlError::ProposalExpired,
        AccessControlError::TimeLockActive,
        AccessControlError::AlreadyApproved,
        AccessControlError::AlreadyRejected,
        AccessControlError::CannotExecuteProposal,
        AccessControlError::MaxProposalsReached,
        AccessControlError::InvalidProposalType,
        AccessControlError::InvalidMultisigConfig,
        AccessControlError::ThresholdTooHigh,
        AccessControlError::ThresholdTooLow,
        AccessControlError::CannotRemoveLastAdmin,
        AccessControlError::DuplicateAdmin,
        AccessControlError::NotMultisigAdmin,
        AccessControlError::ProposalRejected,
    ];

    #[test]
    fn test_error_descriptions() {
        assert!(!AccessControlError::Unauthorized.description().is_empty());
        assert!(!AccessControlError::AdminRequired.description().is_empty());
        assert!(!AccessControlError::InvalidRole.description().is_empty());
    }

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
    fn test_error_categories() {
        assert!(AccessControlError::NotInitialized.is_critical());
        assert!(!AccessControlError::Unauthorized.is_critical());

        assert!(AccessControlError::Unauthorized.is_permission_error());
        assert!(!AccessControlError::InvalidRole.is_permission_error());

        assert!(AccessControlError::MembershipTokenNotSet.is_membership_error());
        assert!(!AccessControlError::Unauthorized.is_membership_error());

        assert!(AccessControlError::ProposalExpired.is_proposal_error());
        assert!(!AccessControlError::Unauthorized.is_proposal_error());

        assert!(AccessControlError::ThresholdTooHigh.is_multisig_error());
        assert!(!AccessControlError::ProposalExpired.is_multisig_error());
    }

    #[test]
    fn test_categories_are_not_mutually_exclusive_by_design() {
        // NotMultisigAdmin is deliberately both a permission error (it's an
        // authorization failure on the caller) and a multisig error (it's
        // scoped to the multisig admin set) — documenting that overlap here
        // so a future refactor doesn't "fix" it into a single category.
        assert!(AccessControlError::NotMultisigAdmin.is_permission_error());
        assert!(AccessControlError::NotMultisigAdmin.is_multisig_error());
    }

    #[test]
    fn test_error_codes() {
        // Ensure error codes are in the 2000-2999 range
        assert_eq!(AccessControlError::Unauthorized.code(), 2000);
        assert_eq!(AccessControlError::AdminRequired.code(), 2001);
        assert_eq!(AccessControlError::ContractPaused.code(), 2015);
        assert_eq!(AccessControlError::ProposalRejected.code(), 2033);

        for variant in ALL_VARIANTS {
            assert!(
                (2000..3000).contains(&variant.code()),
                "{variant:?} code {} is outside the 2000-2999 range",
                variant.code()
            );
        }
    }

    #[test]
    fn test_error_codes_are_unique() {
        for (i, a) in ALL_VARIANTS.iter().enumerate() {
            for b in &ALL_VARIANTS[i + 1..] {
                assert_ne!(a.code(), b.code(), "duplicate error code between {a:?} and {b:?}");
            }
        }
    }

    #[test]
    fn test_display_includes_code_and_description() {
        let err = AccessControlError::ProposalExpired;
        let rendered = format!("{err}");
        assert!(rendered.contains("2020"));
        assert!(rendered.contains(err.description()));
    }
}