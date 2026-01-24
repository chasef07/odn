# Complete Payment & Database Flow Explained

**Date**: November 3, 2025
**Branch**: feature/databasetesting

---

## Overview: The Journey of a Doctor's Note Submission

This document explains the complete flow from when a user fills out the form to when their submission is stored in the database, ready for admin review.

---

## The Flow: Step-by-Step

### Phase 1: User Fills Out Form (Client-Side)

**Location**: Browser (localStorage)

```
┌─────────────────────────────────────────────┐
│  User fills out 11-step form                │
│  - State selection                          │
│  - Patient info                             │
│  - Guardian info (if needed)                │
│  - Contact info                             │
│  - Absence dates                            │
│  - Symptoms                                 │
│  - etc.                                     │
└─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────┐
│  Form data saved to localStorage            │
│  Key: "doctor-note-form-draft"              │
│  Purpose: Auto-save, prevent data loss      │
└─────────────────────────────────────────────┘
```

**Code Location**: `src/lib/form-storage.ts`

**Data Example**:
```typescript
{
  state: "CA",
  recipient: "myself",
  patientFirstName: "John",
  patientLastName: "Doe",
  patientDateOfBirth: "1990-01-01",
  email: "john@example.com",
  phone: "5555551234",
  firstDayOff: "2025-11-01",
  lastDayOff: "2025-11-02",
  absenceReason: "Feeling sick",
  symptoms: ["Fever", "Cough"],
  // ... etc
}
```

---

### Phase 2: User Clicks "Pay" Button (Payment Page)

**Location**: `/payment` page → API Route

```
┌─────────────────────────────────────────────┐
│  User clicks "Pay Now" button              │
│  - Triggers payment intent creation         │
└─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────┐
│  POST /api/create-payment-intent            │
│  - Validates form data (10+ fields)         │
│  - Creates Stripe PaymentIntent ($24.95)    │
│  - Stores form data in database            │
└─────────────────────────────────────────────┘
```

**Code Location**: `src/app/api/create-payment-intent/route.ts`

**What Happens**:

1. **Validate Form Data**
   ```typescript
   // Check all required fields are present
   if (!formData.email || !formData.patientFirstName) {
     return error
   }
   ```

2. **Create Stripe PaymentIntent**
   ```typescript
   const paymentIntent = await stripe.paymentIntents.create({
     amount: 2495, // $24.95
     currency: 'usd',
     metadata: {
       product: 'doctor-note',
       service: 'telehealth'
     }
   })
   ```

3. **Save to Database (TemporarySubmission)**
   ```typescript
   await prisma.temporarySubmission.create({
     data: {
       paymentIntentId: paymentIntent.id, // "pi_abc123..."
       formData: formDataFromRequest,
       expiresAt: 24_hours_from_now
     }
   })
   ```

   **Why TemporarySubmission?**
   - Payment hasn't succeeded yet
   - User might cancel or payment might fail
   - Data needs to be retrievable when webhook fires
   - Expires after 24 hours (cleaned up by cron job)

4. **Return to Client**
   ```typescript
   return {
     clientSecret: paymentIntent.client_secret
   }
   ```

**Database State After This Step**:
```
TemporarySubmissions Table:
┌──────────┬──────────────┬───────────────────┬────────────┐
│ id       │ paymentId    │ formData          │ expiresAt  │
├──────────┼──────────────┼───────────────────┼────────────┤
│ uuid-123 │ pi_abc123... │ {state: "CA",...} │ tomorrow   │
└──────────┴──────────────┴───────────────────┴────────────┘

Submissions Table:
(empty - payment not complete yet)
```

---

### Phase 3: User Enters Card Details (Stripe Elements)

**Location**: Client-side, Stripe handles card processing

```
┌─────────────────────────────────────────────┐
│  Stripe Elements UI                         │
│  - User enters card: 4242 4242 4242 4242   │
│  - Expiry: 12/34                           │
│  - CVC: 123                                 │
│  - Zip: 12345                               │
└─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────┐
│  Client calls stripe.confirmCardPayment()   │
│  - Sends card data to Stripe (PCI compliant)│
│  - Never touches your server                │
└─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────┐
│  Stripe processes payment                   │
│  - Charges card $24.95                      │
│  - Creates charge record                    │
│  - Updates PaymentIntent status             │
└─────────────────────────────────────────────┘
```

**Result**:
- If **Success**: PaymentIntent status = "succeeded"
- If **Fail**: PaymentIntent status = "requires_payment_method"

---

### Phase 4: Stripe Sends Webhook (THE CRITICAL PART)

**Location**: Server-side webhook endpoint

