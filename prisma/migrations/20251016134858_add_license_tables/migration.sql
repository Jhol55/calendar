-- CreateTable
CREATE TABLE "public"."licenses" (
    "id" SERIAL NOT NULL,
    "apikey" VARCHAR(255) NOT NULL,
    "subdomain" VARCHAR(255),
    "ip" VARCHAR(45),
    "url" VARCHAR(255),
    "port" INTEGER,
    "ssl_path" TEXT,
    "redis_enabled" BOOLEAN NOT NULL DEFAULT false,
    "instance_count" INTEGER NOT NULL DEFAULT 0,
    "is_valid" BOOLEAN NOT NULL DEFAULT true,
    "expires_at" TIMESTAMP(3),
    "last_validation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validation_interval_seconds" INTEGER NOT NULL DEFAULT 86400,
    "last_update_version" INTEGER NOT NULL DEFAULT 647,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "licenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."license_validation_logs" (
    "id" SERIAL NOT NULL,
    "license_id" INTEGER,
    "apikey" VARCHAR(255) NOT NULL,
    "ip" VARCHAR(45),
    "validation_result" BOOLEAN,
    "error_message" TEXT,
    "validated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "license_validation_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "licenses_apikey_key" ON "public"."licenses"("apikey");

-- CreateIndex
CREATE INDEX "licenses_apikey_idx" ON "public"."licenses"("apikey");

-- CreateIndex
CREATE INDEX "licenses_subdomain_idx" ON "public"."licenses"("subdomain");

-- CreateIndex
CREATE INDEX "licenses_is_valid_idx" ON "public"."licenses"("is_valid");

-- CreateIndex
CREATE INDEX "license_validation_logs_license_id_idx" ON "public"."license_validation_logs"("license_id");

-- CreateIndex
CREATE INDEX "license_validation_logs_apikey_idx" ON "public"."license_validation_logs"("apikey");

-- AddForeignKey
ALTER TABLE "public"."license_validation_logs" ADD CONSTRAINT "license_validation_logs_license_id_fkey" FOREIGN KEY ("license_id") REFERENCES "public"."licenses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
