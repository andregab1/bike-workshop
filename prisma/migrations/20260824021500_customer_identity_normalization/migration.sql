ALTER TABLE "customers"
ADD COLUMN "normalizedPhone" TEXT,
ADD COLUMN "normalizedEmail" TEXT,
ADD COLUMN "normalizedCpfCnpj" TEXT;

UPDATE "customers"
SET
  "normalizedPhone" = regexp_replace("phone", '[^0-9]', '', 'g'),
  "normalizedEmail" = NULLIF(lower(trim("email")), ''),
  "normalizedCpfCnpj" = NULLIF(regexp_replace(COALESCE("cpfCnpj", ''), '[^0-9]', '', 'g'), '');

ALTER TABLE "customers" ALTER COLUMN "normalizedPhone" SET NOT NULL;

CREATE INDEX "customers_workshopId_normalizedPhone_idx"
ON "customers"("workshopId", "normalizedPhone");

CREATE INDEX "customers_workshopId_normalizedEmail_idx"
ON "customers"("workshopId", "normalizedEmail");

CREATE INDEX "customers_workshopId_normalizedCpfCnpj_idx"
ON "customers"("workshopId", "normalizedCpfCnpj");
