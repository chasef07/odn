# PDF Generation with @react-pdf/renderer

**Phase**: 4 (Future Enhancement)
**Date Created**: 2025-11-06
**Status**: Planning / Not Yet Implemented
**Estimated Time**: 1 week

---

## Overview

This document explains how to generate professional PDF doctor's notes programmatically using **@react-pdf/renderer** - a React-based PDF generation library.

**Key Concept**: No template PDF file needed! You create the entire PDF from scratch using React-like code.

---

## What is @react-pdf/renderer?

**@react-pdf/renderer** is a library that lets you create PDF documents using React components.

### Think of it like this:

**Building a Website:**
```tsx
// You write React components
<div>
  <h1>Hello {userName}</h1>
  <p>Welcome to our site!</p>
</div>
// React renders this to HTML in the browser
```

**Building a PDF:**
```tsx
// You write React-like components
<Page>
  <Text style={styles.header}>Hello {userName}</Text>
  <Text>Welcome to our site!</Text>
</Page>
// @react-pdf/renderer renders this to PDF bytes
```

---

## Why @react-pdf/renderer? (No Template Needed!)

### ❌ What We're NOT Doing:
```
1. Create PDF template in Adobe/Canva
2. Upload to Vercel Blob storage
3. Download template at runtime
4. Fill in blank fields
5. Save filled PDF
```

### ✅ What We ARE Doing:
```
1. Write React code that defines the PDF
2. Run renderToBuffer() with patient data
3. Get complete PDF with all data filled in
```

**That's it!** Just 2 steps instead of 5.

---

## Key Benefits

### 1. **No External Storage**
- No Vercel Blob needed
- No S3, no cloud storage
- Template lives in your codebase (free)
- No storage costs

### 2. **Version Controlled**
```bash
git log src/lib/pdf/doctor-note-template.tsx
# See all changes to your PDF template over time
```

### 3. **Easy to Modify**
```tsx
// Want to change header color? Just edit the code:
header: {
  color: '#2c5282',  // Changed from black to blue
}
// Commit, deploy. Done!
```

### 4. **Dynamic Content**
```tsx
{/* Conditional rendering */}
{patient.age < 18 && (
  <Text>Guardian: {guardian.name}</Text>
)}

{/* Loops */}
{symptoms.map(symptom => (
  <Text key={symptom}>• {symptom}</Text>
))}
```

### 5. **Type Safe**
```tsx
interface DoctorNoteProps {
  submission: Submission
  doctor: Doctor
}
// TypeScript ensures correct data
```

### 6. **Fast**
- Generation: 100-500ms per PDF
- Works perfectly in Vercel serverless (well under timeout)
- No heavy dependencies

---

## How It Works

### Core Components

#### 1. `<Document>` - Root Container
```tsx
<Document>
  {/* Pages go here */}
</Document>
```

#### 2. `<Page>` - Individual Pages
```tsx
<Document>
  <Page size="A4">        {/* US Letter, A4, Legal, etc. */}
    {/* Content goes here */}
  </Page>
  <Page size="A4">
    {/* Page 2 content */}
  </Page>
</Document>
```

#### 3. `<View>` - Layout Container (like `<div>`)
```tsx
<View style={{ padding: 20, backgroundColor: '#f0f0f0' }}>
  <Text>This is inside a view</Text>
</View>
```

#### 4. `<Text>` - Display Text (like `<p>` or `<span>`)
```tsx
<Text style={{ fontSize: 16, color: 'blue' }}>
  Hello World
</Text>
```

#### 5. `<Image>` - Display Images
```tsx
<Image
  src="/logo.png"
  style={{ width: 200, height: 100 }}
/>
```

#### 6. `<Link>` - Clickable Links
```tsx
<Link src="https://example.com">
  Visit our website
</Link>
```

---

## Styling with StyleSheet

Styling is similar to CSS but uses a subset of CSS properties.

```typescript
import { StyleSheet } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  container: {
    // Layout
    padding: 20,
    margin: 10,
    flexDirection: 'row',    // Flexbox is supported!

    // Colors
    backgroundColor: '#f5f5f5',
    color: '#333',

    // Text
    fontSize: 12,
    fontWeight: 'bold',      // 'normal', 'bold'
    textAlign: 'center',     // 'left', 'center', 'right'
    lineHeight: 1.5,

    // Borders
    border: '1pt solid black',
    borderRadius: 4,

    // Positioning
    position: 'absolute',
    top: 0,
    left: 0,
  }
})
```

