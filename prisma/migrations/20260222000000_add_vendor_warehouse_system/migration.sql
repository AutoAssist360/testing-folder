-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled');

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('active', 'expired', 'converted', 'cancelled');

-- CreateEnum
CREATE TYPE "FulfillmentStatus" AS ENUM ('pending', 'processing', 'shipped', 'in_transit', 'delivered', 'failed');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'vendor';

-- CreateTable
CREATE TABLE "warehouses" (
    "warehouse_id" UUID NOT NULL,
    "vendor_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "postal_code" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "phone" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouses_pkey" PRIMARY KEY ("warehouse_id")
);

-- CreateTable
CREATE TABLE "inventories" (
    "inventory_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "part_id" INTEGER NOT NULL,
    "quantity_available" INTEGER NOT NULL DEFAULT 0,
    "quantity_reserved" INTEGER NOT NULL DEFAULT 0,
    "unit_cost" DECIMAL(10,2) NOT NULL,
    "reorder_level" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventories_pkey" PRIMARY KEY ("inventory_id")
);

-- CreateTable
CREATE TABLE "inventory_reservations" (
    "reservation_id" UUID NOT NULL,
    "inventory_id" UUID NOT NULL,
    "order_id" UUID,
    "request_id" UUID,
    "quantity" INTEGER NOT NULL,
    "reserved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "status" "ReservationStatus" NOT NULL DEFAULT 'active',

    CONSTRAINT "inventory_reservations_pkey" PRIMARY KEY ("reservation_id")
);

-- CreateTable
CREATE TABLE "orders" (
    "order_id" UUID NOT NULL,
    "order_number" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "request_id" UUID,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "tax" DECIMAL(10,2) NOT NULL,
    "total" DECIMAL(10,2) NOT NULL,
    "payment_status" "PaymentStatus" NOT NULL DEFAULT 'pending',
    "order_status" "OrderStatus" NOT NULL DEFAULT 'pending',
    "transaction_id" TEXT,
    "payment_method" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("order_id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "order_item_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "part_id" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(10,2) NOT NULL,
    "total_price" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("order_item_id")
);

-- CreateTable
CREATE TABLE "fulfillments" (
    "fulfillment_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "status" "FulfillmentStatus" NOT NULL DEFAULT 'pending',
    "tracking_number" TEXT,
    "carrier" TEXT,
    "shipped_at" TIMESTAMP(3),
    "estimated_delivery" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fulfillments_pkey" PRIMARY KEY ("fulfillment_id")
);

-- CreateIndex
CREATE INDEX "warehouses_vendor_id_idx" ON "warehouses"("vendor_id");

-- CreateIndex
CREATE INDEX "warehouses_latitude_longitude_idx" ON "warehouses"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "warehouses_city_state_idx" ON "warehouses"("city", "state");

-- CreateIndex
CREATE INDEX "inventories_part_id_idx" ON "inventories"("part_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventories_warehouse_id_part_id_key" ON "inventories"("warehouse_id", "part_id");

-- CreateIndex
CREATE INDEX "inventory_reservations_inventory_id_idx" ON "inventory_reservations"("inventory_id");

-- CreateIndex
CREATE INDEX "inventory_reservations_order_id_idx" ON "inventory_reservations"("order_id");

-- CreateIndex
CREATE INDEX "inventory_reservations_request_id_idx" ON "inventory_reservations"("request_id");

-- CreateIndex
CREATE INDEX "inventory_reservations_status_expires_at_idx" ON "inventory_reservations"("status", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "orders_order_number_key" ON "orders"("order_number");

-- CreateIndex
CREATE UNIQUE INDEX "orders_transaction_id_key" ON "orders"("transaction_id");

-- CreateIndex
CREATE INDEX "orders_user_id_idx" ON "orders"("user_id");

-- CreateIndex
CREATE INDEX "orders_warehouse_id_idx" ON "orders"("warehouse_id");

-- CreateIndex
CREATE INDEX "orders_request_id_idx" ON "orders"("request_id");

-- CreateIndex
CREATE INDEX "orders_order_status_idx" ON "orders"("order_status");

-- CreateIndex
CREATE INDEX "orders_payment_status_idx" ON "orders"("payment_status");

-- CreateIndex
CREATE INDEX "order_items_order_id_idx" ON "order_items"("order_id");

-- CreateIndex
CREATE INDEX "order_items_part_id_idx" ON "order_items"("part_id");

-- CreateIndex
CREATE INDEX "fulfillments_order_id_idx" ON "fulfillments"("order_id");

-- CreateIndex
CREATE INDEX "fulfillments_status_idx" ON "fulfillments"("status");

-- AddForeignKey
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventories" ADD CONSTRAINT "inventories_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("warehouse_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventories" ADD CONSTRAINT "inventories_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "car_parts"("part_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_reservations" ADD CONSTRAINT "inventory_reservations_inventory_id_fkey" FOREIGN KEY ("inventory_id") REFERENCES "inventories"("inventory_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_reservations" ADD CONSTRAINT "inventory_reservations_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("order_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_reservations" ADD CONSTRAINT "inventory_reservations_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "service_requests"("request_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("warehouse_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "service_requests"("request_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("order_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "car_parts"("part_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fulfillments" ADD CONSTRAINT "fulfillments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("order_id") ON DELETE RESTRICT ON UPDATE CASCADE;
