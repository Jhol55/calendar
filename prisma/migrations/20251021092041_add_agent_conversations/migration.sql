-- CreateTable
CREATE TABLE "public"."agent_conversations" (
    "id" TEXT NOT NULL,
    "userId" VARCHAR(255) NOT NULL,
    "flowId" VARCHAR(255),
    "nodeId" VARCHAR(255),
    "messages" JSONB NOT NULL,
    "maxLength" INTEGER NOT NULL DEFAULT 10,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agent_conversations_userId_idx" ON "public"."agent_conversations"("userId");

-- CreateIndex
CREATE INDEX "agent_conversations_flowId_idx" ON "public"."agent_conversations"("flowId");

-- CreateIndex
CREATE INDEX "agent_conversations_lastMessageAt_idx" ON "public"."agent_conversations"("lastMessageAt");

-- CreateIndex
CREATE INDEX "agent_conversations_expiresAt_idx" ON "public"."agent_conversations"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "agent_conversations_userId_flowId_nodeId_key" ON "public"."agent_conversations"("userId", "flowId", "nodeId");
