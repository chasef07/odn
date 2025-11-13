# Claude Code Guide

This document provides context and guidelines for Claude Code when working with this repository.

## Project Overview

**Online Doctor's Note** is a Next.js 16 application that provides a multi-step form for users to obtain legitimate doctor's notes for work or school absences. The application handles patient information collection, validation, payment processing through Stripe, email notifications with React Email, and includes an admin portal for doctors to review and approve/deny submissions.

## Architecture

### Tech Stack

- **Framework**: Next.js 16.0.1 with App Router
- **Language**: TypeScript 5 (strict mode)
- **UI**: React 19.2.0, Tailwind CSS 4, Radix UI, shadcn/ui
- **Forms**: react-hook-form + Zod validation
- **Payments**: Stripe (v2025-10-29.clover API)
- **Database**: PostgreSQL (Prisma Cloud) + Prisma ORM
- **Authentication**: Better Auth (email/password provider with bcrypt)
- **Email**: React Email 5.0.1 + Resend 4.0.1
- **PDF Generation**: @react-pdf/renderer (doctor's notes)
- **Testing**: Vitest + Testing Library (359 passing tests)
- **Analytics**: Vercel Analytics
- **Build**: Turbopack

### Key Directories

```
src/
├── app/                    # Next.js App Router
│   ├── admin/             # Admin portal (Better Auth protected)
│   │   ├── login/        # Doctor login page
│   │   └── review/       # Submission review dashboard
│   ├── api/               # API routes
│   │   ├── auth/[...all]/  # Better Auth endpoints
│   │   ├── create-payment-intent/  # Payment + temp storage
│   │   ├── verify-payment/         # Payment verification
│   │   ├── webhooks/     # Stripe webhooks (payment.succeeded)
│   │   └── cron/         # Scheduled jobs (cleanup)
│   ├── [form-pages]/      # 13 form step pages
│   └── layout.tsx         # Root layout with fonts & Analytics
├── components/
│   ├── admin/             # Admin portal components
│   ├── form/              # Reusable form components
│   └── ui/                # shadcn/ui components
├── emails/                # React Email templates
│   ├── ApprovalEmail.tsx  # Modern approval notification email
│   ├── DenialEmail.tsx    # Modern denial notification email
│   ├── PaymentConfirmationEmail.tsx  # Payment confirmation email
│   ├── __tests__/         # Email template tests
│   └── README.md          # Email template documentation
├── lib/                   # Business logic & utilities
│   ├── validation-schemas.ts    # 10 Zod schemas
│   ├── date-validators.ts       # Date business rules
│   ├── form-storage.ts          # localStorage helpers
│   ├── form-constants.ts        # Static data
│   ├── email.ts                 # Email sending utilities
│   ├── email-helpers.ts         # Email helper functions (recipient names, absence text)
│   ├── state-licenses.ts        # State-specific medical license mapping (44 states)
│   ├── auth.ts                  # Better Auth config
│   ├── auth-client.ts           # Better Auth client utilities
│   ├── prisma.ts                # Prisma client singleton
│   └── pdf/                     # PDF generation utilities
│       ├── doctor-note-template.tsx  # PDF template using @react-pdf/renderer
│       ├── generate-pdf.ts      # PDF generation and validation
│       └── __tests__/           # PDF generation tests
└── prisma/
    └── schema.prisma      # Database schema
scripts/
├── create-doctor-user.ts        # Create new doctor account
├── delete-all-users.ts          # Delete all users (dev only)
└── test-approval-flow.ts        # Test PDF generation locally
tests/
├── setup/                 # Test infrastructure
│   ├── db-helpers.ts     # Database test utilities
│   ├── test-data-factory.ts  # Test data generators
│   └── global-setup.ts   # Test DB cleanup (SQLite only)
├── db/                    # Database tests (currently skipped)
└── api/                   # API integration tests
```

## Critical Business Rules

### Date Validation (STRICT - DO NOT MODIFY WITHOUT APPROVAL)

1. **Maximum absence**: 7 consecutive days (first day off to last day off)
2. **Lookback limit**: First day off cannot be >7 days in the past
3. **Date range**: All dates between 1900-01-01 and today

**Implementation**: `src/lib/date-validators.ts`

### Form Validation Rules

- **Names**: Letters, spaces, hyphens, apostrophes only (max 50 chars)
- **Phone**: Exactly 10 digits (formatted as `(XXX) XXX-XXXX`)
- **Email**: Valid format, automatically lowercased
- **DOB**: Between 1900-01-01 and today
- **State**: Must be in `AVAILABLE_STATES` list (44 states)

**Implementation**: `src/lib/validation-schemas.ts` (10 schemas: page1-page10)

### Payment Processing

- **Pricing**: Dynamically fetched from Stripe Price ID (configured in environment)
- **Single Source of Truth**: Stripe Dashboard - no code deploys needed to change price
- **Currency**: Supports any currency configured in Stripe Price
- **Provider**: Stripe with automatic payment methods
- **Metadata**: Includes product, service identifiers, and price_id for audit trail

**Implementation**:
- Price fetching: `src/app/api/get-price/route.ts`
- Payment intent creation: `src/app/api/create-payment-intent/route.ts`
- Payment verification: `src/app/api/verify-payment/route.ts`
- Dynamic display: `src/app/payment/page.tsx`

### Monthly Limit Tracking

- **Limit**: 7 days of excused absences per calendar month (soft limit - warning only)
- **Identifier**: Patient email address (case-insensitive)
- **Counting**: Only APPROVED submissions count toward limit
- **Time period**: Calendar month (not rolling 30 days)
- **Implementation**: `src/components/admin/SubmissionsList.tsx` (lines 156-196)
- **Warning Display**: Appears in admin portal with yellow badge when limit exceeded
- **Edge Cases**:
  - Can be bypassed with multiple email addresses
  - Does not consider DOB or patient name (only email)
  - Different names with same email are treated as same patient
  - Same name with different emails are treated as different patients
  - No validation if patient already exceeded limit before current submission

**Note**: This is a soft limit for informational purposes only. Doctors can still approve submissions that exceed the monthly limit.

## Form Flow

The application uses a multi-step form with conditional steps:

1. **State Selection** (`/start`)
2. **Recipient** (`/get-started`) - Determines if step 4 is shown
3. **Patient Info** (`/basic-info`)
4. **Guardian Info** (`/guardian-info`) - **Conditional**: Only if recipient = "someone_else"
5. **Contact Info** (`/contact-info`)
6. **Note Purpose** (`/note-purpose`)
7. **Absence Dates** (`/absence-dates`)
8. **Absence Reason** (`/absence-reason`)
9. **Symptoms** (`/symptoms`)
10. **Additional Info** (`/additional-info`)
11. **Review** (`/review`) - Multi-form editable sections
12. **Payment** (`/payment`) - Stripe Elements
13. **Success** (`/approved`)

**Progress Tracking**: Step numbers adjust based on whether guardian info is required (10 vs 11 total steps).

## Code Style & Conventions

### TypeScript

- **Strict mode**: Enabled
- **Type safety**: No `any` types (use `unknown` if needed)
- **Interfaces**: Prefer `type` for simple types, `interface` for extendable objects
- **Imports**: Use `@/` path alias for `src/`

### React Components

- **Server Components**: Default (use `"use client"` only when needed)
- **Naming**: PascalCase for components, camelCase for functions
- **Props**: Define inline types or extract to `type` declarations
- **Hooks**: Follow React hooks rules (no conditional hooks)

### Forms

- **Library**: react-hook-form with zodResolver
- **Validation**: Zod schemas in `src/lib/validation-schemas.ts`
- **Error handling**: Display errors via `errors` object from react-hook-form
- **Navigation**: Use `FormNavigation` component for consistency

### Testing

- **Location**: Co-located in `__tests__/` directories
- **Naming**: `*.test.ts` or `*.test.tsx`
- **Framework**: Vitest with Testing Library
- **Mocking**: Use `vi.mock()` and `vi.hoisted()` for module mocks
- **Coverage**: Aim for 80%+ on new code

### Styling

- **Primary**: Tailwind CSS utility classes
- **Components**: shadcn/ui variants (no direct Tailwind in shadcn components)
- **Responsive**: Mobile-first approach
- **Dark mode**: Not currently implemented

## Testing Strategy

### Current Coverage (359 passing)

- ✅ Unit tests: All validators and utilities (100% passing)
- ✅ Schema tests: All 10 Zod schemas (100% passing)
- ✅ API tests: Stripe payment endpoints (100% passing)
- ✅ Email tests: React Email rendering and sending (100% passing)
- ✅ Email helper tests: Email logic for caregiver/appointment scenarios (100% passing)
- ✅ PDF generation tests: Doctor's note template rendering (100% passing)
- ✅ State license tests: 44-state medical license mapping (100% passing)
- ✅ Admin action tests: Submission approval/denial workflow (100% passing)
- ⚠️ Component tests: Not yet implemented
- ⚠️ E2E tests: Not yet implemented

**Test Safety**: The `tests/setup/global-setup.ts` file is configured to ALWAYS use the local SQLite test database (`file:./test.db`) and will NEVER touch the production PostgreSQL database, regardless of environment variables.

### How to Write Tests

**Pure Functions** (utilities, validators):

```typescript
// src/lib/__tests__/utility-name.test.ts
import { describe, it, expect } from 'vitest'
import { functionToTest } from '../utility-name'

describe('functionToTest', () => {
  it('should handle valid input', () => {
    expect(functionToTest('valid')).toBe('expected')
  })
})
```

**API Routes** (with mocked Stripe):

```typescript
// src/app/api/route-name/__tests__/route.test.ts
import { describe, it, expect, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { mockStripeMethod } = vi.hoisted(() => ({
  mockStripeMethod: vi.fn(),
}))

vi.mock('stripe', () => ({
  default: class MockStripe {
    // mock implementation
  },
}))

import { POST } from '../route'
```

**React Components**:

```typescript
// src/components/__tests__/component-name.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Component } from '../component-name'

describe('Component', () => {
  it('should render correctly', () => {
    render(<Component prop="value" />)
    expect(screen.getByText('value')).toBeInTheDocument()
  })
})
```

## Common Tasks

### Adding a New Form Field

1. Update the appropriate Zod schema in `validation-schemas.ts`
2. Add the field to the form page component
3. Update `form-storage.ts` type if needed
4. Add tests for the new validation
5. Update `review/page.tsx` if field should be editable
6. Update Prisma schema if field needs to be persisted to database
7. Run `npx prisma generate` and `npx prisma db push`

### Modifying Date Rules

⚠️ **Requires careful consideration** - these are business-critical

1. Update `date-validators.ts` validation logic
2. Update all related tests in `date-validators.test.ts`
3. Update validation constants if needed
4. Update documentation (README.md, CLAUDE.md)

### Adding a New Form Step

1. Create new page in `src/app/[step-name]/page.tsx`
2. Create corresponding Zod schema
3. Update progress tracking logic
4. Update `FormLayout` step calculations
5. Add routing logic (back/forward navigation)
6. Write tests for new schema

### Working with the Database

**Viewing Data:**
```bash
npx prisma studio  # Opens visual database browser at http://localhost:5555
```

**Creating Doctor Account:**
```bash
npx tsx scripts/create-doctor-user.ts  # Creates new doctor account with email/password
```

**Deleting All Users (Dev Only):**
```bash
npx tsx scripts/delete-all-users.ts  # Deletes all users from database
```

**Schema Changes:**
```bash
npx prisma generate  # Regenerate Prisma Client after schema changes
npx prisma db push   # Push schema changes to database (development)
npx prisma migrate dev  # Create migration (production)
```

**Important**: The production database is PostgreSQL on Prisma Cloud. Tests use a local SQLite database (`test.db`). Never modify the global setup to use production DATABASE_URL.

### Debugging Stripe Issues

- Check `.env.local` for correct API keys
- Verify Stripe API version: `2025-10-29.clover`
- Test with Stripe test cards: `4242 4242 4242 4242`
- Check Stripe Dashboard for payment logs
- Review API route logs in development mode
- Check webhook signature verification in `/api/webhooks/stripe`

### Admin Portal Development

**Login:**
- URL: `http://localhost:3000/admin/login`
- Default email: Set via `scripts/create-doctor-user.ts`
- Default password: Set via creation script

**Authentication:**
- Uses Better Auth with email/password provider
- Passwords hashed with bcrypt (10 rounds)
- Sessions stored in database (PostgreSQL)
- Protected routes use `auth()` helper from Better Auth
- Configuration in `src/lib/auth.ts`
- Client utilities in `src/lib/auth-client.ts`

**Submission Status Workflow:**
1. `PENDING_REVIEW` - Initial state after payment
2. `APPROVED` - Doctor approves submission
3. `DENIED` - Doctor denies submission

**Database Schema:**
- `User` - Admin/doctor accounts (Better Auth)
- `Account` - Authentication credentials (Better Auth - stores bcrypt passwords)
- `Session` - Active login sessions (Better Auth)
- `Submission` - Paid, permanent submissions (business logic)
- `TemporarySubmission` - Unpaid submissions (auto-deleted after 24h)

## Environment Variables

Required variables:

```env
# Site Configuration (SEO)
NEXT_PUBLIC_SITE_URL=https://onlinedoctornote.com  # Change to production domain for prod (http://localhost:3000 for dev)

# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_...           # Stripe secret key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=...  # Stripe publishable key
STRIPE_PRICE_ID=price_...               # Stripe Price ID (single source of truth for pricing)
STRIPE_WEBHOOK_SECRET=whsec_...         # Webhook signature verification

# Database Configuration
DATABASE_URL=postgresql://...            # PostgreSQL connection string (Prisma Cloud)
PRISMA_DATABASE_URL=prisma+postgres://accelerate.prisma-data.net/?api_key=...  # Prisma Accelerate

# Better Auth Configuration
BETTER_AUTH_SECRET=...                   # Better Auth secret (generate with: openssl rand -base64 32)
BETTER_AUTH_URL=http://localhost:3000   # Base URL for auth (change to production domain for prod)

# Email Configuration (Resend)
RESEND_API_KEY=re_...                    # Resend API key
RESEND_FROM_EMAIL=noreply@onlinedoctornote.com  # From email address

# Doctor Information (PDF Generation)
DOCTOR_NAME="Dr. Jason Buchwald"         # Doctor's full name for PDF
DOCTOR_CREDENTIALS="MD"                  # Medical credentials (MD, DO, NP, etc.)
DOCTOR_SIGNATURE_URL="/images/doctor-signature.png"  # Path to signature image
# NOTE: DOCTOR_LICENSE_NUMBER removed - now using state-specific licenses from src/lib/state-licenses.ts

# Cron Job Security
CRON_SECRET=...                          # Cron job secret (generate with: openssl rand -hex 32)

# Environment
NODE_ENV=development                     # Environment (development/production)
```

**Important**: Never commit `.env.local` to git. The production `DATABASE_URL` points to PostgreSQL on Prisma Cloud. Tests automatically use SQLite (`test.db`) regardless of this variable.

## Git Workflow

- **Main branch**: `main` (protected, requires PR)
- **Feature branches**: `feature/description-name`
- **Commit format**: Conventional commits preferred
  - `feat: Add new feature`
  - `fix: Fix bug`
  - `test: Add tests`
  - `docs: Update documentation`
  - `refactor: Refactor code`

## CI/CD

### GitHub Actions Workflows

1. **test.yml**: Runs all tests on push/PR (359 passing)
2. **claude-code-review.yml**: Automated code reviews on PRs
3. **claude.yml**: Claude PR assistant (trigger with `@claude`)

**CI/CD Safety**: The test pipeline does NOT have access to `DATABASE_URL` or any production credentials. Tests run against a local SQLite database (`test.db`) only. Production PostgreSQL is never touched by CI/CD.

### Pre-commit Checklist

- [ ] All tests pass (`npm test`) - 359 passing expected
- [ ] No TypeScript errors (`npm run build`)
- [ ] No ESLint errors (`npm run lint`)
- [ ] New features have tests
- [ ] Documentation updated if needed
- [ ] Database schema changes have migrations (`npx prisma migrate dev`)

## SEO Implementation

### Current SEO Features (v3.0.0)

1. **Comprehensive Metadata** (`src/app/layout.tsx`):
   - Site title with template support
   - Meta description optimized for search engines
   - Keywords targeting medical excuse notes
   - OpenGraph tags for social sharing
   - Twitter Card support (when available)
   - Canonical URLs for duplicate content prevention
   - Robots meta tags for indexing control

2. **Robots.txt** (`src/app/robots.ts`):
   - Allows indexing of public pages (homepage, /start, privacy, terms)
   - Blocks internal pages (admin portal, API routes, form steps)
   - Custom rules for AI crawlers (GPTBot, Claude-Web, anthropic-ai)
   - Sitemap reference for search engines

3. **Sitemap** (`src/app/sitemap.ts`):
   - Dynamic XML sitemap generation
   - Priority and change frequency hints
   - Automatic last modified timestamps
   - Includes only public-facing pages

4. **AI Crawler Instructions** (`public/llms-full.txt`):
   - Detailed service description for AI assistants
   - Allowed/disallowed paths for context gathering
   - Rate limiting and HIPAA compliance notes
   - Proper citation instructions

5. **Structured Data** (`src/app/page.tsx`):
   - FAQPage schema.org markup for rich snippets
   - 8 common questions with answers
   - Helps Google display FAQ rich results in search

6. **Form Page Protection**:
   - All 12 form steps have `noindex` metadata
   - Prevents indexing of incomplete user flows
   - Protects user privacy during form submission

### SEO Best Practices Implemented

- ✅ Mobile-responsive design (mobile-first Tailwind CSS)
- ✅ Fast page loads (Next.js optimization, Turbopack)
- ✅ Clean URL structure (`/start`, `/privacy-policy`)
- ✅ Semantic HTML5 markup
- ✅ Image optimization with Next.js `<Image>` component
- ✅ HTTPS enforcement (production)
- ✅ Sitemap submission ready
- ✅ OpenGraph images configured
- ✅ Schema.org structured data

### Post-Launch SEO Tasks

See [docs/SEO_GUIDE.md](./docs/SEO_GUIDE.md) for complete post-deployment checklist:
- Submit sitemap to Google Search Console
- Submit sitemap to Bing Webmaster Tools
- Monitor indexing status
- Track keyword rankings
- Analyze search performance

## Known Issues & Technical Debt

1. **No component tests**: Need to add React component tests for form pages and admin portal
2. **No E2E tests**: Consider adding Playwright tests for complete user flows
3. **No rate limiting**: Payment endpoints and admin API could be abused
4. **No duplicate detection**: Users could submit multiple times with different payment intents
5. ~~**No email confirmation**: Payment succeeds but no receipt or confirmation email sent to user~~ ✅ **RESOLVED**: Payment confirmation emails are now sent immediately after successful payment via Stripe webhook
6. **No admin notifications**: Doctors are not notified when new submissions arrive
7. **localStorage only for form data**: Form progress not synced to server, lost on device change
8. **No dark mode**: UI only supports light mode currently
9. **No PDF storage**: Doctor's notes are generated on-the-fly and not persisted for re-download
10. **Monthly limit bypass**: Email-based tracking can be bypassed with multiple email addresses
11. **No customer testimonials**: Would improve social proof and SEO
12. **No blog or content marketing**: Could improve organic search rankings

## Performance Considerations

- **Bundle size**: Monitor with `npm run build`
- **Image optimization**: Use Next.js `<Image>` component
- **Code splitting**: Automatic with App Router
- **Caching**: Leverage Next.js caching strategies
- **API response times**: Payment intent creation should be <500ms

## Security Considerations

- **Stripe keys**: Never commit real keys to git (in `.gitignore`)
- **Webhook signatures**: Always verify Stripe webhook signatures before processing
- **Input validation**: All user input is validated with Zod on both client and server
- **Password hashing**: bcryptjs with 10 rounds for doctor passwords
- **Session management**: NextAuth.js stores sessions in PostgreSQL database
- **Authentication**: Protected routes use NextAuth.js `auth()` helper
- **Cron job protection**: CRON_SECRET with timing-safe comparison prevents unauthorized execution
- **Environment validation**: All required env vars validated on startup (fails fast if missing)
- **Timing attack prevention**: Bearer token comparison uses `crypto.timingSafeEqual()`
- **Logging security**: Console logs wrapped with NODE_ENV checks (development only)
- **XSS prevention**: React escapes by default
- **CSRF**: Next.js handles CSRF tokens
- **Rate limiting**: Not implemented (should be added)
- **PII handling**: Patient data stored in PostgreSQL with secure connection
- **Database access**: Production credentials only in `.env.local`, never in code or git

## Useful Commands

```bash
# Development
npm run dev                 # Start dev server
npm test                   # Run tests (359 passing)
npm run test:ui            # Run tests with UI
npm run test:coverage      # Run tests with coverage
npm run email              # Preview email templates
npm run build              # Build for production

# Database
npx prisma studio          # Open database browser
npx prisma generate        # Regenerate Prisma Client
npx prisma db push         # Push schema changes (dev)
npx prisma migrate dev     # Create migration (production)
npx tsx scripts/seed-production-data.ts    # Seed test data
npx tsx scripts/update-doctor-password.ts  # Update password

# Debugging
npm run lint               # Check for linting errors
npx tsc --noEmit          # Check TypeScript errors
```

## Getting Help

- **Documentation**: See README.md and TESTING.md
- **Issues**: Check GitHub Issues
- **Code Review**: Tag `@claude` in PR comments
- **Stripe Docs**: https://stripe.com/docs/api

## Important Notes for Claude Code

1. **Business Rules**: The 7-day absence limit and 7-day lookback are non-negotiable. Always verify with the user before modifying.

2. **Test Coverage**: When adding new features, always write tests. The project maintains 80%+ coverage (359 passing tests).

3. **Type Safety**: Maintain strict TypeScript. No `any` types unless absolutely necessary.

4. **Form Flow**: The conditional guardian step affects progress tracking. Be careful when modifying form navigation.

5. **Stripe Integration**: Payment pricing is managed via Stripe Dashboard using Price IDs. Change prices in Stripe Dashboard without code deployments.

6. **Mobile First**: All UI changes should be mobile-responsive.

7. **Validation is Critical**: All form validation is centralized in `validation-schemas.ts` and `date-validators.ts`. Changes here affect the entire application.

8. **localStorage**: Form data persists in localStorage. Consider privacy implications when adding new fields.

9. **Database Safety**: NEVER modify `tests/setup/global-setup.ts` to use production DATABASE_URL. It must ALWAYS use `file:./test.db`. The production database is PostgreSQL on Prisma Cloud and must never be touched by tests.

10. **Admin Portal**: Protected by Better Auth. All admin routes require authentication. Doctor passwords are hashed with bcrypt (10 rounds).

11. **Submission Flow**: Payment → TemporarySubmission → Webhook → Permanent Submission + Payment Confirmation Email → Admin Review → Approve/Deny → Approval Email with PDF (if approved) or Denial Email with Refund (if denied)

12. **Approval Automation**: When doctors approve submissions, the system automatically generates a professional PDF doctor's note using @react-pdf/renderer and sends it via email with Resend. PDF generation is BLOCKING (must succeed for approval), while email sending is NON-BLOCKING (logs warning if fails). Doctor information (name, credentials, signature) is configured via environment variables. State-specific medical license numbers are automatically pulled from `src/lib/state-licenses.ts` based on the patient's state.

13. **Email System**: Uses React Email 5.0 with Tailwind CSS for modern, responsive email templates. Brand color is #009ed9 (cyan blue). Three email types: Payment Confirmation (sent immediately after payment via webhook with submission ID), Approval (includes PDF attachment), and Denial (includes refund confirmation). All emails are NON-BLOCKING in webhook/admin flows to prevent failures. Preview emails with `npm run email`. IMPORTANT: Email templates use standard hex colors (not OKLCH) for maximum email client compatibility.

13a. **Email Logic (Caregiver & Appointment Scenarios)**: Email templates use helper functions from `src/lib/email-helpers.ts` to ensure consistent logic. The `notePurpose` (work/school/both) determines the email text - NOT the `absenceReason`. This ensures email and PDF text match perfectly:
   - **Caregiver + Work**: Adult taking care of family → "from work" / "employer"
   - **Caregiver + School**: Student taking care of family → "from school" / "school"
   - **Appointment + Work**: Patient with work appointment → "from work" / "employer"
   - **Appointment + School**: Patient with school appointment → "from school" / "school"

   The caregiver/appointment status ONLY affects the closing empathy paragraph, not the "from work/school" text. Always use `getRecipientName(notePurpose)` and `getAbsenceFromText(notePurpose)` helper functions instead of inline conditionals.

14. **PDF Generation**: Doctor's notes are generated on-the-fly using @react-pdf/renderer with a professional medical document template branded with Platinum Health Clinic. PDFs include patient information, absence dates, symptoms, doctor's signature, and dynamic "return to work/school" text based on note purpose. State-specific medical licenses are displayed using `src/lib/state-licenses.ts` (44 states mapped). Contact email is hello@platinumhealthclinic.com. Test PDF generation locally with `npx tsx scripts/test-approval-flow.ts`.

15. **Analytics**: Vercel Analytics is integrated in `src/app/layout.tsx` for tracking page views and web vitals in production.

16. **Stripe Webhooks (Local Dev)**: Use Stripe CLI (`stripe listen --forward-to localhost:3000/api/webhooks/stripe`) to test webhook events locally. The webhook secret from CLI output must be added to `.env.local`.

17. **SEO Optimization**: Comprehensive SEO implementation including robots.txt, sitemap.xml, metadata optimization, OpenGraph tags, structured data (FAQPage schema), and AI crawler instructions (llms-full.txt). All form pages are noindexed to protect user privacy. See "SEO Implementation" section for details.

18. **Monthly Limit Tracking**: The admin portal displays a warning when a patient (identified by email) has been approved for more than 7 days in a calendar month. This is a soft limit for informational purposes only - doctors can still approve submissions that exceed it. The system only counts APPROVED submissions and uses case-insensitive email matching. Note that this can be bypassed with multiple email addresses.

19. **State Medical Licenses**: The system supports 44 U.S. states with state-specific medical license numbers configured in `src/lib/state-licenses.ts`. PDFs automatically display the appropriate license for the patient's state. If a state is not in the mapping, no license section is displayed (graceful degradation).

20. **Favicon**: The application uses a custom SVG favicon (`src/app/icon.svg`) featuring a cyan stethoscope design (#00b8d4). The favicon is implemented as a Next.js 16 metadata file in the `src/app/` directory, which automatically generates optimized versions for different sizes and devices. This follows the modern App Router convention (not the legacy `public/favicon.ico` approach).
