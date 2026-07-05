# SMS Support Automation And Admin Ticketing Spec

Status: draft rewrite
Date: 2026-06-29

## Goal

Build a complete SMS customer-service system on top of the existing Telnyx transactional SMS
stack.

The system must support:

1. Customer-initiated SMS support via `HELP`.
2. Deterministic SMS menus and data collection.
3. A first-class admin support ticket queue.
4. Automated approved-note updates for safe customer corrections:
   - patient date of birth
   - note purpose
5. Future agent assistance inside the ticket/admin boundary.

Primary product rule: the admin portal is the source of truth for every support ticket and
automation result. Email alerts are secondary notifications that link staff back into the admin
ticket.

MVP customer/staff entrypoints:

1. Customer texts `HELP`.
2. Staff opens a support ticket from the admin portal for an existing submission.

Future entrypoint:

- Customer uses a support/chat link that starts the same ticket state machine.

## Locked Product Decisions

Chase has approved these decisions for this spec:

- Customer-service SMS is allowed.
- Raw inbound and outbound SMS bodies may be retained in the SMS/support ledger.
- DOB correction should be automated after strict validation.
- First/last day off changes should not be automated in v1; they route to admin/email.
- Purpose changes should be automated after strict validation.
- Ticketing admin UI is required in the first complete build.

These decisions do not remove the need for privacy/terms/consent copy updates before launch.

## Telnyx Workflow Fit

Telnyx can support this workflow through normal inbound messaging webhooks:

1. Customer texts the Telnyx toll-free number.
2. Telnyx sends a `message.received` webhook to the configured messaging profile webhook URL.
3. The app verifies the Telnyx signature, stores the webhook idempotently, logs the inbound
   `SmsMessage`, handles STOP/START first, then routes non-opt-out messages into support.
4. If the body is `HELP`, the support state machine opens or resumes the customer ticket.
5. The app sends the next numbered SMS menu as an ordinary outbound SMS.

Important UI clarification:

- SMS does not provide a native dropdown menu.
- The MVP menu is a numbered text menu: "Reply 1, 2, or 3".
- Rich buttons, suggested replies, or dropdown-like interactions are a future RCS channel, not
  the toll-free SMS baseline.

Webhook timing rule:

- Telnyx webhooks should return a fast 2xx response.
- The webhook may send simple menu replies immediately.
- PDF generation, note regeneration, and email delivery must be queued and processed outside the
  webhook response.

## Current Code To Reuse

Existing SMS infrastructure:

- `prisma/schema.prisma`
  - `Submission.smsOptIn`, `smsOptInAt`, `smsConsentVersion`, `smsPhoneE164`
  - `SmsPhoneState`
  - `SmsMessage`
  - `TelnyxWebhookEvent`
- `src/lib/telnyx.ts`
  - `verifyTelnyxWebhookSignature`
  - `isLocalOptOut`
  - `isOptInKeyword`
  - `sendTelnyxSms`
  - `sendTransactionalSmsForSubmission`
- `src/app/api/webhooks/telnyx/route.ts`
- `src/lib/sms-templates.ts`
- `src/lib/sms-status.ts`
- `src/lib/phone-utils.ts`
- `src/lib/email.ts`
- `src/app/admin/actions.ts`
  - `updateSubmission(...)`
  - `reApproveSubmission(...)`
- `src/components/admin/SearchSubmissionDetail.tsx`

Existing behavior:

- Inbound SMS is logged as `SmsMessage(type='INBOUND')`.
- STOP/START state is phone-level in `SmsPhoneState`.
- Inbound SMS currently links to the latest submission with matching `smsPhoneE164`.
- Admins can edit submission fields.
- Reapproval generates a new PDF, creates a new verification snapshot, revokes older active
  verifier records, sends the updated note by email, and sends approval SMS.

Current mismatch to fix:

- `reApproveSubmission(...)` fetches and renders the submission before any support automation
  edits. Support automation must use a single service that applies changes, refetches the updated
  row, generates the new PDF/snapshot, emails it, and records the automation result.

## System Ownership

One owner for each state:

- Phone-level SMS consent/opt-out: `SmsPhoneState`.
- Submission-level consent provenance: `Submission.smsOptIn`, `smsOptInAt`,
  `smsConsentVersion`, `smsPhoneE164`.
