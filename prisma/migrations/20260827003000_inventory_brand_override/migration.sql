-- Brand belongs to the workshop stock item, independently from the generic
-- catalog entry. Existing records keep their previous catalog brand.
ALTER TABLE "inventory_items" ADD COLUMN "brandId" TEXT;

UPDATE "inventory_items" AS inventory
SET "brandId" = part."brandId"
FROM "catalog_parts" AS part
WHERE inventory."catalogPartId" = part."id";

ALTER TABLE "inventory_items"
ADD CONSTRAINT "inventory_items_brandId_fkey"
FOREIGN KEY ("brandId") REFERENCES "brands"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "inventory_items_workshopId_brandId_active_idx"
ON "inventory_items"("workshopId", "brandId", "active");
