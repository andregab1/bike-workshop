ALTER TABLE "work_orders" ADD COLUMN "customerSnapshotId" TEXT;

UPDATE "work_orders" AS wo
SET "customerSnapshotId" = bikes."customerId"
FROM "bikes"
WHERE wo."bikeId" = bikes."id";

ALTER TABLE "work_orders" ALTER COLUMN "customerSnapshotId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "work_orders_workshopId_customerSnapshotId_idx" ON "work_orders"("workshopId", "customerSnapshotId");

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_customerSnapshotId_fkey" FOREIGN KEY ("customerSnapshotId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
