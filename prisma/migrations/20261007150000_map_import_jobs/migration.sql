-- Community map imports (docs/systems/maps.md, "Realm map import engine"): background import jobs and the
-- rollback snapshots of applied imports. Additive and idempotent: two new tables, nothing existing changes.

CREATE TABLE IF NOT EXISTS "map_import_jobs" (
    "id" TEXT NOT NULL,
    "realmId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "stage" TEXT,
    "dryRun" BOOLEAN NOT NULL DEFAULT true,
    "options" JSONB NOT NULL DEFAULT '{}',
    "result" JSONB,
    "error" TEXT,
    "requestedBy" TEXT NOT NULL,
    "uploadId" TEXT,
    "filename" TEXT,
    "parentJobId" TEXT,
    "startedAt" TIMESTAMP(3),
    "heartbeatAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "map_import_jobs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "map_import_jobs_realmId_createdAt_idx" ON "map_import_jobs"("realmId", "createdAt");
CREATE INDEX IF NOT EXISTS "map_import_jobs_status_createdAt_idx" ON "map_import_jobs"("status", "createdAt");

CREATE TABLE IF NOT EXISTS "map_imports" (
    "id" TEXT NOT NULL,
    "realmId" TEXT NOT NULL,
    "jobId" TEXT,
    "layerTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "mode" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "summary" JSONB,
    "snapshot" BYTEA,
    "snapshotBytes" INTEGER NOT NULL DEFAULT 0,
    "rollbackAvailable" BOOLEAN NOT NULL DEFAULT true,
    "rolledBackAt" TIMESTAMP(3),
    "rolledBackBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "map_imports_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "map_imports_realmId_createdAt_idx" ON "map_imports"("realmId", "createdAt");
