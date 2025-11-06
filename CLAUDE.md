# Claude Code Guide

This document provides context and guidelines for Claude Code when working with this repository.

## Project Overview

**Online Doctor's Note** is a Next.js 15 application that provides a multi-step form for users to obtain legitimate doctor's notes for work or school absences. The application handles patient information collection, validation, payment processing through Stripe, and includes an admin portal for doctors to review and approve/deny submissions.

## Architecture

### Tech Stack

- **Framework**: Next.js 15.5.5 with App Router
- **Language**: TypeScript 5 (strict mode)
- **UI**: React 19, Tailwind CSS 4, Radix UI, shadcn/ui
- **Forms**: react-hook-form + Zod validation
- **Payments**: Stripe (v2025-09-30.clover API)
- **Database**: PostgreSQL (Prisma Cloud) + Prisma ORM
- **Authentication**: NextAuth.js v5 (credentials provider)
- **Testing**: Vitest + Testing Library (217 passing tests, 48 skipped)
- **Build**: Turbopack

### Key Directories

```
src/
├── app/                    # Next.js App Router
│   ├── admin/             # Admin portal (NextAuth protected)
│   │   ├── login/        # Doctor login page
│   │   └── dashboard/    # Submission review dashboard
│   ├── api/               # API routes
│   │   ├── auth/         # NextAuth.js endpoints
│   │   ├── create-payment-intent/  # Payment + temp storage
│   │   ├── verify-payment/         # Payment verification
│   │   ├── webhooks/     # Stripe webhooks (payment.succeeded)
│   │   └── cron/         # Scheduled jobs (cleanup)
│   ├── [form-pages]/      # 13 form step pages
│   └── layout.tsx         # Root layout with fonts
├── components/
│   ├── admin/             # Admin portal components
│   ├── form/              # Reusable form components
│   └── ui/                # shadcn/ui components
├── lib/                   # Business logic & utilities
│   ├── validation-schemas.ts    # 10 Zod schemas
│   ├── date-validators.ts       # Date business rules
│   ├── form-storage.ts          # localStorage helpers
│   ├── form-constants.ts        # Static data
│   ├── auth.ts                  # NextAuth config
│   └── prisma.ts                # Prisma client singleton
└── prisma/
    └── schema.prisma      # Database schema
scripts/
├── seed-production-data.ts      # Seed test data
└── update-doctor-password.ts    # Update doctor password
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

- **Amount**: Fixed at $29.99 (2999 cents)
- **Currency**: USD only
- **Provider**: Stripe with automatic payment methods
- **Metadata**: Includes product and service identifiers

**Implementation**: `src/app/api/create-payment-intent/route.ts`, `src/app/api/verify-payment/route.ts`

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

### Current Coverage (217 passing, 48 skipped)

- ✅ Unit tests: All validators and utilities (100% passing)
- ✅ Schema tests: All 10 Zod schemas (100% passing)
- ✅ API tests: Stripe payment endpoints (100% passing)
- ⏭️ Database tests: Submission lifecycle, schema constraints (skipped - test isolation issues)
- ⏭️ Integration tests: Webhook handlers, cron jobs (skipped - test isolation issues)
- ⚠️ Component tests: Not yet implemented
- ⚠️ Admin portal tests: Not yet implemented

**Important**: Database integration tests (48 tests in 4 files) are currently skipped with `describe.skip()` and TODO comments. They pass individually but fail when run together due to test isolation issues with shared database state and Doctor foreign key cleanup. These should be refactored in the future but all business logic tests are passing.

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

**Seeding Test Data:**
```bash
npx tsx scripts/seed-production-data.ts  # Creates 10 test submissions + doctor account
```

**Updating Doctor Password:**
```bash
npx tsx scripts/update-doctor-password.ts  # Updates fagenchase@gmail.com password
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
- Verify Stripe API version: `2025-09-30.clover`
- Test with Stripe test cards: `4242 4242 4242 4242`
- Check Stripe Dashboard for payment logs
- Review API route logs in development mode
- Check webhook signature verification in `/api/webhooks/stripe`

### Admin Portal Development

**Login:**
- URL: `http://localhost:3000/admin/login`
- Default email: `fagenchase@gmail.com`
- Default password: Set via seeding script

**Authentication:**
- Uses NextAuth.js v5 with credentials provider
- Session stored in database (PostgreSQL)
- Protected routes use `auth()` helper
- Configuration in `src/lib/auth.ts`

