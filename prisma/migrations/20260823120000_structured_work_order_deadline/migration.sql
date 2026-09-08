ALTER TABLE "work_orders"
ADD COLUMN "expectedDate" DATE,
ADD COLUMN "expectedNote" TEXT;

UPDATE "work_orders"
SET "expectedDate" = "expectedText"::date
WHERE "expectedText" ~ '^\d{4}-\d{2}-\d{2}$'
  AND to_char(to_date("expectedText", 'YYYY-MM-DD'), 'YYYY-MM-DD') = "expectedText";

UPDATE "work_orders"
SET "expectedNote" = "expectedText"
WHERE "expectedText" IS NOT NULL
  AND "expectedDate" IS NULL;

ALTER TABLE "work_orders" DROP COLUMN "expectedText";

CREATE INDEX "work_orders_workshopId_expectedDate_idx"
ON "work_orders"("workshopId", "expectedDate");
