# Cloud Run

Online Doctor Note runs on Cloud Run in GCP project `acuity-health-prod`
(region `us-east4`) and talks to Cloud SQL instance
`acuity-health-prod:us-east4:onlinedoctornote-db` over the Cloud SQL unix
socket. Production moved here from Vercel on 2026-10-26; see Production below.

## How a deploy works

`cloudbuild.yaml` runs as service account `odn-deploy` and, for `_ENV=<env>`:

1. Builds the `runtime` target of the `Dockerfile` (Next.js
   `output: 'standalone'`) with the `NEXT_PUBLIC_*` values baked in, and pushes
   it to `us-east4-docker.pkg.dev/acuity-health-prod/odn/odn-<env>`.
2. Runs the migration runner (`scripts/migrate.ts`, which applies the pending
   files in `src/db/migrations/`) from the Dockerfile's `migrate` target, through
   the Cloud SQL Auth Proxy (IAM, no authorized network needed), using the same
   `DATABASE_URL` secret the service uses. The runner refuses a database whose
   Prisma history was never adopted; see Prisma history below.
3. Deploys Cloud Run service `odn-<env>` as service account `odn-<env>`, with
   `--add-cloudsql-instances`, env vars from substitutions, and secrets from
   Secret Manager `odn-<env>-*`.

`.github/workflows/deploy.yml` runs it for both environments, signed in through
GitHub OIDC and workload identity providers in pool `github-actions`. Each
provider accepts only this repo, `main`, `deploy.yml`, and its own GitHub
environment: `odn-staging` takes `staging`, `odn-production` takes
`production`. The non-secret values of both environments live in that
workflow.

On every push to `main`:

1. The `staging` job deploys the commit to staging.
2. Only if that succeeds, release-please (`release-please-config.json`,
   `.release-please-manifest.json`) opens or updates the release PR. It bumps
   the version in `package.json` and lists the `feat:` and `fix:` commits since
   the last release in `CHANGELOG.md`.
3. When the push is the merge of the release PR, release-please tags it
   `vX.Y.Z`, creates the GitHub release, and the `production` job deploys that
   tag. The job refuses a tag that does not point at the commit staging just
   deployed.

The release PR is opened with the workflow's `GITHUB_TOKEN`, so CI does not run
on it. It changes only version files and `CHANGELOG.md`, which Prettier
ignores.

Migrations run before every deploy and only go forward, so a schema change
must work with the code that is still running, and deploying an older release
keeps the newer schema.

To deploy a release to production again, run the workflow by hand from `main`
with its tag. To roll back without a build, send traffic to an earlier revision
with `gcloud run services update-traffic odn-production --region=us-east4
--to-revisions=<revision>=100`. While traffic is pinned, new revisions get
none, so undo it with `--to-latest`.

## Staging

| What       | Value                                                                                                                                                                                                                                                           |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| URL        | https://odn-staging-1006405058436.us-east4.run.app                                                                                                                                                                                                              |
| Service    | `odn-staging`, public via `--no-invoker-iam-check` (the org policy rejects `allUsers`)                                                                                                                                                                          |
| Runtime SA | `odn-staging@` — `roles/cloudsql.client`, `secretAccessor` on its `odn-staging-*` secrets                                                                                                                                                                       |
| Database   | `onlinedoctornote_staging`, owned by login `odn_staging` (no `CREATEDB`/`CREATEROLE`, `CONNECT` revoked from `PUBLIC`)                                                                                                                                          |
| Secrets    | `odn-staging-{database-url,db-password,stripe-secret-key,stripe-publishable-key,stripe-webhook-secret,better-auth-secret,cron-secret,resend-api-key,resend-webhook-secret,telnyx-api-key,telnyx-public-key,google-client-id,google-client-secret,admin-emails}` |
| Crons      | Cloud Scheduler `odn-staging-cleanup-temp-submissions`, `odn-staging-send-note-follow-ups`                                                                                                                                                                      |

Staging never uses live credentials:

- Stripe: test-mode keys and price (`sk_test_`, `pk_test_`) copied from the
  Vercel preview environment. No Stripe webhook endpoint targets staging yet;
  `odn-staging-stripe-webhook-secret` holds the preview test-mode secret.
- Resend: `odn-staging-resend-api-key` is a non-working placeholder, so email
  sends fail visibly in the logs. Resend has no test mode; add a key restricted
  to a staging sending domain if staging email is needed.
- Telnyx: `TELNYX_SMS_ENABLED=false` (outbound SMS is skipped) and
  `TELNYX_WEBHOOK_ENABLED=false`. The Telnyx secrets are placeholders.
- Admin sign-in is Google only. The OAuth client `ODN admin sign-in` and its
  External consent screen, `Online Doctor's Note`, live in their own project,
  `odn-sign-in`, so they leave the Acuity Health consent screen in
  `acuity-health-prod` alone. The client lists the staging, production and
  `localhost:3000` callbacks (`<origin>/api/auth/callback/google`) as redirect
  URIs. `odn-staging-google-client-id` and `odn-staging-google-client-secret`
  hold its credentials, and `odn-staging-admin-emails` holds the
  comma-separated doctor emails allowed in.
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

