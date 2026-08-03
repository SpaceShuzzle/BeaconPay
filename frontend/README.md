# BeaconPay

A premium fintech collaboration platform powered by Stellar blockchain, enabling creators and teams to manage payments with confidence.

## Overview

BeaconPay is a comprehensive payment management platform that brings fintech best practices to team collaboration. Built with a premium dark-mode design inspired by Linear, Stripe, and Arc, it provides features for batch payments, multi-signature approvals, escrow management, and digital receipts.

## Features

- **Dashboard**: Real-time payment overview with volume analytics and quick actions
- **Batch Payments**: Send multiple payments in a single transaction to reduce fees
- **Instant Approvals**: Multi-signature approval workflows with blockchain validation
- **Smart Escrow**: Secure transactions with smart contract-backed escrow
- **Social Preview**: Create shareable payment previews for audience engagement
- **AI Payment Builder**: Natural language payment generation (scaffolding ready)
- **Digital Receipts**: Automated receipts with PDF export capability
- **Receipt Management**: Track all transactions with full audit trails

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Styling**: Tailwind CSS v4 with CSS custom properties for theming
- **Components**: shadcn/ui with custom design system
- **Icons**: Lucide React
- **Typography**: Inter font from Google Fonts
- **Design**: Dark mode premium fintech aesthetic (18-24px border radius, glassmorphism)

## Color Palette

- **Primary**: Indigo (`oklch(0.548 0.196 264.376)`)
- **Secondary**: Emerald (`oklch(0.485 0.151 145.574)`)
- **Accent**: Red/Coral (`oklch(0.604 0.257 29.234)`)
- **Background**: Near-black (`oklch(0.09 0 0)`)
- **Foreground**: Off-white (`oklch(0.98 0 0)`)

## Project Structure

```
/app
├── page.tsx                    # Landing page with hero and features
├── dashboard/
│   ├── layout.tsx             # Dashboard layout with sidebar
│   ├── page.tsx               # Main dashboard with stats
│   ├── payments/page.tsx       # Payment history and management
│   ├── approvals/page.tsx      # Multi-sig approval queue
│   ├── escrow/page.tsx         # Escrow manager and transactions
│   ├── receipts/page.tsx       # Digital receipt management
│   └── settings/page.tsx       # User account and preferences
├── auth/
│   ├── signin/page.tsx         # Sign in page
│   └── signup/page.tsx         # Sign up page
└── demo/page.tsx               # Interactive demo page

/components
├── sidebar.tsx                 # Dashboard navigation sidebar
├── dashboard-header.tsx        # Header with search and notifications
├── dashboard-card.tsx          # Reusable stat card component
├── payment-overview.tsx        # Payment volume chart
├── recent-transactions.tsx     # Recent transaction list
├── ui/
│   ├── button.tsx             # Base button component
│   └── badge.tsx              # Badge/label component
```

## Pages

### Public Pages
- **Landing** (`/`): Marketing homepage with features and CTA
- **Demo** (`/demo`): Interactive feature showcase
- **Auth** (`/auth/signin`, `/auth/signup`): Authentication flows

### Dashboard Pages (Protected)
- **Dashboard** (`/dashboard`): Overview with key metrics
- **Payments** (`/dashboard/payments`): Searchable payment history
- **Approvals** (`/dashboard/approvals`): Pending multi-sig approvals
- **Escrow** (`/dashboard/escrow`): Escrow transaction management
- **Receipts** (`/dashboard/receipts`): Receipt viewing and export
- **Settings** (`/dashboard/settings`): Account, wallet, notifications, billing

## Styling System

### Design Tokens (CSS Variables)

Colors use OKLCH color space for modern browsers:
- `--background`: Main page background
- `--foreground`: Main text color
- `--card`: Card/container background
- `--primary`: Primary brand color (Indigo)
- `--secondary`: Secondary accent (Emerald)
- `--accent`: Tertiary accent (Red/Coral)
- `--muted`: Muted text backgrounds
- `--border`: Border colors
- `--radius`: Border radius base unit (1rem)

### Typography

- **Font**: Inter (system stack fallback)
- **Headings**: Semibold (600) to Bold (700)
- **Body**: Regular (400) to Medium (500)
- **Sizes**: 12px to 48px following Tailwind scale

### Layout

- **Sidebar**: Fixed left navigation (hidden on mobile)
- **Header**: Sticky top bar with search and account menu
- **Main content**: Scrollable with padding
- **Grid**: Responsive 1-3 column layouts on mobile/tablet/desktop
- **Gaps**: Consistent spacing with Tailwind's gap scale

## Design Principles

1. **Premium Dark**: Dark backgrounds with careful lighting hierarchy
2. **Glassmorphism**: Subtle transparency and backdrop blur on cards
3. **Large Radius**: 18-24px border radius for soft, modern feel
4. **Accessibility**: WCAG contrast ratios, semantic HTML, ARIA labels
5. **Responsive**: Mobile-first, adapts to all screen sizes
6. **Performance**: Minimal animations, optimized images, lazy loading

## Getting Started

### Installation

```bash
# Install dependencies
pnpm install

# Run development server
pnpm dev
```

The app will be available at `http://localhost:3000`

### Development

- Edit pages in `/app` - Hot Module Replacement (HMR) applies changes instantly
- Create components in `/components` - Reuse across pages
- Modify styling in `/app/globals.css` for design tokens
- Update layout in `/app/layout.tsx` for metadata and fonts

## Next Steps / Future Enhancements

The following features are scaffolded but require integration:

1. **Stellar Integration**: Connect to Stellar blockchain for real payments
2. **Freighter Wallet**: Integrate Freighter for wallet operations
3. **AI Payment Builder**: Implement natural language payment generation (Vercel AI SDK)
4. **Social Media APIs**: Add shareable preview generation
5. **PDF Export**: Implement receipt PDF generation
6. **Authentication**: Integrate Better Auth with database
7. **Database**: Connect Neon PostgreSQL for data persistence
8. **Real-time Updates**: Add WebSocket support for approval notifications

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## License

MIT

## Support

For questions or issues, refer to the inline code documentation or create an issue in your repository.
