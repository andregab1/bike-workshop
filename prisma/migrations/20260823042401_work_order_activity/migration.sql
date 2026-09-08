-- CreateEnum
CREATE TYPE "WorkOrderActivityType" AS ENUM ('CREATED', 'DIAGNOSIS_UPDATED', 'ITEMS_UPDATED', 'CHECKLIST_UPDATED', 'STATUS_CHANGED', 'STOCK_CONSUMED', 'STOCK_REVERSED');

-- CreateTable
CREATE TABLE "work_order_activities" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "type" "WorkOrderActivityType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_order_activities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "work_order_activities_workOrderId_createdAt_idx" ON "work_order_activities"("workOrderId", "createdAt");

-- AddForeignKey
ALTER TABLE "work_order_activities" ADD CONSTRAINT "work_order_activities_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
