-- ============================================================
-- Migration: Add Membership join table & Notifications
--
-- Moves from User → clientId (mandatory) to a many-to-many
-- Membership model (User ↔ Client). Also adds in-app notifications
-- for membership request/approval workflows.
--
-- Data migration: every existing user row becomes an ACTIVE
-- membership preserving their original role.
-- ============================================================

-- 1. Create new enums
CREATE TYPE "membership_status" AS ENUM ('PENDING', 'ACTIVE', 'REJECTED');
CREATE TYPE "notification_type" AS ENUM ('MEMBERSHIP_REQUEST', 'MEMBERSHIP_APPROVED', 'MEMBERSHIP_REJECTED', 'SYSTEM');

-- 2. Create memberships table
CREATE TABLE "memberships" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "client_id" INTEGER NOT NULL,
    "role" "user_role" NOT NULL DEFAULT 'VIEWER',
    "status" "membership_status" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

-- 3. Create notifications table
CREATE TABLE "notifications" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "type" "notification_type" NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB DEFAULT '{}',
    "read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- 4. Migrate existing user→client relationships into memberships.
--    Every existing user gets an ACTIVE membership with their current role.
INSERT INTO "memberships" ("user_id", "client_id", "role", "status", "created_at", "updated_at")
SELECT "id", "client_id", "role", 'ACTIVE'::"membership_status", "created_at", "updated_at"
FROM "users"
WHERE "client_id" IS NOT NULL;

-- 5. Create indexes on memberships
CREATE UNIQUE INDEX "memberships_user_id_client_id_key" ON "memberships"("user_id", "client_id");
CREATE INDEX "memberships_user_id_idx" ON "memberships"("user_id");
CREATE INDEX "memberships_client_id_idx" ON "memberships"("client_id");
CREATE INDEX "memberships_client_id_status_idx" ON "memberships"("client_id", "status");

-- 6. Create indexes on notifications
CREATE INDEX "notifications_user_id_read_idx" ON "notifications"("user_id", "read");
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at");

-- 7. Add foreign keys for memberships
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_client_id_fkey"
    FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 8. Add foreign key for notifications
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 9. Drop old constraints and columns from users.
--    Order matters: drop FK → drop unique → drop index → drop columns.

-- Drop FK: users.client_id → clients.id
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_client_id_fkey";

-- Drop compound unique (client_id, email)
DROP INDEX IF EXISTS "users_client_id_email_key";

-- Drop index on client_id
DROP INDEX IF EXISTS "users_client_id_idx";

-- Drop the columns that moved to memberships
ALTER TABLE "users" DROP COLUMN "client_id";
ALTER TABLE "users" DROP COLUMN "role";

-- 10. Email is now globally unique (identity-level, not per-client).
--     NOTE: If your DB has duplicate emails across clients, deduplicate first.
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
