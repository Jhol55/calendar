/*
  Warnings:

  - You are about to drop the `instance` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `licence` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "public"."instance";

-- DropTable
DROP TABLE "public"."licence";

-- CreateTable
CREATE TABLE "public"."instances" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "paircode" TEXT NOT NULL,
    "qrcode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "profileName" TEXT NOT NULL,
    "profilePicUrl" TEXT NOT NULL,
    "isBusiness" BOOLEAN NOT NULL DEFAULT false,
    "plataform" TEXT NOT NULL,
    "systemName" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "current_presence" TEXT NOT NULL,
    "lastDisconnect" TEXT NOT NULL,
    "lastDisconnectReason" TEXT NOT NULL,
    "adminField01" TEXT NOT NULL,
    "adminField02" TEXT NOT NULL,
    "openai_apikey" TEXT NOT NULL,
    "chatbot_enabled" BOOLEAN NOT NULL DEFAULT false,
    "chatbot_ignoreGroups" BOOLEAN NOT NULL DEFAULT false,
    "chatbot_stopConversation" TEXT NOT NULL,
    "chatbot_stopMinutes" INTEGER NOT NULL DEFAULT 0,
    "chatbot_stopWhenYouSendMsg" INTEGER NOT NULL DEFAULT 0,
    "created" TEXT NOT NULL,
    "updated" TEXT NOT NULL,
    "currentTime" TEXT NOT NULL,

    CONSTRAINT "instances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."chatbot_flows" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "nodes" JSONB NOT NULL,
    "edges" JSONB NOT NULL,
    "instanceId" TEXT,
    "userId" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chatbot_flows_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "instances_owner_idx" ON "public"."instances"("owner");

-- CreateIndex
CREATE INDEX "instances_status_idx" ON "public"."instances"("status");

-- CreateIndex
CREATE INDEX "chatbot_flows_instanceId_idx" ON "public"."chatbot_flows"("instanceId");

-- CreateIndex
CREATE INDEX "chatbot_flows_userId_idx" ON "public"."chatbot_flows"("userId");

-- CreateIndex
CREATE INDEX "chatbot_flows_isActive_idx" ON "public"."chatbot_flows"("isActive");

-- AddForeignKey
ALTER TABLE "public"."chatbot_flows" ADD CONSTRAINT "chatbot_flows_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "public"."instances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."chatbot_flows" ADD CONSTRAINT "chatbot_flows_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
