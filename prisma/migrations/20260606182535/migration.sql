-- DropForeignKey
ALTER TABLE "decisions" DROP CONSTRAINT "decisions_subject_company_id_fkey";

-- AlterTable
ALTER TABLE "decision_entities" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "decision_notes" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "observed_events" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "source_applications" ALTER COLUMN "id" DROP DEFAULT;

-- AddForeignKey
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_subject_company_id_fkey" FOREIGN KEY ("subject_company_id") REFERENCES "subject_companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
