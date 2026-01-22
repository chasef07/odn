# Maybe Queue and Automation Flow Implementation

**Phase**: 3 (Future Enhancement)
**Date Created**: 2025-11-06
**Status**: Planning / Not Yet Implemented
**Estimated Time**: 1-2 days

---

## Overview

This document outlines the implementation plan for:
1. **Maybe Queue Page** - A dedicated interface for doctors to process submissions marked as "Maybe"
2. **Automation Flow** - Automated emails (approval) and refunds (denial) that intelligently skip manual "Maybe" cases

---

## Business Requirements

### Current Problem
- Doctor can mark submissions as "MAYBE" during review
- These submissions accumulate with no dedicated workflow
- Doctor needs to manually create notes and send emails outside the system
- No easy way to track or process the "Maybe" queue

### Solution Goals
1. Create dedicated `/admin/maybe` page to view and process MAYBE submissions
2. Implement automated emails for APPROVED submissions (from PENDING_REVIEW only)
3. Implement automated refunds for DENIED submissions (from PENDING_REVIEW only)
4. Ensure MAYBE submissions can be approved/denied WITHOUT triggering automation (doctor handled manually)

---

## Architecture: Option 1 + Option A (Approved Approach)

### Option 1: Dedicated "Maybe Queue" Page
A separate page at `/admin/maybe` that shows all submissions with status `MAYBE` in a list view with actions.

### Option A: Status-Based Automation
Check the **previous status** before triggering automation. Only automate transitions from `PENDING_REVIEW`.

---

## Implementation Plan

### Part 1: Maybe Queue Page (`/admin/maybe`)

#### Features
- List view (NOT Tinder-style) of all MAYBE submissions
- Sorted by oldest first (FIFO)
- Shows key info per submission:
  - Patient name
  - Email
  - Phone
  - Submission date
  - Days in "Maybe" status
  - Requested absence dates
- Actions per submission:
  - **"Approve"** - Change to APPROVED (NO automation)
  - **"Deny"** - Change to DENIED (NO automation, show reason dialog)
  - **"View Details"** - Open full submission in modal/dialog
- Filter options (optional):
  - All
  - Oldest first
  - Newest first
- Empty state when no maybes exist

#### UI Components Needed
- `/src/app/admin/maybe/page.tsx` - Main maybe queue page
- `/src/components/admin/MaybeSubmissionCard.tsx` - List item component
- Update `/src/app/admin/actions.ts` - Add new server actions

#### Navigation
- Add link to dashboard when `maybeCount > 0`
- Add link to admin layout sidebar (future)

---

### Part 2: Automation Flow (Status-Based)

#### Email Automation (APPROVED)

**Triggers only when**: `PENDING_REVIEW` → `APPROVED`

**Does NOT trigger when**: `MAYBE` → `APPROVED`

**Implementation**:
```typescript
export async function approveSubmission(submissionId: string) {
  try {
    const doctorId = await getCurrentDoctor()

    // Get current submission to check status
    const submission = await prisma.submission.findUnique({
      where: { id: submissionId }
    })

    if (!submission) {
      return { success: false, error: 'Submission not found' }
    }

    // Update to APPROVED
    await prisma.submission.update({
      where: { id: submissionId },
      data: {
        status: SubmissionStatus.APPROVED,
        reviewedByAdminId: doctorId,
        reviewedAt: new Date(),
      },
    })

    // 🔥 KEY: Only automate if transitioning from PENDING_REVIEW
    const shouldAutomate = submission.status === SubmissionStatus.PENDING_REVIEW

    if (shouldAutomate) {
      // ✅ TRIGGER AUTOMATION
      await sendApprovalEmail(submissionId)
      await generateDoctorNotePDF(submissionId)

      // Update email sent timestamp
      await prisma.submission.update({
        where: { id: submissionId },
        data: { approvalEmailSentAt: new Date() }
      })
    }

    revalidatePath('/admin')
    revalidatePath('/admin/review')
    revalidatePath('/admin/maybe')

    return {
      success: true,
      automationTriggered: shouldAutomate
    }
  } catch (error) {
    console.error('Error approving submission:', error)
    return { success: false, error: 'Failed to approve submission' }
  }
}
```

