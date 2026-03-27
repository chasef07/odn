# Online Doctor's Note

A modern Next.js application that provides legitimate medical excuse notes for work or school absences. Built with Next.js 16, TypeScript, Stripe payments, and Better Auth.

## Features

- **Multi-Step Form**: 12-step guided form with conditional logic and progress tracking
- **Stripe Integration**: Secure payment processing with dynamic pricing
- **Admin Portal**: Doctor review dashboard with Better Auth authentication
- **Email Notifications**: React Email templates for payment confirmations, approvals, and denials
- **PDF Generation**: Professional doctor's notes with state-specific medical licenses
- **Monthly Limits**: Tracks approved absences per patient (7 days/month soft limit)
- **Responsive Design**: Mobile-first UI with Tailwind CSS and shadcn/ui

## Tech Stack

- **Framework**: Next.js 16.0.3 (App Router + Turbopack)
- **Language**: TypeScript 5 (strict mode)
- **UI**: React 19, Tailwind CSS 4, Radix UI, shadcn/ui
- **Forms**: react-hook-form + Zod validation
- **Payments**: Stripe (API v2026-02-25.clover)
- **Database**: PostgreSQL + Prisma ORM + Prisma Accelerate
- **Auth**: Better Auth (email/password with bcrypt)
- **Email**: React Email + Resend
- **PDF**: @react-pdf/renderer
- **Testing**: Vitest + Testing Library
- **Analytics**: Vercel Analytics + Google Ads + Reddit Pixel conversion tracking

## Quick Start

### Prerequisites

- Node.js (recommended: v18+)
- PostgreSQL database
- Stripe account
- Resend account (for emails)

### Installation

```bash
# Clone the repository
git clone https://github.com/chasef07/onlinedoctornote.git
cd onlinedoctornote

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your credentials

# Set up the database
npx prisma generate
npx prisma db push

# Run development server
npm run dev
```

Visit `http://localhost:3000` to see the application.

## Environment Variables

Create a `.env.local` file with the following variables:

```env
# Site
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Stripe
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_PRICE_ID=price_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Database
DATABASE_URL=postgresql://...
PRISMA_DATABASE_URL=prisma+postgres://...

# Better Auth
BETTER_AUTH_SECRET=...
BETTER_AUTH_URL=http://localhost:3000

# Email (Resend)
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=noreply@yourdomain.com

# Doctor Info (PDF)
DOCTOR_NAME="Dr. Your Name"
DOCTOR_CREDENTIALS="MD"
DOCTOR_SIGNATURE_URL="/images/doctor-signature.png"

# Cron Security
CRON_SECRET=...

# Environment
NODE_ENV=development
```

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── admin/             # Admin portal (login, review dashboard)
│   ├── api/               # API routes (Stripe, webhooks, auth)
│   ├── [form-pages]/      # 12 form step pages
│   └── layout.tsx         # Root layout
├── components/
│   ├── admin/             # Admin-specific components
│   ├── form/              # Reusable form components
│   └── ui/                # shadcn/ui components
├── emails/                # React Email templates
├── lib/                   # Business logic & utilities
│   ├── validation-schemas.ts
│   ├── date-validators.ts
│   ├── form-storage.ts
│   ├── auth.ts
│   ├── email.ts
│   ├── state-licenses.ts
│   └── pdf/               # PDF generation
└── prisma/
    └── schema.prisma      # Database schema
