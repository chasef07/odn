# Serverless Function Bloat Analysis - Next.js Application

**Date:** November 20, 2025
**Issue:** Admin routes (28.1 MB) and API routes (24.5 MB) are too large for optimal serverless performance

---

## Executive Summary

Based on analysis of the Next.js application, there are **moderate to severe bloat issues** that impact cold start times and deployment size on Vercel. The primary issues stem from heavy library imports in server-side code and lack of optimization configuration.

**Key Finding:** The admin actions file loads 4.3MB of dependencies for EVERY request, even when just viewing the dashboard.

---

## 1. Current Next.js Configuration

**File:** `next.config.ts`

```typescript
const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  async headers() {
    // Security headers configuration
  },
}
```

**Issues:**
- ❌ **No `output: 'standalone'` mode** - Missing optimized production output
- ❌ **No bundle size optimization** - No webpack/turbopack bundle analyzer configured
- ✅ **Turbopack enabled** - Uses modern bundler for faster builds

**Recommendation:** Add `output: 'standalone'` for optimized serverless deployment on Vercel.

---

## 2. Root Layout Analysis

**File:** `src/app/layout.tsx`

**Imports:**
```typescript
import { Manrope } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import Script from 'next/script'
import './globals.css'
import '@/lib/env' // ⚠️ VALIDATION ON STARTUP
```

**Issues:**
- ⚠️ **Environment validation import** - The `@/lib/env` import runs validation code on every request to any page
- ✅ **Lightweight dependencies** - Next.js fonts, Analytics, and Script are all optimized
- ✅ **No heavy library imports** - No PDF, Stripe, or Prisma in root layout

**Impact:** **LOW** - The env validation is small but runs globally

---

## 3. Admin Layout Analysis

**File:** `src/app/admin/layout.tsx`

**Imports:**
```typescript
import Link from 'next/link'
import { ReactNode } from 'react'
import { LogoutButton } from '@/components/admin/LogoutButton'
```

**Issues:**
- ✅ **Minimal imports** - Only Next.js primitives and a small component
- ✅ **No auth check in layout** - Correctly deferred to individual pages

**Impact:** **NONE** - Very lightweight

---

## 4. API Routes Analysis

### 4.1 Auth Route (`/api/auth/[...all]/route.ts`)

```typescript
import { auth } from "@/lib/auth"
import { toNextJsHandler } from "better-auth/next-js"
```

**Heavy Dependencies:**
- `better-auth` (~150KB)
- Transitively imports: `bcryptjs` (~120KB), `prisma` (~500KB+)

**Impact:** **HIGH** - Every auth API call loads the entire auth stack

---

### 4.2 Payment Intent Route (`/api/create-payment-intent/route.ts`)

```typescript
import Stripe from 'stripe'               // ~2MB unminified
import prisma from '@/lib/prisma'         // ~500KB+
import { FormData } from '@/lib/form-storage'
```

**Heavy Dependencies:**
- `Stripe` SDK (~2MB source, ~400KB minified)
- `Prisma Client` (~500KB+ with all models)

**Impact:** **HIGH** - Critical payment path has 900KB+ of dependencies

---

### 4.3 Webhook Route (`/api/webhooks/stripe-prod/route.ts`)

```typescript
import Stripe from 'stripe'                          // ~2MB unminified
import prisma from '@/lib/prisma'                    // ~500KB+
import { sendPaymentConfirmationEmail } from '@/lib/email'
```

**Heavy Dependencies Chain:**
- `Stripe` SDK (~2MB)
- `Prisma Client` (~500KB+)
- `@/lib/email` → `@react-email/render` (~200KB) + `resend` (~50KB)

**Impact:** **CRITICAL** - Webhook handler is time-sensitive (must respond <5s) but loads 3MB+ of dependencies

---

### 4.4 Price Route (`/api/get-price/route.ts`)

```typescript
import Stripe from 'stripe'                          // ~2MB unminified
import { unstable_cache } from 'next/cache'
```

**Heavy Dependencies:**
- `Stripe` SDK (~2MB)

**Impact:** **MEDIUM** - Has 1-hour cache which mitigates cold starts

---

### 4.5 Cron Route (`/api/cron/cleanup-temp-submissions/route.ts`)

```typescript
import prisma from '@/lib/prisma'                    // ~500KB+
import { timingSafeEqual } from 'crypto'
```

**Heavy Dependencies:**
- `Prisma Client` (~500KB+)

**Impact:** **LOW** - Runs hourly, performance not critical

---

