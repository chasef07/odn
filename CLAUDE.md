# Claude Code Guide

This document provides guidelines and context for AI assistants (Claude Code) working on this codebase.

## Project Overview

**Online Doctor's Note** is a production Next.js 16 application that provides legitimate medical excuse notes for work or school absences. Users complete a multi-step form, pay via Stripe, and receive a doctor-reviewed professional PDF note via email.

## Tech Stack

- **Framework**: Next.js 16.0.3 (App Router, Turbopack)
- **Language**: TypeScript 5 (strict mode)
- **UI**: React 19, Tailwind CSS 4, shadcn/ui, Radix UI
- **Forms**: react-hook-form + Zod validation
- **Database**: PostgreSQL + Prisma ORM + Prisma Accelerate
- **Payments**: Stripe (v2025-10-29.clover API)
- **Auth**: Better Auth (email/password + bcrypt)
- **Email**: React Email + Resend
- **PDF**: @react-pdf/renderer
- **Testing**: Vitest + Testing Library

## Project Structure

```
src/
├── app/
│   ├── admin/              # Admin portal (Better Auth protected)
│   │   ├── login/         # Doctor login
│   │   ├── review/        # Submission review dashboard
│   │   ├── search/        # Search & edit submissions
│   │   │   └── [id]/      # Single submission detail/edit
│   │   ├── maybe/         # Maybe queue with editable cards
│   │   ├── approved/      # Today's approved submissions
│   │   └── denied/        # Today's denied submissions
│   ├── api/               # API routes
│   │   ├── auth/          # Better Auth endpoints
│   │   ├── create-payment-intent/
│   │   ├── verify-payment/
│   │   ├── webhooks/      # Stripe webhooks
│   │   └── cron/          # Cleanup jobs
│   └── [form-pages]/      # 12 form steps
├── components/
│   ├── admin/             # Admin components
│   │   ├── SearchPage.tsx           # Search interface
│   │   ├── SearchSubmissionDetail.tsx # Edit/view submission
│   │   ├── StatusBadge.tsx          # Reusable status badge
│   │   └── ...
│   ├── form/              # Form components
│   └── ui/                # shadcn/ui components
├── emails/                # React Email templates
├── lib/                   # Business logic
│   ├── validation-schemas.ts
│   ├── date-validators.ts
│   ├── auth.ts
│   ├── email.ts
│   ├── state-licenses.ts
│   └── pdf/
└── prisma/
    └── schema.prisma
```

## Critical Business Rules

### Date Validation (STRICT)

**DO NOT MODIFY without user approval**

- Maximum absence: 7 consecutive days
- Lookback limit: First day off cannot be >7 days in the past
- Valid date range: 1900-01-01 to today

Implementation: `src/lib/date-validators.ts`

### Form Validation

- Names: Letters, spaces, hyphens, apostrophes only (max 50 chars)
- Phone: 10 digits formatted as `(XXX) XXX-XXXX`
- Email: Valid format, auto-lowercased, TLD whitelist validation (rejects invalid TLDs like `.clm`)
- DOB: Between 1900-01-01 and today
- State: Must be in `AVAILABLE_STATES` (44 states)

Implementation: `src/lib/validation-schemas.ts`

**Email TLD Validation**: Validates against `COMMON_TLDS` whitelist (covers 95%+ of legitimate emails). Rejects invalid TLDs and provides suggestions for common typos.

### Payment Processing

- **Pricing**: Dynamically fetched from Stripe Price ID (env variable)
- **Architecture**: Reversed order - TemporarySubmission → PaymentIntent → Webhook
- **Reliability**: 2-tier fallback in webhook handler
- **Performance**: Prisma Accelerate for 40x faster DB operations

Key files:
- `src/app/api/create-payment-intent/route.ts`
- `src/app/api/webhooks/stripe-prod/route.ts`
- `src/app/api/verify-payment/route.ts`

### Monthly Limit Tracking

- Limit: 7 days per calendar month (soft limit - warning only)
- Identifier: Patient email (case-insensitive)
- Only APPROVED submissions count
- Can be bypassed with multiple emails (known limitation)

Implementation: `src/components/admin/SubmissionsList.tsx` (lines 156-196)

## Form Flow

