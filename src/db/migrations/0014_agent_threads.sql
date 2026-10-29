CREATE TABLE "agent_threads" (
    "id" TEXT NOT NULL,
    "admin_user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "messages" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_threads_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "agent_threads_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "agent_threads_admin_user_id_updated_at_idx" ON "agent_threads"("admin_user_id", "updated_at" DESC);
