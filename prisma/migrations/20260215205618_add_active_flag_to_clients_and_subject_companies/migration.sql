-- AlterTable
ALTER TABLE "clients" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "subject_companies" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;
