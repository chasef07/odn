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

**Two-Table Design with Prisma ORM:**

- **TemporarySubmission** - Staging area during payment processing (deleted after webhook)
- **Submission** - Permanent storage for approved/denied submissions
- Simple, reliable, and HIPAA-compliant
- No complex JOINs needed
- Fast queries for admin dashboard
- Easy to maintain and debug

**Technology Stack:**

- **Prisma ORM** - Type-safe database client
- **PostgreSQL** - Production database
- **Price:** $24.95 per submission

---

## Database Schema

### Prisma Schema

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// Temporary storage during payment processing
model TemporarySubmission {
  id              String   @id @default(uuid())
  paymentIntentId String   @unique @map("payment_intent_id")
  formData        Json     @map("form_data")
  createdAt       DateTime @default(now()) @map("created_at")
  expiresAt       DateTime @map("expires_at")

  @@map("temporary_submissions")
  @@index([expiresAt])
}

// Permanent submission storage
model Submission {
  // Primary Keys & IDs
  id                    String   @id @default(uuid())
  stripePaymentIntentId String   @unique @map("stripe_payment_intent_id")


  // Status Tracking
  status                String   @default("pending_review") // 'pending_review', 'approved', 'denied'

  // State Selection
  state                 String

  // Patient Information
  recipient             String   // 'myself' or 'someone_else'
  patientFirstName      String   @map("patient_first_name")
  patientLastName       String   @map("patient_last_name")
  patientDateOfBirth    DateTime @map("patient_date_of_birth") @db.Date

  // Guardian Information (conditional - only if recipient = 'someone_else')
  guardianFirstName     String?  @map("guardian_first_name")
  guardianLastName      String?  @map("guardian_last_name")
  guardianDateOfBirth   DateTime? @map("guardian_date_of_birth") @db.Date

  // Contact Information
  email                 String
  phone                 String

  // Note Details
  notePurpose           String   @map("note_purpose") // 'work', 'school', 'both', 'other'
  otherNotePurpose      String?  @map("other_note_purpose")

  // Absence Dates
  firstDayOff           DateTime @map("first_day_off") @db.Date
  lastDayOff            DateTime @map("last_day_off") @db.Date
  returnDate            DateTime? @map("return_date") @db.Date

  // Absence Reason
  absenceReason         String   @map("absence_reason")
  otherAbsenceReason    String?  @map("other_absence_reason")

  // Symptoms (conditional - array of strings)
  symptoms              Json?    // ["Fever", "Cough", "Fatigue"]
  otherSymptomText      String?  @map("other_symptom_text")

  // Additional Information
  additionalInformation String?  @map("additional_information") @db.Text


  // Admin Review Fields (filled when doctor reviews)
  reviewedAt            DateTime? @map("reviewed_at")
  reviewedByAdminId     String?   @map("reviewed_by_admin_id")


  // Refund Tracking
  stripeRefundId  String?   @map("stripe_refund_id")  // "re_1ABC123..."
  refundedAt      DateTime? @map("refunded_at")       // When refund was initiated

  // Email Delivery Tracking
  approvalEmailSentAt   DateTime? @map("approval_email_sent_at")
  denialEmailSentAt     DateTime? @map("denial_email_sent_at")

  // Timestamps
  createdAt             DateTime  @default(now()) @map("created_at")
  updatedAt             DateTime  @updatedAt @map("updated_at")

  @@map("submissions")
  @@index([status])
  @@index([email])
  @@index([createdAt])
  @@index([status, createdAt])
}
```

### Field Explanations

#### TemporarySubmission Fields

| Field             | Type          | Purpose                        | Example                                     |
| ----------------- | ------------- | ------------------------------ | ------------------------------------------- |
| `id`              | String (UUID) | Unique temp record identifier  | `550e8400-e29b-41d4-a716-446655440000`      |
| `paymentIntentId` | String        | Stripe payment intent ID       | `pi_3QKxyz123ABC`                           |
| `formData`        | Json          | Complete form data from client | `{ state: "CA", recipient: "myself", ... }` |
| `createdAt`       | DateTime      | When record was created        | `2025-10-30T10:00:00Z`                      |
| `expiresAt`       | DateTime      | Auto-cleanup timestamp         | `2025-10-31T10:00:00Z` (24 hours)           |

#### Submission Fields

| Field                   | Type          | Purpose                               | Example                                |
| ----------------------- | ------------- | ------------------------------------- | -------------------------------------- |
| `id`                    | String (UUID) | Unique submission identifier          | `550e8400-e29b-41d4-a716-446655440000` |
| `stripePaymentIntentId` | String        | Stripe payment ID for refunds         | `pi_3QKxyz123ABC`                      |
| `stripeChargeId`        | String?       | Stripe charge ID (backup)             | `ch_3QKxyz123ABC`                      |
| `paymentAmount`         | Int           | Amount in cents                       | `2495` ($24.95)                        |
| `status`                | String        | Current submission state              | `pending_review`, `approved`, `denied` |
| `state`                 | String        | User's state                          | `California`                           |
| `recipient`             | String        | Who is the note for                   | `myself`, `someone_else`               |
| `patientFirstName`      | String        | Patient's first name                  | `John`                                 |
| `patientLastName`       | String        | Patient's last name                   | `Doe`                                  |
| `patientDateOfBirth`    | DateTime      | Patient's DOB                         | `1990-05-15`                           |
| `guardianFirstName`     | String?       | Guardian's first name (if applicable) | `Jane`                                 |
| `guardianLastName`      | String?       | Guardian's last name (if applicable)  | `Doe`                                  |
| `guardianDateOfBirth`   | DateTime?     | Guardian's DOB (if applicable)        | `1985-03-20`                           |
| `email`                 | String        | Contact email                         | `john@example.com`                     |
| `phone`                 | String        | Contact phone                         | `(555) 555-1234`                       |
| `notePurpose`           | String        | Purpose of note                       | `work`, `school`, `both`, `other`      |
| `otherNotePurpose`      | String?       | Custom purpose if "other"             | `Court appearance`                     |
| `firstDayOff`           | DateTime      | First absence date                    | `2025-10-28`                           |
| `lastDayOff`            | DateTime      | Last absence date                     | `2025-10-30`                           |
| `returnDate`            | DateTime?     | Return to work/school date            | `2025-10-31`                           |
| `absenceReason`         | String        | Reason for absence                    | `Flu symptoms`                         |
| `otherAbsenceReason`    | String?       | Custom reason if "Other"              | `Food poisoning`                       |
| `symptoms`              | Json?         | Array of symptoms or relationships    | `["Fever", "Cough", "Fatigue"]`        |
| `otherSymptomText`      | String?       | Custom symptom description            | `Severe migraine`                      |
| `additionalInformation` | String?       | Extra patient notes                   | `Need note for 3 consecutive days`     |
| `certifyAccurate`       | Boolean       | User certified accuracy               | `true`                                 |
| `agreeTerms`            | Boolean       | User agreed to terms                  | `true`                                 |
| `reviewedAt`            | DateTime?     | When doctor reviewed                  | `2025-10-26 14:30:00 UTC`              |
| `reviewedByAdminId`     | String?       | Admin/doctor who reviewed             | `admin-uuid-123`                       |
| `denialReason`          | String?       | Why request was denied                | `Insufficient information provided`    |
| `pdfUrl`                | String?       | Generated PDF location                | `https://storage.../550e8400.pdf`      |
| `pdfGeneratedAt`        | DateTime?     | When PDF was created                  | `2025-10-26 14:35:00 UTC`              |
| `refundedAt`            | DateTime?     | When refund was issued                | `2025-10-26 14:30:00 UTC`              |
| `approvalEmailSentAt`   | DateTime?     | When approval email sent              | `2025-10-26 14:36:00 UTC`              |
| `denialEmailSentAt`     | DateTime?     | When denial email sent                | `2025-10-26 14:31:00 UTC`              |
| `createdAt`             | DateTime      | Record creation time                  | `2025-10-26 10:00:00 UTC`              |
| `updatedAt`             | DateTime      | Last update time                      | `2025-10-26 14:30:00 UTC`              |

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