**Email Service Options**:
- Resend (recommended - simple API, generous free tier)
- SendGrid
- Postmark
- AWS SES

**Email Content**:
- Subject: "Your Doctor's Note is Ready"
- Body: Approval message with next steps
- Attachment: PDF doctor's note (see PDF generation below)

**Email Tracking**:
- Update `approvalEmailSentAt` timestamp after successful send
- Store email provider message ID (for debugging)

---

#### Refund Automation (DENIED)

**Triggers only when**: `PENDING_REVIEW` → `DENIED`

**Does NOT trigger when**: `MAYBE` → `DENIED`

**Implementation**:
```typescript
export async function denySubmission(submissionId: string, reason: string) {
  try {
    const doctorId = await getCurrentDoctor()

    // Get current submission
    const submission = await prisma.submission.findUnique({
      where: { id: submissionId }
    })

    if (!submission) {
      return { success: false, error: 'Submission not found' }
    }

    // Update to DENIED
    await prisma.submission.update({
      where: { id: submissionId },
      data: {
        status: SubmissionStatus.DENIED,
        denialReason: reason,
        reviewedByAdminId: doctorId,
        reviewedAt: new Date(),
      },
    })

    // 🔥 KEY: Only automate if transitioning from PENDING_REVIEW
    const shouldAutomate = submission.status === SubmissionStatus.PENDING_REVIEW

    if (shouldAutomate) {
      // ✅ TRIGGER AUTOMATION
      await processRefund(submission.stripePaymentIntentId)
      await sendDenialEmail(submissionId, reason)

      // Update timestamps
      await prisma.submission.update({
        where: { id: submissionId },
        data: {
          refundedAt: new Date(),
          denialEmailSentAt: new Date()
        }
      })
    }

    revalidatePath('/admin')
    revalidatePath('/admin/review')
    revalidatePath('/admin/maybe')

    return {
      success: true,
      automationTriggered: shouldAutomate
    }
  } catch (error) {
    console.error('Error denying submission:', error)
    return { success: false, error: 'Failed to deny submission' }
  }
}
```

**Refund Implementation**:
```typescript
// src/lib/stripe-refund.ts
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-10-29.clover',
})

export async function processRefund(paymentIntentId: string) {
  try {
    // Create refund for the payment intent
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      reason: 'requested_by_customer', // or 'fraudulent' if applicable
    })

    console.log('Refund processed:', refund.id)

    return {
      success: true,
      refundId: refund.id,
      amount: refund.amount,
      status: refund.status,
    }
  } catch (error) {
    console.error('Refund error:', error)
    throw new Error(`Failed to process refund: ${error.message}`)
  }
}
```

**Denial Email Content**:
- Subject: "Update on Your Doctor's Note Request"
- Body: Professional denial message with reason
- Include refund confirmation (processed within 5-10 business days)
- Provide support contact if they have questions

---

### Part 3: PDF Generation for Doctor's Notes

**Library Options**:
- `@react-pdf/renderer` (recommended - JSX-like syntax)
- `jsPDF` (imperative API)
- `puppeteer` (overkill, server-intensive)

**Implementation with @react-pdf/renderer**:

