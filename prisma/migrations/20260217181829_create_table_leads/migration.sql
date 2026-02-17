-- DropForeignKey
ALTER TABLE "leads" DROP CONSTRAINT "leads_converted_to_client_id_fkey";

-- DropForeignKey
ALTER TABLE "leads" DROP CONSTRAINT "leads_converted_to_user_id_fkey";

-- DropForeignKey
ALTER TABLE "leads" DROP CONSTRAINT "leads_represented_by_fkey";

-- AlterTable
ALTER TABLE "admins" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "leads" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_converted_to_user_id_fkey" FOREIGN KEY ("converted_to_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_converted_to_client_id_fkey" FOREIGN KEY ("converted_to_client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_represented_by_fkey" FOREIGN KEY ("represented_by") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;
