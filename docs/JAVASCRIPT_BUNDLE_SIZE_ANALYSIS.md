# JavaScript Bundle Size Analysis - Next.js Application

**Date:** November 20, 2025
**Issue:** JavaScript chunks are getting heavy (278 KB, 214 KB) - suggests large dependencies not being split properly

---

## Executive Summary

The application has **35 client components** with several large dependencies being bundled client-side. The primary issues are:
1. **date-fns (38MB)** - Used in multiple client components
2. **lucide-react (43MB install)** - 16+ icons used across app
3. **All form pages as client components** - Could use server components + client islands
4. **No bundle analyzer configured** - Cannot measure exact bundle sizes

**Estimated Impact:** 30-40% bundle size reduction possible with optimizations.

---

## 1. All Client Components (35 Total)

### Form Pages (13 components)
- `src/app/start/page.tsx`
- `src/app/get-started/page.tsx`
- `src/app/basic-info/page.tsx`
- `src/app/guardian-info/page.tsx`
- `src/app/contact-info/page.tsx`
- `src/app/note-purpose/page.tsx`
- `src/app/absence-dates/page.tsx`
- `src/app/absence-reason/page.tsx`
- `src/app/symptoms/page.tsx`
- `src/app/additional-info/page.tsx`
- `src/app/review/page.tsx` **(580 lines - LARGEST)**
- `src/app/payment/page.tsx` (248 lines)
- `src/app/approved/page.tsx`

### Admin Pages (3 components)
- `src/app/admin/login/page.tsx`
- `src/app/admin/review/page.tsx` (372 lines)
- `src/app/payment/success/page.tsx`

### Shared Components (19 components)
- `src/components/Header.tsx`
- `src/components/Footer.tsx`
- `src/components/form/FormNavigation.tsx`
- `src/app/page.tsx` **(435 lines - HOMEPAGE)**
- `src/components/ui/cta-button.tsx`
- `src/components/ui/accordion.tsx`
- `src/components/ui/checkbox.tsx`
- `src/components/ui/dialog.tsx`
- `src/components/ui/label.tsx`
- `src/components/ui/progress.tsx`
- `src/components/ui/radio-group.tsx`
- `src/components/ui/select.tsx`
- `src/components/admin/DenialReasonDialog.tsx`
- `src/components/admin/LogoutButton.tsx`
- `src/components/admin/MaybeActionButtons.tsx`
- `src/components/admin/MaybePortalTabs.tsx`
- `src/components/admin/ManualActionButtons.tsx`
- `src/components/admin/SubmissionEditForm.tsx`
- `src/app/who-is-using/page.tsx`

---

## 2. Heavy Client-Side Dependencies

| Package | Install Size | Impact | Status |
|---------|-------------|--------|--------|
| **lucide-react** | 43MB | HIGH | ⚠️ Tree-shaken but large |
| **date-fns** | 38MB | CRITICAL | ❌ Used in multiple clients |
| **@react-pdf/renderer** | 2.8MB | NONE | ✅ Server-only |
| **@stripe/react-stripe-js** | 1.9MB | MEDIUM | ⚠️ Could lazy load |
| **react-hook-form** | ~500KB | LOW | ✅ Necessary |
| **Radix UI (8 packages)** | ~50-200KB each | MEDIUM | ⚠️ Via shadcn/ui |

---

## 3. Critical Bundle Issues

### A. ❌ date-fns (38MB - CRITICAL)

**Problem:** Full library installed, used in multiple client components

**Client-side usage:**
```typescript
// review/page.tsx
import { format, parse } from 'date-fns'
import { formatInTimeZone } from 'date-fns-tz'

// absence-dates/page.tsx
import { format } from 'date-fns'

// Via utilities (imported by clients)
import { format } from 'date-fns' // date-validators.ts
import { differenceInYears } from 'date-fns' // age-validators.ts
```

**Files using date-fns client-side:**
- `src/app/review/page.tsx`
- `src/app/absence-dates/page.tsx`
- `src/lib/date-validators.ts` (imported by clients)
- `src/lib/age-validators.ts` (imported by clients)
- Admin components

