# BeaconPay — Soroban Contract (Escrow)

A Soroban smart contract that holds project funds in escrow and releases payouts to collaborators only once a linked post is marked **Approved**.

---

## Purpose

Instead of trusting an agency to pay collaborators manually after a client signs off, funds are locked in this contract up front. The contract releases the agreed split **atomically** the moment an authorized "approve" call is made — removing the trust gap between agencies, clients, and freelancers.

## Contract Responsibilities

- Accept and hold a deposit (XLM or a Stellar asset) tied to a specific `project_id` / `post_id`.
- Store a payout split: a list of `(recipient_address, amount_or_percentage)` pairs.
- Expose an `approve_and_release` function, callable only by an authorized address (the client's wallet, or a designated approver), that pays out the full split in one atomic call.
- Support a `refund` path if a post is rejected or a deadline passes without approval.
- Emit events for `Deposited`, `Released`, and `Refunded` so the backend can index and generate receipts.

## Contract Structure

```
contract/
├── src/
│   ├── lib.rs              # Contract entrypoints
│   ├── escrow.rs           # Core escrow logic (deposit, release, refund)
│   ├── types.rs            # PayoutSplit, EscrowState structs
│   └── events.rs           # Event definitions
├── tests/
│   └── escrow_test.rs
├── Cargo.toml
└── README.md
```

## Core Data Types

```rust
pub struct PayoutRecipient {
    pub address: Address,
    pub amount: i128,       // or basis points if using percentage split
}

pub struct EscrowState {
    pub project_id: BytesN<32>,
    pub depositor: Address,
    pub approver: Address,      // client or designated approver
    pub asset: Address,         // token contract address (or native XLM marker)
    pub total_amount: i128,
    pub recipients: Vec<PayoutRecipient>,
    pub status: EscrowStatus,   // Pending | Released | Refunded
    pub deadline: u64,          // ledger timestamp for refund eligibility
}
```

## Key Functions

| Function | Description |
|---|---|
| `deposit(project_id, approver, asset, recipients, deadline)` | Locks funds and stores the payout split for a project |
| `approve_and_release(project_id)` | Callable only by `approver`; pays every recipient in one atomic transfer set |
| `refund(project_id)` | Callable by `depositor` after `deadline` if not yet released |
| `get_escrow(project_id)` | Read-only view of current escrow state |

## Build & Test

```bash
# Install Soroban CLI (if not already installed)
cargo install --locked soroban-cli

# Build the contract
cd contract
soroban contract build

# Run tests
cargo test
```

## Deploy (Testnet)

```bash
soroban contract deploy \
  --wasm target/wasm32-unknown-unknown/release/beaconpay_escrow.wasm \
  --source <your-identity> \
  --network testnet
```

Save the resulting contract ID — this is the `ESCROW_CONTRACT_ID` the backend needs in its `.env`.

## Security Considerations

- `approve_and_release` must verify the caller matches the stored `approver` address (using Soroban's `require_auth`).
- Recipient amounts must sum to exactly `total_amount` at deposit time — validated on-chain to prevent underfunded splits.
- `refund` should only be callable after the stored `deadline` to prevent premature fund recovery by the depositor.
- All state transitions (`Pending → Released` / `Pending → Refunded`) are one-way; no re-entrant release calls.

## Events

| Event | Emitted When |
|---|---|
| `Deposited` | Funds locked for a project |
| `Released` | Approver triggers payout; includes per-recipient breakdown |
| `Refunded` | Depositor reclaims funds after deadline |

These events are indexed by the backend's `receiptPoller` job to generate the on-chain receipts shown in the frontend.