**Submission Status Workflow:**
1. `PENDING_REVIEW` - Initial state after payment
2. `APPROVED` - Doctor approves submission
3. `DENIED` - Doctor denies submission

**Database Schema:**
- `Doctor` - Admin users with email/password
- `Submission` - Paid, permanent submissions
- `TemporarySubmission` - Unpaid submissions (auto-deleted after 24h)
- `Session`, `Account` - NextAuth.js tables

## Environment Variables

Required variables:

```env
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_...           # Stripe secret key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=...  # Stripe publishable key
NEXT_PUBLIC_PAYMENT_AMOUNT=2495         # Amount in cents ($24.95)
STRIPE_WEBHOOK_SECRET=whsec_...         # Webhook signature verification

# Database Configuration
DATABASE_URL=postgresql://...            # PostgreSQL connection string (Prisma Cloud)

# NextAuth Configuration
AUTH_SECRET=...                          # NextAuth.js secret (generate with: openssl rand -base64 32)
AUTH_URL=http://localhost:3000          # Base URL for auth

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

1. **test.yml**: Runs all tests on push/PR (217 passing, 48 skipped)
2. **claude-code-review.yml**: Automated code reviews on PRs
3. **claude.yml**: Claude PR assistant (trigger with `@claude`)

**CI/CD Safety**: The test pipeline does NOT have access to `DATABASE_URL` or any production credentials. Tests run against a local SQLite database (`test.db`) only. Production PostgreSQL is never touched by CI/CD.

### Pre-commit Checklist

- [ ] All tests pass (`npm test`) - 217 passing expected
- [ ] No TypeScript errors (`npm run build`)
- [ ] No ESLint errors (`npm run lint`)
- [ ] New features have tests
- [ ] Documentation updated if needed
- [ ] Database schema changes have migrations (`npx prisma migrate dev`)

## Known Issues & Technical Debt

1. **Database test isolation**: 48 integration tests skipped due to test isolation issues with shared database state and Doctor foreign key cleanup. Tests pass individually. TODO: Refactor test infrastructure to fix.
2. **No component tests**: Need to add React component tests for form pages and admin portal
3. **No E2E tests**: Consider adding Playwright tests for complete user flows
4. **No rate limiting**: Payment endpoints and admin API could be abused
5. **No duplicate detection**: Users could submit multiple times with different payment intents
6. **Hardcoded payment amount**: Should be configurable via environment variable or admin settings
7. **No email confirmation**: Payment succeeds but no receipt or confirmation email sent to user
8. **No admin notifications**: Doctors are not notified when new submissions arrive
9. **No approval/denial emails**: Users are not notified when their submission is reviewed
10. **localStorage only for form data**: Form progress not synced to server, lost on device change

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
npm test                   # Run tests (217 passing, 48 skipped)
npm run test:ui            # Run tests with UI
npm run test:coverage      # Run tests with coverage
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

2. **Test Coverage**: When adding new features, always write tests. The project maintains 80%+ coverage (217 passing tests).

3. **Type Safety**: Maintain strict TypeScript. No `any` types unless absolutely necessary.

4. **Form Flow**: The conditional guardian step affects progress tracking. Be careful when modifying form navigation.

5. **Stripe Integration**: Payment amount is fixed. Any changes require updating multiple files and environment variables.

6. **Mobile First**: All UI changes should be mobile-responsive.

7. **Validation is Critical**: All form validation is centralized in `validation-schemas.ts` and `date-validators.ts`. Changes here affect the entire application.

8. **localStorage**: Form data persists in localStorage. Consider privacy implications when adding new fields.

9. **Database Safety**: NEVER modify `tests/setup/global-setup.ts` to use production DATABASE_URL. It must ALWAYS use `file:./test.db`. The production database is PostgreSQL on Prisma Cloud and must never be touched by tests.

10. **Admin Portal**: Protected by NextAuth.js. All admin routes require authentication. Doctor passwords are hashed with bcrypt.

11. **Submission Flow**: Payment → TemporarySubmission → Webhook → Permanent Submission → Admin Review → Approve/Deny

12. **Skipped Tests**: 48 database integration tests are currently skipped due to test isolation issues. They are marked with `describe.skip()` and TODO comments. Don't be alarmed - all business logic tests pass.
