/*
  Warnings:

  - Added the required column `webhook` to the `instances` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."instances" ADD COLUMN     "webhook" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "public"."flow_executions" (
    "id" TEXT NOT NULL,
    "flowId" VARCHAR(255) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running',
    "triggerType" TEXT NOT NULL DEFAULT 'webhook',
    "triggerData" JSONB,
    "startTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endTime" TIMESTAMP(3),
    "duration" INTEGER,
    "error" TEXT,
    "data" JSONB,
    "result" JSONB,
    "nodeExecutions" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "flow_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."chatbot_memories" (
    "id" TEXT NOT NULL,
    "userId" VARCHAR(255) NOT NULL,
    "chave" VARCHAR(255) NOT NULL,
    "valor" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chatbot_memories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "flow_executions_flowId_idx" ON "public"."flow_executions"("flowId");

-- CreateIndex
CREATE INDEX "flow_executions_status_idx" ON "public"."flow_executions"("status");

-- CreateIndex
CREATE INDEX "flow_executions_startTime_idx" ON "public"."flow_executions"("startTime");

-- CreateIndex
CREATE INDEX "flow_executions_triggerType_idx" ON "public"."flow_executions"("triggerType");

-- CreateIndex
CREATE INDEX "chatbot_memories_userId_idx" ON "public"."chatbot_memories"("userId");

-- CreateIndex
CREATE INDEX "chatbot_memories_expiresAt_idx" ON "public"."chatbot_memories"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "chatbot_memories_userId_chave_key" ON "public"."chatbot_memories"("userId", "chave");

-- AddForeignKey
ALTER TABLE "public"."flow_executions" ADD CONSTRAINT "flow_executions_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "public"."chatbot_flows"("id") ON DELETE CASCADE ON UPDATE CASCADE;
