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
    "status" TEXT NOT NULL DEFAULT 'pending_review',
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
    "note_purpose" TEXT NOT NULL,
    "other_note_purpose" TEXT,
    "first_day_off" DATE NOT NULL,
    "last_day_off" DATE NOT NULL,
    "return_date" DATE,
    "absence_reason" TEXT NOT NULL,
    "other_absence_reason" TEXT,
    "symptoms" JSONB,
    "other_symptom_text" TEXT,
    "additional_information" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by_admin_id" TEXT,
    "stripe_refund_id" TEXT,
    "refunded_at" TIMESTAMP(3),
    "approval_email_sent_at" TIMESTAMP(3),
    "denial_email_sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "submissions_pkey" PRIMARY KEY ("id")
);

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
