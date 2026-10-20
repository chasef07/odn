ALTER TABLE "submissions" ADD COLUMN "denial_note" TEXT;

UPDATE "submissions"
SET "denial_note" = "denial_reason", "denial_reason" = 'Other'
WHERE "denial_reason" NOT IN (
    'Legal',
    '7+ days',
    'Duplicate',
    'Refund (Customer)',
    'Refund (Denial)',
    'Under 18',
    'Accommodations',
    'Other',
    'Refund'
);

ALTER TABLE "submissions"
ADD CONSTRAINT "submissions_denial_reason_check" CHECK ("denial_reason" IN (
    'Legal',
    '7+ days',
    'Duplicate',
    'Refund (Customer)',
    'Refund (Denial)',
    'Under 18',
    'Accommodations',
    'Other',
    'Refund'
)),
ADD CONSTRAINT "submissions_denial_note_check" CHECK (
    "denial_note" IS NULL OR "denial_reason" IS NOT DISTINCT FROM 'Other'
);
