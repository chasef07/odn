# Spanish localization review inventory

The checked-in Spanish uses formal, plain US Spanish (`usted`) and preserves every stored value,
price, eligibility rule, API field, and payment contract. A qualified bilingual reviewer should
approve the following wording before launch because translation accuracy alone does not establish
medical or legal equivalence.

## Medical and service claims

- Statements about board certification, physician licensure by state, nationwide validity,
  telehealth legitimacy, note acceptance, verification, delivery times, and HIPAA compliance.
- Intake eligibility and boundaries: age 18+, parent or guardian requests, seven-day absence limits,
  retrospective dates, legal matters, FMLA, workers' compensation, disability, insurance claims,
  return-to-work clearance, travel, school, and workplace uses.
- Symptom, injury, mental-health, caregiver, appointment, absence-date, and return-guidance wording.
- Approval, physician-review, denial, payment-success, and verification success/failure notices.

## Refund, price, and payment claims

- Every use of `$24.95`, “100% money-back guarantee,” acceptance-based refund promises, discounts,
  payment errors, and the Terms of Service refund section.
- Stripe renders its own card fields and provider-originated validation in the selected locale. The
  repository controls the surrounding order summary, price, payment, and failure copy.

## Privacy, consent, and messaging

- The complete Privacy Policy, including HIPAA and health information, sensitive information,
  artificial-intelligence products, cookies and analytics, retention, security, data sharing,
  children, and US state privacy rights.
- Transactional SMS consent, message/data-rate language, STOP instructions, marketing restrictions,
  note-verification authorization, and the review-page attestations.

## Legal terms

- The complete Terms of Service, including eligibility, purchases, refunds, prohibited activities,
  intellectual property, third-party content, termination, New York governing law, arbitration,
  disclaimers, limitation of liability, indemnification, California notices, and electronic/SMS
  communications.

## Content not authored or translated by this repository

- The embedded Soro blog feed is externally hosted. Its page title and surrounding site chrome are
  localized here, but individual embedded articles remain controlled by Soro.
- Customer-entered names, free-text symptoms/details, email addresses, phone numbers, medical record
  numbers, physician names/credentials, NPI values, state license numbers, and other identifiers are
  displayed verbatim.
- Customer emails, SMS messages, generated doctor-note PDFs, and internal/admin interfaces are not
  part of the customer-facing website localization in this change.
