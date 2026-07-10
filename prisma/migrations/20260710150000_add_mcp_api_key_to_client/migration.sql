-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "mcp_api_key" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "clients_mcp_api_key_key" ON "clients"("mcp_api_key");
