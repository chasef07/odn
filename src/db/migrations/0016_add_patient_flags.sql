CREATE TABLE "patient_flags" (
    "id" TEXT NOT NULL,
    "patient_first_name" TEXT NOT NULL,
    "patient_last_name" TEXT NOT NULL,
    "patient_date_of_birth" DATE NOT NULL,
    "reason" TEXT,
    "flagged_by" TEXT NOT NULL,
    "flagged_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patient_flags_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "patient_flags_patient_identity_key" ON "patient_flags"(lower("patient_first_name"), lower("patient_last_name"), "patient_date_of_birth");
