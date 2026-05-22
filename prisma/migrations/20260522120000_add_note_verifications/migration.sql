-- CreateEnum
CREATE TYPE "NoteVerificationStatus" AS ENUM ('ACTIVE', 'REVOKED');

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
CREATE INDEX "note_verifications_submission_id_idx" ON "note_verifications"("submission_id");

-- CreateIndex
CREATE UNIQUE INDEX "note_verifications_medical_record_number_key" ON "note_verifications"("medical_record_number");

-- CreateIndex
CREATE UNIQUE INDEX "note_verifications_verification_slug_key" ON "note_verifications"("verification_slug");

-- CreateIndex
CREATE INDEX "note_verifications_status_idx" ON "note_verifications"("status");

-- CreateIndex
CREATE INDEX "note_verifications_created_at_idx" ON "note_verifications"("created_at");

-- AddForeignKey
ALTER TABLE "note_verifications" ADD CONSTRAINT "note_verifications_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
