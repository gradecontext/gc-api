-- DropForeignKey
ALTER TABLE "decision_contexts" DROP CONSTRAINT "decision_contexts_category_id_fkey";

-- DropForeignKey
ALTER TABLE "decisions" DROP CONSTRAINT "decisions_decision_type_id_fkey";

-- DropIndex
DROP INDEX "decisions_decision_type_id_idx";

-- AlterTable
ALTER TABLE "client_context_categories" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "client_decision_types" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AddForeignKey
ALTER TABLE "decision_contexts" ADD CONSTRAINT "decision_contexts_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "client_context_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_decision_type_id_fkey" FOREIGN KEY ("decision_type_id") REFERENCES "client_decision_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
