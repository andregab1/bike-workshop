CREATE TABLE "work_order_communications" (
  "id" TEXT NOT NULL,
  "workshopId" TEXT NOT NULL,
  "workOrderId" TEXT NOT NULL,
  "channel" "ContactChannel" NOT NULL,
  "status" "CommunicationStatus" NOT NULL,
  "messageSnapshot" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "work_order_communications_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "work_order_communications_workshopId_createdAt_idx" ON "work_order_communications"("workshopId", "createdAt");
CREATE INDEX "work_order_communications_workOrderId_createdAt_idx" ON "work_order_communications"("workOrderId", "createdAt");
ALTER TABLE "work_order_communications" ADD CONSTRAINT "work_order_communications_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "workshops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "work_order_communications" ADD CONSTRAINT "work_order_communications_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
