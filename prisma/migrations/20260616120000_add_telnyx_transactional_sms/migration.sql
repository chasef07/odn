ALTER TABLE "submissions"
ADD COLUMN "sms_opt_in_at" TIMESTAMP(3),
ADD COLUMN "sms_consent_version" TEXT,
ADD COLUMN "sms_phone_e164" TEXT;

UPDATE "submissions"
SET "sms_phone_e164" = CASE
    WHEN length(normalized."digits") = 11 AND normalized."digits" LIKE '1%' THEN '+' || normalized."digits"
    WHEN length(normalized."digits") = 10 THEN '+1' || normalized."digits"
END
FROM (
    SELECT "id", regexp_replace("phone", '\D', '', 'g') AS "digits"
    FROM "submissions"
    WHERE "sms_opt_in" = true
) AS normalized
WHERE "submissions"."id" = normalized."id"
AND "submissions"."sms_phone_e164" IS NULL
AND (
    (length(normalized."digits") = 11 AND normalized."digits" LIKE '1%')
    OR length(normalized."digits") = 10
);

CREATE TABLE "sms_phone_states" (
    "phone_e164" TEXT NOT NULL,
    "opted_out_at" TIMESTAMP(3),
    "last_opt_in_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sms_phone_states_pkey" PRIMARY KEY ("phone_e164")
);

CREATE TABLE "sms_messages" (
    "id" TEXT NOT NULL,
    "submission_id" TEXT,
    "type" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "to" TEXT,
    "from" TEXT,
    "body" TEXT NOT NULL,
    "provider_message_id" TEXT,
    "provider_status" TEXT,
    "error_code" TEXT,
    "error_message" TEXT,
    "sent_at" TIMESTAMP(3),
    "received_at" TIMESTAMP(3),
    "finalized_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sms_messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "telnyx_webhook_events" (
    "id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "telnyx_webhook_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "resend_webhook_events" (
    "id" TEXT NOT NULL,
    "email_id" TEXT,
    "event_type" TEXT NOT NULL,
    "processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resend_webhook_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sms_messages_provider_message_id_key" ON "sms_messages"("provider_message_id");
CREATE INDEX "submissions_sms_phone_e164_idx" ON "submissions"("sms_phone_e164");
CREATE INDEX "sms_messages_submission_id_idx" ON "sms_messages"("submission_id");
CREATE INDEX "sms_messages_type_idx" ON "sms_messages"("type");
CREATE INDEX "sms_messages_provider_status_idx" ON "sms_messages"("provider_status");
CREATE INDEX "sms_messages_created_at_idx" ON "sms_messages"("created_at");
CREATE INDEX "resend_webhook_events_email_id_idx" ON "resend_webhook_events"("email_id");

ALTER TABLE "sms_messages"
ADD CONSTRAINT "sms_messages_submission_id_fkey"
FOREIGN KEY ("submission_id") REFERENCES "submissions"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
