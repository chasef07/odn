# Cloud Run

Online Doctor Note runs on Cloud Run in GCP project `acuity-health-prod`
(region `us-east4`) and talks to Cloud SQL instance
`acuity-health-prod:us-east4:onlinedoctornote-db` over the Cloud SQL unix
socket. Production is still served by Vercel from the old
`Data-Buddies-Solutions/onlinedoctornote` repo until the cutover below.

## How a deploy works

`cloudbuild.yaml` runs as service account `odn-deploy` and, for `_ENV=<env>`:

1. Builds the `runtime` target of the `Dockerfile` (Next.js
   `output: 'standalone'`) with the `NEXT_PUBLIC_*` values baked in, and pushes
   it to `us-east4-docker.pkg.dev/acuity-health-prod/odn/odn-<env>`.
2. Runs the migration runner (`scripts/migrate.ts`, which applies the pending
   files in `src/db/migrations/`) from the Dockerfile's `migrate` target, through
   the Cloud SQL Auth Proxy (IAM, no authorized network needed), using the same
   `DATABASE_URL` secret the service uses. The runner refuses a database whose
   Prisma history was never adopted; see the cutover rule below.
3. Deploys Cloud Run service `odn-<env>` as service account `odn-<env>`, with
   `--add-cloudsql-instances`, env vars from substitutions, and secrets from
   Secret Manager `odn-<env>-*`.

Staging deploys on every push to `main` via
`.github/workflows/deploy-staging.yml` (GitHub OIDC → workload identity
provider `github-actions/odn-staging`, restricted to this repo, `main`, that
workflow, and the `staging` environment). The staging values live in that
workflow. To deploy staging by hand, run the same `gcloud builds submit`
command from the workflow.

## Staging

| What       | Value                                                                                                                                                                                                        |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| URL        | https://odn-staging-1006405058436.us-east4.run.app                                                                                                                                                           |
| Service    | `odn-staging`, public via `--no-invoker-iam-check` (the org policy rejects `allUsers`)                                                                                                                       |
| Runtime SA | `odn-staging@` — `roles/cloudsql.client`, `secretAccessor` on its `odn-staging-*` secrets                                                                                                                    |
| Database   | `onlinedoctornote_staging`, owned by login `odn_staging` (no `CREATEDB`/`CREATEROLE`, `CONNECT` revoked from `PUBLIC`)                                                                                       |
| Secrets    | `odn-staging-{database-url,db-password,stripe-secret-key,stripe-publishable-key,stripe-webhook-secret,better-auth-secret,cron-secret,resend-api-key,resend-webhook-secret,telnyx-api-key,telnyx-public-key}` |
| Crons      | Cloud Scheduler `odn-staging-cleanup-temp-submissions`, `odn-staging-send-note-follow-ups`                                                                                                                   |

Staging never uses live credentials:

- Stripe: test-mode keys and price (`sk_test_`, `pk_test_`) copied from the
  Vercel preview environment. No Stripe webhook endpoint targets staging yet;
  `odn-staging-stripe-webhook-secret` holds the preview test-mode secret.
- Resend: `odn-staging-resend-api-key` is a non-working placeholder, so email
  sends fail visibly in the logs. Resend has no test mode; add a key restricted
  to a staging sending domain if staging email is needed.
- Telnyx: `TELNYX_SMS_ENABLED=false` (outbound SMS is skipped) and
  `TELNYX_WEBHOOK_ENABLED=false`. The Telnyx secrets are placeholders.
- PDFs are signed as `Dr. Staging Test, MD (staging)`.
- Intake validation runs in log-only mode (`INTAKE_VALIDATION_ENFORCED=false`, the
  `_INTAKE_VALIDATION_ENFORCED` substitution). Rule failures at checkout are logged as
  `Intake failed validation rules` and the payment proceeds. Set the substitution to
  `true` to reject them with a 400 instead.

`/verify/staging-smoke-test-slug` reads a fake record (submission
`staging-smoke-submission`) seeded in the staging database; use it to check
that a deploy can read the database.

Rotating the staging database password means updating both
`odn-staging-db-password` and `odn-staging-database-url`, then redeploying.

## Crons

`vercel.json` crons are replaced by Cloud Scheduler HTTP jobs that send the
same `Authorization: Bearer $CRON_SECRET` header the routes already check
(UTC, same schedules as Vercel):

