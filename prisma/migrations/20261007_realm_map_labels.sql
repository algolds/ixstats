-- Realm-owned maps (docs/systems/maps.md, "Realm maps"): realm labels and realm-tagged border edit requests.
-- Additive: `db push` applies the same changes with no data-loss prompt. Safe to re-run.

-- A realm label (ocean, sea, region, continent) belongs to a realm, not a nation: countryId becomes optional and
-- realmId names the realm. Existing labels keep their nation and leave realmId empty.
ALTER TABLE "map_labels" ALTER COLUMN "countryId" DROP NOT NULL;
ALTER TABLE "map_labels" ADD COLUMN IF NOT EXISTS "realmId" TEXT;
ALTER TABLE "map_labels" ADD COLUMN IF NOT EXISTS "fontStyle" TEXT NOT NULL DEFAULT 'normal';
CREATE INDEX IF NOT EXISTS "map_labels_realmId_status_idx" ON "map_labels"("realmId", "status");

-- The realm whose map a border edit request is for.
ALTER TABLE "map_edit_requests" ADD COLUMN IF NOT EXISTS "realmId" TEXT;
CREATE INDEX IF NOT EXISTS "map_edit_requests_realmId_status_idx" ON "map_edit_requests"("realmId", "status");
