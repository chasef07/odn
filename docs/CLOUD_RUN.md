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

## Analytics reader

The admin data agent at `/admin/agent` reads only the `analytics` schema of
views that `0010_analytics_schema.sql` creates. It connects with its own login,
which holds only the `NOLOGIN` role `analytics_reader`. `0012` grants that role
`CONNECT` on the app database. The app owner login has no `CREATEROLE`, so
create the role as `postgres` before the first deploy that runs `0010`, which
then skips creating it. `postgres` has no `CONNECT` on the app databases, so
connect it to the `postgres` database; roles belong to the whole instance.

`gcloud sql users create` adds the new login to `cloudsqlsuperuser`, which can
create roles and databases. Take that away so the login holds only
`analytics_reader`. Per environment:

```bash
ENV=staging
DB=onlinedoctornote_staging
PASSWORD=$(openssl rand -hex 24)
gcloud sql users create odn_${ENV}_analytics --instance=onlinedoctornote-db --password="$PASSWORD"
printf 'postgresql://odn_%s_analytics:%s@localhost/%s?host=/cloudsql/acuity-health-prod:us-east4:onlinedoctornote-db' \
  "$ENV" "$PASSWORD" "$DB" | gcloud secrets create odn-$ENV-analytics-database-url --data-file=-
gcloud sql connect onlinedoctornote-db --user=postgres --database=postgres
```

```sql
CREATE ROLE analytics_reader NOLOGIN;
GRANT analytics_reader TO odn_staging_analytics;
REVOKE cloudsqlsuperuser FROM odn_staging_analytics;
ALTER ROLE odn_staging_analytics NOCREATEROLE NOCREATEDB;
```

For production, use `odn_production_analytics`, and skip `CREATE ROLE` when
the role already exists. Then create
`odn-<env>-telnyx-inference-api-key` and give `odn-<env>` `secretAccessor` on
both secrets. `cloudbuild.yaml` maps them to `ANALYTICS_DATABASE_URL` and
`TELNYX_INFERENCE_API_KEY`, so a deploy fails until both exist. Without both
variables the page says the agent is not configured and the API answers 503.

## Production cutover

Production today: Vercel project `onlinedoctornote` (team
`data-buddies-solutions`), DNS hosted on Vercel DNS (`ns1/ns2.vercel-dns.com`)
for both `onlinedoctornote.com` and `phealthclinic.com`, database already on
Cloud SQL (`onlinedoctornote`, login `odn_app`) reached over the instance's
public IP through the `0.0.0.0/0` authorized network.

Because Vercel and Cloud Run share the same database, both can serve traffic at
the same time; cutover is only a DNS change and rollback is a DNS change back.

### Before cutover day

1. **Record the current DNS.** Each domain has two records that Vercel manages
   and "may change without notice": an apex `ALIAS` to
   `c68552752002aea9.vercel-dns-017.com` and a wildcard `*` `ALIAS` to
   `cname.vercel-dns-016.com.`. Since 2026-10-21 each domain also has an
   explicit `www` `ALIAS` to `cname.vercel-dns-016.com.`, TTL 60, the same
   target as the wildcard: `rec_8c76efa1661e3bdc16e7dd08` on
   `onlinedoctornote.com` and `rec_f7444e40fc4177cf21f5a09b` on
   `phealthclinic.com`. Vercel flattens the `ALIAS` records and resolvers get
   Vercel's A records with TTL 1800, so the TTL cannot be lowered. Plan for up
   to 30 minutes of mixed traffic after the cutover DNS change; both stacks
   share the database, so that is safe. Save the record list (Vercel
   dashboard, or `GET /v5/domains/<domain>/records`) and what resolvers see
   today:

   ```bash
   for name in onlinedoctornote.com www.onlinedoctornote.com phealthclinic.com www.phealthclinic.com; do
     dig +noall +answer @ns1.vercel-dns.com "$name" A
   done
   ```

   Never leave `www` without its own record while anything sits below it. A
   wildcard never answers for a name that exists, and a record such as
   `_acme-challenge_<x>.www` makes `www` exist with no address. On 2026-10-21
   adding the `www` challenge CNAMEs before the explicit `www` records took
   `www` down on both domains until they were deleted. Do not delete either
   `www` record while the `www` challenge CNAMEs exist; change it instead.

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

   Three secrets have no Vercel value, because doctors sign in with Google
   only on Cloud Run:
   - `odn-production-google-client-id`: the ID of the OAuth client
     `ODN admin sign-in` in project `odn-sign-in`. It already lists
     `https://onlinedoctornote.com/api/auth/callback/google` as a redirect URI.
   - `odn-production-google-client-secret`: add a new secret on that client
     for production instead of reusing staging's.
   - `odn-production-admin-emails`: the comma-separated Google emails of every
     doctor who reviews notes. Anyone not on it is refused. Each doctor needs a
     Google account on that exact email.

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
   `/admin/login` only shows the Google button here: the Google callback goes
   to `https://onlinedoctornote.com`, which is still Vercel, so a real sign-in
   waits for the cutover.
