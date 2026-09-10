-- Seed and repair counters once before runtime stops consulting work orders.
INSERT INTO "work_order_counters" ("workshopId", "nextNumber")
SELECT
  "workshopId",
  GREATEST(COALESCE(MAX("number") + 1, 1001), 1001)
FROM "work_orders"
GROUP BY "workshopId"
ON CONFLICT ("workshopId") DO UPDATE
SET "nextNumber" = GREATEST(
  "work_order_counters"."nextNumber",
  EXCLUDED."nextNumber"
);