### Step 1: Patient Fills Out Form

**Frontend Process (Client-Side):**

1. Patient completes multi-step intake form
   - State selection → Who is using → Patient info → (Guardian info if applicable) → Contact → Purpose → Dates → Reason → (Symptoms if applicable) → Additional info → Review
2. Data stored in **localStorage** (Phase 1 implementation) for persistence
3. All fields validated with Zod schemas
4. Progress tracked through conditional steps

**Current Form Fields Collected:**

- State, Recipient
- Patient: firstName, lastName, dateOfBirth
- Guardian (conditional): firstName, lastName, dateOfBirth
- Contact: email, phone
- Note: purpose, otherPurpose, firstDayOff, lastDayOff, returnDate
- Absence: reason, otherReason
- Symptoms (conditional): symptoms array, otherSymptomText
- Additional: additionalInformation
- Terms: certifyAccurate, agreeTerms

### Step 2: Create Payment Intent & Temporary Record

**Frontend Action:** User clicks "Proceed to Payment"

**API Endpoint:** `POST /api/create-payment-intent`

**Request:**

```typescript
{
  formData: {
    state: "California",
    recipient: "myself",
    patientFirstName: "John",
    patientLastName: "Doe",
    // ... all form fields
  }
}
```

**Server Process:**

```typescript
// src/app/api/create-payment-intent/route.ts

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { PrismaClient } from '@prisma/client'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
const prisma = new PrismaClient()

export async function POST(req: NextRequest) {
  const { formData } = await req.json()

  // 1. Create Stripe payment intent
  const paymentIntent = await stripe.paymentIntents.create({
    amount: 2495, // $24.95
    currency: 'usd',
    automatic_payment_methods: { enabled: true },
    metadata: {
      product: 'doctors-note',
      service: 'online-doctor-note',
    },
  })

  // 2. Store form data in temporary table
  const tempSubmission = await prisma.temporarySubmission.create({
    data: {
      paymentIntentId: paymentIntent.id,
      formData: formData,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    },
  })

  // 3. Return client secret for Stripe Elements
  return NextResponse.json({
    clientSecret: paymentIntent.client_secret,
    amount: paymentIntent.amount,
  })
}
```

