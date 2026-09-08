-- Expand-only migration. Legacy work orders and checklistSnapshot remain readable.
CREATE TYPE "WorkOrderPriority" AS ENUM ('NORMAL', 'URGENT', 'WARRANTY_RETURN');
CREATE TYPE "WorkOrderLineStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
CREATE TYPE "WorkOrderChecklistType" AS ENUM ('ENTRY', 'TECHNICAL', 'DELIVERY');
CREATE TYPE "WorkOrderChecklistResult" AS ENUM ('PENDING', 'OK', 'ATTENTION', 'REJECTED', 'NOT_APPLICABLE');
CREATE TYPE "WorkOrderAttachmentType" AS ENUM ('ENTRY', 'DIAGNOSIS', 'SERVICE', 'DAMAGE', 'DELIVERY', 'GENERAL');
CREATE TYPE "WorkSessionStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED');
CREATE TYPE "WorkOrderQuoteKind" AS ENUM ('BASE', 'ADDITIONAL');

ALTER TYPE "WorkOrderActivityType" ADD VALUE IF NOT EXISTS 'DIAGNOSIS_STARTED';
ALTER TYPE "WorkOrderActivityType" ADD VALUE IF NOT EXISTS 'SERVICE_STATUS_CHANGED';
ALTER TYPE "WorkOrderActivityType" ADD VALUE IF NOT EXISTS 'PART_STATUS_CHANGED';
ALTER TYPE "WorkOrderActivityType" ADD VALUE IF NOT EXISTS 'CHECKLIST_APPLIED';
ALTER TYPE "WorkOrderActivityType" ADD VALUE IF NOT EXISTS 'EXECUTION_PAUSED';
ALTER TYPE "WorkOrderActivityType" ADD VALUE IF NOT EXISTS 'EXECUTION_RESUMED';
ALTER TYPE "WorkOrderActivityType" ADD VALUE IF NOT EXISTS 'STOCK_RESERVED';
ALTER TYPE "WorkOrderActivityType" ADD VALUE IF NOT EXISTS 'STOCK_RELEASED';
ALTER TYPE "WorkOrderActivityType" ADD VALUE IF NOT EXISTS 'QUOTE_CREATED';
ALTER TYPE "WorkOrderActivityType" ADD VALUE IF NOT EXISTS 'QUOTE_SENT';
ALTER TYPE "WorkOrderActivityType" ADD VALUE IF NOT EXISTS 'QUOTE_PARTIALLY_APPROVED';
ALTER TYPE "WorkOrderActivityType" ADD VALUE IF NOT EXISTS 'PAYMENT_RECORDED';
ALTER TYPE "WorkOrderActivityType" ADD VALUE IF NOT EXISTS 'DELIVERED';
ALTER TYPE "QuoteApprovalStatus" ADD VALUE IF NOT EXISTS 'PARTIALLY_APPROVED';

ALTER TABLE "work_orders"
  ADD COLUMN "priority" "WorkOrderPriority" NOT NULL DEFAULT 'NORMAL',
  ADD COLUMN "technicalRecommendations" TEXT,
  ADD COLUMN "technicalNotes" TEXT,
  ADD COLUMN "diagnosisStartedAt" TIMESTAMP(3),
  ADD COLUMN "approvalRequestedAt" TIMESTAMP(3),
  ADD COLUMN "executionPausedAt" TIMESTAMP(3),
  ADD COLUMN "paidAmountCents" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "work_order_service_lines"
  ADD COLUMN "status" "WorkOrderLineStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "completedAt" TIMESTAMP(3);

ALTER TABLE "work_order_part_lines"
  ADD COLUMN "status" "WorkOrderLineStatus" NOT NULL DEFAULT 'PENDING';

ALTER TABLE "work_order_quotes"
  ADD COLUMN "kind" "WorkOrderQuoteKind" NOT NULL DEFAULT 'BASE',
  ADD COLUMN "additionalNumber" INTEGER,
  ADD COLUMN "sourceWorkOrderVersion" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "sentAt" TIMESTAMP(3),
  ADD COLUMN "respondedAt" TIMESTAMP(3);

ALTER TABLE "work_order_quote_approvals"
  ADD COLUMN "approvedServiceLineIds" JSONB,
  ADD COLUMN "approvedPartLineIds" JSONB;

UPDATE "work_orders"
SET "diagnosisStartedAt" = "createdAt"
WHERE "diagnosis" <> '' AND "diagnosisStartedAt" IS NULL;