### What's Supported:
- ✅ Flexbox layout
- ✅ Padding, margin
- ✅ Colors (hex, rgb, rgba)
- ✅ Font sizes and weights
- ✅ Borders and border-radius
- ✅ Basic positioning
- ✅ Text alignment

### What's NOT Supported:
- ❌ CSS Grid
- ❌ Complex animations
- ❌ Hover states
- ❌ Media queries
- ❌ Some advanced CSS features

---

## Complete Doctor's Note Example

### Step 1: Create the Template Component

```tsx
// src/lib/pdf/doctor-note-template.tsx
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import type { Submission } from '@prisma/client'

// Define styles
const styles = StyleSheet.create({
  page: {
    padding: 50,
    fontSize: 11,
    fontFamily: 'Helvetica',
    backgroundColor: '#ffffff',
  },

  // Header section
  logo: {
    width: 60,
    height: 60,
    marginBottom: 10,
  },

  header: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 30,
    color: '#1a365d',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  subheader: {
    fontSize: 10,
    textAlign: 'center',
    color: '#666',
    marginBottom: 30,
  },

  // Field container
  field: {
    marginBottom: 15,
    paddingBottom: 10,
    borderBottom: '1pt solid #e2e8f0',
  },

  // Field label (bold)
  label: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#4a5568',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Field value
  value: {
    fontSize: 11,
    color: '#1a202c',
  },

  // Two column layout
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },

  column: {
    width: '48%',
  },

  // Medical statement box
  statement: {
    marginTop: 30,
    marginBottom: 30,
    padding: 20,
    backgroundColor: '#edf2f7',
    borderLeft: '4pt solid #3182ce',
    borderRadius: 4,
  },

  statementText: {
    fontSize: 11,
    lineHeight: 1.6,
    color: '#2d3748',
    textAlign: 'justify',
  },

  // Important notice box
  notice: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#fff5f5',
    border: '1pt solid #fc8181',
    borderRadius: 4,
  },

  noticeText: {
    fontSize: 10,
    color: '#c53030',
    lineHeight: 1.4,
  },

  // Signature section
  signature: {
    marginTop: 50,
    paddingTop: 15,
    borderTop: '2pt solid #2d3748',
  },

  doctorName: {
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 5,
  },

  doctorInfo: {
    fontSize: 10,
    color: '#4a5568',
    marginBottom: 3,
  },

  // Footer
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 50,
    right: 50,
    paddingTop: 10,
    borderTop: '1pt solid #e2e8f0',
  },

  footerText: {
    fontSize: 8,
    color: '#a0aec0',
    textAlign: 'center',
    lineHeight: 1.4,
  },

  // Watermark
  watermark: {
    position: 'absolute',
    top: '40%',
    left: '25%',
    fontSize: 60,
    color: '#f7fafc',
    opacity: 0.3,
    transform: 'rotate(-45deg)',
  },
})

interface DoctorNoteProps {
  submission: Submission
  doctorName: string
  doctorEmail: string
  doctorLicense?: string
}

export const DoctorNoteDocument = ({
  submission,
  doctorName,
  doctorEmail,
  doctorLicense
}: DoctorNoteProps) => {
  // Helper to format dates
  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    })
  }

  // Calculate number of days
  const calculateDays = () => {
    const start = new Date(submission.firstDayOff)
    const end = new Date(submission.lastDayOff)
    const diffTime = Math.abs(end.getTime() - start.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
    return diffDays
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Optional: Company Logo */}
        {/* <Image src="/logo.png" style={styles.logo} /> */}

        {/* Header */}
        <View style={styles.header}>
          <Text>Medical Excuse Note</Text>
        </View>

        <View style={styles.subheader}>
          <Text>Official Medical Documentation for Work/School Absence</Text>
        </View>

        {/* Patient Information - Two Column Layout */}
        <View style={styles.row}>
          <View style={styles.column}>
            <View style={styles.field}>
              <Text style={styles.label}>Patient Name</Text>
              <Text style={styles.value}>
                {submission.patientFirstName} {submission.patientLastName}
              </Text>
            </View>
          </View>

          <View style={styles.column}>
            <View style={styles.field}>
              <Text style={styles.label}>Date of Birth</Text>
              <Text style={styles.value}>
                {formatDate(submission.patientDateOfBirth)}
              </Text>
            </View>
          </View>
        </View>

        {/* Guardian Info (if applicable) */}
        {submission.recipient === 'someone_else' && submission.guardianFirstName && (
          <View style={styles.field}>
            <Text style={styles.label}>Guardian Name</Text>
            <Text style={styles.value}>
              {submission.guardianFirstName} {submission.guardianLastName}
            </Text>
          </View>
        )}

        {/* Absence Dates - Two Column Layout */}
        <View style={styles.row}>
          <View style={styles.column}>
            <View style={styles.field}>
              <Text style={styles.label}>First Day of Absence</Text>
              <Text style={styles.value}>
                {formatDate(submission.firstDayOff)}
              </Text>
            </View>
          </View>

          <View style={styles.column}>
            <View style={styles.field}>
              <Text style={styles.label}>Last Day of Absence</Text>
              <Text style={styles.value}>
                {formatDate(submission.lastDayOff)}
              </Text>
            </View>
          </View>
        </View>

        {/* Total Days */}
        <View style={styles.field}>
          <Text style={styles.label}>Total Days Absent</Text>
          <Text style={styles.value}>
            {calculateDays()} {calculateDays() === 1 ? 'day' : 'days'}
          </Text>
        </View>

        {/* Reason for Absence */}
        <View style={styles.field}>
          <Text style={styles.label}>Reason for Absence</Text>
          <Text style={styles.value}>{submission.absenceReason}</Text>
        </View>

        {/* Symptoms (if provided) */}
        {submission.symptoms && Array.isArray(submission.symptoms) && submission.symptoms.length > 0 && (
          <View style={styles.field}>
            <Text style={styles.label}>Symptoms</Text>
            {(submission.symptoms as string[]).map((symptom, index) => (
              <Text key={index} style={styles.value}>• {symptom}</Text>
            ))}
          </View>
        )}

        {/* Purpose */}
        <View style={styles.field}>
          <Text style={styles.label}>Note Purpose</Text>
          <Text style={styles.value}>
            {submission.notePurpose === 'work' ? 'Work' :
             submission.notePurpose === 'school' ? 'School' :
             submission.notePurpose === 'both' ? 'Work and School' :
             submission.otherNotePurpose || 'Other'}
          </Text>
        </View>

        {/* Medical Statement - Gray Box */}
        <View style={styles.statement}>
          <Text style={styles.statementText}>
            This is to certify that the above-named patient was under my medical care
            and was unable to attend {
              submission.notePurpose === 'work' ? 'work' :
              submission.notePurpose === 'school' ? 'school' :
              submission.notePurpose === 'both' ? 'work/school' :
              'work/school'
            } during the dates listed above due to a medical condition requiring rest and recovery.
            {'\n\n'}
            The patient has been advised to return to normal activities on{' '}
            {formatDate(new Date(new Date(submission.lastDayOff).getTime() + 86400000))}.
          </Text>
        </View>

        {/* Additional Information (if provided) */}
        {submission.additionalInformation && (
          <View style={styles.field}>
            <Text style={styles.label}>Additional Notes</Text>
            <Text style={styles.value}>{submission.additionalInformation}</Text>
          </View>
        )}

        {/* Doctor Signature Section */}
        <View style={styles.signature}>
          <Text style={styles.doctorName}>{doctorName}</Text>
          <Text style={styles.doctorInfo}>Licensed Medical Professional</Text>
          {doctorLicense && (
            <Text style={styles.doctorInfo}>License: {doctorLicense}</Text>
          )}
          <Text style={styles.doctorInfo}>{doctorEmail}</Text>
          <Text style={styles.doctorInfo}>
            Date Issued: {formatDate(new Date())}
          </Text>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            This document was generated electronically and is valid without a physical signature.
            {'\n'}
            For verification purposes, submission ID: {submission.id.substring(0, 8)}
          </Text>
        </View>

        {/* Optional: Watermark */}
        {/* <Text style={styles.watermark}>OFFICIAL</Text> */}
      </Page>
    </Document>
  )
}
```