## Production

| What          | Value                                                                                                                                                                                                                                                                                                  |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| URL           | https://onlinedoctornote.com, and https://phealthclinic.com for note verification                                                                                                                                                                                                                      |
| Service       | `odn-production`, min 1 and max 3 instances, public via `--no-invoker-iam-check`                                                                                                                                                                                                                       |
| Runtime SA    | `odn-production@` — `roles/cloudsql.client`, `secretAccessor` on its `odn-production-*` secrets                                                                                                                                                                                                        |
| Database      | `onlinedoctornote`, login `odn_app`; the data agent uses `odn_production_analytics`                                                                                                                                                                                                                    |
| Secrets       | `odn-production-{database-url,stripe-secret-key,stripe-publishable-key,stripe-webhook-secret,better-auth-secret,cron-secret,resend-api-key,resend-webhook-secret,telnyx-api-key,telnyx-public-key,analytics-database-url,telnyx-inference-api-key,google-client-id,google-client-secret,admin-emails}` |
| Crons         | Cloud Scheduler `odn-production-cleanup-temp-submissions`, `odn-production-send-note-follow-ups`                                                                                                                                                                                                       |
| Load balancer | IP `odn-production-ip` (`136.81.47.63`), serverless NEG `odn-production-neg`, URL maps `odn-production-url-map` and `odn-production-http-redirect-map`, certificate `odn-production-cert` in map `odn-production-cert-map`                                                                             |

The load balancer sends `www.onlinedoctornote.com` to `onlinedoctornote.com`
and HTTP to HTTPS with a 308. The certificate renews through the four
`_acme-challenge_5zbzfbsna5sj32bt` CNAMEs, which must stay in DNS.

The first deploy of a new public service must be run by a person with
`run.services.setIamPolicy`: `odn-deploy` cannot set `--no-invoker-iam-check`
on a service that does not exist yet. Later deploys do not change it and pass.

Webhooks use the same URLs as on Vercel: Stripe
`https://onlinedoctornote.com/api/webhooks/stripe-prod3`, Telnyx
`https://onlinedoctornote.com/api/webhooks/telnyx`, Resend
`https://onlinedoctornote.com/api/webhooks/resend`.

To add an admin, add a version of `odn-production-admin-emails` with the whole
comma-separated list, then start a new revision so it is read:

```bash
gcloud run services update odn-production --region=us-east4 --update-secrets=ADMIN_EMAILS=odn-production-admin-emails:latest
```

A doctor whose `users` row has `email_verified` false cannot link Google to
it; the sign-in ends on `/admin/login` with `error=account_not_linked`.

### DNS

Cloud DNS zones `onlinedoctornote-com` (`ns-cloud-e1` to `e4.googledomains.com`)
and `phealthclinic-com` (`ns-cloud-b1` to `b4.googledomains.com`) hold every
record, including Google Workspace MX and Resend's DKIM and SPF. The
registrars, GoDaddy for `onlinedoctornote.com` and Name.com for
`phealthclinic.com`, still name Vercel DNS until they are switched to those
nameservers.

While Vercel DNS serves a domain, its apex is an `A` record beside Vercel's
managed apex `ALIAS`, which the `A` overrides, and `www` is an `ALIAS` to the
apex. Vercel refuses to change a record's type and to add an `A` beside an
`ALIAS`, and deleting `www` while `_acme-challenge_<x>.www` exists leaves `www`
with no address. In Cloud DNS both are plain `A` records. Change a record in
both places until the registrar switch has been live for 48 hours.

### Vercel

Vercel production, from the old `Data-Buddies-Solutions/onlinedoctornote`
repo, shares the database and is the rollback target until 2026-11-02. To roll
back while Vercel DNS serves the domains, point each `www` `ALIAS` back to
`cname.vercel-dns-017.com.`, then delete the apex `A` records. The Vercel team
is on the Hobby plan, so treat this as a short-term fallback.

Vercel's admin saves a free-text "Other" denial reason, which
`submissions_denial_reason_check` rejects, so doctors pick a listed reason
there.

After 2026-11-02, in this order:

1. Switch the registrars to Cloud DNS and wait 48 hours.
2. Remove the domains from the Vercel project and pause or delete it. Doing
   this while Vercel DNS still serves a domain can delete its zone.
3. Remove the `0.0.0.0/0` authorized network from the Cloud SQL instance, once
   nothing connects over the public IP. Check `jazzy-eyes`, which uses database
   `jazzy_eyes` on the same instance, and use the Cloud SQL Auth Proxy for
   local tooling.

   ```bash
   gcloud sql instances patch onlinedoctornote-db --clear-authorized-networks
   ```

## Prisma history

Both databases moved from `prisma migrate deploy` to the runner once: staging
before Prisma was deleted from this repo, production on 2026-10-26, each with
`npx tsx scripts/adopt-prisma-migrations.ts` through the Cloud SQL Auth Proxy.
The runner checks `_prisma_migrations` on every run and refuses with
`prisma_drift` if a Prisma migration finished that `schema_migrations` does not
record, so the old repo must never run `prisma migrate deploy` again.