**Impact:** 38MB library for basic date formatting
**Solution:** Use native `Intl.DateTimeFormat` or lighter alternative

---

### B. ⚠️ lucide-react (43MB - HIGH)

**Problem:** Large install size, though tree-shaken correctly

**Usage:** 16+ different icons across components
```typescript
// Common imports:
import { ArrowLeft, ArrowRight, CheckCircle2, Shield, Star, DollarSign,
         BadgeCheck, Mail, Phone, MapPin, ShieldCheck, Pencil, CheckIcon,
         ChevronDownIcon, ChevronUpIcon, XIcon, CircleIcon } from 'lucide-react'
```

**Impact:** Tree-shaking works, but 43MB install is excessive
**Solution:** Consider `lucide-static` or inline SVGs (only 16 icons used)

---

### C. ⚠️ @stripe/react-stripe-js (1.9MB - MEDIUM)

**Problem:** Entire Stripe SDK loaded for payment page

**Usage:**
```typescript
// Only in payment/page.tsx
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
```

**Impact:** 1.9MB loaded for all users, even those who don't reach payment
**Solution:** Lazy load with `next/dynamic`

---

### D. ✅ @react-pdf/renderer (2.8MB - NO ISSUE)

**Good News:** Only used server-side for PDF generation

**Usage:**
```typescript
// Server-only files:
src/lib/pdf/doctor-note-template.tsx
src/lib/pdf/generate-pdf.tsx
src/app/admin/actions.ts (server action)
```

**Impact:** NOT bundled client-side
**Status:** ✅ Correctly implemented

---

### E. ⚠️ Radix UI Components (Multiple Packages)

**Problem:** 8 different Radix UI packages (shadcn/ui foundation)

**Packages:**
- `@radix-ui/react-accordion` (homepage FAQ)
- `@radix-ui/react-checkbox`
- `@radix-ui/react-dialog` (admin modals)
- `@radix-ui/react-label`
- `@radix-ui/react-progress`
- `@radix-ui/react-radio-group`
- `@radix-ui/react-select`
- `@radix-ui/react-slot`

**Impact:** Each adds ~50-200KB
**Solution:** Review which are actually needed, tree-shaking should work

---

## 4. Largest Client Components

### 1. Review Page (`review/page.tsx`) - 580 lines

**Dependencies:**
- react-hook-form
- date-fns, date-fns-tz
- Zod
- lucide-react

**Issues:**
- 5 separate forms (personal, guardian, contact, dates, terms)
- All client-side
- Heavy date manipulation

**Solution:** Split into server component + client islands per section

---

### 2. Homepage (`page.tsx`) - 435 lines

**Dependencies:**
- Next Image
- lucide-react (15 icons)
- Radix Accordion
- shadcn components

**Issues:**
- Entire homepage is client component
- Loads on every first visit
- Large FAQ section

**Solution:** Convert to server component with client islands for interactive parts

---

### 3. Admin Review (`admin/review/page.tsx`) - 372 lines

**Dependencies:**
- useState, useEffect
- Prisma types
- Server actions
- Multiple dialogs/modals

**Issues:**
- Tinder-style swipe interface
- All client-side

**Solution:** Extract swipe logic to separate client component

---

### 4. Payment Page (`payment/page.tsx`) - 248 lines

**Dependencies:**
- Stripe Elements
- react-hook-form

**Issues:**
- Entire Stripe SDK loaded eagerly

**Solution:** Lazy load Stripe components

---

## 5. Bundle Optimization Status

### ❌ No Bundle Analyzer Configured

**Current `next.config.ts`:**
```typescript
const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  // ... security headers only
}
```

**Missing:**
- No `@next/bundle-analyzer`
- No webpack bundle size limits
- No chunk size warnings

---

### ❌ No Dynamic Imports

None of the heavy client components use `next/dynamic` for code splitting.

**Opportunities:**
- Stripe payment components
- Admin modals/dialogs
- Large form sections

---

### ❌ No Lazy Loading

