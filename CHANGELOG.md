# Changelog

All notable changes to this project will be documented in this file.

## [5.0.0] - 2026-04-19

### Added

- **Shared paid-submission validation layer** — Centralized server-side validation for payment creation and Stripe webhook processing to keep required-field, DOB, guardian, and absence-date rules aligned
- **Date-only validation utilities** — Added deterministic helpers for ISO calendar-date parsing and age checks, plus targeted regression coverage for timezone-sensitive DOB boundaries

### Changed

- **Stripe webhook recovery behavior** — Non-persistable paid submissions now remain retryable for manual recovery instead of being silently acknowledged and orphaned
- **Approval cleanup** — Approve and re-approve flows now clear stale auto-flag denial notes when a doctor moves a submission back to APPROVED

### Fixed

- **DOB timezone bypass** — Server-side age and sane-range checks no longer rely on timestamp parsing that could age patients up early or let future DOBs slip through near timezone boundaries
- **Validation consistency** — Payment intent creation, webhook ingestion, and client-side DOB schema validation now agree on date-only rules and error handling

## [4.5.0] - 2026-03-27

### Added

- **"Why Use Us" homepage section** — Blue background marketing section after hero with 6 benefit cards (Save Money, Save Time, No Insurance, No Driving, No Waiting Rooms, Here to Help)
- **Patient History Popup** — Admin portal shows prior submissions for the same patient (by name+DOB or email) as an amber "N prior" badge during review and in search detail
- **"Under 18" denial reason** — New denial option across all admin views (review, search detail, maybe queue, manual queue) for minors using parent/guardian info
- **Date of Birth input redesign** — Three separate MM/DD/YYYY text inputs with auto-advance, numeric keyboard on mobile, and inline age confirmation display. Replaces native date picker on basic-info and guardian-info pages
- **Search button on all admin screens** — Consistent search navigation added to review, maybe, approved, and denied pages
- **Clickable emails in admin** — Patient emails are now mailto: links across all admin views (review cards, search results, approved/denied lists, maybe queue, search detail)
- **Reddit Pixel tracking** — Global pixel installed in layout for PageVisit tracking (pixel ID: a2_ildu672qliq5)
- **Prisma composite index** — New index on (patientFirstName, patientLastName, patientDateOfBirth) for efficient name+DOB queries

### Changed

- **Monthly limit tracking** — Switched from email-based to name+DOB-based identification (case-insensitive). Harder to bypass with multiple email addresses
- **PDF wording** — "Start Date" / "End Date" changed to "First Day Off" / "Last Day Off" across all three note variants
- **PDF "after" underline** — The word "after" in the return-to-work sentence is now bold and underlined to reduce customer confusion (was #1 customer service issue)
- **Terms of Service** — Updated corporate entity from Plantation Physical Medicine LLC to ODN LLC, registered in Delaware at 5740 SW 67th Avenue, Miami, FL 33143. Refund policy updated to 100% money-back guarantee
- **Privacy Policy** — Updated corporate entity and contact address to match TOS changes
- **Denial reason comment** — Updated Prisma schema comment to reflect all 6 denial reason options

### Fixed

- **Monthly limit bypass** — Patients can no longer bypass the 7-day rolling limit by using different email addresses
- **Accessibility** — DateOfBirthInput has proper aria-required, aria-invalid, and aria-describedby on all three input fields
- **"Under 18" consistency** — Denial reason now available in MaybeActionButtons and ManualActionButtons (was missing from those views)
