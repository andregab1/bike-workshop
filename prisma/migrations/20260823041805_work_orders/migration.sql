-- CreateEnum
CREATE TYPE "WorkOrderStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'READY', 'COMPLETED', 'CANCELLED');

-- AlterTable
ALTER TABLE "inventory_movements" ADD COLUMN     "workOrderId" TEXT;

-- CreateTable
CREATE TABLE "work_order_counters" (
    "workshopId" TEXT NOT NULL,
    "nextNumber" INTEGER NOT NULL DEFAULT 1001,

    CONSTRAINT "work_order_counters_pkey" PRIMARY KEY ("workshopId")
);

-- CreateTable
CREATE TABLE "work_orders" (
    "id" TEXT NOT NULL,
    "workshopId" TEXT NOT NULL,
    "bikeId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "legacyKey" TEXT,
    "status" "WorkOrderStatus" NOT NULL DEFAULT 'OPEN',
    "complaint" TEXT NOT NULL,
    "diagnosis" TEXT NOT NULL DEFAULT '',
    "expectedText" TEXT,
    "checklistSnapshot" JSONB,
    "laborSubtotalCents" INTEGER NOT NULL DEFAULT 0,
    "partsSubtotalCents" INTEGER NOT NULL DEFAULT 0,
    "totalCents" INTEGER NOT NULL DEFAULT 0,
    "stockConsumed" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_order_service_lines" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "serviceCatalogItemId" TEXT,
    "nameSnapshot" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unitPriceCents" INTEGER NOT NULL,

    CONSTRAINT "work_order_service_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_order_part_lines" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "nameSnapshot" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unitPriceCents" INTEGER NOT NULL,
    "unitCostCents" INTEGER,
    "locationSnapshot" TEXT,

    CONSTRAINT "work_order_part_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "work_orders_workshopId_status_updatedAt_idx" ON "work_orders"("workshopId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "work_orders_bikeId_createdAt_idx" ON "work_orders"("bikeId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "work_orders_workshopId_number_key" ON "work_orders"("workshopId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "work_orders_workshopId_legacyKey_key" ON "work_orders"("workshopId", "legacyKey");

-- CreateIndex
CREATE INDEX "work_order_service_lines_workOrderId_idx" ON "work_order_service_lines"("workOrderId");

-- CreateIndex
CREATE INDEX "work_order_part_lines_workOrderId_idx" ON "work_order_part_lines"("workOrderId");

-- CreateIndex
CREATE INDEX "work_order_part_lines_inventoryItemId_idx" ON "work_order_part_lines"("inventoryItemId");

-- CreateIndex
CREATE INDEX "inventory_movements_workOrderId_type_idx" ON "inventory_movements"("workOrderId", "type");

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_counters" ADD CONSTRAINT "work_order_counters_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "workshops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "workshops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_bikeId_fkey" FOREIGN KEY ("bikeId") REFERENCES "bikes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_service_lines" ADD CONSTRAINT "work_order_service_lines_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_service_lines" ADD CONSTRAINT "work_order_service_lines_serviceCatalogItemId_fkey" FOREIGN KEY ("serviceCatalogItemId") REFERENCES "service_catalog_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_part_lines" ADD CONSTRAINT "work_order_part_lines_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_part_lines" ADD CONSTRAINT "work_order_part_lines_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
