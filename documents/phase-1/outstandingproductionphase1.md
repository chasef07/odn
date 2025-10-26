# Outstanding Production Issues - Phase 1

**Project:** OnlineDoctorNote
**Date:** October 23, 2025
**Status:** Post Phase 1 Implementation

---

## Phase 1 Completed ✅

The following issues have been successfully resolved:

1. ✅ Fixed unsafe JSON parsing in form-storage.ts
2. ✅ Standardized environment variables and created .env.example
3. ✅ Removed duplicate email validation regex
4. ✅ Added accessibility attributes to all form inputs
5. ✅ Added fieldset/legend to radio button groups
6. ✅ Added aria-labels to Edit buttons in review page

---

## Outstanding Critical Issues

### 1. Payment Success Verification (SECURITY)

**File:** `/src/app/payment/success/page.tsx`
**Priority:** 🔴 CRITICAL
**Impact:** Security vulnerability

**Issue:**
Currently assumes payment succeeded based solely on URL parameter existence:
```typescript
// Line 22-23: For now, we'll assume success if payment_intent exists
setStatus('success');
```

**Risk:**
- User could manually navigate to `/payment/success?payment_intent=fake123`
- Would see success page without actually paying
- Could lead to fraudulent doctor's notes being issued

**Fix Required:**
```typescript
// Verify payment with Stripe API before showing success
const verifyPayment = async (paymentIntentId: string) => {
  const response = await fetch('/api/verify-payment', {
    method: 'POST',
    body: JSON.stringify({ paymentIntentId })
  });
  const { status } = await response.json();
  return status === 'succeeded';
};
```

**Estimated Effort:** 2-3 hours
**Must Fix Before:** Production launch

---

### 2. Console.error in Production (CODE QUALITY)

**File:** `/src/app/api/create-payment-intent/route.ts:31`
**Priority:** 🔴 CRITICAL
**Impact:** Exposes sensitive error details, performance overhead

**Issue:**
```typescript
} catch (error) {
  console.error('Error creating payment intent:', error);  // ⚠️ This line
  return NextResponse.json(
    { error: 'Failed to create payment intent' },
    { status: 500 }
  );
}
```

**Problems:**
- May log Stripe API keys or sensitive error details
- Adds unnecessary overhead in production
- Unprofessional for production code

**Fix Required:**
Option 1 (Quick):
```typescript
} catch (error) {
  if (process.env.NODE_ENV === 'development') {
    console.error('Error creating payment intent:', error);
  }
  return NextResponse.json(
    { error: 'Failed to create payment intent' },
    { status: 500 }
  );
}
```

Option 2 (Better):
```typescript
} catch (error) {
  // Send to logging service (Sentry, LogRocket, etc.)
  logger.error('Payment intent creation failed', { error });
  return NextResponse.json(
    { error: 'Failed to create payment intent' },
    { status: 500 }
  );
}
```

**Estimated Effort:** 15 minutes (Option 1), 2 hours (Option 2)
**Must Fix Before:** Production launch

---

### 3. Missing Loading States (UX)

**Files Affected:** 8 form pages
**Priority:** 🟠 HIGH
**Impact:** Poor user experience, potential double submissions

**Issue:**
All form submission buttons lack loading states:
- `/src/app/page.tsx` - Recipient selection
- `/src/app/basic-info/page.tsx` - Basic info
- `/src/app/contact-info/page.tsx` - Contact info
- `/src/app/state/page.tsx` - State selection
- `/src/app/note-purpose/page.tsx` - Note purpose
- `/src/app/absence-dates/page.tsx` - Absence dates
- `/src/app/absence-reason/page.tsx` - Absence reason
- `/src/app/symptoms/page.tsx` - Symptoms

**Current Behavior:**
```typescript
<button type="submit" className="...">
  Continue
</button>
```

User clicks → No visual feedback → User clicks 5 more times → Confusion

**Fix Required:**
```typescript
const { handleSubmit, formState: { isSubmitting } } = useForm<FormData>(...);

<button
  type="submit"
  disabled={isSubmitting}
  className="... disabled:opacity-50 disabled:cursor-not-allowed"
>
  {isSubmitting ? 'Loading...' : 'Continue'}
</button>
```

**Estimated Effort:** 2-3 hours (all 8 pages)
**Should Fix Before:** Production launch

