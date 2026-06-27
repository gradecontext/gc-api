-- ============================================================
-- Migration: Simplify per-company membership roles to ADMIN/STAFF
--
-- Collapses the 4-tier user_role enum (OWNER, ADMIN, APPROVER, VIEWER)
-- into a 2-tier model: ADMIN, STAFF.
--   OWNER, ADMIN     -> ADMIN
--   APPROVER, VIEWER -> STAFF
--
-- Postgres can't drop enum values in place, so this rebuilds the type:
-- create the new enum, remap existing rows onto it, swap it in, drop the old one.
-- ============================================================

-- 1. New enum with only the two roles we're keeping
CREATE TYPE "user_role_new" AS ENUM ('ADMIN', 'STAFF');

-- 2. Remap existing membership rows onto the new enum
ALTER TABLE "memberships" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "memberships" ALTER COLUMN "role" TYPE "user_role_new" USING (
  CASE "role"::text
    WHEN 'OWNER' THEN 'ADMIN'
    WHEN 'ADMIN' THEN 'ADMIN'
    WHEN 'APPROVER' THEN 'STAFF'
    WHEN 'VIEWER' THEN 'STAFF'
  END
)::"user_role_new";
ALTER TABLE "memberships" ALTER COLUMN "role" SET DEFAULT 'STAFF';

-- 3. Swap the enum type in
DROP TYPE "user_role";
ALTER TYPE "user_role_new" RENAME TO "user_role";