1. State Selection (`/start`)
2. Recipient (`/get-started`)
3. Patient Info (`/basic-info`)
4. Guardian Info (`/guardian-info`) - **Conditional** if recipient = "someone_else"
5. Contact Info (`/contact-info`)
6. Note Purpose (`/note-purpose`)
7. Absence Dates (`/absence-dates`)
8. Absence Reason (`/absence-reason`)
9. Symptoms (`/symptoms`)
10. Additional Info (`/additional-info`)
11. Review (`/review`)
12. Payment (`/payment`)
13. Success (`/approved`)

**Progress tracking**: Adjusts based on guardian step (10 vs 11 total steps)

## Code Style & Conventions

### TypeScript

- Strict mode enabled
- No `any` types (use `unknown` if needed)
- Prefer `type` over `interface` for simple types
- Use `@/` path alias for `src/`

### React

- Server Components by default
- `"use client"` only when necessary
- PascalCase for components, camelCase for functions
- No conditional hooks

### Forms

- react-hook-form with zodResolver
- Zod schemas in `validation-schemas.ts`
- Display errors via `errors` object
- Use `FormNavigation` component

### Testing

- Co-located `__tests__/` directories
- `*.test.ts` or `*.test.tsx`
- Vitest + Testing Library
- Mock with `vi.mock()` and `vi.hoisted()`

### Styling

- Tailwind CSS utility classes
- shadcn/ui for components
- Mobile-first responsive design
- No dark mode (not implemented)

## Common Tasks

### Adding a Form Field

1. Update Zod schema in `validation-schemas.ts`
2. Add field to form page component
3. Update `form-storage.ts` type if needed
4. Add tests for validation
5. Update `review/page.tsx` if editable
6. Update Prisma schema if persisted
7. Run `npx prisma generate && npx prisma db push`

### Modifying Date Rules

⚠️ **Business-critical** - requires careful consideration

1. Update `date-validators.ts`
2. Update all tests in `date-validators.test.ts`
3. Update validation constants
4. Update documentation

### Adding a Form Step

1. Create page in `src/app/[step-name]/page.tsx`
2. Create Zod schema
3. Update progress tracking logic
4. Update `FormLayout` calculations
5. Add routing logic (back/forward)
6. Write tests

### Database Operations

```bash
# View data
npx prisma studio

# Create doctor account
npx tsx scripts/create-doctor-user.ts

# Schema changes
npx prisma generate
npx prisma db push          # Development
npx prisma migrate dev      # Production

# Delete users (dev only)
npx tsx scripts/delete-all-users.ts
```

**Important**: Production DB is PostgreSQL on Prisma Cloud. Tests use local SQLite (`test.db`).

### Debugging Stripe

- Check `.env.local` for correct API keys
- Verify API version: `2025-10-29.clover`
- Test cards: `4242 4242 4242 4242`
- Check Stripe Dashboard for logs
- Review API route logs in dev
- Check webhook signature in `/api/webhooks/stripe-prod`

### Admin Portal

**Login**: `http://localhost:3000/admin/login`

**Auth**: Better Auth with email/password (bcrypt, 10 rounds)

**Admin Routes**:
- `/admin` - Dashboard with stats and "Search All Submissions" button
- `/admin/review` - Tinder-style card review for pending submissions
- `/admin/search` - Search submissions by name, email, or ID
- `/admin/search/[id]` - View/edit single submission with status actions
- `/admin/maybe` - Maybe queue with editable cards
- `/admin/approved` - Today's approved submissions
- `/admin/denied` - Today's denied submissions

**Submission Status Flow**:
1. `PENDING_REVIEW` - Initial state
2. `APPROVED` - Doctor approves
3. `DENIED` - Doctor denies
4. `MAYBE` - Needs more review
5. `MANUAL` - Doctor-handled offline

**Search & Edit Feature** (`/admin/search`):
- Search by name (partial match on first/last), email (contains), or ID (prefix)
- View all form fields for any submission regardless of status
- Edit any field and save changes
- Status action buttons: Approve, Re-Approve, Deny, Maybe, Manual
- Re-approval generates new PDF and sends new email
- Smart refund handling: checks `stripeRefundId` before processing

**Key Server Actions** (`src/app/admin/actions.ts`):
- `searchSubmissions()` - Paginated search with type selector
- `reApproveSubmission()` - Regenerate PDF and resend email
- `changeSubmissionStatus()` - Handle complex status transitions
- `approveSubmission()` / `denySubmission()` - Standard approval/denial
- `updateSubmission()` - Save field edits

