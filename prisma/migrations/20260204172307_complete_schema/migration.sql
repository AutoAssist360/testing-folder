/*
  Warnings:

  - The values [ADMIN,USER,TECHNICIAN] on the enum `Role` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the `User` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "FuelType" AS ENUM ('petrol', 'diesel', 'electric', 'hybrid', 'cng');

-- CreateEnum
CREATE TYPE "Transmission" AS ENUM ('manual', 'automatic', 'semi_automatic');

-- CreateEnum
CREATE TYPE "IssueType" AS ENUM ('mechanical_failure', 'electrical_issue', 'tire_related', 'battery_issue', 'engine_problem', 'brake_issue', 'other');

-- CreateEnum
CREATE TYPE "ServiceLocationType" AS ENUM ('roadside', 'home', 'office');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('created', 'pending_offers', 'offer_accepted', 'in_progress', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('pending', 'accepted', 'rejected', 'expired');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('assigned', 'in_progress', 'completed', 'verified');

-- CreateEnum
CREATE TYPE "TechnicianType" AS ENUM ('individual', 'garage');

-- CreateEnum
CREATE TYPE "RepairMode" AS ENUM ('onsite', 'tow_to_garage');

-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('image', 'video', 'audio');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'completed', 'failed', 'refunded');

-- CreateEnum
CREATE TYPE "InvoiceItemType" AS ENUM ('labor', 'part', 'towing', 'diagnostic', 'other');

-- AlterEnum
BEGIN;
CREATE TYPE "Role_new" AS ENUM ('admin', 'user', 'technician');
ALTER TABLE "public"."User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "role" TYPE "Role_new" USING ("role"::text::"Role_new");
ALTER TYPE "Role" RENAME TO "Role_old";
ALTER TYPE "Role_new" RENAME TO "Role";
DROP TYPE "public"."Role_old";
COMMIT;

-- DropTable
DROP TABLE "User";

-- CreateTable
CREATE TABLE "users" (
    "user_id" UUID NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone_number" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "car_companies" (
    "company_id" SERIAL NOT NULL,
    "company_name" TEXT NOT NULL,

    CONSTRAINT "car_companies_pkey" PRIMARY KEY ("company_id")
);

-- CreateTable
CREATE TABLE "car_models" (
    "model_id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "model_name" TEXT NOT NULL,

    CONSTRAINT "car_models_pkey" PRIMARY KEY ("model_id")
);

-- CreateTable
CREATE TABLE "car_variants" (
    "variant_id" SERIAL NOT NULL,
    "model_id" INTEGER NOT NULL,
    "variant_name" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "fuel_type" "FuelType" NOT NULL,
    "transmission" "Transmission" NOT NULL,

    CONSTRAINT "car_variants_pkey" PRIMARY KEY ("variant_id")
);

-- CreateTable
CREATE TABLE "car_part_categories" (
    "category_id" SERIAL NOT NULL,
    "category_name" TEXT NOT NULL,

    CONSTRAINT "car_part_categories_pkey" PRIMARY KEY ("category_id")
);

-- CreateTable
CREATE TABLE "car_parts" (
    "part_id" SERIAL NOT NULL,
    "part_name" TEXT NOT NULL,
    "category_id" INTEGER NOT NULL,

    CONSTRAINT "car_parts_pkey" PRIMARY KEY ("part_id")
);

-- CreateTable
CREATE TABLE "part_prices" (
    "price_id" SERIAL NOT NULL,
    "part_id" INTEGER NOT NULL,
    "variant_id" INTEGER NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "part_prices_pkey" PRIMARY KEY ("price_id")
);

-- CreateTable
CREATE TABLE "user_vehicles" (
    "vehicle_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "variant_id" INTEGER NOT NULL,
    "registration_number" TEXT NOT NULL,
    "vin_number" TEXT NOT NULL,

    CONSTRAINT "user_vehicles_pkey" PRIMARY KEY ("vehicle_id")
);

-- CreateTable
CREATE TABLE "service_requests" (
    "request_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "issue_description" TEXT NOT NULL,
    "issue_type" "IssueType" NOT NULL,
    "breakdown_latitude" DOUBLE PRECISION,
    "breakdown_longitude" DOUBLE PRECISION,
    "service_location_type" "ServiceLocationType" NOT NULL,
    "requires_towing" BOOLEAN NOT NULL DEFAULT false,
    "status" "RequestStatus" NOT NULL DEFAULT 'created',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_requests_pkey" PRIMARY KEY ("request_id")
);

-- CreateTable
CREATE TABLE "service_request_parts" (
    "request_part_id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "part_id" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "service_request_parts_pkey" PRIMARY KEY ("request_part_id")
);

-- CreateTable
CREATE TABLE "service_request_media" (
    "media_id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "media_url" TEXT NOT NULL,
    "media_type" "MediaType" NOT NULL,

    CONSTRAINT "service_request_media_pkey" PRIMARY KEY ("media_id")
);

-- CreateTable
CREATE TABLE "technician_profiles" (
    "technician_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "business_name" TEXT,
    "technician_type" "TechnicianType" NOT NULL,
    "location" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "service_radius" INTEGER NOT NULL,
    "rating" DECIMAL(3,2),
    "total_reviews" INTEGER NOT NULL DEFAULT 0,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "technician_profiles_pkey" PRIMARY KEY ("technician_id")
);

-- CreateTable
CREATE TABLE "technician_car_supports" (
    "support_id" UUID NOT NULL,
    "technician_id" UUID NOT NULL,
    "company_id" INTEGER NOT NULL,
    "variant_id" INTEGER,

    CONSTRAINT "technician_car_supports_pkey" PRIMARY KEY ("support_id")
);

-- CreateTable
CREATE TABLE "technician_part_skills" (
    "skill_id" UUID NOT NULL,
    "technician_id" UUID NOT NULL,
    "part_id" INTEGER NOT NULL,

    CONSTRAINT "technician_part_skills_pkey" PRIMARY KEY ("skill_id")
);

-- CreateTable
CREATE TABLE "technician_certifications" (
    "certification_id" UUID NOT NULL,
    "technician_id" UUID NOT NULL,
    "certification" TEXT NOT NULL,
    "issued_by" TEXT NOT NULL,
    "issue_date" TIMESTAMP(3) NOT NULL,
    "expiry_date" TIMESTAMP(3),

    CONSTRAINT "technician_certifications_pkey" PRIMARY KEY ("certification_id")
);

-- CreateTable
CREATE TABLE "technician_resources" (
    "resource_id" UUID NOT NULL,
    "technician_id" UUID NOT NULL,
    "resource_type" TEXT NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "technician_resources_pkey" PRIMARY KEY ("resource_id")
);

-- CreateTable
CREATE TABLE "technician_offers" (
    "offer_id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "technician_id" UUID NOT NULL,
    "repair_mode" "RepairMode" NOT NULL,
    "estimated_cost" DECIMAL(10,2) NOT NULL,
    "estimated_time" INTEGER NOT NULL,
    "message" TEXT,
    "status" "OfferStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "technician_offers_pkey" PRIMARY KEY ("offer_id")
);

-- CreateTable
CREATE TABLE "jobs" (
    "job_id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "technician_id" UUID NOT NULL,
    "offer_id" UUID NOT NULL,
    "status" "JobStatus" NOT NULL,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("job_id")
);

-- CreateTable
CREATE TABLE "platform_messages" (
    "message_id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "sender_id" UUID NOT NULL,
    "receiver_id" UUID NOT NULL,
    "message" TEXT NOT NULL,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_read" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "platform_messages_pkey" PRIMARY KEY ("message_id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "invoice_id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "tax" DECIMAL(10,2) NOT NULL,
    "total" DECIMAL(10,2) NOT NULL,
    "payment_status" "PaymentStatus" NOT NULL,
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paid_at" TIMESTAMP(3),

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("invoice_id")
);

-- CreateTable
CREATE TABLE "invoice_items" (
    "item_id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "item_type" "InvoiceItemType" NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(10,2) NOT NULL,
    "total_price" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "invoice_items_pkey" PRIMARY KEY ("item_id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "review_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("review_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_number_key" ON "users"("phone_number");

-- CreateIndex
CREATE UNIQUE INDEX "car_companies_company_name_key" ON "car_companies"("company_name");

-- CreateIndex
CREATE UNIQUE INDEX "car_part_categories_category_name_key" ON "car_part_categories"("category_name");

-- CreateIndex
CREATE UNIQUE INDEX "user_vehicles_registration_number_key" ON "user_vehicles"("registration_number");

-- CreateIndex
CREATE UNIQUE INDEX "user_vehicles_vin_number_key" ON "user_vehicles"("vin_number");

-- CreateIndex
CREATE UNIQUE INDEX "technician_profiles_user_id_key" ON "technician_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "jobs_request_id_key" ON "jobs"("request_id");

-- CreateIndex
CREATE UNIQUE INDEX "jobs_offer_id_key" ON "jobs"("offer_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_job_id_key" ON "invoices"("job_id");

-- AddForeignKey
ALTER TABLE "car_models" ADD CONSTRAINT "car_models_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "car_companies"("company_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "car_variants" ADD CONSTRAINT "car_variants_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "car_models"("model_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "car_parts" ADD CONSTRAINT "car_parts_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "car_part_categories"("category_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "part_prices" ADD CONSTRAINT "part_prices_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "car_parts"("part_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_vehicles" ADD CONSTRAINT "user_vehicles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_vehicles" ADD CONSTRAINT "user_vehicles_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "car_variants"("variant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "user_vehicles"("vehicle_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_request_parts" ADD CONSTRAINT "service_request_parts_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "service_requests"("request_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_request_parts" ADD CONSTRAINT "service_request_parts_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "car_parts"("part_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_request_media" ADD CONSTRAINT "service_request_media_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "service_requests"("request_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technician_profiles" ADD CONSTRAINT "technician_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technician_car_supports" ADD CONSTRAINT "technician_car_supports_technician_id_fkey" FOREIGN KEY ("technician_id") REFERENCES "technician_profiles"("technician_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technician_car_supports" ADD CONSTRAINT "technician_car_supports_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "car_companies"("company_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technician_car_supports" ADD CONSTRAINT "technician_car_supports_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "car_variants"("variant_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technician_part_skills" ADD CONSTRAINT "technician_part_skills_technician_id_fkey" FOREIGN KEY ("technician_id") REFERENCES "technician_profiles"("technician_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technician_part_skills" ADD CONSTRAINT "technician_part_skills_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "car_parts"("part_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technician_certifications" ADD CONSTRAINT "technician_certifications_technician_id_fkey" FOREIGN KEY ("technician_id") REFERENCES "technician_profiles"("technician_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technician_resources" ADD CONSTRAINT "technician_resources_technician_id_fkey" FOREIGN KEY ("technician_id") REFERENCES "technician_profiles"("technician_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technician_offers" ADD CONSTRAINT "technician_offers_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "service_requests"("request_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technician_offers" ADD CONSTRAINT "technician_offers_technician_id_fkey" FOREIGN KEY ("technician_id") REFERENCES "technician_profiles"("technician_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "service_requests"("request_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_technician_id_fkey" FOREIGN KEY ("technician_id") REFERENCES "technician_profiles"("technician_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "technician_offers"("offer_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_messages" ADD CONSTRAINT "platform_messages_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "service_requests"("request_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_messages" ADD CONSTRAINT "platform_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_messages" ADD CONSTRAINT "platform_messages_receiver_id_fkey" FOREIGN KEY ("receiver_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("job_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("invoice_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
