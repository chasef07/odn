CREATE TABLE "funnel_steps" (
    "id" TEXT NOT NULL,
    "visitor_id" TEXT NOT NULL,
    "step" TEXT NOT NULL,
    "step_order" INTEGER NOT NULL,
    "locale" TEXT NOT NULL,
    "attribution_channel" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "funnel_steps_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "funnel_steps_created_at_idx" ON "funnel_steps"("created_at");

CREATE VIEW "analytics"."funnel_steps" AS
SELECT
    "visitor_id",
    "step",
    "step_order",
    "locale",
    "attribution_channel",
    "created_at",
    ("created_at" AT TIME ZONE 'UTC' AT TIME ZONE 'America/New_York')::date AS "created_day_et"
FROM "public"."funnel_steps";

COMMENT ON VIEW "analytics"."funnel_steps" IS 'One row each time a browser opened a step of the order funnel, from the first intake step through payment and the paid confirmation page. Reloads and back-and-forth add rows, so count distinct visitor_id per step for funnel reach and drop-off. Not joined to orders: compare the paid step with analytics.submissions by day and channel.';
COMMENT ON COLUMN "analytics"."funnel_steps"."visitor_id" IS 'Random id kept in the browser, the same for every step that browser opens. Not tied to a person or an order.';
COMMENT ON COLUMN "analytics"."funnel_steps"."step" IS 'The page opened, without the /es prefix: /get-started, /who-is-using, /basic-info, /guardian-info (only when the note is for someone else), /contact-info, /note-purpose, /absence-dates, /absence-reason, /symptoms (skipped for some absence reasons), /additional-info, /review, /payment once the checkout form is ready to pay (visitors sent back to fix their answers are not counted), then /payment/success once the payment succeeded.';
COMMENT ON COLUMN "analytics"."funnel_steps"."step_order" IS 'Position of the step in the funnel, 1 for /get-started up to /payment/success last. Sort and compare steps by this.';
COMMENT ON COLUMN "analytics"."funnel_steps"."locale" IS 'Site language the step was opened in: en or es.';
COMMENT ON COLUMN "analytics"."funnel_steps"."attribution_channel" IS 'Last-touch acquisition channel of the browser when the step was opened, the same classification as analytics.submissions.attribution_channel: direct when no other channel was ever seen, null when the browser had no attribution cookie.';
COMMENT ON COLUMN "analytics"."funnel_steps"."created_at" IS 'When the step was opened, as a UTC timestamp without time zone.';
COMMENT ON COLUMN "analytics"."funnel_steps"."created_day_et" IS 'The business day the step was opened in America/New_York. Use this for daily or weekly funnel reporting.';

GRANT SELECT ON "analytics"."funnel_steps" TO "analytics_reader";
