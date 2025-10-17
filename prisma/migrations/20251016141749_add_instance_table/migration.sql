-- CreateTable
CREATE TABLE "public"."instance" (
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

    CONSTRAINT "instance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "instance_owner_idx" ON "public"."instance"("owner");

-- CreateIndex
CREATE INDEX "instance_status_idx" ON "public"."instance"("status");