- SMS message ledger: `SmsMessage`.
- Support workflow state: `SmsSupportTicket`.
- Async automation execution: `SmsSupportJob`.
- Issued-document public verification data: `NoteVerification` snapshots.

No client flow may mutate a submission and then separately trigger reapproval for automation.
Support automation must go through one server-side service.

## Product Scope

MVP includes:

1. `SmsSupportTicket` model.
2. `SmsSupportJob` model for queued automation work.
3. Admin support queue.
4. Admin ticket detail view.
5. Inbound `HELP` support routing.
6. Admin-created support tickets from submission detail.
7. Deterministic SMS state machine.
8. Admin email alert for new/actionable tickets.
9. Automated DOB correction.
10. Manual admin/email path for first/last day off changes.
11. Automated purpose correction.
12. Audit trail and failure visibility.
13. Agent-ready ticket actions, without autonomous AI writes in MVP.

MVP excludes:

- AI interpretation of freeform text.
- Automatic diagnosis or symptom rewriting.
- Automatic refunds.
- Sending PDFs, note links, diagnosis, symptoms, full DOB, raw note contents, or Medical Record #
  over SMS.
- Customer-visible raw ticket transcript page.
- RCS rich buttons.

## Data Model

Add `SmsSupportTicket`.

```prisma
model SmsSupportTicket {
  id                  String      @id @default(uuid())
  phoneE164            String      @map("phone_e164")
  submissionId         String?     @map("submission_id")
  submission           Submission? @relation(fields: [submissionId], references: [id], onDelete: SetNull)

  status               String
  category             String?
  state                String
  source               String
  automationKind       String?     @map("automation_kind")
  automationStatus     String?     @map("automation_status")
  collectedData        Json?       @map("collected_data")
  adminSummary         String?     @map("admin_summary") @db.Text
  failureReason        String?     @map("failure_reason") @db.Text
  retryCount           Int         @default(0) @map("retry_count")
  csrAlertedAt         DateTime?   @map("csr_alerted_at")
  lastInboundAt        DateTime?   @map("last_inbound_at")
  lastOutboundAt       DateTime?   @map("last_outbound_at")
  closedAt             DateTime?   @map("closed_at")
  createdAt            DateTime    @default(now()) @map("created_at")
  updatedAt            DateTime    @updatedAt @map("updated_at")

  messages             SmsMessage[]
  jobs                 SmsSupportJob[]

  @@index([phoneE164])
  @@index([submissionId])
  @@index([status, updatedAt])
  @@index([category])
  @@index([automationStatus])
  @@map("sms_support_tickets")
}
```

Extend `SmsMessage`.

```prisma
supportTicketId String?           @map("support_ticket_id")
supportTicket   SmsSupportTicket? @relation(fields: [supportTicketId], references: [id], onDelete: SetNull)

@@index([supportTicketId])
```

Add `SmsSupportJob`.

```prisma
model SmsSupportJob {
  id              String            @id @default(uuid())
  ticketId         String            @map("ticket_id")
  ticket           SmsSupportTicket  @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  kind             String
  status           String
  payload          Json?
  attempts         Int               @default(0)
  lockedAt         DateTime?         @map("locked_at")
  lockedBy         String?           @map("locked_by")
  lastError        String?           @map("last_error") @db.Text
  runAfter         DateTime          @default(now()) @map("run_after")
  completedAt      DateTime?         @map("completed_at")
  createdAt        DateTime          @default(now()) @map("created_at")
  updatedAt        DateTime          @updatedAt @map("updated_at")

  @@index([status, runAfter])
  @@index([ticketId])
  @@map("sms_support_jobs")
}
```

Recommended string values:

- Ticket `status`: `OPEN`, `WAITING_FOR_CUSTOMER`, `READY_FOR_AUTOMATION`, `RUNNING_AUTOMATION`,
  `NEEDS_CSR`, `CLOSED`
- Ticket `category`: `NOTE_NOT_RECEIVED`, `CHANGE_NOTE`, `REFUND`, `FORM`, `OTHER`
- Ticket `source`: `SMS_HELP`, `SUPPORT_LINK`, `ADMIN_CREATED`, `BOUNCE_ESCALATION`
- `automationKind`: `UPDATE_DOB`, `UPDATE_PURPOSE`
- `automationStatus`: `NOT_ELIGIBLE`, `ELIGIBLE`, `QUEUED`, `RUNNING`, `SUCCEEDED`, `FAILED`,
  `BLOCKED`
