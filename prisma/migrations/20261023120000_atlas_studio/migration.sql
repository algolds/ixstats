-- Atlas and World Studio (docs/specs/2026-10-12-atlas-studio-design.md). Hand-written and idempotent: safe to
-- re-run, and a no-op on a database that already has it. It creates what the Prisma schema declares (so the
-- `db push` after it changes nothing here) and drops the models the schema no longer has.
--
-- Run it BEFORE `db push`: with the models gone from the schema, `db push` refuses to drop the non-empty
-- `procedural_worlds` table (it has no --accept-data-loss) and would abort the deploy.
--
--   docker exec -i ixstats-postgres psql -U postgres -d ixstats -v ON_ERROR_STOP=1 \
--     < prisma/migrations/20261023120000_atlas_studio/migration.sql

-- World presets: a named recipe (no seed) founders pick on the World tab. The built-ins are seeded from
-- WORLD_PRESETS on first read, so no rows are inserted here.
CREATE TABLE IF NOT EXISTS "world_presets" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "builtIn" BOOLEAN NOT NULL DEFAULT false,
    "publishedVersionId" TEXT,
    "draftVersionId" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "world_presets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "world_preset_versions" (
    "id" TEXT NOT NULL,
    "presetId" TEXT NOT NULL,
    "params" JSONB NOT NULL,
    "note" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "world_preset_versions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "world_presets_slug_key" ON "world_presets"("slug");
CREATE INDEX IF NOT EXISTS "world_presets_archivedAt_sortOrder_idx" ON "world_presets"("archivedAt", "sortOrder");
CREATE INDEX IF NOT EXISTS "world_preset_versions_presetId_createdAt_idx" ON "world_preset_versions"("presetId", "createdAt");

-- The two tables point at each other, so the foreign keys are added after both exist; ADD CONSTRAINT has no
-- IF NOT EXISTS form, hence the catalog check.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'world_presets_publishedVersionId_fkey') THEN
    ALTER TABLE "world_presets" ADD CONSTRAINT "world_presets_publishedVersionId_fkey"
      FOREIGN KEY ("publishedVersionId") REFERENCES "world_preset_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'world_presets_draftVersionId_fkey') THEN
    ALTER TABLE "world_presets" ADD CONSTRAINT "world_presets_draftVersionId_fkey"
      FOREIGN KEY ("draftVersionId") REFERENCES "world_preset_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'world_preset_versions_presetId_fkey') THEN
    ALTER TABLE "world_preset_versions" ADD CONSTRAINT "world_preset_versions_presetId_fkey"
      FOREIGN KEY ("presetId") REFERENCES "world_presets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- The dead models: nothing in the code reads them (the clone holds 38 procedural_worlds rows, no templates, and no
-- realm with a templateId).
DROP TABLE IF EXISTS "procedural_worlds";
DROP TABLE IF EXISTS "world_templates";
ALTER TABLE IF EXISTS "realms" DROP COLUMN IF EXISTS "templateId";
