# Payment Verification Bug - Critical Issue

**Date:** November 20, 2025
**Severity:** CRITICAL
**Status:** IDENTIFIED - FIX PENDING

---

## Executive Summary

The `/api/verify-payment` endpoint only checks Stripe's payment status without verifying that a `Submission` was actually created in the database. This creates a critical scenario where customers can see a success page after payment, but their submission was never recorded due to webhook failures.

**Impact:** Customers pay but receive no service, leading to refunds, support tickets, and lost revenue.

---

## The Bug

### Current Implementation (BROKEN)

**File:** `src/app/api/verify-payment/route.ts`

```typescript
export async function POST(request: NextRequest) {
  try {
    const { paymentIntentId } = await request.json()

    if (!paymentIntentId) {
      return NextResponse.json({ error: 'Payment intent ID is required' }, { status: 400 })
    }

    // ❌ ONLY checks Stripe, doesn't verify database record exists
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)

    return NextResponse.json({
      status: paymentIntent.status,  // ← Trusts Stripe alone
      amount: paymentIntent.amount,
    })
  } catch (error) {
    console.error('Error verifying payment:', error)
    return NextResponse.json({ error: 'Invalid payment intent' }, { status: 400 })
  }
}
```

### What's Wrong

The endpoint checks:
- ✅ Is the payment successful on Stripe?

But doesn't check:
- ❌ Was a `Submission` created in our database?
- ❌ Did the webhook successfully process this payment?
- ❌ Will the customer actually receive their doctor's note?

---

## How Users Are Affected

### Normal Flow (When Everything Works)

1. User completes payment → Stripe charges card
2. Stripe webhook fires → Creates `Submission` in database
3. User redirected to `/payment/success?payment_intent=pi_xxx`
4. Success page calls `/api/verify-payment`
5. API returns `status: 'succeeded'`
6. User sees success screen ✅
7. Payment confirmation email sent ✅
8. Submission appears in admin portal ✅

### Bug Scenario (When Webhook Fails)

1. User completes payment → Stripe charges card ✅
2. Stripe webhook fires → **FAILS** (signature error, timeout, database issue) ❌
3. No `Submission` created in database ❌
4. User redirected to `/payment/success?payment_intent=pi_xxx`
5. Success page calls `/api/verify-payment`
6. API checks Stripe: "Payment succeeded?" → YES
7. API returns `status: 'succeeded'` (even though no database record exists!)
8. User sees success screen ✅ **← FALSE POSITIVE**
9. No email sent ❌
10. No record in admin portal ❌
11. **Customer paid but will never receive their doctor's note** ❌

---

## Real-World Example

**Payment Intent:** `pi_3SVhFgDSBGtvcAEg2g5TFCUY`
**Date:** November 20, 2025 at 18:59:46

### Timeline

```
18:59:42 - User on /basic-info
18:59:43 - User on /contact-info
18:59:43 - User on / (homepage)
18:59:46 - User on /payment/success?payment_intent=pi_3SVhFgDSBGtvcAEg2g5TFCUY
         - redirect_status=succeeded
```

### What Happened

**From user's perspective:**
- ✅ Payment succeeded
- ✅ Success page displayed
- ✅ Expected to receive doctor's note

**From system's perspective:**
- ✅ Stripe charged $24.95
- ❌ Webhook failed (signature verification error)
- ❌ No `Submission` created in database
- ❌ No payment confirmation email sent
- ❌ Doctor cannot see submission in admin portal

**Outcome:** Customer paid but received nothing.

---

## Root Cause Analysis

### Why Webhooks Are Failing

The webhook signature verification is failing because:

1. **Endpoint was renamed** from `/api/webhooks/stripe-prod` to `/api/webhooks/stripe-prod2`
2. **Stripe Dashboard not updated** - still pointing to old endpoint
3. **Signing secret mismatch** - `STRIPE_WEBHOOK_SECRET` is tied to the old endpoint URL
4. **Result:** Webhook requests rejected with signature verification errors

### Why Success Page Shows False Positives

The success page verification flow:

```typescript
// src/app/payment/success/page.tsx
const verifyPayment = async () => {
  const response = await fetch('/api/verify-payment', {
    method: 'POST',
    body: JSON.stringify({ paymentIntentId: paymentIntent }),
  })

  const data = await response.json()

  if (data.status === 'succeeded') {
    setStatus('success')  // ← Shows success based on Stripe alone
    // Fire Google Ads conversion
    // Clear form data
  }
}
```

**The bug:** `data.status === 'succeeded'` only means Stripe payment succeeded, not that webhook processed it.

---

## The Fix

### Proposed Solution

Update `/api/verify-payment/route.ts` to check **both** Stripe status and database record:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import prisma from '@/lib/prisma'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-10-29.clover',
})

export async function POST(request: NextRequest) {
  try {
    const { paymentIntentId } = await request.json()

    if (!paymentIntentId) {
      return NextResponse.json({ error: 'Payment intent ID is required' }, { status: 400 })
    }

    // 1. Retrieve the payment intent from Stripe to verify its status
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)

    // 2. ✅ NEW: Check if Submission exists in database (confirms webhook processed successfully)
    const submission = await prisma.submission.findUnique({
      where: { stripePaymentIntentId: paymentIntentId },
      select: { id: true, email: true }
    })

    // 3. ✅ NEW: If payment succeeded but no submission exists, webhook likely failed
    if (paymentIntent.status === 'succeeded' && !submission) {
      console.error('CRITICAL: Payment succeeded but no Submission found', {
        paymentIntentId,
        stripeStatus: paymentIntent.status,
        amount: paymentIntent.amount,
      })

      // Return 'processing' status so user sees "processing..." instead of false success
      // Webhook retries will eventually create the Submission
      return NextResponse.json({
        status: 'processing',
        amount: paymentIntent.amount,
        message: 'Payment received, processing your submission...'
      })
    }

    // 4. Return the actual payment status from Stripe + confirmation from database
    return NextResponse.json({
      status: paymentIntent.status,
      amount: paymentIntent.amount,
      submissionId: submission?.id,
    })
  } catch (error) {
    console.error('Error verifying payment:', error)
    return NextResponse.json({ error: 'Invalid payment intent' }, { status: 400 })
  }
}
```

### How This Fixes The Bug

**Before (Broken):**
```
Stripe payment succeeded? YES → Show success ✅
(Even if no database record exists)
```

**After (Fixed):**
```
Stripe payment succeeded? YES
Database record exists? NO → Show "processing..." ⏳
(Webhook will retry and eventually create record)

