# Note Verification QR and Public Lookup Spec

## Objective

Add a public verification experience for approved doctor's notes so an employer or school can scan a QR code on the PDF, or manually enter the Medical Record #, and confirm that the note was legitimately issued by Platinum Health Clinic.

The page should verify the document without exposing diagnosis, symptoms, date of birth, full patient name, contact information, payment information, or internal review notes.

## Product Requirements

### Employer / School Flow

1. An approved PDF note includes a verification block near the bottom of the document.
2. The verification block includes:
   - QR code
   - Short verification URL
   - Medical Record #
   - Plain text: `Scan the QR code or visit the secure URL to verify this note.`
3. Scanning the QR code opens a public verification result page.
4. Visiting `/verify` allows a verifier to manually enter the Medical Record #.
5. A valid note shows a Platinum Health Clinic-branded verification result.
6. Invalid, pending, denied, refunded, revoked, or unknown records all receive the same generic failure message.

### Public Result Page Fields

Show only:

- Verification page title: `DOCUMENT VERIFICATION`
- Medical Record #
- Patient initials, for example `J.D.`
- Issue date
- First day off
- Last day off
- Return guidance: `May return after [Last Day Off]`
- Certifying physician name and credentials
- State license number used on the note
- NPI number, if configured
- Platinum Health Clinic contact email for manual follow-up

Do not show:

- Full patient name
- Date of birth
- Diagnosis
- Symptoms
- Absence reason
- Patient email or phone
- Payment information
- Admin review fields
- Refund or denial details
- Internal notes

## UX Direction

Use the SickSlip flow as the product pattern, not the TrustMedical QR-only license pattern.

The TrustMedical-style QR proves a physician license exists, but it does not prove this specific note was issued. The QR should verify the exact document.

Recommended visual direction:

- Quiet, clinical, Platinum Health Clinic-branded.
- Mobile-first, because many verifiers will scan on a phone.
- No marketing hero.
- No diagnosis or medical explanation copy.
- Clear success/failure state.
- `noindex` metadata on all verification routes.

Suggested success heading:

```text
DOCUMENT VERIFICATION
```

Suggested verification instruction:

```text
Please compare the information below with the document provided to confirm validity.
```

Suggested failure copy:

```text
We could not verify this document.
Please check the Medical Record # and try again. If you still need help, contact Platinum Health Clinic.
```

## Return Date Decision

Do not display an auto-calculated `Return Date` as a standalone field for MVP.

Use:

```text
May return after [Last Day Off]
```

Reasoning:

- The current PDF already uses this wording.
- `Last Day Off + 1 calendar day` can be misleading when the next day is a weekend, holiday, or non-scheduled day.
- A true return date would need explicit doctor approval or a business/school schedule model.

If the customer insists on a field named `Return Date`, add a stored `returnDate` value to the verification snapshot and require the doctor/admin approval UI to set or confirm it. Do not infer it silently.

## Existing App Fit

The app already stores most required data on `Submission`:

- Patient first and last name
- State
- First day off
- Last day off
- Submission status
- Review timestamp
- Email delivery timestamp

The current PDF already prints:

- `Date Issued`
- `Medical Record #`
- First day off
- Last day off
- Physician name
- State license

Current limitations to fix:

- The PDF Medical Record # is currently derived from the submission ID in the PDF template. Move this into a shared helper or persist it.
- The issue date can be passed during approval but is not persisted. The verification page must show the exact same issue date that appears on the PDF.
- The physician name is partly env-driven in the generator but hardcoded in the PDF template. The PDF and verification snapshot should use one source of truth.
- There is no QR-code dependency or verification route today.

## Recommended Data Model

Create a dedicated verification snapshot table. Do not compute public verification data live from mutable submission fields.

Rationale:

- The public page must match the exact PDF that was issued.
- Doctor credentials, NPI, license mappings, and copy can change later.
- A snapshot allows revocation without deleting the original submission.
- A snapshot avoids exposing unrelated `Submission` fields.

Prisma sketch:

```prisma
enum NoteVerificationStatus {
  ACTIVE
  REVOKED
}

model NoteVerification {
  id                   String                 @id @default(uuid())
  submissionId         String                 @map("submission_id")
  submission           Submission             @relation(fields: [submissionId], references: [id])

  medicalRecordNumber  String                 @unique @map("medical_record_number")
  verificationSlug     String                 @unique @map("verification_slug")
  status               NoteVerificationStatus @default(ACTIVE)

  issueDate            DateTime               @map("issue_date") @db.Date
  patientInitials      String                 @map("patient_initials")
  firstDayOff          DateTime               @map("first_day_off") @db.Date
  lastDayOff           DateTime               @map("last_day_off") @db.Date
  returnGuidance       String                 @map("return_guidance")

  physicianName        String                 @map("physician_name")
  physicianCredentials String                 @map("physician_credentials")
  physicianNpi         String?                @map("physician_npi")
  licenseState         String?                @map("license_state")
  licenseNumber        String?                @map("license_number")

  createdAt            DateTime               @default(now()) @map("created_at")
  updatedAt            DateTime               @updatedAt @map("updated_at")
  revokedAt            DateTime?              @map("revoked_at")

  @@map("note_verifications")
  @@index([submissionId])
  @@index([status])
  @@index([createdAt])
}
```

Add to `Submission`:

```prisma
noteVerifications NoteVerification[]
```

### Medical Record # Format

Use a short, random, non-sequential, human-friendly value. Keep the customer-facing format close to the existing 8-character Medical Record # length:

```text
A7B3C9D2
```

Implementation rules:

- Length: 8 uppercase characters
- Exclude ambiguous characters if practical: `O`, `0`, `I`, `1`
- Enforce uniqueness in the database and retry generation on collision
- Unique database constraint
- Retry on collision

### Verification Slug Format

Use an unguessable URL slug separate from the Medical Record #:

```text
/verify/v_9Nq4Dk2Lm8Ts7RpQ
```

Rules:

- URL-safe
- At least 96 bits of entropy
- Not sequential
- Unique database constraint
- Not derived from patient identity, Stripe ID, or submission UUID

The QR code should point to the slug URL. Manual lookup should accept Medical Record # and redirect to the slug URL after a successful match.

## Approval Flow Changes

Current approval flow:

1. Fetch submission.
2. Generate PDF.
3. Email PDF.
4. Mark submission approved.

Target approval flow:

1. Fetch submission.
2. Validate the submission can be approved.
3. Resolve issue date:
   - Use doctor-selected `evaluationDate` when provided.
   - Otherwise use the existing Eastern Time default.
4. Create a verification snapshot for the note being issued.
5. Generate QR code for the verification URL.
6. Generate PDF using:
   - persisted Medical Record #
   - persisted issue date
   - verification URL
   - QR image
   - snapshot physician/license fields
7. Send approval email with PDF.
8. Persist the verification snapshot and approved submission status.
9. Return success even if email fails, matching current behavior, but keep the verification record active because the PDF was generated.

### Reissue / Reapproval Behavior

If a submission already has a verification record:

- Create a replacement Medical Record # and verification slug for the newly issued PDF.
- Revoke older active public verifiers for the same submission only after the replacement PDF is generated successfully and the submission remains approved.
- A failed replacement PDF must not invalidate the previously active verifier.

If the system supports future "reissue note" behavior:

- Add a separate versioning model.
- Keep each issued PDF tied to its own immutable verifier.

## PDF Changes

Add a verification block near the bottom of the note, above or beside the signature/credential area depending on available space.

Recommended content:

```text
Document Verification
Scan the QR code or visit the secure URL to verify this note:
https://onlinedoctornote.com/verify/v_9Nq4Dk2Lm8Ts7RpQ

Medical Record #: A7B3C9D2
CONFIDENTIAL · This document contains protected health information and is intended solely for the recipient identified above. Unauthorized access, use, disclosure, or distribution is prohibited under 45 CFR § 164 (HIPAA Privacy Rule).
```