```bash
ENV=staging
URL=https://odn-staging-1006405058436.us-east4.run.app
CRON_SECRET=$(gcloud secrets versions access latest --secret=odn-$ENV-cron-secret)
gcloud scheduler jobs create http odn-$ENV-cleanup-temp-submissions --location=us-east4 \
  --schedule="0 * * * *" --time-zone=Etc/UTC --http-method=GET \
  --uri="$URL/api/cron/cleanup-temp-submissions" \
  --headers="Authorization=Bearer $CRON_SECRET" --attempt-deadline=120s
gcloud scheduler jobs create http odn-$ENV-send-note-follow-ups --location=us-east4 \
  --schedule="15 * * * *" --time-zone=Etc/UTC --http-method=GET \
  --uri="$URL/api/cron/send-note-follow-ups" \
  --headers="Authorization=Bearer $CRON_SECRET" --attempt-deadline=120s
```

The bearer token is stored in the job definition, so anyone with
`cloudscheduler.jobs.get` can read it. After rotating `CRON_SECRET`, update the
jobs with `gcloud scheduler jobs update http ... --update-headers`.

## Production cutover

Production today: Vercel project `onlinedoctornote` (team
`data-buddies-solutions`), DNS hosted on Vercel DNS (`ns1/ns2.vercel-dns.com`)
for both `onlinedoctornote.com` and `phealthclinic.com`, database already on
Cloud SQL (`onlinedoctornote`, login `odn_app`) reached over the instance's
public IP through the `0.0.0.0/0` authorized network.

Because Vercel and Cloud Run share the same database, both can serve traffic at
the same time; cutover is only a DNS change and rollback is a DNS change back.

### Before cutover day

1. **Lower TTLs (at least 48 hours before).** In Vercel DNS, record the current
   apex and `www` records for both domains (today: A records, TTL 1800), then
   set their TTL to 60 seconds. Wait for the old TTL to expire.
2. **Production secrets.** Create `odn-production-*` secrets (same names as
   staging) from the Vercel production values. Pull them to a private temp file
   with `vercel env pull --environment=production`, never print them, and
   delete the file afterwards. Reuse the live `BETTER_AUTH_SECRET` (keeps admin
   sessions valid), `CRON_SECRET`, Stripe, Resend and Telnyx values unchanged
   so webhook signatures keep verifying. `odn-production-database-url` is
   `postgresql://odn_app:<password>@localhost/onlinedoctornote?host=/cloudsql/acuity-health-prod:us-east4:onlinedoctornote-db`.
   The pool size is fixed in code (`src/db/pool.ts`: 5 connections per instance,
   10 s to get one), so the URL carries no `connection_limit`.
   Vercel marks some values Sensitive (not pullable); copy those from their
   source dashboards (Stripe, Telnyx, Resend).
3. **Runtime identity.** Create service account `odn-production` with
   `roles/cloudsql.client` and `secretAccessor` on each `odn-production-*`
   secret; give `odn-deploy` `iam.serviceAccountUser` on it and
   `secretAccessor` on `odn-production-database-url` and
   `odn-production-stripe-publishable-key`.
4. **Deploy `odn-production`.** Run `cloudbuild.yaml` with `_ENV=production`,
   `_SITE_URL=https://onlinedoctornote.com`,
   `_VERIFICATION_BASE_URL=https://phealthclinic.com`, `_RESEND_FROM_EMAIL`,
   the live price IDs, `_TELNYX_SMS_ENABLED=true`, `_TELNYX_FROM_NUMBER`,
   `_TELNYX_WEBHOOK_ENABLED=true`, `_MIN_INSTANCES=1`, and the real doctor
   name/credentials. Its migrate step is a no-op if the
   schema is current. The deploy sets `--no-invoker-iam-check`, so the
   service is public.
   Smoke-test the `run.app` URL (home, `/admin/login`, `/verify/<slug>`).
5. **Load balancer and certificates.** Create a global external Application
   Load Balancer with a serverless NEG for `odn-production`, a reserved global
   IPv4 address, and a Certificate Manager certificate for
   `onlinedoctornote.com`, `www.onlinedoctornote.com`, `phealthclinic.com`,
   `www.phealthclinic.com` using **DNS authorization** (add the
   `_acme-challenge` CNAMEs in Vercel DNS). Wait until the certificate is
   `ACTIVE` before cutover, so there is no TLS gap. Test with
   `curl --resolve onlinedoctornote.com:443:<LB IP> https://onlinedoctornote.com/`
   and the same for `phealthclinic.com/verify`.
