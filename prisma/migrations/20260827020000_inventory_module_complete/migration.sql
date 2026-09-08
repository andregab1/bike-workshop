-- Expand-only inventory evolution. Existing rows remain readable.
ALTER TYPE "InventoryMovementType" ADD VALUE IF NOT EXISTS 'STOCK_RESERVATION';
ALTER TYPE "InventoryMovementType" ADD VALUE IF NOT EXISTS 'RESERVATION_RELEASE';
ALTER TYPE "InventoryMovementType" ADD VALUE IF NOT EXISTS 'ADJUSTMENT_IN';
ALTER TYPE "InventoryMovementType" ADD VALUE IF NOT EXISTS 'ADJUSTMENT_OUT';

ALTER TABLE "inventory_items"
  ADD COLUMN IF NOT EXISTS "categoryId" TEXT,
  ADD COLUMN IF NOT EXISTS "supplierName" TEXT,
  ADD COLUMN IF NOT EXISTS "notes" TEXT,
  ADD COLUMN IF NOT EXISTS "imageStorageKey" TEXT,
  ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "inventory_movements"
  ADD COLUMN IF NOT EXISTS "physicalBefore" DECIMAL(12,3),
  ADD COLUMN IF NOT EXISTS "physicalAfter" DECIMAL(12,3),
  ADD COLUMN IF NOT EXISTS "reservedBefore" DECIMAL(12,3),
  ADD COLUMN IF NOT EXISTS "reservedAfter" DECIMAL(12,3),
  ADD COLUMN IF NOT EXISTS "originDestination" TEXT;

UPDATE "inventory_items" inventory
SET "categoryId" = part."categoryId"
FROM "catalog_parts" part
WHERE inventory."catalogPartId" = part."id" AND inventory."categoryId" IS NULL;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='inventory_items_categoryId_fkey') THEN
    ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "part_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "inventory_items_workshopId_categoryId_active_idx"
  ON "inventory_items"("workshopId", "categoryId", "active");
CREATE UNIQUE INDEX IF NOT EXISTS "inventory_items_workshop_sku_unique"
  ON "inventory_items"("workshopId", lower("sku")) WHERE "sku" IS NOT NULL;

-- Older versions could create more than one active row for the same OS/item.
WITH ranked AS (
  SELECT id, "workOrderId", "inventoryItemId",
         ROW_NUMBER() OVER (PARTITION BY "workOrderId", "inventoryItemId" ORDER BY "createdAt", id) AS position,
         SUM(quantity) OVER (PARTITION BY "workOrderId", "inventoryItemId") AS total
  FROM "inventory_reservations" WHERE status = 'ACTIVE'
)
UPDATE "inventory_reservations" reservation
SET quantity = ranked.total
FROM ranked WHERE reservation.id = ranked.id AND ranked.position = 1;

WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY "workOrderId", "inventoryItemId" ORDER BY "createdAt", id) AS position
  FROM "inventory_reservations" WHERE status = 'ACTIVE'
)
UPDATE "inventory_reservations" reservation
SET status = 'RELEASED', "releaseReason" = 'Consolidação da migração', "updatedAt" = CURRENT_TIMESTAMP
FROM ranked WHERE reservation.id = ranked.id AND ranked.position > 1;

CREATE UNIQUE INDEX IF NOT EXISTS "inventory_reservations_active_order_item_unique"
  ON "inventory_reservations"("workOrderId", "inventoryItemId") WHERE "status" = 'ACTIVE';
CREATE INDEX IF NOT EXISTS "inventory_movements_workshopId_inventoryItemId_createdAt_idx"
  ON "inventory_movements"("workshopId", "inventoryItemId", "createdAt" DESC);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='inventory_version_positive') THEN
    ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_version_positive" CHECK ("version" > 0);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='inventory_movement_physical_before_nonnegative') THEN ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movement_physical_before_nonnegative" CHECK ("physicalBefore" IS NULL OR "physicalBefore" >= 0); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='inventory_movement_physical_after_nonnegative') THEN ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movement_physical_after_nonnegative" CHECK ("physicalAfter" IS NULL OR "physicalAfter" >= 0); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='inventory_movement_reserved_before_nonnegative') THEN ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movement_reserved_before_nonnegative" CHECK ("reservedBefore" IS NULL OR "reservedBefore" >= 0); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='inventory_movement_reserved_after_nonnegative') THEN ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movement_reserved_after_nonnegative" CHECK ("reservedAfter" IS NULL OR "reservedAfter" >= 0); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='inventory_movement_reserved_before_valid') THEN ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movement_reserved_before_valid" CHECK ("physicalBefore" IS NULL OR "reservedBefore" IS NULL OR "reservedBefore" <= "physicalBefore"); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='inventory_movement_reserved_after_valid') THEN ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movement_reserved_after_valid" CHECK ("physicalAfter" IS NULL OR "reservedAfter" IS NULL OR "reservedAfter" <= "physicalAfter"); END IF;
END $$;
