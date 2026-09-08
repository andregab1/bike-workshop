-- Catalog names describe the kind of part. Brand and model remain structured,
-- searchable fields so the same part type can be offered by multiple brands.
UPDATE "catalog_parts"
SET "name" = CASE "id"
  WHEN 'part-kmc-x10' THEN 'Corrente 10 velocidades'
  WHEN 'part-shimano-hg54' THEN 'Corrente 10 velocidades'
  WHEN 'part-shimano-hg40' THEN 'Corrente 6/7/8 velocidades'
  WHEN 'part-shimano-hg200' THEN 'Cassete 9 velocidades'
  WHEN 'part-shimano-b05s' THEN 'Pastilha de freio a disco'
  WHEN 'part-shimano-rt66' THEN 'Disco de freio 180 mm'
  WHEN 'part-tektro-p20' THEN 'Pastilha de freio a disco'
  WHEN 'part-maxxis-ikon' THEN 'Pneu MTB 29 x 2.20'
  WHEN 'part-pirelli-scorpion' THEN 'Pneu MTB 29 x 2.20'
  WHEN 'part-vzan-aero' THEN 'Aro 26'
  WHEN 'part-shimano-bb52' THEN 'Movimento central Hollowtech'
  WHEN 'part-rockshox-seal' THEN 'Kit de retentores 32 mm'
  WHEN 'part-suntour-seal' THEN 'Kit de manutenção de suspensão'
  WHEN 'part-absolute-grip' THEN 'Manopla MTB'
  WHEN 'part-absolute-saddle' THEN 'Selim MTB'
  WHEN 'part-absolute-pedal' THEN 'Pedal plataforma'
  WHEN 'part-kmc-link' THEN 'Elo rápido 10 velocidades'
  WHEN 'part-shimano-m310' THEN 'Câmbio traseiro MTB'
  WHEN 'part-shimano-ef500' THEN 'Alavanca de câmbio e freio 3x7'
  ELSE "name"
END,
"updatedAt" = CURRENT_TIMESTAMP
WHERE "id" IN (
  'part-kmc-x10', 'part-shimano-hg54', 'part-shimano-hg40',
  'part-shimano-hg200', 'part-shimano-b05s', 'part-shimano-rt66',
  'part-tektro-p20', 'part-maxxis-ikon', 'part-pirelli-scorpion',
  'part-vzan-aero', 'part-shimano-bb52', 'part-rockshox-seal',
  'part-suntour-seal', 'part-absolute-grip', 'part-absolute-saddle',
  'part-absolute-pedal', 'part-kmc-link', 'part-shimano-m310',
  'part-shimano-ef500'
);
