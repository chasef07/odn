# Testing Guide

Comprehensive testing documentation for the Online Doctor's Note application.

## Overview

This project uses **Vitest** with **React Testing Library** for a comprehensive test suite covering unit tests, integration tests, and API route tests. We maintain 80%+ test coverage across critical business logic.

## Test Statistics

- **Total Tests**: 223
- **Test Files**: 6
- **Coverage**: 80%+ (lib utilities), 95%+ (API routes)
- **Framework**: Vitest 4.0.5
- **React Testing**: Testing Library 16.3.0

### Test Breakdown

| Category | Tests | Files | Coverage |
|----------|-------|-------|----------|
| Date Validators | 25 | 1 | 100% |
| Phone Utilities | 37 | 1 | 100% |
| Age Validators | 39 | 1 | 100% |
| Validation Schemas | 89 | 1 | 95%+ |
| Payment APIs | 33 | 2 | 95%+ |

## Running Tests

### Basic Commands

```bash
# Run all tests once
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- date-validators.test.ts

# Run tests matching pattern
npm test -- --grep "should validate"
```

### Test Output

```bash
✓ src/lib/__tests__/phone-utils.test.ts (37 tests) 4ms
✓ src/lib/__tests__/validation-schemas.test.ts (89 tests) 12ms
✓ src/app/api/create-payment-intent/__tests__/route.test.ts (14 tests) 9ms
✓ src/app/api/verify-payment/__tests__/route.test.ts (19 tests) 10ms
✓ src/lib/__tests__/date-validators.test.ts (25 tests) 5ms
✓ src/lib/__tests__/age-validators.test.ts (39 tests) 8ms

Test Files  6 passed (6)
     Tests  223 passed (223)
  Duration  1.86s
```

## Test Structure

### File Organization

Tests are co-located with the code they test:

```
src/
├── lib/
│   ├── date-validators.ts
│   └── __tests__/
│       └── date-validators.test.ts
├── app/
│   └── api/
│       └── create-payment-intent/
│           ├── route.ts
│           └── __tests__/
│               └── route.test.ts
```

### Naming Conventions

- **Test files**: `*.test.ts` or `*.test.tsx`
- **Test suites**: Descriptive `describe()` blocks
- **Test cases**: Start with "should" (e.g., "should validate date range")

## Writing Tests

### 1. Unit Tests (Pure Functions)

**Example: Testing a utility function**

```typescript
// src/lib/__tests__/phone-utils.test.ts
import { describe, it, expect } from 'vitest'
import { formatPhoneNumber } from '../phone-utils'

describe('formatPhoneNumber', () => {
  it('should format 10-digit phone number', () => {
    expect(formatPhoneNumber('5551234567')).toBe('(555) 123-4567')
  })

  it('should remove non-numeric characters', () => {
    expect(formatPhoneNumber('555-123-4567')).toBe('(555) 123-4567')
  })

  it('should handle empty input', () => {
    expect(formatPhoneNumber('')).toBe('')
  })
})
```

**Key Principles**:
- Test one behavior per test case
- Use descriptive test names
- Cover edge cases and boundaries
- Test both success and failure paths

### 2. Schema Tests (Zod Validation)

**Example: Testing Zod schemas**

```typescript
// src/lib/__tests__/validation-schemas.test.ts
import { describe, it, expect } from 'vitest'
import { page3Schema } from '../validation-schemas'

describe('page3Schema - Contact Information', () => {
  const validData = {
    email: 'test@example.com',
    phone: '5551234567',
  }

  it('should accept valid contact data', () => {
    const result = page3Schema.safeParse(validData)
    expect(result.success).toBe(true)
  })

  it('should reject invalid email', () => {
    const result = page3Schema.safeParse({ ...validData, email: 'invalid' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('valid email')
    }
  })

  it('should convert email to lowercase', () => {
    const result = page3Schema.safeParse({ ...validData, email: 'TEST@EXAMPLE.COM' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.email).toBe('test@example.com')
    }
  })
})
```

**Key Principles**:
- Test both valid and invalid inputs
- Check error messages
- Test transformations (lowercase, trim, etc.)
- Test conditional validation logic

### 3. API Route Tests (with Mocking)

**Example: Testing Stripe API routes**

