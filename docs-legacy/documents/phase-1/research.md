# Phase 1: Frontend Form Intake - Research Document

**Project:** OnlineDoctorNote Telehealth Automation System
**Date:** October 19, 2025
**Focus:** UX Flow, Field Specifications, Technical Implementation

---

## Executive Summary

**Goal:** Reduce 25% drop-off rate through psychology-optimized UX improvements

**Key Changes:**

1. **Split Page 2** from 7 fields → 3 separate pages (reduces cognitive overload)
2. **Remove email confirmation** field (use smart validation instead)
3. **Add early hooks:** Visual timer, social proof, value anchor on Page 1
4. **Personalize after Page 2:** Use first name in all copy
5. **Smart defaults:** Auto-fill dates, auto-detect state from IP
6. **Explore progress bars:** A/B test accelerating, time-based, and phase-based variants

**Form Flow:** 10 pages (was 8) - more pages, but each page has fewer fields = faster completion

---

## Overview

Build a secure, HIPAA-compliant multi-step form that collects patient information, generates unique IDs, integrates Stripe payment ($25), and sends data to backend API.

**Tech Stack:**

- Next.js 15 (App Router) + TypeScript
- Tailwind CSS v4 + shadcn/ui components
- React Hook Form + Zod validation
- Stripe Checkout
- Local Storage for form persistence

---

## Form Flow (10 Pages - Optimized for Conversions)

### Psychology-Based Optimizations

### Implemented to Reduce 25% Drop-off Rate

**Problem 1: Cognitive Overload (Page 2 had 7 fields)**

- ✅ **Split into 3 pages:** Page 2 (3 fields), Page 3 (2 fields), Page 4 (1 field)
- ✅ Each page = quick win, builds momentum and commitment

**Problem 2: Email Confirmation Kills Flow**

- ✅ **Removed confirmation field** completely
- ✅ **Smart inline validation:** Show "✓ Valid email" immediately
- ✅ **Typo detection:** Suggest corrections (@gmial → @gmail)
- ✅ **Post-payment verification:** Send email confirmation after payment instead

**Problem 3: No Early Investment**

- ✅ **Visual timer** on Page 1: "~2 minutes to complete" (creates urgency)
- ✅ **Social proof:** "★★★★★ Join 50,000+ people who got their note in minutes"
- ✅ **Value anchor:** "Save $200+ vs traditional doctor visit"

**Problem 4: Progress Bar Strategy (To Explore)**

- ⏳ **Testing multiple variants:** Accelerating, time-based, phase-based, hybrid
- ⏳ **A/B testing planned:** Track completion rates and drop-off by variant
- ⏳ See "Progress Bar Strategy" section below for details

**Problem 6: Personalization & Engagement**

- ✅ **Use first name** after Page 2 in all headers/copy
- ✅ **Dynamic messaging:** "Got it, [Name]! What do you need this note for?"
- ✅ **Smart defaults:** Pre-fill dates to "today", auto-detect state from IP
- ✅ **Progress feedback:** Traditional progress bar (exploring alternatives)

### Quick Reference

| Page | Title            | Key Fields                                      | Validation                     | Psychology Hook                   |
| ---- | ---------------- | ----------------------------------------------- | ------------------------------ | --------------------------------- |
| 1    | Note Recipient   | Myself/Someone else, Relationship (conditional) | Required                       | Timer + Social proof + Value prop |
| 2    | Basic Info       | First Name, Last Name, DOB                      | 18+ age                        | Quick win (only 3 fields)         |
| 3    | Contact Info     | Email, Phone                                    | Email validation, phone format | Smart validation, no confirmation |
| 4    | State            | Dropdown (44 states)                            | Required                       | Auto-detect from IP               |
| 5    | Note Purpose     | Work/School/Both/Other                          | Required                       | Personalized: "Got it, [Name]!"   |
| 6    | Absence Dates    | First day off, Last day off                     | 7-day restrictions             | Smart defaults (today)            |
| 7    | Absence Reason   | Radio selection                                 | Conditional option             | Personalized copy                 |
| 8    | Symptoms         | Multi-select checkboxes                         | Min 1 required                 | Engaging multi-select             |
| 9    | Review & Confirm | Summary + Terms checkboxes                      | Terms acceptance required      | Edit links with data preserved    |
| 10   | Payment          | Stripe Checkout                                 | $25.00                         | Final push                        |

---

## Page Details

### Page 1: Note Recipient

**Fields:**

- Radio: "Myself" or "Someone else"
- Dropdown (conditional): Relationship - "Parent", "Child", "Sibling", "Other family member", "Spouse/Significant Other", "Friend"

