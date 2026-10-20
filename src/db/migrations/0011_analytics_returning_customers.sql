CREATE OR REPLACE VIEW "analytics"."submissions" AS
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
    md5(lower(btrim("email"))) AS "customer_id",
    row_number() OVER (PARTITION BY lower(btrim("email")) ORDER BY "created_at", "id")::int AS "customer_note_number",
    (row_number() OVER (PARTITION BY lower(btrim("email")) ORDER BY "created_at", "id") > 1) AS "is_returning"
FROM "public"."submissions";

COMMENT ON COLUMN "analytics"."submissions"."customer_note_number" IS 'Which note this is for its customer (same email): 1 for their first note ever, 2 for their second, and so on, in order paid.';
COMMENT ON COLUMN "analytics"."submissions"."is_returning" IS 'True when the customer (same email) had an earlier note, so this is their second or later. False for a brand new customer''s first note. Count unique customers as notes with customer_note_number = 1 and repeat customers as notes with customer_note_number = 2.';