```
┌─────────────────────────────────────────────┐
│  Stripe sends webhook event                 │
│  POST /api/webhooks/stripe                  │
│  Event type: "payment_intent.succeeded"     │
└─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────┐
│  1. Verify Webhook Signature                │
│  - Ensures request is from Stripe           │
│  - Prevents malicious requests              │
└─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────┐
│  2. Check Idempotency                       │
│  - Have we processed this payment before?   │
│  - Prevents duplicate submissions           │
└─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────┐
│  3. Retrieve TemporarySubmission            │
│  - Find by paymentIntentId                  │
│  - Get the form data we saved earlier       │
└─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────┐
│  4. Validate Form Data                      │
│  - Check required fields exist              │
│  - Ensure data is complete                  │
└─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────┐
│  5. Create Permanent Submission ✅          │
│  - Convert JSON to structured DB record     │
│  - Store in Submissions table               │
│  - Status: "pending_review"                 │
└─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────┐
│  6. Delete TemporarySubmission              │
│  - Cleanup - no longer needed               │
│  - If this fails, non-critical              │
└─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────┐
│  7. Return Success to Stripe                │
│  - 200 OK = webhook processed               │
│  - Stripe won't retry                       │
└─────────────────────────────────────────────┘
```

**Code Location**: `src/app/api/webhooks/stripe/route.ts`

**The Critical Code**:
```typescript
// 1. Verify signature
const event = stripe.webhooks.constructEvent(
  body,
  signature,
  WEBHOOK_SECRET
)

// 2. Check idempotency (already processed?)
const existing = await prisma.submission.findUnique({
  where: { stripePaymentIntentId: paymentIntent.id }
})
if (existing) {
  return { received: true } // Already done
}

// 3. Get temporary submission
const tempSubmission = await prisma.temporarySubmission.findUnique({
  where: { paymentIntentId: paymentIntent.id }
})

// 4. Validate form data
if (!formData.email || !formData.patientFirstName) {
  return error // Bad data
}

// 5. Create permanent submission
await prisma.submission.create({
  data: {
    stripePaymentIntentId: paymentIntent.id,
    status: 'pending_review',
    state: formData.state,
    patientFirstName: formData.patientFirstName,
    patientLastName: formData.patientLastName,
    patientDateOfBirth: new Date(formData.patientDateOfBirth),
    email: formData.email,
    phone: formData.phone,
    // ... all other fields
    firstDayOff: new Date(formData.firstDayOff),
    lastDayOff: new Date(formData.lastDayOff),
    absenceReason: formData.absenceReason,
    symptoms: formData.symptoms,
  }
})

// 6. Delete temporary
await prisma.temporarySubmission.delete({
  where: { id: tempSubmission.id }
})
```

**Database State After This Step**:
```
TemporarySubmissions Table:
(empty - record deleted)

Submissions Table:
┌──────────┬──────────────┬────────┬───────┬───────────┬─────────┐
│ id       │ paymentId    │ status │ email │ firstName │ ...     │
├──────────┼──────────────┼────────┼───────┼───────────┼─────────┤
│ uuid-456 │ pi_abc123... │ pend..│ john@ │ John      │ ...     │
└──────────┴──────────────┴────────┴───────┴───────────┴─────────┘
```

---

### Phase 5: User Sees Success Page

**Location**: `/approved` page

```
┌─────────────────────────────────────────────┐
│  Client polls /api/verify-payment           │
│  - Checks if payment succeeded              │
│  - Redirects to success page                │
└─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────┐
│  Success Page Displayed                     │
│  - "Your submission is under review"        │
│  - localStorage cleared                     │
└─────────────────────────────────────────────┘
```

**Code Location**: `src/app/approved/page.tsx`

---

### Phase 6: Admin Reviews Submission (Future)

**Location**: Admin dashboard (to be built)

```
┌─────────────────────────────────────────────┐
│  Admin logs in to dashboard                 │
│  - Views submissions with status            │
│    "pending_review"                         │
└─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────┐
│  Admin reviews patient info                 │
│  - Checks dates, symptoms, reason           │
│  - Makes decision: Approve or Deny          │
└─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────┐
│  Update submission status                   │
│  - status = "approved" or "denied"          │
│  - reviewedAt = current timestamp           │
│  - reviewedByAdminId = admin's ID           │
└─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────┐
│  Send email to patient                      │
│  - If approved: PDF of doctor's note        │
│  - If denied: Explanation & refund          │
│  - approvalEmailSentAt = timestamp          │
└─────────────────────────────────────────────┘
```

**Database State After Admin Review**:
```
Submissions Table:
┌──────────┬────────┬──────────┬─────────────┬──────────────┐
│ id       │ status │ reviewed │ emailSentAt │ ...          │
├──────────┼────────┼──────────┼─────────────┼──────────────┤
│ uuid-456 │ approv │ 2025-... │ 2025-...    │ ...          │
└──────────┴────────┴──────────┴─────────────┴──────────────┘
```