**Conversion Optimizations:**

- **Visual Timer:** Display "~2 minutes to complete" with animated icon
- **Social Proof:** "★★★★★ Join 50,000+ people who got their note in minutes"
- **Value Prop:** "Save $200+ vs traditional doctor visit"
- **Money-back Guarantee Badge:** Visible in sidebar/header

**Logic:** Relationship dropdown appears immediately if "Someone else" selected

---

### Page 2: Basic Information (Split from old Page 2)

**Fields:**

- First Name (text, required)
- Last Name (text, required)
- Date of Birth (date, required)

**Validation:**

- Age:
  - If Page 1 = "Myself": Must be 18+
  - If Page 1 = "Someone else": Any age (caregiver assumed 18+)

**Psychology:**

- Only 3 fields = quick win, builds momentum
- Simple completion creates commitment
- Page completes fast, user feels progress

---

### Page 3: Contact Information (Split from old Page 2)

**Fields:**

- Email Address (email, required)
- Phone Number (tel, required, US format: `(XXX) XXX-XXXX`)

**Validation:**

- **Email:** Smart inline validation
  - Show "✓ Valid email" immediately
  - Check for common typos: @gmial.com → "Did you mean @gmail.com?"
  - No confirmation field required
- **Phone:** Auto-format to `(555) 123-4567` as user types

**Removed:**

- ❌ Email confirmation field (cognitive overload, kills momentum)
- ✅ Will send email verification after payment instead

---

### Page 4: State Selection

**Fields:**

- State (searchable dropdown, required)

**Smart Features:**

- Auto-detect state from IP geolocation
- Pre-select detected state, user confirms or changes
- Show confirmation: "✓ We're available in [State]!"

**Available States (44 total):**
Alabama, Arizona, California, Colorado, Connecticut, Delaware, Florida, Georgia, Hawaii, Idaho, Illinois, Indiana, Iowa, Kansas, Kentucky, Louisiana, Maine, Maryland, Michigan, Minnesota, Mississippi, Missouri, Montana, Nebraska, Nevada, New Hampshire, New Jersey, New Mexico, New York, North Dakota, Ohio, Oklahoma, Pennsylvania, South Dakota, Tennessee, Texas, Utah, Vermont, Virginia, Washington, West Virginia, Wisconsin, Wyoming

**Excluded:** Alaska, Arkansas, Massachusetts, North Carolina, Oregon, Rhode Island

---

### Page 5: Note Purpose

**Fields:**

- Radio cards: Work, School, Both, Other (with descriptions)

**Personalization (after Page 2):**

- Header: "Got it, **[FirstName]**! What do you need this note for?"
- Sidebar copy uses first name: "[FirstName], your note is minutes away"

---

### Page 6: Absence Dates

**Fields:**

- First Day Off (date picker)
- Last Day Off (date picker)

**Validation:**

- Start date: Max 7 days in past (`[Today - 7]` to `[Today]`)
- End date: Max 7 days from start date (`[Start]` to `[Start + 7]`)
- Show calculated duration: "Total days: X"

**Smart Defaults:**

- Pre-fill both dates to "Today" (most common use case)
- User can adjust if needed

---

### Page 7: Absence Reason

**Fields:**

- Radio cards: Common cold/flu, Stomach bug, Sore throat, COVID-19, Headache/migraine, Mental health, Injury, Taking care of family\*, Medical appointment, Other

**Personalization:**

- Header: "What's the reason for your absence, **[FirstName]**?"

---

### Page 8: Current Symptoms

**Fields:**

- Multi-select checkboxes (grouped):
  - **General:** Fever/chills, Fatigue, Body aches, Headache
  - **Respiratory:** Cough, Sore throat, Congestion, Shortness of breath, Loss of smell/taste
  - **Digestive:** Nausea/vomiting, Diarrhea, Abdominal pain, Loss of appetite
  - **Mental Health:** Anxiety, Depression, Stress/burnout, Sleep disturbance
  - **Injury:** Pain, Swelling, Limited mobility, Bruising
  - **Other:** Other (text field appears if checked)

**Validation:** Minimum 1 symptom required

---

### Page 9: Review & Confirm

**Display:**

- Summary of all entered data
- Edit button next to each section (returns to that page with data preserved)
- Price: $24.95
- Processing time: 15-30 minutes
- Delivery: Email

**Required Checkboxes:**

- ☑ "I certify that the information provided is accurate and truthful"
- ☑ "I agree to the Terms of Service and Privacy Policy"

