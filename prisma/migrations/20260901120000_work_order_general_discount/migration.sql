CREATE TYPE "WorkOrderDiscountType" AS ENUM ('FIXED', 'PERCENT');

ALTER TABLE "work_orders"
  ADD COLUMN "generalDiscountType" "WorkOrderDiscountType" NOT NULL DEFAULT 'FIXED',
  ADD COLUMN "generalDiscountValue" DECIMAL(12,4) NOT NULL DEFAULT 0;

UPDATE "work_orders"
SET "generalDiscountValue" = "generalDiscountCents" / 100.0
WHERE "generalDiscountCents" > 0;
