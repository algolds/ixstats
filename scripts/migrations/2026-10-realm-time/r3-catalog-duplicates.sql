-- Realm time, R3: the equipment catalog listed five items twice (the base data and the extended data both carried
-- them under different keys: "Eurofighter Typhoon", "THAAD", "Iron Dome", "BGM-109 Tomahawk", "Aegis Combat System").
-- The seed now keeps the first of each name (buildEquipmentCatalogSeed); this merges a seeded catalog the same way:
-- orders and assets on a retired key move to the kept key, the kept row takes the retired row's usage count, and the
-- retired row is deleted. A pair whose kept row is missing is left alone. Needs D2a (ProcurementOrder,
-- MilitaryAsset.catalogKey). Idempotent: a re-run finds no retired key and changes nothing.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/migrations/2026-10-realm-time/r3-catalog-duplicates.sql

BEGIN;

CREATE TEMP TABLE catalog_duplicates (retired TEXT PRIMARY KEY, kept TEXT NOT NULL) ON COMMIT DROP;
INSERT INTO catalog_duplicates (retired, kept) VALUES
  ('EUROFIGHTER', 'EUROFIGHTER_TYPHOON'),
  ('THAAD_SYSTEM', 'THAAD'),
  ('IRON_DOME_BATTERY', 'IRON_DOME'),
  ('TOMAHAWK_CRUISE', 'TOMAHAWK'),
  ('AEGIS_COMBAT', 'AEGIS');
DELETE FROM catalog_duplicates d
WHERE NOT EXISTS (SELECT 1 FROM "MilitaryEquipmentCatalog" c WHERE c.key = d.kept)
   OR NOT EXISTS (SELECT 1 FROM "MilitaryEquipmentCatalog" c WHERE c.key = d.retired);

UPDATE "ProcurementOrder" o SET "catalogKey" = d.kept
FROM catalog_duplicates d WHERE o."catalogKey" = d.retired;

UPDATE "MilitaryAsset" a SET "catalogKey" = d.kept
FROM catalog_duplicates d WHERE a."catalogKey" = d.retired;

UPDATE "MilitaryEquipmentCatalog" k SET "usageCount" = k."usageCount" + r."usageCount"
FROM catalog_duplicates d JOIN "MilitaryEquipmentCatalog" r ON r.key = d.retired
WHERE k.key = d.kept;

DELETE FROM "MilitaryEquipmentCatalog" c USING catalog_duplicates d WHERE c.key = d.retired;

-- Names still listed twice: expect no rows.
SELECT name, count(*) AS rows, array_agg(key) AS keys
FROM "MilitaryEquipmentCatalog" GROUP BY name HAVING count(*) > 1;

COMMIT;
