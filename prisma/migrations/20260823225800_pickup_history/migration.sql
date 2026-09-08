DROP INDEX "work_order_pickups_workOrderId_key";
CREATE INDEX "work_order_pickups_workOrderId_pickedUpAt_idx"
ON "work_order_pickups"("workOrderId", "pickedUpAt");