**What happens:**

- Stripe payment intent created: `pi_ABC123`
- Temporary record created in database with ALL form data
- Client receives payment secret to render Stripe Elements

**Database State (Temporary Table):**

```
temporary_submissions:
┌──────────┬─────────────┬───────────────────────────┬────────────┬─────────────┐
│ id       │ payment_... │ form_data (JSON)          │ created_at │ expires_at  │
├──────────┼─────────────┼───────────────────────────┼────────────┼─────────────┤
│ temp-123 │ pi_ABC123   │ {state:"CA",recipient:... │ 10:00 AM   │ +24 hours   │
└──────────┴─────────────┴───────────────────────────┴────────────┴─────────────┘
```

### Step 3: User Completes Payment

**Frontend:**

1. Stripe Elements renders payment form
2. User enters card details
3. Stripe processes payment
4. Redirect to `/payment/success?payment_intent=pi_ABC123`

### Step 4: Stripe Webhook Fires (Critical!)

**Webhook Endpoint:** `POST /api/webhooks/stripe`

**Event Type:** `payment_intent.succeeded`

**Server Process:**

```typescript
// src/app/api/webhooks/stripe/route.ts

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { PrismaClient } from '@prisma/client'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
const prisma = new PrismaClient()

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get('stripe-signature')!

  // 1. Verify webhook signature (SECURITY)
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return new Response('Webhook Error', { status: 400 })
  }

  // 2. Handle payment success
  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object as Stripe.PaymentIntent

    // 3. Check for duplicate webhook (idempotency)
    const existing = await prisma.submission.findUnique({
      where: { stripePaymentIntentId: paymentIntent.id },
    })

    if (existing) {
      console.log('Payment already processed')
      return new Response(JSON.stringify({ received: true }), { status: 200 })
    }

    // 4. Retrieve form data from temporary table
    const tempSubmission = await prisma.temporarySubmission.findUnique({
      where: { paymentIntentId: paymentIntent.id },
    })

    if (!tempSubmission) {
      console.error('Temporary submission not found')
      return new Response('Form data not found', { status: 404 })
    }

    const formData = tempSubmission.formData as any

    // 5. Create permanent submission record
    const submission = await prisma.submission.create({
      data: {
        stripePaymentIntentId: paymentIntent.id,
        stripeChargeId: paymentIntent.latest_charge as string,
        paymentAmount: paymentIntent.amount,
        status: 'pending_review',

        // State
        state: formData.state,

        // Patient info
        recipient: formData.recipient,
        patientFirstName: formData.patientFirstName,
        patientLastName: formData.patientLastName,
        patientDateOfBirth: new Date(formData.patientDateOfBirth),

        // Guardian info (conditional)
        guardianFirstName: formData.guardianFirstName || null,
        guardianLastName: formData.guardianLastName || null,
        guardianDateOfBirth: formData.guardianDateOfBirth
          ? new Date(formData.guardianDateOfBirth)
          : null,

        // Contact
        email: formData.email,
        phone: formData.phone,

        // Note details
        notePurpose: formData.notePurpose,
        otherNotePurpose: formData.otherNotePurpose || null,
        firstDayOff: new Date(formData.firstDayOff),
        lastDayOff: new Date(formData.lastDayOff),
        returnDate: formData.returnDate ? new Date(formData.returnDate) : null,

        // Absence
        absenceReason: formData.absenceReason,
        otherAbsenceReason: formData.otherAbsenceReason || null,

        // Symptoms (conditional)
        symptoms: formData.symptoms || null,
        otherSymptomText: formData.otherSymptomText || null,

        // Additional
        additionalInformation: formData.additionalInformation || null,

        // Terms
        certifyAccurate: formData.certifyAccurate || true,
        agreeTerms: formData.agreeTerms || true,
      },
    })

    // 6. Delete temporary record (cleanup)
    await prisma.temporarySubmission.delete({
      where: { id: tempSubmission.id },
    })

    // 7. Optional: Send confirmation email
    // await sendConfirmationEmail(submission.email, submission.id);

    console.log('Submission created:', submission.id)
    return new Response(JSON.stringify({ received: true, submissionId: submission.id }), {
      status: 200,
    })
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 })
}
```