---

### Step 2: Create the PDF Generator Function

```typescript
// src/lib/pdf/generate-pdf.ts
import { renderToBuffer } from '@react-pdf/renderer'
import { DoctorNoteDocument } from './doctor-note-template'
import type { Submission } from '@prisma/client'

interface GeneratePDFOptions {
  submission: Submission
  doctorName: string
  doctorEmail: string
  doctorLicense?: string
}

/**
 * Generate a doctor's note PDF from a submission
 * @returns PDF as Buffer (can be saved, emailed, etc.)
 */
export async function generateDoctorNotePDF({
  submission,
  doctorName,
  doctorEmail,
  doctorLicense,
}: GeneratePDFOptions): Promise<Buffer> {
  try {
    // Create the React component with data
    const doc = (
      <DoctorNoteDocument
        submission={submission}
        doctorName={doctorName}
        doctorEmail={doctorEmail}
        doctorLicense={doctorLicense}
      />
    )

    // Render to PDF buffer (this is the magic!)
    const pdfBuffer = await renderToBuffer(doc)

    console.log('✅ PDF generated successfully', {
      submissionId: submission.id,
      size: `${(pdfBuffer.length / 1024).toFixed(2)} KB`,
    })

    return pdfBuffer
  } catch (error) {
    console.error('❌ PDF generation failed:', error)
    throw new Error(`Failed to generate PDF: ${error.message}`)
  }
}

/**
 * Helper: Save PDF to file (for testing)
 */
export async function savePDFToFile(
  pdfBuffer: Buffer,
  filename: string
): Promise<void> {
  const fs = await import('fs/promises')
  await fs.writeFile(filename, pdfBuffer)
  console.log(`PDF saved to ${filename}`)
}
```

