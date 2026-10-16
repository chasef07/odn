ALTER TABLE "telnyx_webhook_events"
ADD COLUMN "status" TEXT NOT NULL DEFAULT 'PROCESSED',
ADD COLUMN "last_error" TEXT;