**Database Models**:
- `User` - Admin/doctor accounts
- `Account` - Auth credentials (bcrypt passwords)
- `Session` - Login sessions
- `TemporarySubmission` - Unpaid (auto-deleted after 2 hours)
- `Submission` - Paid, permanent records

## Environment Variables

```env
# Site
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Stripe
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_PRICE_ID=price_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Database
DATABASE_URL=postgresql://...              # Direct (migrations)
PRISMA_DATABASE_URL=prisma+postgres://...  # Accelerate (runtime)

# Better Auth
BETTER_AUTH_SECRET=...
BETTER_AUTH_URL=http://localhost:3000

# Email (Resend)
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=noreply@yourdomain.com

# Doctor Info
DOCTOR_NAME="Dr. Your Name"
DOCTOR_CREDENTIALS="MD"
DOCTOR_SIGNATURE_URL="/images/doctor-signature.png"

# Cron
CRON_SECRET=...

# Environment
NODE_ENV=development
```

## Email System

Three email types:

1. **Payment Confirmation** - Sent immediately after payment via webhook
2. **Approval Email** - Includes PDF attachment
3. **Denial Email** - Includes refund confirmation

All use React Email 5.0 with Tailwind CSS. Brand color: `#009ed9` (cyan blue).

**Important**: Email templates use standard hex colors (not OKLCH) for email client compatibility.

### Email Logic

Helper functions in `src/lib/email-helpers.ts`:

- `getRecipientName(notePurpose)` - Returns "employer" or "school"
- `getAbsenceFromText(notePurpose)` - Returns "from work" or "from school"

**Key Rule**: The `notePurpose` determines email text, NOT `absenceReason`.

Examples:
- Caregiver + Work → "from work" / "employer"
- Caregiver + School → "from school" / "school"
- Appointment + Work → "from work" / "employer"
- Appointment + School → "from school" / "school"

Preview emails: `npm run email`

## PDF Generation

Uses @react-pdf/renderer with Plus Jakarta Sans font.

**Features**:
- Professional medical document template
- State-specific medical licenses (44 states in `state-licenses.ts`)
- Dynamic "return to work/school" text based on `notePurpose`
- Branded with Platinum Health Clinic
- Contact: hello@platinumhealthclinic.com
- Phone: 786-292-3070

**Font Loading**: Fonts loaded from `@fontsource/plus-jakarta-sans` npm package with validation and fallback.

Test locally: `npx tsx scripts/test-approval-flow.ts`

Implementation: `src/lib/pdf/doctor-note-template.tsx`

## Testing

**Current coverage**: Comprehensive (369+ passing tests)

- ✅ Unit tests (validators, utilities)
- ✅ Schema tests (all 10 Zod schemas)
- ✅ API tests (Stripe mocked)
- ✅ Email tests (rendering + sending)
- ✅ PDF tests (generation + validation)
- ✅ State license tests (44 states)
- ✅ Admin action tests (approval/denial)
- ⚠️ Component tests (not implemented)
- ⚠️ E2E tests (not implemented)

**Test Safety**: Tests ALWAYS use local SQLite (`test.db`), never production PostgreSQL.

Run tests: `npm test`

## Git Workflow

- Main branch: `main` (protected, requires PR)
- Feature branches: `feature/description-name`
- Commit format: Conventional commits
  - `feat:` New feature
  - `fix:` Bug fix
  - `test:` Add tests
  - `docs:` Documentation
  - `refactor:` Code refactor

## CI/CD

### GitHub Actions

1. `test.yml` - Runs all tests on push/PR
2. `claude-code-review.yml` - Automated code reviews
3. `claude.yml` - Claude PR assistant (trigger with `@claude`)

**CI Safety**: No access to production credentials. Tests use SQLite only.

### Pre-commit Checklist

- [ ] All tests pass (`npm test`)
- [ ] No TypeScript errors (`npm run build`)
- [ ] No ESLint errors (`npm run lint`)
- [ ] New features have tests
- [ ] Documentation updated
- [ ] Schema changes have migrations

## Security

- Input validation (Zod on client + server)
- Stripe webhook signature verification
- Better Auth session management (PostgreSQL)
- bcrypt password hashing (10 rounds)
- Timing-safe comparison for cron secrets
- Environment variable validation on startup
- XSS prevention (React escaping)
- CSRF protection (Next.js)

## Known Issues & Limitations

