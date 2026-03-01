-- CreateEnum
CREATE TYPE "contact_message_status" AS ENUM ('NEW', 'IN_PROGRESS', 'RESPONDED', 'CLOSED', 'SPAM');

-- CreateEnum
CREATE TYPE "contact_priority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "source" TEXT;

-- CreateTable
CREATE TABLE "contact_messages" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "source" TEXT,
    "status" "contact_message_status" NOT NULL DEFAULT 'NEW',
    "priority" "contact_priority" NOT NULL DEFAULT 'NORMAL',
    "contacted_by" INTEGER,
    "responded_at" TIMESTAMPTZ(6),
    "ip_address" VARCHAR(45),
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "contact_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "beta_access_list" (
    "id" SERIAL NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "company_name" TEXT,
    "number_of_users_range" TEXT,
    "source" TEXT,
    "plan_interest" "client_plan",
    "allow_access" BOOLEAN NOT NULL DEFAULT false,
    "approved_by" INTEGER,
    "approved_at" TIMESTAMPTZ(6),
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "beta_access_list_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contact_messages_email_idx" ON "contact_messages"("email");

-- CreateIndex
CREATE INDEX "contact_messages_status_idx" ON "contact_messages"("status");

-- CreateIndex
CREATE INDEX "contact_messages_contacted_by_idx" ON "contact_messages"("contacted_by");

-- CreateIndex
CREATE INDEX "contact_messages_created_at_idx" ON "contact_messages"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "beta_access_list_email_key" ON "beta_access_list"("email");

-- CreateIndex
CREATE INDEX "beta_access_list_email_idx" ON "beta_access_list"("email");

-- CreateIndex
CREATE INDEX "beta_access_list_allow_access_idx" ON "beta_access_list"("allow_access");

-- CreateIndex
CREATE INDEX "beta_access_list_approved_by_idx" ON "beta_access_list"("approved_by");

-- AddForeignKey
ALTER TABLE "contact_messages" ADD CONSTRAINT "contact_messages_contacted_by_fkey" FOREIGN KEY ("contacted_by") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beta_access_list" ADD CONSTRAINT "beta_access_list_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;
