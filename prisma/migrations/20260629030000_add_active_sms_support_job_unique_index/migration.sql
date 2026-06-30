CREATE UNIQUE INDEX "sms_support_jobs_active_ticket_kind_key"
ON "sms_support_jobs"("ticket_id", "kind")
WHERE "status" IN ('QUEUED', 'RUNNING', 'COMMITTING');
