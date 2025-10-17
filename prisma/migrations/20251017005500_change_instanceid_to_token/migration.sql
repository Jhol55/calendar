-- AlterTable
ALTER TABLE "chatbot_flows" RENAME COLUMN "instanceId" TO "token";

-- DropIndex
DROP INDEX IF EXISTS "chatbot_flows_instanceId_idx";

-- CreateIndex
CREATE INDEX "chatbot_flows_token_idx" ON "chatbot_flows"("token");

-- AlterTable - Add unique constraint to instances.token
CREATE UNIQUE INDEX IF NOT EXISTS "instances_token_key" ON "instances"("token");

-- AddForeignKey
ALTER TABLE "chatbot_flows" DROP CONSTRAINT IF EXISTS "chatbot_flows_instanceId_fkey";
ALTER TABLE "chatbot_flows" ADD CONSTRAINT "chatbot_flows_token_fkey" FOREIGN KEY ("token") REFERENCES "instances"("token") ON DELETE SET NULL ON UPDATE CASCADE;


