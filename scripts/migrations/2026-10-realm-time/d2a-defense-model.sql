-- Realm time, WP-D2a: the defense model's schema (design §4.2).
--   * MilitaryBranch: a domain (land, sea, air, marines, space, strategic_missile) replaces branchType; the
--     player-typed levels and budgets (readinessLevel, technologyLevel, trainingLevel, morale, annualBudget,
--     budgetPercent, deploymentCapacity, sustainmentCapacity) are dropped; per-branch model state is added
--     (effort share, capital K, readiness sub-scores, mobilisation, lastTickClockMs); headcounts become fractional.
--   * MilitaryUnit.readiness and MilitaryAsset.modernizationLevel (typed) are dropped; assets keep a catalog key and
--     design year.
--   * New: DefensePolicy (one per nation), ProcurementOrder, and their enums; MilitaryConflict.startClockMs.
--   * Free assets (no catalog key: typed by players before the reset) are discarded (owner decision).
-- Branch identities (names, mottos, images, units) are kept; the numbers are reset by the TS step that follows:
--   bun scripts/defense/reset-starter-forces.ts --apply
-- Idempotent: IF [NOT] EXISTS everywhere and the asset delete only touches rows without a catalog key, so a re-run
-- changes nothing.
--
-- Run IN THE DEPLOY WINDOW (old build stopped: it reads the dropped columns; new build not started: it reads the new
-- ones), after `bun run db:backup`:
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/migrations/2026-10-realm-time/d2a-defense-model.sql

BEGIN;

DO $$ BEGIN
  CREATE TYPE "BranchDomain" AS ENUM ('land', 'sea', 'air', 'marines', 'space', 'strategic_missile');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "DefenseDoctrine" AS ENUM ('defensive', 'balanced', 'expeditionary');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "DefenseAlertLevel" AS ENUM ('peacetime', 'elevated', 'high', 'war');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "DefenseOmPriority" AS ENUM ('balanced', 'maintenance', 'training');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "ProcurementSource" AS ENUM ('domestic', 'import');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "ProcurementStatus" AS ENUM ('ordered', 'delivered', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- MilitaryBranch: domain from the old branch type, then drop the type.
ALTER TABLE "MilitaryBranch" ADD COLUMN IF NOT EXISTS "domain" "BranchDomain";
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'MilitaryBranch' AND column_name = 'branchType') THEN
    UPDATE "MilitaryBranch" SET "domain" = (CASE "branchType"::text
      WHEN 'navy' THEN 'sea'
      WHEN 'coast_guard' THEN 'sea'
      WHEN 'air_force' THEN 'air'
      WHEN 'marines' THEN 'marines'
      WHEN 'space_force' THEN 'space'
      ELSE 'land' END)::"BranchDomain"
    WHERE "domain" IS NULL;
  END IF;
END $$;
UPDATE "MilitaryBranch" SET "domain" = 'land' WHERE "domain" IS NULL;
ALTER TABLE "MilitaryBranch" ALTER COLUMN "domain" SET NOT NULL;
ALTER TABLE "MilitaryBranch" DROP COLUMN IF EXISTS "branchType";
DROP INDEX IF EXISTS "MilitaryBranch_branchType_idx";
DROP TYPE IF EXISTS "BranchType";
CREATE INDEX IF NOT EXISTS "MilitaryBranch_domain_idx" ON "MilitaryBranch" ("domain");

ALTER TABLE "MilitaryBranch"
  DROP COLUMN IF EXISTS "annualBudget",
  DROP COLUMN IF EXISTS "budgetPercent",
  DROP COLUMN IF EXISTS "readinessLevel",
  DROP COLUMN IF EXISTS "technologyLevel",
  DROP COLUMN IF EXISTS "trainingLevel",
  DROP COLUMN IF EXISTS "morale",
  DROP COLUMN IF EXISTS "deploymentCapacity",
  DROP COLUMN IF EXISTS "sustainmentCapacity";

ALTER TABLE "MilitaryBranch"
  ALTER COLUMN "activeDuty" TYPE DOUBLE PRECISION USING "activeDuty"::double precision,
  ALTER COLUMN "reserves" TYPE DOUBLE PRECISION USING "reserves"::double precision;

