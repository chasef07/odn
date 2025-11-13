# Online Doctor's Note

A Next.js application for generating legitimate online doctor's notes with a streamlined multi-step form process and secure payment integration.

## Overview

This application provides a user-friendly interface for individuals to obtain doctor's notes for work or school absences. The form collects necessary medical and personal information, validates it against business rules, and processes payments through Stripe.

## Features

### Core Features
- **Multi-step Form Flow**: 10-11 step guided form with progress tracking
- **Admin Portal**: Secure doctor dashboard for reviewing and approving submissions
- **Smart Validation**: Real-time form validation with Zod schemas
- **Date Rules**: Enforces 7-day maximum absence period, 7-day lookback limit
- **Guardian Support**: Conditional forms for minors requiring guardian information
- **Stripe Integration**: Secure payment processing ($24.95)
- **Mobile Responsive**: Optimized UI for all device sizes
- **Form Persistence**: Auto-saves progress to localStorage
- **Database**: PostgreSQL with Prisma ORM for production data
- **Comprehensive Testing**: 359 automated tests passing with 80%+ coverage

### Email & Notifications
- **Modern Email Templates**: Beautiful React Email 5.0 templates with Tailwind CSS
- **Smart Email Logic**: Helper functions ensure consistent text for caregiver/appointment scenarios
- **Payment Confirmation**: Instant email with submission ID after successful payment
- **Approval Emails**: Automated emails with PDF attachment on approval
- **Denial Emails**: Automated refund notification emails
- **Email Provider**: Resend for reliable email delivery
- **Responsive Design**: Mobile-optimized email layouts
- **Dynamic Content**: Email text automatically matches PDF content based on work/school purpose

### PDF Generation
- **Professional PDFs**: Auto-generated doctor's notes using @react-pdf/renderer
- **Platinum Health Clinic Branding**: Custom letterhead and contact information
- **State-Specific Medical Licenses**: Automatic display of appropriate license for 44 U.S. states
- **Digital Signatures**: Doctor signature included on all notes
- **Caregiver Support**: Dynamic language for caregivers vs. patients
- **Instant Delivery**: PDF attached to approval emails

### Admin Features
- **Approval Automation**: One-click approval with automatic PDF generation and email
- **Monthly Limit Tracking**: Flags patients exceeding 7 days per month (soft limit)
- **Refund Processing**: Automatic Stripe refunds on denial
- **Review Dashboard**: FIFO queue with submission filtering

### SEO & Analytics
- **SEO Optimized**: Comprehensive metadata, OpenGraph, structured data
- **Search Engine Ready**: robots.txt, sitemap.xml, llms-full.txt
- **Rich Snippets**: FAQPage schema for Google search results
- **Vercel Analytics**: Real-time page views and web vitals tracking

## Tech Stack

- **Framework**: Next.js 16.0.1 (App Router, Turbopack)
- **Language**: TypeScript 5
- **UI Library**: React 19.2.0
- **Styling**: Tailwind CSS 4
- **Components**: Radix UI + shadcn/ui
- **Forms**: react-hook-form + Zod validation
- **Payments**: Stripe (API v2025-10-29.clover)
- **Database**: PostgreSQL (Prisma Cloud) + Prisma ORM
- **Authentication**: Better Auth with email/password provider
- **Email**: React Email 5.0 + Resend
- **Testing**: Vitest + Testing Library
- **Analytics**: Vercel Analytics
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

Create a `.env.local` file with the following required variables:

```env
# Site Configuration (SEO)
NEXT_PUBLIC_SITE_URL=http://localhost:3000  # Change to production domain for prod

# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID=price_...  # Create a Price in Stripe Dashboard - single source of truth for pricing

# Database Configuration
DATABASE_URL=postgresql://user:password@host:5432/database
PRISMA_DATABASE_URL=prisma+postgres://accelerate.prisma-data.net/?api_key=your_api_key

# Better Auth Configuration
BETTER_AUTH_SECRET=your-auth-secret-here  # Generate with: openssl rand -base64 32
BETTER_AUTH_URL=http://localhost:3000  # Change to production domain for prod

# Cron Job Security
CRON_SECRET=your-cron-secret-here  # Generate with: openssl rand -hex 32

# Email Configuration (Resend)
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=noreply@onlinedoctornote.com

# Doctor Information (for PDF generation)
DOCTOR_NAME="Dr. Jason Buchwald"
DOCTOR_CREDENTIALS="MD"
DOCTOR_SIGNATURE_URL="/images/doctor-signature.png"
# NOTE: DOCTOR_LICENSE_NUMBER removed - state-specific licenses in src/lib/state-licenses.ts
```

See `.env.example` for complete configuration with comments.

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

# Preview email templates
npm run email

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
- **Authentication**: Better Auth with email/password
- **Default credentials**: Set up using `scripts/create-doctor-user.ts`

To create a new doctor account:

```bash
npx tsx scripts/create-doctor-user.ts
```

To delete all users (development only):

```bash
npx tsx scripts/delete-all-users.ts
```

### Stripe Webhooks (Local Development)

To test payment webhooks locally, you need to forward Stripe events to your localhost:

1. **Install Stripe CLI**:
   ```bash
   brew install stripe/stripe-cli/stripe
   ```