```typescript
// src/lib/pdf-generator.tsx
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import { renderToBuffer } from '@react-pdf/renderer'
import type { Submission } from '@prisma/client'

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 12,
    fontFamily: 'Helvetica',
  },
  header: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  section: {
    marginBottom: 15,
  },
  label: {
    fontWeight: 'bold',
    marginBottom: 5,
  },
  signature: {
    marginTop: 40,
    borderTop: '1px solid black',
    paddingTop: 10,
  },
})

interface DoctorNoteProps {
  submission: Submission
  doctorName: string
}

const DoctorNoteDocument = ({ submission, doctorName }: DoctorNoteProps) => (
  <Document>
    <Page size="A4" style={styles.page}>
      {/* Header */}
      <View style={styles.header}>
        <Text>Medical Excuse Note</Text>
      </View>

      {/* Patient Info */}
      <View style={styles.section}>
        <Text style={styles.label}>Patient Name:</Text>
        <Text>{submission.patientFirstName} {submission.patientLastName}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Date of Birth:</Text>
        <Text>{submission.patientDateOfBirth}</Text>
      </View>

      {/* Absence Info */}
      <View style={styles.section}>
        <Text style={styles.label}>Dates of Absence:</Text>
        <Text>
          From: {submission.firstDayOff}
          {'\n'}
          To: {submission.lastDayOff}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Reason for Absence:</Text>
        <Text>{submission.absenceReason}</Text>
      </View>

      {/* Medical Statement */}
      <View style={styles.section}>
        <Text>
          This is to certify that the above-named patient was under my medical care
          and was unable to attend work/school during the dates listed above due to
          a medical condition.
        </Text>
      </View>

      {/* Signature */}
      <View style={styles.signature}>
        <Text>Dr. {doctorName}</Text>
        <Text>Licensed Medical Professional</Text>
        <Text>Date: {new Date().toLocaleDateString()}</Text>
      </View>
    </Page>
  </Document>
)

export async function generateDoctorNotePDF(
  submission: Submission,
  doctorName: string
): Promise<Buffer> {
  const doc = <DoctorNoteDocument submission={submission} doctorName={doctorName} />
  const pdfBuffer = await renderToBuffer(doc)
  return pdfBuffer
}
```

**Usage in Email Sending**:
```typescript
// src/lib/email-sender.ts
import { Resend } from 'resend'
import { generateDoctorNotePDF } from './pdf-generator'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendApprovalEmail(submissionId: string) {
  // Fetch submission
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: { reviewedByAdmin: true },
  })

  if (!submission) throw new Error('Submission not found')

  // Generate PDF
  const pdfBuffer = await generateDoctorNotePDF(
    submission,
    submission.reviewedByAdmin.email // or doctor name
  )

  // Send email with attachment
  await resend.emails.send({
    from: 'Doctor's Note <noreply@yourdomain.com>',
    to: submission.email,
    subject: "Your Doctor's Note is Ready",
    html: `
      <h1>Your Doctor's Note Has Been Approved</h1>
      <p>Dear ${submission.patientFirstName},</p>
      <p>Your doctor's note request has been reviewed and approved. Please find your official doctor's note attached to this email.</p>
      <p>You can present this note to your employer or school as needed.</p>
      <p>Best regards,<br>Online Doctor's Note Team</p>
    `,
    attachments: [
      {
        filename: `doctors-note-${submissionId}.pdf`,
        content: pdfBuffer,
      },
    ],
  })
}
```

---

## Database Schema

**No changes needed to existing schema!** Current schema already supports this:

```prisma
enum SubmissionStatus {
  PENDING_REVIEW  // Initial state after payment
  APPROVED        // Can come from PENDING_REVIEW (automated) or MAYBE (manual)
  DENIED          // Can come from PENDING_REVIEW (automated) or MAYBE (manual)
  MAYBE           // Set when doctor needs to review manually
}

model Submission {
  // ... existing fields

  status                SubmissionStatus   @default(PENDING_REVIEW)

  // Tracking fields (already exist)
  reviewedAt            DateTime?          @map("reviewed_at")
  reviewedByAdminId     String?            @map("reviewed_by_admin_id")
  approvalEmailSentAt   DateTime?          @map("approval_email_sent_at")
  denialEmailSentAt     DateTime?          @map("denial_email_sent_at")
  denialReason          String?            @map("denial_reason")
  stripeRefundId        String?            @map("stripe_refund_id")
  refundedAt            DateTime?          @map("refunded_at")

  // Relations
  reviewedByAdmin       Doctor?            @relation("ReviewedByDoctor", fields: [reviewedByAdminId], references: [id])
}
```

**Note**: We decided NOT to add `MANUALLY_COMPLETED` status. Instead, use the existing statuses:
- `MAYBE` → `APPROVED` = Manual approval (no automation)
- `MAYBE` → `DENIED` = Manual denial (no automation)

---

## Flow Diagram

