-- Realm source sync (docs/systems/realms-eurth-onboarding.md, step 4): a realm's nations, borders and alliances
-- kept in step with an outside source. Additive, except Alliance's name uniqueness, which moves from global to
-- per realm: existing alliances all become IxWorld's ("default", the id Country.realmId already uses), and two
-- alliances can never have held the same name before, so the new (realmId, name) key cannot fail.

-- Country: the nation's key in its realm's source, unique per realm (NULLs never clash).
ALTER TABLE "Country" ADD COLUMN "externalSourceKey" TEXT;
CREATE UNIQUE INDEX "Country_realmId_externalSourceKey_key" ON "Country"("realmId", "externalSourceKey");

-- Alliance: realm-scoped, with the source organisation's id when the sync created it.
ALTER TABLE "Alliance" ADD COLUMN "realmId" TEXT NOT NULL DEFAULT 'default';
ALTER TABLE "Alliance" ADD COLUMN "externalSourceKey" TEXT;
DROP INDEX "Alliance_name_key";
CREATE UNIQUE INDEX "Alliance_realmId_name_key" ON "Alliance"("realmId", "name");
CREATE UNIQUE INDEX "Alliance_realmId_externalSourceKey_key" ON "Alliance"("realmId", "externalSourceKey");

-- One source sync per realm.
CREATE TABLE "realm_source_syncs" (
    "id" TEXT NOT NULL,
    "realmId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "provider" TEXT NOT NULL DEFAULT 'github',
    "repo" TEXT NOT NULL,
    "ref" TEXT NOT NULL DEFAULT 'main',
    "format" TEXT NOT NULL,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "intervalHours" INTEGER,
    "options" JSONB NOT NULL DEFAULT '{}',
    "continentMap" JSONB NOT NULL DEFAULT '{}',
    "overrides" JSONB NOT NULL DEFAULT '{}',
    "presetId" TEXT,
    "updatedBy" TEXT,
    "lastRunAt" TIMESTAMP(3),
    "lastStatus" TEXT,
    "lastSummary" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "realm_source_syncs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "realm_source_syncs_realmId_key" ON "realm_source_syncs"("realmId");
CREATE INDEX "realm_source_syncs_enabled_idx" ON "realm_source_syncs"("enabled");

-- Every dry run and applied run.
CREATE TABLE "realm_sync_runs" (
    "id" TEXT NOT NULL,
    "realmId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "dryRun" BOOLEAN NOT NULL,
    "triggeredBy" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running',
    "summary" JSONB,
    "errors" JSONB,

    CONSTRAINT "realm_sync_runs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "realm_sync_runs_realmId_startedAt_idx" ON "realm_sync_runs"("realmId", "startedAt");
