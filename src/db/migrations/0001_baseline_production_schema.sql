-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'DENIED', 'MAYBE', 'MANUAL');

-- CreateEnum
CREATE TYPE "NoteVerificationStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "access_token" TEXT,
    "refresh_token" TEXT,
    "id_token" TEXT,
    "expires_at" TIMESTAMP(3),
    "password" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "temporary_submissions" (
    "id" TEXT NOT NULL,
    "payment_intent_id" TEXT NOT NULL,
    "form_data" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "temporary_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submissions" (
    "id" TEXT NOT NULL,
    "stripe_payment_intent_id" TEXT NOT NULL,
    "payment_amount" INTEGER,
    "offer_code" TEXT,
    "offer_price_id" TEXT,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "state" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "patient_first_name" TEXT NOT NULL,
    "patient_last_name" TEXT NOT NULL,
    "patient_date_of_birth" DATE NOT NULL,
    "guardian_first_name" TEXT,
    "guardian_last_name" TEXT,
    "guardian_date_of_birth" DATE,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "sms_opt_in" BOOLEAN NOT NULL DEFAULT false,
    "sms_opt_in_at" TIMESTAMP(3),
    "sms_consent_version" TEXT,
    "sms_phone_e164" TEXT,
    "note_purpose" TEXT NOT NULL,
    "other_note_purpose" TEXT,
    "first_day_off" DATE NOT NULL,
    "last_day_off" DATE NOT NULL,
    "absence_reason" TEXT NOT NULL,
    "other_absence_reason" TEXT,
    "symptoms" JSONB,
    "other_symptom_text" TEXT,
    "additional_information" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by_admin_id" TEXT,
    "denial_reason" TEXT,
    "maybe_reason" TEXT,
    "maybe_internal_note" TEXT,
    "maybe_approved_days" INTEGER,
    "maybe_email_sent_at" TIMESTAMP(3),
    "stripe_refund_id" TEXT,
    "refunded_at" TIMESTAMP(3),
    "approval_email_sent_at" TIMESTAMP(3),
    "denial_email_sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_phone_states" (
    "phone_e164" TEXT NOT NULL,
    "opted_out_at" TIMESTAMP(3),
    "last_opt_in_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sms_phone_states_pkey" PRIMARY KEY ("phone_e164")
);

-- CreateTable
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

-- CreateTable
CREATE TABLE "telnyx_webhook_events" (
    "id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "telnyx_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resend_webhook_events" (
    "id" TEXT NOT NULL,
    "email_id" TEXT,
    "event_type" TEXT NOT NULL,
    "processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resend_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "note_verifications" (
    "id" TEXT NOT NULL,
    "submission_id" TEXT NOT NULL,
    "medical_record_number" TEXT NOT NULL,
    "verification_slug" TEXT NOT NULL,
    "status" "NoteVerificationStatus" NOT NULL DEFAULT 'ACTIVE',
    "issue_date" DATE NOT NULL,
    "patient_initials" TEXT NOT NULL,
    "first_day_off" DATE NOT NULL,
    "last_day_off" DATE NOT NULL,
    "return_guidance" TEXT NOT NULL,
    "physician_name" TEXT NOT NULL,
    "physician_credentials" TEXT NOT NULL,
    "physician_npi" TEXT,
    "license_state" TEXT,
    "license_number" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "note_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "accounts_user_id_idx" ON "accounts"("user_id");

-- CreateIndex
CREATE INDEX "accounts_user_id_provider_id_idx" ON "accounts"("user_id", "provider_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_key" ON "sessions"("token");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "temporary_submissions_payment_intent_id_key" ON "temporary_submissions"("payment_intent_id");

-- CreateIndex
CREATE INDEX "temporary_submissions_expires_at_idx" ON "temporary_submissions"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "submissions_stripe_payment_intent_id_key" ON "submissions"("stripe_payment_intent_id");

-- CreateIndex
CREATE INDEX "submissions_status_idx" ON "submissions"("status");

-- CreateIndex
CREATE INDEX "submissions_email_idx" ON "submissions"("email");

-- CreateIndex
CREATE INDEX "submissions_created_at_idx" ON "submissions"("created_at");

-- CreateIndex
CREATE INDEX "submissions_status_created_at_idx" ON "submissions"("status", "created_at");

-- CreateIndex
CREATE INDEX "submissions_patient_first_name_patient_last_name_patient_da_idx" ON "submissions"("patient_first_name", "patient_last_name", "patient_date_of_birth", "status");

-- CreateIndex
CREATE INDEX "submissions_email_status_idx" ON "submissions"("email", "status");

-- CreateIndex
CREATE INDEX "submissions_sms_phone_e164_idx" ON "submissions"("sms_phone_e164");

-- CreateIndex
CREATE INDEX "submissions_offer_code_idx" ON "submissions"("offer_code");

-- CreateIndex
CREATE UNIQUE INDEX "sms_messages_provider_message_id_key" ON "sms_messages"("provider_message_id");

-- CreateIndex
CREATE INDEX "sms_messages_submission_id_idx" ON "sms_messages"("submission_id");

-- CreateIndex
CREATE INDEX "sms_messages_type_idx" ON "sms_messages"("type");

-- CreateIndex
CREATE INDEX "sms_messages_provider_status_idx" ON "sms_messages"("provider_status");

-- CreateIndex
CREATE INDEX "sms_messages_created_at_idx" ON "sms_messages"("created_at");

-- CreateIndex
CREATE INDEX "resend_webhook_events_email_id_idx" ON "resend_webhook_events"("email_id");

-- CreateIndex
CREATE UNIQUE INDEX "note_verifications_medical_record_number_key" ON "note_verifications"("medical_record_number");

-- CreateIndex
CREATE UNIQUE INDEX "note_verifications_verification_slug_key" ON "note_verifications"("verification_slug");

-- CreateIndex
CREATE INDEX "note_verifications_submission_id_idx" ON "note_verifications"("submission_id");

-- CreateIndex
CREATE INDEX "note_verifications_status_idx" ON "note_verifications"("status");

-- CreateIndex
CREATE INDEX "note_verifications_created_at_idx" ON "note_verifications"("created_at");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_reviewed_by_admin_id_fkey" FOREIGN KEY ("reviewed_by_admin_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_messages" ADD CONSTRAINT "sms_messages_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "note_verifications" ADD CONSTRAINT "note_verifications_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