```
┌─────────────────────────────────────────────────────────┐
│                  PENDING_REVIEW Queue                   │
│              (Normal Tinder Review Flow)                │
└─────────────────┬───────────────────────────────────────┘
                  │
         ┌────────┼────────┐
         │        │        │
    ┌────▼───┐ ┌─▼──┐ ┌───▼────┐
    │Approve │ │Deny│ │Maybe   │
    └────┬───┘ └─┬──┘ └───┬────┘
         │       │        │
         │       │        ▼
         │       │   ┌─────────────────┐
         │       │   │  MAYBE Queue    │
         │       │   │ (/admin/maybe)  │
         │       │   └────┬─────────┬──┘
         │       │        │         │
         │       │    ┌───▼───┐ ┌──▼──┐
         │       │    │Approve│ │Deny │
         │       │    └───┬───┘ └──┬──┘
         │       │        │        │
         ▼       ▼        ▼        ▼
    ┌────────────────────────────────┐
    │         AUTOMATED?              │
    │  Check: previousStatus ==       │
    │         PENDING_REVIEW?         │
    └────┬─────────────────────┬─────┘
         │                     │
    YES  │                     │  NO
         ▼                     ▼
┌─────────────────┐   ┌──────────────────┐
│  Run Automation │   │  Skip Automation │
│                 │   │                  │
│ APPROVED:       │   │  Doctor already  │
│ • Send email    │   │  handled         │
│ • Generate PDF  │   │  manually        │
│ • Update        │   │                  │
│   timestamp     │   │                  │
│                 │   │                  │
│ DENIED:         │   │                  │
│ • Process       │   │                  │
│   refund        │   │                  │
│ • Send email    │   │                  │
│ • Update        │   │                  │
│   timestamps    │   │                  │
└─────────────────┘   └──────────────────┘
```

---

## File Structure

```
src/
├── app/
│   └── admin/
│       ├── maybe/
│       │   └── page.tsx              # NEW - Maybe queue list view
│       ├── actions.ts                # UPDATED - Add automation logic
│       └── page.tsx                  # UPDATED - Add link to maybe queue
├── components/
│   └── admin/
│       ├── MaybeSubmissionCard.tsx   # NEW - List item for maybe queue
│       └── AdminStats.tsx            # Already shows maybeCount
├── lib/
│   ├── email-sender.ts               # NEW - Email sending logic
│   ├── pdf-generator.tsx             # NEW - PDF generation
│   └── stripe-refund.ts              # NEW - Refund processing
└── prisma/
    └── schema.prisma                 # NO CHANGES NEEDED
```

---

## Dependencies to Install

```bash
# Email service (choose one)
npm install resend              # Recommended
# or
npm install @sendgrid/mail      # Alternative
# or
npm install nodemailer          # Self-hosted

# PDF generation
npm install @react-pdf/renderer

# Type definitions
npm install -D @types/react-pdf
```

---

## Environment Variables Needed

```env
# Email Service (Resend example)
RESEND_API_KEY=re_...

# Or SendGrid
# SENDGRID_API_KEY=SG...

# Or Nodemailer
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_USER=your-email@gmail.com
# SMTP_PASS=your-app-password

# Stripe (already exists)
STRIPE_SECRET_KEY=sk_...

# Doctor info for PDFs
DOCTOR_NAME="Dr. Chase Fagen"
DOCTOR_LICENSE_NUMBER="MD12345"  # Optional
```

---

## Testing Checklist

### Maybe Queue Testing
- [ ] MAYBE submissions appear in `/admin/maybe` page
- [ ] List shows all required info (name, email, dates, etc.)
- [ ] Approve button works from maybe queue
- [ ] Deny button works from maybe queue (shows reason dialog)
- [ ] Empty state shows when no maybes exist
- [ ] Dashboard shows correct maybe count
- [ ] Link to maybe queue appears when count > 0

### Automation Testing
- [ ] PENDING_REVIEW → APPROVED triggers email
- [ ] PENDING_REVIEW → DENIED triggers refund
- [ ] MAYBE → APPROVED does NOT trigger email
- [ ] MAYBE → DENIED does NOT trigger refund
- [ ] PDF generates correctly with all submission data
- [ ] Email sends with PDF attachment
- [ ] Refund processes successfully in Stripe
- [ ] Timestamps update correctly (approvalEmailSentAt, refundedAt, etc.)
- [ ] Error handling for failed emails
- [ ] Error handling for failed refunds

### Edge Cases
- [ ] Submission not found (deleted before action)
- [ ] Stripe refund fails (already refunded, etc.)
- [ ] Email service down (retry logic)
- [ ] PDF generation fails (log error, continue)
- [ ] Multiple doctors reviewing same submission concurrently