- Job `kind`: `RUN_SUPPORT_AUTOMATION`, `SEND_SUPPORT_SMS`, `SEND_CSR_ALERT`
- Job `status`: `QUEUED`, `RUNNING`, `SUCCEEDED`, `FAILED`

Use string values, not Prisma enums, during early iteration.
`NEEDS_CSR`, `CSR_REVIEW`, and `SEND_CSR_ALERT` are internal compatibility names only; admin-facing
copy should say `Needs Admin`, `admin review`, and `admin alert`.

## State Machine Files

Add:

- `src/lib/sms-support.ts`
- `src/lib/sms-support-types.ts`
- `src/lib/sms-support-templates.ts`
- `src/lib/sms-support-automation.ts`
- `src/lib/sms-support-jobs.ts`

Core entrypoint:

```ts
handleInboundSupportSms({
  fromPhoneE164,
  toPhoneE164,
  body,
  providerMessageId,
  occurredAt,
})
```

Core rules:

1. Telnyx webhook verifies signature and webhook idempotency first.
2. Inbound `SmsMessage` is always logged first.
3. STOP/START are handled before support routing.
4. STOP/START never create or advance support tickets.
5. `HELP` opens or resumes the latest non-closed ticket for that phone.
6. If no active ticket exists, create one and send the intro menu.
7. If an active ticket exists, route the reply according to ticket `state`.
8. If multiple submissions match the phone, collect a short ref before automation.
9. If one recent submission matches the phone, link it automatically but allow admin correction.
10. If no submission matches, support can continue, but automation is blocked until admin/customer
    links a submission.

## SMS Menu Copy

All outbound support SMS should be short, branded, and avoid PHI.

Intro:

```text
OnlineDoctorNote: How can we help? Reply with a number.
1 I did not receive my note
2 I need to change my note
3 Other
Reply HELP for note changes or customer support.
STOP to opt out.
```

Invalid menu reply:

```text
OnlineDoctorNote: Please reply with one of the listed numbers. Reply HELP to restart. STOP to opt out.
```

Automation success:

```text
OnlineDoctorNote: Your updated note was emailed. Please check inbox/spam. STOP to opt out.
```

Automation blocked:

```text
OnlineDoctorNote: Staff needs to review this before we can update your note. We will follow up soon. STOP to opt out.
```

Never include:

- full DOB
- diagnosis
- symptoms
- PDF links
- verification URLs
- Medical Record #
- full note contents

## Flow 1: Note Not Received

State: `NOTE_NOT_RECEIVED_SPAM_CHECK`

Send:

```text
OnlineDoctorNote: Please check your spam/junk folder. Reply 1 if you found it or 2 if you still cannot find it. STOP to opt out.
```

Customer `1`:

- Send polite close.
- Set `status='CLOSED'`.

Customer `2`:

- Ask for corrected email.
- Validate email format.
- Store `collectedData.correctedEmail`.
- Set `status='NEEDS_CSR'`.
- Send admin alert.

No automatic email update in MVP. Email correction remains admin handled.

## Flow 2: Change My Note

State: `CHANGE_NOTE_MENU`

Send:

```text
OnlineDoctorNote: Reply with a number.
1 Issue/evaluation date
2 First/last day off
3 Date of birth
4 Return date
5 Add diagnosis/symptoms
6 Change purpose to work/school/travel
7 Name misspelled
8 Need restrictions/accommodations
9 Other
Reply HELP for note changes or customer support.
STOP to opt out.
```

### 2.1 Issue/Evaluation Date

Send:

```text
OnlineDoctorNote: The evaluation date cannot be changed after review. Reply 7 if you still need staff help. STOP to opt out.
```

Default:

- Close unless customer replies for staff help.

### 2.2 First/Last Day Off

```text
OnlineDoctorNote: First/last day off changes need staff review. Email hello@onlinedoctornote.com with the correct dates. STOP to opt out.
```

Then:

- Set `category='CHANGE_DATES'`.
- Set `status='NEEDS_CSR'`.
- Alert admin.
- Do not collect dates by SMS automation and do not create an automation job.

### 2.3 Date Of Birth Automation

State sequence:

1. `CHANGE_DOB_COLLECT`
2. `CHANGE_DOB_VALIDATE`
3. `RUNNING_AUTOMATION`
4. `CLOSED` or `NEEDS_CSR`

