-- Native lore: the lore team (users a country's owner lets write lore pieces for it) and the owner's curation of its
-- lore pages (type, pinned, hidden) (docs/superpowers/specs/2026-10-24-native-lore-design.md, "Data"). Hand-written and
-- idempotent: safe to re-run, and a no-op on a database that already has it. It creates what the Prisma schema
-- declares, so the `db push` around it changes nothing here. It is one transaction, so a failure changes nothing
-- (prisma db execute already runs a file as one; BEGIN and COMMIT make psql do the same).
--
--   docker exec -i ixstats-postgres psql -U postgres -d ixstats -v ON_ERROR_STOP=1 \
--     < prisma/migrations/20261104120000_country_lore/migration.sql

BEGIN;

CREATE TABLE IF NOT EXISTS "country_lore_authors" (
    "id" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "addedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "country_lore_authors_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "country_lore_authors_countryId_userId_key" ON "country_lore_authors"("countryId", "userId");
CREATE INDEX IF NOT EXISTS "country_lore_authors_userId_idx" ON "country_lore_authors"("userId");

CREATE TABLE IF NOT EXISTS "country_lore_pages" (
    "id" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "ownerAdded" BOOLEAN NOT NULL DEFAULT false,
    "addedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "country_lore_pages_pkey" PRIMARY KEY ("id")
);
-- A page the owner added (addExistingPiece) lists without the lore category; a recorded piece only with it. For a
-- table made before the flag (the clone), added here.
ALTER TABLE "country_lore_pages" ADD COLUMN IF NOT EXISTS "ownerAdded" BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS "country_lore_pages_countryId_title_key" ON "country_lore_pages"("countryId", "title");
CREATE INDEX IF NOT EXISTS "country_lore_pages_countryId_idx" ON "country_lore_pages"("countryId");

-- ADD CONSTRAINT has no IF NOT EXISTS form, hence the catalog checks.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'country_lore_authors_countryId_fkey') THEN
    ALTER TABLE "country_lore_authors" ADD CONSTRAINT "country_lore_authors_countryId_fkey"
      FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'country_lore_authors_userId_fkey') THEN
    ALTER TABLE "country_lore_authors" ADD CONSTRAINT "country_lore_authors_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'country_lore_pages_countryId_fkey') THEN
    ALTER TABLE "country_lore_pages" ADD CONSTRAINT "country_lore_pages_countryId_fkey"
      FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

COMMIT;