**Personalization:**

- Header: "Almost there, **[FirstName]**! Review your information"
- Button: "Continue to Payment" (disabled until both checked)

---

### Page 10: Stripe Checkout

**Implementation:**

- Redirect to Stripe hosted checkout
- Pre-fill email from form
- Amount: $24.95
- Success → Confirmation page with submission ID
- Failure → Return to Page 8 with error

---

## Conditional Logic Summary

```
Page 1: "Someone else" selected?
  ├─ Yes → Show relationship dropdown
  └─ No → Hide relationship field

Page 2: Age validation
  ├─ Page 1 = "Myself" → Must be 18+
  └─ Page 1 = "Someone else" → Any age

Pages 5-9: Personalization
  └─ After Page 2 → Use {FirstName} in all headers/copy


Page 8: Symptoms
  └─ "Other" checked → Show text field
```

---

## Progress Bar Strategy (To Explore)

### Current Approach

- Traditional: "Step X of 10"
- Linear progress: Each step = 10% (1/10, 2/10, etc.)

### Alternative Approaches to Test

#### Option 1: Accelerating Progress Bar

**Psychology:** Front-load progress to create momentum

```
Page 1 = 15% (feels like quick start)
Page 2 = 30% (doubled progress, dopamine hit)
Page 3 = 45% (almost halfway!)
Page 4 = 55% (past halfway)
Page 5 = 65%
Page 6 = 75%
Page 7 = 85%
Page 8 = 92%
Page 9 = 98% (review)
Page 10 = Payment (no bar, different UI)
```

**Pros:** User feels fast progress early, committed by halfway point
**Cons:** May feel dishonest if too aggressive

#### Option 2: Time-Based Progress

**Psychology:** More accurate, feels helpful

```
Display: "~1 minute left" or "~30 seconds remaining"
Track actual time spent vs average completion time
Dynamically update based on user speed
```

**Pros:** Feels more honest, creates urgency
**Cons:** Slower users may feel pressure/anxiety

#### Option 3: Phase-Based (Segmented)

**Psychology:** Breaking into chunks reduces overwhelm

```
Phase 1: About You (Pages 1-3) - 33%
Phase 2: Your Situation (Pages 4-6) - 66%
Phase 3: Medical Details (Pages 7-8) - 90%
Phase 4: Confirm (Page 9) - 100%

Visual: 4 segments that fill up, not continuous bar
```

**Pros:** Feels organized, achievable milestones
**Cons:** Loses granular feedback

#### Option 4: Hybrid Approach (Recommended for Testing)

```
Pages 1-3: Show time "~90 seconds left" + phase indicator
Pages 4-9: Show traditional step count "Step 4 of 9"
Page 10: No progress bar (payment focus)

Why: Early pages = time creates urgency
     Later pages = step count shows near completion
```

### A/B Test Plan

1. **Control:** Linear progress (Step X of 10)
2. **Variant A:** Accelerating progress bar
3. **Variant B:** Time-based ("~1 min left")
4. **Variant C:** Phase-based segments

**Metrics to Track:**

- Completion rate by variant
- Time to complete
- Drop-off page (where do users abandon?)
- User feedback/satisfaction

---

## Technical Implementation

### Unique ID Generation

**Format:** `DN-YYYYMMDD-XXXX`

- Prefix: DN (Doctor Note)
- Date: YYYYMMDD
- Random: 4-char alphanumeric (1.6M combinations/day)
- Generated server-side for security
- Example: `DN-20251019-A7K2`

### Form State Management

**Strategy:** Local Storage + Server submission

- Auto-save form state on each step: `localStorage.setItem('form-draft', JSON.stringify(formData))`
- Restore on mount: `const savedData = localStorage.getItem('form-draft')`
- Clear on successful payment
- Persist across page refreshes
- No server-side session until final submission

### Validation Libraries

```bash
npm install react-hook-form @hookform/resolvers zod
```

**Zod Schema Example:**

```typescript
const personalInfoSchema = z
  .object({
    email: z.string().email(),
    emailConfirm: z.string().email(),
    firstName: z.string().min(1).max(50),
    phone: z.string().regex(/^\(\d{3}\) \d{3}-\d{4}$/),
    dateOfBirth: z.date(),
    pronouns: z.enum(['he/him', 'she/her', 'they/them']),
  })
  .refine((data) => data.email.toLowerCase() === data.emailConfirm.toLowerCase(), {
    message: 'Email addresses must match',
    path: ['emailConfirm'],
  })
```

### API Endpoint

