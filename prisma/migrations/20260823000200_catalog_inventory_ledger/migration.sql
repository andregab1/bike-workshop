CREATE TYPE "InventoryUnit" AS ENUM ('UNIT', 'METER', 'MILLILITER', 'GRAM');
CREATE TYPE "InventoryMovementType" AS ENUM ('STOCK_ENTRY', 'WORK_ORDER_USE', 'WORK_ORDER_REVERSAL', 'MANUAL_ADJUSTMENT', 'MANUAL_EXIT');

CREATE TABLE "brands" ("id" TEXT NOT NULL, "name" TEXT NOT NULL, "slug" TEXT NOT NULL, "website" TEXT, "active" BOOLEAN NOT NULL DEFAULT true, CONSTRAINT "brands_pkey" PRIMARY KEY ("id"));
CREATE TABLE "part_categories" ("id" TEXT NOT NULL, "parentId" TEXT, "name" TEXT NOT NULL, "slug" TEXT NOT NULL, "specSchemaKey" TEXT, CONSTRAINT "part_categories_pkey" PRIMARY KEY ("id"));
CREATE TABLE "catalog_parts" ("id" TEXT NOT NULL, "brandId" TEXT NOT NULL, "categoryId" TEXT NOT NULL, "name" TEXT NOT NULL, "model" TEXT, "manufacturerCode" TEXT, "ean" TEXT, "description" TEXT, "aliases" TEXT[], "specifications" JSONB NOT NULL, "searchText" TEXT NOT NULL, "active" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "catalog_parts_pkey" PRIMARY KEY ("id"));
CREATE TABLE "inventory_items" ("id" TEXT NOT NULL, "workshopId" TEXT NOT NULL, "catalogPartId" TEXT, "customName" TEXT, "quantity" DECIMAL(12,3) NOT NULL DEFAULT 0, "minimumQuantity" DECIMAL(12,3) NOT NULL DEFAULT 0, "unitOfMeasure" "InventoryUnit" NOT NULL DEFAULT 'UNIT', "costPriceCents" INTEGER, "salePriceCents" INTEGER NOT NULL, "location" TEXT, "active" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id"), CONSTRAINT "inventory_item_origin_xor" CHECK (("catalogPartId" IS NOT NULL) <> ("customName" IS NOT NULL)), CONSTRAINT "inventory_quantity_nonnegative" CHECK ("quantity" >= 0), CONSTRAINT "inventory_minimum_nonnegative" CHECK ("minimumQuantity" >= 0), CONSTRAINT "inventory_sale_price_nonnegative" CHECK ("salePriceCents" >= 0), CONSTRAINT "inventory_cost_price_nonnegative" CHECK ("costPriceCents" IS NULL OR "costPriceCents" >= 0));
CREATE TABLE "inventory_movements" ("id" TEXT NOT NULL, "workshopId" TEXT NOT NULL, "inventoryItemId" TEXT NOT NULL, "type" "InventoryMovementType" NOT NULL, "quantityDelta" DECIMAL(12,3) NOT NULL, "reason" TEXT, "createdById" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id"), CONSTRAINT "inventory_movement_nonzero" CHECK ("quantityDelta" <> 0));

CREATE UNIQUE INDEX "brands_name_key" ON "brands"("name");
CREATE UNIQUE INDEX "brands_slug_key" ON "brands"("slug");
CREATE UNIQUE INDEX "part_categories_slug_key" ON "part_categories"("slug");
CREATE INDEX "part_categories_parentId_idx" ON "part_categories"("parentId");
CREATE INDEX "catalog_parts_manufacturerCode_idx" ON "catalog_parts"("manufacturerCode");
CREATE INDEX "catalog_parts_ean_idx" ON "catalog_parts"("ean");
CREATE INDEX "catalog_parts_brandId_categoryId_active_idx" ON "catalog_parts"("brandId", "categoryId", "active");
CREATE UNIQUE INDEX "inventory_items_workshop_catalog_unique" ON "inventory_items"("workshopId", "catalogPartId") WHERE "catalogPartId" IS NOT NULL;
CREATE INDEX "inventory_items_workshopId_active_customName_idx" ON "inventory_items"("workshopId", "active", "customName");
CREATE INDEX "inventory_items_workshopId_location_active_idx" ON "inventory_items"("workshopId", "location", "active");
CREATE INDEX "inventory_movements_workshopId_createdAt_idx" ON "inventory_movements"("workshopId", "createdAt");
CREATE INDEX "inventory_movements_inventoryItemId_createdAt_idx" ON "inventory_movements"("inventoryItemId", "createdAt");

ALTER TABLE "part_categories" ADD CONSTRAINT "part_categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "part_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "catalog_parts" ADD CONSTRAINT "catalog_parts_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "catalog_parts" ADD CONSTRAINT "catalog_parts_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "part_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "workshops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_catalogPartId_fkey" FOREIGN KEY ("catalogPartId") REFERENCES "catalog_parts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "workshops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