```typescript
// src/app/api/create-payment-intent/__tests__/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock Stripe using vi.hoisted
const { mockCreate } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
}))

vi.mock('stripe', () => ({
  default: class MockStripe {
    paymentIntents = { create: mockCreate }
  }
}))

import { POST } from '../route'

describe('POST /api/create-payment-intent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.STRIPE_SECRET_KEY = 'sk_test_mock'
  })

  it('should create payment intent successfully', async () => {
    mockCreate.mockResolvedValue({
      client_secret: 'pi_mock_secret',
      amount: 2999,
    })

    const request = new NextRequest('http://localhost/api/create-payment-intent', {
      method: 'POST',
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.clientSecret).toBe('pi_mock_secret')
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 2999, currency: 'usd' })
    )
  })
})
```

**Key Principles**:
- Use `vi.hoisted()` for module-level mocks
- Mock external dependencies (Stripe, databases, etc.)
- Test both success and error responses
- Verify mock function calls
- Test environment variable handling

### 4. Component Tests (React Testing Library)

**Example structure** (not yet implemented):

```typescript
// src/components/__tests__/FormNavigation.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FormNavigation } from '../FormNavigation'

describe('FormNavigation', () => {
  it('should render back and submit buttons', () => {
    render(
      <FormNavigation
        backRoute="/previous"
        isSubmitting={false}
      />
    )

    expect(screen.getByText('Back')).toBeInTheDocument()
    expect(screen.getByText('Continue')).toBeInTheDocument()
  })

  it('should call onBack when back button clicked', () => {
    const mockOnBack = vi.fn()
    render(
      <FormNavigation
        backRoute="/previous"
        onBack={mockOnBack}
        isSubmitting={false}
      />
    )

    fireEvent.click(screen.getByText('Back'))
    expect(mockOnBack).toHaveBeenCalled()
  })
})
```

## Test Configuration

### vitest.config.ts

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

### vitest.setup.ts

```typescript
import '@testing-library/jest-dom'
import { afterEach, beforeEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

// Clean up after each test
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}

beforeEach(() => {
  vi.stubGlobal('localStorage', localStorageMock)
})
```

## Testing Patterns

### Pattern 1: Testing Date Boundaries

```typescript
it('should accept exactly 7-day absence', () => {
  const data = {
    firstDayOff: '2025-01-15',
    lastDayOff: '2025-01-22', // Exactly 7 days later
    needReturnDate: false,
  }

  const errors = validateAbsenceDates(data)
  expect(errors).toEqual([])
})

it('should reject 8-day absence', () => {
  const data = {
    firstDayOff: '2025-01-15',
    lastDayOff: '2025-01-23', // 8 days later
    needReturnDate: false,
  }

  const errors = validateAbsenceDates(data)
  expect(errors).toHaveLength(1)
  expect(errors[0].message).toContain('7 days')
})
```

### Pattern 2: Testing Conditional Logic

```typescript
it('should require "other" text when purpose is other', () => {
  const result = page5Schema.safeParse({
    notePurpose: 'other',
    // Missing otherNotePurpose
  })

  expect(result.success).toBe(false)
  if (!result.success) {
    expect(result.error.issues.some(i => i.message.includes('specify'))).toBe(true)
  }
})

it('should not require "other" text when purpose is work', () => {
  const result = page5Schema.safeParse({
    notePurpose: 'work',
    // otherNotePurpose not needed
  })

  expect(result.success).toBe(true)
})
```

### Pattern 3: Testing Transformations

```typescript
it('should trim whitespace from names', () => {
  const result = page2Schema.safeParse({
    patientFirstName: '  John  ',
    patientLastName: '  Doe  ',
    patientDateOfBirth: '1990-01-01',
  })

  expect(result.success).toBe(true)
  if (result.success) {
    expect(result.data.patientFirstName).toBe('John')
    expect(result.data.patientLastName).toBe('Doe')
  }
})
```

### Pattern 4: Testing Error Handling

```typescript
it('should handle Stripe API errors', async () => {
  mockCreate.mockRejectedValue(new Error('Stripe API error'))

  const request = new NextRequest('http://localhost/api/create-payment-intent', {
    method: 'POST',
  })

  const response = await POST(request)
  const data = await response.json()

  expect(response.status).toBe(500)
  expect(data.error).toBe('Failed to create payment intent')
})
```