Prompt:

```text
OnlineDoctorNote: Reply with the correct birthday in MM/DD/YYYY format. Example: 03/14/1990. STOP to opt out.
```

Validation:

- Accept only strict `MM/DD/YYYY`.
- Reject ISO dates, words, partial dates, and ambiguous short dates.
- Reject future DOB.
- Reject implausibly old DOB using the existing age/date validation boundary.
- Require linked submission.
- Require submission status `APPROVED`.
- If corrected DOB changes adult/minor/guardian assumptions, set `NEEDS_CSR`.
- Do not echo full DOB in outbound SMS.

If valid:

- Store corrected DOB only in `collectedData.correctedDobIso`.
- Set `automationKind='UPDATE_DOB'`.
- Set `automationStatus='QUEUED'`.
- Set `status='RUNNING_AUTOMATION'`.
- Create `SmsSupportJob(kind='RUN_SUPPORT_AUTOMATION')`.

Automation result:

- Update `Submission.patientDateOfBirth`.
- Regenerate the note through the support automation service.
- Revoke older active verifier records.
- Email the updated PDF.
- Send SMS success after email succeeds.
- Mark ticket `CLOSED`.

### 2.4 Return Date

Send:

```text
OnlineDoctorNote: The note says the patient may return after the last day off. Reply 1 to change first/last day off or 7 for staff help. STOP to opt out.
```

Customer `1` or any return-date question routes to admin/email guidance.

### 2.5 Diagnosis Or Symptoms

Send:

```text
OnlineDoctorNote: Diagnosis or symptom changes require staff review. Reply 1 if you want staff to review this request. STOP to opt out.
```

Customer `1`:

- Set `category='CHANGE_NOTE'`.
- Set `status='NEEDS_CSR'`.
- Alert admin.

No automated diagnosis/symptom note generation in MVP.

### 2.6 Purpose Automation

State sequence:

1. `CHANGE_PURPOSE_COLLECT`
2. `CHANGE_PURPOSE_VALIDATE`
3. `RUNNING_AUTOMATION`
4. `CLOSED` or `NEEDS_CSR`

Prompt:

```text
OnlineDoctorNote: Reply 1 for work, 2 for school, 3 for work and school, 4 for travel. STOP to opt out.
```

Map:

- `1` -> `work`
- `2` -> `school`
- `3` -> `both`
- `4` -> `travel`

Validation:

- Require linked submission.
- Require submission status `APPROVED`.
- Reject `legal`; legal notes are not supported.
- For `travel`, preserve current product behavior: travel is a first-class `notePurpose` and the
  PDF omits return-to-work style copy.

If valid:

- Store `collectedData.notePurpose`.
- Set `automationKind='UPDATE_PURPOSE'`.
- Set `automationStatus='QUEUED'`.
- Set `status='RUNNING_AUTOMATION'`.
- Create `SmsSupportJob(kind='RUN_SUPPORT_AUTOMATION')`.

Automation result:

- Update `Submission.notePurpose` and clear `otherNotePurpose`.
- Regenerate the note through the support automation service.
- Revoke older active verifier records.
- Email the updated PDF.
- Send SMS success after email succeeds.
- Mark ticket `CLOSED`.

### 2.7 Other

Collect one freeform message.

Then:

- Store raw body in `SmsMessage`.
- Store a short admin summary if deterministic.
- Set `status='NEEDS_CSR'`.
- Alert admin.

## Flow 3: Refund, Form, Or Other

State: `OTHER_MENU`

Send:

```text
OnlineDoctorNote: Reply with a number.
1 Need an additional form
2 Need refund
3 Other
Reply HELP for note changes or customer support.
STOP to opt out.
```

### 3.1 Additional Form

Send:

```text
OnlineDoctorNote: Please email the PDF form to hello@onlinedoctornote.com. Staff will review whether it can be completed. STOP to opt out.
```

Then:

- Set `status='NEEDS_CSR'`.
- Alert admin.

### 3.2 Refund

Ask:

```text
OnlineDoctorNote: What is the refund reason? Reply 1 form denied, 2 did not use note, 3 other. STOP to opt out.
```

Map:

- `1` -> `Refund (Denial)`
- `2` -> `Refund (Customer)`
- `3` -> `Refund (Customer)` plus freeform reason

Then:

- Set `status='NEEDS_CSR'`.
- Alert admin.

No automatic refund in MVP. Refund decisions remain admin/Stripe-controlled.

### 3.3 Other Freeform

Collect one freeform message.

Then:

- Store raw body in `SmsMessage`.
- Set `status='NEEDS_CSR'`.
- Alert admin.

## Automation Service

Add a shared service:

- `src/lib/sms-support-automation.ts`

Core API:

```ts
runSupportTicketAutomation(ticketId: string, options?: { actor: 'job' | 'admin'; actorId?: string })
```

Rules:

1. Load ticket and linked submission.
2. Ticket must be automation-eligible.
3. Ticket must have exactly one linked submission.
4. Submission must be `APPROVED`.
5. Automation data must pass server-side validation.
6. Apply submission field updates in one server-side flow.
7. Refetch the updated submission.
8. Create a new verification snapshot from the updated data.
9. Generate the updated PDF from the updated data.
10. Revoke older active note verification records only after the new PDF/snapshot path succeeds.
11. Email the updated PDF.
12. Send SMS success only after email succeeds.
13. Mark ticket `CLOSED` on success.
14. Mark ticket `NEEDS_CSR` or `FAILED` on failure with `failureReason`.

Do not call the current `updateSubmission(...)` and then `reApproveSubmission(...)` as two
separate actions for automation. That can render the PDF from stale data or race with admin edits.

Recommended internal helper:

```ts
regenerateApprovedSubmission({
  submissionId,
  updates,
  source: 'sms_support',
  ticketId,
})
```

This helper should own the full approved-note regeneration boundary and can later replace shared
parts of `reApproveSubmission(...)`.

## Job Execution

Support automation should still use durable jobs, but production should not depend on a scheduled
SMS cron.

Add:

- `src/lib/sms-support-jobs.ts`

Behavior:

1. Telnyx webhook collects the final valid DOB/date/purpose answer.
2. The SMS flow creates a queued job, updates the ticket to `RUNNING_AUTOMATION`, and sends the
   customer the "working on it" SMS.
3. If that SMS prompt is delivered, the same flow immediately claims that specific queued job.
4. Runner sets job `status='RUNNING'`, `lockedAt`, `lockedBy`.
5. Runner calls `runSupportTicketAutomation(...)`.
6. Success sets job `SUCCEEDED` and ticket `CLOSED`.
7. Failure sets job `FAILED`, ticket `NEEDS_CSR`, stores `failureReason`, and sends admin alert.

The admin queue can still include "Run jobs" or "Retry" controls for manual recovery of leftover
queued or failed jobs. There should be no Vercel cron for SMS support jobs in the MVP.

## Admin Portal

Add `/admin/support`.

Queue tabs:

- New
- Waiting for customer
- Running automation
- Needs Admin review
- Closed

Ticket row fields:

- created time
- latest activity time
- category
- state
- linked submission short ref
- patient name
- submission status
- automation kind/status
- latest outbound/inbound delivery status
- failure indicator

Ticket detail sections:

- ticket metadata
- linked submission card
- raw SMS ledger
- collected data
- automation validation result
- automation/job history
- admin actions
- Admin notes

Admin actions:

- Link/unlink submission.
- Send canned SMS reply.
- Mark as needs admin review.
- Mark closed.
- Retry failed automation.
- Run queued automation now.
- Open a new ticket from submission detail.
- Add internal note.
- Future: ask an internal agent to draft a summary or recommended action.

Add "Open Support Ticket" to:

- `src/components/admin/SearchSubmissionDetail.tsx`

Optional later:

- review cards
- maybe cards
- approved cards
- denied cards

## Admin Email Alerts

Add:

- `src/emails/SmsSupportTicketAlertEmail.tsx`
- send helper in `src/lib/email.ts`

Send admin email when:

- ticket is created and needs staff awareness
- ticket enters `NEEDS_CSR`
- automation fails permanently

Email subject:

```text
SMS support: {category} - Ref #{shortRef}
```

Email body:

- link to `/admin/support/[ticketId]`
- category
- short ref if linked
- high-level reason

Email body must not include:

- raw inbound SMS body
- DOB
- diagnosis
- symptoms
- full note details
- PDF or verification links

## Future Agent Boundary

The system should be agent-ready without letting agents mutate production state directly.

Allowed future agent actions:

- summarize raw SMS ledger for staff
- suggest category/state
- draft a canned SMS reply
- identify likely linked submission candidates
- explain why automation is blocked
- prepare an admin decision packet

Not allowed without explicit admin approval:

- send SMS
- edit a submission
- run note regeneration
- issue refund
- close a ticket
- change opt-out state

Agent outputs should be stored as suggestions/audit records, not as source-of-truth ticket state.

## Compliance And Safety

STOP/START:

- STOP, STOPALL, UNSUBSCRIBE, CANCEL, END, QUIT, and natural-language stop requests remain
  phone-level opt-out.
- Support automation must not send after opt-out.
- START/UNSTOP only clears local opt-out if prior opt-in/relationship exists.
- STOP/START are not routed into support state.

Consent:

- Existing transactional opt-in covers transactional note updates.
- Customer-initiated `HELP` starts a support conversation.
- Support SMS must remain customer care, not marketing.
- Update review-page SMS consent, terms, and privacy copy before launch.

Raw SMS retention:

- Raw bodies may be stored in `SmsMessage.body`.
- Raw bodies may be visible in authenticated admin ticket detail.
- Raw bodies must not be included in admin email alerts.
- Future retention/minimization policy should be explicit before scale.

PHI minimization:

- SMS may mention generic status and requested field type.
- SMS must not include diagnosis, symptoms, note contents, PDF links, verification URLs, raw DOB
  echo, or full Medical Record #.
- DOB may be collected for correction, but only as structured ticket data and raw inbound SMS
  ledger.
- Admin portal may show collected DOB to authenticated staff.

Ambiguous identity:

- If multiple submissions match a phone, do not run automation until customer provides short ref or
  admin links the ticket.
- If phone is not linked to any submission, support can open, but automation is blocked.
- If submitted ref does not match the phone relationship, route to admin.

Provider compliance:

- Confirm the toll-free verification/use case covers customer-care support and automated note
  update messages.
- Keep sample messages aligned with the actual SMS menus.
- Keep opt-out language in support messages.
- Avoid high-frequency loops and automated reply loops.

## Files Likely Touched

Schema/migration:

- `prisma/schema.prisma`
- `prisma/migrations/.../migration.sql`

SMS/support:

- `src/app/api/webhooks/telnyx/route.ts`
- `src/lib/telnyx.ts`
- `src/lib/sms-support.ts`
- `src/lib/sms-support-types.ts`
- `src/lib/sms-support-templates.ts`
- `src/lib/sms-support-automation.ts`
- `src/lib/sms-support-jobs.ts`
- `src/lib/sms-templates.ts`

Admin:

- `src/app/admin/support/page.tsx`
- `src/app/admin/support/[id]/page.tsx`
- `src/app/admin/support/actions.ts`
- `src/components/admin/SupportTicketQueue.tsx`
- `src/components/admin/SupportTicketDetail.tsx`
- `src/components/admin/SearchSubmissionDetail.tsx`

Future customer support link:

- `src/app/support/page.tsx`
- `src/app/support/actions.ts`
- `src/components/support/SupportTicketFlow.tsx`

Manual recovery:

- `src/lib/sms-support-jobs.ts`

Email:

- `src/lib/email.ts`
- `src/emails/SmsSupportTicketAlertEmail.tsx`

Legal/product copy:

- `src/app/review/page.tsx`
- `src/app/privacy-policy/page.tsx`
- `src/app/terms-of-service/page.tsx`

Tests:

- `src/lib/__tests__/sms-support.test.ts`
- `src/lib/__tests__/sms-support-templates.test.ts`
- `src/lib/__tests__/sms-support-automation.test.ts`
- `src/lib/__tests__/sms-support-jobs.test.ts`
- `src/app/api/webhooks/telnyx/__tests__/route.test.ts`
- `src/app/admin/support/__tests__/actions.test.ts`
- `src/components/admin/__tests__/SupportTicketQueue.test.tsx`
- existing admin action tests for reapproval regression coverage

## Test Plan

Unit:

- HELP opens a new ticket.
- HELP resumes an existing open ticket.
- STOP does not open or advance support state.
- START does not open or advance support state.
- Intro menu routes 1/2/3 correctly.
- Invalid menu reply gets retry message.
- Multiple invalid replies eventually route to admin.
- Date parsing accepts strict valid date-only input.
- Date parsing rejects invalid, impossible, future/unsupported, and over-limit ranges.
- DOB correction accepts strict valid input only.
- DOB correction rejects future/implausible dates.
- DOB correction blocks if adult/minor/guardian assumptions change.
- Purpose mapping works for work/school/both/travel.
- Legal purpose cannot be selected.
- Diagnosis/symptom path always routes to admin.

