# Phase 2: Database Design & Submission Workflow

**Project:** OnlineDoctorNote
**Date:** October 26, 2025
**Phase:** Phase 2 - Backend & Admin Dashboard
**Status:** Planning

---

## Table of Contents

1. [Overview](#overview)
2. [Database Schema](#database-schema)
3. [Complete Submission Flow](#complete-submission-flow)
4. [Admin Dashboard Workflow](#admin-dashboard-workflow)
5. [Database Queries](#database-queries)
6. [Implementation Checklist](#implementation-checklist)

---

## Overview

### Phase 2 Goals

This phase adds the backend infrastructure to store, process, and manage patient submissions:

- ✅ Store form data after successful Stripe payment
- ✅ Admin portal for doctors to review submissions
- ✅ Tinder-like approve/deny interface
- ✅ Automatic PDF generation on approval
- ✅ Automatic Stripe refunds on denial
- ✅ 30-day data retention
- ✅ Email notifications for approval/denial

### Architecture Decision

**Single Table Design** - All submission data in one table for simplicity:
- No complex JOINs needed
- Fast queries for admin dashboard
- Easy to maintain and debug
- Sufficient for current business requirements
- Can normalize later if needed

---

## Database Schema

### Single Table: `submissions`

```sql
CREATE TABLE submissions (
  -- Primary Keys & IDs
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_payment_intent_id VARCHAR(255) UNIQUE NOT NULL,
  stripe_charge_id VARCHAR(255),

  -- Payment Information
  payment_amount INTEGER NOT NULL,  -- In cents (2999 = $29.99)

  -- Status Tracking
  status VARCHAR(50) DEFAULT 'pending_review',
  -- Possible values: 'pending_review', 'approved', 'denied'

  -- Patient Information (from intake form)
  recipient VARCHAR(20) NOT NULL,  -- 'myself' or 'someone_else'
  relationship VARCHAR(100),  -- Only filled if recipient = 'someone_else'
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  date_of_birth DATE NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  state VARCHAR(50) NOT NULL,

  -- Note Details
  note_purpose VARCHAR(50) NOT NULL,  -- 'work', 'school', 'both', 'other'
  first_day_off DATE NOT NULL,
  last_day_off DATE NOT NULL,
  absence_reason VARCHAR(100) NOT NULL,
  symptoms JSONB,  -- Array of symptoms: ["fever", "cough", "fatigue"]

  -- Admin Review Fields (filled when doctor reviews)
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by_admin_id UUID,  -- References admin_users table (Phase 2B)
  denial_reason TEXT,  -- Only filled if denied

  -- Document Fields (only if approved)
  pdf_url TEXT,  -- S3 or Supabase Storage URL
  pdf_generated_at TIMESTAMP WITH TIME ZONE,

  -- Refund Tracking (only if denied)
  refunded_at TIMESTAMP WITH TIME ZONE,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Data Integrity Constraints
  CONSTRAINT check_dates CHECK (last_day_off >= first_day_off),
  CONSTRAINT check_status CHECK (status IN ('pending_review', 'approved', 'denied'))
);

-- Indexes for Performance
CREATE INDEX idx_submissions_status ON submissions(status);
CREATE INDEX idx_submissions_email ON submissions(email);
CREATE INDEX idx_submissions_created_at ON submissions(created_at);
CREATE INDEX idx_submissions_stripe_payment_intent ON submissions(stripe_payment_intent_id);
```

### Field Explanations

| Field | Type | Purpose | Example |
|-------|------|---------|---------|
| `id` | UUID | Unique submission identifier | `550e8400-e29b-41d4-a716-446655440000` |
| `stripe_payment_intent_id` | VARCHAR | Stripe payment ID for refunds | `pi_3QKxyz123ABC` |
| `stripe_charge_id` | VARCHAR | Stripe charge ID (backup) | `ch_3QKxyz123ABC` |
| `payment_amount` | INTEGER | Amount in cents | `2999` ($29.99) |
| `status` | VARCHAR | Current submission state | `pending_review`, `approved`, `denied` |
| `recipient` | VARCHAR | Who is the note for | `myself`, `someone_else` |
| `relationship` | VARCHAR | If someone_else | `spouse`, `child`, `parent` |
| `symptoms` | JSONB | Array of symptoms | `["fever", "cough"]` |
| `pdf_url` | TEXT | Generated PDF location | `https://s3.../notes/550e8400.pdf` |
| `denial_reason` | TEXT | Why request was denied | `Insufficient information provided` |
| `refunded_at` | TIMESTAMP | When refund was issued | `2025-10-26 14:30:00 UTC` |

### Status State Machine

```
┌─────────────────┐
│ pending_review  │  ← Initial state (after payment succeeds)
└────────┬────────┘
         │
         ├─────────────────┬─────────────────┐
         │                 │                 │
         ▼                 ▼                 ▼
    ┌─────────┐      ┌─────────┐      ┌─────────┐
    │approved │      │ denied  │      │ maybe?  │ (Future)
    └─────────┘      └─────────┘      └─────────┘
    PDF sent          Refunded         Pending more info
```

**Terminal States:** `approved`, `denied`

---

## Complete Submission Flow

### Step 1: Patient Fills Out Form & Pays

**Frontend Process:**
1. Patient completes 8-step intake form
2. Data stored in localStorage (Phase 1 implementation)
3. Redirected to Stripe payment page
4. Enters payment information
5. Stripe processes payment
6. Stripe redirects to success page: `/payment/success?payment_intent=pi_ABC123`

**What happens to form data:**
- Option A: Store in Stripe metadata during payment intent creation
- Option B: Cache in Redis/memory with payment_intent_id as key
- Option C: Store in temporary table, mark as completed when webhook fires

### Step 2: Stripe Webhook Fires (Critical!)

**Webhook Endpoint:** `POST /api/webhooks/stripe`

**Event Type:** `payment_intent.succeeded`

**Process:**
```typescript
// src/app/api/webhooks/stripe/route.ts

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get('stripe-signature')!;

  // 1. Verify webhook signature
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    return new Response('Webhook signature verification failed', { status: 400 });
  }

  // 2. Handle payment success
  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;

    // 3. Retrieve form data from metadata or cache
    const formData = JSON.parse(paymentIntent.metadata.formData || '{}');

    // 4. Insert into database
    const { data: submission, error } = await supabase
      .from('submissions')
      .insert({
        stripe_payment_intent_id: paymentIntent.id,
        stripe_charge_id: paymentIntent.latest_charge as string,
        payment_amount: paymentIntent.amount,
        status: 'pending_review',

        // Patient info
        recipient: formData.recipient,
        relationship: formData.relationship,
        first_name: formData.firstName,
        last_name: formData.lastName,
        date_of_birth: formData.dateOfBirth,
        email: formData.email,
        phone: formData.phone,
        state: formData.state,

        // Note details
        note_purpose: formData.notePurpose,
        first_day_off: formData.firstDayOff,
        last_day_off: formData.lastDayOff,
        absence_reason: formData.absenceReason,
        symptoms: formData.symptoms,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating submission:', error);
      return new Response('Database error', { status: 500 });
    }

    // 5. Optional: Send confirmation email to patient
    // await sendEmail({
    //   to: formData.email,
    //   subject: 'Payment Received - Doctor\'s Note Request',
    //   body: 'Your request is being reviewed...'
    // });

    return new Response(JSON.stringify({ received: true }), { status: 200 });
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 });
}
```

**Database After Webhook:**
```
submissions table:
┌──────────────┬────────────────────┬────────────────┬────────┬─────────────────┐
│ id           │ stripe_payment_... │ first_name     │ status │ created_at      │
├──────────────┼────────────────────┼────────────────┼────────┼─────────────────┤
│ 550e8400-... │ pi_ABC123          │ John           │ pending│ 2025-10-26 10:00│
└──────────────┴────────────────────┴────────────────┴────────┴─────────────────┘
```

---

## Admin Dashboard Workflow

### Step 3: Doctor Opens Admin Portal

**Admin Dashboard URL:** `/admin/submissions`

**Query to Load Pending Reviews:**
```typescript
// Fetch all pending submissions
const { data: submissions } = await supabase
  .from('submissions')
  .select('*')
  .eq('status', 'pending_review')
  .order('created_at', { ascending: true });

// Returns array of submissions in FIFO order (oldest first)
```

**Dashboard UI:**
```
┌───────────────────────────────────────────────┐
│  ADMIN DASHBOARD                              │
├───────────────────────────────────────────────┤
│  📋 Pending Reviews: 15                       │
│  ✅ Approved Today: 42                        │
│  ❌ Denied Today: 3                           │
├───────────────────────────────────────────────┤
│  [ Start Reviewing ]                          │
└───────────────────────────────────────────────┘
```

### Step 4: Tinder-Like Review Interface

**URL:** `/admin/review`

**UI Layout (One Submission at a Time):**
```
┌─────────────────────────────────────────────────────┐
│  SUBMISSION REVIEW                  [1 of 15]       │
├─────────────────────────────────────────────────────┤
│                                                     │
│  👤 PATIENT INFORMATION                             │
│  ──────────────────────────────────────────────     │
│  Name: John Doe                                     │
│  DOB: 05/15/1990 (Age 35)                          │
│  Email: john@example.com                            │
│  Phone: (555) 555-0123                              │
│  State: California                                  │
│                                                     │
│  📄 NOTE REQUEST                                    │
│  ──────────────────────────────────────────────     │
│  Purpose: Work Excuse                               │
│  Dates Off: October 28-30, 2025 (3 days)           │
│  Reason: Flu symptoms                               │
│  Symptoms: Fever, Cough, Fatigue                    │
│                                                     │
│  🕐 TIMELINE                                        │
│  ──────────────────────────────────────────────     │
│  Submitted: Oct 26, 2025 at 10:00 AM               │
│  Payment: $29.99 (Paid via Stripe)                 │
│                                                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│       [  ❌ DENY  ]           [  ✅ APPROVE  ]      │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Step 5A: Doctor Clicks APPROVE ✅

**Backend Process:**

1. **Generate PDF**
```typescript
import { generateDoctorNote } from '@/lib/pdf-generator';

const pdfBuffer = await generateDoctorNote({
  patientName: `${submission.first_name} ${submission.last_name}`,
  dateOfBirth: submission.date_of_birth,
  state: submission.state,
  notePurpose: submission.note_purpose,
  firstDayOff: submission.first_day_off,
  lastDayOff: submission.last_day_off,
  absenceReason: submission.absence_reason,
  symptoms: submission.symptoms,
  submissionId: submission.id,
});
```

2. **Upload PDF to S3/Supabase Storage**
```typescript
const fileName = `doctors-notes/${submission.id}.pdf`;
const { data, error } = await supabase.storage
  .from('documents')
  .upload(fileName, pdfBuffer, {
    contentType: 'application/pdf',
    upsert: true,
  });

const pdfUrl = supabase.storage
  .from('documents')
  .getPublicUrl(fileName).data.publicUrl;
```

3. **Update Database**
```typescript
const { error } = await supabase
  .from('submissions')
  .update({
    status: 'approved',
    pdf_url: pdfUrl,
    pdf_generated_at: new Date().toISOString(),
    reviewed_at: new Date().toISOString(),
    reviewed_by_admin_id: adminUserId,
  })
  .eq('id', submission.id);
```

4. **Send Approval Email with PDF**
```typescript
import { sendEmail } from '@/lib/email';

await sendEmail({
  to: submission.email,
  subject: 'Your Doctor\'s Note is Ready',
  html: `
    <h2>Hi ${submission.first_name},</h2>
    <p>Good news! Your doctor's note has been approved.</p>
    <p><strong>Dates Covered:</strong> ${submission.first_day_off} to ${submission.last_day_off}</p>
    <p>Your note is attached to this email.</p>
  `,
  attachments: [{
    filename: 'doctors-note.pdf',
    content: pdfBuffer,
  }],
});
```

**Database After Approval:**
```
┌──────────┬────────┬─────────────────────────────┬─────────────────┬─────────────┐
│ id       │ status │ pdf_url                     │ pdf_generated_at│ reviewed_at │
├──────────┼────────┼─────────────────────────────┼─────────────────┼─────────────┤
│ 550e8... │approved│ https://s3.../550e8400.pdf  │ 2025-10-26 14:30│ 2025-10-26..│
└──────────┴────────┴─────────────────────────────┴─────────────────┴─────────────┘
```

### Step 5B: Doctor Clicks DENY ❌

**UI Shows Denial Reason Modal:**
```
┌─────────────────────────────────────────────┐
│  Why are you denying this request?         │
├─────────────────────────────────────────────┤
│  ┌───────────────────────────────────────┐ │
│  │ Insufficient information provided     │ │
│  │                                       │ │
│  └───────────────────────────────────────┘ │
│                                             │
│  Common Reasons:                            │
│  • Insufficient information provided        │
│  • Dates do not qualify                     │
│  • Invalid symptoms for excuse              │
│  • Duplicate request                        │
│                                             │
│  [ Cancel ]          [ Confirm Denial ]    │
└─────────────────────────────────────────────┘
```

**Backend Process:**

1. **Issue Stripe Refund**
```typescript
const refund = await stripe.refunds.create({
  payment_intent: submission.stripe_payment_intent_id,
  reason: 'requested_by_customer',
});
```

2. **Update Database**
```typescript
await supabase
  .from('submissions')
  .update({
    status: 'denied',
    denial_reason: 'Insufficient information provided',
    refunded_at: new Date().toISOString(),
    reviewed_at: new Date().toISOString(),
    reviewed_by_admin_id: adminUserId,
  })
  .eq('id', submission.id);
```

3. **Send Denial Email**
```typescript
await sendEmail({
  to: submission.email,
  subject: 'Update on Your Doctor\'s Note Request',
  html: `
    <h2>Hi ${submission.first_name},</h2>
    <p>Unfortunately, we're unable to process your doctor's note request.</p>
    <p><strong>Reason:</strong> ${denialReason}</p>
    <p>A full refund of $${(submission.payment_amount / 100).toFixed(2)} has been issued to your original payment method.</p>
    <p>If you have questions, please reply to this email.</p>
  `,
});
```

**Database After Denial:**
```
┌──────────┬────────┬─────────────────────────────┬─────────────┬─────────────┐
│ id       │ status │ denial_reason               │ refunded_at │ reviewed_at │
├──────────┼────────┼─────────────────────────────┼─────────────┼─────────────┤
│ 550e8... │ denied │ Insufficient information... │ 2025-10-26..│ 2025-10-26..│
└──────────┴────────┴─────────────────────────────┴─────────────┴─────────────┘
```

### Step 5C: Doctor Clicks MAYBE 🤔 (Future Feature)

**Potential Implementation:**
- Add `maybe` or `needs_info` status
- Store reason: "Need more details about symptoms"
- Send email to patient requesting clarification
- Patient can update submission
- Returns to `pending_review` after update

---

## Database Queries

### Admin Dashboard Queries

**1. Get All Pending Reviews**
```sql
SELECT
  id,
  first_name,
  last_name,
  email,
  state,
  first_day_off,
  last_day_off,
  absence_reason,
  created_at
FROM submissions
WHERE status = 'pending_review'
ORDER BY created_at ASC;
```

**2. Get Single Submission for Review**
```sql
SELECT * FROM submissions
WHERE id = '550e8400-...'
AND status = 'pending_review';
```

**3. Get Admin Dashboard Stats**
```sql
-- Pending count
SELECT COUNT(*) as pending_count
FROM submissions
WHERE status = 'pending_review';

-- Approved today
SELECT COUNT(*) as approved_today
FROM submissions
WHERE status = 'approved'
AND DATE(reviewed_at) = CURRENT_DATE;

-- Denied today
SELECT COUNT(*) as denied_today
FROM submissions
WHERE status = 'denied'
AND DATE(reviewed_at) = CURRENT_DATE;

-- Total revenue today
SELECT SUM(payment_amount) as revenue_today
FROM submissions
WHERE DATE(created_at) = CURRENT_DATE;
```

**4. Search Submissions by Email**
```sql
SELECT * FROM submissions
WHERE email ILIKE '%john@example.com%'
ORDER BY created_at DESC;
```

**5. Get All Refunded Submissions**
```sql
SELECT
  id,
  first_name,
  last_name,
  email,
  denial_reason,
  payment_amount,
  refunded_at
FROM submissions
WHERE refunded_at IS NOT NULL
ORDER BY refunded_at DESC;
```

### Data Cleanup Queries

**6. Delete Submissions Older Than 30 Days**
```sql
-- Preview what will be deleted
SELECT COUNT(*) as to_delete
FROM submissions
WHERE created_at < NOW() - INTERVAL '30 days';

-- Actually delete
DELETE FROM submissions
WHERE created_at < NOW() - INTERVAL '30 days';
```

**7. Archive Before Deletion (Recommended)**
```sql
-- First, export to archive table
INSERT INTO submissions_archive
SELECT * FROM submissions
WHERE created_at < NOW() - INTERVAL '30 days';

-- Then delete from main table
DELETE FROM submissions
WHERE created_at < NOW() - INTERVAL '30 days';
```

---

## Implementation Checklist

### Phase 2A: Database Setup (Week 1)

- [ ] **Set up AWS RDS PostgreSQL instance**
  - [ ] Choose instance type (t3.micro for MVP)
  - [ ] Configure VPC and security groups
  - [ ] Enable automated backups
  - [ ] Set up database credentials in AWS Secrets Manager

- [ ] **Create database and tables**
  - [ ] Run `CREATE TABLE submissions` migration
  - [ ] Create indexes for performance
  - [ ] Set up constraints
  - [ ] Test with sample data

- [ ] **Connect Next.js to database**
  - [ ] Install PostgreSQL client (`pg` or use Supabase client)
  - [ ] Create database utility functions
  - [ ] Test connection from API routes
  - [ ] Add database URL to environment variables

### Phase 2B: Stripe Webhook Integration (Week 1-2)

- [ ] **Implement webhook endpoint**
  - [ ] Create `/api/webhooks/stripe/route.ts`
  - [ ] Add webhook signature verification
  - [ ] Handle `payment_intent.succeeded` event
  - [ ] Store form data in database
  - [ ] Handle errors and edge cases

- [ ] **Configure Stripe webhook**
  - [ ] Add webhook URL in Stripe Dashboard
  - [ ] Test with Stripe CLI: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`
  - [ ] Store webhook secret in environment variables
  - [ ] Test end-to-end flow

- [ ] **Update payment intent creation**
  - [ ] Store form data in Stripe metadata or cache
  - [ ] Add customer email to payment intent
  - [ ] Add submission ID to metadata

### Phase 2C: PDF Generation (Week 2)

- [ ] **Set up PDF generation**
  - [ ] Install `@react-pdf/renderer`
  - [ ] Create doctor's note template
  - [ ] Add doctor signature image
  - [ ] Test PDF output

- [ ] **Set up file storage**
  - [ ] Configure AWS S3 bucket or Supabase Storage
  - [ ] Set up upload function
  - [ ] Configure public URL access
  - [ ] Test file uploads

### Phase 2D: Email System (Week 2)

- [ ] **Set up email service (Resend)**
  - [ ] Create Resend account
  - [ ] Verify sending domain
  - [ ] Get API key
  - [ ] Create email templates

- [ ] **Implement email functions**
  - [ ] Approval email with PDF attachment
  - [ ] Denial email with refund notice
  - [ ] Payment confirmation email (optional)
  - [ ] Test email delivery

### Phase 2E: Admin Dashboard (Week 3-4)

- [ ] **Admin authentication**
  - [ ] Create `admin_users` table
  - [ ] Implement login page
  - [ ] Set up JWT or session-based auth
  - [ ] Add auth middleware

- [ ] **Dashboard pages**
  - [ ] Admin login page (`/admin/login`)
  - [ ] Dashboard home (`/admin`)
  - [ ] Review interface (`/admin/review`)
  - [ ] Submissions list (`/admin/submissions`)

- [ ] **Review functionality**
  - [ ] Implement Tinder-like swipe interface
  - [ ] Add approve button with PDF generation
  - [ ] Add deny button with refund
  - [ ] Add navigation between submissions

### Phase 2F: Testing & Deployment (Week 4)

- [ ] **End-to-end testing**
  - [ ] Test full payment → webhook → database flow
  - [ ] Test approval workflow
  - [ ] Test denial/refund workflow
  - [ ] Test email delivery
  - [ ] Test PDF generation

- [ ] **Data cleanup setup**
  - [ ] Create cron job for 30-day deletion
  - [ ] Set up archive table (optional)
  - [ ] Test deletion logic

- [ ] **Production deployment**
  - [ ] Deploy database migrations
  - [ ] Update environment variables
  - [ ] Configure production Stripe webhook
  - [ ] Set up monitoring and alerts

---

## Future Enhancements (Phase 3+)

### Maybe/Pending Info Status
- Add "Maybe" button for ambiguous cases
- Request additional information from patient
- Allow patient to update submission

### Admin Team Features
- Multiple admin users
- Role-based permissions
- Audit trail of admin actions
- Admin activity dashboard

### Advanced Reporting
- Revenue analytics
- Approval/denial rates
- Average review time
- Most common denial reasons

### Patient Portal
- View submission status
- Download PDF after approval
- Resubmit if denied
- Update contact information

---

## Data Retention Policy

### 30-Day Retention

**What is deleted after 30 days:**
- All patient information
- PDF files from storage
- Database records

**Implementation Options:**

**Option 1: Hard Delete (Recommended for MVP)**
```sql
-- Cron job runs daily
DELETE FROM submissions
WHERE created_at < NOW() - INTERVAL '30 days';
```

**Option 2: Soft Delete (Better for Analytics)**
```sql
-- Add deleted_at column
ALTER TABLE submissions ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;

-- Mark as deleted
UPDATE submissions
SET deleted_at = NOW()
WHERE created_at < NOW() - INTERVAL '30 days';

-- Actually delete after 60 days
DELETE FROM submissions
WHERE deleted_at < NOW() - INTERVAL '30 days';
```

**Option 3: Archive Then Delete (Best for Compliance)**
```sql
-- Archive old submissions
INSERT INTO submissions_archive
SELECT * FROM submissions
WHERE created_at < NOW() - INTERVAL '30 days';

-- Delete from main table
DELETE FROM submissions
WHERE created_at < NOW() - INTERVAL '30 days';
```

**Recommendation:** Start with Option 1 (hard delete), migrate to Option 3 if compliance requires audit trail.

---

## Environment Variables

### Required for Phase 2

```bash
# Existing (Phase 1)
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_PAYMENT_AMOUNT=2999
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Database (Phase 2)
DATABASE_URL=postgresql://user:password@host:5432/dbname
# Or if using Supabase:
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Email (Phase 2)
RESEND_API_KEY=re_...

# File Storage (Phase 2)
# Option A: AWS S3
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_BUCKET=onlinedoctornote-documents
AWS_REGION=us-east-1

# Option B: Supabase Storage (included with Supabase)

# Admin (Phase 2)
ADMIN_JWT_SECRET=your-secret-key-here

# Doctor Info (for PDF template)
DOCTOR_NAME="Dr. Jane Smith"
DOCTOR_LICENSE_NUMBER="MD123456"
CLINIC_NAME="OnlineDoctorNote Medical Services"
CLINIC_ADDRESS="123 Medical St, Suite 100, San Francisco, CA 94102"
```

---

## Technical Stack

### Database
- **PostgreSQL 15+** on AWS RDS
- Alternative: Supabase (managed PostgreSQL)

### File Storage
- **AWS S3** or Supabase Storage
- Public URL access for PDFs

### Email Service
- **Resend** (recommended)
- Alternative: SendGrid, AWS SES

### PDF Generation
- **@react-pdf/renderer**
- Generates PDFs from React components

### Admin Auth
- **Supabase Auth** (if using Supabase)
- Alternative: NextAuth.js with JWT

---

**End of Database Design & Workflow Document**

This document should be updated as implementation progresses and requirements evolve.
