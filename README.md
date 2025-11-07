# Online Doctor's Note

A Next.js application for generating legitimate online doctor's notes with a streamlined multi-step form process and secure payment integration.

## Overview

This application provides a user-friendly interface for individuals to obtain doctor's notes for work or school absences. The form collects necessary medical and personal information, validates it against business rules, and processes payments through Stripe.

## Features

- **Multi-step Form Flow**: 10-11 step guided form with progress tracking
- **Admin Portal**: Secure doctor dashboard for reviewing and approving submissions
- **Smart Validation**: Real-time form validation with Zod schemas
- **Date Rules**: Enforces 7-day maximum absence period, 7-day lookback limit
- **Guardian Support**: Conditional forms for minors requiring guardian information
- **Stripe Integration**: Secure payment processing ($29.99)
- **Mobile Responsive**: Optimized UI for all device sizes
- **Form Persistence**: Auto-saves progress to localStorage
- **Database**: PostgreSQL with Prisma ORM for production data
- **Comprehensive Testing**: 217+ automated tests with 80%+ coverage

## Tech Stack

- **Framework**: Next.js 15.5.5 (App Router, Turbopack)
- **Language**: TypeScript 5
- **UI Library**: React 19.1.0
- **Styling**: Tailwind CSS 4
- **Components**: Radix UI + shadcn/ui
- **Forms**: react-hook-form + Zod validation
- **Payments**: Stripe (API v2025-09-30.clover)
- **Database**: PostgreSQL (Prisma Cloud) + Prisma ORM
- **Authentication**: NextAuth.js v5 with credentials provider
- **Testing**: Vitest + Testing Library
- **CI/CD**: GitHub Actions

## Getting Started

### Prerequisites

- Node.js 20+
- npm or yarn
- Stripe account (for payment processing)
- PostgreSQL database (or use Prisma Cloud)

### Installation

```bash
# Clone the repository
git clone https://github.com/chasef07/onlinedoctornote.git
cd onlinedoctornote

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local and add your Stripe keys
```

### Environment Variables

Create a `.env.local` file with:

```env
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_PAYMENT_AMOUNT=2495

# Database Configuration
DATABASE_URL=postgresql://user:password@host:5432/database

# NextAuth Configuration
AUTH_SECRET=your-auth-secret-here  # Generate with: openssl rand -base64 32
AUTH_URL=http://localhost:3000

# Cron Job Security
CRON_SECRET=your-cron-secret-here  # Generate with: openssl rand -hex 32
```

### Development

```bash
# Initialize database
npx prisma generate
npx prisma db push

# (Optional) Seed test data
npx tsx scripts/seed-production-data.ts

# Start development server
npm run dev

# Run tests
npm test

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage

# Open Prisma Studio (database browser)
npx prisma studio

# Build for production
npm run build

# Start production server
npm start
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

### Admin Portal

The admin portal allows doctors to review and approve/deny patient submissions.

- **URL**: [http://localhost:3000/admin/login](http://localhost:3000/admin/login)
- **Default credentials**: Set up using `scripts/seed-production-data.ts`

To create a new doctor account:

```bash
npx tsx scripts/seed-production-data.ts
```

To update a doctor's password:

```bash
npx tsx scripts/update-doctor-password.ts
```

## Form Flow

1. **State Selection** - Choose operating state
2. **Recipient** - Who is the note for? (myself/someone else)
3. **Patient Info** - Name, date of birth
4. **Guardian Info** - Required if note is for someone else
5. **Contact Info** - Email and phone number
6. **Note Purpose** - Work, school, both, or other
7. **Absence Dates** - First day off, last day off, return date
8. **Absence Reason** - Illness, injury, medical appointment, etc.
9. **Symptoms** - Select applicable symptoms
10. **Additional Info** - Optional notes
11. **Review** - Confirm all information
12. **Payment** - Secure Stripe checkout
13. **Confirmation** - Success page

## Business Rules

### Date Validation

- **Lookback limit**: First day off cannot be more than 7 days in the past
- **Maximum absence**: 7 consecutive days (from first day off to last day off)
- All dates must be valid calendar dates
- Return date is automatically calculated (last day off + 1 day)

### Form Validation

- Names: Letters, spaces, hyphens, apostrophes only (max 50 chars)
- Email: Valid email format, converted to lowercase
- Phone: Exactly 10 digits, formatted as (XXX) XXX-XXXX
- Date of Birth: Must be between 1900-01-01 and today
- All required fields must be completed before proceeding

## Testing

The project has comprehensive test coverage:

- **217 tests passing** (48 database integration tests temporarily skipped)
- **Unit tests**: Validators, utilities, schemas (100% passing)
- **Integration tests**: API routes with mocked Stripe
- **Database tests**: Submission lifecycle, schema constraints (skipped due to test isolation issues)
- **Coverage**: 80%+ across the codebase

See [TESTING.md](./TESTING.md) for detailed testing documentation.

**Note**: Database integration tests are currently skipped with TODO comments. They pass individually but have test isolation issues when run together. All business logic tests (validators, schemas, utilities) are passing.

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- date-validators.test.ts

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

## Project Structure

```
src/
├── app/                      # Next.js app router pages
│   ├── admin/               # Admin portal (NextAuth protected)
│   │   ├── login/          # Doctor login page
│   │   └── dashboard/      # Submission review dashboard
│   ├── api/                 # API routes
│   │   ├── auth/           # NextAuth.js endpoints
│   │   ├── create-payment-intent/
│   │   ├── verify-payment/
│   │   ├── cron/           # Scheduled jobs (cleanup)
│   │   └── webhooks/       # Stripe webhooks
│   ├── [form-pages]/        # Multi-step form pages
│   └── layout.tsx           # Root layout
├── components/              # React components
│   ├── admin/              # Admin portal components
│   ├── form/               # Form-specific components
│   └── ui/                 # shadcn/ui components
├── lib/                    # Utilities and business logic
│   ├── validation-schemas.ts  # Zod schemas
│   ├── date-validators.ts     # Date validation logic
│   ├── phone-utils.ts         # Phone formatting
│   ├── age-validators.ts      # Age validation
│   ├── form-storage.ts        # localStorage helpers
│   ├── form-constants.ts      # Static data
│   ├── auth.ts                # NextAuth configuration
│   └── prisma.ts              # Prisma client singleton
├── __tests__/              # Test files
└── prisma/
    └── schema.prisma       # Database schema
