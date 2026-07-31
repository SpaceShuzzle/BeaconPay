# BeaconPay — Backend

The backend powers post preview rendering, payout logic, the plain-language payment parser, and orchestration between the frontend and the Stellar/Soroban network.

---

## Responsibilities

- Generate accurate preview metadata for LinkedIn, Facebook, X, and Instagram (crop ratios, character limits, link-card previews).
- Store projects, posts, collaborators, and payout splits.
- Build unsigned Stellar multi-operation transactions from a payout split (client signs client-side via Freighter/Albedo — backend never holds private keys).
- Parse plain-language payment commands into structured payment intents.
- Listen for post "Approved" events and trigger the Soroban escrow release call.
- Store and serve on-chain payout receipts (tx hash + per-recipient breakdown).

## Tech Stack

| Concern | Choice |
|---|---|
| Runtime | Node.js (TypeScript) |
| Framework | Express / Fastify |
| Database | PostgreSQL |
| ORM | Prisma |
| Stellar SDK | `stellar-sdk` (JS) for building/submitting transactions |
| Soroban | `soroban-client` for contract calls |
| NLP Parser | Lightweight rule-based / regex + entity extraction (recipient handles, amounts, asset codes); upgradeable to an LLM-based parser later |
| Auth | JWT + wallet-signature login (sign a nonce with Freighter to authenticate) |
| Queue | Redis + BullMQ (for async transaction submission & receipt polling) |

## Project Structure

```
backend/
├── src/
│   ├── routes/
│   │   ├── posts.ts          # CRUD for posts + preview metadata
│   │   ├── payouts.ts        # Build/submit payout transactions
│   │   ├── commands.ts       # Parse plain-language payment commands
│   │   ├── escrow.ts         # Trigger/query Soroban escrow contract
│   │   └── auth.ts           # Wallet-signature based auth
│   ├── services/
│   │   ├── previewRenderer.ts
│   │   ├── stellarTx.ts      # Multi-op transaction builder
│   │   ├── sorobanClient.ts  # Contract invocation helpers
│   │   └── nlpParser.ts
│   ├── db/
│   │   ├── schema.prisma
│   │   └── client.ts
│   ├── jobs/
│   │   └── receiptPoller.ts  # Polls Horizon for tx confirmation, stores receipts
│   └── index.ts
├── .env.example
├── package.json
└── tsconfig.json
```

## Environment Variables

```env
DATABASE_URL=postgresql://user:pass@localhost:5432/beaconpay
STELLAR_NETWORK=testnet          # testnet | public
HORIZON_URL=https://horizon-testnet.stellar.org
SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
ESCROW_CONTRACT_ID=CA...         # deployed Soroban contract ID
JWT_SECRET=changeme
REDIS_URL=redis://localhost:6379
```

## Key API Endpoints

| Method | Route | Description |
|---|---|---|
| POST | `/posts` | Create a post with caption + media, returns platform preview metadata |
| GET | `/posts/:id/preview` | Fetch rendered preview data for all platforms |
| POST | `/posts/:id/approve` | Client marks post approved → triggers payout/escrow release |
| POST | `/payouts/build` | Build an unsigned multi-op Stellar transaction from a payout split |
| POST | `/payouts/submit` | Submit a client-signed transaction to the network |
| POST | `/commands/parse` | Parse a plain-language payment instruction into a structured intent |
| GET | `/receipts/:txHash` | Fetch a stored payout receipt |

## Local Development

```bash
git clone <repo-url> beaconpay-backend
cd beaconpay-backend
npm install
cp .env.example .env
npx prisma migrate dev
npm run dev
```

## Notes on Security

- The backend **never** stores or handles private keys. All transactions are built unsigned, signed client-side, then submitted.
- Escrow release calls are triggered only after verifying the post's "Approved" state server-side, preventing spoofed release requests.