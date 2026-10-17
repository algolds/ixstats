-- Cards refresh, Phase 2: admin and importers (docs/specs/2026-10-15-cards-refresh-design.md §2.4). Hand-written and
-- idempotent: safe to re-run, and a no-op on a database that already has it. It creates what the Prisma schema
-- declares, so the `db push` around it changes nothing here. Every existing card stays APPROVED. It also relaxes the
-- transfer-event FK to SET NULL (two columns go nullable) and tags legacy Commons cards. It needs Phase 1's
-- constraints first (the CardRarity enum, cards.realmId), and it is one transaction, so a failure changes nothing
-- (prisma db execute already runs a file as one; BEGIN and COMMIT make psql do the same).
--
--   docker exec -i ixstats-postgres psql -U postgres -d ixstats -v ON_ERROR_STOP=1 \
--     < prisma/migrations/20261028120000_cards_admin/migration.sql

BEGIN;

DO $$ BEGIN CREATE TYPE "CardReviewState" AS ENUM ('PENDING', 'APPROVED', 'REJECTED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "SpecialCardKind" AS ENUM ('EVENT', 'ACHIEVEMENT_REWARD'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "CardLicenceStatus" AS ENUM ('OPEN', 'RESTRICTED', 'UNKNOWN'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "CardImportJobKind" AS ENUM ('MANUAL', 'DAILY'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "CardImportJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'DONE', 'FAILED', 'CANCELLED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "CardImportItemStatus" AS ENUM ('QUEUED', 'PROCESSING', 'STAGED', 'SKIPPED', 'BLOCKED', 'FAILED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "CardTakedownOrigin" AS ENUM ('NS_SELF_SERVICE', 'AUTHOR_REQUEST', 'LICENCE_REVIEW', 'ADMIN'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "CardTakedownStatus" AS ENUM ('OPEN', 'HIDDEN', 'DECLINED', 'RESTORED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Review state and Special card fields.
ALTER TABLE "cards" ADD COLUMN IF NOT EXISTS "reviewState" "CardReviewState" NOT NULL DEFAULT 'APPROVED';
ALTER TABLE "cards" ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP(3);
ALTER TABLE "cards" ADD COLUMN IF NOT EXISTS "reviewedBy" TEXT;
ALTER TABLE "cards" ADD COLUMN IF NOT EXISTS "specialKind" "SpecialCardKind";
ALTER TABLE "cards" ADD COLUMN IF NOT EXISTS "rewardAchievementKey" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "cards_rewardAchievementKey_key" ON "cards"("rewardAchievementKey");
CREATE INDEX IF NOT EXISTS "cards_reviewState_realmId_idx" ON "cards"("reviewState", "realmId");

CREATE TABLE IF NOT EXISTS "card_art_licences" (
    "cardId" TEXT NOT NULL,
    "wiki" TEXT NOT NULL,
    "fileTitle" TEXT,
    "fileUrl" TEXT,
    "descriptionUrl" TEXT,
    "licence" TEXT,
    "licenceUrl" TEXT,
    "status" "CardLicenceStatus" NOT NULL DEFAULT 'UNKNOWN',
    "artist" TEXT,
    "attribution" TEXT,
    "note" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "importedBy" TEXT,
    "importJobId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "card_art_licences_pkey" PRIMARY KEY ("cardId")
);
CREATE INDEX IF NOT EXISTS "card_art_licences_status_idx" ON "card_art_licences"("status");

CREATE TABLE IF NOT EXISTS "card_import_jobs" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "kind" "CardImportJobKind" NOT NULL DEFAULT 'MANUAL',
    "status" "CardImportJobStatus" NOT NULL DEFAULT 'QUEUED',
    "label" TEXT NOT NULL,
    "requestedBy" TEXT,
    "requireImage" BOOLEAN NOT NULL DEFAULT false,
    "total" INTEGER NOT NULL DEFAULT 0,
    "processed" INTEGER NOT NULL DEFAULT 0,
    "staged" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "blocked" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "heartbeatAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    CONSTRAINT "card_import_jobs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "card_import_jobs_status_createdAt_idx" ON "card_import_jobs"("status", "createdAt");

CREATE TABLE IF NOT EXISTS "card_import_items" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "CardImportItemStatus" NOT NULL DEFAULT 'QUEUED',
    "cardId" TEXT,
    "rarity" "CardRarity",
    "licence" TEXT,
    "reason" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "card_import_items_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "card_import_items_jobId_title_key" ON "card_import_items"("jobId", "title");
CREATE INDEX IF NOT EXISTS "card_import_items_jobId_status_idx" ON "card_import_items"("jobId", "status");

CREATE TABLE IF NOT EXISTS "card_takedowns" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "origin" "CardTakedownOrigin" NOT NULL,
    "status" "CardTakedownStatus" NOT NULL DEFAULT 'OPEN',
    "reason" TEXT NOT NULL,
    "contact" TEXT,
    "requestedBy" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "savedArtwork" TEXT,
    "retiredByTakedown" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "resolutionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "card_takedowns_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "card_takedowns_status_dueAt_idx" ON "card_takedowns"("status", "dueAt");
CREATE INDEX IF NOT EXISTS "card_takedowns_cardId_idx" ON "card_takedowns"("cardId");

-- ADD CONSTRAINT has no IF NOT EXISTS form, hence the catalog checks.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'card_art_licences_cardId_fkey') THEN
    ALTER TABLE "card_art_licences" ADD CONSTRAINT "card_art_licences_cardId_fkey"
      FOREIGN KEY ("cardId") REFERENCES "cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'card_import_items_jobId_fkey') THEN
    ALTER TABLE "card_import_items" ADD CONSTRAINT "card_import_items_jobId_fkey"
      FOREIGN KEY ("jobId") REFERENCES "card_import_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'card_takedowns_cardId_fkey') THEN
    ALTER TABLE "card_takedowns" ADD CONSTRAINT "card_takedowns_cardId_fkey"
      FOREIGN KEY ("cardId") REFERENCES "cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- A suggestion's home realm (the free curation queue).
ALTER TABLE "lore_card_requests" ADD COLUMN IF NOT EXISTS "realmId" TEXT;
CREATE INDEX IF NOT EXISTS "lore_card_requests_realmId_idx" ON "lore_card_requests"("realmId");

-- Legacy Commons flag cards: Phase 1 made them Lore cards in Ixnay with no wikiSource and no wikiArticleTitle, so the
-- Commons importer could not see them. The old importer's metadata.commonsCategory marks them exactly, and their
-- Commons upload URL (the artwork, or the metadata.descriptionUrl it fell back to) marks the rest. An IxWiki article
-- card (a title, no source) can show a Commons image too, so a card with a wikiArticleTitle is left alone. A re-run
-- finds nothing left to change.
UPDATE "cards" SET "wikiSource" = 'commons'
WHERE "cardType" = 'LORE' AND "wikiSource" IS NULL AND "wikiArticleTitle" IS NULL
  AND ("metadata" ? 'commonsCategory'
    OR "artwork" ~* '^(https?:)?//upload\.wikimedia\.org/wikipedia/commons/'
    OR "metadata"->>'descriptionUrl' ~* '^(https?:)?//upload\.wikimedia\.org/wikipedia/commons/');

-- Transfer events outlive a revoked or voided copy: the copy's id goes null, the card and serial stay.
ALTER TABLE "card_transfer_events" ADD COLUMN IF NOT EXISTS "cardId" TEXT;
ALTER TABLE "card_transfer_events" ADD COLUMN IF NOT EXISTS "serialNumber" INTEGER;
ALTER TABLE "card_transfer_events" ALTER COLUMN "ownershipId" DROP NOT NULL;
ALTER TABLE "card_transfer_events" ALTER COLUMN "toUserId" DROP NOT NULL;
CREATE INDEX IF NOT EXISTS "card_transfer_events_cardId_idx" ON "card_transfer_events"("cardId");
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'card_transfer_events_ownershipId_fkey' AND confdeltype = 'c') THEN
    ALTER TABLE "card_transfer_events" DROP CONSTRAINT "card_transfer_events_ownershipId_fkey";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'card_transfer_events_ownershipId_fkey') THEN
    ALTER TABLE "card_transfer_events" ADD CONSTRAINT "card_transfer_events_ownershipId_fkey"
      FOREIGN KEY ("ownershipId") REFERENCES "CardOwnership"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

COMMIT;