**Database After Webhook:**

```
submissions:
┌──────────┬─────────────┬──────────┬────────┬────────────┬─────────────────┐
│ id       │ stripe_p... │ patient_ │ status │ email      │ created_at      │
├──────────┼─────────────┼──────────┼────────┼────────────┼─────────────────┤
│ 550e8... │ pi_ABC123   │ John Doe │ pending│ john@e...  │ 2025-10-30 10:05│
└──────────┴─────────────┴──────────┴────────┴────────────┴─────────────────┘

temporary_submissions:
(empty - record deleted after processing)
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
  .order('created_at', { ascending: true })

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
import { generateDoctorNote } from '@/lib/pdf-generator'

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
})
```

2. **Upload PDF to S3/Supabase Storage**

```typescript
const fileName = `doctors-notes/${submission.id}.pdf`
const { data, error } = await supabase.storage.from('documents').upload(fileName, pdfBuffer, {
  contentType: 'application/pdf',
  upsert: true,
})

const pdfUrl = supabase.storage.from('documents').getPublicUrl(fileName).data.publicUrl
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
  .eq('id', submission.id)
```

4. **Send Approval Email with PDF**

```typescript
import { sendEmail } from '@/lib/email'

await sendEmail({
  to: submission.email,
  subject: "Your Doctor's Note is Ready",
  html: `
    <h2>Hi ${submission.first_name},</h2>
    <p>Good news! Your doctor's note has been approved.</p>
    <p><strong>Dates Covered:</strong> ${submission.first_day_off} to ${submission.last_day_off}</p>
    <p>Your note is attached to this email.</p>
  `,
  attachments: [
    {
      filename: 'doctors-note.pdf',
      content: pdfBuffer,
    },
  ],
})
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
})
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
  .eq('id', submission.id)
```

