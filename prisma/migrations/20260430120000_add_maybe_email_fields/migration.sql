ALTER TABLE "submissions"
ADD COLUMN "maybe_reason" TEXT,
ADD COLUMN "maybe_internal_note" TEXT,
ADD COLUMN "maybe_email_sent_at" TIMESTAMP(3);
