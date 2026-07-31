# BeaconPay

**Preview it. Split it. Pay it — all on Stellar.**

BeaconPay is a social-content and payments toolkit for agencies, creators, and DAOs who manage content teams. It merges three ideas — social post previews, multi-recipient Stellar payments, and plain-language payment commands — into one workflow: **approve how a post looks across platforms, then pay everyone who made it happen, in one signed transaction.**

---

## The Problem

Agencies and creator teams juggle two disconnected workflows:

1. **"Can you show us how it'll look on LinkedIn and Facebook?"** — Clients approve captions and raw images over email or Slack, with no idea how the actual post will render per platform (crop, character limits, link previews, aspect ratios).
2. **Paying the team after approval is manual and slow.** Once a post is approved, someone still has to individually pay the writer, designer, translator, and approver — often across different wallets, in different amounts, sent one by one.

There's no tool that connects "the client approved this" to "everyone gets paid, instantly, on-chain."

## The Solution

BeaconPay lets a team:
- Render an accurate **preview** of a post as it will appear on LinkedIn, Facebook, X, and Instagram.
- Attach a **payout split** to that post (e.g. writer 40%, designer 30%, translator 20%, agency 10%).
- Once the client clicks **Approve**, BeaconPay triggers a **single Stellar transaction** that pays every collaborator their share in XLM or any SIP/Stellar-issued asset — no manual sends, no spreadsheet math.
- Anyone on the team can also just type a payment in plain language — e.g. *"pay 50 XLM to Ada and 20 XLM to Musa for this post"** — and BeaconPay parses it into a ready-to-sign transaction.

---

## Core Features

### 1. Multi-Platform Post Preview
Upload a caption + image/video and instantly see accurate mockups for LinkedIn, Facebook, X, and Instagram — correct cropping, character truncation, and link-preview cards — before anything goes live. Clients approve directly from the preview screen.

### 2. One-Click Batch Payouts (Stellar Multi-Op Transactions)
Define a payout split per post or per project. When a post is approved, BeaconPay builds a single Stellar transaction with multiple payment operations — one signature, every collaborator paid atomically. Supports XLM and any Stellar-issued asset (stablecoins, agency tokens, etc.).

### 3. Plain-Language Payment Commands
A lightweight natural-language parser turns instructions like *"send 10 XLM to @dara and 15 XLM to @femi"* into a structured, reviewable Stellar transaction — no manual address entry, no per-recipient forms. Built for teams who think in sentences, not spreadsheets.

### 4. Approval-Linked Escrow (Soroban Smart Contract)
Funds for a project can be locked in a Soroban escrow contract up front. Payouts release automatically only when the linked post preview is marked "Approved" by the client — removing the "did they actually get paid?" trust gap between agencies and freelancers.

### 5. Payout History & Receipts
Every batch payment generates a shareable on-chain receipt (transaction hash + breakdown per recipient) that can be attached back to the original post preview for record-keeping and client reporting.

---

## Example Flow

1. Agency uploads a caption + image → BeaconPay renders LinkedIn/Facebook/X/Instagram previews.
2. Agency defines the payout split: Writer 40%, Designer 35%, Translator 15%, Agency 10%.
3. Client reviews the preview and clicks **Approve**.
4. BeaconPay submits one Stellar transaction splitting the agreed budget across all four wallets.
5. Each collaborator receives a receipt with the tx hash and their share.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Blockchain | Stellar (mainnet/testnet) |
| Smart Contracts | Soroban (for escrow + conditional release) |
| Wallet Integration | Freighter, Albedo |
| SDK | Stellar SDK (JS) for building multi-operation transactions |
| Frontend | React + Tailwind |
| Preview Rendering | Platform-specific mock renderers (LinkedIn/FB/X/IG card specs) |
| NLP Parser | Lightweight intent parser for payment commands (recipient, amount, asset) |

---

## Why "BeaconPay"

Stellar's network is often described in terms of anchors and signals guiding value across borders — a **beacon** marks trust and direction. BeaconPay reflects that idea: a client's approval acts as the beacon that releases payment, instantly signaling every collaborator that they've been paid.

---

## Why Stellar

- **Low fees, fast finality** — ideal for frequent small payouts to multiple collaborators.
- **Native multi-operation transactions** — batch payments to many recipients atomically, without custom contract logic.
- **Path payments & multi-asset support** — pay in XLM or any Stellar-issued token (e.g. a stablecoin) without extra bridges.
- **Soroban** — enables the approval-linked escrow feature with minimal contract complexity.

---

## Roadmap

- [ ] MVP: Post preview renderer (LinkedIn, Facebook, X, Instagram)
- [ ] Multi-recipient Stellar payment builder (SDK integration)
- [ ] Plain-language payment command parser (v1: recipient + amount extraction)
- [ ] Soroban escrow contract for approval-linked release
- [ ] On-chain payout receipts linked to posts
- [ ] Team/role management (writer, designer, translator, approver presets)
- [ ] Recurring payout templates for ongoing retainers

---

## Status

Concept stage — open for feedback and contributors.