---

### Step 3: Integrate with Approval Flow

```typescript
// src/lib/automation/handle-approval.ts
import prisma from '@/lib/prisma'
import { generateDoctorNotePDF } from '@/lib/pdf/generate-pdf'
import { sendApprovalEmail } from '@/lib/email/send-approval-email'

export async function handleApprovalAutomation(submissionId: string) {
  try {
    // 1. Fetch submission with doctor info
    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
      include: {
        reviewedByDoctor: true,
      },
    })

    if (!submission || !submission.reviewedByDoctor) {
      throw new Error('Submission or doctor not found')
    }

    // 2. Generate PDF
    const pdfBuffer = await generateDoctorNotePDF({
      submission,
      doctorName: submission.reviewedByDoctor.email, // TODO: Add name field to Doctor model
      doctorEmail: submission.reviewedByDoctor.email,
      doctorLicense: process.env.DOCTOR_LICENSE_NUMBER, // Optional
    })

    // 3. Send email with PDF attachment
    await sendApprovalEmail({
      toEmail: submission.email,
      patientName: `${submission.patientFirstName} ${submission.patientLastName}`,
      pdfBuffer,
      submissionId: submission.id,
    })

    // 4. Update timestamp
    await prisma.submission.update({
      where: { id: submissionId },
      data: {
        approvalEmailSentAt: new Date(),
      },
    })

    console.log('✅ Approval automation completed', {
      submissionId,
      email: submission.email,
      pdfSize: `${(pdfBuffer.length / 1024).toFixed(2)} KB`,
    })

    return { success: true }
  } catch (error) {
    console.error('❌ Approval automation failed:', error)

    // Log to monitoring service (Sentry, etc.)
    // await logError(error)

    throw error
  }
}
```

---

### Step 4: Update Admin Actions

```typescript
// src/app/admin/actions.ts (UPDATED)
import { handleApprovalAutomation } from '@/lib/automation/handle-approval'

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

    // 🔥 Only automate if coming from PENDING_REVIEW (not MAYBE)
    if (submission.status === SubmissionStatus.PENDING_REVIEW) {
      try {
        await handleApprovalAutomation(submissionId)
      } catch (error) {
        console.error('❌ Approval automation failed:', error)
        // Don't fail the approval - just log the error
        // Admin can manually resend email from dashboard
      }
    }

    revalidatePath('/admin')
    revalidatePath('/admin/review')
    revalidatePath('/admin/maybe')

    return { success: true }
  } catch (error) {
    console.error('Error approving submission:', error)
    return { success: false, error: 'Failed to approve submission' }
  }
}
```

