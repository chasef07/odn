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
    (row_number() OVER (PARTITION BY lower(btrim("email")) ORDER BY "created_at", "id") > 1) AS "is_returning",
    ("attribution" -> 'first' ->> 'channel') AS "first_attribution_channel",
    ("attribution" -> 'first' ->> 'source') AS "first_source"
FROM "public"."submissions";

COMMENT ON COLUMN "analytics"."submissions"."attribution_channel" IS 'Acquisition channel of the last touch when checkout began: the browser''s most recent visit that was not direct, or direct when every visit was. One of reddit, google_ads, meta, microsoft_ads, tiktok, email, sms, other_campaign, organic_search, social, referral, direct. Null when no attribution was stored. Compare with first_attribution_channel for the first touch.';
COMMENT ON COLUMN "analytics"."submissions"."utm_source" IS 'Source of the last touch: its utm_source, or the referring host such as www.google.com when the visit had no utm_source. Null when unknown.';
COMMENT ON COLUMN "analytics"."submissions"."utm_medium" IS 'utm_medium of the last touch, or null.';
COMMENT ON COLUMN "analytics"."submissions"."utm_campaign" IS 'utm_campaign of the last touch, or null.';
COMMENT ON COLUMN "analytics"."submissions"."first_attribution_channel" IS 'Acquisition channel of the first touch: the first visit recorded in the browser''s attribution cookie, which expires 90 days after it was last written (its first visit or its latest non-direct visit), using the same values as attribution_channel. Differs from attribution_channel when a later visit came from another channel, such as a first touch from a reddit ad and a last touch from google_ads. Null when no attribution was stored.';
COMMENT ON COLUMN "analytics"."submissions"."first_source" IS 'Source of the first touch: its utm_source, or the referring host when it had none. Null when unknown.';
