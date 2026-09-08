CREATE TABLE "bike_checklists" (
  "id" TEXT NOT NULL, "workshopId" TEXT NOT NULL, "customerId" TEXT NOT NULL, "bikeId" TEXT NOT NULL,
  "title" TEXT NOT NULL, "active" BOOLEAN NOT NULL DEFAULT true, "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "bike_checklists_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "bike_checklist_items" (
  "id" TEXT NOT NULL, "checklistId" TEXT NOT NULL, "label" TEXT NOT NULL, "normalizedLabel" TEXT NOT NULL,
  "checked" BOOLEAN NOT NULL DEFAULT false, "sortOrder" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "bike_checklist_items_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "checklist_item_suggestions" (
  "id" TEXT NOT NULL, "workshopId" TEXT NOT NULL, "label" TEXT NOT NULL, "normalizedLabel" TEXT NOT NULL,
  "useCount" INTEGER NOT NULL DEFAULT 1, "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "checklist_item_suggestions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "bike_checklists_workshopId_active_updatedAt_idx" ON "bike_checklists"("workshopId", "active", "updatedAt");
CREATE INDEX "bike_checklists_workshopId_bikeId_updatedAt_idx" ON "bike_checklists"("workshopId", "bikeId", "updatedAt");
CREATE UNIQUE INDEX "bike_checklist_items_checklistId_normalizedLabel_key" ON "bike_checklist_items"("checklistId", "normalizedLabel");
CREATE UNIQUE INDEX "bike_checklist_items_checklistId_sortOrder_key" ON "bike_checklist_items"("checklistId", "sortOrder");
CREATE UNIQUE INDEX "checklist_item_suggestions_workshopId_normalizedLabel_key" ON "checklist_item_suggestions"("workshopId", "normalizedLabel");
CREATE INDEX "checklist_item_suggestions_workshopId_lastUsedAt_idx" ON "checklist_item_suggestions"("workshopId", "lastUsedAt");
ALTER TABLE "bike_checklists" ADD CONSTRAINT "bike_checklists_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "workshops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bike_checklists" ADD CONSTRAINT "bike_checklists_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bike_checklists" ADD CONSTRAINT "bike_checklists_bikeId_fkey" FOREIGN KEY ("bikeId") REFERENCES "bikes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bike_checklist_items" ADD CONSTRAINT "bike_checklist_items_checklistId_fkey" FOREIGN KEY ("checklistId") REFERENCES "bike_checklists"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "checklist_item_suggestions" ADD CONSTRAINT "checklist_item_suggestions_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "workshops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