---

## Email Integration

```typescript
// src/lib/email/send-approval-email.ts
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

interface SendApprovalEmailOptions {
  toEmail: string
  patientName: string
  pdfBuffer: Buffer
  submissionId: string
}

export async function sendApprovalEmail({
  toEmail,
  patientName,
  pdfBuffer,
  submissionId,
}: SendApprovalEmailOptions) {
  try {
    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || "Doctor's Note <noreply@yourdomain.com>",
      to: toEmail,
      subject: "✅ Your Doctor's Note Has Been Approved",
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #2c5282; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: #f7fafc; padding: 30px; border-radius: 0 0 8px 8px; }
              .button { display: inline-block; background: #3182ce; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
              .steps { background: white; padding: 20px; border-left: 4px solid #3182ce; margin: 20px 0; }
              .footer { text-align: center; color: #718096; font-size: 12px; margin-top: 30px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="margin: 0;">Good News!</h1>
              </div>
              <div class="content">
                <p>Dear ${patientName},</p>

                <p>Your doctor's note request has been <strong>reviewed and approved</strong>.</p>

                <p>Your official doctor's note is attached to this email as a PDF document. You can print it or forward it electronically to your employer or school.</p>

                <div class="steps">
                  <h3 style="margin-top: 0;">Next Steps:</h3>
                  <ol style="margin: 10px 0; padding-left: 20px;">
                    <li>Download the attached PDF file</li>
                    <li>Save a copy for your records</li>
                    <li>Submit to your employer or school as required</li>
                    <li>Keep this email for reference</li>
                  </ol>
                </div>

                <p><strong>File Details:</strong></p>
                <ul>
                  <li>Filename: doctors-note-${submissionId.substring(0, 8)}.pdf</li>
                  <li>Size: ${(pdfBuffer.length / 1024).toFixed(2)} KB</li>
                  <li>Format: PDF (printable)</li>
                </ul>

                <p style="margin-top: 30px;">If you have any questions or need assistance, please reply to this email.</p>

                <p>Thank you for using our service!</p>

                <p style="margin-top: 20px;">
                  <strong>Best regards,</strong><br>
                  Online Doctor's Note Team
                </p>
              </div>
              <div class="footer">
                <p>This is an automated email. Please do not reply directly.</p>
                <p>Reference ID: ${submissionId}</p>
              </div>
            </div>
          </body>
        </html>
      `,
      attachments: [
        {
          filename: `doctors-note-${patientName.replace(/\s+/g, '-')}.pdf`,
          content: pdfBuffer,
        },
      ],
    })

    if (error) {
      throw new Error(`Resend error: ${error.message}`)
    }

    console.log('✅ Approval email sent', {
      emailId: data?.id,
      to: toEmail,
    })

    return { success: true, emailId: data?.id }
  } catch (error) {
    console.error('❌ Failed to send approval email:', error)
    throw error
  }
}
```

---

## Testing the PDF Generation

### Local Testing Script

```typescript
// scripts/test-pdf-generation.ts
import prisma from '../src/lib/prisma'
import { generateDoctorNotePDF, savePDFToFile } from '../src/lib/pdf/generate-pdf'