**Route:** `/app/api/submit/route.ts` (App Router style)

**Request:**

```typescript
{
  // Page 1
  noteRecipient: 'myself' | 'someone_else',
  relationship?: string,

  // Page 2
  firstName: string,
  lastName: string,
  dateOfBirth: string,

  // Page 3
  email: string,
  phone: string,

  // Page 4
  state: string,

  // Page 5
  notePurpose: string,

  // Page 6
  firstDayOff: string,
  lastDayOff: string,

  // Page 7
  absenceReason: string,

  // Page 8
  symptoms: string[],

  // Payment
  stripePaymentId: string,
  submittedAt: string
}
```

**Response:**

```typescript
{
  success: boolean,
  submissionId: string, // DN-YYYYMMDD-XXXX
  message: string
}
```

### Stripe Integration

```bash
npm install stripe @stripe/stripe-js
```

**Flow:**

1. User completes Page 8 → clicks "Continue to Payment"
2. Server creates Stripe Checkout session (`/app/api/create-checkout-session/route.ts`)
3. Redirect to Stripe
4. Payment success → Return with `session_id`
5. Verify payment → Save to database → Show confirmation

**Metadata stored with payment:**

- `submission_id`
- `note_recipient`
- `patient_email`
- `submission_date`

---

## Security & HIPAA Requirements

- ✅ HTTPS/TLS 1.2+ for all data transmission
- ✅ Client-side + server-side validation
- ✅ Stripe handles PCI compliance (no card data stored)
- ✅ Environment variables for secrets (`.env.local`)
- ✅ Rate limiting on API endpoints
- ✅ No PHI in client-side logs or localStorage (use IDs only)
- ✅ Secure headers: HSTS, CSP, X-Frame-Options

---

## Dependencies to Install

```bash
# Form Management & Validation
npm install react-hook-form @hookform/resolvers zod

# Stripe
npm install stripe @stripe/stripe-js

# Utilities
npm install date-fns  # Date handling
```

---

## Implementation Checklist

### Week 1 (5 Days)

**Days 1-2: Form Pages & Psychology Hooks** ✅ COMPLETED

- [x] **Page 1:** Note recipient + conditional relationship
  - [] Add visual timer component (~2 minutes)
  - [x] Add social proof ("50,000+ users")
- [x] **Page 2:** Basic info (First, Last, DOB only - split from old page)
  - [x] Age validation (18+ conditional logic)
- [x] **Page 3:** Contact info (Email, Phone - split from old page)
  - [x] Smart email validation (standard regex for MVP)
  - [x] Remove email confirmation field
  - [x] Auto-format phone number
- [x] **Page 4:** State selection
  - [x] Manual dropdown (IP geolocation for production)
  - [x] Searchable dropdown
- [x] **Page 5:** Note purpose
  - [x] Add personalization: "Got it, [Name]!"
- [x] **Page 6:** Absence dates
  - [x] Smart defaults (pre-fill "today")
  - [x] 7-day validation
- [x] **Page 7:** Absence reason
  - [x] Conditional "Taking care of family"
  - [x] Personalized header
- [x] **Page 8:** Symptoms
  - [x] Multi-select checkboxes with categories
  - [x] Conditional "Other" text field
- [x] **Page 9:** Review & confirm
  - [x] Summary with edit links
  - [x] Terms checkboxes
  - [x] Personalized header

**Days 3-4: Payment Integration** ⏳ PENDING

- [ ] Set up Stripe account (test mode)
- [ ] Create checkout session API route
- [ ] Implement payment flow
- [ ] Create confirmation page (Page 10)

**Day 5: API & Final Integration** ⏳ PENDING

- [ ] Create `/app/api/submit/route.ts`
- [ ] Implement unique ID generation (`DN-YYYYMMDD-XXXX`)
- [ ] Add server-side validation
- [x] Implement local storage form persistence
- [x] Add personalization logic (use firstName throughout)
- [ ] End-to-end testing with payment flow

**Post-Launch: A/B Testing** 📋 PLANNED

- [ ] Set up analytics tracking
- [ ] Test progress bar variants (accelerating, time-based, phase-based)
- [ ] Track drop-off rates by page
- [ ] Measure conversion improvements

---

## Open Questions

1. **Stripe Account** - Who creates/manages?
2. **Legal Documents** - Privacy Policy and Terms of Service URLs?
3. **Confirmation Page** - What info to display after payment?
4. **Email Delivery** - Confirmation email sent immediately or after doctor approval?

---

**Next Step:** Review this flow, then begin implementation!