5. **Load balancer and certificates.** Built on 2026-10-21; the certificate is
   `ACTIVE`. All names are global unless a region is given:

   | What               | Name                                                                                                                |
   | ------------------ | ------------------------------------------------------------------------------------------------------------------- |
   | IP address         | `odn-production-ip`, `136.81.47.63`                                                                                 |
   | Serverless NEG     | `odn-production-neg` (`us-east4`), Cloud Run service `odn-production`                                               |
   | Backend service    | `odn-production-backend` (`EXTERNAL_MANAGED`)                                                                       |
   | HTTPS              | URL map `odn-production-url-map`, proxy `odn-production-https-proxy`, rule `odn-production-https-rule` (443)        |
   | HTTP               | URL map `odn-production-http-redirect-map`, proxy `odn-production-http-proxy`, rule `odn-production-http-rule` (80) |
   | Certificate        | `odn-production-cert` in map `odn-production-cert-map`, one entry per hostname                                      |
   | DNS authorizations | `odn-production-{odn,phc}-{apex,www}-dns-auth`, one per hostname                                                    |

   `odn-production-url-map` sends `www.onlinedoctornote.com` to
   `onlinedoctornote.com` with a 308, as Vercel does, and everything else to
   the backend; the app itself sends `phealthclinic.com/` to `/verify`.
   `odn-production-http-redirect-map` sends every HTTP request to HTTPS with a 308. Both keep the path and query. The `Location` header carries `:443`
   (`https://onlinedoctornote.com:443/...`); the `acuity-web` load balancer
   does the same, and browsers drop the default port.

   The four `_acme-challenge_5zbzfbsna5sj32bt` CNAMEs stay in Vercel DNS for
   renewals. They were added after the explicit `www` records; see step 1.
   Before cutover, test with
   `curl --resolve onlinedoctornote.com:443:136.81.47.63 https://onlinedoctornote.com/`
   and the same for `phealthclinic.com/verify`. Until `odn-production` is
   deployed the load balancer returns 404 with a valid certificate. The
   explicit `www` records show that a record you add wins over the wildcard
   `ALIAS`. Whether an `A` record at the apex wins over the managed apex
   `ALIAS` is unknown until cutover; step 1 of the cutover checks it.

6. **Crons.** Create the production Cloud Scheduler jobs (commands above with
   `ENV=production`, `URL=https://onlinedoctornote.com`) and immediately
   `gcloud scheduler jobs pause` them.
7. **Doctor accounts.** The doctors already have rows in the shared `users`
   table from the Vercel app. On a doctor's first Google sign-in, better-auth
   links Google to that row only when its `email_verified` is true; otherwise
   the sign-in ends on `/admin/login` with `error=account_not_linked`. Check
   read-only:

   ```sql
   SELECT email, email_verified FROM users;
   ```

   Every email on `odn-production-admin-emails` must either have no row, so
   the first sign-in creates one, or a row with `email_verified` true. Set it
   to true for a doctor's known email before cutover. The rows' email and
   password accounts stay, so the Vercel app keeps its login through the
   rollback week.

### Cutover

1. In Vercel DNS, on both domains:
   - Change the `www` record (`rec_8c76efa1661e3bdc16e7dd08`,
     `rec_f7444e40fc4177cf21f5a09b`) from `ALIAS` to `A` `136.81.47.63`, TTL 60.
     Change it in place; never delete it (see "Before cutover day" step 1).
   - Add an `A` record at the apex (`@`) to `136.81.47.63`, TTL 60.

   Leave the Vercel-managed `ALIAS` records and the `_acme-challenge` CNAMEs in
   place; Vercel owns the managed records, and the wildcard still serves any
   other subdomain. Rerun the `dig` loop from "Before cutover day" step 1: all
   four names must return only `136.81.47.63`. If an apex still returns Vercel
   IPs, the apex `A` record did not override the managed `ALIAS`; roll back
   (below) and stop.

2. Resume the production Cloud Scheduler jobs. Vercel's crons keep running
   from the old repo during the rollback week; both jobs are safe to run
   twice (cleanup deletes expired rows; follow-ups claim rows with
   `followUpEmailClaimedAt` before sending).
3. Webhooks stay on the same URLs, so nothing changes in the provider
   dashboards: Stripe `https://onlinedoctornote.com/api/webhooks/stripe-prod3`,
   Telnyx `https://onlinedoctornote.com/api/webhooks/telnyx`, Resend
   `https://onlinedoctornote.com/api/webhooks/resend`. During propagation some
   deliveries still reach Vercel; both stacks write to the same database.
4. Sign in at `https://onlinedoctornote.com/admin/login` with Google as a
   doctor on `odn-production-admin-emails`; you should land on `/admin`. Then
   sign in with a Google account that is not on the list; you should land
   back on `/admin/login` with the not-allowed message. Do this only once the
   `dig` loop shows the load balancer IP: sign-in starts and finishes on the
   same host, so a resolver that still returns Vercel shows Vercel's old
   email and password login.
5. Watch for an hour: Cloud Run request logs and 5xx rate; `/`,
   `/admin/login`, and a real `/verify/<slug>` on `phealthclinic.com`; and
   Stripe/Telnyx/Resend webhook delivery status in each dashboard (all 2xx).
   Confirm requests are reaching Cloud Run (`gcloud run services logs read
odn-production`) rather than Vercel.

### Rollback (any time during the following 7 days)

1. In Vercel DNS, on both domains, delete the apex `A` record added at
   cutover, and change the `www` record back to `ALIAS`
   `cname.vercel-dns-016.com.`, TTL 60. Do not delete the `www` record. Check
   with the `dig` loop that the answers match what step 1 of "Before cutover
   day" recorded. The cutover records have TTL 60, so traffic returns to
   Vercel within minutes.
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

3. Raise the TTL of the apex and `www` `A` records to a normal value (e.g.
   3600 s).

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
