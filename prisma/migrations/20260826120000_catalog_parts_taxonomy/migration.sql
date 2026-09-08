-- Bicicletas completas não pertencem ao catálogo de peças. Arquivar preserva referências existentes.
UPDATE "catalog_parts"
SET "active" = false, "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" IN ('part-caloi-urbam', 'part-sense-mtb', 'part-oggi-mtb', 'part-specialized-road')
   OR "categoryId" = 'cat-bicicletas';

-- O nome representa o tipo da peça; marca e modelo permanecem em campos próprios.
UPDATE "catalog_parts"
SET "name" = 'Catraca 7 velocidades',
    "searchText" = 'catraca roda livre 7 velocidades transmissão SunRace MFM300',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'part-sunrace-mfm300';

INSERT INTO "catalog_parts" (
  "id", "brandId", "categoryId", "name", "model", "manufacturerCode", "aliases",
  "specifications", "searchText", "active", "updatedAt"
) VALUES
('part-shimano-mf-tz500-7', 'brand-shimano', 'cat-transmissao', 'Catraca 7 velocidades', 'MF-TZ500-7', 'MF-TZ500-7', ARRAY['roda livre 7v'], '{"speeds":7}'::jsonb, 'catraca roda livre 7 velocidades transmissão Shimano MF-TZ500', true, CURRENT_TIMESTAMP),
('part-absolute-catraca-7', 'brand-absolute', 'cat-transmissao', 'Catraca 7 velocidades', '7v', NULL, ARRAY['roda livre 7v'], '{"speeds":7}'::jsonb, 'catraca roda livre 7 velocidades transmissão Absolute', true, CURRENT_TIMESTAMP),
('part-sunrace-catraca-6', 'brand-sunrace', 'cat-transmissao', 'Catraca 6 velocidades', 'MFM2A', 'MFM2A', ARRAY['roda livre 6v'], '{"speeds":6}'::jsonb, 'catraca roda livre 6 velocidades transmissão SunRace MFM2A', true, CURRENT_TIMESTAMP),
('part-sunrace-catraca-8', 'brand-sunrace', 'cat-transmissao', 'Catraca 8 velocidades', 'MFM56', 'MFM56', ARRAY['roda livre 8v'], '{"speeds":8}'::jsonb, 'catraca roda livre 8 velocidades transmissão SunRace MFM56', true, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name", "model" = EXCLUDED."model", "manufacturerCode" = EXCLUDED."manufacturerCode",
  "aliases" = EXCLUDED."aliases", "specifications" = EXCLUDED."specifications",
  "searchText" = EXCLUDED."searchText", "active" = true, "updatedAt" = CURRENT_TIMESTAMP;
