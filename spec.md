# Telnyx Transactional SMS Implementation Spec

Status: draft
Date: 2026-06-16

## Goal

Add transactional SMS alongside existing customer emails using the existing Telnyx toll-free number.

Primary touchpoints:

1. Purchase confirmation
2. Email bounce / bad email recovery
3. Maybe status update
4. Approval / note sent

## Plan Review

Cleanest phase 1:

- Add a thin Telnyx send wrapper, SMS templates, and SMS delivery logging.
- Store a normalized SMS phone number (`+15551234567`) for send/webhook matching.
- Send transactional outbound SMS from the same code paths that already send emails.
- Include Telnyx delivery webhook handling in phase 1 so we can observe accepted/delivered/failed state.
- Keep email as the source of detailed communication.
- Keep bounce recovery manual: SMS tells the customer to email support with the corrected email.
- Keep current admin tools and current Resend bounce alert email.
- Add only a minimal Telnyx webhook for signature verification, idempotency, STOP/START state, inbound logging, and delivery receipts.

Do not add:

- SMS conversation state
- AI reply interpretation
- New bounce-correction admin UI
- New email correction tables
- SMS links to notes/PDFs/verifiers

Out of scope for first release:

- Marketing SMS
- AI-managed email correction
- Inbound SMS reply parsing for email correction
- New admin UI for bounce correction
- Sending doctor's notes, PDFs, diagnoses, symptoms, DOB, or other PHI by SMS
- Auto-updating customer email from an inbound text without admin review

## Current Repo State

Current email senders live in `src/lib/email.ts`.

Current customer-facing email triggers:

- Purchase confirmation: `src/app/api/webhooks/stripe-prod3/route.ts`
- Maybe update: `moveSubmissionToMaybe` in `src/app/admin/actions.ts`
- Approval note delivery: `approveSubmission` and `reApproveSubmission` in `src/app/admin/actions.ts`
- Denial/refund: `denySubmission` and `changeSubmissionStatus` in `src/app/admin/actions.ts`
- Resend bounce alert: `src/app/api/webhooks/resend/route.ts`

Existing SMS data:

- `Submission.smsOptIn` exists in `prisma/schema.prisma`.
- Consent is captured on review page: `src/app/review/page.tsx`.
- No Telnyx package, wrapper, webhook route, SMS log table, or SMS delivery state exists.

Important boundary:

- Purchase confirmation currently uses a short reference number based on `Submission.id`.
- True Medical Record # is created later by `createNoteVerification` during approval.
- Purchase SMS must say `Ref #`, not `Medical Record #`, unless the MR lifecycle is changed.

## Telnyx Facts To Design Around

Outbound send:

- Use Telnyx Messaging API: `POST https://api.telnyx.com/v2/messages`
- Body shape: `{ "from": "+1...", "to": "+1...", "text": "..." }`
- Auth: `Authorization: Bearer TELNYX_API_KEY`

Webhooks:

- Messaging events include `message.received`, `message.sent`, and `message.finalized`.
- Telnyx can send duplicate and out-of-order events.
- Use `data.id` as webhook idempotency key.
- Use `data.occurred_at` when reconciling event order.
- Verify signature against raw body using `telnyx-signature-ed25519`, `telnyx-timestamp`, and `TELNYX_PUBLIC_KEY`.
- Return `2xx` quickly; do not block webhook acknowledgement on slow work.

Toll-free opt-out:

- For Telnyx toll-free numbers, carrier/network opt-out recognizes `STOP`.
- Toll-free opt-in keywords are `START` and `UNSTOP`.
- Telnyx/network sends fixed toll-free auto-responses; do not duplicate the STOP confirmation.
- Still locally treat `UNSUBSCRIBE`, `CANCEL`, `END`, `QUIT`, `STOPALL`, and natural-language stop requests as opt-out if they arrive in the inbound webhook.

Compliance / verification:

- Toll-free number must be verified before production outbound.
- SMS opt-in checkbox must be optional, unchecked by default, branded, separate from terms/email consent, and include STOP, rates, frequency, Terms, and Privacy references.
- Telnyx toll-free verification examples include a customer-support keyword in the opt-in disclosure. If the number is not already verified, confirm with Telnyx that the shorter disclosure is acceptable.

Sources verified 2026-06-16:

- https://developers.telnyx.com/docs/messaging/messages/send-message
- https://developers.telnyx.com/docs/messaging/messages/receiving-webhooks
- https://developers.telnyx.com/docs/messaging/messages/receive-message
- https://support.telnyx.com/en/articles/6989758-toll-free-opt-out-words
- https://support.telnyx.com/en/articles/10729979-toll-free-verification-request-guide

