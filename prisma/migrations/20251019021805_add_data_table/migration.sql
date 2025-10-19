-- CreateTable
CREATE TABLE "public"."DataTable" (
    "id" TEXT NOT NULL,
    "userId" VARCHAR(255) NOT NULL,
    "tableName" VARCHAR(255) NOT NULL,
    "partition" INTEGER NOT NULL DEFAULT 0,
    "schema" JSONB NOT NULL,
    "data" JSONB NOT NULL,
    "recordCount" INTEGER NOT NULL DEFAULT 0,
    "isFull" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataTable_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DataTable_userId_tableName_idx" ON "public"."DataTable"("userId", "tableName");

-- CreateIndex
CREATE INDEX "DataTable_userId_tableName_isFull_idx" ON "public"."DataTable"("userId", "tableName", "isFull");

-- CreateIndex
CREATE UNIQUE INDEX "DataTable_userId_tableName_partition_key" ON "public"."DataTable"("userId", "tableName", "partition");