async function main() {
  // Get a test submission
  const submission = await prisma.submission.findFirst({
    where: {
      status: 'APPROVED'
    }
  })

  if (!submission) {
    console.error('No approved submissions found')
    return
  }

  console.log('Generating PDF for submission:', submission.id)

  // Generate PDF
  const pdfBuffer = await generateDoctorNotePDF({
    submission,
    doctorName: 'Dr. Chase Fagen',
    doctorEmail: 'fagenchase@gmail.com',
    doctorLicense: 'MD12345',
  })

  // Save to file
  await savePDFToFile(pdfBuffer, `./test-doctor-note-${submission.id}.pdf`)

  console.log('✅ PDF generated successfully!')
  console.log(`Open: ./test-doctor-note-${submission.id}.pdf`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
```

**Run it:**
```bash
npx tsx scripts/test-pdf-generation.ts
```

This will create a PDF file you can open and verify!

---

## Installation & Setup

### Step 1: Install Dependencies

```bash
# PDF generation
npm install @react-pdf/renderer

# Email service
npm install resend

# Type definitions
npm install -D @types/react-pdf
```

### Step 2: Add Environment Variables

```env
# Email Service (Resend)
RESEND_API_KEY=re_xxxxxxxxxxxxx
EMAIL_FROM="Doctor's Note <noreply@yourdomain.com>"

# Doctor Info (for PDF)
DOCTOR_NAME="Dr. Chase Fagen"
DOCTOR_EMAIL="fagenchase@gmail.com"
DOCTOR_LICENSE_NUMBER="MD12345"  # Optional
```

### Step 3: Update .env.example

```env
# Email Service (Resend - get key from: https://resend.com)
RESEND_API_KEY=re_your_api_key_here
EMAIL_FROM="Doctor's Note <noreply@yourdomain.com>"

# Doctor Information (appears on PDF)
DOCTOR_NAME="Dr. Your Name"
DOCTOR_EMAIL="doctor@yourdomain.com"
DOCTOR_LICENSE_NUMBER="MD12345"  # Optional
```

---

## Performance Considerations

### Generation Speed
- **Typical**: 100-300ms per PDF
- **Complex PDF**: 300-500ms
- **Well within Vercel limits**: 10s (Hobby) / 60s (Pro)

### Memory Usage
- **Per PDF**: ~10-50MB during generation
- **Serverless friendly**: Cleans up after request
- **No memory leaks**: Each invocation is fresh

### File Size
- **Typical doctor's note**: 15-30 KB
- **With logo/images**: 50-200 KB
- **Email friendly**: Well under attachment limits

---

## Comparison with Alternatives

| Feature | @react-pdf/renderer | pdf-lib | Puppeteer |
|---------|---------------------|---------|-----------|
| **No Template Needed** | ✅ Yes | ❌ No (needs template) | ✅ Yes |
| **Learning Curve** | Easy (React) | Medium | Medium |
| **Generation Speed** | Fast (100-500ms) | Fast (100-300ms) | Slow (1-3s) |
| **Bundle Size** | Small (~2MB) | Small (~1MB) | Huge (100+MB) |
| **Design Flexibility** | High | Medium | Highest |
| **Works in Serverless** | ✅ Yes | ✅ Yes | ⚠️ Difficult |
| **Cost** | Free | Free | Expensive (needs Pro) |
| **Storage Required** | None | Vercel Blob needed | None |
| **Type Safety** | ✅ TypeScript | ✅ TypeScript | ✅ TypeScript |
| **Recommended?** | ✅ **YES** | ⚠️ If you have designer | ❌ No |

---

## Error Handling

### PDF Generation Errors

```typescript
export async function generateDoctorNotePDF(options: GeneratePDFOptions) {
  try {
    const pdfBuffer = await renderToBuffer(...)
    return pdfBuffer
  } catch (error) {
    console.error('PDF generation failed:', error)

    // Log to monitoring service
    // await Sentry.captureException(error)

    throw new Error(`Failed to generate PDF: ${error.message}`)
  }
}
```

### Email Sending Errors

```typescript
export async function sendApprovalEmail(options: SendApprovalEmailOptions) {
  try {
    await resend.emails.send(...)
  } catch (error) {
    console.error('Email sending failed:', error)

    // Save PDF to database for manual retry?
    // await savePDFToDatabase(options.pdfBuffer, options.submissionId)

    throw new Error(`Failed to send email: ${error.message}`)
  }
}
```

### Automation Flow Errors

```typescript
export async function handleApprovalAutomation(submissionId: string) {
  try {
    // Generate PDF
    const pdfBuffer = await generateDoctorNotePDF(...)
  } catch (pdfError) {
    console.error('PDF generation failed:', pdfError)
    // Should we still send email without attachment? Or fail completely?
    throw new Error('PDF generation failed')
  }

  try {
    // Send email
    await sendApprovalEmail(...)
  } catch (emailError) {
    console.error('Email sending failed:', emailError)
    // Store PDF in database for manual retry?
    // Add "Resend Email" button in admin portal?
    throw new Error('Email sending failed')
  }
}
```

**Decision needed**: What happens if email fails but PDF generated successfully?
- **Option A**: Store PDF in database, add "Resend Email" button in admin
- **Option B**: Fail silently, log error, admin can re-approve
- **Option C**: Add to retry queue (more complex)

---

## Customization Options

### 1. Multiple Templates

```typescript
// Different templates for different purposes
export function getDoctorNoteTemplate(notePurpose: string) {
  switch (notePurpose) {
    case 'work':
      return WorkDoctorNoteDocument
    case 'school':
      return SchoolDoctorNoteDocument
    case 'both':
      return GeneralDoctorNoteDocument
    default:
      return GeneralDoctorNoteDocument
  }
}
```

### 2. Branded PDFs

```tsx
// Add company logo
<Image
  src="/logo.png"
  style={{ width: 100, height: 50, marginBottom: 20 }}
/>

// Custom colors
const styles = StyleSheet.create({
  header: {
    color: '#YOUR_BRAND_COLOR',
  },
  // ...
})
```

### 3. Multi-Language Support

```tsx
const translations = {
  en: {
    header: 'Medical Excuse Note',
    patientName: 'Patient Name',
    // ...
  },
  es: {
    header: 'Nota de Excusa Médica',
    patientName: 'Nombre del Paciente',
    // ...
  },
}

<Text>{translations[language].header}</Text>
```

### 4. QR Codes (for verification)

```bash
npm install qrcode
```

```tsx
import QRCode from 'qrcode'

// Generate QR code as data URL
const qrCodeUrl = await QRCode.toDataURL(`https://yourdomain.com/verify/${submissionId}`)

<Image src={qrCodeUrl} style={{ width: 80, height: 80 }} />
```

---

## Monitoring & Analytics

### Track PDF Generation

```typescript
export async function generateDoctorNotePDF(options: GeneratePDFOptions) {
  const startTime = Date.now()

  try {
    const pdfBuffer = await renderToBuffer(...)
    const duration = Date.now() - startTime

    console.log('✅ PDF generated', {
      submissionId: options.submission.id,
      duration: `${duration}ms`,
      size: `${(pdfBuffer.length / 1024).toFixed(2)} KB`,
    })

    // Track in analytics
    // await analytics.track('pdf_generated', { duration, size })

    return pdfBuffer
  } catch (error) {
    const duration = Date.now() - startTime

    console.error('❌ PDF generation failed', {
      submissionId: options.submission.id,
      duration: `${duration}ms`,
      error: error.message,
    })

    throw error
  }
}
```

### Metrics to Track
- PDF generation time (avg, p95, p99)
- PDF file sizes
- Success/failure rates
- Email delivery rates
- Time from approval to email sent

---

## Cost Breakdown

### PDF Generation
- **@react-pdf/renderer**: Free (open source)
- **Vercel compute**: Included in plan (~0.1-0.5s per generation)

### Email Sending (Resend)
- **Free tier**: 3,000 emails/month
- **Paid tier**: $20/month for 50,000 emails
- **Cost per email**: $0.0004 (after free tier)

### Storage
- **Template storage**: $0 (lives in codebase)
- **PDF storage**: $0 (generated on-demand, sent via email, not stored)

### Total Monthly Cost
- **<3,000 submissions/month**: $0
- **10,000 submissions/month**: $20 (Resend) = $20
- **50,000 submissions/month**: $20 (Resend) = $20

**Very affordable!**

---

## Implementation Timeline

### Week 1: Setup & Basic Template
- Day 1: Install dependencies, set up project structure
- Day 2: Create basic PDF template (no styling)
- Day 3: Test PDF generation locally, iterate on layout
- Day 4: Add styling, make it look professional
- Day 5: Add all submission fields, test with real data

### Week 2: Email Integration
- Day 1: Set up Resend account, configure environment
- Day 2: Create email template (HTML)
- Day 3: Integrate PDF attachment with email
- Day 4: Test email sending locally
- Day 5: Error handling and retries

### Week 3: Automation Integration
- Day 1: Create automation orchestration layer
- Day 2: Integrate with approval flow (status-based)
- Day 3: Add timestamps and tracking
- Day 4: Test end-to-end flow
- Day 5: Bug fixes and refinements

### Week 4: Polish & Deploy
- Day 1: Design polish (colors, spacing, branding)
- Day 2: Add monitoring and logging
- Day 3: Write tests
- Day 4: Documentation
- Day 5: Deploy to production, monitor

---

## Testing Checklist

### PDF Generation
- [ ] PDF generates successfully with all fields
- [ ] Dates format correctly
- [ ] Conditional fields render (guardian info, symptoms)
- [ ] Multi-line text wraps properly
- [ ] Styling looks professional
- [ ] PDF is printable (no cutoff)
- [ ] File size is reasonable (<100 KB)

### Email Integration
- [ ] Email sends with PDF attachment
- [ ] Attachment opens correctly in email clients
- [ ] Email HTML renders in Gmail, Outlook, Apple Mail
- [ ] Spam filters don't block email
- [ ] Unsubscribe link works (if applicable)

### Automation Flow
- [ ] Approval triggers PDF generation
- [ ] Email sends after PDF generation
- [ ] Timestamp updates correctly
- [ ] Error handling works (PDF fails, email fails)
- [ ] MAYBE submissions don't trigger automation
- [ ] PENDING_REVIEW submissions do trigger automation

### Edge Cases
- [ ] Very long patient names
- [ ] Special characters in names (accents, apostrophes)
- [ ] Maximum absence days (7 days)
- [ ] All symptom types render correctly
- [ ] Guardian info shows when applicable
- [ ] Multiple emails to same address

---

## Security Considerations

### PDF Security
- Don't expose internal database IDs (use short hash)
- Don't include sensitive doctor info (home address, phone)
- Consider adding watermark for authenticity
- Optional: Add QR code for verification

### Email Security
- Use verified sending domain (SPF, DKIM, DMARC)
- Don't include clickable links (phishing concern)
- Rate limit email sending
- Track bounces and unsubscribes

### Data Privacy
- Don't store PDFs long-term (generate on-demand)
- HIPAA considerations (if applicable)
- Encrypt PDFs? (probably overkill for doctor's notes)

---

## Future Enhancements

### Phase 5+
1. **PDF Templates Library** - Multiple designs to choose from
2. **Doctor Signature Image** - Upload signature, embed in PDF
3. **Multi-Language Support** - Spanish, French, etc.
4. **PDF Verification Portal** - Employers can verify authenticity
5. **QR Code Verification** - Scan QR to verify online
6. **Custom Branding** - White-label for clinics
7. **Batch PDF Generation** - Generate multiple at once
8. **PDF Storage** - Store in Vercel Blob for re-download

---

## Troubleshooting

### PDF Doesn't Generate
**Symptoms**: Error thrown, no PDF created

**Causes**:
- Missing required fields in submission
- Invalid date formats
- React component error (JSX syntax)

**Solutions**:
- Validate all data before passing to template
- Add try/catch around renderToBuffer()
- Check console logs for React errors

### PDF Looks Wrong
**Symptoms**: Layout broken, text cut off, bad formatting

**Causes**:
- Incorrect StyleSheet syntax
- Text overflow (long strings)
- Wrong page size

**Solutions**:
- Test with various data lengths
- Add text wrapping and overflow handling
- Use Page size="A4" (standard)

### Email Doesn't Send
**Symptoms**: PDF generates but email fails

**Causes**:
- Invalid Resend API key
- Email address blacklisted
- Attachment too large (>40MB)
- Rate limit exceeded

**Solutions**:
- Verify RESEND_API_KEY in environment
- Check Resend dashboard for errors
- Ensure PDF is <10MB (should be ~30KB)
- Implement retry logic

---

## Resources

- @react-pdf/renderer Documentation: https://react-pdf.org/
- Resend Documentation: https://resend.com/docs
- React PDF Examples: https://react-pdf.org/showcase
- Resend React Email: https://react.email (for better email templates)

---

## Summary

**@react-pdf/renderer is the best choice because:**
1. ✅ No template file needed - create PDFs from scratch in code
2. ✅ Fast generation (100-500ms)
3. ✅ Works perfectly in Next.js serverless
4. ✅ Free and open source
5. ✅ Type-safe with TypeScript
6. ✅ Version controlled (template is just code)
7. ✅ Easy to modify and maintain
8. ✅ Dynamic content with React
9. ✅ Small bundle size
10. ✅ Production-ready

**Implementation is straightforward:**
- Write React components that look like PDFs
- Call `renderToBuffer()` with patient data
- Get PDF bytes back
- Attach to email and send

**No Vercel Blob, no storage, no template files needed!**

---

**END OF DOCUMENT**
