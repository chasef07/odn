CREATE SCHEMA "analytics";

CREATE VIEW "analytics"."submissions" AS
SELECT
    "id",
    "created_at",
    ("created_at" AT TIME ZONE 'UTC' AT TIME ZONE 'America/New_York')::date AS "created_day_et",
    "status"::text AS "status",
    "payment_amount" AS "payment_amount_cents",
    "offer_code",
    "state",
    "note_purpose",
    "absence_reason",
    ("last_day_off" - "first_day_off" + 1) AS "days_off",
    extract(year FROM age(
        ("created_at" AT TIME ZONE 'UTC' AT TIME ZONE 'America/New_York')::date,
        "patient_date_of_birth"
    ))::int AS "patient_age_years",
    "denial_reason",
    ("refunded_at" IS NOT NULL) AS "refunded",
    "refunded_at",
    "reviewed_at",
    "attribution_channel",
    "utm_source",
    "utm_medium",
    "utm_campaign",
    md5(lower(btrim("email"))) AS "customer_id"
FROM "public"."submissions";

COMMENT ON VIEW "analytics"."submissions" IS 'One row per paid doctor''s note order. Count rows for notes sold. Group by created_day_et for daily, weekly or monthly business reporting.';
COMMENT ON COLUMN "analytics"."submissions"."id" IS 'Order id. Joins to sms_messages.submission_id and sms_support_tickets.submission_id.';
COMMENT ON COLUMN "analytics"."submissions"."created_at" IS 'When the order was paid, as a UTC timestamp without time zone.';
COMMENT ON COLUMN "analytics"."submissions"."created_day_et" IS 'The business day of the order in America/New_York. Use this, not created_at, for daily, weekly, monthly and yearly grouping.';
COMMENT ON COLUMN "analytics"."submissions"."status" IS 'Review outcome: PENDING_REVIEW (not reviewed yet), APPROVED (note issued), DENIED (doctor declined), MAYBE (doctor needs more from the patient before deciding), MANUAL (set aside by the doctor for manual handling, still to be approved or denied). Approval rate is APPROVED over decided orders (APPROVED or DENIED).';
COMMENT ON COLUMN "analytics"."submissions"."payment_amount_cents" IS 'Amount paid in US cents. Divide by 100 for dollars. Null when the amount was not recorded.';
COMMENT ON COLUMN "analytics"."submissions"."offer_code" IS 'Discount offer code used at checkout, or null for full price.';
COMMENT ON COLUMN "analytics"."submissions"."state" IS 'Two-letter US state of the patient.';
COMMENT ON COLUMN "analytics"."submissions"."note_purpose" IS 'Who the note is for, such as work or school.';
COMMENT ON COLUMN "analytics"."submissions"."absence_reason" IS 'Reason category the patient picked for the absence.';
COMMENT ON COLUMN "analytics"."submissions"."days_off" IS 'Number of days the note covers, counting the first and last day.';
COMMENT ON COLUMN "analytics"."submissions"."patient_age_years" IS 'Patient age in whole years on the order''s business day.';
COMMENT ON COLUMN "analytics"."submissions"."denial_reason" IS 'Why a DENIED order was denied: Legal, 7+ days, Duplicate, Refund (Customer), Refund (Denial), Under 18, Accommodations, Other, or Refund. Null otherwise.';
COMMENT ON COLUMN "analytics"."submissions"."refunded" IS 'True when the payment was refunded.';
COMMENT ON COLUMN "analytics"."submissions"."refunded_at" IS 'When the refund was issued, UTC. Null when not refunded.';
COMMENT ON COLUMN "analytics"."submissions"."reviewed_at" IS 'When the doctor reviewed the order, UTC. Null while PENDING_REVIEW.';
COMMENT ON COLUMN "analytics"."submissions"."attribution_channel" IS 'Acquisition channel the order came from, such as google, instagram, tiktok, referral or direct. Null when unknown.';
COMMENT ON COLUMN "analytics"."submissions"."utm_source" IS 'utm_source of the landing visit, or null.';
COMMENT ON COLUMN "analytics"."submissions"."utm_medium" IS 'utm_medium of the landing visit, or null.';
COMMENT ON COLUMN "analytics"."submissions"."utm_campaign" IS 'utm_campaign of the landing visit, or null.';
COMMENT ON COLUMN "analytics"."submissions"."customer_id" IS 'Pseudonymous customer key, the same for every order from one email address. Use it to count distinct or repeat customers.';

CREATE VIEW "analytics"."sms_support_tickets" AS
SELECT
    "id",
    "submission_id",
    "status",
    "category",
    "source",
    "automation_kind",
    "automation_status",
    "retry_count",
    "csr_alerted_at",
    "last_inbound_at",
    "last_outbound_at",
    "closed_at",
    "created_at",
    ("created_at" AT TIME ZONE 'UTC' AT TIME ZONE 'America/New_York')::date AS "created_day_et"
FROM "public"."sms_support_tickets";

