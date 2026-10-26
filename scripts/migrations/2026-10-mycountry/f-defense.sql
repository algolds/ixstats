-- MyCountry fix plan, WP-F (defense and gating): P0-07, P1-22.
-- Idempotent: each step only touches rows still out of line, so a re-run changes nothing, and step 1 is skipped once
-- D2a has dropped MilitaryUnit.readiness. Safe before or after the WP-F code deploy (no schema change).
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/migrations/2026-10-mycountry/f-defense.sql
--
-- Size first (read-only; the 2026-10-25 local clone had 0 and 0):
--   SELECT count(*) FROM "MilitaryUnit" WHERE readiness < 0 OR readiness > 100;
--   SELECT count(*) FROM "MilitaryConflict" c JOIN "Country" d ON d.id = c."defenderId"
--   WHERE c.status = 'proposed' AND (d."ownerUserId" IS NULL OR c."createdAt" < now() - interval '14 days');

BEGIN;

-- 1. P1-22: readiness had no floor (every deployment took 10) and recall could push it past 100. Realm time's D2a
--    (scripts/migrations/2026-10-realm-time/d2a-defense-model.sql) drops the column, and the deploy script runs this
--    file again on every release, so the clamp only runs while the column is there.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = current_schema() AND table_name = 'MilitaryUnit' AND column_name = 'readiness') THEN
    UPDATE "MilitaryUnit"
    SET readiness = LEAST(100, GREATEST(0, readiness)), "updatedAt" = now()
    WHERE readiness < 0 OR readiness > 100;
  END IF;
END $$;

-- 2. P0-07: end PvP challenges that can never be answered: those sent to an NPC nation (no owner)
--    and those unanswered past the 14-day window. They blocked any new challenge between the pair.
UPDATE "MilitaryConflict" c
SET status = 'resolved', winner = 'expired', "updatedAt" = now()
FROM "Country" d
WHERE d.id = c."defenderId"
  AND c.type = 'pvp'
  AND c.status = 'proposed'
  AND (d."ownerUserId" IS NULL OR c."createdAt" < now() - interval '14 days');

COMMIT;