## Data Model

Extend `Submission`:

```prisma
smsOptIn          Boolean   @default(false) @map("sms_opt_in")
smsOptInAt        DateTime? @map("sms_opt_in_at")
smsConsentVersion String?   @map("sms_consent_version")
smsPhoneE164      String?   @map("sms_phone_e164")
smsMessages       SmsMessage[]
```

Add phone-level SMS state:

```prisma
model SmsPhoneState {
  phoneE164   String    @id @map("phone_e164")
  optedOutAt  DateTime? @map("opted_out_at")
  lastOptInAt DateTime? @map("last_opt_in_at")
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")

  @@map("sms_phone_states")
}
```

Add `SmsMessage`:

```prisma
model SmsMessage {
  id                  String    @id @default(uuid())
  submissionId         String?   @map("submission_id")
  submission           Submission? @relation(fields: [submissionId], references: [id], onDelete: SetNull)
  type                String
  direction           String    // outbound | inbound
  to                  String?   // E.164
  from                String?   // E.164
  body                String    @db.Text
  providerMessageId   String?   @unique @map("provider_message_id")
  providerStatus      String?   @map("provider_status")
  errorCode           String?   @map("error_code")
  errorMessage        String?   @map("error_message") @db.Text
  sentAt              DateTime? @map("sent_at")
  receivedAt          DateTime? @map("received_at")
  finalizedAt         DateTime? @map("finalized_at")
  createdAt           DateTime  @default(now()) @map("created_at")
  updatedAt           DateTime  @updatedAt @map("updated_at")

  @@index([submissionId])
  @@index([type])
  @@index([providerStatus])
  @@index([createdAt])
  @@map("sms_messages")
}
```

Add `TelnyxWebhookEvent` for idempotency:

```prisma
model TelnyxWebhookEvent {
  id          String   @id // Telnyx data.id
  eventType   String   @map("event_type")
  occurredAt  DateTime @map("occurred_at")
  processedAt DateTime @default(now()) @map("processed_at")

  @@map("telnyx_webhook_events")
}
```

No new bounce-correction table in phase 1. Keep the existing Resend bounce alert email and use manual admin handling.

Observability rule:

- `SmsMessage.providerMessageId` identifies the Telnyx message.
- `TelnyxWebhookEvent.id` dedupes each Telnyx webhook event.
- `SmsPhoneState.phoneE164` is the source of truth for STOP/START state.
- Do not store `providerEventId` on `SmsMessage`; many webhook events can apply to one message.
- `providerStatus`, `sentAt`, `finalizedAt`, `errorCode`, and `errorMessage` are the admin-facing send/delivery state.

## Environment

Add to `.env.example`:

```bash
TELNYX_API_KEY=
TELNYX_FROM_NUMBER=
TELNYX_PUBLIC_KEY=
TELNYX_WEBHOOK_ENABLED=true
```

Do not print these values in logs or tests.

## Library/API Design

Add `src/lib/phone-utils.ts` helpers or a new `src/lib/sms-phone.ts`:

- `toE164UsPhone(phone: string): string | null`
- Accept existing stored format `(555) 123-4567`.
- Reject anything not exactly 10 US digits after stripping punctuation.

Add `src/lib/sms-templates.ts`:

- Pure functions.
- No provider calls.
- Unit tested for exact text and no PHI.
- Return body strings under 160 chars where practical.

Add `src/lib/telnyx.ts`:

- `sendTelnyxSms(input)`
- Uses `fetch`, no SDK required.
- Writes `SmsMessage` before/after provider call.
- Never throws into payment/admin workflows unless explicitly requested.
- Returns `{ success, providerMessageId?, error? }`.

Suggested signature:

```ts
type SendTelnyxSmsInput = {
  submissionId?: string
  type: 'PURCHASE_CONFIRMATION' | 'MAYBE_UPDATE' | 'APPROVAL_SENT' | 'EMAIL_BOUNCE'
  toPhone: string
  body: string
}
```

Add helper:

```ts
shouldSendTransactionalSms(submission): boolean
```

Rules:

- `submission.smsOptIn === true`
- no `SmsPhoneState.optedOutAt` exists for the destination phone
- `submission.smsPhoneE164` exists, or `submission.phone` normalizes to E.164
- `TELNYX_API_KEY` and `TELNYX_FROM_NUMBER` exist

## Consent UI

Keep SMS optional and unchecked.

Update checkbox copy in `src/app/review/page.tsx`:

```text
By checking this box, you agree to receive transactional SMS Healthcare Alerts about your note from OnlineDoctorNote at the phone number provided. Message frequency may vary. Message and data rates may apply. STOP to opt out. View our Terms of Service and Privacy Policy. We will not share mobile information with third parties for promotional or marketing purposes.
```

Persist:

- `smsOptIn=true`
- `smsOptInAt=now`
- `smsPhoneE164=toE164UsPhone(formData.phone)`
- `smsConsentVersion='transactional-sms-2026-06-16'`

When unchecked:

- `smsOptIn=false`
- `smsOptInAt=null`
- `smsPhoneE164=null`
- `smsConsentVersion=null`

## Touchpoints

### A. Purchase Confirmation

Hook:

- `src/app/api/webhooks/stripe-prod3/route.ts`
- After permanent `Submission` is created.
- Near existing `sendPaymentConfirmationEmail`.

Send:

```text
OnlineDoctorNote: Request received. Ref #78A58D67. Watch your email soon and check spam. STOP to opt out.
```

Notes:

- Use reference number from `submission.id.substring(0, 8).toUpperCase()`.
- Do not call it Medical Record #.
- SMS failure must not fail Stripe webhook.
- Prefer `await sendTransactionalSms(...).catch(...)` before returning webhook response, not untracked fire-and-forget.

### B. Email Bounce / Bad Email Recovery

Hook:

- `src/app/api/webhooks/resend/route.ts`
- After bounced email, email type, and most recent submission are resolved.

Intent:

- If an email bounces, automatically text the submission phone number.
- The text tells the customer the email bounced.
- The customer sends the corrected email address to `hello@onlinedoctornote.com`.
- Staff updates the submission email and resends the relevant email.

Send:

```text
OnlineDoctorNote: Your email bounced. Please email your correct email address to hello@onlinedoctornote.com. STOP to opt out.
```

Behavior:

1. Send SMS if opted in.
2. Keep current admin bounce alert email.
3. Do not auto-update `Submission.email`.
4. Customer emails `hello@onlinedoctornote.com` with the corrected email.
5. Staff updates the submission and resends the relevant email manually.

Why manual first:

- The phone number may be wrong.
- Customer-service email gives staff a normal support trail and avoids SMS parsing.
- The bounced email might correspond to an older submission if emails are reused.

### C. Maybe Status

Hook:

- `moveSubmissionToMaybe` in `src/app/admin/actions.ts`
- Use same gate as `shouldSendEmail`.

Send:

```text
OnlineDoctorNote: Your request needs extra review. Please check your email for details. STOP to opt out.
```

Rules:

- Send only when `reasonConfig.sendsEmail === true`.
- Do not send for `INTERNAL_ONLY`.
- If maybe email fails, still send SMS only if copy remains true. Safer default: send SMS after successful maybe email.

### D. Approval / Note Sent

Hooks:

- `approveSubmission` in `src/app/admin/actions.ts`
- `reApproveSubmission` in `src/app/admin/actions.ts`

Send:

```text
OnlineDoctorNote: Your doctor's note was sent to your email. Check inbox/spam. STOP to opt out.
```

Rules:

- Send after approval email succeeds.
- If approval email fails, do not send "was sent"; optionally send a staff-only/admin warning later.
- Do not include Medical Record # in SMS.
- Do not link directly to the note/PDF by SMS.

### Denial / Refund

Not part of initial customer note, but email parity suggests adding in phase 2.

Phase 2 copy:

```text
OnlineDoctorNote: Your request was not approved and a refund was started. Please check your email for details. STOP to opt out.
```

## Inbound Telnyx Webhook

Add route:

- `src/app/api/webhooks/telnyx/route.ts`

Process:

1. Read raw body.
2. Verify `telnyx-signature-ed25519` and `telnyx-timestamp`.
3. Parse event.
4. Insert `TelnyxWebhookEvent` by `data.id`; if duplicate, return 200.
5. Switch on `data.event_type`.

`message.received`:

- Store inbound `SmsMessage`.
- Normalize inbound body.
- If body is `STOP`: set `SmsPhoneState.optedOutAt=now`; do not send custom STOP reply for toll-free.
- If body is other local opt-out wording: set `SmsPhoneState.optedOutAt=now`; do not send a custom confirmation in phase 1.
- If body is `START` or `UNSTOP`: clear `SmsPhoneState.optedOutAt` only if prior opt-in exists.
- Else store inbound only. Do not parse customer replies for workflow changes in phase 1.

`message.finalized`:

- Locate `SmsMessage` by provider message id.
- Update delivery/failure status, error code, finalized timestamp.
- Do not retry immediately from webhook. Retry policy should be explicit/manual.

## Admin UI

Add basic SMS observability in phase 1.

Minimum admin visibility:

- On submission detail/search result, show latest SMS state per touchpoint:
  - type
  - sent time
  - Telnyx status
  - finalized time
  - failure/error text
- On admin dashboard or search detail, include a compact "SMS log" section with all `SmsMessage` rows for the submission.
- Use simple labels:
  - `Not opted in`
  - `Queued`
  - `Sent`
  - `Delivered`
  - `Failed`
  - `Opted out`

Use current admin surfaces:

- Existing Resend bounce alert email tells staff which submission/email bounced.
- Staff uses existing submission edit/search flows to update email.
- Staff uses existing resend/re-approval paths where available.
- SMS observability is display-only in phase 1; no resend button.

Failure handling:

- Treat Telnyx terminal failed/undelivered state as a failed SMS delivery, not an email bounce.
- Show failure in the SMS log.
- Do not auto-retry from the webhook.
- Staff can use the visible error to decide whether to call/email manually.

Resend behavior:

- If last bounced email type was `payment_confirmation`, resend payment confirmation.
- If `approval`, resend approval email with existing or regenerated PDF using current approval path.
- If `denial`, resend denial email only if refund already exists.
- If `maybe`, resend maybe email if reason still sends email.

Do not expose patient transcript/log data in public GitHub comments or issue bodies.

## Message Safety Rules

SMS may include:

- Brand name
- First name only if desired
- Submission reference number
- Generic status
- Email/spam check instruction
- STOP language

SMS must not include:

- Symptoms
- Diagnosis
- Date of birth
- Full doctor's note contents
- PDF link
- Verification URL
- Detailed denial reason
- Full Medical Record # unless product/legal explicitly approves

Bounce SMS:

- Prefer masked bounced email.
- Full bounced email can remain in admin email/portal.

## Implementation Order

1. DB migration for consent metadata, normalized SMS phone, SMS logs, and webhook idempotency.
2. `toE164UsPhone` helper and tests.
3. SMS template functions and tests.
4. Telnyx send wrapper with mocked tests.
5. Minimal Telnyx webhook for STOP/START/UNSTOP, inbound logging, and delivery receipts.
6. Consent persistence in Stripe webhook create path.
7. Purchase SMS touchpoint.
8. Maybe SMS touchpoint.
9. Approval/re-approval SMS touchpoints.
10. Resend bounce sends email-correction SMS and keeps current admin alert.
11. Admin SMS observability on submission detail/search.
12. Add operational docs/env notes.

Ship phase 1 only after step 11 so outbound sends are observable in the admin portal.

## Tests

Unit:

- `toE164UsPhone`
- SMS templates
- opt-out parser
- masked email helper
- SMS status label mapper

Route/action:

- Stripe webhook creates submission and sends purchase SMS when opted in.
- Stripe webhook does not send SMS when opted out.
- Stripe webhook stores `smsPhoneE164` when opted in.
- Maybe action sends SMS only when maybe email would send.
- Approval action sends SMS only after approval email success.
- Resend bounce sends bounce SMS when opted in.
- Telnyx webhook rejects invalid signature.
- Telnyx webhook dedupes by `data.id`.
- Telnyx inbound STOP sets `SmsPhoneState.optedOutAt`.
- Telnyx `message.finalized` updates `SmsMessage`.
- Admin submission detail exposes SMS sent time and terminal failure state.

Manual production checks:

- Toll-free number is verified in Telnyx.
- Telnyx Messaging Profile webhook URL points to `/api/webhooks/telnyx`.
- Resend webhook still receives bounces.
- Test opt-in purchase sends one SMS and one email.
- Test STOP blocks future SMS.
- Test bounced email sends customer email-correction SMS and current admin alert still sends.
- Confirm admin portal shows SMS sent time/status and failed Telnyx deliveries.

## Open Decisions

1. Should SMS include first name? Safer default: no, except purchase could say `Hi Jason` if product wants it.
2. Should bounce SMS show full email or masked email? Safer default: masked.
3. Should approval SMS send if approval email fails? Safer default: no.
4. Should denial/refund SMS be phase 1? Safer default: phase 2.
5. Should we use Telnyx SDK or raw `fetch`? Safer default: raw `fetch` to avoid dependency unless SDK signature verification is needed.
6. If toll-free verification is not already approved, confirm with Telnyx whether the shorter support-free disclosure is acceptable.
