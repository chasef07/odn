CREATE TABLE "sms_offline_notices" (
    "phone_e164" TEXT NOT NULL,
    "night" DATE NOT NULL,

    CONSTRAINT "sms_offline_notices_pkey" PRIMARY KEY ("phone_e164")
);

CREATE TABLE "sms_offline_notice_pause" (
    "id" BOOLEAN NOT NULL DEFAULT TRUE,
    "paused_until" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sms_offline_notice_pause_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "sms_offline_notice_pause_one_row" CHECK ("id")
);
