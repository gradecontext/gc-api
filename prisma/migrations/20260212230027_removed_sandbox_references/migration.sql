/*
  Warnings:

  - The values [SANDBOX_USER] on the enum `user_role` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `sandbox_id` on the `decisions` table. All the data in the column will be lost.
  - You are about to drop the `sandbox_accounts` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "user_role_new" AS ENUM ('OWNER', 'ADMIN', 'APPROVER', 'VIEWER');
ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "role" TYPE "user_role_new" USING ("role"::text::"user_role_new");
ALTER TYPE "user_role" RENAME TO "user_role_old";
ALTER TYPE "user_role_new" RENAME TO "user_role";
DROP TYPE "user_role_old";
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'VIEWER';
COMMIT;

-- DropForeignKey
ALTER TABLE "decisions" DROP CONSTRAINT "decisions_sandbox_id_fkey";

-- DropForeignKey
ALTER TABLE "sandbox_accounts" DROP CONSTRAINT "sandbox_accounts_client_id_fkey";

-- DropIndex
DROP INDEX "decisions_client_id_sandbox_id_idx";

-- AlterTable
ALTER TABLE "decisions" DROP COLUMN "sandbox_id";

-- DropTable
DROP TABLE "sandbox_accounts";

-- DropEnum
DROP TYPE "sandbox_environment";