## 5. Heavy Library Usage Analysis

### 5.1 @react-pdf/renderer

**Used in:**
- `src/lib/pdf/doctor-note-template.tsx`
- `src/lib/pdf/generate-pdf.tsx`

**Import chain:**
```typescript
// doctor-note-template.tsx
import { Document, Page, Text, View, StyleSheet, Image, Link, Font } from '@react-pdf/renderer'
import { existsSync } from 'fs'
import { join } from 'path'

// generate-pdf.tsx
import { renderToBuffer } from '@react-pdf/renderer'
import { Submission } from '@prisma/client'
import path from 'path'
import fs from 'fs'
```

**Size:** ~1.5MB unminified (~300KB minified)

**Where it's loaded:**
- `src/app/admin/actions.ts` (line 16): `import { generateDoctorNotePDF, generatePDFFilename } from '@/lib/pdf/generate-pdf'`

**Impact:** **CRITICAL** - The admin actions file is a Server Action that imports PDF generation at the top level, meaning EVERY admin page request loads the entire @react-pdf/renderer library

---

### 5.2 @fontsource/plus-jakarta-sans

**Used in:**
- `src/lib/pdf/doctor-note-template.tsx`

**Import:**
```typescript
Font.register({
  family: 'Plus Jakarta Sans',
  fonts: [
    {
      src: join(process.cwd(), 'node_modules', '@fontsource', 'plus-jakarta-sans', 'files', 'plus-jakarta-sans-latin-400-normal.woff'),
      fontWeight: 'normal',
    },
    // ...
  ],
})
```

**Size:** ~200KB (font files)

**Impact:** **MEDIUM** - Font files are loaded at module initialization time in the PDF template

---

### 5.3 date-fns / date-fns-tz

**Used in 10 files:**
- Admin components (MaybePortalTabs, MonthlyLimitWarning)
- Utility files (date-validators, age-validators, admin-utils)
- Form pages (absence-dates, review)

**Size:** ~100KB (tree-shakeable, but only if imported granularly)

**Current imports:**
```typescript
// ❌ BAD - imports entire library
import { format } from 'date-fns'
import { formatInTimeZone } from 'date-fns-tz'
```

**Impact:** **MEDIUM** - Used in multiple client and server components

---

### 5.4 bcryptjs

**Used in:**
- `src/lib/auth.ts`

**Size:** ~120KB

**Import chain:**
```typescript
import bcrypt from "bcryptjs"
```

**Impact:** **HIGH** - Loaded by Better Auth, which is imported by `/api/auth/[...all]/route.ts` and transitively by all admin pages that check authentication

---

### 5.5 Prisma Client

**Used everywhere:**
- All API routes
- Admin actions
- Webhook handler

**Size:** ~500KB+ (varies by schema size)

**Impact:** **HIGH** - Core dependency, hard to optimize but can be lazy-loaded in some cases

---

## 6. Critical Bloat Sources

### 6.1 Admin Actions File (HIGHEST PRIORITY)

**File:** `src/app/admin/actions.ts`

**Top-level imports:**
```typescript
'use server'

import { Prisma, SubmissionStatus } from '@prisma/client'
import { auth } from '@/lib/auth'              // → bcryptjs (120KB)
import prisma from '@/lib/prisma'              // → Prisma Client (500KB+)
import Stripe from 'stripe'                     // → Stripe SDK (2MB)
import { sendDenialEmail, sendApprovalEmail } from '@/lib/email'  // → @react-email/render (200KB)
import { generateDoctorNotePDF, generatePDFFilename } from '@/lib/pdf/generate-pdf'  // → @react-pdf/renderer (1.5MB)
```

**Total estimated bundle:** ~4.3MB of dependencies loaded for EVERY Server Action call

**Used by:**
- Admin review page
- Admin dashboard
- Admin approval workflow

**Impact:** **CRITICAL** - This is the single biggest bloat source. Every time an admin page calls a Server Action (even just to fetch submissions), it loads 4.3MB of dependencies.

---

### 6.2 Email Module

**File:** `src/lib/email.ts`

**Top-level imports:**
```typescript
import { Resend } from 'resend'                    // ~50KB
import { render } from '@react-email/render'       // ~200KB
import DenialEmail from '@/emails/DenialEmail'     // React Email component
import ApprovalEmail from '@/emails/ApprovalEmail'
import PaymentConfirmationEmail from '@/emails/PaymentConfirmationEmail'
```

**Total:** ~250KB + email templates