3. **Send Denial Email**

```typescript
await sendEmail({
  to: submission.email,
  subject: "Update on Your Doctor's Note Request",
  html: `
    <h2>Hi ${submission.first_name},</h2>
    <p>Unfortunately, we're unable to process your doctor's note request.</p>
    <p><strong>Reason:</strong> ${denialReason}</p>
    <p>A full refund of $${(submission.payment_amount / 100).toFixed(2)} has been issued to your original payment method.</p>
    <p>If you have questions, please reply to this email.</p>
  `,
})
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

### Admin Dashboard Queries (Prisma)

**1. Get All Pending Reviews**

```typescript
const pendingSubmissions = await prisma.submission.findMany({
  where: {
    status: 'pending_review',
  },
  select: {
    id: true,
    patientFirstName: true,
    patientLastName: true,
    email: true,
    state: true,
    firstDayOff: true,
    lastDayOff: true,
    absenceReason: true,
    createdAt: true,
  },
  orderBy: {
    createdAt: 'asc',
  },
})
```

**2. Get Single Submission for Review**

```typescript
const submission = await prisma.submission.findUnique({
  where: {
    id: '550e8400-...',
  },
})

// Or with status check
const submission = await prisma.submission.findFirst({
  where: {
    id: '550e8400-...',
    status: 'pending_review',
  },
})
```

**3. Get Admin Dashboard Stats**

```typescript
// Pending count
const pendingCount = await prisma.submission.count({
  where: {
    status: 'pending_review',
  },
})

// Approved today
const approvedToday = await prisma.submission.count({
  where: {
    status: 'approved',
    reviewedAt: {
      gte: new Date(new Date().setHours(0, 0, 0, 0)),
    },
  },
})

// Denied today
const deniedToday = await prisma.submission.count({
  where: {
    status: 'denied',
    reviewedAt: {
      gte: new Date(new Date().setHours(0, 0, 0, 0)),
    },
  },
})

// Total revenue today
const revenueToday = await prisma.submission.aggregate({
  where: {
    createdAt: {
      gte: new Date(new Date().setHours(0, 0, 0, 0)),
    },
  },
  _sum: {
    paymentAmount: true,
  },
})
// Result: revenueToday._sum.paymentAmount / 100 = dollars
```

**4. Search Submissions by Email**

```typescript
const submissions = await prisma.submission.findMany({
  where: {
    email: {
      contains: 'john@example.com',
      mode: 'insensitive',
    },
  },
  orderBy: {
    createdAt: 'desc',
  },
})
```

**5. Get All Refunded Submissions**

```typescript
const refundedSubmissions = await prisma.submission.findMany({
  where: {
    refundedAt: {
      not: null,
    },
  },
  select: {
    id: true,
    patientFirstName: true,
    patientLastName: true,
    email: true,
    denialReason: true,
    paymentAmount: true,
    refundedAt: true,
  },
  orderBy: {
    refundedAt: 'desc',
  },
})
```

### Data Cleanup Queries (Prisma)

**6. Delete Submissions Older Than 30 Days**

```typescript
// Preview what will be deleted
const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

const toDeleteCount = await prisma.submission.count({
  where: {
    createdAt: {
      lt: thirtyDaysAgo,
    },
  },
})

console.log(`Will delete ${toDeleteCount} submissions`)

// Actually delete
const deleteResult = await prisma.submission.deleteMany({
  where: {
    createdAt: {
      lt: thirtyDaysAgo,
    },
  },
})

console.log(`Deleted ${deleteResult.count} submissions`)
```

**7. Delete Expired Temporary Submissions (Cron Job)**

```typescript
// Clean up temporary submissions that have expired
const deleteExpired = await prisma.temporarySubmission.deleteMany({
  where: {
    expiresAt: {
      lt: new Date(),
    },
  },
})

console.log(`Deleted ${deleteExpired.count} expired temporary submissions`)
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
