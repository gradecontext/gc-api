-- DropForeignKey
ALTER TABLE "decisions" DROP CONSTRAINT "decisions_context_category_id_fkey";

-- AddForeignKey
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_context_category_id_fkey" FOREIGN KEY ("context_category_id") REFERENCES "client_context_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