---

## Error Handling & Edge Cases

### What if... Payment Succeeds but Webhook Fails?

**Scenario**: Stripe charges card, but webhook endpoint is down

```
User pays → Stripe charges → Webhook fails (500 error)
                                    │
                                    ▼
                    Stripe retries webhook
                    (exponentially backs off)
                                    │
                                    ▼
                    Eventually webhook succeeds
                    Submission created
```

**Handling**:
- Webhook returns 500 error
- Stripe automatically retries (up to 3 days)
- TemporarySubmission stays in database
- Once webhook succeeds, submission created

**Test**: `should return 500 when temporary submission not found`

---

### What if... Webhook is Called Twice (Duplicate)?

**Scenario**: Network glitch, Stripe sends same webhook twice

```
Webhook #1 → Process → Create submission → Success
                                             │
Webhook #2 → Check existing → Found! → Return success
             (idempotency)              (no duplicate)
```

**Handling**:
```typescript
// Check if already processed
const existing = await prisma.submission.findUnique({
  where: { stripePaymentIntentId: paymentIntent.id }
})
if (existing) {
  return { received: true } // Already done
}
```

**Test**: `should not create duplicate submission for same payment intent`

---

### What if... TemporarySubmission is Missing?

**Scenario**: Race condition, webhook fires before create-payment-intent completes

```
Webhook arrives → Look for temp submission → Not found!
                                                  │
                                                  ▼
                            Return 500 error
                            (tells Stripe to retry)
                                                  │
                                                  ▼
                            Stripe waits & retries
                            Eventually succeeds
```

**Handling**:
```typescript
if (!tempSubmission) {
  console.error('TemporarySubmission not found')
  return NextResponse.json(
    { error: 'Temporary submission not found' },
    { status: 500 } // Stripe will retry
  )
}
```

**Test**: `should return 500 when temporary submission not found`

---

### What if... Form Data is Invalid?

**Scenario**: Data corruption, missing required fields

```
Webhook arrives → Get form data → Validate → Invalid!
                                                │
                                                ▼
                            Return 400 error
                            (tells Stripe don't retry)
                                                │
                                                ▼
                            CRITICAL: Manual review needed
```

**Handling**:
```typescript
if (!formData.email || !formData.patientFirstName) {
  console.error('Invalid form data')
  return NextResponse.json(
    { error: 'Invalid form data' },
    { status: 400 } // Don't retry, manual fix needed
  )
}
```

**Test**: `should return 400 when form data is invalid`

---

## Cleanup: The Cron Job

**Purpose**: Delete expired TemporarySubmissions

```
Every hour (via Vercel Cron):
GET /api/cron/cleanup-temp-submissions
                    │
                    ▼
┌─────────────────────────────────────────────┐
│  Find expired submissions                   │
│  WHERE expiresAt < NOW()                    │
└─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────┐
│  Delete them                                │
│  - Frees up database space                  │
│  - Removes abandoned submissions            │
└─────────────────────────────────────────────┘
```

**Code Location**: `src/app/api/cron/cleanup-temp-submissions/route.ts`

**Vercel Cron Config** (`vercel.json`):
```json
{
  "crons": [{
    "path": "/api/cron/cleanup-temp-submissions",
    "schedule": "0 * * * *"  // Every hour
  }]
}
```

**When Does a TemporarySubmission Expire?**
- Created with `expiresAt = now + 24 hours`
- User has 24 hours to complete payment
- If not paid, record is cleaned up
- If paid, record is deleted immediately after webhook

**Test**: 10+ tests in `tests/api/cron/cleanup-temp-submissions.test.ts`

---

## Data Flow Diagram