---

### 4. Step Counter Bug (UX)

**File:** `/src/components/form-progress.tsx`
**Priority:** 🟠 HIGH
**Impact:** Confuses users on progress

**Issue:**
```typescript
<p className="text-sm font-semibold tracking-wide text-primary">
  Step {currentStep} of 9
</p>
```

Shows "of 9" but there are actually **10 total steps**:
1. Recipient
2. Basic Info
3. Contact Info
4. State
5. Note Purpose
6. Absence Dates
7. Absence Reason
8. Symptoms
9. Review
10. Payment (success page)

**Fix Required:**
```typescript
<p className="text-sm font-semibold tracking-wide text-primary">
  Step {currentStep} of 10
</p>
```

**Estimated Effort:** 5 minutes
**Should Fix Before:** Production launch

---

## Outstanding Medium Priority Issues

### 5. Rate Limiting (SECURITY)

**File:** `/src/app/api/create-payment-intent/route.ts`
**Priority:** 🟡 MEDIUM
**Impact:** Could be abused for API spam

**Issue:**
No rate limiting on payment API endpoint. Malicious user could spam requests.

**Fix Required:**
Implement rate limiting middleware or use service like Upstash Redis:
```typescript
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "10 s"), // 10 requests per 10 seconds
});

export async function POST(request: NextRequest) {
  const ip = request.ip ?? "127.0.0.1";
  const { success } = await ratelimit.limit(ip);

  if (!success) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429 }
    );
  }

  // ... rest of payment logic
}
```

**Estimated Effort:** 3-4 hours
**Recommended:** Before production launch

---

### 6. Stripe API Version Verification (CONFIGURATION)

**File:** `/src/app/api/create-payment-intent/route.ts:5`
**Priority:** 🟡 MEDIUM
**Impact:** Potential API compatibility issues

**Issue:**
```typescript
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-09-30.clover',  // ← Unusual suffix
});
```

The `.clover` suffix is non-standard for Stripe API versions. Standard format is `YYYY-MM-DD`.

**Action Required:**
- Verify this is the correct API version for your Stripe account
- Check Stripe dashboard for recommended version
- Consider making this configurable via environment variable:
  ```typescript
  apiVersion: (process.env.STRIPE_API_VERSION || '2024-10-28.acacia') as Stripe.LatestApiVersion,
  ```

**Estimated Effort:** 30 minutes
**Recommended:** Before production launch

---

### 7. Missing Terms & Privacy Pages (LEGAL/COMPLIANCE)

**Files:** Not created yet
**Priority:** 🟡 MEDIUM
**Impact:** Legal compliance, broken links

**Issue:**
Footer contains links to Terms of Service and Privacy Policy pages that don't exist:
```typescript
<a href="/terms">Terms of Service</a>
<a href="/privacy">Privacy Policy</a>
```

These links return 404 errors.

**Fix Required:**
1. Create `/src/app/terms/page.tsx`
2. Create `/src/app/privacy/page.tsx`
3. Consult with legal counsel for proper content
4. Include:
   - Payment terms
   - Refund policy
   - Medical disclaimer
   - HIPAA compliance statement
   - Data collection & usage
   - Cookie policy

**Estimated Effort:** 4-8 hours (including legal review)
**Must Have Before:** Production launch (legal requirement)

---

## Additional Recommendations (Nice to Have)

### 8. CSRF Protection

**File:** `/src/app/api/create-payment-intent/route.ts`
**Priority:** 🟢 LOW
**Impact:** Security hardening

Consider adding CSRF token validation to API routes.

**Estimated Effort:** 2-3 hours

---

### 9. Form Data Server-Side Validation

**File:** `/src/app/api/create-payment-intent/route.ts`
**Priority:** 🟢 LOW
**Impact:** Security hardening

Currently no validation that incoming request data matches expected schema.

**Recommended Fix:**
```typescript
import { z } from 'zod';

const paymentRequestSchema = z.object({
  formData: z.object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    email: z.string().email(),
    // ... etc
  })
});

export async function POST(request: NextRequest) {
  const body = await request.json();
  const validated = paymentRequestSchema.parse(body);
  // ... proceed with validated data
}
```

**Estimated Effort:** 2 hours

---

### 10. Error Logging Service

