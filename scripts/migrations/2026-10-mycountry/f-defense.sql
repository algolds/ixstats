-- MyCountry fix plan, WP-F (defense and gating): P0-07, P1-22.
-- Idempotent: each step only touches rows still out of line, so a re-run changes nothing.
-- Safe before or after the WP-F code deploy (no schema change).
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/migrations/2026-10-mycountry/f-defense.sql
--
-- Size first (read-only; the 2026-10-25 local clone had 0 and 0):
--   SELECT count(*) FROM "MilitaryUnit" WHERE readiness < 0 OR readiness > 100;
--   SELECT count(*) FROM "MilitaryConflict" c JOIN "Country" d ON d.id = c."defenderId"
--   WHERE c.status = 'proposed' AND (d."ownerUserId" IS NULL OR c."createdAt" < now() - interval '14 days');

BEGIN;

-- 1. P1-22: readiness had no floor (every deployment took 10) and recall could push it past 100.
UPDATE "MilitaryUnit"
SET readiness = LEAST(100, GREATEST(0, readiness)), "updatedAt" = now()
WHERE readiness < 0 OR readiness > 100;

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