```

## Key Features

### Form Flow

1. State Selection
2. Recipient Selection (myself/someone else)
3. Patient Information
4. Guardian Information (conditional)
5. Contact Information
6. Note Purpose (work/school/both)
7. Absence Dates (with validation)
8. Absence Reason
9. Symptoms
10. Additional Information
11. Review & Edit
12. Payment (Stripe)
13. Success

### Date Validation Rules

- **Maximum absence**: 7 consecutive days
- **Lookback limit**: First day off cannot be >7 days in the past
- **Valid range**: 1900-01-01 to today

### Payment Processing

- Dynamic pricing from Stripe Dashboard (no code deploys needed)
- Reversed order architecture: TemporarySubmission → PaymentIntent → Webhook
- 2-tier fallback for webhook reliability
- Prisma Accelerate for 40x faster database operations
- Automatic payment confirmation emails

### Admin Portal

- **Login**: `/admin/login` (Better Auth protected)
- **Dashboard**: Review submissions with filters (pending/approved/denied/maybe/manual)
- **Search**: Find any submission by name, email, or ID (`/admin/search`)
- **Actions**: Approve (sends PDF via email) or Deny (refunds + email)
- **Edit & Re-approve**: Modify any field and regenerate PDF with updated information
- **Monthly Limits**: Visual warnings when patients exceed 7 days/month (tracked by name + DOB)
- **Patient History**: View prior submissions for repeat patients during review
- **Denial Reasons**: Includes Under 18, Legal, 7+ days, Duplicate, Refund, Other
- **Other Fields**: Displays custom text when users select "other" (e.g., "other - custom reason")

### Admin Search & Edit

- **Search by**: Patient name (partial match), email (contains), or submission ID
- **View**: Complete submission details with all form fields
- **Edit**: Modify any field directly from the search results
- **Status Control**: Change status between Approved, Denied, Maybe, and Manual
- **Re-approval**: Generate new PDF and send new email after editing approved submissions
- **Smart Refunds**: Automatically checks if already refunded before processing

### Email System

Three email types:
1. **Payment Confirmation**: Sent immediately after successful payment
2. **Approval Email**: Includes professional PDF doctor's note
3. **Denial Email**: Includes refund confirmation

All emails use modern React Email templates with Tailwind CSS.

### PDF Generation

- Professional medical document template
- State-specific medical license numbers (44 states supported)
- Dynamic "return to work/school" text based on note purpose
- Generated on-demand during approval process
- Uses Plus Jakarta Sans font for modern typography

## Available Scripts

```bash
# Development
npm run dev              # Start dev server (with Turbopack)
npm run build            # Build for production
npm start                # Start production server

# Database
npx prisma studio        # Open database browser
npx prisma generate      # Regenerate Prisma Client
npx prisma db push       # Push schema changes (dev)
npx prisma migrate dev   # Create migration

# Testing
npm test                 # Run all tests
npm run test:ui          # Run tests with UI
npm run test:coverage    # Run tests with coverage
npm run test:watch       # Run tests in watch mode

# Email
npm run email            # Preview email templates

# Code Quality
npm run lint             # Check for linting errors
npm run format           # Format code with Prettier
npm run format:check     # Check formatting
```

## Database Management

### Create Doctor Account

```bash
npx tsx scripts/create-doctor-user.ts
```

### View Database

```bash
npx prisma studio
# Opens at http://localhost:5555
```

### Test Approval Flow

```bash
npx tsx scripts/test-approval-flow.ts
```

## Testing

The project includes comprehensive test coverage:

- Unit tests for validators and utilities
- API integration tests with mocked Stripe
- Email template rendering tests
- PDF generation tests
- State license mapping tests
- Admin action tests

Run tests with:
```bash
npm test
```

## Stripe Webhook Testing (Local Development)

Use the Stripe CLI to forward webhook events to your local server:

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login to Stripe
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:3000/api/webhooks/stripe-prod3

# Copy the webhook signing secret to .env.local
# STRIPE_WEBHOOK_SECRET=whsec_...
```

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Import project in Vercel dashboard
3. Add all environment variables
4. Deploy

### Environment-Specific Configuration

**Production**:
- Set `NEXT_PUBLIC_SITE_URL` to your production domain
- Set `BETTER_AUTH_URL` to your production domain
- Use production Stripe keys
- Configure Stripe webhook endpoint in dashboard

## Security

- Input validation with Zod on client and server
- Email TLD whitelist validation (rejects invalid domains like `.clm`)
- Stripe webhook signature verification
- Better Auth session management (PostgreSQL)
- bcrypt password hashing (10 rounds)
- Timing-safe comparison for cron secrets
- Environment variable validation on startup
- XSS prevention via React escaping
- CSRF protection via Next.js

## Business Rules

### Date Validation
- Maximum 7 consecutive days of absence
- Cannot request notes for dates >7 days ago
- Strict validation in `src/lib/date-validators.ts`

### Monthly Limits
- Soft limit of 7 approved days per 30-day rolling window
- Tracked by patient name + date of birth (case-insensitive)
- Warning displayed in admin portal
- Patient history popup shows prior submissions during review

### Payment Processing
- Price managed via Stripe Dashboard (single source of truth)
- Refunds issued automatically on denial
- Payment confirmation sent via webhook

## Known Limitations

1. No rate limiting on API endpoints
2. No duplicate payment detection
3. Form data stored in localStorage only (not synced to server)
4. No PDF storage (generated on-demand)
5. Monthly limit tracked by name + DOB (harder to bypass than email)
6. No admin notifications for new submissions
7. No dark mode support

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

Private - All Rights Reserved

## Support

For issues or questions, please open a GitHub issue.