Stripe payment succeeded? YES
Database record exists? YES → Show success ✅
```

---

## Success Page Behavior After Fix

### Scenario 1: Normal Flow (Webhook Succeeded)

1. Payment succeeds
2. Webhook creates `Submission`
3. User lands on success page
4. `/api/verify-payment` checks: Stripe ✅ + Database ✅
5. Returns `status: 'succeeded'`
6. User sees success screen ✅

### Scenario 2: Webhook Failed (First Attempt)

1. Payment succeeds
2. Webhook fails (temporary error)
3. User lands on success page
4. `/api/verify-payment` checks: Stripe ✅ + Database ❌
5. Returns `status: 'processing'`
6. User sees "Processing your payment..." spinner ⏳
7. Page could poll every 5 seconds to check again
8. Webhook retries (Stripe retries automatically)
9. Eventually webhook succeeds → Submission created
10. Next poll: Database ✅ → Show success screen ✅

### Scenario 3: Webhook Permanently Failed

1. Payment succeeds
2. Webhook fails (permanent error - bad data, etc.)
3. User lands on success page
4. `/api/verify-payment` checks: Stripe ✅ + Database ❌
5. Returns `status: 'processing'`
6. User sees "Processing..." for extended period
7. After timeout (e.g., 2 minutes), show error with support contact

---

## Additional Improvements

### Add Polling to Success Page

**File:** `src/app/payment/success/page.tsx`

```typescript
useEffect(() => {
  if (!paymentIntent) return

  let pollCount = 0
  const MAX_POLLS = 24 // 2 minutes (24 × 5 seconds)

  const verifyPayment = async () => {
    const response = await fetch('/api/verify-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentIntentId: paymentIntent }),
    })

    const data = await response.json()

    if (data.status === 'succeeded') {
      setStatus('success')
      // Fire conversion event, clear form data
    } else if (data.status === 'processing') {
      pollCount++

      if (pollCount < MAX_POLLS) {
        // Still processing, poll again in 5 seconds
        setTimeout(verifyPayment, 5000)
      } else {
        // Timeout - show error with support contact
        setStatus('error')
      }
    } else {
      setStatus('error')
    }
  }

  verifyPayment()
}, [paymentIntent])
```

### Add Admin Alert for Stuck Payments

Create a daily cron job that finds payments where:
- Stripe payment succeeded
- No `Submission` exists
- Payment is >24 hours old

Alert admin to manually process these.

---

## Monitoring & Alerts

### Metrics to Track

1. **Payment Success Rate:**
   ```sql
   -- Payments that succeeded on Stripe but have no Submission
   SELECT COUNT(*) FROM stripe_payment_intents
   WHERE status = 'succeeded'
   AND id NOT IN (SELECT stripePaymentIntentId FROM "Submission")
   ```

2. **Webhook Failure Rate:**
   - Track in Stripe Dashboard → Webhooks → Endpoint → Event logs

3. **False Success Pages:**
   - Log when `/api/verify-payment` returns `status: 'processing'`
   - Alert if this happens frequently

### Alert Thresholds

- **WARNING:** >1 stuck payment per day
- **CRITICAL:** >5 stuck payments per day
- **EMERGENCY:** >10% of payments stuck

---

## Prevention Strategy

### 1. Webhook Reliability (Already Implemented)

From `productionfix.md`:
- ✅ Prisma Accelerate for 40x faster queries
- ✅ Reversed order architecture (TemporarySubmission before PaymentIntent)
- ✅ 2-tier fallback lookup in webhook
- ✅ Event age validation (reject stale events)
- ✅ Idempotency checks

### 2. Verification Reliability (This Fix)

- ✅ Check both Stripe and database
- ✅ Return 'processing' instead of false success
- ✅ Add polling for eventual consistency
- ✅ Timeout and error handling

### 3. Manual Recovery Tools

Create admin script:
```typescript
// scripts/recover-stuck-payments.ts
// Finds stuck payments and manually creates Submissions
```

---

## Deployment Checklist

### Before Deploying Fix

- [ ] Update Stripe webhook URL to `/api/webhooks/stripe-prod2` ✅ (DONE)
- [ ] Verify webhook secret in environment variables
- [ ] Test webhook locally with Stripe CLI
- [ ] Confirm webhooks are succeeding in Stripe Dashboard

### Deploy Verification Fix

- [ ] Update `/api/verify-payment/route.ts` with database check
- [ ] Update success page with polling logic (optional but recommended)
- [ ] Add monitoring for 'processing' status returns
- [ ] Deploy to production
- [ ] Test end-to-end payment flow

### After Deployment

- [ ] Monitor stuck payment metrics for 48 hours
- [ ] Check Stripe webhook success rate
- [ ] Review customer support tickets for payment issues
- [ ] Document any remaining edge cases

---

## Related Documentation

- [Production Fix Guide](./productionfix.md) - Webhook architecture and reliability improvements
- [Webhook Fix Guide](./WEBHOOK_FIX_GUIDE.md) - Event filtering and age validation
- [Serverless Function Bloat](./SERVERLESS_FUNCTION_BLOAT_ANALYSIS.md) - Performance optimization

---

## Conclusion

This bug represents a **critical business risk** where customers can pay without receiving service. The fix is straightforward:

**Check both Stripe payment status AND database record existence before showing success.**

Without this fix, every webhook failure results in a lost customer and potential refund/chargeback.

**Estimated Impact:**
- Current webhook failure rate: ~3% (based on historical data)
- Average daily payments: ~10-20
- Potential stuck payments per week: 2-4
- Revenue at risk: $50-100/week

**Priority:** IMMEDIATE - Deploy this week
