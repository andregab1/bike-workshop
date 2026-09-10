-- Expand first so older application versions can keep writing during rollout.
ALTER TABLE "work_orders"
  ADD COLUMN IF NOT EXISTS "customerSnapshotData" JSONB,
  ADD COLUMN IF NOT EXISTS "bikeSnapshotData" JSONB;

-- Existing foreign keys make this backfill deterministic and lossless.
UPDATE "work_orders" AS work_order
SET
  "customerSnapshotData" = COALESCE(
    work_order."customerSnapshotData",
    jsonb_build_object(
      'name', customer."name",
      'phone', customer."phone",
      'email', customer."email",
      'cpfCnpj', customer."cpfCnpj"
    )
  ),
  "bikeSnapshotData" = COALESCE(
    work_order."bikeSnapshotData",
    jsonb_build_object(
      'brand', bike."brand",
      'model', bike."model",
      'year', bike."year",
      'type', bike."type",
      'wheelSize', bike."wheelSize",
      'frameSize', bike."frameSize",
      'color', bike."color",
      'serialNumber', bike."serialNumber",
      'notes', bike."notes"
    )
  )
FROM "bikes" AS bike, "customers" AS customer
WHERE bike."id" = work_order."bikeId"
  AND customer."id" = work_order."customerSnapshotId"
  AND (
    work_order."customerSnapshotData" IS NULL
    OR work_order."bikeSnapshotData" IS NULL
  );
