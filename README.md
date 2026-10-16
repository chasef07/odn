# Online Doctor's Note

A Next.js app that sells doctor's notes for work or school. A patient fills in a multi-step intake and pays with Stripe. A doctor then approves or denies the request in the admin portal. An approval emails the patient a PDF note with a QR code that opens a public verification page.

## Stack

- Next.js 16 App Router, React 19 and TypeScript in strict mode
- PostgreSQL through `pg`, with numbered SQL migrations in `src/db/migrations/`
- Better Auth for admin login. Public sign-up is disabled.
- Stripe for payments, Resend for email and Telnyx for SMS
- `@react-pdf/renderer` for the note PDF
- Vitest and Testing Library for tests

## How a request moves

1. The intake pages run in the order of `INTAKE_STEPS` in `src/lib/intake.ts`, which ends at `/review`. The table also drives the progress bar, the back links and `robots.ts`. `/guardian-info` shows only when the note is for someone else, and `/symptoms` is skipped for a doctor's appointment or an other reason.
2. The patient continues to `/approved`, then pays on `/payment`.
3. `src/app/api/create-payment-intent` parses the form with `parseIntake` from `src/lib/intake.ts`, which runs the same zod schemas the form steps use from `src/lib/validation-schemas.ts`. Data that cannot be stored is rejected with a 400. A rule failure, such as an under-18 patient, is logged and the payment proceeds unless `INTAKE_VALIDATION_ENFORCED=true`, which turns the log into a 400. The route then saves the form as a `TemporarySubmission` and creates the Stripe payment intent.
4. The Stripe webhook at `src/app/api/webhooks/stripe-prod3` turns the paid `TemporarySubmission` into a `Submission`. A paid draft that fails a rule is stored as `MAYBE` for the doctor. Only a draft that cannot be stored returns a retryable 500.
5. A doctor reviews the `Submission` under `/admin`.

## Run it locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Fill in `.env.local` before you start the dev server. `VERIFICATION_BASE_URL` is the host in QR codes and verification links, and it can differ from `NEXT_PUBLIC_SITE_URL`. `BETTER_AUTH_URL` is the app's own origin, so it changes per environment. Generate `CRON_SECRET` with `openssl rand -hex 32` and `BETTER_AUTH_SECRET` with `openssl rand -base64 32`. `src/lib/env.ts` defines every server variable and `src/lib/public-env.ts` the `NEXT_PUBLIC_*` ones. `next build` needs only `NEXT_PUBLIC_SITE_URL` and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`. The server refuses to start while a required variable is missing or invalid, and the error names it. Outbound SMS runs only when `TELNYX_SMS_ENABLED=true`, which then requires `TELNYX_API_KEY` and `TELNYX_FROM_NUMBER`. `npm run db:migrate` applies the migration files to `DATABASE_URL`. Database tests run on PGlite with `npm run test:db`.

To receive Stripe webhooks locally, run `stripe listen --forward-to localhost:3000/api/webhooks/stripe-prod3` and copy the printed `whsec_` value into `STRIPE_WEBHOOK_SECRET`.

Creating an admin account has no supported command today. `scripts/create-doctor-user.ts` creates one from `ADMIN_EMAIL`, `ADMIN_NAME` and `ADMIN_PASSWORD`, but `package.json` has no TypeScript runner for the files in `scripts/`.

## Check your work

`npm run check` runs Prettier, ESLint, the TypeScript compiler on source and test files, the comment check, the doc-reference check and Vitest. CI runs the same command. `AGENTS.md` lists each rule and the check that enforces it.

## Deploy

Staging runs on Cloud Run and deploys on every push to `main` through `.github/workflows/deploy-staging.yml`. Production is still served by Vercel from the old repository. `docs/CLOUD_RUN.md` covers deploys, crons and the production cutover. Production migrations run from `.github/workflows/production-migrations.yml`.

## License

Proprietary. All rights reserved.
