-- Bibliotecas iniciais idempotentes. IDs estáveis permitem reaplicar a migração sem duplicação.
INSERT INTO "brands" ("id", "name", "slug", "active") VALUES
('brand-shimano','Shimano','shimano',true),('brand-sram','SRAM','sram',true),('brand-kmc','KMC','kmc',true),
('brand-campagnolo','Campagnolo','campagnolo',true),('brand-microshift','microSHIFT','microshift',true),('brand-sunrace','SunRace','sunrace',true),
('brand-pirelli','Pirelli','pirelli',true),('brand-maxxis','Maxxis','maxxis',true),('brand-continental','Continental','continental',true),
('brand-schwalbe','Schwalbe','schwalbe',true),('brand-vittoria','Vittoria','vittoria',true),('brand-kenda','Kenda','kenda',true),('brand-cst','CST','cst',true),
('brand-rockshox','RockShox','rockshox',true),('brand-fox','FOX','fox',true),('brand-srsuntour','SR Suntour','sr-suntour',true),('brand-proshock','ProShock','proshock',true),
('brand-magura','Magura','magura',true),('brand-tektro','Tektro','tektro',true),('brand-trp','TRP','trp',true),('brand-jagwire','Jagwire','jagwire',true),
('brand-absolute','Absolute','absolute',true),('brand-vzan','VZAN','vzan',true),('brand-mavic','Mavic','mavic',true),('brand-zipp','Zipp','zipp',true),
('brand-caloi','Caloi','caloi',true),('brand-sense','Sense','sense',true),('brand-oggi','Oggi','oggi',true),('brand-soul','Soul Cycles','soul-cycles',true),
('brand-specialized','Specialized','specialized',true),('brand-trek','Trek','trek',true),('brand-cannondale','Cannondale','cannondale',true),('brand-scott','Scott','scott',true),('brand-giant','Giant','giant',true)
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "part_categories" ("id", "name", "slug") VALUES
('cat-transmissao','Transmissão','transmissao'),('cat-freios','Freios','freios'),('cat-rodas-pneus','Rodas e pneus','rodas-e-pneus'),
('cat-cockpit','Cockpit e direção','cockpit-e-direcao'),('cat-suspensao','Suspensão','suspensao'),('cat-rolamentos','Rolamentos','rolamentos'),
('cat-selim','Selim e canote','selim-e-canote'),('cat-pedais','Pedais','pedais'),('cat-ebike','E-bike','e-bike'),
('cat-consumiveis','Consumíveis','consumiveis'),('cat-bicicletas','Quadros e bicicletas','quadros-e-bicicletas'),('cat-acessorios','Acessórios','acessorios')
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "catalog_parts" ("id","brandId","categoryId","name","model","aliases","specifications","searchText","active","updatedAt") VALUES
('part-kmc-x10','brand-kmc','cat-transmissao','Corrente KMC X10','X10',ARRAY['corrente 10v'], '{}'::jsonb,'KMC X10 corrente transmissão 10 velocidades',true,CURRENT_TIMESTAMP),
('part-shimano-hg54','brand-shimano','cat-transmissao','Corrente Shimano CN-HG54','CN-HG54',ARRAY['corrente 10v'], '{}'::jsonb,'Shimano CN-HG54 corrente transmissão 10 velocidades',true,CURRENT_TIMESTAMP),
('part-shimano-hg40','brand-shimano','cat-transmissao','Corrente Shimano CN-HG40','CN-HG40',ARRAY['corrente 8v'], '{}'::jsonb,'Shimano CN-HG40 corrente transmissão 6 7 8 velocidades',true,CURRENT_TIMESTAMP),
('part-sunrace-mfm300','brand-sunrace','cat-transmissao','Catraca SunRace 7v','MFM300',ARRAY['roda livre 7v'], '{}'::jsonb,'SunRace MFM300 catraca transmissão 7 velocidades',true,CURRENT_TIMESTAMP),
('part-shimano-hg200','brand-shimano','cat-transmissao','Cassete Shimano CS-HG200 9v','CS-HG200',ARRAY['cassete 9v'], '{}'::jsonb,'Shimano CS-HG200 cassete transmissão 9 velocidades',true,CURRENT_TIMESTAMP),
('part-shimano-b05s','brand-shimano','cat-freios','Pastilha de freio Shimano B05S-RX','B05S-RX',ARRAY['pastilha resina'], '{}'::jsonb,'Shimano B05S RX pastilha freio disco resina',true,CURRENT_TIMESTAMP),
('part-shimano-rt66','brand-shimano','cat-freios','Disco Shimano SM-RT66 180 mm','SM-RT66',ARRAY['rotor 180'], '{}'::jsonb,'Shimano SM-RT66 disco rotor freio 180mm',true,CURRENT_TIMESTAMP),
('part-tektro-p20','brand-tektro','cat-freios','Pastilha Tektro P20.11','P20.11',ARRAY['pastilha freio'], '{}'::jsonb,'Tektro P20.11 pastilha freio disco',true,CURRENT_TIMESTAMP),
('part-jagwire-cambio','brand-jagwire','cat-transmissao','Kit de cabo e conduíte de câmbio','Universal',ARRAY['cabo cambio'], '{}'::jsonb,'Jagwire kit cabo conduíte câmbio transmissão',true,CURRENT_TIMESTAMP),
('part-jagwire-freio','brand-jagwire','cat-freios','Kit de cabo e conduíte de freio','Universal',ARRAY['cabo freio'], '{}'::jsonb,'Jagwire kit cabo conduíte freio',true,CURRENT_TIMESTAMP),
('part-kenda-tube29','brand-kenda','cat-rodas-pneus','Câmara de ar 29 x 1.95–2.35','29',ARRAY['camara 29'], '{}'::jsonb,'Kenda câmara ar pneu roda 29 presta schrader',true,CURRENT_TIMESTAMP),
('part-cst-tube26','brand-cst','cat-rodas-pneus','Câmara de ar 26 x 1.75–2.125','26',ARRAY['camara 26'], '{}'::jsonb,'CST câmara ar pneu roda 26',true,CURRENT_TIMESTAMP),
('part-maxxis-ikon','brand-maxxis','cat-rodas-pneus','Pneu Maxxis Ikon 29 x 2.20','Ikon',ARRAY['pneu mtb 29'], '{}'::jsonb,'Maxxis Ikon pneu MTB 29 2.20 tubeless',true,CURRENT_TIMESTAMP),
('part-pirelli-scorpion','brand-pirelli','cat-rodas-pneus','Pneu Pirelli Scorpion 29 x 2.20','Scorpion',ARRAY['pneu mtb 29'], '{}'::jsonb,'Pirelli Scorpion pneu MTB 29 2.20',true,CURRENT_TIMESTAMP),
('part-vzan-aero','brand-vzan','cat-rodas-pneus','Aro VZAN Aero 26','Aero',ARRAY['aro 26'], '{}'::jsonb,'VZAN Aero aro roda 26',true,CURRENT_TIMESTAMP),
('part-shimano-bb52','brand-shimano','cat-rolamentos','Movimento central Shimano BB-MT501','BB-MT501',ARRAY['central hollowtech'], '{}'::jsonb,'Shimano movimento central rolamento hollowtech',true,CURRENT_TIMESTAMP),
('part-rockshox-seal','brand-rockshox','cat-suspensao','Kit de retentores RockShox 32 mm','32 mm',ARRAY['retentor suspensão'], '{}'::jsonb,'RockShox kit retentores suspensão 32mm',true,CURRENT_TIMESTAMP),
('part-suntour-seal','brand-srsuntour','cat-suspensao','Kit de manutenção SR Suntour','Universal',ARRAY['retentor suspensão'], '{}'::jsonb,'SR Suntour kit manutenção suspensão',true,CURRENT_TIMESTAMP),
('part-absolute-grip','brand-absolute','cat-cockpit','Manopla Absolute MTB','MTB',ARRAY['grip'], '{}'::jsonb,'Absolute manopla grip cockpit guidão MTB',true,CURRENT_TIMESTAMP),
('part-absolute-saddle','brand-absolute','cat-selim','Selim Absolute MTB','MTB',ARRAY['banco'], '{}'::jsonb,'Absolute selim banco MTB',true,CURRENT_TIMESTAMP),
('part-absolute-pedal','brand-absolute','cat-pedais','Pedal plataforma Absolute','Plataforma',ARRAY['pedal flat'], '{}'::jsonb,'Absolute pedal plataforma flat',true,CURRENT_TIMESTAMP),
('part-shimano-mineral','brand-shimano','cat-consumiveis','Óleo mineral para freio hidráulico','Mineral',ARRAY['fluido freio'], '{}'::jsonb,'Shimano óleo mineral fluido freio hidráulico',true,CURRENT_TIMESTAMP),
('part-sram-dot','brand-sram','cat-consumiveis','Fluido de freio DOT 5.1','DOT 5.1',ARRAY['fluido freio'], '{}'::jsonb,'SRAM fluido freio hidráulico DOT 5.1',true,CURRENT_TIMESTAMP),
('part-kmc-link','brand-kmc','cat-transmissao','Elo rápido KMC 10v','MissingLink 10',ARRAY['power link'], '{}'::jsonb,'KMC elo rápido corrente 10 velocidades missinglink',true,CURRENT_TIMESTAMP),
('part-shimano-m310','brand-shimano','cat-transmissao','Câmbio traseiro Shimano Altus','RD-M310',ARRAY['cambio traseiro'], '{}'::jsonb,'Shimano Altus RD-M310 câmbio traseiro transmissão',true,CURRENT_TIMESTAMP),
('part-shimano-ef500','brand-shimano','cat-transmissao','Alavanca Shimano Tourney 3x7','ST-EF500',ARRAY['passador trocador'], '{}'::jsonb,'Shimano Tourney alavanca passador trocador 3x7',true,CURRENT_TIMESTAMP),
('part-caloi-urbam','brand-caloi','cat-bicicletas','Bicicleta urbana Caloi','Urbana',ARRAY['bike completa'], '{}'::jsonb,'Caloi bicicleta bike completa urbana',true,CURRENT_TIMESTAMP),
('part-sense-mtb','brand-sense','cat-bicicletas','Bicicleta MTB Sense','MTB',ARRAY['bike completa'], '{}'::jsonb,'Sense bicicleta bike completa MTB',true,CURRENT_TIMESTAMP),
('part-oggi-mtb','brand-oggi','cat-bicicletas','Bicicleta MTB Oggi','MTB',ARRAY['bike completa'], '{}'::jsonb,'Oggi bicicleta bike completa MTB',true,CURRENT_TIMESTAMP),
('part-specialized-road','brand-specialized','cat-bicicletas','Bicicleta de estrada Specialized','Road',ARRAY['bike completa speed'], '{}'::jsonb,'Specialized bicicleta bike completa road speed',true,CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

WITH library("name","category","price") AS (VALUES
('Diagnóstico geral','Diagnóstico',5000),('Revisão básica','Revisão',12000),('Revisão completa','Revisão',25000),
('Limpeza e lubrificação da transmissão','Limpeza',7000),('Limpeza completa da bicicleta','Limpeza',10000),
('Regulagem de câmbio traseiro','Transmissão',5000),('Regulagem de câmbio dianteiro','Transmissão',4000),('Troca de corrente','Transmissão',3500),
('Troca de cassete','Transmissão',4500),('Troca de catraca','Transmissão',4500),('Troca de cabos e conduítes de câmbio','Transmissão',7000),
('Regulagem de freio V-Brake','Freios',4000),('Regulagem de freio a disco mecânico','Freios',5000),('Sangria de freio hidráulico (por freio)','Freios',8000),
('Troca de pastilhas de freio','Freios',3500),('Troca de sapatas de freio','Freios',3000),('Troca de cabos e conduítes de freio','Freios',6000),
('Troca de câmara de ar','Rodas e pneus',3000),('Troca de pneu','Rodas e pneus',3500),('Montagem tubeless (por roda)','Rodas e pneus',7000),
('Reparo de furo em pneu tubeless','Rodas e pneus',5000),('Alinhamento de roda','Rodas e pneus',7000),('Troca de raio e alinhamento','Rodas e pneus',9000),
('Revisão de cubo (por roda)','Rodas e pneus',8000),('Revisão de movimento central','Rolamentos',9000),('Revisão de caixa de direção','Cockpit e direção',7000),
('Troca ou instalação de pedivela','Transmissão',6000),('Instalação de componentes e acessórios','Montagem',4000),
('Montagem de bicicleta completa','Montagem',25000),('Revisão básica de suspensão','Suspensão',15000)
)
INSERT INTO "service_catalog_items" ("id","workshopId","name","category","priceCents","active","updatedAt")
SELECT 'starter-service-' || md5(w."id" || l."name"), w."id", l."name", l."category", l."price", true, CURRENT_TIMESTAMP
FROM "workshops" w CROSS JOIN library l
WHERE NOT EXISTS (SELECT 1 FROM "service_catalog_items" s WHERE s."workshopId"=w."id" AND lower(trim(s."name"))=lower(trim(l."name")));
