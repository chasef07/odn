-- AlterTable
ALTER TABLE "submissions"
ADD COLUMN "follow_up_email_claimed_at" TIMESTAMP(3),
ADD COLUMN "follow_up_email_sent_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "submissions_status_follow_up_email_sent_at_created_at_idx"
ON "submissions"("status", "follow_up_email_sent_at", "created_at");
