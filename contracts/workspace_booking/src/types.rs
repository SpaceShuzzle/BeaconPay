use soroban_sdk::{contracttype, Address, String};

// Re-use BookingStatus from common_types to avoid duplication across contracts.
pub use common_types::BookingStatus;

/// Maximum allowed length for workspace identifiers.
pub const MAX_ID_LEN: u32 = 64;

/// Maximum allowed length for workspace names.
pub const MAX_NAME_LEN: u32 = 128;

/// Category of workspace being registered.
///
/// NOTE:
/// New variants may be added in future versions.
///
/// Discriminants are assigned explicitly rather than left to auto-numbering.
/// Soroban's `#[contracttype]` encodes fieldless enum variants by their
/// integer discriminant, so implicit numbering (0, 1, 2, ... in declaration
/// order) means simply reordering variants in source changes what's stored
/// on-chain for existing data. When adding a variant in a future version,
/// always append it with the next unused number — never renumber, reorder,
/// or reuse an existing value.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum WorkspaceType {
    /// Open hot-desk — shared, no dedicated assignment.
    HotDesk = 0,

    /// Reserved desk for a specific member or team.
    DedicatedDesk = 1,

    /// Enclosed private office.
    PrivateOffice = 2,

    /// Meeting / conference room.
    MeetingRoom = 3,

    /// Fully remote / online meeting space.
    Virtual = 4,

    /// Combined physical desk and integrated video-conferencing setup.
    Hybrid = 5,
}

/// Reason a workspace is unavailable.
///
/// See [`WorkspaceType`] for why discriminants are pinned explicitly and
/// must only ever be appended to, not renumbered.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum UnavailabilityReason {
    /// Temporary maintenance work
    Maintenance = 0,

    /// Workspace permanently removed
    Decommissioned = 1,

    /// Held by administrator
    AdminHold = 2,
}

/// Availability state of a workspace.
///
/// Unlike the fieldless enums above, this variant carries data
/// (`Unavailable` wraps an [`UnavailabilityReason`]), so Rust doesn't allow
/// pinning an explicit discriminant here directly. The same storage-safety
/// rule still applies by convention: only append new variants at the end,
/// never reorder or remove existing ones.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum WorkspaceAvailability {
    /// Workspace can be booked
    Available,

    /// Workspace cannot be booked with reason
    Unavailable(UnavailabilityReason),
}

/// A physical or logical workspace that can be booked.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Workspace {
    /// Unique workspace identifier (max 64 chars)
    pub id: String,

    /// Human-readable name (max 128 chars)
    pub name: String,

    /// Category of workspace
    pub workspace_type: WorkspaceType,

    /// Maximum simultaneous occupants
    pub capacity: u32,

    /// Hourly rate in smallest unit of payment token
    pub hourly_rate: u128,

    /// Current availability state
    pub availability: WorkspaceAvailability,

    /// Ledger timestamp when workspace was created
    pub created_at: u64,
}

impl Workspace {
    /// Whether `id` is within [`MAX_ID_LEN`]. Callers registering a
    /// workspace should check this before persisting it.
    pub fn has_valid_id_len(&self) -> bool {
        self.id.len() <= MAX_ID_LEN
    }

    /// Whether `name` is within [`MAX_NAME_LEN`]. Callers registering a
    /// workspace should check this before persisting it.
    pub fn has_valid_name_len(&self) -> bool {
        self.name.len() <= MAX_NAME_LEN
    }

    /// Whether the workspace can currently be booked at all. This only
    /// reflects the workspace's own availability state — it does not check
    /// for time-slot conflicts with existing bookings.
    pub fn is_bookable(&self) -> bool {
        matches!(self.availability, WorkspaceAvailability::Available)
    }
}

/// A confirmed reservation for a workspace.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Booking {
    /// Caller-provided booking identifier (max 64 chars)
    pub id: String,

    /// ID of workspace being booked
    pub workspace_id: String,

    /// Member who created the booking
    pub member: Address,

    /// Reservation start time (unix seconds)
    pub start_time: u64,

    /// Reservation end time (unix seconds)
    pub end_time: u64,

    /// Current booking lifecycle status
    pub status: BookingStatus,

    /// Amount paid for booking
    pub amount_paid: u128,

    /// Timestamp when booking was created
    pub created_at: u64,

    /// Timestamp booking was cancelled
    pub cancelled_at: Option<u64>,

    /// Timestamp booking was completed
    pub completed_at: Option<u64>,
}

impl Booking {
    /// Whether `id` is within [`MAX_ID_LEN`].
    pub fn has_valid_id_len(&self) -> bool {
        self.id.len() <= MAX_ID_LEN
    }

    /// Whether `workspace_id` is within [`MAX_ID_LEN`].
    pub fn has_valid_workspace_id_len(&self) -> bool {
        self.workspace_id.len() <= MAX_ID_LEN
    }

    /// Booking duration in seconds. Uses a saturating subtraction so a
    /// booking with a corrupted/invalid `end_time <= start_time` returns 0
    /// instead of panicking on underflow.
    pub fn duration(&self) -> u64 {
        self.end_time.saturating_sub(self.start_time)
    }

    /// Whether this booking's time range overlaps `[start, end)`. Half-open
    /// interval semantics — a booking ending exactly when another starts is
    /// not an overlap. Centralizes the overlap check so it's defined once
    /// instead of being reimplemented ad hoc at each call site (contract
    /// logic, tests, etc.), which is exactly how these things drift out of
    /// sync with each other.
    pub fn overlaps(&self, start: u64, end: u64) -> bool {
        self.start_time < end && start < self.end_time
    }

    /// Whether the booking is currently active (not cancelled or completed).
    pub fn is_active(&self) -> bool {
        self.status == BookingStatus::Active
    }
}