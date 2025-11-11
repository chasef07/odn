# Stripe Price ID Migration Guide

Guide for migrating from hardcoded payment amounts to Stripe Price IDs for more flexible pricing.

## Table of Contents

- [Overview](#overview)
- [Current Implementation](#current-implementation)
- [Why Migrate?](#why-migrate)
- [Migration Approaches](#migration-approaches)
- [Step-by-Step Migration](#step-by-step-migration)
- [Testing](#testing)
- [Rollback Plan](#rollback-plan)
- [Future Enhancements](#future-enhancements)

## Overview

### Current State

The application currently uses a **hardcoded payment amount** of $24.95 (2495 cents) configured via environment variables:

```env
NEXT_PUBLIC_PAYMENT_AMOUNT=2495
```

This approach works but has limitations:
- Can't easily change pricing without redeployment
- No built-in support for multiple products
- Can't offer discounts or promotions easily
- Manual refund calculation required

### Future State

Migrating to **Stripe Price IDs** provides:
- Centralized pricing in Stripe Dashboard
- Multiple pricing tiers support
- Built-in discounts and coupons
- Easier tax calculation
- Better reporting and analytics
- No redeployment needed for price changes

## Current Implementation

### Where Amounts Are Defined

1. **Environment Variables** (`.env.local`):
   ```env
   NEXT_PUBLIC_PAYMENT_AMOUNT=2495  # Client-side
   ```

2. **Payment Intent Creation** (`src/app/api/create-payment-intent/route.ts`):
   ```typescript
   const paymentIntent = await stripe.paymentIntents.create({
     amount: 2495,  // Hardcoded
     currency: 'usd',
     automatic_payment_methods: { enabled: true },
     metadata: {
       productName: 'Online Doctor\'s Note',
       productDescription: 'Medical excuse note for work or school',
       service: 'online-doctors-note',
     },
   })
   ```

3. **Client-Side Display** (`src/app/review/page.tsx`):
   ```typescript
   const paymentAmount = process.env.NEXT_PUBLIC_PAYMENT_AMOUNT || '2495'
   const formattedAmount = new Intl.NumberFormat('en-US', {
     style: 'currency',
     currency: 'USD',
   }).format(Number(paymentAmount) / 100)
   ```

4. **Refund Processing** (`src/components/admin/SubmissionsList.tsx`):
   ```typescript
   await stripe.refunds.create({
     payment_intent: paymentIntentId,
     // Amount is inferred from payment intent
   })
   ```

### Payment Flow

1. User completes form
2. Client creates payment intent (POST `/api/create-payment-intent`)
3. Server creates Stripe PaymentIntent with hardcoded amount
4. Client shows Stripe Elements with payment amount
5. User submits payment
6. Stripe webhook confirms payment
7. Submission created in database

## Why Migrate?

### Current Limitations

1. **Price Changes Require Deployment**
   - Must update environment variable
   - Must redeploy application
   - Can't A/B test pricing
   - Can't offer time-limited promotions

2. **No Product Catalog**
   - Can't easily add new products (expedited service, bulk discounts)
   - Can't offer tiered pricing
   - Hard to manage different service levels

3. **Manual Refund Handling**
   - Must track original payment amount
   - Can't do partial refunds easily
   - No automatic refund policies

4. **Limited Reporting**
   - Stripe dashboard shows amounts but not products
   - Hard to track specific product performance
   - Can't see pricing trends over time

### Benefits of Migration

1. **Flexible Pricing**
   - Change prices in Stripe Dashboard (no deployment)
   - A/B test different price points
   - Offer promotional pricing
   - Regional pricing support

2. **Product Catalog**
   - Multiple service tiers (Standard, Express, Premium)
   - Add-on products (extra copies, notarization)
   - Subscription options (for frequent users)

3. **Better Analytics**
   - Track revenue by product
   - See most popular products
   - Monitor pricing performance
   - Export detailed reports

4. **Stripe Features**
   - Automatic tax calculation
   - Coupons and discounts
   - Promotional codes
   - Price experiments

## Migration Approaches

### Approach 1: Hybrid (Recommended)

**Keep PaymentIntents, add Price IDs for reference**

**Pros:**
- Minimal code changes
- Keeps existing payment flow
- Easy rollback
- Gradual migration path

**Cons:**
- Still manually create PaymentIntents
- Not using full Stripe product catalog
- Some features limited

**Best for:** Current application with future flexibility

### Approach 2: Full Checkout Sessions

**Replace PaymentIntents with Checkout Sessions**

**Pros:**
- Full Stripe product catalog
- Built-in checkout UI
- Automatic tax, discounts, etc.
- Better Stripe integration

**Cons:**
- Major code refactor required
- Changes payment flow significantly
- Redirects to Stripe-hosted page
- Less UI customization

**Best for:** Future major refactor or new features

## Step-by-Step Migration

### Phase 1: Create Stripe Products (No Code Changes)

This phase sets up Stripe products without changing your application.

#### 1. Create Product in Stripe Dashboard

1. Go to https://dashboard.stripe.com/products
2. Click "Add product"
3. Fill in details:
   - **Name**: "Online Doctor's Note"
   - **Description**: "Professional medical excuse note for work or school"
   - **Image**: Upload doctor's note preview (optional)
   - **Statement descriptor**: "ONLINEDOCTORNOTE"

4. Add pricing:
   - **Price**: $24.95
   - **Billing period**: One time
   - **Currency**: USD
   - Click "Add pricing"

5. Note the Price ID (starts with `price_`)

#### 2. Create Product via Stripe CLI (Alternative)

```bash
# Create product
stripe products create \
  --name="Online Doctor's Note" \
  --description="Professional medical excuse note for work or school"

# Note the product ID (prod_...)

# Create price
stripe prices create \
  --product=prod_XXX \
  --unit-amount=2495 \
  --currency=usd \
  --nickname="Standard Doctor's Note"

# Note the price ID (price_...)
```

#### 3. Add to Environment Variables

```env
# Add to .env.local (keep existing PAYMENT_AMOUNT for now)
STRIPE_PRICE_ID=price_1234567890abcdef
NEXT_PUBLIC_STRIPE_PRICE_ID=price_1234567890abcdef
```

**Don't deploy yet** - this is just preparation.

### Phase 2: Update Code (Hybrid Approach)

#### 1. Update Payment Intent Creation

**File**: `src/app/api/create-payment-intent/route.ts`

**Before:**
```typescript
const paymentIntent = await stripe.paymentIntents.create({
  amount: 2495,
  currency: 'usd',
  automatic_payment_methods: { enabled: true },
  metadata: {
    productName: 'Online Doctor\'s Note',
    productDescription: 'Medical excuse note for work or school',
    service: 'online-doctors-note',
  },
})
```

**After:**
```typescript
// Get price from Stripe (includes amount)
const priceId = process.env.STRIPE_PRICE_ID
if (!priceId) {
  throw new Error('STRIPE_PRICE_ID not configured')
}

const price = await stripe.prices.retrieve(priceId)

const paymentIntent = await stripe.paymentIntents.create({
  amount: price.unit_amount!, // From Stripe Price
  currency: price.currency,
  automatic_payment_methods: { enabled: true },
  metadata: {
    priceId: priceId, // Reference to price
    productId: price.product as string,
    productName: 'Online Doctor\'s Note',
    productDescription: 'Medical excuse note for work or school',
    service: 'online-doctors-note',
  },
})
```

**Benefits:**
- Amount comes from Stripe (single source of truth)
- Can change price in Stripe Dashboard
- Metadata tracks which price was used

#### 2. Update Client-Side Amount Display

**File**: `src/app/review/page.tsx`

**Before:**
```typescript
const paymentAmount = process.env.NEXT_PUBLIC_PAYMENT_AMOUNT || '2495'
const formattedAmount = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
}).format(Number(paymentAmount) / 100)
```

**After (Option A: Keep env var):**
```typescript
// No change needed - env var still works as fallback
const paymentAmount = process.env.NEXT_PUBLIC_PAYMENT_AMOUNT || '2495'
```

**After (Option B: Fetch from Stripe):**
```typescript
// Create new API route to get price
const response = await fetch('/api/get-price')
const { amount, currency } = await response.json()
const formattedAmount = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: currency,
}).format(amount / 100)
```

**Recommendation**: Start with Option A (keep env var) for minimal changes.

#### 3. Create Price Retrieval API (Optional)

**File**: `src/app/api/get-price/route.ts` (new file)

```typescript
import { NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-10-29.clover',
})

export async function GET() {
  try {
    const priceId = process.env.STRIPE_PRICE_ID
    if (!priceId) {
      return NextResponse.json(
        { error: 'Price ID not configured' },
        { status: 500 }
      )
    }

    const price = await stripe.prices.retrieve(priceId)

    return NextResponse.json({
      priceId: price.id,
      amount: price.unit_amount,
      currency: price.currency,
      productId: price.product,
    })
  } catch (error) {
    console.error('Error fetching price:', error)
    return NextResponse.json(
      { error: 'Failed to fetch price' },
      { status: 500 }
    )
  }
}
```

**Benefits:**
- Client can fetch current price dynamically
- No hardcoded amounts in client
- Supports runtime price changes

#### 4. Add Caching (Recommended)

Fetching price on every payment intent is slow. Add caching:

**File**: `src/lib/stripe-cache.ts` (new file)

```typescript
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-10-29.clover',
})

interface CachedPrice {
  amount: number
  currency: string
  timestamp: number
}

const priceCache: Map<string, CachedPrice> = new Map()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export async function getPrice(priceId: string): Promise<CachedPrice> {
  // Check cache
  const cached = priceCache.get(priceId)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached
  }

  // Fetch from Stripe
  const price = await stripe.prices.retrieve(priceId)

  const cachedPrice: CachedPrice = {
    amount: price.unit_amount!,
    currency: price.currency,
    timestamp: Date.now(),
  }

  // Update cache
  priceCache.set(priceId, cachedPrice)

  return cachedPrice
}
```

**Usage in payment intent creation:**

```typescript
import { getPrice } from '@/lib/stripe-cache'

const priceId = process.env.STRIPE_PRICE_ID!
const price = await getPrice(priceId)

const paymentIntent = await stripe.paymentIntents.create({
  amount: price.amount,
  currency: price.currency,
  // ...
})
```

### Phase 3: Testing

#### 1. Unit Tests

**File**: `src/app/api/create-payment-intent/__tests__/route.test.ts`

Update to mock price retrieval:

```typescript
const { mockPricesRetrieve } = vi.hoisted(() => ({
  mockPricesRetrieve: vi.fn(),
}))

vi.mock('stripe', () => ({
  default: class MockStripe {
    prices = {
      retrieve: mockPricesRetrieve,
    }
    paymentIntents = {
      create: mockPaymentIntentsCreate,
    }
  },
}))

// In test
mockPricesRetrieve.mockResolvedValue({
  id: 'price_test123',
  unit_amount: 2495,
  currency: 'usd',
  product: 'prod_test123',
})
```

#### 2. Integration Testing

1. **Test price fetch**:
   ```bash
   curl http://localhost:3000/api/get-price
   ```

2. **Test payment intent creation**:
   - Go through full form flow
   - Verify amount matches Stripe price
   - Check payment succeeds

3. **Test price changes**:
   - Change price in Stripe Dashboard
   - Wait for cache to expire (5 minutes)
   - Create new payment intent
   - Verify new price is used

#### 3. Production Testing

Before launching:

1. Create test price in Stripe
2. Set `STRIPE_PRICE_ID` to test price
3. Run through complete flow with test card
4. Verify all flows work (approval, denial, refund)
5. Switch to production price ID

### Phase 4: Deployment

#### 1. Update Environment Variables

**Production** (Vercel):
```env
STRIPE_PRICE_ID=price_prod123456  # Your production price ID
NEXT_PUBLIC_STRIPE_PRICE_ID=price_prod123456  # If using client fetch
```

**Keep these for backwards compatibility:**
```env
NEXT_PUBLIC_PAYMENT_AMOUNT=2495
```

#### 2. Deploy Changes

```bash
git add .
git commit -m "feat: migrate to Stripe Price IDs"
git push origin main
```

Vercel will auto-deploy.

#### 3. Verify Production

- [ ] Payment intent creates with correct amount
- [ ] Amount matches Stripe Dashboard price
- [ ] Metadata includes priceId
- [ ] Full payment flow works
- [ ] Refunds work correctly

### Phase 5: Cleanup (Optional)

After migration is stable (2-4 weeks):

1. Remove `NEXT_PUBLIC_PAYMENT_AMOUNT` from client code
2. Remove hardcoded amounts from API routes
3. Update documentation
4. Remove old environment variables

## Testing

### Test Checklist

- [ ] **Price fetch works**
  - [ ] API returns correct price
  - [ ] Caching works (fast subsequent requests)
  - [ ] Cache expires correctly (5 min)

- [ ] **Payment intent creation**
  - [ ] Creates with price from Stripe
  - [ ] Metadata includes priceId
  - [ ] Amount is correct

- [ ] **Full payment flow**
  - [ ] User can complete payment
  - [ ] Correct amount charged
  - [ ] Webhook processes correctly
  - [ ] Submission created

- [ ] **Price changes**
  - [ ] Change price in Stripe
  - [ ] New payments use new price
  - [ ] Old payments unaffected

- [ ] **Error handling**
  - [ ] Missing STRIPE_PRICE_ID handled
  - [ ] Invalid price ID handled
  - [ ] Stripe API errors handled
  - [ ] Cache errors handled

### Test Scenarios

#### Scenario 1: Normal Payment

1. User completes form
2. System fetches current price ($24.95)
3. Payment intent created with correct amount
4. User pays successfully
5. Verify charge is $24.95 in Stripe

#### Scenario 2: Price Change

1. Change price in Stripe to $29.95
2. Wait for cache to expire (5 min)
3. New user completes form
4. Verify payment intent uses $29.95
5. Old PaymentIntents still use $24.95

#### Scenario 3: Multiple Products (Future)

1. Create second price (Express service: $39.95)
2. Update form to let users choose
3. Pass priceId to payment intent creation
4. Verify correct price used

## Rollback Plan

If migration causes issues:

### Immediate Rollback

1. **Revert environment variables** (Vercel):
   - Remove `STRIPE_PRICE_ID`
   - Keep `NEXT_PUBLIC_PAYMENT_AMOUNT=2495`

2. **Revert code changes**:
   ```bash
   git revert HEAD
   git push origin main
   ```

3. **Verify old flow works**:
   - Test payment with hardcoded amount
   - Confirm no Stripe API calls for price

### Partial Rollback

If price fetching is slow but migration works:

1. **Keep price ID in metadata** (for tracking)
2. **Use hardcoded amount** (for speed)
3. **Investigate caching** (increase TTL or use Redis)

### Data Migration Rollback

If you need to revert after many payments:

- Old payments still have amount in PaymentIntent
- New payments have priceId in metadata
- Both can coexist - no data loss
- Refunds work for both old and new payments

## Future Enhancements

### Multiple Products

Once migration is complete, easily add new products:

**Example: Express Service**

1. Create new product in Stripe
   - Name: "Express Doctor's Note"
   - Price: $39.95
   - Delivery: Within 1 hour

2. Update form to show product selection:
   ```typescript
   const products = [
     { id: 'price_standard', name: 'Standard', price: 24.95, delivery: '24 hours' },
     { id: 'price_express', name: 'Express', price: 39.95, delivery: '1 hour' },
   ]
   ```

3. Pass selected priceId to payment intent:
   ```typescript
   const priceId = formData.selectedPriceId
   const price = await getPrice(priceId)
   ```

### Subscriptions

For frequent users, offer subscription pricing:

**Example: Monthly Plan**

```bash
# Create recurring price
stripe prices create \
  --product=prod_XXX \
  --unit-amount=4995 \
  --currency=usd \
  --recurring interval=month \
  --nickname="Monthly Subscription (2 notes/month)"
```

Benefits:
- Predictable revenue
- Customer retention
- Automatic renewals

### Coupons & Discounts

With Price IDs, easily offer discounts:

```typescript
// Create 20% off coupon
stripe coupons create \
  --percent-off=20 \
  --duration=once \
  --name="WELCOME20"

// Apply to payment
const paymentIntent = await stripe.paymentIntents.create({
  amount: price.unit_amount!,
  currency: price.currency,
  discounts: [{ coupon: 'WELCOME20' }],
})
```

### Dynamic Pricing

Adjust pricing based on:
- Time of day (night/weekend premium)
- Demand (surge pricing)
- Customer segments (student discounts)
- Geographic location (regional pricing)

All without code changes - just create different prices in Stripe!

### Tax Automation

Enable Stripe Tax for automatic tax calculation:

```typescript
const paymentIntent = await stripe.paymentIntents.create({
  amount: price.unit_amount!,
  currency: price.currency,
  automatic_tax: { enabled: true },
  customer: customerId, // Required for tax
})
```

Stripe handles:
- Sales tax calculation by location
- Tax rates updates
- Tax reporting
- Compliance

## Conclusion

### Summary

- **Phase 1**: Create Stripe Products (no code changes)
- **Phase 2**: Update code to use Price IDs (hybrid approach)
- **Phase 3**: Test thoroughly
- **Phase 4**: Deploy to production
- **Phase 5**: Optional cleanup

### Timeline

- **Preparation**: 1-2 hours (create products, test locally)
- **Development**: 4-6 hours (update code, add caching, write tests)
- **Testing**: 2-4 hours (integration testing, edge cases)
- **Deployment**: 1 hour (deploy, verify, monitor)
- **Total**: 1-2 days

### Recommendation

**Start with Hybrid Approach:**
- Low risk (easy rollback)
- Minimal code changes
- Keeps existing flow
- Enables future enhancements

**Consider Full Checkout Sessions:**
- If adding subscriptions
- If building multi-product catalog
- If needing advanced Stripe features
- Plan for 1-2 week refactor

### Questions?

- Check Stripe documentation: https://stripe.com/docs/products-prices/overview
- Review Stripe Checkout: https://stripe.com/docs/payments/checkout
- Test in Stripe Dashboard: https://dashboard.stripe.com/test/products

---

This guide is optional and for future reference when you're ready to scale pricing options.