6. **Crons.** Create the production Cloud Scheduler jobs (commands above with
   `ENV=production`, `URL=https://onlinedoctornote.com`) and immediately
   `gcloud scheduler jobs pause` them.

### Cutover

1. In Vercel DNS, change the apex and `www` A records of both domains to the
   load balancer IP (remove the Vercel A records).
2. Resume the production Cloud Scheduler jobs. Vercel's crons keep running
   from the old repo during the rollback week; both jobs are safe to run
   twice (cleanup deletes expired rows; follow-ups claim rows with
   `followUpEmailClaimedAt` before sending).
3. Webhooks stay on the same URLs, so nothing changes in the provider
   dashboards: Stripe `https://onlinedoctornote.com/api/webhooks/stripe-prod3`,
   Telnyx `https://onlinedoctornote.com/api/webhooks/telnyx`, Resend
   `https://onlinedoctornote.com/api/webhooks/resend`. During propagation some
   deliveries still reach Vercel; both stacks write to the same database.
4. Watch for an hour: Cloud Run request logs and 5xx rate; `/`,
   `/admin/login`, and a real `/verify/<slug>` on `phealthclinic.com`; and
   Stripe/Telnyx/Resend webhook delivery status in each dashboard (all 2xx).
   Confirm requests are reaching Cloud Run (`gcloud run services logs read
odn-production`) rather than Vercel.

### Rollback (any time during the following 7 days)

1. In Vercel DNS, restore the A records recorded in step 1 of "Before
   cutover day". With a 60 s TTL, traffic returns to Vercel within minutes.
2. Pause the production Cloud Scheduler jobs.
3. Nothing else: the Vercel production deployment, its env vars, and its
   crons are left untouched for the whole week, and it still reaches the same
   database through the public IP.

### After the rollback week

1. Retire Vercel production (remove the domains from the Vercel project, then
   delete or pause the project). Move DNS off Vercel DNS if desired (Cloud DNS),
   keeping the same records.
2. **Remove the `0.0.0.0/0` authorized network** from the Cloud SQL instance.
   This must wait until Vercel is retired, because Vercel connects over the
   public IP. Before removing it, confirm nothing else depends on it:
   - `jazzy-eyes` (Vercel, same team) uses database `jazzy_eyes` / login
     `jazzy_app` on this same instance — confirm how it connects.
   - `.github/workflows/production-migrations.yml` runs the migration runner
     from GitHub-hosted runners over the public IP; replace it with the
     `cloudbuild.yaml` migrate step (Cloud SQL Auth Proxy).
   - Local tooling must use the Cloud SQL Auth Proxy.

   ```bash
   gcloud sql instances patch onlinedoctornote-db --clear-authorized-networks
   ```

   Cloud Run and the Auth Proxy connect through the Cloud SQL Admin API with
   IAM and are unaffected.

3. Restore normal TTLs (e.g. 3600 s).

## Cutover from Prisma migrations

Each database (staging, production) moves from `prisma migrate deploy` to the
runner exactly once, in this order:

1. Run the last `prisma migrate deploy` you intend to run. Nothing may change the
   schema through Prisma after this point.
2. Run `npx tsx scripts/adopt-prisma-migrations.ts` against that database (or the
   `adopt-prisma` action of `production-migrations.yml`). It copies the finished
   `_prisma_migrations` rows into `schema_migrations`, refuses on any checksum
   mismatch or unresolved failed attempt, and is a no-op when run again.
3. Deploy the code that runs the runner. From here on, every schema change is a
   new numbered file in `src/db/migrations/` applied by `npm run db:migrate`.

No schema change ships through both tools. A deploy that reaches the runner before
step 2 fails with `adopt_required` and changes nothing. After step 2 the runner
checks `_prisma_migrations` on every run and refuses with `prisma_drift` if a
Prisma migration finished that `schema_migrations` does not record.

Staging has no adopt action: before the Prisma-deleting PR merges, run step 2 from
that branch against `onlinedoctornote_staging` through the Cloud SQL Auth Proxy.
Otherwise the first `deploy-staging.yml` run fails at the migrate step with
`adopt_required`, and you rerun it after adopting.

`pg` verifies the server certificate when `DATABASE_URL` says `sslmode=require`
(Prisma did not). Over the Cloud SQL unix socket there is no TLS and nothing to
change. For `production-migrations.yml`, which connects over the public IP, the
`DATABASE_URL` secret needs either the instance's server CA (`sslrootcert`) or
`sslmode=no-verify`, or the step moves behind the proxy; otherwise the first run
fails the TLS handshake.
