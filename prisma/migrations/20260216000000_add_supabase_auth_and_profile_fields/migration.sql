-- Migration: Add Supabase auth integration and profile fields
-- Adds supabase_auth_id, profile columns to users table
-- Adds verified, approved, details, logo, cover_image to clients table
-- Creates gender enum type

-- ============================================================
-- GENDER ENUM
-- ============================================================

CREATE TYPE "gender" AS ENUM (
  'MALE',
  'FEMALE',
  'NON_BINARY',
  'GENDERQUEER',
  'GENDERFLUID',
  'AGENDER',
  'BIGENDER',
  'TWO_SPIRIT',
  'TRANSGENDER_MALE',
  'TRANSGENDER_FEMALE',
  'INTERSEX',
  'PREFER_NOT_TO_SAY',
  'OTHER'
);

-- ============================================================
-- USERS TABLE — New columns
-- ============================================================

-- Supabase auth link (UUID referencing auth.users managed by Supabase)
ALTER TABLE "users" ADD COLUMN "supabase_auth_id" UUID;
CREATE UNIQUE INDEX "users_supabase_auth_id_key" ON "users"("supabase_auth_id");
CREATE INDEX "users_supabase_auth_id_idx" ON "users"("supabase_auth_id");

-- NOTE: No FK to auth.users — Supabase auth is verified at the application
-- level via supabaseAdmin.auth.getUser(). A cross-schema FK causes Prisma
-- introspection errors (P4002) and is unnecessary given the app-level check.

-- Profile fields
ALTER TABLE "users" ADD COLUMN "verified" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "users" ADD COLUMN "display_name" VARCHAR(150);
ALTER TABLE "users" ADD COLUMN "user_name" VARCHAR(100);
ALTER TABLE "users" ADD COLUMN "image_url" TEXT;
ALTER TABLE "users" ADD COLUMN "user_image" TEXT;
ALTER TABLE "users" ADD COLUMN "user_image_cover" TEXT;
ALTER TABLE "users" ADD COLUMN "user_bio_detail" TEXT;
ALTER TABLE "users" ADD COLUMN "user_bio_brief" VARCHAR(255);
ALTER TABLE "users" ADD COLUMN "gender" "gender";

-- ============================================================
-- CLIENTS TABLE — New columns
-- ============================================================

ALTER TABLE "clients" ADD COLUMN "verified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "clients" ADD COLUMN "approved" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "clients" ADD COLUMN "details" TEXT;
ALTER TABLE "clients" ADD COLUMN "logo" TEXT;
ALTER TABLE "clients" ADD COLUMN "cover_image" TEXT;