ALTER TABLE "MilitaryBranch"
  ADD COLUMN IF NOT EXISTS "effortShare" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "targetActive" INTEGER,
  ADD COLUMN IF NOT EXISTS "capital" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "readinessPersonnel" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "readinessEquipment" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "readinessCondition" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "readinessTraining" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "reserveTraining" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "mobilisationOrder" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "mobilisationOrderedClockMs" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "mobilised" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "lastTickClockMs" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Units organise personnel; their typed readiness goes (readiness is the branch's, derived).
ALTER TABLE "MilitaryUnit" DROP COLUMN IF EXISTS "readiness";

-- Assets: typed modernisation goes; catalog key and design year come in. Free assets are discarded.
ALTER TABLE "MilitaryAsset" DROP COLUMN IF EXISTS "modernizationLevel";
ALTER TABLE "MilitaryAsset"
  ADD COLUMN IF NOT EXISTS "catalogKey" TEXT,
  ADD COLUMN IF NOT EXISTS "designYear" INTEGER;
CREATE INDEX IF NOT EXISTS "MilitaryAsset_catalogKey_idx" ON "MilitaryAsset" ("catalogKey");
DELETE FROM "MilitaryAsset" WHERE "catalogKey" IS NULL;

-- PvP windows run on the realm clock.
ALTER TABLE "MilitaryConflict" ADD COLUMN IF NOT EXISTS "startClockMs" DOUBLE PRECISION;

CREATE TABLE IF NOT EXISTS "DefensePolicy" (
  "id" TEXT NOT NULL,
  "countryId" TEXT NOT NULL,
  "sharePersonnel" DOUBLE PRECISION NOT NULL DEFAULT 0.35,
  "shareOm" DOUBLE PRECISION NOT NULL DEFAULT 0.3,
  "shareProcurement" DOUBLE PRECISION NOT NULL DEFAULT 0.22,
  "shareRd" DOUBLE PRECISION NOT NULL DEFAULT 0.06,
  "shareInfrastructure" DOUBLE PRECISION NOT NULL DEFAULT 0.07,
  "preset" TEXT,
  "volunteerShare" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "serviceMonths" INTEGER NOT NULL DEFAULT 12,
  "reserveYears" INTEGER NOT NULL DEFAULT 20,
  "doctrine" "DefenseDoctrine" NOT NULL DEFAULT 'balanced',
  "alertLevel" "DefenseAlertLevel" NOT NULL DEFAULT 'peacetime',
  "previousAlertLevel" "DefenseAlertLevel" NOT NULL DEFAULT 'peacetime',
  "alertChangedClockMs" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "omPriority" "DefenseOmPriority" NOT NULL DEFAULT 'balanced',
  "rdStock" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "infrastructureStock" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "priceIndex" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "surgeStartedClockMs" DOUBLE PRECISION,
  "lastTickClockMs" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DefensePolicy_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DefensePolicy_countryId_fkey" FOREIGN KEY ("countryId")
    REFERENCES "Country" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "DefensePolicy_countryId_key" ON "DefensePolicy" ("countryId");

CREATE TABLE IF NOT EXISTS "ProcurementOrder" (
  "id" TEXT NOT NULL,
  "countryId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "catalogKey" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unitCost" DOUBLE PRECISION NOT NULL,
  "unitRealValue" DOUBLE PRECISION NOT NULL,
  "source" "ProcurementSource" NOT NULL,
  "leadMonths" INTEGER NOT NULL,
  "designYear" INTEGER NOT NULL,
  "orderedClockMs" DOUBLE PRECISION NOT NULL,
  "expectedClockMs" DOUBLE PRECISION NOT NULL,
  "paidSoFar" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "status" "ProcurementStatus" NOT NULL DEFAULT 'ordered',
  "deliveredClockMs" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProcurementOrder_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProcurementOrder_branchId_fkey" FOREIGN KEY ("branchId")
    REFERENCES "MilitaryBranch" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "ProcurementOrder_countryId_status_idx" ON "ProcurementOrder" ("countryId", "status");
CREATE INDEX IF NOT EXISTS "ProcurementOrder_branchId_idx" ON "ProcurementOrder" ("branchId");

SELECT
  (SELECT count(*) FROM "MilitaryBranch") AS branches,
  (SELECT count(*) FROM "MilitaryAsset") AS catalog_assets,
  (SELECT count(*) FROM "DefensePolicy") AS policies;

COMMIT;
