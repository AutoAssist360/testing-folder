-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "gateway_response" JSONB,
ADD COLUMN     "payment_method" TEXT,
ADD COLUMN     "transaction_id" TEXT;

-- AlterTable
ALTER TABLE "jobs" ADD COLUMN     "deleted_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "service_requests" ADD COLUMN     "deleted_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "technician_profiles" ADD COLUMN     "is_online" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "deleted_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "audit_logs" (
    "log_id" UUID NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "old_value" JSONB,
    "new_value" JSONB,
    "performed_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("log_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "invoices_transaction_id_key" ON "invoices"("transaction_id");

-- CreateIndex
CREATE INDEX "jobs_status_idx" ON "jobs"("status");

-- CreateIndex
CREATE INDEX "service_requests_status_idx" ON "service_requests"("status");

-- CreateIndex
CREATE INDEX "service_requests_breakdown_latitude_breakdown_longitude_idx" ON "service_requests"("breakdown_latitude", "breakdown_longitude");

-- CreateIndex
CREATE INDEX "technician_profiles_latitude_longitude_idx" ON "technician_profiles"("latitude", "longitude");

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_performed_by_fkey" FOREIGN KEY ("performed_by") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
