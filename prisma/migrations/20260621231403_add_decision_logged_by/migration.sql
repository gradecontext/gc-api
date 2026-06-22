-- AlterTable
ALTER TABLE "ai_decision_reports" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "decisions" ADD COLUMN     "logged_by" INTEGER;

-- CreateIndex
CREATE INDEX "decisions_client_id_logged_by_idx" ON "decisions"("client_id", "logged_by");

-- AddForeignKey
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_logged_by_fkey" FOREIGN KEY ("logged_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