Route/action:

- Telnyx inbound HELP creates `SmsSupportTicket` and links `SmsMessage`.
- Telnyx duplicate event does not create duplicate ticket.
- Telnyx webhook returns quickly after queueing automation.
- Multiple submissions for one phone blocks automation until disambiguated.
- Admin can create a manual support ticket from a submission.
- Admin email alert sends once per actionable state.
- Raw inbound body is visible in admin detail but absent from email alert.

Automation:

- `UPDATE_DOB` updates the submission, regenerates PDF, revokes old verifier, emails PDF, sends
  SMS success, closes ticket.
- `UPDATE_PURPOSE` updates the submission, regenerates PDF, revokes old verifier, emails PDF,
  sends SMS success, closes ticket.
- Automation does not run for non-approved submissions.
- Automation does not run without exactly one linked submission.
- PDF failure does not mark automation succeeded.
- Email failure leaves ticket visible and actionable.
- Opted-out phone does not receive outbound support SMS.

Validation commands:

```bash
npx prisma format --schema prisma/schema.prisma
npx prisma validate --schema prisma/schema.prisma
npx prisma generate --no-engine --schema prisma/schema.prisma
npm test -- --run src/lib/__tests__/sms-support.test.ts
npm test -- --run src/lib/__tests__/sms-support-automation.test.ts
npm test -- --run src/app/api/webhooks/telnyx/__tests__/route.test.ts
npm test -- --run src/app/admin/support/__tests__/actions.test.ts
npm test -- --run
npm run lint
npm run format:check
git diff --check
```

## Implementation Slices

Slice 1: schema and constants

1. Add `SmsSupportTicket`.
2. Add `SmsSupportJob`.
3. Link `SmsMessage` to support tickets.
4. Add type constants and template tests.

Slice 2: inbound HELP and ticket state

1. Add `sms-support.ts`.
2. Route Telnyx inbound non-STOP/START messages into support.
3. Implement intro menu, note-not-received, refund/form/other paths.
4. Add route tests.

Slice 3: admin support UI

1. Add `/admin/support`.
2. Add ticket detail.
3. Add raw SMS ledger, collected data, ticket actions.
4. Add "Open Support Ticket" from submission detail.

Slice 4: admin alerts

1. Add alert email.
2. Add alert send helper.
3. Trigger alerts for `NEEDS_CSR` and permanent failures.

Slice 5: automation foundation

1. Add `sms-support-automation.ts`.
2. Extract approved-note regeneration helper.
3. Add job model helpers.
4. Add immediate job execution from the completed SMS flow.

Slice 6: automated changes

1. Add DOB automation.
2. Add purpose automation.
3. Route first/last day off to admin/email guidance.
4. Add failure handling, admin escalation, and admin retry/run-now.

Slice 7: legal/provider readiness

1. Update review SMS consent copy.
2. Update terms SMS/customer-care language.
3. Update privacy/support/SMS/automation language.
4. Confirm Telnyx toll-free use-case/sample-message alignment.

Slice 8: future agent readiness

1. Add internal suggestion/audit model if needed.
2. Let agents draft summaries/replies only.
3. Keep all sends and mutations admin or deterministic-service controlled.

Future slice: support link entrypoint

1. Add `/support`.
2. Let customer start or resume the same ticket state machine.
3. Keep SMS as the notification/reply channel when the customer provides the consented phone.

## Open Decisions

1. Raw SMS retention duration.
   - Current approved direction: raw bodies may be stored.
   - Remaining decision: keep forever or set a retention period.
2. Retry behavior for automation jobs.
   - Current direction: no scheduled retries; immediate failure becomes `NEEDS_CSR`, and admin can
     retry explicitly from the ticket.
3. How many invalid SMS replies before admin escalation.
   - Recommendation: 2 invalid replies in the same state.
4. Whether support SMS consent text should be updated before or in the same release as code.
   - Recommendation: same release, before enabling the webhook path in production.
5. Whether to add RCS later for real buttons/dropdowns.
   - Recommendation: defer until SMS flow is stable.
