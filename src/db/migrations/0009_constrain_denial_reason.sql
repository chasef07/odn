ALTER TABLE "submissions" ADD COLUMN "denial_note" TEXT;

UPDATE "submissions"
SET "denial_reason" = "choice"."reason"
FROM (VALUES
    ('Legal'),
    ('7+ days'),
    ('Duplicate'),
    ('Refund (Customer)'),
    ('Refund (Denial)'),
    ('Under 18'),
    ('Accommodations'),
    ('Other'),
    ('Refund')
) AS "choice" ("reason")
WHERE "submissions"."denial_reason" <> "choice"."reason"
AND btrim(regexp_replace(lower("submissions"."denial_reason" COLLATE "C"), '[[:space:]]+', ' ', 'g'))
    = lower("choice"."reason" COLLATE "C");

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
