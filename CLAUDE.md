# Claude Code Guide

This document provides context and guidelines for Claude Code when working with this repository.

## Project Overview

**Online Doctor's Note** is a Next.js 15 application that provides a multi-step form for users to obtain legitimate doctor's notes for work or school absences. The application handles patient information collection, validation, and payment processing through Stripe.

## Architecture

### Tech Stack

- **Framework**: Next.js 15.5.5 with App Router
- **Language**: TypeScript 5 (strict mode)
- **UI**: React 19, Tailwind CSS 4, Radix UI, shadcn/ui
- **Forms**: react-hook-form + Zod validation
- **Payments**: Stripe (v2025-09-30.clover API)
- **Testing**: Vitest + Testing Library (223 tests)
- **Build**: Turbopack

### Key Directories

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API routes (Stripe integration)
│   ├── [form-pages]/      # 13 form step pages
│   └── layout.tsx         # Root layout with fonts
├── components/
│   ├── form/              # Reusable form components
│   └── ui/                # shadcn/ui components
├── lib/                   # Business logic & utilities
│   ├── validation-schemas.ts    # 10 Zod schemas
│   ├── date-validators.ts       # Date business rules
│   ├── form-storage.ts          # localStorage helpers
│   └── form-constants.ts        # Static data
└── __tests__/             # Test files (co-located)
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

### Current Coverage (223 tests)

- ✅ Unit tests: All validators and utilities (101 tests)
- ✅ Schema tests: All 10 Zod schemas (89 tests)
- ✅ API tests: Both Stripe endpoints (33 tests)
- ⚠️ Component tests: Not yet implemented
- ⚠️ Integration tests: Not yet implemented

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

### Debugging Stripe Issues

- Check `.env.local` for correct API keys
- Verify Stripe API version: `2025-09-30.clover`
- Test with Stripe test cards: `4242 4242 4242 4242`
- Check Stripe Dashboard for payment logs
- Review API route logs in development mode

## Environment Variables

Required variables:

```env
STRIPE_SECRET_KEY=sk_test_...           # Stripe secret key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=...  # Stripe publishable key
NEXT_PUBLIC_PAYMENT_AMOUNT=2999         # Amount in cents
NODE_ENV=development                     # Environment
```

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

1. **test.yml**: Runs all 223 tests on push/PR
2. **claude-code-review.yml**: Automated code reviews on PRs
3. **claude.yml**: Claude PR assistant (trigger with `@claude`)

### Pre-commit Checklist

- [ ] All tests pass (`npm test`)
- [ ] No TypeScript errors (`npm run build`)
- [ ] No ESLint errors (`npm run lint`)
- [ ] New features have tests
- [ ] Documentation updated if needed

## Known Issues & Technical Debt

1. **No component tests**: Need to add React component tests
2. **No E2E tests**: Consider adding Playwright tests
3. **localStorage only**: No server-side session management
4. **No rate limiting**: Payment endpoints could be abused
5. **No duplicate detection**: Users could submit multiple times
6. **Hardcoded payment amount**: Should be configurable
7. **No email confirmation**: Payment succeeds but no receipt sent

## Performance Considerations

- **Bundle size**: Monitor with `npm run build`
- **Image optimization**: Use Next.js `<Image>` component
- **Code splitting**: Automatic with App Router
- **Caching**: Leverage Next.js caching strategies
- **API response times**: Payment intent creation should be <500ms

## Security Considerations

- **Stripe keys**: Never commit real keys to git
- **Input validation**: All user input is validated with Zod
- **XSS prevention**: React escapes by default
- **CSRF**: Next.js handles CSRF tokens
- **Rate limiting**: Not implemented (should be added)
- **PII handling**: Minimize storage of sensitive data

## Useful Commands

```bash
# Development
npm run dev                 # Start dev server
npm test                   # Run tests
npm run test:ui            # Run tests with UI
npm run test:coverage      # Run tests with coverage
npm run build              # Build for production

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

1. **Business Rules**: The 7-day absence limit and 5-day lookback are non-negotiable. Always verify with the user before modifying.

2. **Test Coverage**: When adding new features, always write tests. The project maintains 80%+ coverage.

3. **Type Safety**: Maintain strict TypeScript. No `any` types unless absolutely necessary.

4. **Form Flow**: The conditional guardian step affects progress tracking. Be careful when modifying form navigation.

5. **Stripe Integration**: Payment amount is fixed. Any changes require updating multiple files and environment variables.

6. **Mobile First**: All UI changes should be mobile-responsive.

7. **Validation is Critical**: All form validation is centralized in `validation-schemas.ts` and `date-validators.ts`. Changes here affect the entire application.

8. **localStorage**: Form data persists in localStorage. Consider privacy implications when adding new fields.
