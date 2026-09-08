CREATE TYPE "WorkshopRole" AS ENUM ('OWNER', 'MECHANIC');
CREATE TYPE "BikeType" AS ENUM ('MTB', 'ROAD', 'GRAVEL', 'BMX', 'URBAN', 'E_BIKE', 'OTHER');

CREATE TABLE "workshops" (
  "id" TEXT NOT NULL,
  "authOrganizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "workshops_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "customers" (
  "id" TEXT NOT NULL,
  "workshopId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "email" TEXT,
  "notes" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "bikes" (
  "id" TEXT NOT NULL,
  "workshopId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "brand" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "type" "BikeType",
  "wheelSize" TEXT,
  "color" TEXT,
  "serialNumber" TEXT,
  "notes" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "bikes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "workshops_authOrganizationId_key" ON "workshops"("authOrganizationId");
CREATE UNIQUE INDEX "workshops_slug_key" ON "workshops"("slug");
CREATE INDEX "customers_workshopId_active_name_idx" ON "customers"("workshopId", "active", "name");
CREATE INDEX "customers_workshopId_phone_idx" ON "customers"("workshopId", "phone");
CREATE INDEX "bikes_workshopId_active_brand_model_idx" ON "bikes"("workshopId", "active", "brand", "model");
CREATE INDEX "bikes_workshopId_customerId_active_idx" ON "bikes"("workshopId", "customerId", "active");
CREATE INDEX "bikes_workshopId_serialNumber_idx" ON "bikes"("workshopId", "serialNumber");

ALTER TABLE "customers" ADD CONSTRAINT "customers_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "workshops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bikes" ADD CONSTRAINT "bikes_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "workshops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bikes" ADD CONSTRAINT "bikes_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
