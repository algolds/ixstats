-- WikiOS data safety (docs/superpowers/plans/2026-10-24-wikios-data-safety.md): when WikiOS and classic
-- MediaWiki both change a page, the later save wins on both wikis and every overwritten author is told. This creates the
-- conflict log (one row per collision), turns each old "parked" revision into a legacy row (history only, nobody to tell),
-- retires the park re-push jobs and the switch that held them. Hand-written and idempotent: safe to re-run, and a no-op on
-- a database that already has it. It creates what the Prisma schema declares, so the `db push` around it changes nothing
-- here. It is one transaction, so a failure changes nothing (prisma db execute already runs a file as one; BEGIN and
-- COMMIT make psql do the same).
--
--   docker exec -i ixstats-postgres psql -U postgres -d ixstats -v ON_ERROR_STOP=1 \
--     < prisma/migrations/20261105120000_wikios_conflicts/migration.sql

BEGIN;

CREATE TABLE IF NOT EXISTS "wiki_conflicts" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'ixwiki',
    "articleId" TEXT,
    "title" TEXT NOT NULL,
    "winnerSide" TEXT NOT NULL,
    "winnerAction" TEXT NOT NULL,
    "winnerRef" TEXT NOT NULL,
    "winnerAt" TIMESTAMP(3) NOT NULL,
    "baseRef" TEXT,
    "overwritten" JSONB NOT NULL,
    "notified" JSONB NOT NULL DEFAULT '[]',
    "trailRevisionId" TEXT,
    "legacyPark" BOOLEAN NOT NULL DEFAULT false,
    "settledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "wiki_conflicts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "wiki_conflicts_key_key" ON "wiki_conflicts"("key");
CREATE INDEX IF NOT EXISTS "wiki_conflicts_articleId_createdAt_idx" ON "wiki_conflicts"("articleId", "createdAt");
CREATE INDEX IF NOT EXISTS "wiki_conflicts_createdAt_idx" ON "wiki_conflicts"("createdAt");
-- The settling's terminal state (added before this migration reached production): a database that ran the first
-- version of this file has the table without it.
ALTER TABLE "wiki_conflicts" ADD COLUMN IF NOT EXISTS "settledAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "wiki_conflicts_settledAt_createdAt_idx" ON "wiki_conflicts"("settledAt", "createdAt");

-- One legacy row per parked revision: the parked classic edit is what was overwritten, the WikiOS head named in
-- parkReason ("conflict:<head ref>", or "conflict:deleted") is the winner. The head's own time is used when it can be
-- found, the park's otherwise. Only "conflict:" reasons (and none at all) are legacy: a park recorded by the new code
-- says "overwritten:" and has its own row. This runs before the prefix is rewritten below.
INSERT INTO "wiki_conflicts" (
    "id", "key", "source", "articleId", "title", "winnerSide", "winnerAction", "winnerRef", "winnerAt",
    "baseRef", "overwritten", "notified", "trailRevisionId", "legacyPark", "createdAt", "updatedAt"
)
SELECT
    'legacy-park-' || r."id",
    'legacy-park:' || r."id",
    r."source",
    r."articleId",
    a."title",
    'wikios',
    CASE WHEN r."parkReason" = 'conflict:deleted' THEN 'delete' ELSE 'edit' END,
    COALESCE(NULLIF(substr(r."parkReason", 10), ''), 'unknown'),
    COALESCE(h."createdAt", r."createdAt"),
    NULL,
    jsonb_build_array(jsonb_build_object(
        'side', 'classic',
        'action', 'edit',
        'ref', COALESCE(r."mwRevId"::text, r."id"),
        'at', to_char(r."createdAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
        'author', jsonb_build_object(
            'userId', r."authorId",
            'classicName', r."author",
            'ip', NULL::text,
            'label', NULL::text
        )
    )),
    '[]'::jsonb,
    NULL,
    true,
    r."createdAt",
    CURRENT_TIMESTAMP
FROM "wiki_revisions" r
JOIN "wiki_articles" a ON a."id" = r."articleId"
LEFT JOIN LATERAL (
    SELECT x."createdAt"
    FROM "wiki_revisions" x
    WHERE x."articleId" = r."articleId"
      AND (x."id" = substr(r."parkReason", 10) OR x."mwRevId"::text = substr(r."parkReason", 10))
    ORDER BY x."createdAt" DESC
    LIMIT 1
) h ON true
WHERE r."parked" AND (r."parkReason" IS NULL OR r."parkReason" LIKE 'conflict:%')
ON CONFLICT ("key") DO NOTHING;

UPDATE "wiki_revisions"
SET "parkReason" = 'overwritten:' || substr("parkReason", 10)
WHERE "parked" AND "parkReason" LIKE 'conflict:%';

-- A park no longer pushes the WikiOS head back to MediaWiki (the later save wins there too), so its jobs are retired.
UPDATE "wiki_mirror_jobs"
SET "state" = 'discarded', "lastError" = 'Retired: park re-push'
WHERE "kind" = 'revision' AND "payload"->>'restore' = 'true' AND "state" IN ('pending', 'dead');

DELETE FROM "SystemConfig" WHERE "key" = 'wikiAutoSync.repushSkipped';

COMMIT;
