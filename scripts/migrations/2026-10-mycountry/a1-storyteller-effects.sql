-- MyCountry fix plan, WP-A1 (engine effects): P0-14, P0-15, P0-16, P1-31.
-- Idempotent: every step only touches rows it has not already converted, so a re-run changes nothing.
-- Run BEFORE deploying the WP-A1 code: Prisma reads GovernmentStructure."componentMetricsSnapshot".
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/migrations/2026-10-mycountry/a1-storyteller-effects.sql
--
-- Size first (read-only):
--   SELECT "inputType", "isActive", count(*), min("ixTimeTimestamp"), max("ixTimeTimestamp")
--   FROM "DmInputs" GROUP BY 1, 2 ORDER BY 1, 2;

BEGIN;

-- 1. P0-16: politics-drift carries event deltas by removing the shift components applied last time.
ALTER TABLE "GovernmentStructure" ADD COLUMN IF NOT EXISTS "componentMetricsSnapshot" TEXT;

-- 2. P1-31 / P0-16: retire rows no engine reads, and the pre-level government-component rows
--    (growth types with no key; politics-drift rewrites them as keyed GDP level effects).
UPDATE "DmInputs"
SET "isActive" = false, "updatedAt" = now()
WHERE "isActive"
  AND (
    lower("inputType") IN (
      'transport_gdp_bonus', 'transport_trade_bonus', 'transport_infra_maintenance',
      'capacity_relief', 'party_influence', 'military_readiness'
    )
    OR lower("inputType") LIKE 'resource\_%\_output'
    OR ("createdBy" IS NULL
        AND ("description" LIKE '[GovComponent]%' OR "description" LIKE '[BrokerComponent]%'))
  );

-- 3. P0-15: growth-type effects become level effects with the same value (owner decision 2):
--    policies (gdpEffect/100 = the GDP level), foreign policy, conflicts, operations, elections.
UPDATE "DmInputs"
SET "inputType" = 'gdp_level_adjustment', "updatedAt" = now()
WHERE "isActive" AND lower("inputType") IN ('gdp_adjustment', 'growth_rate_modifier', 'economic_policy');

UPDATE "DmInputs"
SET "inputType" = 'population_level_adjustment', "updatedAt" = now()
WHERE "isActive" AND lower("inputType") = 'population_adjustment';

UPDATE "DmInputs"
SET "inputType" = 'trade_agreement', "updatedAt" = now()
WHERE "isActive" AND "inputType" = 'TRADE_AGREEMENT';

-- Policy effects had no duration (applied at once); they phase in over 1 IxTime year like new ones.
UPDATE "DmInputs"
SET "duration" = 1, "updatedAt" = now()
WHERE "isActive" AND "createdBy" LIKE 'POLICY:%' AND "duration" IS NULL
  AND "inputType" = 'gdp_level_adjustment';

-- Admin world events wrote their event type (economic_crisis, pandemic, ...) as the inputType,
-- which nothing read: give them the GDP level their preview showed (lib/economy/world-event-effects.ts).
DO $$
BEGIN
  IF to_regclass('"WorldEvent"') IS NOT NULL THEN
    UPDATE "DmInputs" d
    SET "inputType" = 'gdp_level_adjustment',
        "value" = CASE
          WHEN we."type" IN ('economic_crisis', 'trade_war', 'natural_disaster', 'pandemic',
                             'political_upheaval', 'global_recession', 'currency_crisis',
                             'cyber_attack', 'climate_disaster', 'financial_crisis')
            THEN -(we."severity" * 0.2)
          ELSE we."severity" * 0.15
        END,
        "updatedAt" = now()
    FROM "WorldEvent" we
    WHERE d."worldEventId" = we."id"
      AND d."isActive"
      AND lower(d."inputType") NOT IN (
        'gdp_level_adjustment', 'population_level_adjustment', 'trade_agreement',
        'natural_disaster', 'special_event', 'sports_saint_blessing', 'sports_scandal'
      );
  END IF;
END $$;

-- 4. P0-14: re-stamp active rows written with wall-clock time (before the 2028-01-01 IxTime epoch)
--    with the IxTime of that moment: IxTime.convertToIxTime's canonical formula (4x from the
--    2020-10-04 real epoch until the 2025-07-27 pivot = 2040-01-01 IxTime, 2x after). A bot clock
--    override is not reproduced here. Only rows whose IxTime lands on or after the epoch are
--    re-stamped, so a re-run finds nothing.
UPDATE "DmInputs" d
SET "ixTimeTimestamp" = s.ix, "updatedAt" = now()
FROM (
  SELECT "id",
    CASE
      WHEN "ixTimeTimestamp" >= TIMESTAMP '2025-07-27 00:00:00'
        THEN TIMESTAMP '2040-01-01 00:00:00' + ("ixTimeTimestamp" - TIMESTAMP '2025-07-27 00:00:00') * 2
      ELSE TIMESTAMP '2020-10-04 00:00:00' + ("ixTimeTimestamp" - TIMESTAMP '2020-10-04 00:00:00') * 4
    END AS ix
  FROM "DmInputs"
  WHERE "isActive" AND "ixTimeTimestamp" < TIMESTAMP '2028-01-01 00:00:00'
) s
WHERE d."id" = s."id" AND s.ix >= TIMESTAMP '2028-01-01 00:00:00';

COMMIT;
