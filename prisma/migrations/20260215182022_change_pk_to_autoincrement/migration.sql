/*
  Warnings:

  - The primary key for the `clients` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `clients` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `user_id` column on the `decision_outcomes` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `decided_by` column on the `decisions` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `subject_companies` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `subject_companies` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `users` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `users` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Changed the type of `subject_company_id` on the `deals` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `client_id` on the `decision_contexts` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `user_id` on the `decision_human_overrides` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `subject_company_id` on the `decisions` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `client_id` on the `decisions` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `client_id` on the `policies` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `client_id` on the `subject_companies` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `client_id` on the `users` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `client_id` on the `webhook_events` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- DropForeignKey
ALTER TABLE "deals" DROP CONSTRAINT "deals_subject_company_id_fkey";

-- DropForeignKey
ALTER TABLE "decision_contexts" DROP CONSTRAINT "decision_contexts_client_id_fkey";

-- DropForeignKey
ALTER TABLE "decision_human_overrides" DROP CONSTRAINT "decision_human_overrides_user_id_fkey";

-- DropForeignKey
ALTER TABLE "decision_outcomes" DROP CONSTRAINT "decision_outcomes_user_id_fkey";

-- DropForeignKey
ALTER TABLE "decisions" DROP CONSTRAINT "decisions_client_id_fkey";

-- DropForeignKey
ALTER TABLE "decisions" DROP CONSTRAINT "decisions_decided_by_fkey";

-- DropForeignKey
ALTER TABLE "decisions" DROP CONSTRAINT "decisions_subject_company_id_fkey";

-- DropForeignKey
ALTER TABLE "policies" DROP CONSTRAINT "policies_client_id_fkey";

-- DropForeignKey
ALTER TABLE "subject_companies" DROP CONSTRAINT "subject_companies_client_id_fkey";

-- DropForeignKey
ALTER TABLE "users" DROP CONSTRAINT "users_client_id_fkey";

-- DropForeignKey
ALTER TABLE "webhook_events" DROP CONSTRAINT "webhook_events_client_id_fkey";

-- AlterTable
ALTER TABLE "clients" DROP CONSTRAINT "clients_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "clients_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "deals" DROP COLUMN "subject_company_id",
ADD COLUMN     "subject_company_id" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "decision_contexts" DROP COLUMN "client_id",
ADD COLUMN     "client_id" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "decision_human_overrides" DROP COLUMN "user_id",
ADD COLUMN     "user_id" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "decision_outcomes" DROP COLUMN "user_id",
ADD COLUMN     "user_id" INTEGER;

-- AlterTable
ALTER TABLE "decisions" DROP COLUMN "subject_company_id",
ADD COLUMN     "subject_company_id" INTEGER NOT NULL,
DROP COLUMN "decided_by",
ADD COLUMN     "decided_by" INTEGER,
DROP COLUMN "client_id",
ADD COLUMN     "client_id" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "policies" DROP COLUMN "client_id",
ADD COLUMN     "client_id" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "subject_companies" DROP CONSTRAINT "subject_companies_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
DROP COLUMN "client_id",
ADD COLUMN     "client_id" INTEGER NOT NULL,
ADD CONSTRAINT "subject_companies_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "users" DROP CONSTRAINT "users_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
DROP COLUMN "client_id",
ADD COLUMN     "client_id" INTEGER NOT NULL,
ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "webhook_events" DROP COLUMN "client_id",
ADD COLUMN     "client_id" INTEGER NOT NULL;

-- CreateIndex
CREATE INDEX "deals_subject_company_id_idx" ON "deals"("subject_company_id");

-- CreateIndex
CREATE INDEX "decision_contexts_client_id_idx" ON "decision_contexts"("client_id");

-- CreateIndex
CREATE UNIQUE INDEX "decision_contexts_client_id_key_key" ON "decision_contexts"("client_id", "key");

-- CreateIndex
CREATE INDEX "decision_human_overrides_user_id_idx" ON "decision_human_overrides"("user_id");

-- CreateIndex
CREATE INDEX "decisions_client_id_idx" ON "decisions"("client_id");

-- CreateIndex
CREATE INDEX "decisions_subject_company_id_idx" ON "decisions"("subject_company_id");

-- CreateIndex
CREATE INDEX "decisions_client_id_status_idx" ON "decisions"("client_id", "status");

-- CreateIndex
CREATE INDEX "decisions_client_id_decision_type_idx" ON "decisions"("client_id", "decision_type");

-- CreateIndex
CREATE INDEX "decisions_client_id_context_id_idx" ON "decisions"("client_id", "context_id");

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
ALTER TABLE "deals" ADD CONSTRAINT "deals_subject_company_id_fkey" FOREIGN KEY ("subject_company_id") REFERENCES "subject_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_contexts" ADD CONSTRAINT "decision_contexts_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_subject_company_id_fkey" FOREIGN KEY ("subject_company_id") REFERENCES "subject_companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_decided_by_fkey" FOREIGN KEY ("decided_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_human_overrides" ADD CONSTRAINT "decision_human_overrides_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_outcomes" ADD CONSTRAINT "decision_outcomes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policies" ADD CONSTRAINT "policies_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_events" ADD CONSTRAINT "webhook_events_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