---

## Future Enhancements (Phase 4+)

### Email Templates
- Use React Email (https://react.email) for better email design
- Add logo and branding
- Responsive email design
- Plain text fallback

### Maybe Queue Improvements
- Add internal notes field
- Add follow-up date picker
- Add batch actions (approve multiple, etc.)
- Add filters (by date range, reason, etc.)
- Export to CSV

### Notification System
- Email doctor when new submissions arrive
- Slack/Discord webhook integration
- Daily summary email for doctor

### Analytics Dashboard
- Track automation success rate
- Email delivery rates
- Refund processing times
- Average time in maybe queue
- Conversion funnel (submission → approval/denial)

---

## Cost Estimates

### Email Service
- **Resend**: 3,000 emails/month free, then $20/month for 50k
- **SendGrid**: 100 emails/day free, then $19.95/month
- **Postmark**: 100 emails/month free, then $15/month

### PDF Generation
- **@react-pdf/renderer**: Free, runs in Node.js

### Refunds
- **Stripe**: No fees for refunds (original fees not returned)

**Total Estimated Monthly Cost**: $0-20 depending on volume

---

## Implementation Timeline

### Week 1: Core Infrastructure
- Day 1: Set up email service (Resend) + basic template
- Day 2: Implement PDF generation with @react-pdf/renderer
- Day 3: Add Stripe refund processing + error handling
- Day 4: Update approveSubmission() and denySubmission() with automation logic
- Day 5: Testing + bug fixes

### Week 2: Maybe Queue
- Day 1: Create `/admin/maybe/page.tsx` with list view
- Day 2: Add MaybeSubmissionCard component
- Day 3: Update dashboard to link to maybe queue
- Day 4: Testing + bug fixes
- Day 5: Documentation + deployment

---

## Success Metrics

After implementation, track:
- **Automation success rate**: % of emails/refunds that succeed
- **Maybe queue usage**: How many submissions go to maybe
- **Time savings**: Average time doctor spends per submission
- **Patient satisfaction**: Email open rates, support tickets
- **Refund completion rate**: % of refunds that complete successfully

---

## Questions to Answer Before Implementation

1. What should the doctor's note PDF look like? (logo, letterhead, format)
2. Who is the "from" email address? (need to verify domain for email service)
3. Should refunds be full or partial? (currently: full refund)
4. What happens if email fails? Retry? Manual notification?
5. What happens if refund fails? Manual processing? Notify admin?
6. Should we store PDF in database or regenerate on-demand?

---

## Security Considerations

### Email Security
- Use verified sending domain (SPF, DKIM, DMARC)
- Rate limit email sending to prevent abuse
- Sanitize patient data before including in email
- Use TLS for email transmission

### Refund Security
- Verify submission belongs to payment intent before refunding
- Log all refund attempts (success/failure)
- Alert on suspicious refund patterns
- Implement refund approval for high amounts (optional)

### PDF Security
- Don't expose internal IDs in PDF
- Use secure random filenames
- Don't include sensitive doctor info (home address, etc.)
- Watermark PDFs (optional)

---

## Rollback Plan

If automation causes issues:

1. **Disable automation**: Add feature flag in env
   ```env
   ENABLE_EMAIL_AUTOMATION=false
   ENABLE_REFUND_AUTOMATION=false
   ```

2. **Manual fallback**: Doctor processes manually via maybe queue

3. **Gradual rollout**: Enable for 10% of submissions first, monitor for errors

---

## References

- Resend Documentation: https://resend.com/docs
- @react-pdf/renderer: https://react-pdf.org/
- Stripe Refunds API: https://stripe.com/docs/api/refunds
- React Email: https://react.email (for future email templates)

---

## Notes

- This is a comprehensive plan for Phase 3
- Prioritize automation (Part 2) over maybe queue (Part 1) if time is limited
- Can implement email automation first, then refunds later
- PDF generation is required for email automation
- Maybe queue is lower priority but improves workflow

---

## Status Updates

| Date | Update | Status |
|------|--------|--------|
| 2025-11-06 | Document created, approved by client | Planning |
|  |  |  |
|  |  |  |

---

**End of Document**
