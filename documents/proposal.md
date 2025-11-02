# Telehealth Automation System Proposal

**Prepared for:** Dr. Jason Buchwald, OnlineDoctorNote
**Prepared by:** Chase Fagen & Kyle Shechtman, Data Buddies Solutions
**Date:** October 12th, 2025

## 1. Project Overview

This project aims to automate the entire lifecycle of online doctor's note requests, transforming a time-consuming, manual process into a seamless, secure, and scalable digital workflow.

The system will handle every stage of the operation:

- **Intake Form:** A branded, user-friendly online form where patients can submit their information securely. The form includes conditional logic, email verification, and validation to minimize false or incomplete submissions.

- **HIPAA-Compliant Database:** All patient requests, approvals, and notes are stored in a newly designed, encrypted PostgreSQL database hosted on a HIPAA-eligible platform (AWS RDS or equivalent). Each record includes a unique identifier (Note ID) that connects form submissions, doctor approvals, generated PDFs, and verification requests. This ensures full traceability, security, and compliance with healthcare privacy standards.

- **Doctor Review Dashboard:** A streamlined web interface where the doctor can review requests, view patient details, and approve or reject notes with a single click. The interface displays key data and ensures decisions take seconds instead of minutes.

- **Automated PDF Generation:** Once approved, the system dynamically generates a professional, pre-signed PDF note using standardized templates (return-to-work, school, caregiver, etc.). This removes all manual editing and ensures each note maintains a consistent, compliant format.

- **Email Delivery:** The approved note is automatically delivered to the patient via email with a secure, expiring link or attachment.

- **Refund Automation:** For declined notes, the system triggers an automated refund process through Stripe, logging the decision in the database and notifying the patient instantly.

**Result:** A fully automated, HIPAA-compliant telehealth workflow that saves time, scales efficiently, and supports a global-ready infrastructure for rapid expansion.

## 2. Project Phases and Deliverables

### Phase 1: Frontend Form Intake Redesign

- Build a secure, HIPAA-compliant frontend form using Next.js (React framework) with server-side rendering and API routes for fast performance.

- **Form Structure:** Evaluate if the existing fields remain or expand; determine single-page vs. multi-step format for best UX.

- **Unique ID Generation:** Each submission receives a unique identifier linked to the backend database.

- **Payment Integration:** Store Stripe payment ID for refund automation and ensure secure transactions.

- **Email Verification:** Validate that emails match across both confirmation entries.

### Phase 2: PostgreSQL Database on AWS RDS

- Deploy a HIPAA-compliant PostgreSQL database on AWS RDS, replacing Google Sheets for all form data.

- Define a clear database schema for form submissions, approval status, payment IDs, and verification codes.

- Enable secure API connectivity for integration with both the intake form and the admin portal.

### Phase 3: Doctor's Admin Portal

- Develop a secure, HIPAA-compliant web-based portal for the doctor to log in and review submissions.

- The portal will feature a queue of pending requests, allowing approve/deny actions with one click.

- Display minimal PHI while maintaining traceability through the unique note IDs.

- Enable real-time synchronization with the AWS RDS database.

- Integrate visual indicators for approval history, payment tracking, and automated status updates.

### Phase 4: Approval/Denial Automation

- Once a note is approved, trigger automated PDF generation using standardized templates for school, work, or caregiver notes.

- Send approved notes to patients via automated email delivery (using AWS SES or equivalent).

- If denied, trigger Stripe refund automation and send a denial notice to the patient.

## Project Timeline (Estimated 4 Weeks)

| Phase  | Description                                             | Duration |
| ------ | ------------------------------------------------------- | -------- |
| Week 1 | Phase 1: Frontend Form Intake Redesign                  | 5 days   |
| Week 2 | Phase 2: PostgreSQL Database Setup                      | 5 days   |
| Week 3 | Phase 3: Doctor's Admin Portal                          | 5 days   |
| Week 4 | Phase 4: Approval/Denial Automation, QA, and Deployment | 5 days   |

## 3. Cost Breakdown

| Category                      | Description                                                                                                    | Cost       |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------- | ---------- |
| Frontend Form Development     | HIPAA-compliant form with unique ID, secure API integration, email verification, and Stripe Payment ID capture | $1,800     |
| Backend API & Database Setup  | AWS RDS setup, schema design, data encryption, and secure API connectivity                                     | $2,000     |
| Doctor Dashboard UI           | Secure portal for approvals and denials, real-time updates, and minimal PHI display                            | $1,400     |
| Automation & PDF System       | Automated PDF generation, email delivery, Stripe refund automation, and verification ID logging                | $1,800     |
| Testing & Deployment          | End-to-end testing, HIPAA compliance review, and infrastructure optimization                                   | $600       |
| Training & Documentation      | Admin walkthrough, system guide, and 30-day support post-launch                                                | $400       |
| Monthly Hosting & Maintenance | AWS HIPAA-compliant database cloud hosting, email automation, and PDF storage. On-demand technical support     | $299/month |

**Total: $8,000 one-time + $299/month**

## 4. Expected ROI and Value

This automation system is not just a workflow upgrade—it's an infrastructure investment that multiplies revenue and eliminates operational bottlenecks. The goal is to replace the current manual process that limits throughput with a fully automated, HIPAA-compliant, and globally scalable system.

### Business Impact Overview

| Metric            | Current             | With Automation         |
| ----------------- | ------------------- | ----------------------- |
| Notes per day     | 150–200             | 400–600                 |
| Revenue/day       | $3,750–$5,000       | $10,000–$15,000         |
| Monthly Revenue   | $112,500–$150,000   | $300,000–$450,000       |
| Scaling Potential | Limited by manpower | Global, 24/7, unlimited |

This system effectively unlocks **$150,000–$300,000** in additional monthly capacity and removes the ceiling on operational growth.

### ROI Projection

Even at conservative growth assumptions (increasing to just 300 notes/day), the automation system would produce:

- +100 notes/day × $25 = **$2,500/day** additional revenue

- **$75,000/month** in extra capacity

- **Payback Period:** The system's cost is recovered in under one week of additional output, making it a self-funding asset from day one.

- **Annualized Value Creation:** Over **$900,000** in potential revenue unlocked in the first year.

## 5. Payment Terms

- 25% deposit ($2,000) due to begin development.

- 75% balance ($6,000) due upon delivery and approval.

- Payment accepted via Stripe, ACH, or invoice.

## 6. Acceptance

**Signature:** ************\_\_\_************
**Name:** **************\_\_**************
**Date:** **************\_\_\_**************

---

**Prepared by:** Data Buddies Solutions / Chase Fagen & Kyle Shechtman
**Email:** databuddiessolutions@gmail.com
**Website:** www.databuddiessolutions.com
