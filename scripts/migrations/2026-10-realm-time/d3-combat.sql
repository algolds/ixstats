-- Realm time, WP-D3: combat resolution and economic feedback (design §4.1; research §7.5–7.7).
--   * DefensePolicy.terrainProfile: the defender's declared terrain, used where the realm map has no data.
--   * DefensePolicy.npcBurdenAdjustment: an NPC's Richardson response to threats (players stay 0).
--   * MilitaryConflict: orders, orders hash, commit time, HMAC seed, inputs snapshot and the result (band, margin, days).
--   * MilitaryOperation: an intervention's orders, their hash, the seed, commit time, inputs snapshot and outcome band.
-- Additive only: the old build ignores the new columns, so this runs BEFORE the code deploy. Idempotent.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/migrations/2026-10-realm-time/d3-combat.sql

BEGIN;

ALTER TABLE "DefensePolicy" ADD COLUMN IF NOT EXISTS "terrainProfile" TEXT;
ALTER TABLE "DefensePolicy" ADD COLUMN IF NOT EXISTS "npcBurdenAdjustment" DOUBLE PRECISION NOT NULL DEFAULT 0;

ALTER TABLE "MilitaryConflict" ADD COLUMN IF NOT EXISTS "orders" TEXT;
ALTER TABLE "MilitaryConflict" ADD COLUMN IF NOT EXISTS "ordersHash" TEXT;
ALTER TABLE "MilitaryConflict" ADD COLUMN IF NOT EXISTS "committedClockMs" DOUBLE PRECISION;
ALTER TABLE "MilitaryConflict" ADD COLUMN IF NOT EXISTS "seed" TEXT;
ALTER TABLE "MilitaryConflict" ADD COLUMN IF NOT EXISTS "inputSnapshot" TEXT;
ALTER TABLE "MilitaryConflict" ADD COLUMN IF NOT EXISTS "outcomeBand" TEXT;
ALTER TABLE "MilitaryConflict" ADD COLUMN IF NOT EXISTS "margin" DOUBLE PRECISION;
ALTER TABLE "MilitaryConflict" ADD COLUMN IF NOT EXISTS "engagementDays" INTEGER;

ALTER TABLE "MilitaryOperation" ADD COLUMN IF NOT EXISTS "orders" TEXT;
ALTER TABLE "MilitaryOperation" ADD COLUMN IF NOT EXISTS "ordersHash" TEXT;
ALTER TABLE "MilitaryOperation" ADD COLUMN IF NOT EXISTS "committedClockMs" DOUBLE PRECISION;
ALTER TABLE "MilitaryOperation" ADD COLUMN IF NOT EXISTS "seed" TEXT;
ALTER TABLE "MilitaryOperation" ADD COLUMN IF NOT EXISTS "inputSnapshot" TEXT;
ALTER TABLE "MilitaryOperation" ADD COLUMN IF NOT EXISTS "outcomeBand" TEXT;

COMMIT;
