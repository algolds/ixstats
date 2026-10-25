-- WP-A2 (units and scales): one unit per column. Idempotent; run AFTER a1-storyteller-effects.sql (it reads
-- GovernmentStructure."componentMetricsSnapshot", which A1 adds) and before the new code starts.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/migrations/2026-10-mycountry/a2-units-and-scales.sql
--
-- 1. Country."inflationRate" is a percent (2 = 2%). Fraction rows (0.02) become percents; the legacy corrupt rows
--    (2e-34, 9.99e-34, 2.5e-16: repeated /100 writes) are nulled, so the projection's 2% default applies.
--    Rerunning is safe: a converted value is at least 0.2 and no longer matches either range.
-- 2. The same legacy /100 corruption in the growth columns. "adjustedGdpGrowth" and "actualGdpGrowth" are NOT NULL
--    decimals, so they get their mantissa back (3e-34 -> 0.03, 4.2e-12 -> 0.042: multiplied by 100 until at least
--    0.001); the nullable "realGDPGrowthRate" is nulled.
-- 3. GovernmentStructure."politicalStability" moves from 0-1 to 0-100 (like the other political metrics), together
--    with the component shift politics-drift last applied to it ("componentMetricsSnapshot", same fraction scale),
--    and the column default becomes 50. A row at or below 1 is on the old scale.
-- 4. Country."baselineDate" loses its wall-clock default (every create path sets an IxTime baseline). Rows the
--    default stamped with wall-clock time (before the 2028 in-game epoch) get the IxTime of that moment (IxTime's
--    canonical formula after the 2025-07-27 pivot: 2040-01-01 + 2 x real time elapsed), so they stop projecting
--    about 16 IxTime years at once.

BEGIN;

-- 1. Inflation
UPDATE "Country"
SET "inflationRate" = NULL
WHERE "inflationRate" <> 0 AND abs("inflationRate") < 0.002;

UPDATE "Country"
SET "inflationRate" = round(("inflationRate" * 100)::numeric, 6)::double precision
WHERE abs("inflationRate") >= 0.002 AND abs("inflationRate") < 0.2;

-- 2. Growth corruption
UPDATE "Country"
SET "adjustedGdpGrowth" = round(
  ("adjustedGdpGrowth" * power(100::double precision, ceil(log(0.001 / abs("adjustedGdpGrowth")) / 2)))::numeric,
  6
)::double precision
WHERE "adjustedGdpGrowth" <> 0 AND abs("adjustedGdpGrowth") < 1e-6;

UPDATE "Country"
SET "actualGdpGrowth" = round(
  ("actualGdpGrowth" * power(100::double precision, ceil(log(0.001 / abs("actualGdpGrowth")) / 2)))::numeric,
  6
)::double precision
WHERE "actualGdpGrowth" <> 0 AND abs("actualGdpGrowth") < 1e-6;

UPDATE "Country"
SET "realGDPGrowthRate" = NULL
WHERE "realGDPGrowthRate" <> 0 AND abs("realGDPGrowthRate") < 1e-6;

-- 3. Political stability 0-1 -> 0-100
UPDATE "GovernmentStructure"
SET
  "politicalStability" = round(("politicalStability" * 100)::numeric, 4)::double precision,
  "componentMetricsSnapshot" = CASE
    WHEN "componentMetricsSnapshot" IS NOT NULL
      AND "componentMetricsSnapshot"::jsonb ? 'politicalStability'
    THEN jsonb_set(
      "componentMetricsSnapshot"::jsonb,
      '{politicalStability}',
      to_jsonb(("componentMetricsSnapshot"::jsonb ->> 'politicalStability')::double precision * 100)
    )::text
    ELSE "componentMetricsSnapshot"
  END
WHERE "politicalStability" <= 1;

ALTER TABLE "GovernmentStructure" ALTER COLUMN "politicalStability" SET DEFAULT 50;

-- 4. No wall-clock baseline
UPDATE "Country"
SET "baselineDate" = TIMESTAMP '2040-01-01 00:00:00' + ("baselineDate" - TIMESTAMP '2025-07-27 00:00:00') * 2
WHERE "baselineDate" >= TIMESTAMP '2025-07-27 00:00:00' AND "baselineDate" < TIMESTAMP '2028-01-01 00:00:00';

ALTER TABLE "Country" ALTER COLUMN "baselineDate" DROP DEFAULT;

COMMIT;

-- Checks (expect 0 rows each):
--   SELECT id, name, "inflationRate" FROM "Country" WHERE abs("inflationRate") > 0 AND abs("inflationRate") < 0.2;
--   SELECT id, name FROM "Country" WHERE abs("adjustedGdpGrowth") > 0 AND abs("adjustedGdpGrowth") < 1e-6;
--   SELECT "countryId", "politicalStability" FROM "GovernmentStructure" WHERE "politicalStability" <= 1;
--   SELECT id, name, "baselineDate" FROM "Country" WHERE "baselineDate" < TIMESTAMP '2028-01-01 00:00:00';