Implementation notes:

- Add `qrcode` npm package.
- Generate a QR data URL server-side with the verification URL.
- Pass `verificationUrl`, `medicalRecordNumber`, and `qrCodeDataUrl` into `DoctorNoteTemplate`.
- Render QR via `@react-pdf/renderer` `Image`.
- Avoid external QR-code APIs.
- Keep QR high contrast, at least 90x90 px in the PDF.
- Add tests confirming the PDF renders when verification fields are present.

## Routes

### `/verify`

Public manual lookup page.

Behavior:

- `GET /verify` renders a form.
- Form label: `Medical Record #`
- Placeholder: `A7B3C9D2`
- Server action normalizes the input and looks up an active verification record.
- On success, redirect to `/verify/[verificationSlug]`.
- On failure, show the generic failure state.

Security:

- `noindex`
- `Cache-Control: no-store`
- Rate-limit manual lookup attempts.
- Log only normalized lookup metadata, not patient details.

### `/verify/[slug]`

Public QR landing page.

Behavior:

- Look up an active verification record by `verificationSlug`.
- Join to `Submission` only to confirm the submission status is still `APPROVED` and has not been refunded.
- If valid, render the result page.
- If missing, revoked, or not approved, render the generic failure state.

Security:

- `noindex`
- `Cache-Control: no-store`
- Do not include patient details in page metadata.
- Do not expose whether a record exists but is denied/revoked.

## Lookup Rules

A note verifies only when all are true:

- `NoteVerification.status = ACTIVE`
- `NoteVerification.revokedAt IS NULL`
- Related `Submission.status = APPROVED`
- Related `Submission.refundedAt IS NULL`
- Medical Record # or slug exactly matches after normalization

Invalid response should not distinguish between:

- typo
- non-existent record
- denied note
- pending review
- refunded note
- revoked note
- inactive verification

## Admin Behavior

### Approval

When a doctor approves a note:

- Create a verification snapshot for the issued PDF.
- Generate the PDF with QR and verification URL.
- Revoke older active verification snapshots for the same submission only after the replacement PDF is generated.
- Send email.
- Mark submission approved.

### Denial / Refund After Approval

If an already-approved note is later denied, refunded, or manually invalidated:

- Set `NoteVerification.status = REVOKED`
- Set `revokedAt = now()`
- Public page should show generic failure.

### Admin Search

In admin detail/search views, add a small read-only verification section:

- Medical Record #
- Verification URL
- Status: active/revoked
- Copy URL button
- Revoke button, only if business wants manual revocation

Do not add this to the patient-facing intake flow.

## Physician Credential Source

MVP can keep the single-physician model.

Add or confirm env vars:

```text
DOCTOR_NAME="Jason Buchwald"
DOCTOR_CREDENTIALS="MD FACEP"
DOCTOR_NPI="1558307702"
DOCTOR_SIGNATURE_URL="/images/doctor-signature.png"
```

Use `src/lib/state-licenses.ts` for the state license number.

When creating the verification snapshot, persist:

- doctor display name
- credentials
- NPI
- selected state
- state license number

Do not have the public page dynamically derive these at render time.

Phase 2 option:

- Add a `CertifyingPhysician` table if there will be multiple doctors.
- Link each approved note to the specific physician who signed it.

## Privacy and Compliance Guardrails

HHS guidance says employers can ask employees for a doctor's note, but providers generally cannot disclose information directly to the employer without patient authorization unless another law requires it. The verifier should therefore disclose only the minimum facts required to authenticate the document.

CMS notes that issuance of an NPI does not validate that a provider is licensed or credentialed. The verification page can display the NPI and state license number, but it should not imply that NPI alone proves licensure.

Reference links:

- HHS employer health information guidance: https://www.hhs.gov/hipaa/for-individuals/employers-health-information-workplace/index.html
- CMS NPPES note: https://download.cms.gov/nppes/NPI_Files.html
- SickSlip reference flow: https://www.sickslip.co/verify

