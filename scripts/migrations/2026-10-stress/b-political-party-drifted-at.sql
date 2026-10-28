-- Stress test B-12a: politics drift runs on the realm clock. Additive and idempotent; run before deploying the code.
ALTER TABLE "PoliticalParty" ADD COLUMN IF NOT EXISTS "driftedAtClockMs" DOUBLE PRECISION;
