-- Preserve existing rows: fail with an actionable error if duplicates exist.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "inventory_items"
    WHERE "sku" IS NOT NULL
    GROUP BY "workshopId", "sku"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Duplicate inventory SKU found within one workshop. Resolve duplicates before retrying this migration.';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "inventory_items_workshopId_sku_key"
  ON "inventory_items"("workshopId", "sku");
