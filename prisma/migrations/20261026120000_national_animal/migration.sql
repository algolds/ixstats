-- Country editor (docs/specs/2026-10-15-country-builder-editor-redesign-design.md, identity and renaming): the
-- national animal the builder always asked for and never saved, and the old addresses of renamed countries, which
-- `/countries/<slug>` redirects from. Additive, and everything here is in the Prisma schema too, so `db push` adds it
-- as well; this file is idempotent and safe to re-run by hand:
--
--   docker exec -i ixstats-postgres psql -U postgres -d ixstats -v ON_ERROR_STOP=1 \
--     < prisma/migrations/20261026120000_national_animal/migration.sql

ALTER TABLE "NationalIdentity" ADD COLUMN IF NOT EXISTS "nationalAnimal" TEXT;

CREATE TABLE IF NOT EXISTS "CountrySlugRedirect" (
    "id" TEXT NOT NULL,
    "oldSlug" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CountrySlugRedirect_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CountrySlugRedirect_oldSlug_key" ON "CountrySlugRedirect"("oldSlug");
CREATE INDEX IF NOT EXISTS "CountrySlugRedirect_countryId_idx" ON "CountrySlugRedirect"("countryId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CountrySlugRedirect_countryId_fkey') THEN
    ALTER TABLE "CountrySlugRedirect" ADD CONSTRAINT "CountrySlugRedirect_countryId_fkey"
      FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
