# Component Testing Explained

## What Are Component Tests?

Component tests verify that your React UI components behave correctly. Unlike unit tests (which test pure functions) or integration tests (which test API routes + database), component tests focus on **user interactions with the UI**.

---

## Example: What We'd Test in Your App

### 1. Basic Info Page Component

**File**: `src/app/basic-info/page.tsx`

**What to Test**:
```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import BasicInfoPage from './page'

describe('BasicInfoPage', () => {
  it('should display form fields', () => {
    render(<BasicInfoPage />)

    // Check form fields are visible
    expect(screen.getByLabelText('First Name')).toBeInTheDocument()
    expect(screen.getByLabelText('Last Name')).toBeInTheDocument()
    expect(screen.getByLabelText('Date of Birth')).toBeInTheDocument()
  })

  it('should show validation error for invalid email', async () => {
    render(<BasicInfoPage />)

    // User types invalid email
    const emailInput = screen.getByLabelText('Email')
    fireEvent.change(emailInput, { target: { value: 'notanemail' } })

    // Click submit
    const submitButton = screen.getByText('Continue')
    fireEvent.click(submitButton)

    // Check error message appears
    expect(await screen.findByText('Please enter a valid email')).toBeInTheDocument()
  })

  it('should enable submit button when form is valid', () => {
    render(<BasicInfoPage />)

    // Fill out all required fields
    fireEvent.change(screen.getByLabelText('First Name'), { target: { value: 'John' } })
    fireEvent.change(screen.getByLabelText('Last Name'), { target: { value: 'Doe' } })
    fireEvent.change(screen.getByLabelText('Date of Birth'), { target: { value: '1990-01-01' } })

    // Check submit button is enabled
    const submitButton = screen.getByText('Continue')
    expect(submitButton).not.toBeDisabled()
  })

  it('should navigate to next page on valid submission', async () => {
    const mockRouter = { push: vi.fn() }
    render(<BasicInfoPage />, { router: mockRouter })

    // Fill out form and submit
    // ... (fill fields)
    fireEvent.click(screen.getByText('Continue'))

    // Check navigation happened
    await waitFor(() => {
      expect(mockRouter.push).toHaveBeenCalledWith('/contact-info')
    })
  })
})
```

**What This Tests**:
- ✅ Form fields render correctly
- ✅ Validation errors appear
- ✅ Submit button enables/disables properly
- ✅ Navigation works on successful submission

---

### 2. Absence Dates Component

**File**: `src/app/absence-dates/page.tsx`

**What to Test**:
```typescript
describe('AbsenceDatesPage', () => {
  it('should enforce maximum 7-day absence period', () => {
    render(<AbsenceDatesPage />)

    // Select first day off
    const firstDayInput = screen.getByLabelText('First Day Off')
    fireEvent.change(firstDayInput, { target: { value: '2025-11-01' } })

    // Try to select last day off 8 days later
    const lastDayInput = screen.getByLabelText('Last Day Off')
    fireEvent.change(lastDayInput, { target: { value: '2025-11-09' } })

    // Check error message
    expect(screen.getByText(/maximum 7 consecutive days/i)).toBeInTheDocument()
  })

  it('should enforce 7-day lookback limit', () => {
    render(<AbsenceDatesPage />)

    // Try to select a date >7 days in the past
    const pastDate = new Date()
    pastDate.setDate(pastDate.getDate() - 8)

    const firstDayInput = screen.getByLabelText('First Day Off')
    fireEvent.change(firstDayInput, {
      target: { value: pastDate.toISOString().split('T')[0] }
    })

    // Check error message
    expect(screen.getByText(/cannot be more than 7 days in the past/i)).toBeInTheDocument()
  })

  it('should show calendar picker when date field clicked', () => {
    render(<AbsenceDatesPage />)

    const dateInput = screen.getByLabelText('First Day Off')
    fireEvent.click(dateInput)

    // Check calendar appears
    expect(screen.getByRole('dialog')).toBeInTheDocument() // Calendar popup
  })
})
```

**What This Tests**:
- ✅ Business rules enforced (7-day max, 7-day lookback)
- ✅ Error messages display correctly
- ✅ Date picker UI works

---

### 3. Payment Page Component

**File**: `src/app/payment/page.tsx`