2. **Login to Stripe**:
   ```bash
   stripe login
   ```

3. **Forward webhooks to localhost**:
   ```bash
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```

4. **Copy the webhook signing secret** (starts with `whsec_...`) and add to `.env.local`:
   ```env
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```

5. **Start dev server** (in another terminal):
   ```bash
   npm run dev
   ```

Now test payments will trigger webhook events locally!

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

- **359 tests passing** (all passing, no skipped tests)
- **Unit tests**: Validators, utilities, schemas, email helpers (100% passing)
- **Integration tests**: API routes with mocked Stripe (100% passing)
- **Email tests**: React Email rendering and sending (100% passing)
- **PDF tests**: Doctor's note template rendering (100% passing)
- **State license tests**: 44-state medical license mapping (100% passing)
- **Admin tests**: Approval/denial workflow automation (100% passing)
- **Coverage**: 80%+ across the codebase

See [TESTING.md](./TESTING.md) for detailed testing documentation.

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
│   ├── admin/               # Admin portal (Better Auth protected)
│   │   ├── login/          # Doctor login page
│   │   └── review/         # Submission review dashboard
│   ├── api/                 # API routes
│   │   ├── auth/[...all]/  # Better Auth endpoints
│   │   ├── create-payment-intent/
│   │   ├── verify-payment/
│   │   ├── cron/           # Scheduled jobs (cleanup)
│   │   └── webhooks/       # Stripe webhooks
│   ├── [form-pages]/        # Multi-step form pages
│   └── layout.tsx           # Root layout with Analytics
├── components/              # React components
│   ├── admin/              # Admin portal components
│   ├── form/               # Form-specific components
│   └── ui/                 # shadcn/ui components
├── emails/                  # React Email templates
│   ├── DenialEmail.tsx     # Modern denial notification email
│   └── README.md           # Email template documentation
├── lib/                    # Utilities and business logic
│   ├── validation-schemas.ts  # Zod schemas
│   ├── date-validators.ts     # Date validation logic
│   ├── phone-utils.ts         # Phone formatting
│   ├── age-validators.ts      # Age validation
│   ├── form-storage.ts        # localStorage helpers
│   ├── form-constants.ts      # Static data
│   ├── email.ts               # Email sending utilities
│   ├── auth.ts                # Better Auth configuration
│   ├── auth-client.ts         # Better Auth client utilities
│   └── prisma.ts              # Prisma client singleton
├── __tests__/              # Test files
└── prisma/
    └── schema.prisma       # Database schema
scripts/
├── create-doctor-user.ts     # Create new doctor account
└── delete-all-users.ts       # Delete all users (dev only)
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
  "amount": 2495
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

All admin routes require Better Auth authentication.

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

## Production Deployment

Before deploying to production:

1. **Set all environment variables** in your hosting platform (Vercel, AWS, etc.)
2. **Update domain-specific variables**:
   - `NEXT_PUBLIC_SITE_URL=https://onlinedoctornote.com`
   - `BETTER_AUTH_URL=https://onlinedoctornote.com`
   - `RESEND_FROM_EMAIL=noreply@onlinedoctornote.com`
3. **Configure Stripe webhooks** to point to production URL
4. **Run database migrations**: `npx prisma migrate deploy`
5. **Create doctor account** for admin access
6. **Test all critical paths**: Payment flow, approval flow, refund flow
7. **Submit sitemap** to Google Search Console and Bing Webmaster Tools

See [docs/PRODUCTION_DEPLOYMENT.md](./docs/PRODUCTION_DEPLOYMENT.md) for complete deployment checklist.

## Recent Updates (v3.0.0)

### PDF Redesign
- Redesigned doctor's note template with professional letterhead
- Added Platinum Health Clinic branding
- Updated contact information (hello@platinumhealthclinic.com)
- Fixed dynamic "return to work/school" text based on note purpose

### Email System
- Updated color scheme to #009ed9 (cyan blue)
- Fixed OKLCH color compatibility issues for email clients
- Modern responsive design with Tailwind CSS

### SEO Implementation
- Added comprehensive metadata and OpenGraph tags
- Implemented robots.txt for crawler control
- Created dynamic sitemap.xml for search engines
- Added llms-full.txt for AI crawler instructions
- Implemented FAQPage structured data for rich snippets
- Added MedicalBusiness schema.org markup

## Documentation

- [Testing Guide](./TESTING.md) - Comprehensive testing documentation
- [Claude Code Guide](./CLAUDE.md) - Information for Claude Code AI
- [SEO Guide](./docs/SEO_GUIDE.md) - SEO optimization checklist and best practices
- [Production Deployment](./docs/PRODUCTION_DEPLOYMENT.md) - Production deployment checklist
- [Stripe Migration Guide](./docs/STRIPE_MIGRATION_GUIDE.md) - Migrating to Stripe Price IDs

## Known Issues & Future Improvements

### Current Limitations
- Monthly limit tracking uses email only (can be bypassed with multiple emails)
- No duplicate submission detection
- No customer testimonials or reviews system
- No admin notification system for new submissions

See [CLAUDE.md](./CLAUDE.md) for complete technical debt list.

## License

This project is private and proprietary.

## Support

For issues or questions, please contact hello@onlinedoctornote.com or open an issue on GitHub.
