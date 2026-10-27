-- Realm time, WP-D1: drop the legacy security tables and the separate defense budget row.
-- The defense budget is now the National budget's Defense department line (BudgetAllocation);
-- the threat picture, security assessment and border security are derived on read.
-- Idempotent: IF EXISTS everywhere, so a re-run changes nothing.
--
-- Run AFTER the realm-time code is deployed (the old build still reads these tables), and after
-- `bun run db:backup`:
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/migrations/2026-10-realm-time/d1-drop-legacy-security.sql
--
-- Size first (read-only):
--   SELECT 'DefenseBudget', count(*) FROM "DefenseBudget"
--   UNION ALL SELECT 'SecurityAssessment', count(*) FROM "SecurityAssessment"
--   UNION ALL SELECT 'BorderSecurity', count(*) FROM "BorderSecurity"
--   UNION ALL SELECT 'NeighborThreatAssessment', count(*) FROM "NeighborThreatAssessment"
--   UNION ALL SELECT 'SecurityThreat', count(*) FROM "SecurityThreat"
--   UNION ALL SELECT 'ThreatIncident', count(*) FROM "ThreatIncident"
--   UNION ALL SELECT 'SecurityEvent', count(*) FROM "SecurityEvent";

BEGIN;

-- Children before parents: NeighborThreatAssessment -> BorderSecurity, ThreatIncident -> SecurityThreat.
DROP TABLE IF EXISTS "NeighborThreatAssessment" CASCADE;
DROP TABLE IF EXISTS "BorderSecurity" CASCADE;
DROP TABLE IF EXISTS "ThreatIncident" CASCADE;
DROP TABLE IF EXISTS "SecurityThreat" CASCADE;
DROP TABLE IF EXISTS "SecurityEvent" CASCADE;
DROP TABLE IF EXISTS "SecurityAssessment" CASCADE;
DROP TABLE IF EXISTS "DefenseBudget" CASCADE;

-- Enums only SecurityThreat used.
DROP TYPE IF EXISTS "ThreatType";
DROP TYPE IF EXISTS "ThreatSeverity";
DROP TYPE IF EXISTS "ThreatStatus";

COMMIT;