**What to Test**:
```typescript
describe('PaymentPage', () => {
  it('should display payment amount', () => {
    render(<PaymentPage />)

    expect(screen.getByText('$24.95')).toBeInTheDocument()
  })

  it('should show loading state during payment processing', async () => {
    render(<PaymentPage />)

    // Mock Stripe Elements
    const cardElement = screen.getByTestId('stripe-card-element')

    // Click pay button
    fireEvent.click(screen.getByText('Pay Now'))

    // Check loading indicator appears
    expect(screen.getByText('Processing payment...')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pay Now' })).toBeDisabled()
  })

  it('should show error message on payment failure', async () => {
    // Mock Stripe to return error
    mockStripe.confirmCardPayment.mockResolvedValue({
      error: { message: 'Card declined' }
    })

    render(<PaymentPage />)

    fireEvent.click(screen.getByText('Pay Now'))

    // Check error message displays
    expect(await screen.findByText('Card declined')).toBeInTheDocument()
  })

  it('should redirect to success page on payment success', async () => {
    // Mock successful payment
    mockStripe.confirmCardPayment.mockResolvedValue({
      paymentIntent: { status: 'succeeded' }
    })

    const mockRouter = { push: vi.fn() }
    render(<PaymentPage />, { router: mockRouter })

    fireEvent.click(screen.getByText('Pay Now'))

    await waitFor(() => {
      expect(mockRouter.push).toHaveBeenCalledWith('/approved')
    })
  })
})
```

**What This Tests**:
- ✅ Payment amount displays
- ✅ Loading states work
- ✅ Error handling works
- ✅ Success navigation works

---

### 4. Review Page Component

**File**: `src/app/review/page.tsx`

**What to Test**:
```typescript
describe('ReviewPage', () => {
  it('should display all submitted information', () => {
    // Mock form data in localStorage
    const mockFormData = {
      patientFirstName: 'John',
      patientLastName: 'Doe',
      email: 'john@example.com',
      firstDayOff: '2025-11-01',
      lastDayOff: '2025-11-02',
    }

    render(<ReviewPage />)

    // Check all fields display
    expect(screen.getByText('John Doe')).toBeInTheDocument()
    expect(screen.getByText('john@example.com')).toBeInTheDocument()
    expect(screen.getByText('Nov 1, 2025 - Nov 2, 2025')).toBeInTheDocument()
  })

  it('should allow editing each section', () => {
    render(<ReviewPage />)

    // Click edit button for patient info
    const editButton = screen.getByRole('button', { name: /edit.*patient/i })
    fireEvent.click(editButton)

    // Check navigation to edit page
    expect(mockRouter.push).toHaveBeenCalledWith('/basic-info?edit=true')
  })

  it('should show validation errors before payment', () => {
    // Mock incomplete form data
    localStorage.setItem('doctor-note-form-draft', JSON.stringify({
      patientFirstName: 'John',
      // Missing required fields
    }))

    render(<ReviewPage />)

    fireEvent.click(screen.getByText('Continue to Payment'))

    // Check error message
    expect(screen.getByText(/please complete all required fields/i)).toBeInTheDocument()
  })
})
```

**What This Tests**:
- ✅ Form data displays correctly
- ✅ Edit buttons work
- ✅ Validation before payment works

---

## Why Component Tests Matter

### 1. Catch UI Bugs Before Production

**Without Component Tests**:
```
Developer: "I changed the validation logic"
           "Tests pass, should be fine"
           *deploys*
User: "The error message doesn't show up!"
```

**With Component Tests**:
```
Developer: "I changed the validation logic"
           *runs tests*
Test: ❌ FAIL - Error message not displayed
Developer: "Oh, I broke the UI. Let me fix it"
           *fixes and verifies*
Test: ✅ PASS
```

### 2. Prevent Regressions

**Scenario**: You update a form component

**Without Tests**:
- Manually test the one thing you changed
- Miss that you broke something else
- Users discover the bug

**With Tests**:
- All component tests run automatically
- Immediately see if anything broke
- Fix before deployment

### 3. Documentation

Component tests serve as **living documentation** of how components should behave:

```typescript
// This test documents expected behavior:
it('should disable submit button when form is invalid', () => {
  // Shows: Submit button should be disabled for invalid forms
})

it('should show error for email field when invalid', () => {
  // Shows: Email validation should display errors
})
```

---

## Current State vs. With Component Tests

### Current State (What You Have)

