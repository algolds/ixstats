-- MyCountry fix plan, WP-DE (politics + diplomacy): P1-20, P1-27.
-- Idempotent: each step only touches rows not already in the target state, so a re-run changes nothing.
-- Run any time around the WP-DE deploy (the code reads the same columns; this only fixes stored values).
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/migrations/2026-10-mycountry/de-relation-bands.sql
--
-- Size first (read-only):
--   SELECT relationship, strength, "recentActivity" IS NULL AS untouched, count(*)
--   FROM "DiplomaticRelation" GROUP BY 1, 2, 3 ORDER BY 2;

BEGIN;

-- 1. Relations an embassy opened at strength 25 ("baseline goodwill" on a scale where 25 reads tense) and nothing has
--    moved since: put them where a new embassy's relation now starts, neutral with a little goodwill (55).
UPDATE "DiplomaticRelation"
SET strength = 55, "updatedAt" = now()
WHERE strength = 25
  AND "diplomaticChannels" = '["embassy"]'
  AND "recentActivity" IS NULL;

-- 2. One band per strength, stored in lower case (src/lib/diplomacy/relation-bands.ts getStandingBand). The drift job
--    used to write upper-case labels and embassies "neutral" whatever the strength.
UPDATE "DiplomaticRelation"
SET relationship = CASE
      WHEN strength >= 80 THEN 'allied'
      WHEN strength >= 60 THEN 'friendly'
      WHEN strength >= 40 THEN 'neutral'
      WHEN strength >= 20 THEN 'tense'
      ELSE 'hostile'
    END,
    "updatedAt" = now()
WHERE relationship IS DISTINCT FROM CASE
      WHEN strength >= 80 THEN 'allied'
      WHEN strength >= 60 THEN 'friendly'
      WHEN strength >= 40 THEN 'neutral'
      WHEN strength >= 20 THEN 'tense'
      ELSE 'hostile'
    END;

COMMIT;
