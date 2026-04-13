# Local Development & Testing Guide

This guide explains how to set up a fully isolated local development environment for testing the Online Doctor's Note application.

## Overview

The local development setup uses:

- **Prisma Dev (PGlite)**: Local PostgreSQL-compatible database running entirely on localhost
- **Stripe Test Mode**: Test API keys that only process fake payments
- **Resend Test Mode**: Email testing (sends only to verified email)

**Important**: This setup is 100% isolated from production. No production data is accessed or modified.

## Prerequisites

- Node.js 18+
- Stripe CLI installed (`brew install stripe/stripe-cli/stripe`)
- A Stripe account with test API keys
- A Resend account (optional, for email testing)

## Quick Start

```bash
# 1. Start local database
npm run db:local:detach

# 2. Backup production .env and use local config
mv .env .env.production.backup

# 3. Start dev server
npm run dev

# 4. In another terminal, start Stripe webhook forwarding
stripe listen --forward-to localhost:3000/api/webhooks/stripe-prod3
```

## Step-by-Step Setup

### Step 1: Install Dependencies

```bash
npm install
```

The `@prisma/dev` package is already included for local database testing.

### Step 2: Start Local Database

```bash
npm run db:local:detach
```

This starts a PGlite-based PostgreSQL server on localhost. The output shows the connection URLs:

- **TCP**: `postgres://postgres:postgres@localhost:51214/template1`
- **Accelerate Proxy**: `prisma+postgres://localhost:51213/?api_key=...`

**Note**: The ports may vary. Check the output for exact URLs.

### Step 3: Configure Environment

Create or update `.env.local` with local settings:

```env
# Site
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Database - Use the Accelerate proxy URL from Step 2
DATABASE_URL="prisma+postgres://localhost:51213/?api_key=..."
PRISMA_DATABASE_URL="prisma+postgres://localhost:51213/?api_key=..."

# Stripe Test Keys (from https://dashboard.stripe.com/test/apikeys)
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_PRICE_ID=price_...
STRIPE_WEBHOOK_SECRET=whsec_...  # From Stripe CLI (Step 6)

# Better Auth
BETTER_AUTH_SECRET=local-dev-secret-key-minimum-32-chars-long
BETTER_AUTH_URL=http://localhost:3000

# Email (Resend)
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=onboarding@resend.dev
RESEND_WEBHOOK_SECRET=local-testing-webhook-secret

# Doctor Info
DOCTOR_NAME="Dr. Test Doctor"
DOCTOR_CREDENTIALS="MD"
DOCTOR_SIGNATURE_URL="/images/doctor-signature.png"

# Cron
CRON_SECRET=local-cron-secret-for-testing

# Environment
NODE_ENV=development
```

### Step 4: Backup Production Config

**Critical**: Move the production `.env` file to prevent accidentally connecting to production:

```bash
mv .env .env.production.backup
```

### Step 5: Create Admin User

Run the script to create a local admin account:

```bash
PRISMA_DATABASE_URL="<your-local-prisma-url>" npx tsx scripts/create-doctor-user.ts
```

This creates:

- **Email**: `admin@local.test`
- **Password**: `password123`

### Step 6: Start Stripe Webhook Forwarding

In a separate terminal:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe-prod3
```

Copy the webhook secret (`whsec_...`) and add it to `.env.local` as `STRIPE_WEBHOOK_SECRET`.

### Step 7: Start Development Server

```bash
npm run dev
```

The app is now available at http://localhost:3000

## Testing Payments

Use Stripe test card numbers:

- **Success**: `4242 4242 4242 4242`
- **Decline**: `4000 0000 0000 0002`
- **Requires Auth**: `4000 0025 0000 3155`

Expiry: Any future date | CVC: Any 3 digits

## Admin Portal

Access the admin portal at http://localhost:3000/admin/login

Login with:

- **Email**: `admin@local.test`
- **Password**: `password123`

## Database Management

### View Data

```bash
npx prisma studio
```

Opens a visual database browser at http://localhost:5555

### List Running Instances

```bash
npm run db:local:ls
```

### Stop Database

```bash
npm run db:local:stop
```

### Query Directly

```bash
PGPASSWORD=postgres PGSSLMODE=disable psql -h localhost -p 51214 -U postgres -d template1
```

## Common Issues

### "Can't reach database server"

The local database stopped. Restart it:

```bash
npm run db:local:detach
```

### "Environment variable not found: PRISMA_DATABASE_URL"

Both `DATABASE_URL` and `PRISMA_DATABASE_URL` must be set in `.env.local`.

### Seeing Production Data Locally

The production `.env` is still present. Move it:

```bash
mv .env .env.production.backup
```

### Login Not Working

1. Ensure the local database is running
2. Check that admin user was created
3. Password must be 8+ characters (use `password123`)

### Webhook Returns 404

Check the webhook endpoint path. It should be:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe-prod3
```

## Cleanup

When done with local testing, restore production config:

```bash
mv .env.production.backup .env
npm run db:local:stop
```

## Architecture Notes

### Why Two Database URLs?

- `DATABASE_URL`: Used by Prisma CLI for migrations
- `PRISMA_DATABASE_URL`: Used by the app runtime (schema.prisma references this)

Both must point to the same local database for the app to work.

### Prisma Dev Accelerate Proxy

Prisma Dev provides a local Accelerate-compatible proxy (port 51213) that wraps the actual PostgreSQL database (port 51214). The app uses the proxy URL because it includes the `withAccelerate()` extension.

### Data Persistence

By default, Prisma Dev runs in **stateless** mode - data is wiped when the server restarts. For persistent data, use:

```bash
npx prisma dev --persistence=stateful
```

## npm Scripts Reference

| Script                    | Description                       |
| ------------------------- | --------------------------------- |
| `npm run db:local`        | Start local DB (interactive)      |
| `npm run db:local:detach` | Start local DB (background)       |
| `npm run db:local:stop`   | Stop local DB                     |
| `npm run db:local:ls`     | List running DB instances         |
| `npm run dev`             | Start Next.js dev server          |
| `npm test`                | Run tests (uses separate test DB) |

## Safety Checklist

Before testing locally, verify:

- [ ] `.env` is renamed to `.env.production.backup`
- [ ] `.env.local` has `localhost` URLs for database
- [ ] Stripe keys start with `sk_test_` and `pk_test_`
- [ ] Local database is running (`npm run db:local:ls`)

## Automated Test Database

When running `npm test`, Vitest automatically:

1. Starts a fresh Prisma Dev instance (stateless)
2. Runs all tests against the local database
3. Shuts down the database when done

This is configured in `vitest.global-setup.ts` and requires no manual setup.