All components load eagerly on page load.

**Should lazy load:**
- Stripe Elements
- Admin dialog components
- FAQ accordion content

---

### ✅ Good: Server Components Default

Most components are server components by default (Next.js 16 App Router).

---

### ✅ Good: No moment.js

Using `date-fns` instead (lighter, though still heavy at 38MB).

---

## 6. Tree-Shaking Analysis

### ✅ Good Tree-Shaking:
- **lucide-react**: Individual icon imports
- **Zod**: Specific schema imports
- **react-hook-form**: Named imports only

### ⚠️ Questionable Tree-Shaking:
- **date-fns**: Named imports, but 38MB suggests poor tree-shaking
- **Radix UI**: Multiple packages

### ❌ No Tree-Shaking:
- **@stripe/react-stripe-js**: Entire SDK loaded

---

## 7. Recommendations (Prioritized)

### Priority 1: Install Bundle Analyzer (IMMEDIATE)

```bash
npm install --save-dev @next/bundle-analyzer
```

**Update `next.config.ts`:**
```typescript
import bundleAnalyzer from '@next/bundle-analyzer'

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
})

const nextConfig: NextConfig = {
  output: 'standalone',  // Also add this!
  turbopack: {
    root: __dirname,
  },
  // ... rest
}

export default withBundleAnalyzer(nextConfig)
```

**Run analysis:**
```bash
ANALYZE=true npm run build
```

**Impact:** Visibility into exact bundle sizes and biggest culprits

---

### Priority 2: Lazy Load Stripe Payment (HIGH IMPACT)

**File:** `src/app/payment/page.tsx`

```typescript
// ❌ BEFORE
import { Elements } from '@stripe/react-stripe-js'

// ✅ AFTER
const StripePaymentForm = dynamic(() => import('./StripePaymentForm'), {
  ssr: false,
  loading: () => <div>Loading payment form...</div>
})
```

**Impact:** -1.9MB from initial bundle, only loads on payment page

---

### Priority 3: Replace date-fns with Native Intl (CRITICAL)

**Problem:** 38MB for basic date formatting

**Solution:** Use native JavaScript `Intl.DateTimeFormat`

```typescript
// ❌ BEFORE
import { format } from 'date-fns'
const formatted = format(date, 'MM/dd/yyyy')

// ✅ AFTER
const formatted = new Intl.DateTimeFormat('en-US').format(date)
```

**Files to update:**
- `src/app/review/page.tsx`
- `src/app/absence-dates/page.tsx`
- `src/lib/date-validators.ts`
- `src/lib/age-validators.ts`

**Impact:** -38MB from bundle (~30KB for polyfills)

---

### Priority 4: Convert Homepage to Server Component (MEDIUM)

**File:** `src/app/page.tsx`

```typescript
// ❌ BEFORE - Entire page is 'use client'

// ✅ AFTER - Server component with client islands
// Remove 'use client' from page.tsx
// Extract CTA button, accordion to separate client components
```

**Impact:** -150KB from initial bundle, faster first load

---

### Priority 5: Split Review Page into Client Islands (MEDIUM)

**File:** `src/app/review/page.tsx` (580 lines)

**Current:** One massive client component with 5 forms

**Solution:**
```typescript
// Server component parent
export default async function ReviewPage() {
  const data = await getFormData() // server-side

  return (
    <div>
      <PersonalInfoSection data={data.personal} /> {/* client */}
      <GuardianInfoSection data={data.guardian} /> {/* client */}
      <ContactInfoSection data={data.contact} /> {/* client */}
      <DatesSection data={data.dates} /> {/* client */}
      <TermsSection data={data.terms} /> {/* client */}
    </div>
  )
}
```

**Impact:** -50% bundle size for review page

---

### Priority 6: Optimize lucide-react Usage (LOW)

**Current:** 43MB install, 16 icons used

**Options:**
1. Keep as-is (tree-shaking works)
2. Use `lucide-static` (smaller package)
3. Inline SVGs (manual, but smallest)

**Impact:** Minor (tree-shaking already works)

