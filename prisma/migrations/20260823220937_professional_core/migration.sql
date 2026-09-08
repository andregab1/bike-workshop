-- CreateEnum
CREATE TYPE "ReservationPolicy" AS ENUM ('ON_QUOTE_APPROVAL', 'ON_WORK_ORDER_START');

-- CreateEnum
CREATE TYPE "InventoryReservationStatus" AS ENUM ('ACTIVE', 'CONSUMED', 'RELEASED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "WorkOrderQuoteStatus" AS ENUM ('DRAFT', 'PENDING', 'PARTIALLY_APPROVED', 'APPROVED', 'REJECTED', 'SUPERSEDED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ApprovalChannel" AS ENUM ('IN_PERSON', 'WHATSAPP', 'PHONE', 'EMAIL', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentOperationalStatus" AS ENUM ('PENDING', 'PAID', 'WAIVED');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('QUOTE', 'WORK_ORDER', 'PICKUP_RECEIPT');

-- CreateEnum
CREATE TYPE "CommunicationStatus" AS ENUM ('LINK_OPENED', 'MESSAGE_REQUESTED', 'MESSAGE_SENT', 'MESSAGE_FAILED');

-- CreateEnum
CREATE TYPE "ContactChannel" AS ENUM ('PHONE', 'WHATSAPP', 'EMAIL', 'OTHER');

-- AlterTable
ALTER TABLE "bikes" ADD COLUMN     "frameSize" TEXT,
ADD COLUMN     "year" INTEGER;

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "city" TEXT,
ADD COLUMN     "communicationConsent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "complement" TEXT,
ADD COLUMN     "cpfCnpj" TEXT,
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "neighborhood" TEXT,
ADD COLUMN     "number" TEXT,
ADD COLUMN     "postalCode" TEXT,
ADD COLUMN     "preferredContactChannel" "ContactChannel",
ADD COLUMN     "state" TEXT,
ADD COLUMN     "street" TEXT;

-- AlterTable
ALTER TABLE "inventory_items" ADD COLUMN     "ean" TEXT,
ADD COLUMN     "reservedQuantity" DECIMAL(12,3) NOT NULL DEFAULT 0,
ADD COLUMN     "sku" TEXT;

-- AlterTable
ALTER TABLE "inventory_movements" ADD COLUMN     "originalMovementId" TEXT,
ADD COLUMN     "purchaseDate" DATE,
ADD COLUMN     "purchaseDocument" TEXT,
ADD COLUMN     "supplierName" TEXT,
ADD COLUMN     "unitCostCents" INTEGER;

-- AlterTable
ALTER TABLE "work_order_activities" ADD COLUMN     "actorMemberId" TEXT,
ADD COLUMN     "ipAddress" TEXT,
ADD COLUMN     "workshopId" TEXT;

-- AlterTable
ALTER TABLE "work_order_part_lines" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "discountCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "surchargeCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "work_order_service_lines" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "discountCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "performedById" TEXT,
ADD COLUMN     "surchargeCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "warrantyDaysSnapshot" INTEGER;

-- AlterTable
ALTER TABLE "work_orders" ADD COLUMN     "assignedMechanicId" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "generalDiscountCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "generalSurchargeCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "internalNotes" TEXT,
ADD COLUMN     "paymentStatus" "PaymentOperationalStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "readyAt" TIMESTAMP(3),
ADD COLUMN     "startedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "workshops" ADD COLUMN     "address" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "legalName" TEXT,
ADD COLUMN     "logoStorageKey" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "requirePaymentBeforeCompletion" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reservationPolicy" "ReservationPolicy" NOT NULL DEFAULT 'ON_QUOTE_APPROVAL',
ADD COLUMN     "taxId" TEXT,
ADD COLUMN     "terms" TEXT;

UPDATE "work_order_service_lines"
SET "totalCents" = ROUND("quantity" * "unitPriceCents");

UPDATE "work_order_part_lines"
SET "totalCents" = ROUND("quantity" * "unitPriceCents");

UPDATE "work_order_activities" AS activity
SET "workshopId" = work_order."workshopId"
FROM "work_orders" AS work_order
WHERE work_order."id" = activity."workOrderId";

-- CreateTable
CREATE TABLE "bike_ownership_transfers" (
    "id" TEXT NOT NULL,
    "bikeId" TEXT NOT NULL,
    "oldCustomerId" TEXT NOT NULL,
    "newCustomerId" TEXT NOT NULL,
    "changedById" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,

    CONSTRAINT "bike_ownership_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_reservations" (
    "id" TEXT NOT NULL,
    "workshopId" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "status" "InventoryReservationStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "releasedById" TEXT,
    "releaseReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_order_quotes" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "WorkOrderQuoteStatus" NOT NULL DEFAULT 'DRAFT',
    "validUntil" DATE,
    "subtotalCents" INTEGER NOT NULL,
    "discountCents" INTEGER NOT NULL DEFAULT 0,
    "surchargeCents" INTEGER NOT NULL DEFAULT 0,
    "totalCents" INTEGER NOT NULL,
    "serviceSnapshot" JSONB NOT NULL,
    "partSnapshot" JSONB NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_order_quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_order_quote_approvals" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "approvedByName" TEXT,
    "approvedByCustomerId" TEXT,
    "channel" "ApprovalChannel" NOT NULL,
    "decision" "WorkOrderQuoteStatus" NOT NULL,
    "evidence" TEXT,
    "notes" TEXT,
    "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedById" TEXT NOT NULL,

    CONSTRAINT "work_order_quote_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generated_documents" (
    "id" TEXT NOT NULL,
    "workshopId" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "version" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "generated_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bike_ownership_transfers_bikeId_changedAt_idx" ON "bike_ownership_transfers"("bikeId", "changedAt");

-- CreateIndex
CREATE INDEX "inventory_reservations_workshopId_status_expiresAt_idx" ON "inventory_reservations"("workshopId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "inventory_reservations_workOrderId_status_idx" ON "inventory_reservations"("workOrderId", "status");

-- CreateIndex
CREATE INDEX "inventory_reservations_inventoryItemId_status_idx" ON "inventory_reservations"("inventoryItemId", "status");

-- CreateIndex
CREATE INDEX "work_order_quotes_workOrderId_status_idx" ON "work_order_quotes"("workOrderId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "work_order_quotes_workOrderId_version_key" ON "work_order_quotes"("workOrderId", "version");

-- CreateIndex
CREATE INDEX "work_order_quote_approvals_quoteId_approvedAt_idx" ON "work_order_quote_approvals"("quoteId", "approvedAt");

-- CreateIndex
CREATE INDEX "generated_documents_workshopId_createdAt_idx" ON "generated_documents"("workshopId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "generated_documents_workOrderId_type_version_key" ON "generated_documents"("workOrderId", "type", "version");

-- CreateIndex
CREATE INDEX "customers_workshopId_email_idx" ON "customers"("workshopId", "email");

-- CreateIndex
CREATE INDEX "customers_workshopId_cpfCnpj_idx" ON "customers"("workshopId", "cpfCnpj");

-- CreateIndex
CREATE INDEX "inventory_items_workshopId_sku_idx" ON "inventory_items"("workshopId", "sku");

-- CreateIndex
CREATE INDEX "inventory_items_workshopId_ean_idx" ON "inventory_items"("workshopId", "ean");

-- CreateIndex
CREATE INDEX "inventory_movements_originalMovementId_idx" ON "inventory_movements"("originalMovementId");

-- CreateIndex
CREATE INDEX "work_orders_workshopId_assignedMechanicId_idx" ON "work_orders"("workshopId", "assignedMechanicId");

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_originalMovementId_fkey" FOREIGN KEY ("originalMovementId") REFERENCES "inventory_movements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_assignedMechanicId_fkey" FOREIGN KEY ("assignedMechanicId") REFERENCES "workshop_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_service_lines" ADD CONSTRAINT "work_order_service_lines_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "workshop_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bike_ownership_transfers" ADD CONSTRAINT "bike_ownership_transfers_bikeId_fkey" FOREIGN KEY ("bikeId") REFERENCES "bikes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_reservations" ADD CONSTRAINT "inventory_reservations_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "workshops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_reservations" ADD CONSTRAINT "inventory_reservations_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_reservations" ADD CONSTRAINT "inventory_reservations_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_quotes" ADD CONSTRAINT "work_order_quotes_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_quote_approvals" ADD CONSTRAINT "work_order_quote_approvals_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "work_order_quotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_documents" ADD CONSTRAINT "generated_documents_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "workshops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_documents" ADD CONSTRAINT "generated_documents_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