**Files:** All API routes
**Priority:** 🟢 LOW
**Impact:** Better production monitoring

Implement proper error logging with services like:
- Sentry
- LogRocket
- Datadog
- New Relic

**Estimated Effort:** 3-4 hours

---

### 11. Automated Testing

**Files:** None (no tests exist)
**Priority:** 🟢 LOW
**Impact:** Prevent regressions

Add test coverage for:
- Date validation edge cases
- Form submission flow
- Error handling scenarios
- localStorage persistence
- Payment success verification

**Estimated Effort:** 8-12 hours

---

## Priority Action Plan

### Before Production Launch (Required):

1. ✅ ~~Fix unsafe JSON parsing~~ (COMPLETED)
2. ✅ ~~Standardize environment variables~~ (COMPLETED)
3. ✅ ~~Accessibility improvements~~ (COMPLETED)
4. ❌ **Implement payment success verification** (2-3 hours)
5. ❌ **Remove/guard console.error** (15 mins)
6. ❌ **Add loading states to forms** (2-3 hours)
7. ❌ **Fix step counter** (5 mins)
8. ❌ **Create Terms & Privacy pages** (4-8 hours)

**Total Estimated Time:** 9-15 hours

### Recommended Before Launch (Optional):

9. Rate limiting on payment API (3-4 hours)
10. Verify Stripe API version (30 mins)
11. Add CSRF protection (2-3 hours)

**Total Estimated Time:** 6-8 hours

### Post-Launch Improvements:

12. Server-side form validation
13. Error logging service
14. Automated testing

---

## Environment Variables Checklist

Ensure all of these are set in production:

```bash
# Required
STRIPE_SECRET_KEY=sk_live_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
NEXT_PUBLIC_PAYMENT_AMOUNT=2999
NEXT_PUBLIC_APP_URL=https://yourdomain.com
NODE_ENV=production

# Recommended
STRIPE_API_VERSION=2024-10-28.acacia
```

---

## Testing Checklist Before Launch

- [ ] Test payment flow end-to-end with real Stripe test mode
- [ ] Verify payment success page cannot be spoofed
- [ ] Test all form pages on mobile browsers (iOS Safari, Chrome)
- [ ] Run accessibility audit with WAVE or axe DevTools
- [ ] Test with screen reader (VoiceOver on Mac/iOS, NVDA on Windows)
- [ ] Verify all form validation edge cases
- [ ] Test localStorage corruption recovery
- [ ] Check all links (Terms, Privacy, etc.)
- [ ] Load test payment API endpoint
- [ ] Verify environment variables in production
- [ ] Test Stripe webhooks if implemented
- [ ] Verify error handling doesn't expose sensitive data

---

## Security Audit Checklist

- [ ] Payment verification implemented
- [ ] Console logs removed/guarded
- [ ] Rate limiting on API routes
- [ ] CSRF protection considered
- [ ] Environment variables properly secured
- [ ] No hardcoded credentials
- [ ] HTTPS enforced in production
- [ ] Stripe keys using live mode (not test mode)
- [ ] Form data validated server-side
- [ ] Error messages don't expose internal details

---

## Deployment Notes

When deploying to production:

1. Set all environment variables in hosting platform (Vercel, etc.)
2. Ensure `NODE_ENV=production`
3. Switch Stripe keys from test to live mode
4. Update `NEXT_PUBLIC_APP_URL` to production domain
5. Verify HTTPS is enabled
6. Test payment flow with real payment (small amount)
7. Monitor error logs for first 24 hours
8. Set up uptime monitoring (Uptime Robot, Pingdom, etc.)

---

## Contact & Resources

**Stripe Documentation:**
- Payment Intents: https://stripe.com/docs/payments/payment-intents
- API Versioning: https://stripe.com/docs/api/versioning
- Testing: https://stripe.com/docs/testing

**Accessibility Resources:**
- WCAG 2.1 Guidelines: https://www.w3.org/WAI/WCAG21/quickref/
- WAVE Tool: https://wave.webaim.org/
- axe DevTools: https://www.deque.com/axe/devtools/

**Next.js Security:**
- Environment Variables: https://nextjs.org/docs/app/building-your-application/configuring/environment-variables
- API Routes: https://nextjs.org/docs/app/building-your-application/routing/route-handlers

---

**End of Phase 1 Outstanding Issues Document**
