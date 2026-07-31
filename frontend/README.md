# BeaconPay — Frontend

The frontend is where agencies build posts, preview them across platforms, define payout splits, and where clients approve posts that trigger payment.

---

## Responsibilities

- Render accurate post previews for LinkedIn, Facebook, X, and Instagram from a single caption + media upload.
- Let teams define payout splits per post/project (recipient wallet, percentage or fixed amount, asset).
- Wallet connection and transaction signing (Freighter / Albedo).
- Plain-language payment command input box → sends text to backend parser → shows a reviewable transaction summary before signing.
- Client-facing approval view (simple, no-wallet-needed for viewing; wallet only needed if the client is also a payer).
- Payout history / on-chain receipt viewer per post.

## Tech Stack

| Concern | Choice |
|---|---|
| Framework | React + Vite |
| Styling | Tailwind CSS |
| State | React Query (server state) + Zustand (UI state) |
| Wallet Integration | `@stellar/freighter-api`, Albedo SDK |
| Stellar SDK | `stellar-sdk` (JS) for transaction display/signing helpers |
| Forms | React Hook Form + Zod validation |
| Charts/Receipts | Recharts (payout breakdown), simple table view for receipts |

## Project Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── PreviewCard/          # Per-platform preview renderers
│   │   │   ├── LinkedInPreview.tsx
│   │   │   ├── FacebookPreview.tsx
│   │   │   ├── XPreview.tsx
│   │   │   └── InstagramPreview.tsx
│   │   ├── PayoutSplitEditor.tsx # Define recipients + %/amounts
│   │   ├── CommandInput.tsx      # Plain-language payment box
│   │   ├── WalletConnectButton.tsx
│   │   ├── ApprovalPanel.tsx     # Client-facing approve/reject
│   │   └── ReceiptViewer.tsx
│   ├── pages/
│   │   ├── Dashboard.tsx
│   │   ├── NewPost.tsx
│   │   ├── PostDetail.tsx
│   │   └── ClientApproval.tsx    # Public/shareable approval link
│   ├── hooks/
│   │   ├── useWallet.ts
│   │   ├── usePosts.ts
│   │   └── usePayouts.ts
│   ├── lib/
│   │   ├── api.ts                # Backend API client
│   │   └── stellar.ts            # Tx building/signing helpers
│   └── App.tsx
├── .env.example
├── package.json
└── vite.config.ts
```

## Environment Variables

```env
VITE_API_BASE_URL=http://localhost:4000
VITE_STELLAR_NETWORK=testnet
VITE_HORIZON_URL=https://horizon-testnet.stellar.org
```

## Core User Flows

1. **Create a post** → upload caption + media → previews render for all 4 platforms side by side.
2. **Set payout split** → add collaborators (wallet address or handle), assign % or fixed amounts, choose asset (XLM or Stellar asset code).
3. **Send for approval** → generates a shareable client link (`/approve/:postId`).
4. **Client approves** → backend marks post approved → escrow release / payout transaction is built.
5. **Sign & submit** → whoever holds signing authority (agency or client, depending on setup) signs via Freighter/Albedo; frontend submits to network.
6. **View receipt** → transaction hash and per-recipient breakdown shown on the post detail page.

## Local Development

```bash
git clone <repo-url> beaconpay-frontend
cd beaconpay-frontend
npm install
cp .env.example .env
npm run dev
```

## Design Notes

- Preview components should closely mirror each platform's real card dimensions and truncation rules — this accuracy is the core value proposition.
- The command input (plain-language payments) should always show a **parsed, editable summary** before any signing prompt — never sign directly from raw text.