UPDATE "work_orders"
SET "approvalRequestedAt" = COALESCE("approvalDecidedAt", "createdAt")
WHERE "approvalStatus" <> 'PENDING' AND "approvalRequestedAt" IS NULL;

UPDATE "work_order_service_lines" AS line
SET "status" = CASE
  WHEN work_order."status" IN ('READY', 'COMPLETED') THEN 'COMPLETED'::"WorkOrderLineStatus"
  WHEN work_order."approvalStatus" = 'APPROVED' THEN 'APPROVED'::"WorkOrderLineStatus"
  WHEN work_order."approvalStatus" = 'REJECTED' THEN 'REJECTED'::"WorkOrderLineStatus"
  ELSE 'PENDING'::"WorkOrderLineStatus"
END,
"completedAt" = CASE WHEN work_order."status" IN ('READY', 'COMPLETED') THEN COALESCE(work_order."readyAt", work_order."updatedAt") ELSE NULL END
FROM "work_orders" AS work_order
WHERE line."workOrderId" = work_order."id";

UPDATE "work_order_part_lines" AS line
SET "status" = CASE
  WHEN work_order."status" IN ('READY', 'COMPLETED') THEN 'COMPLETED'::"WorkOrderLineStatus"
  WHEN work_order."approvalStatus" = 'APPROVED' THEN 'APPROVED'::"WorkOrderLineStatus"
  WHEN work_order."approvalStatus" = 'REJECTED' THEN 'REJECTED'::"WorkOrderLineStatus"
  ELSE 'PENDING'::"WorkOrderLineStatus"
END
FROM "work_orders" AS work_order
WHERE line."workOrderId" = work_order."id";

CREATE TABLE "work_order_checklists" (
  "id" TEXT NOT NULL,
  "workOrderId" TEXT NOT NULL,
  "type" "WorkOrderChecklistType" NOT NULL,
  "title" TEXT NOT NULL,
  "required" BOOLEAN NOT NULL DEFAULT false,
  "templateId" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "work_order_checklists_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "work_order_checklists_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "work_order_checklist_items" (
  "id" TEXT NOT NULL,
  "checklistId" TEXT NOT NULL,
  "labelSnapshot" TEXT NOT NULL,
  "required" BOOLEAN NOT NULL DEFAULT false,
  "result" "WorkOrderChecklistResult" NOT NULL DEFAULT 'PENDING',
  "notes" TEXT,
  "verifiedById" TEXT,
  "verifiedAt" TIMESTAMP(3),
  "sortOrder" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "work_order_checklist_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "work_order_checklist_items_checklistId_fkey" FOREIGN KEY ("checklistId") REFERENCES "work_order_checklists"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "work_order_checklist_items_sortOrder_check" CHECK ("sortOrder" >= 0)
);

CREATE TABLE "work_order_attachments" (
  "id" TEXT NOT NULL,
  "workOrderId" TEXT NOT NULL,
  "type" "WorkOrderAttachmentType" NOT NULL DEFAULT 'GENERAL',
  "storageKey" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "description" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "work_order_attachments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "work_order_attachments_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "work_order_attachments_sizeBytes_check" CHECK ("sizeBytes" >= 0)
);

CREATE TABLE "work_order_work_sessions" (
  "id" TEXT NOT NULL,
  "workOrderId" TEXT NOT NULL,
  "serviceLineId" TEXT,
  "mechanicMemberId" TEXT NOT NULL,
  "status" "WorkSessionStatus" NOT NULL DEFAULT 'ACTIVE',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3),
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "work_order_work_sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "work_order_work_sessions_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_paidAmountCents_check" CHECK ("paidAmountCents" >= 0);

CREATE INDEX "work_orders_workshopId_priority_status_idx" ON "work_orders"("workshopId", "priority", "status");
CREATE INDEX "work_order_checklists_workOrderId_type_idx" ON "work_order_checklists"("workOrderId", "type");
CREATE UNIQUE INDEX "work_order_checklist_items_checklistId_sortOrder_key" ON "work_order_checklist_items"("checklistId", "sortOrder");
CREATE INDEX "work_order_checklist_items_checklistId_result_idx" ON "work_order_checklist_items"("checklistId", "result");
CREATE INDEX "work_order_attachments_workOrderId_type_createdAt_idx" ON "work_order_attachments"("workOrderId", "type", "createdAt");
CREATE INDEX "work_order_work_sessions_workOrderId_status_startedAt_idx" ON "work_order_work_sessions"("workOrderId", "status", "startedAt");
CREATE INDEX "work_order_work_sessions_mechanicMemberId_status_idx" ON "work_order_work_sessions"("mechanicMemberId", "status");
