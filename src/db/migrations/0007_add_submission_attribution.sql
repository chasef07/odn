-- AlterTable
ALTER TABLE "submissions"
ADD COLUMN "attribution_channel" TEXT,
ADD COLUMN "utm_source" TEXT,
ADD COLUMN "utm_medium" TEXT,
ADD COLUMN "utm_campaign" TEXT,
ADD COLUMN "attribution" JSONB;

-- CreateIndex
CREATE INDEX "submissions_attribution_channel_created_at_idx"
ON "submissions"("attribution_channel", "created_at");
