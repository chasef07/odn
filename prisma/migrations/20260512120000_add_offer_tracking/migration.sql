ALTER TABLE "submissions"
ADD COLUMN "payment_amount" INTEGER,
ADD COLUMN "offer_code" TEXT,
ADD COLUMN "offer_price_id" TEXT;

CREATE INDEX "submissions_offer_code_idx" ON "submissions"("offer_code");