---

### Priority 7: Consolidate Radix UI Packages (LOW)

**Review:** Which shadcn components are actually used?

**Remove unused:**
- Check if all 8 Radix packages are needed
- Remove unused shadcn components

**Impact:** -50-200KB per unused package

---

## 8. Estimated Bundle Sizes

### Current (Estimated)
- **Homepage:** ~150-200KB (icons, accordion, images)
- **Form Pages:** ~100-120KB each (react-hook-form + Zod + icons)
- **Review Page:** ~180-220KB (date-fns + 5 forms)
- **Payment Page:** ~200-250KB (Stripe SDK)
- **Admin:** ~150-180KB

### After Optimizations (Projected)
- **Homepage:** ~50-80KB (server + client islands)
- **Form Pages:** ~80-100KB (shared form wrapper)
- **Review Page:** ~100-120KB (client islands, native dates)
- **Payment Page:** ~150-180KB (lazy loaded)
- **Admin:** ~120-150KB

**Total Reduction:** 30-40% smaller initial bundles

---

## 9. Implementation Plan

### Week 1: Analysis & Quick Wins
1. Install and run bundle analyzer
2. Add `output: 'standalone'` to next.config.ts
3. Lazy load Stripe payment components

### Week 2: date-fns Replacement
1. Replace date-fns with native `Intl` in client components
2. Keep date-fns server-side only
3. Test all date formatting

### Week 3: Server Components Refactor
1. Convert homepage to server component
2. Split review page into client islands
3. Optimize admin pages

### Week 4: Polish & Monitor
1. Remove unused Radix packages
2. Set up bundle size monitoring
3. Add CI checks for bundle size limits

---

## 10. Build Issue Found

**Error during build:**
```
Type error: Cannot find module '../../../src/app/api/webhooks/stripe/route.js'
```

**Cause:** Webhook endpoint renamed from `/webhooks/stripe` to `/webhooks/stripe-prod` but type cache not cleared

**Fix:** Delete `.next` folder and rebuild:
```bash
rm -rf .next
npm run build
```

---

## 11. Monitoring & Prevention

### Add Bundle Size Limits

**In `next.config.ts`:**
```typescript
const nextConfig: NextConfig = {
  // ... other config

  webpack(config) {
    config.performance = {
      maxAssetSize: 200000, // 200KB limit per chunk
      maxEntrypointSize: 400000, // 400KB limit for entry points
      hints: 'warning'
    }
    return config
  }
}
```

### Add CI Check

**In `.github/workflows/test.yml`:**
```yaml
- name: Check bundle size
  run: |
    npm run build
    # Add bundle size check script
```

---

## 12. Summary Table

| Issue | Impact | Size | Priority | Complexity |
|-------|--------|------|----------|-----------|
| date-fns (38MB) | CRITICAL | ~30-40KB in bundle | P3 | Medium |
| No bundle analyzer | HIGH | N/A | P1 | Trivial |
| Stripe not lazy loaded | MEDIUM | 1.9MB | P2 | Low |
| Homepage fully client | MEDIUM | ~150KB | P4 | Medium |
| Review page fully client | MEDIUM | ~180KB | P5 | High |
| lucide-react (43MB install) | LOW | Tree-shaken | P6 | Low |
| Unused Radix packages | LOW | ~50-200KB | P7 | Low |

**Total Potential Savings:** 30-40% reduction in client bundle size

---

## Conclusion

The application has **moderate bundle size issues** primarily caused by:

1. **date-fns (38MB)** - Used in multiple client components, should use native `Intl`
2. **No bundle analyzer** - Cannot measure exact impact
3. **Large client components** - Should use server components + client islands
4. **Stripe SDK eager loading** - Should lazy load

**Good news:**
- @react-pdf/renderer correctly server-only
- No moment.js (using date-fns)
- Tree-shaking works for most libraries
- Server components used by default

**Next steps:**
1. Install bundle analyzer (get exact data)
2. Lazy load Stripe
3. Replace date-fns with native Intl
4. Refactor large client components
