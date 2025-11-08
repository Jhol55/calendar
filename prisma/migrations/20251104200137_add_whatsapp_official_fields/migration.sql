-- AlterTable
-- Adicionar campos para WhatsApp Official API (Meta) - Coexistência com Uazapi
-- Todos os campos são opcionais (nullable) para não afetar dados existentes

ALTER TABLE "public"."instances" ADD COLUMN IF NOT EXISTS "whatsapp_official_enabled" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "public"."instances" ADD COLUMN IF NOT EXISTS "whatsapp_official_phone_number_id" VARCHAR(255);

ALTER TABLE "public"."instances" ADD COLUMN IF NOT EXISTS "whatsapp_official_business_account_id" VARCHAR(255);

ALTER TABLE "public"."instances" ADD COLUMN IF NOT EXISTS "whatsapp_official_access_token" TEXT;

ALTER TABLE "public"."instances" ADD COLUMN IF NOT EXISTS "whatsapp_official_phone_number" VARCHAR(50);

ALTER TABLE "public"."instances" ADD COLUMN IF NOT EXISTS "whatsapp_official_status" VARCHAR(50);

ALTER TABLE "public"."instances" ADD COLUMN IF NOT EXISTS "whatsapp_official_app_id" VARCHAR(255);

ALTER TABLE "public"."instances" ADD COLUMN IF NOT EXISTS "whatsapp_official_app_secret" VARCHAR(255);

ALTER TABLE "public"."instances" ADD COLUMN IF NOT EXISTS "whatsapp_official_webhook_verify_token" VARCHAR(255);

ALTER TABLE "public"."instances" ADD COLUMN IF NOT EXISTS "whatsapp_official_connected_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "instances_whatsapp_official_enabled_idx" ON "public"."instances"("whatsapp_official_enabled");