## Abuse Protections

MVP minimum:

- Long random Medical Record #
- Unguessable QR slug
- `noindex`
- `no-store`
- Generic failures
- Strict field allowlist on public page

Recommended before launch:

- IP-based rate limiting for manual lookup
- Basic verification event logging:
  - verification ID
  - route type: QR or manual
  - timestamp
  - IP hash or coarse metadata
  - user agent
- Alert on repeated failed attempts from the same source

Avoid:

- Sequential Medical Record numbers
- Search by patient initials
- Search by patient name
- Public API returning raw JSON verification data
- Long-lived CDN caching of verification pages

## Implementation Plan

### Phase 1: Data and Helpers

- Add Prisma model and migration.
- Add Medical Record # generator.
- Add verification slug generator.
- Add patient initials helper.
- Add return guidance helper.
- Add doctor credential helper that combines env and state license data.
- Add tests for normalization and uniqueness helpers.

### Phase 2: Approval and PDF

- Update approval flow to build/reuse verification snapshot.
- Add `qrcode` dependency.
- Add QR generation helper.
- Update `DoctorNoteTemplate` props.
- Replace hardcoded physician display text with passed doctor info.
- Render verification block on PDF.
- Add focused PDF template tests.

### Phase 3: Public Verification Pages

- Add `/verify` manual lookup page.
- Add `/verify/[slug]` result page.
- Add shared verification result component.
- Add generic invalid state.
- Add route metadata and no-cache headers.
- Add server action or route handler for manual lookup.

### Phase 4: Admin Support

- Add verification details to admin search/detail views.
- Add copy URL action.
- Optional: add manual revoke action.
- Ensure revocation occurs if an approved note is later invalidated.

### Phase 5: Rollout

- Deploy migration.
- Ship behind an env flag if desired:

```text
NOTE_VERIFICATION_ENABLED=true
```

- Generate sample PDF locally.
- Verify QR opens the correct page.
- Approve a test submission in staging.
- Verify manual lookup by Medical Record #.
- Verify invalid lookup response.
- Verify denied/pending submissions do not verify.
- Confirm pages are `noindex`.

## Testing Checklist

Unit tests:

- Medical Record # generator format
- Verification slug format
- Input normalization
- Patient initials helper
- Return guidance helper
- Public mapper only exposes allowed fields

Integration tests:

- Approval creates verification snapshot
- Re-approval/reissue creates a replacement verifier and revokes older active verifiers after PDF generation succeeds
- PDF generation receives the persisted Medical Record #
- Manual lookup redirects to slug for active approved note
- Manual lookup fails generically for unknown record
- Slug lookup fails generically for revoked note
- Slug lookup fails generically for pending/denied submission

Visual/manual QA:

- PDF QR scans on phone
- PDF remains legible on one page
- `/verify` mobile form does not clip text
- `/verify/[slug]` mobile result is readable
- Long Medical Record # fits on mobile
- Failure page does not reveal private state

## Open Questions for Customer Review

1. Should the visible domain be `onlinedoctornote.com`, a Platinum Health Clinic domain, or a new dedicated verification domain?
2. What exact NPI should appear for Jason Buchwald, MD FACEP?
3. Should employers see `Patient initials` or no patient identifier at all?
4. Should the page show `May return after Last Day Off`, or does the doctor want to explicitly approve/store a separate return date?
5. Should existing previously issued PDFs be backfilled, or should this apply only to newly approved notes after launch?
6. Should admin users be allowed to manually revoke a verification record?

## MVP Recommendation

Ship only for newly approved notes.

Use:

- Unique Medical Record #
- Unique QR slug
- Snapshot table
- QR on PDF
- `/verify` manual lookup
- `/verify/[slug]` result page
- No diagnosis/symptoms
- No full patient name
- Return guidance as `May return after [Last Day Off]`

Defer:

- Existing PDF backfill
- Multi-physician database model
- State medical-board deep links
- Separate verification domain
- Versioned reissued notes
