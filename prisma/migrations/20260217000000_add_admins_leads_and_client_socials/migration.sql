-- Migration: Add admins table, leads table, and client social fields
-- ============================================================

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE "access_level" AS ENUM ('SUPER_ADMIN', 'STAFF', 'DEVELOPER');

CREATE TYPE "lead_status" AS ENUM (
  'NEW',
  'CONTACTED',
  'PENDING',
  'APPROVED',
  'REJECTED',
  'CONVERTED'
);

-- ============================================================
-- ADMINS TABLE
-- ============================================================

CREATE TABLE "admins" (
  "id" SERIAL PRIMARY KEY,
  "full_name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "access_level" "access_level" NOT NULL DEFAULT 'STAFF',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX "admins_email_key" ON "admins"("email");

-- ============================================================
-- LEADS TABLE
-- ============================================================

CREATE TABLE "leads" (
  "id" SERIAL PRIMARY KEY,
  "email" TEXT NOT NULL,
  "full_name" TEXT,
  "company_name" TEXT,
  "company_size" TEXT,
  "company_website" TEXT,
  "plan_interest" "client_plan",
  "message" TEXT,
  "contacted" BOOLEAN NOT NULL DEFAULT false,
  "status" "lead_status" NOT NULL DEFAULT 'NEW',
  "converted_to_user_id" INTEGER,
  "converted_to_client_id" INTEGER,
  "represented_by" INTEGER,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);

-- Foreign keys
ALTER TABLE "leads"
  ADD CONSTRAINT "leads_converted_to_user_id_fkey"
  FOREIGN KEY ("converted_to_user_id") REFERENCES "users"("id")
  ON DELETE SET NULL;

ALTER TABLE "leads"
  ADD CONSTRAINT "leads_converted_to_client_id_fkey"
  FOREIGN KEY ("converted_to_client_id") REFERENCES "clients"("id")
  ON DELETE SET NULL;

ALTER TABLE "leads"
  ADD CONSTRAINT "leads_represented_by_fkey"
  FOREIGN KEY ("represented_by") REFERENCES "admins"("id")
  ON DELETE SET NULL;

-- Indexes
CREATE INDEX "leads_email_idx" ON "leads"("email");
CREATE INDEX "leads_status_idx" ON "leads"("status");
CREATE INDEX "leads_represented_by_idx" ON "leads"("represented_by");

-- ============================================================
-- CLIENTS TABLE — Social media columns
-- ============================================================

ALTER TABLE "clients" ADD COLUMN "client_website" TEXT;
ALTER TABLE "clients" ADD COLUMN "client_x" TEXT;
ALTER TABLE "clients" ADD COLUMN "client_linkedin" TEXT;
ALTER TABLE "clients" ADD COLUMN "client_instagram" TEXT;