**Impact:** **HIGH** - Loaded by admin actions and webhook handler

---

## 7. Recommendations

### Priority 1: Move PDF Generation to Dynamic Import (CRITICAL)

**Problem:** `src/app/admin/actions.ts` imports PDF generation at the top level, loading 1.5MB for every admin request.

**Solution:** Use dynamic imports for PDF generation:

```typescript
// ❌ BEFORE
import { generateDoctorNotePDF, generatePDFFilename } from '@/lib/pdf/generate-pdf'

// ✅ AFTER - only load when actually approving
const { generateDoctorNotePDF, generatePDFFilename } = await import('@/lib/pdf/generate-pdf')
```

**Impact:** Reduces admin action bundle by ~1.5MB

---

### Priority 2: Add `output: 'standalone'` to next.config.ts

```typescript
const nextConfig: NextConfig = {
  output: 'standalone',  // ← ADD THIS
  turbopack: {
    root: __dirname,
  },
  // ...
}
```

**Impact:** Optimizes serverless function size by ~30-50%

---

### Priority 3: Lazy Load Stripe SDK Where Possible

**Problem:** Stripe SDK is loaded in 4 API routes, adding 2MB to each.

**Solution:** Stripe is already a dependency, but ensure it's tree-shaken:

```typescript
// ✅ Good - tree-shaken
import Stripe from 'stripe'
const stripe = new Stripe(key, { apiVersion: '2025-10-29.clover' })

// ❌ Don't do this
import * as StripeAll from 'stripe'
```

**Note:** Stripe SDK is hard to optimize further since it's needed immediately in payment routes.

---

### Priority 4: Optimize date-fns Imports

**Problem:** Multiple components import from date-fns without tree-shaking.

**Solution:** Use granular imports:

```typescript
// ❌ BEFORE
import { format } from 'date-fns'

// ✅ AFTER
import format from 'date-fns/format'
```

**Impact:** Reduces date-fns bundle from ~100KB to ~20KB per function

---

### Priority 5: Remove Global Environment Validation

**Problem:** `src/app/layout.tsx` imports `@/lib/env` which runs validation on every request.

**Solution:** Move validation to build-time or startup-time only:

```typescript
// In next.config.ts or a separate initialization file
if (typeof window === 'undefined' && !process.env.SKIP_ENV_VALIDATION) {
  await import('./src/lib/env')
}
```

**Impact:** Minor reduction in cold start time

---

### Priority 6: Add Bundle Analyzer

Add to `package.json`:

```json
{
  "scripts": {
    "analyze": "ANALYZE=true next build"
  },
  "devDependencies": {
    "@next/bundle-analyzer": "^16.0.3"
  }
}
```

Update `next.config.ts`:

```typescript
import bundleAnalyzer from '@next/bundle-analyzer'

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
})

export default withBundleAnalyzer(nextConfig)
```

---

## 8. Summary Table

| Issue | Impact | Estimated Size | Priority | Fix Complexity |
|-------|--------|----------------|----------|----------------|
| Admin actions imports @react-pdf/renderer globally | CRITICAL | 1.5MB | P1 | Low (dynamic import) |
| No `output: 'standalone'` | HIGH | 30-50% bloat | P2 | Trivial |
| Stripe SDK in 4 routes | HIGH | 2MB × 4 | P3 | Hard (required) |
| Email rendering in admin/webhook | MEDIUM | 250KB | P4 | Medium (dynamic import) |
| date-fns non-granular imports | MEDIUM | ~80KB/route | P4 | Low (import fix) |
| Font loading in PDF template | LOW | 200KB | P5 | Medium (lazy load) |
| Global env validation | LOW | <10KB | P6 | Low (move to build) |

**Total potential savings:** ~2-3MB per serverless function

---

## 9. Implementation Priority

### Immediate (Today)
- Add `output: 'standalone'` to `next.config.ts`
- Dynamic import PDF generation in `src/app/admin/actions.ts`

### This Week
- Fix date-fns imports across codebase
- Add bundle analyzer

### Next Sprint
- Consider splitting admin actions into separate files
- Optimize email rendering with dynamic imports

---

## 10. Expected Results

**Before:**
- Admin routes: 28.1 MB
- API routes: 24.5 MB

**After (estimated):**
- Admin routes: ~10-12 MB (~60% reduction)
- API routes: ~18-20 MB (~20% reduction)

**Benefits:**
- Faster cold starts on Vercel
- Lower deployment costs
- Better user experience (faster admin portal)
- Improved webhook reliability (faster response times)