1. No component tests
2. No E2E tests
3. No rate limiting
4. No duplicate payment detection
5. localStorage only for form data
6. No dark mode
7. No PDF storage (generated on-demand)
8. Monthly limit bypass (multiple emails)
9. No admin notifications for new submissions
10. No customer testimonials
11. No blog/content marketing

## Performance

- Monitor bundle size: `npm run build`
- Use Next.js `<Image>` component
- Automatic code splitting (App Router)
- Leverage Next.js caching
- API response times: Payment intent creation <500ms

## Important Notes for AI Assistants

1. **Business Rules**: 7-day absence limit and 7-day lookback are non-negotiable. Always verify before modifying.

2. **Test Coverage**: Always write tests for new features. Maintain 80%+ coverage.

3. **Type Safety**: Maintain strict TypeScript. No `any` types.

4. **Form Flow**: Guardian step is conditional. Be careful with progress tracking.

5. **Stripe Pricing**: Managed via Stripe Dashboard (Price ID). No code deploys needed.

6. **Mobile First**: All UI must be mobile-responsive.

7. **Validation**: Centralized in `validation-schemas.ts` and `date-validators.ts`. Changes affect entire app.

8. **localStorage**: Form data persists in localStorage. Consider privacy implications.

9. **Database Safety**: NEVER use production DATABASE_URL in tests. Always use `file:./test.db`.

10. **Admin Auth**: Protected by Better Auth. Passwords hashed with bcrypt (10 rounds).

11. **Submission Flow**: TemporarySubmission (placeholder) → PaymentIntent (metadata reference) → Webhook (2-tier fallback) → Permanent Submission → Email notifications.

12. **Approval Process**: Generates PDF (BLOCKING) → Sends email (NON-BLOCKING). PDF generation must succeed for approval.

13. **Email System**: React Email 5.0 with Tailwind. Three types: payment confirmation, approval (with PDF), denial (with refund).

14. **Email Logic**: Use `getRecipientName()` and `getAbsenceFromText()` helpers. `notePurpose` determines text, not `absenceReason`.

15. **PDF Generation**: On-demand using @react-pdf/renderer. State-specific licenses from `state-licenses.ts`.

16. **PDF Fonts**: Plus Jakarta Sans from npm package with validation and fallback handling.

17. **Analytics**: Vercel Analytics integrated in `layout.tsx`.

18. **Webhooks (Local)**: Use Stripe CLI: `stripe listen --forward-to localhost:3000/api/webhooks/stripe-prod`

19. **Webhook Filtering**: Only processes `payment_intent.succeeded`. Rejects events >10 minutes old. Returns 200 for all other events.

20. **State Licenses**: 44 states supported in `state-licenses.ts`. Graceful degradation if state not mapped.

21. **Monthly Limits**: Soft limit (warning only). Tracked by email. Can be bypassed (known limitation).

22. **Google Ads Tracking**: Global tag in `layout.tsx` tracks all page visits. Conversion event fires on `/payment/success` after successful payment verification with transaction ID.

23. **Admin Portal - Other Fields**: When users select "other" for note purpose or absence reason, the admin portal displays both "other" and their custom text (e.g., "other - custom reason").

24. **Admin Search**: `/admin/search` allows searching ALL submissions by name, email, or ID. Supports editing any field and changing status. Re-approval triggers new PDF generation and email.

25. **Status Transitions**: Use `changeSubmissionStatus()` for non-approval transitions. Use `approveSubmission()` or `reApproveSubmission()` for approvals. Denial after approval checks `stripeRefundId` to avoid double refunds.

## Useful Commands

```bash
# Development
npm run dev                 # Start dev server
npm test                   # Run tests
npm run test:ui            # Tests with UI
npm run test:coverage      # Coverage report
npm run email              # Preview emails
npm run build              # Build for production

# Database
npx prisma studio          # Database browser
npx prisma generate        # Regenerate client
npx prisma db push         # Push schema (dev)
npx prisma migrate dev     # Create migration

# Code Quality
npm run lint               # Check linting
npm run format             # Format code
npm run format:check       # Check formatting
npx tsc --noEmit          # Check TypeScript
```

## Getting Help

- **Documentation**: See README.md
- **Issues**: GitHub Issues
- **Code Review**: Tag `@claude` in PRs
- **Stripe Docs**: https://stripe.com/docs/api

---

**Last Updated**: 2025-12-04
