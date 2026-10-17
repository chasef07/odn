-- AlterTable
ALTER TABLE "submissions" ADD COLUMN "approval_diagnosis" TEXT;
ALTER TABLE "submissions" ADD COLUMN "approval_with_restrictions" BOOLEAN;

-- AlterTable
ALTER TABLE "sms_messages" ADD COLUMN "support_ticket_id" TEXT;

-- CreateTable
CREATE TABLE "sms_support_tickets" (
    "id" TEXT NOT NULL,
    "phone_e164" TEXT NOT NULL,
    "submission_id" TEXT,
    "status" TEXT NOT NULL,
    "category" TEXT,
    "state" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "automation_kind" TEXT,
    "automation_status" TEXT,
    "collected_data" JSONB,
    "admin_summary" TEXT,
    "failure_reason" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "csr_alerted_at" TIMESTAMP(3),
    "last_inbound_at" TIMESTAMP(3),
    "last_outbound_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sms_support_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_support_jobs" (
    "id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "payload" JSONB,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_at" TIMESTAMP(3),
    "locked_by" TEXT,
    "last_error" TEXT,
    "run_after" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sms_support_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sms_messages_support_ticket_id_idx" ON "sms_messages"("support_ticket_id");

-- CreateIndex
CREATE INDEX "sms_support_tickets_phone_e164_idx" ON "sms_support_tickets"("phone_e164");

-- CreateIndex
CREATE INDEX "sms_support_tickets_submission_id_idx" ON "sms_support_tickets"("submission_id");

-- CreateIndex
CREATE INDEX "sms_support_tickets_status_updated_at_idx" ON "sms_support_tickets"("status", "updated_at");

-- CreateIndex
CREATE INDEX "sms_support_tickets_category_idx" ON "sms_support_tickets"("category");

-- CreateIndex
CREATE INDEX "sms_support_tickets_automation_status_idx" ON "sms_support_tickets"("automation_status");

-- CreateIndex
CREATE INDEX "sms_support_jobs_status_run_after_idx" ON "sms_support_jobs"("status", "run_after");

-- CreateIndex
CREATE INDEX "sms_support_jobs_ticket_id_idx" ON "sms_support_jobs"("ticket_id");

-- AddForeignKey
ALTER TABLE "sms_support_tickets" ADD CONSTRAINT "sms_support_tickets_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_messages" ADD CONSTRAINT "sms_messages_support_ticket_id_fkey" FOREIGN KEY ("support_ticket_id") REFERENCES "sms_support_tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_support_jobs" ADD CONSTRAINT "sms_support_jobs_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "sms_support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
