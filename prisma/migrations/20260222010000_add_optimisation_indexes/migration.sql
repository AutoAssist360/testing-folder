-- CreateIndex
CREATE INDEX "inventories_warehouse_id_idx" ON "inventories"("warehouse_id");

-- CreateIndex
CREATE INDEX "inventory_reservations_expires_at_idx" ON "inventory_reservations"("expires_at");

-- CreateIndex
CREATE INDEX "warehouses_vendor_id_is_active_idx" ON "warehouses"("vendor_id", "is_active");
