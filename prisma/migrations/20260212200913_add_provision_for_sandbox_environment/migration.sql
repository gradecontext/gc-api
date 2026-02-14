/*
  Warnings:

  - You are about to drop the column `tenant_id` on the `decision_contexts` table. All the data in the column will be lost.
  - You are about to drop the column `tenant_id` on the `decisions` table. All the data in the column will be lost.
  - You are about to drop the column `tenant_id` on the `policies` table. All the data in the column will be lost.
  - You are about to drop the column `tenant_id` on the `subject_companies` table. All the data in the column will be lost.
  - You are about to drop the column `tenant_id` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `tenant_id` on the `webhook_events` table. All the data in the column will be lost.
  - You are about to drop the `tenants` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[client_id,key]` on the table `decision_contexts` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[client_id,external_id]` on the table `subject_companies` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[client_id,email]` on the table `users` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `client_id` to the `decision_contexts` table without a default value. This is not possible if the table is not empty.
  - Added the required column `client_id` to the `decisions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `client_id` to the `policies` table without a default value. This is not possible if the table is not empty.
  - Added the required column `client_id` to the `subject_companies` table without a default value. This is not possible if the table is not empty.
  - Added the required column `client_id` to the `users` table without a default value. This is not possible if the table is not empty.
  - Added the required column `client_id` to the `webhook_events` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "client_plan" AS ENUM ('FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "sandbox_environment" AS ENUM ('SANDBOX', 'STAGING', 'DEMO');

-- AlterEnum
ALTER TYPE "user_role" ADD VALUE 'SANDBOX_USER';

-- DropForeignKey
ALTER TABLE "decision_contexts" DROP CONSTRAINT "decision_contexts_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "decisions" DROP CONSTRAINT "decisions_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "policies" DROP CONSTRAINT "policies_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "subject_companies" DROP CONSTRAINT "subject_companies_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "users" DROP CONSTRAINT "users_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "webhook_events" DROP CONSTRAINT "webhook_events_tenant_id_fkey";

-- DropIndex
DROP INDEX "decision_contexts_tenant_id_idx";

-- DropIndex
DROP INDEX "decision_contexts_tenant_id_key_key";

-- DropIndex
DROP INDEX "decisions_tenant_id_context_id_idx";

-- DropIndex
DROP INDEX "decisions_tenant_id_decision_type_idx";

-- DropIndex
DROP INDEX "decisions_tenant_id_idx";

-- DropIndex
DROP INDEX "decisions_tenant_id_status_idx";

-- DropIndex
DROP INDEX "policies_tenant_id_active_idx";

-- DropIndex
DROP INDEX "policies_tenant_id_idx";

-- DropIndex
DROP INDEX "subject_companies_tenant_id_domain_idx";

-- DropIndex
DROP INDEX "subject_companies_tenant_id_external_id_key";

-- DropIndex
DROP INDEX "subject_companies_tenant_id_idx";

-- DropIndex
DROP INDEX "users_tenant_id_email_key";

-- DropIndex
DROP INDEX "users_tenant_id_idx";

-- DropIndex
DROP INDEX "webhook_events_tenant_id_idx";

-- AlterTable
ALTER TABLE "decision_contexts" DROP COLUMN "tenant_id",
ADD COLUMN     "client_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "decisions" DROP COLUMN "tenant_id",
ADD COLUMN     "client_id" UUID NOT NULL,
ADD COLUMN     "sandbox_id" UUID,
ADD COLUMN     "summary" TEXT;

-- AlterTable
ALTER TABLE "policies" DROP COLUMN "tenant_id",
ADD COLUMN     "client_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "subject_companies" DROP COLUMN "tenant_id",
ADD COLUMN     "client_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "tenant_id",
ADD COLUMN     "client_id" UUID NOT NULL,
ADD COLUMN     "title" TEXT;

-- AlterTable
ALTER TABLE "webhook_events" DROP COLUMN "tenant_id",
ADD COLUMN     "client_id" UUID NOT NULL;

-- DropTable
DROP TABLE "tenants";

-- DropEnum
DROP TYPE "tenant_plan";

-- CreateTable
CREATE TABLE "clients" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "domain" TEXT,
    "api_key" TEXT,
    "webhook_secret" TEXT,
    "plan" "client_plan" NOT NULL DEFAULT 'FREE',
    "settings" JSONB DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sandbox_accounts" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "api_key" TEXT NOT NULL,
    "environment" "sandbox_environment" NOT NULL DEFAULT 'SANDBOX',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "expires_at" TIMESTAMPTZ(6),
    "settings" JSONB DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "sandbox_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "clients_slug_key" ON "clients"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "clients_api_key_key" ON "clients"("api_key");

-- CreateIndex
CREATE INDEX "clients_slug_idx" ON "clients"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "sandbox_accounts_api_key_key" ON "sandbox_accounts"("api_key");

-- CreateIndex
CREATE INDEX "sandbox_accounts_client_id_idx" ON "sandbox_accounts"("client_id");

-- CreateIndex
CREATE INDEX "sandbox_accounts_api_key_idx" ON "sandbox_accounts"("api_key");

-- CreateIndex
CREATE INDEX "decision_contexts_client_id_idx" ON "decision_contexts"("client_id");

-- CreateIndex
CREATE UNIQUE INDEX "decision_contexts_client_id_key_key" ON "decision_contexts"("client_id", "key");

-- CreateIndex
CREATE INDEX "decisions_client_id_idx" ON "decisions"("client_id");

-- CreateIndex
CREATE INDEX "decisions_client_id_status_idx" ON "decisions"("client_id", "status");

-- CreateIndex
CREATE INDEX "decisions_client_id_decision_type_idx" ON "decisions"("client_id", "decision_type");

-- CreateIndex
CREATE INDEX "decisions_client_id_context_id_idx" ON "decisions"("client_id", "context_id");

-- CreateIndex
CREATE INDEX "decisions_client_id_sandbox_id_idx" ON "decisions"("client_id", "sandbox_id");

-- CreateIndex
CREATE INDEX "policies_client_id_idx" ON "policies"("client_id");

-- CreateIndex
CREATE INDEX "policies_client_id_active_idx" ON "policies"("client_id", "active");

-- CreateIndex
CREATE INDEX "subject_companies_client_id_idx" ON "subject_companies"("client_id");

-- CreateIndex
CREATE INDEX "subject_companies_client_id_domain_idx" ON "subject_companies"("client_id", "domain");

-- CreateIndex
CREATE UNIQUE INDEX "subject_companies_client_id_external_id_key" ON "subject_companies"("client_id", "external_id");

-- CreateIndex
CREATE INDEX "users_client_id_idx" ON "users"("client_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_client_id_email_key" ON "users"("client_id", "email");

-- CreateIndex
CREATE INDEX "webhook_events_client_id_idx" ON "webhook_events"("client_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subject_companies" ADD CONSTRAINT "subject_companies_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_contexts" ADD CONSTRAINT "decision_contexts_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sandbox_accounts" ADD CONSTRAINT "sandbox_accounts_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_sandbox_id_fkey" FOREIGN KEY ("sandbox_id") REFERENCES "sandbox_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policies" ADD CONSTRAINT "policies_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_events" ADD CONSTRAINT "webhook_events_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