## Common Testing Scenarios

### Testing Date Validation

**Key scenarios to cover**:
- Valid date ranges
- Boundary conditions (exactly 7 days, exactly 5 days past)
- Invalid ranges (>7 days, >5 days past)
- Return date validation
- Leap years and month boundaries
- Same-day absence (first day = last day)

### Testing Phone Formatting

**Key scenarios to cover**:
- Empty input
- Partial input (1-9 digits)
- Complete input (10 digits)
- Formatted input (already has formatting)
- Input with non-numeric characters
- Input exceeding 10 digits

### Testing Stripe Integration

**Key scenarios to cover**:
- Successful payment intent creation
- Failed payment intent creation
- Missing API keys
- Network errors
- Invalid payment intent IDs
- Different payment statuses (succeeded, processing, failed)

### Testing Zod Schemas

**Key scenarios to cover**:
- Valid data
- Missing required fields
- Invalid data types
- Out-of-range values
- Conditional validation (e.g., "other" text required)
- Transformations (trim, lowercase)
- Edge cases (empty strings, special characters)

## CI/CD Integration

### GitHub Actions Workflow

Tests run automatically on:
- Every push to `main`, `develop`, or `feature/*` branches
- Every pull request to `main` or `develop`

**Workflow file**: `.github/workflows/test.yml`

```yaml
name: Tests

on:
  push:
    branches: [main, develop, 'feature/**']
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm test -- --run
```

### Pull Request Requirements

Before merging a PR:
- ✅ All tests must pass
- ✅ No TypeScript errors
- ✅ No ESLint errors
- ✅ Code coverage maintained at 80%+

## Debugging Tests

### Common Issues

**1. Mock not working**
```typescript
// ❌ Wrong - mock defined after import
import { POST } from '../route'
const mock = vi.fn()

// ✅ Correct - use vi.hoisted
const { mock } = vi.hoisted(() => ({ mock: vi.fn() }))
vi.mock('module', () => ({ ... }))
import { POST } from '../route'
```

**2. localStorage not mocked**
```typescript
// Already mocked in vitest.setup.ts
// Just clear between tests
beforeEach(() => {
  localStorageMock.getItem.mockClear()
})
```

**3. Async test timeout**
```typescript
// Increase timeout for slow tests
it('should handle slow operation', async () => {
  // test code
}, 10000) // 10 second timeout
```

### Debugging Tips

```bash
# Run single test file
npm test -- date-validators.test.ts

# Run tests matching name
npm test -- --grep "should validate"

# Run with verbose output
npm test -- --reporter=verbose

# Run with UI (interactive debugging)
npm run test:ui

# See coverage for specific file
npm run test:coverage
# Open coverage/index.html in browser
```

## Best Practices

### ✅ Do

- Write tests before fixing bugs (test-driven debugging)
- Test edge cases and boundaries
- Use descriptive test names
- Keep tests focused (one assertion per test when possible)
- Mock external dependencies
- Clean up after tests (use `afterEach`)
- Maintain 80%+ coverage for new code

### ❌ Don't

- Don't test implementation details
- Don't write tests that depend on other tests
- Don't use real API keys or credentials
- Don't skip flaky tests - fix them
- Don't test third-party library internals
- Don't duplicate test logic

## Future Improvements

### Planned Additions

1. **Component Tests**: Add React component tests with Testing Library
2. **E2E Tests**: Add Playwright tests for full user flows
3. **Visual Regression**: Add visual regression testing
4. **Performance Tests**: Add bundle size and performance benchmarks
5. **Accessibility Tests**: Add automated a11y tests

### Coverage Goals

- [ ] Component tests: 80%+ coverage
- [ ] Integration tests: Full form flow coverage
- [ ] E2E tests: Critical user paths
- [ ] Visual tests: All pages
- [ ] API tests: 100% coverage (currently 95%+)

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library React](https://testing-library.com/react)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [Mocking with Vitest](https://vitest.dev/guide/mocking.html)

## Getting Help

If you encounter issues with tests:
1. Check this documentation
2. Review existing test files for examples
3. Check Vitest documentation
4. Open an issue on GitHub
5. Tag `@claude` in PR comments for assistance