scripts/
├── seed-production-data.ts   # Seed test submissions
└── update-doctor-password.ts # Update doctor password
tests/
├── setup/                  # Test configuration
│   ├── db-helpers.ts      # Database test utilities
│   ├── test-data-factory.ts  # Test data generators
│   └── global-setup.ts    # Test database cleanup
├── db/                     # Database tests (skipped)
└── api/                    # API integration tests
```

## API Routes

### Public Routes

#### POST /api/create-payment-intent

Creates a Stripe PaymentIntent and stores temporary submission data.

**Request:**
```json
{
  "formData": { /* complete form data */ }
}
```

**Response:**
```json
{
  "clientSecret": "pi_...",
  "paymentIntentId": "pi_..."
}
```

#### POST /api/verify-payment

Verifies a payment's status with Stripe.

**Request:**
```json
{
  "paymentIntentId": "pi_..."
}
```

**Response:**
```json
{
  "status": "succeeded",
  "amount": 2999
}
```

### Webhook Routes

#### POST /api/webhooks/stripe

Handles Stripe webhook events (payment_intent.succeeded). Creates permanent submission from temporary data and sends to admin queue.

**Security**: Requires valid Stripe signature header.

### Cron Routes

#### GET /api/cron/cleanup-temp-submissions

Scheduled job to delete expired temporary submissions (>24 hours old).

### Admin Routes (Protected)

All admin routes require NextAuth.js authentication.

#### GET /api/admin/submissions

Fetches all submissions with optional filtering by status.

**Query params:**
- `status`: Filter by submission status (pending_review, approved, denied)

#### PATCH /api/admin/submissions/[id]

Updates submission status and review metadata.

**Request:**
```json
{
  "status": "approved" | "denied",
  "reviewedByAdminId": "doctor-uuid"
}
```

## CI/CD

The project uses GitHub Actions for continuous integration:

- **Tests**: Runs on every push and pull request
- **Claude Code Review**: Automated code reviews on PRs
- **Claude PR Assistant**: Available via `@claude` mentions

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Write tests for new functionality
5. Ensure all tests pass (`npm test`)
6. Commit your changes (`git commit -m 'Add amazing feature'`)
7. Push to the branch (`git push origin feature/amazing-feature`)
8. Open a Pull Request

## Documentation

- [Testing Guide](./TESTING.md) - Comprehensive testing documentation
- [Claude Code Guide](./CLAUDE.md) - Information for Claude Code AI

## License

This project is private and proprietary.

## Support

For issues or questions, please open an issue on GitHub.
