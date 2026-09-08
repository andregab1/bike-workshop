CREATE TABLE "service_catalog_items" (
  "id" TEXT NOT NULL,
  "workshopId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "priceCents" INTEGER NOT NULL,
  "category" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "service_catalog_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "service_catalog_items_price_nonnegative" CHECK ("priceCents" >= 0)
);

CREATE TABLE "checklist_templates" (
  "id" TEXT NOT NULL,
  "workshopId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "checklist_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "checklist_template_items" (
  "id" TEXT NOT NULL,
  "templateId" TEXT NOT NULL,
  "section" TEXT,
  "label" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL,
  CONSTRAINT "checklist_template_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "service_catalog_items_workshopId_active_name_idx" ON "service_catalog_items"("workshopId", "active", "name");
CREATE INDEX "service_catalog_items_workshopId_category_active_idx" ON "service_catalog_items"("workshopId", "category", "active");
CREATE INDEX "checklist_templates_workshopId_active_name_idx" ON "checklist_templates"("workshopId", "active", "name");
CREATE UNIQUE INDEX "checklist_template_items_templateId_sortOrder_key" ON "checklist_template_items"("templateId", "sortOrder");
CREATE INDEX "checklist_template_items_templateId_idx" ON "checklist_template_items"("templateId");

ALTER TABLE "service_catalog_items" ADD CONSTRAINT "service_catalog_items_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "workshops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "checklist_templates" ADD CONSTRAINT "checklist_templates_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "workshops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "checklist_template_items" ADD CONSTRAINT "checklist_template_items_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "checklist_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
