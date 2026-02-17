-- Drop the cross-schema FK to auth.users if it exists.
-- This FK causes Prisma introspection errors (P4002) because it references
-- the Supabase-managed "auth" schema. The relationship is enforced at the
-- application level via supabaseAdmin.auth.getUser() instead.

ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_supabase_auth_id_fkey";
