-- CreateTable
CREATE TABLE "work_order_pickups" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "pickedUpByName" TEXT NOT NULL,
    "documentNumber" TEXT,
    "relationship" TEXT,
    "notes" TEXT,
    "accepted" BOOLEAN NOT NULL,
    "signatureStorageKey" TEXT,
    "recordedById" TEXT NOT NULL,
    "pickedUpAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_order_pickups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_order_warranties" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "serviceLineId" TEXT,
    "descriptionSnapshot" TEXT NOT NULL,
    "warrantyDays" INTEGER NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_order_warranties_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "work_order_pickups_workOrderId_key" ON "work_order_pickups"("workOrderId");

-- CreateIndex
CREATE INDEX "work_order_warranties_workOrderId_expiresAt_idx" ON "work_order_warranties"("workOrderId", "expiresAt");

-- AddForeignKey
ALTER TABLE "work_order_pickups" ADD CONSTRAINT "work_order_pickups_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_warranties" ADD CONSTRAINT "work_order_warranties_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
