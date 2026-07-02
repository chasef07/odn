# SMS Support Automation Guide

This guide explains how OnlineDoctorNote SMS support works for customers and what staff should watch in the admin portal.

## What Customers Can Do By Text

Every outbound SMS tells the customer:

```text
Reply HELP for note changes or customer support.
STOP to opt out.
```

When a customer texts `HELP`, they receive:

```text
OnlineDoctorNote support:
1 Note not received
2 Change note
3 Refund
4 Diagnosis/symptoms
5 Other
Reply HELP for note changes or customer support.
STOP to opt out.
```

If they choose `2 Change note`, they receive:

```text
What needs changing?
1 Birthday
2 Absence dates
3 Work/school purpose
4 Return date question
5 Other
Reply HELP for note changes or customer support.
STOP to opt out.
```

## What Is Automated

Automation only runs for an already-approved note that the system can safely match to the customer's SMS phone number.

Birthday correction:

- Customer replies with a birthday in `MM/DD/YYYY` format.
- The system rejects invalid, future, or impossible dates.
- The system blocks automation if the birthday change would change adult/minor review status.
- If safe, the submission is updated, a new note PDF is generated, the new note is emailed, and old verifier records are revoked.

Absence date correction:

- Customer enters first day off, then last day off, both in `MM/DD/YYYY` format.
- The system rejects invalid dates.
- The system uses the same absence-date rules as the form: first day cannot be too far in the past, last day must be on or after first day, and the covered range cannot exceed the allowed maximum.
- If valid, the note is regenerated and emailed.

Work/school purpose correction:

- Customer chooses:
  - `1 Work`
  - `2 School`
  - `3 Work and school`
  - `4 Travel`
- Legal/court/jury/probation-style requests are not automated and go to staff review.
- If valid, the note is regenerated and emailed.

## What Always Goes To Staff

Staff review is required when:

- The system cannot find one clear approved note for that phone number.
- There are multiple approved notes and the customer cannot provide a valid reference number.
- The request involves diagnosis, symptoms, restrictions, return-date questions, refunds, email delivery problems, or freeform messages.
- The customer requests a legal/court/jury/probation-style note.
- SMS delivery fails.
- PDF generation, email delivery, note verification cleanup, or any automation job fails.

## What Staff Sees In The Admin Portal

Use the support queue in the admin portal.

Key ticket states:

- `Waiting customer`: the system is waiting for the customer's next text.
- `Running automation`: the system is updating and reissuing the note.
- `Needs CSR`: staff must review or reply manually.
- `Closed`: the request is complete.

Each ticket shows:

- Customer phone number
- Linked submission, if available
- Category
- Customer messages and system replies
- Automation status
- Failure reason, if something broke
- Latest job attempt

## Staff Workflow

1. Open the support queue.
2. Work `Needs CSR` tickets first.
3. Read the ticket summary and recent message history.
4. If it is a safe administrative issue, reply by SMS from the ticket.
5. If the note must be manually changed, update/reissue it through the normal admin note flow.
6. If an automation failed, check whether the note already changed before retrying.
7. Close the ticket only when the customer issue is handled.

## Important Safety Rules

- Do not diagnose or change symptoms by SMS automation.
- Do not automate legal-note requests.
- Do not send PHI beyond the minimum needed in SMS.
- Do not assume a failed automation means nothing changed; check the linked submission and verification record first.
- STOP opt-out must be respected. Customers can text `START` or `UNSTOP` only if they previously opted in.

## Example Customer Flows

Birthday:

```text
Customer: HELP
System: menu
Customer: 2
System: change-note menu
Customer: 1
System: Reply with the correct birthday as MM/DD/YYYY...
Customer: 03/14/1990
System: Got it. We are updating your approved note now...
System: Done: your updated birthday note was emailed...
```

Dates:

```text
Customer: HELP
Customer: 2
Customer: 2
System: Reply with the first day off as MM/DD/YYYY.
Customer: 07/03/2026
System: Reply with the last day off as MM/DD/YYYY...
Customer: 07/04/2026
System: Got it. We are updating your approved note now...
```

Needs staff:

```text
Customer: I need the diagnosis changed
System: Thanks. A support ticket was created for staff review...
Admin portal: ticket appears as Needs CSR
```
