# Production Roadmap - Online Doctor's Note

**Last Updated**: November 15, 2025
**Production Readiness Score**: 7.5/10

This document outlines remaining production improvements needed before public launch and scaling.

---

## ✅ Recently Completed

- [x] **Price Caching** - Added 1-hour cache to `/api/get-price` route (Nov 15, 2025)
- [x] **Webhook Performance** - Non-blocking email + cache revalidation (Nov 14, 2025)
- [x] **Webhook Resilience** - Event filtering + age validation + 2-tier fallback (Nov 14, 2025)
- [x] **Prisma Accelerate** - 40x faster database operations (Nov 14, 2025)
- [x] **Admin Views** - Approved/Denied submission views with visual confirmation (Nov 15, 2025)

---

## 🔴 CRITICAL (Required Before Public Launch)

### 1. Rate Limiting (HIGH PRIORITY - Security Risk)

**Issue**: No rate limiting on payment endpoints - vulnerable to DDoS attacks and API quota exhaustion.

**Impact**:
- Users could spam payment intent creation
- Stripe API quota could be exhausted
- Server costs could spike
- Service could become unavailable

**Solution**: Implement rate limiting with Upstash Redis

**Implementation**:

1. **Install dependencies**:
```bash
npm install @upstash/ratelimit @upstash/redis
```

2. **Sign up for Upstash** (free tier: 10k requests/day):
   - Go to https://console.upstash.com
   - Create Redis database
   - Copy `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`

3. **Add to `.env.local`**:
```env
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxx
```

4. **Create middleware** (`src/middleware.ts`):
```typescript
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

// Rate limiters for different endpoints
const paymentIntentLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '10 m'), // 10 requests per 10 minutes
  analytics: true,
  prefix: 'ratelimit:payment-intent',
})

const verifyPaymentLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(15, '5 m'), // 15 requests per 5 minutes
  analytics: true,
  prefix: 'ratelimit:verify-payment',
})

export async function middleware(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'

  // Rate limit payment intent creation
  if (request.nextUrl.pathname === '/api/create-payment-intent') {
    const { success, limit, reset, remaining } = await paymentIntentLimiter.limit(ip)

    if (!success) {
      return NextResponse.json(
        {
          error: 'Too many payment attempts. Please try again later.',
          retryAfter: Math.ceil((reset - Date.now()) / 1000),
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': limit.toString(),
            'X-RateLimit-Remaining': remaining.toString(),
            'X-RateLimit-Reset': reset.toString(),
            'Retry-After': Math.ceil((reset - Date.now()) / 1000).toString(),
          },
        }
      )
    }
  }

  // Rate limit payment verification
  if (request.nextUrl.pathname === '/api/verify-payment') {
    const { success, limit, reset, remaining } = await verifyPaymentLimiter.limit(ip)

    if (!success) {
      return NextResponse.json(
        {
          error: 'Too many verification attempts. Please try again later.',
          retryAfter: Math.ceil((reset - Date.now()) / 1000),
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': limit.toString(),
            'X-RateLimit-Remaining': remaining.toString(),
            'X-RateLimit-Reset': reset.toString(),
            'Retry-After': Math.ceil((reset - Date.now()) / 1000).toString(),
          },
        }
      )
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: '/api/:path*',
}
```

5. **Update `.env.example`**:
```env
# Rate Limiting (Upstash Redis)
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxx
```

**Testing**:
- Use Postman or curl to send 11 requests to `/api/create-payment-intent`
- Verify 11th request returns 429 status code
- Wait 10 minutes and verify requests work again

**Files to modify**:
- Create `src/middleware.ts`
- Update `.env.example`

**Estimated effort**: 2 hours

---

### 2. Error Tracking with Sentry (HIGH PRIORITY - Observability)

**Issue**: No error tracking or monitoring - you're flying blind in production.