COMMENT ON VIEW "analytics"."sms_support_tickets" IS 'One row per customer support conversation over SMS or the support form.';
COMMENT ON COLUMN "analytics"."sms_support_tickets"."id" IS 'Ticket id. Joins to sms_messages.support_ticket_id.';
COMMENT ON COLUMN "analytics"."sms_support_tickets"."submission_id" IS 'The order the ticket is about, joining to submissions.id, or null when not matched.';
COMMENT ON COLUMN "analytics"."sms_support_tickets"."status" IS 'OPEN (new), WAITING_CUSTOMER (waiting on a customer reply), RUNNING_AUTOMATION (an automatic fix is running), NEEDS_CSR (needs a human agent), CLOSED (resolved).';
COMMENT ON COLUMN "analytics"."sms_support_tickets"."category" IS 'What the customer needs: NOTE_NOT_RECEIVED, ISSUE_DATE, CHANGE_DOB, CHANGE_DATES, CHANGE_PURPOSE, REFUND, DIAGNOSIS_SYMPTOMS, RETURN_DATE, ADDITIONAL_FORM, NAME_CORRECTION, RESTRICTIONS_ACCOMMODATIONS, OTHER. Null before the customer picks one.';
COMMENT ON COLUMN "analytics"."sms_support_tickets"."source" IS 'How the ticket started: INBOUND_SMS, ADMIN_CREATED or SUPPORT_FORM.';
COMMENT ON COLUMN "analytics"."sms_support_tickets"."automation_kind" IS 'The automatic fix attempted, UPDATE_DOB_REISSUE_NOTE or UPDATE_PURPOSE_REISSUE_NOTE, or null.';
COMMENT ON COLUMN "analytics"."sms_support_tickets"."automation_status" IS 'Progress of the automatic fix: QUEUED, RUNNING, SUCCEEDED or FAILED, or null.';
COMMENT ON COLUMN "analytics"."sms_support_tickets"."retry_count" IS 'How many times the automatic fix was retried.';
COMMENT ON COLUMN "analytics"."sms_support_tickets"."csr_alerted_at" IS 'When a human agent was alerted, UTC, or null.';
COMMENT ON COLUMN "analytics"."sms_support_tickets"."last_inbound_at" IS 'Last customer message, UTC, or null.';
COMMENT ON COLUMN "analytics"."sms_support_tickets"."last_outbound_at" IS 'Last message sent to the customer, UTC, or null.';
COMMENT ON COLUMN "analytics"."sms_support_tickets"."closed_at" IS 'When the ticket closed, UTC, or null while open.';
COMMENT ON COLUMN "analytics"."sms_support_tickets"."created_at" IS 'When the ticket opened, UTC timestamp without time zone.';
COMMENT ON COLUMN "analytics"."sms_support_tickets"."created_day_et" IS 'The business day the ticket opened in America/New_York. Use this for daily or monthly grouping.';

CREATE VIEW "analytics"."sms_messages" AS
SELECT
    "id",
    "submission_id",
    "support_ticket_id",
    "type",
    "direction",
    "provider_status",
    "error_code",
    "sent_at",
    "received_at",
    "finalized_at",
    "created_at",
    ("created_at" AT TIME ZONE 'UTC' AT TIME ZONE 'America/New_York')::date AS "created_day_et"
FROM "public"."sms_messages";

COMMENT ON VIEW "analytics"."sms_messages" IS 'One row per text message sent to or received from a customer. Message bodies and phone numbers are not available.';
COMMENT ON COLUMN "analytics"."sms_messages"."id" IS 'Message id.';
COMMENT ON COLUMN "analytics"."sms_messages"."submission_id" IS 'The order the message is about, joining to submissions.id, or null.';
COMMENT ON COLUMN "analytics"."sms_messages"."support_ticket_id" IS 'The support ticket the message belongs to, joining to sms_support_tickets.id, or null.';
COMMENT ON COLUMN "analytics"."sms_messages"."type" IS 'What the message is, such as PURCHASE_CONFIRMATION, APPROVAL_SENT, DENIAL_SENT, MAYBE_UPDATE, EMAIL_BOUNCE, SUPPORT_REPLY, SUPPORT_CSR_ALERT, SUPPORT_AUTOMATION_UPDATE or INBOUND.';
COMMENT ON COLUMN "analytics"."sms_messages"."direction" IS 'outbound (we sent it) or inbound (the customer sent it).';
COMMENT ON COLUMN "analytics"."sms_messages"."provider_status" IS 'Delivery status reported by the SMS provider, such as queued, sent, delivered or failed.';
COMMENT ON COLUMN "analytics"."sms_messages"."error_code" IS 'Provider error code for a failed message, or null.';
COMMENT ON COLUMN "analytics"."sms_messages"."sent_at" IS 'When the message was sent, UTC, or null.';
COMMENT ON COLUMN "analytics"."sms_messages"."received_at" IS 'When an inbound message arrived, UTC, or null.';
COMMENT ON COLUMN "analytics"."sms_messages"."finalized_at" IS 'When the provider reported a final delivery status, UTC, or null.';
COMMENT ON COLUMN "analytics"."sms_messages"."created_at" IS 'When the message row was created, UTC timestamp without time zone.';
COMMENT ON COLUMN "analytics"."sms_messages"."created_day_et" IS 'The business day of the message in America/New_York. Use this for daily or monthly grouping.';

DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'analytics_reader') THEN
        CREATE ROLE "analytics_reader" NOLOGIN;
    END IF;
END
$$;

GRANT USAGE ON SCHEMA "analytics" TO "analytics_reader";
GRANT SELECT ON ALL TABLES IN SCHEMA "analytics" TO "analytics_reader";
ALTER DEFAULT PRIVILEGES IN SCHEMA "analytics" GRANT SELECT ON TABLES TO "analytics_reader";