```
✅ Unit Tests (180 tests)
   - formatPhone() works
   - Date validators work
   - Zod schemas work

✅ Integration Tests (70 tests)
   - Webhook processes payment
   - Database stores data
   - Cron job cleans up

❌ Component Tests (0 tests)
   - No UI testing
   - No user interaction testing
```

**Gap**: If a form stops working (button doesn't submit, error messages don't show, validation fails), you won't know until users report it.

### With Component Tests

```
✅ Unit Tests (180 tests)
✅ Integration Tests (70 tests)
✅ Component Tests (30-50 tests) ← NEW
   - Forms render correctly
   - Buttons work
   - Validation messages appear
   - Navigation works
   - Loading states display
   - Error handling works
```

**Benefit**: Full confidence that the UI works as expected.

---

## How Long Does It Take?

**2-3 hours** to add component tests for key components:

### Hour 1: Setup
- Install Testing Library dependencies (if needed)
- Set up test utilities
- Create first component test

### Hour 2: Key Components
- Test 3-5 critical components:
  - Payment page (most important)
  - Review page
  - Absence dates page
  - Basic info page

### Hour 3: Edge Cases
- Test error scenarios
- Test loading states
- Test conditional rendering

---

## Example: Testing Your Payment Component

Let me show you a real example for your app:

```typescript
// src/app/payment/__tests__/page.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import PaymentPage from '../page'

// Mock Stripe
vi.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }) => children,
  useStripe: () => ({
    confirmCardPayment: vi.fn().mockResolvedValue({
      paymentIntent: { status: 'succeeded' }
    })
  }),
  useElements: () => ({
    getElement: vi.fn()
  }),
  CardElement: () => <div data-testid="stripe-card-element" />
}))

describe('PaymentPage', () => {
  beforeEach(() => {
    // Mock form data in localStorage
    localStorage.setItem('doctor-note-form-draft', JSON.stringify({
      patientFirstName: 'John',
      patientLastName: 'Doe',
      email: 'john@example.com',
      // ... other fields
    }))
  })

  it('should display payment amount correctly', () => {
    render(<PaymentPage />)

    expect(screen.getByText('$24.95')).toBeInTheDocument()
  })

  it('should disable pay button while processing', async () => {
    render(<PaymentPage />)

    const payButton = screen.getByRole('button', { name: /pay now/i })
    fireEvent.click(payButton)

    expect(payButton).toBeDisabled()
    expect(screen.getByText(/processing/i)).toBeInTheDocument()
  })

  it('should redirect to success page after payment', async () => {
    const mockPush = vi.fn()
    vi.mock('next/navigation', () => ({
      useRouter: () => ({ push: mockPush })
    }))

    render(<PaymentPage />)

    fireEvent.click(screen.getByRole('button', { name: /pay now/i }))

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/approved')
    })
  })

  it('should display error message on payment failure', async () => {
    // Mock payment failure
    const mockStripe = {
      confirmCardPayment: vi.fn().mockResolvedValue({
        error: { message: 'Your card was declined' }
      })
    }

    render(<PaymentPage />)

    fireEvent.click(screen.getByRole('button', { name: /pay now/i }))

    expect(await screen.findByText(/card was declined/i)).toBeInTheDocument()
  })
})
```

**What This Tests**:
1. ✅ Amount displays correctly ($24.95)
2. ✅ Button disables during processing
3. ✅ Success redirects to /approved
4. ✅ Errors display to user

**Time to Write**: ~30 minutes

---

## Should You Add Component Tests Now?

### ✅ Add Now If:
- You want maximum confidence before production
- You plan to iterate on the UI frequently
- You have time (2-3 hours)

### ⏭️ Can Wait If:
- You need to launch quickly
- You'll manually test the UI thoroughly
- You can add them post-launch

**My Recommendation**: The **integration tests we just built are more critical** than component tests. The payment webhook → database flow is tested, which is the most important part. Component tests are nice-to-have but not required for production.

---

## Summary

**Component Tests** = Testing React components (forms, buttons, validation messages, loading states)

**Why They Matter**:
- Catch UI bugs before users do
- Prevent regressions when you change code
- Document expected behavior

**Time Investment**: 2-3 hours for key components

**Priority**: Medium (nice to have, but integration tests are more critical)

---

**Your Current State**: You have the most important tests (webhook + database). Component tests would add extra confidence in the UI, but aren't blocking production launch.