**Impact**:
- Can't see production errors in real-time
- No stack traces for debugging
- No alerts when things break
- Poor customer support (can't diagnose issues)

**Solution**: Integrate Sentry for error tracking and monitoring

**Implementation**:

1. **Sign up for Sentry** (free tier: 5k errors/month):
   - Go to https://sentry.io/signup/
   - Create new Next.js project
   - Copy DSN

2. **Install Sentry**:
```bash
npx @sentry/wizard@latest -i nextjs
```

3. **Add to `.env.local`**:
```env
NEXT_PUBLIC_SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
SENTRY_AUTH_TOKEN=xxx
```

4. **Update API routes to capture errors**:

Example for `src/app/api/create-payment-intent/route.ts`:
```typescript
import * as Sentry from '@sentry/nextjs'
import { randomUUID } from 'crypto'

export async function POST(request: NextRequest) {
  const requestId = randomUUID()

  try {
    // ... existing code ...
  } catch (error) {
    // Capture error in Sentry with context
    Sentry.captureException(error, {
      tags: {
        endpoint: 'create-payment-intent',
        requestId,
      },
      extra: {
        formData: body.formData?.email, // Don't log full PII
      },
    })

    console.error(`[${requestId}] Unexpected error:`, error)
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.', requestId },
      { status: 500 }
    )
  }
}
```

Apply similar changes to:
- `src/app/api/verify-payment/route.ts`
- `src/app/api/webhooks/stripe/route.ts`
- `src/app/admin/actions.ts`

5. **Configure alerts**:
   - Set up Slack/Email alerts for critical errors
   - Create alert rules for high error rates
   - Set up performance monitoring thresholds

**Files to modify**:
- All API route files
- `src/app/admin/actions.ts`
- Sentry config files (created by wizard)

**Estimated effort**: 3 hours

---

## 🟡 HIGH PRIORITY (Implement Within 2 Weeks)

### 3. Input Validation on verify-payment

**Issue**: No validation that payment intent ID is a valid Stripe format.

**Implementation**:

Update `src/app/api/verify-payment/route.ts`:
```typescript
import { z } from 'zod'

const VerifyPaymentSchema = z.object({
  paymentIntentId: z.string().regex(/^pi_[a-zA-Z0-9]+$/, 'Invalid payment intent ID format'),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate input
    const validation = VerifyPaymentSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid payment intent ID', details: validation.error.format() },
        { status: 400 }
      )
    }

    const { paymentIntentId } = validation.data

    // ... rest of existing code
  } catch (error) {
    // ...
  }
}
```

**Files to modify**: `src/app/api/verify-payment/route.ts`

**Estimated effort**: 30 minutes

---

### 4. Performance Monitoring

**Issue**: No visibility into API response times, slow queries, or performance bottlenecks.

**Solution**: Install Vercel Speed Insights (easiest) or OpenTelemetry (advanced)

**Implementation (Vercel Speed Insights)**:

1. **Install**:
```bash
npm install @vercel/speed-insights
```

2. **Update layout** (`src/app/layout.tsx`):
```typescript
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Analytics />
        <SpeedInsights /> {/* Add this */}
      </body>
    </html>
  )
}
```

3. **View metrics** in Vercel dashboard under "Speed Insights"

**Files to modify**: `src/app/layout.tsx`, `package.json`

**Estimated effort**: 15 minutes

---

## 🟢 MEDIUM PRIORITY (Implement Within 1 Month)

### 5. API Timeout Configuration

**Issue**: No explicit timeout configuration - could hit Vercel limits under load.

**Implementation**:

Add to all API routes:
```typescript
// src/app/api/create-payment-intent/route.ts
export const maxDuration = 30 // 30 seconds (requires Vercel Pro plan)
// For Hobby plan, use:
// export const maxDuration = 10
```

Apply to:
- `src/app/api/create-payment-intent/route.ts`
- `src/app/api/verify-payment/route.ts`
- `src/app/api/webhooks/stripe/route.ts`

**Estimated effort**: 15 minutes

---

### 6. Request ID Tracking

**Issue**: Difficult to trace requests across logs for debugging.

**Implementation**:

Update all API routes to include request IDs:
```typescript
import { randomUUID } from 'crypto'

export async function POST(request: NextRequest) {
  const requestId = randomUUID()

  try {
    console.log(`[${requestId}] Request started`)

    // ... existing code ...

    return NextResponse.json(
      { /* response data */ },
      { headers: { 'X-Request-ID': requestId } }
    )
  } catch (error) {
    console.error(`[${requestId}] Error:`, error)
    return NextResponse.json(
      { error: 'Error message', requestId },
      { status: 500 }
    )
  }
}
```

**Files to modify**: All API routes

**Estimated effort**: 1 hour

---

### 7. Webhook Event Persistence

**Issue**: No audit trail for webhook events - can't replay or debug historical issues.

**Implementation**:

1. **Update Prisma schema** (`prisma/schema.prisma`):
```prisma
model WebhookEvent {
  id              String   @id @default(uuid())
  stripeEventId   String   @unique @map("stripe_event_id")
  eventType       String   @map("event_type")
  processed       Boolean  @default(false)
  processedAt     DateTime? @map("processed_at")
  paymentIntentId String?  @map("payment_intent_id")
  error           String?  @db.Text
  createdAt       DateTime @default(now()) @map("created_at")

  @@index([stripeEventId])
  @@index([eventType])
  @@index([processed])
  @@map("webhook_events")
}
```

2. **Run migration**:
```bash
npx prisma migrate dev --name add_webhook_events
```

3. **Update webhook handler** (`src/app/api/webhooks/stripe/route.ts`):
```typescript
// Log event to database (non-blocking)
prisma.webhookEvent.create({
  data: {
    stripeEventId: event.id,
    eventType: event.type,
    paymentIntentId: paymentIntent.id,
    processed: false,
  },
}).catch((err) => console.warn('Failed to log webhook event:', err))

// ... existing processing logic ...

// Mark as processed
await prisma.webhookEvent.update({
  where: { stripeEventId: event.id },
  data: { processed: true, processedAt: new Date() },
}).catch((err) => console.warn('Failed to update webhook event:', err))
```

**Files to modify**:
- `prisma/schema.prisma`
- `src/app/api/webhooks/stripe/route.ts`

**Estimated effort**: 2 hours

---

### 8. Database Index Optimization

**Issue**: `reviewedAt` queried frequently but not indexed - slow dashboard queries.

**Implementation**:

Update `prisma/schema.prisma`:
```prisma
model Submission {
  // ... existing fields ...

  @@index([reviewedAt])               // Add this
  @@index([status, reviewedAt])       // Composite for filtered date queries
}
```

Then run:
```bash
npx prisma migrate dev --name add_reviewed_at_indexes
```

**Files to modify**: `prisma/schema.prisma`

**Estimated effort**: 15 minutes

---

### 9. Uptime Monitoring

**Issue**: No external monitoring - won't know about outages until customers complain.

**Implementation**:

1. **Sign up for UptimeRobot** (free tier: 50 monitors):
   - Go to https://uptimerobot.com
   - Create HTTP(s) monitor for `https://onlinedoctornote.com`
   - Create keyword monitor checking for "Get Your Doctor's Note"
   - Set check interval to 5 minutes
   - Add alert contacts (email, SMS, Slack)

2. **Create health check endpoint** (`src/app/api/health/route.ts`):
```typescript
import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-10-29.clover',
})

export async function GET() {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`

    // Check Stripe connection
    await stripe.balance.retrieve()

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'up',
        stripe: 'up',
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    )
  }
}
```

3. **Point UptimeRobot at** `https://onlinedoctornote.com/api/health`