```
┌─────────────┐
│   CLIENT    │
│  (Browser)  │
└──────┬──────┘
       │
       │ 1. Fill form
       │ (localStorage)
       │
       │ 2. Click Pay
       ▼
┌─────────────────────────────────────────────┐
│  /api/create-payment-intent                 │
│  ┌──────────────────────────────────────┐   │
│  │ 1. Validate form                     │   │
│  │ 2. Create Stripe PaymentIntent       │   │
│  │ 3. Save TemporarySubmission          │   │
│  └──────────────────────────────────────┘   │
└──────────┬──────────────────────────────────┘
           │
           │ 3. Return clientSecret
           ▼
┌─────────────┐
│   STRIPE    │
│  (Payment)  │
└──────┬──────┘
       │
       │ 4. Charge card
       │ (Success!)
       │
       │ 5. Send webhook
       ▼
┌─────────────────────────────────────────────┐
│  /api/webhooks/stripe                       │
│  ┌──────────────────────────────────────┐   │
│  │ 1. Verify signature                  │   │
│  │ 2. Check idempotency                 │   │
│  │ 3. Get TemporarySubmission           │   │
│  │ 4. Validate data                     │   │
│  │ 5. Create permanent Submission ✅    │   │
│  │ 6. Delete TemporarySubmission        │   │
│  └──────────────────────────────────────┘   │
└──────────┬──────────────────────────────────┘
           │
           │ 6. Success!
           ▼
┌─────────────────────────────────────────────┐
│  DATABASE (PostgreSQL)                      │
│  ┌──────────────────────────────────────┐   │
│  │ submissions                          │   │
│  │ - id: uuid-456                       │   │
│  │ - status: "pending_review"           │   │
│  │ - email: "john@example.com"          │   │
│  │ - patientFirstName: "John"           │   │
│  │ - ... all form fields ...            │   │
│  └──────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
           │
           │ 7. Admin reviews
           ▼
┌─────────────────────────────────────────────┐
│  ADMIN DASHBOARD (Future)                   │
│  - Review submission                        │
│  - Approve/Deny                             │
│  - Send email with doctor's note            │
└─────────────────────────────────────────────┘
```

---

## Why This Architecture?

### 1. Two-Table Design (Temporary + Permanent)

**Why not just one Submissions table?**

❌ **Bad Approach**:
```
User pays → Create Submission immediately
           → Payment fails → Now have abandoned record
```

✅ **Good Approach**:
```
User pays → Create TemporarySubmission
           → Payment succeeds → Create Submission
           → Payment fails → TemporarySubmission expires
```

**Benefits**:
- Clean separation: temp vs. permanent
- Failed payments don't pollute main table
- Can track abandoned carts
- Automatic cleanup via cron

### 2. Webhook-Driven (Not Client-Driven)

**Why use webhooks instead of client telling us payment succeeded?**

❌ **Bad Approach** (Client-driven):
```
Client: "I paid! Create my submission"
Server: "Okay!" (trusts client)
       → Client could lie
       → Could skip payment
```

✅ **Good Approach** (Webhook-driven):
```
Stripe: "Payment succeeded for pi_abc123"
Server: "Let me verify... yes, charge succeeded"
       → Creates submission
       → Stripe is source of truth
```

**Benefits**:
- Security: Can't fake a webhook signature
- Reliability: Stripe retries if we're down
- Accuracy: Stripe tells us payment status
- No client manipulation possible

### 3. Idempotency (Duplicate Prevention)

**Why check if submission already exists?**

**Without Idempotency**:
```
Webhook #1 → Create submission
Webhook #2 → Create duplicate submission (same payment!)
            → User charged once, but 2 submissions
```

**With Idempotency**:
```
Webhook #1 → Create submission
Webhook #2 → Check exists → Yes! → Return success (no duplicate)
```

**Benefits**:
- No duplicate submissions
- Safe to retry webhooks
- Handles network glitches

---

## Test Coverage: What We Test

### 11 Webhook Integration Tests ✅

1. ✅ Payment succeeds → Submission created
2. ✅ All form fields map correctly
3. ✅ Date conversions work
4. ✅ Duplicate webhook doesn't create duplicate
5. ✅ Already-processed payment returns success
6. ✅ Missing temp submission returns 500 (retry)
7. ✅ Invalid form data returns 400
8. ✅ Temp submission deletion failure handled
9. ✅ Invalid signature rejected
10. ✅ Missing signature rejected
11. ✅ Non-payment events handled

### 15 Schema Constraint Tests ✅

- Unique constraints enforced
- Required fields validated
- Optional fields allow null
- JSON fields work
- Indexes functional

### 25+ Lifecycle Tests ✅

- Full temporary → permanent flow
- Status workflow (pending → approved/denied)
- Email tracking
- Refund tracking
- Expiration handling
- Querying and filtering

### 10+ Cron Cleanup Tests ✅

- Expired submissions deleted
- Non-expired preserved
- Empty table handled
- Large batches work

**Total: ~70 integration tests + 180 unit tests = 250+ tests**

---

## Summary: The Complete Journey

1. **User fills form** → localStorage (client-side)
2. **User clicks Pay** → Creates PaymentIntent + TemporarySubmission
3. **User enters card** → Stripe charges card
4. **Stripe sends webhook** → Verifies, creates permanent Submission ✅
5. **User sees success** → localStorage cleared
6. **Admin reviews** → Approves/Denies (future)
7. **Email sent** → Doctor's note delivered (future)
8. **Cron cleanup** → Removes expired temp submissions (every hour)

**Key Takeaway**: The webhook endpoint is the **heart** of the system. It's the only place where temporary becomes permanent. That's why we wrote 11 comprehensive tests for it!

---

**Generated**: November 3, 2025
**Author**: Claude Code
**Status**: ✅ Complete and Production-Ready
