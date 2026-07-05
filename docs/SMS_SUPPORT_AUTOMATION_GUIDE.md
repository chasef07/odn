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
3 Other
Reply HELP for note changes or customer support.
STOP to opt out.
```

If they choose `2 Change note`, they receive:

```text
What needs changing?
1 Issue/evaluation date
2 First/last day off
3 Birthday
4 Return date
5 Diagnosis/symptoms
6 Work/school/travel purpose
7 Name misspelled
8 Restrictions/accommodations
9 Other
Reply HELP for note changes or customer support.
STOP to opt out.
```

If they choose `3 Other`, they receive:

```text
What else do you need?
1 Additional form
2 Refund
3 Other
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
- The request involves issue/evaluation date, first/last day off, return-date questions, diagnosis, symptoms, restrictions, accommodations, name spelling, additional forms, refunds, email delivery problems, or freeform messages.
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
System: First/last day off changes need staff review. Email hello@onlinedoctornote.com with the correct dates.
Admin portal: ticket appears as Needs CSR
```

Needs staff:

```text
Customer: I need the diagnosis changed
System: Thanks. A support ticket was created for staff review...
Admin portal: ticket appears as Needs CSR
```