**Files to create**: `src/app/api/health/route.ts`

**Estimated effort**: 1 hour

---

### 10. Environment Variable Validation

**Issue**: No runtime validation - missing env vars cause cryptic errors.

**Implementation**:

1. **Create validation file** (`src/lib/env.ts`):
```typescript
import { z } from 'zod'

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url(),
  PRISMA_DATABASE_URL: z.string().url(),

  // Stripe
  STRIPE_SECRET_KEY: z.string().startsWith('sk_'),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().startsWith('pk_'),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_'),
  STRIPE_PRICE_ID: z.string().startsWith('price_'),

  // Email
  RESEND_API_KEY: z.string().startsWith('re_'),
  RESEND_FROM_EMAIL: z.string().email(),

  // Auth
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url(),

  // Cron
  CRON_SECRET: z.string().min(32),

  // Doctor Info
  DOCTOR_NAME: z.string(),
  DOCTOR_CREDENTIALS: z.string(),
  DOCTOR_SIGNATURE_URL: z.string(),

  // Site
  NEXT_PUBLIC_SITE_URL: z.string().url(),
  NODE_ENV: z.enum(['development', 'production', 'test']),

  // Rate Limiting (optional - only if implemented)
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  // Error Tracking (optional - only if implemented)
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
})

export const env = envSchema.parse(process.env)
```

2. **Import early** in `src/lib/prisma.ts`:
```typescript
import { env } from './env' // Validates on import - will fail fast if missing vars
```

**Files to create**: `src/lib/env.ts`
**Files to modify**: `src/lib/prisma.ts`

**Estimated effort**: 1 hour

---

## 🔵 LOW PRIORITY (Nice to Have)

### 11. Structured Error Responses

**Issue**: Client can't differentiate between transient errors (retry) vs permanent errors (don't retry).

**Implementation**:

Define error response type and use consistently:
```typescript
type ErrorResponse = {
  error: string
  code: string
  retryable: boolean
  requestId?: string
}

// Permanent error (don't retry)
return NextResponse.json<ErrorResponse>(
  {
    error: 'Form data is required',
    code: 'MISSING_FORM_DATA',
    retryable: false,
  },
  { status: 400 }
)

// Transient error (retry)
return NextResponse.json<ErrorResponse>(
  {
    error: 'Unable to process your request. Please try again.',
    code: 'DATABASE_ERROR',
    retryable: true,
    requestId,
  },
  { status: 500 }
)
```

**Estimated effort**: 2 hours

---

### 12. Admin Portal Performance Optimization

**Issue**: Admin pages use client-side data fetching - slower than server-side.

**Current**: Admin pages have `'use client'` and fetch data in `useEffect`

**Better**: Convert to Server Components with Suspense

This is a low priority optimization since the admin portal is only used by doctors (low traffic).

**Estimated effort**: 4 hours

---

## 📊 Priority Implementation Order

### Week 1 (CRITICAL)
1. **Day 1-2**: Rate limiting (2 hours)
2. **Day 3-4**: Sentry error tracking (3 hours)
3. **Day 5**: Input validation + timeout configs (1 hour)

### Week 2 (HIGH)
1. **Day 6**: Performance monitoring (15 min)
2. **Day 7**: Request ID tracking (1 hour)
3. **Day 8**: Uptime monitoring + health check (1 hour)
4. **Day 9**: Environment variable validation (1 hour)
5. **Day 10**: Database indexes (15 min)

### Week 3-4 (MEDIUM)
1. **Day 11-12**: Webhook event persistence (2 hours)
2. **Day 13-14**: Structured error responses (2 hours)

---

## 🚀 Pre-Launch Checklist

Before deploying to production:

- [ ] **Rate limiting** implemented and tested with load testing
- [ ] **Sentry** error tracking configured and tested
- [ ] **Input validation** on all API endpoints
- [ ] **Performance monitoring** installed (Vercel Speed Insights)
- [ ] **Uptime monitoring** configured (UptimeRobot)
- [ ] **Environment variables** validated at startup
- [ ] **Database indexes** optimized
- [ ] **Health check endpoint** created and monitored
- [ ] **Timeout configurations** added to all API routes
- [ ] **Request ID tracking** in all logs
- [ ] **Load testing** performed (100+ concurrent users)
- [ ] **Security audit** completed (OWASP top 10)
- [ ] **Monitoring alerts** configured (Sentry, UptimeRobot)
- [ ] **Documentation** updated (README, API docs)
- [ ] **Incident response plan** documented
- [ ] **Backup strategy** verified

---

## 💰 Cost Estimates

### Required Services (Free Tiers Available)

- **Upstash Redis**: Free tier = 10k requests/day (sufficient for startup)
- **Sentry**: Free tier = 5k errors/month (sufficient for startup)
- **UptimeRobot**: Free tier = 50 monitors, 5-min intervals (sufficient)
- **Vercel Speed Insights**: Free with Vercel deployment

**Total Monthly Cost**: $0 on free tiers

### When to Upgrade

- **Upstash**: Upgrade when >10k requests/day (~$10/month for 100k)
- **Sentry**: Upgrade when >5k errors/month (~$26/month for 50k)
- **Vercel**: Consider Pro plan if need >10s function timeout (~$20/month)

---

## 📝 Notes

### Cache Invalidation

If you change pricing in Stripe Dashboard and need to invalidate the cache immediately:

```typescript
import { revalidateTag } from 'next/cache'

// In admin dashboard or API route:
revalidateTag('stripe-price') // Forces fresh fetch on next request
```

### Testing Rate Limiting Locally

You can test rate limiting with curl:
```bash
# Send 11 requests quickly
for i in {1..11}; do
  curl -X POST http://localhost:3000/api/create-payment-intent \
    -H "Content-Type: application/json" \
    -d '{"formData": {"email": "test@example.com", ...}}'
done
```

The 11th request should return 429 status code.

---

## 🔗 Helpful Resources

- [Upstash Redis Rate Limiting](https://upstash.com/docs/redis/sdks/ratelimit-ts/overview)
- [Sentry Next.js Integration](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
- [Next.js Caching Guide](https://nextjs.org/docs/app/building-your-application/caching)
- [Vercel Speed Insights](https://vercel.com/docs/speed-insights)
- [UptimeRobot Documentation](https://uptimerobot.com/help/)
- [Stripe Webhook Best Practices](https://stripe.com/docs/webhooks/best-practices)

---

**Last reviewed**: November 15, 2025
**Next review date**: December 1, 2025
