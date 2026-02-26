-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "added_by" INTEGER,
ADD COLUMN     "modified_by" INTEGER;

-- CreateIndex
CREATE INDEX "clients_added_by_idx" ON "clients"("added_by");

-- CreateIndex
CREATE INDEX "clients_modified_by_idx" ON "clients"("modified_by");

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_modified_by_fkey" FOREIGN KEY ("modified_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
