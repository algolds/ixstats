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
    "firstSettleAt" TIMESTAMP(3),
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
-- When the settling first tried the row (its trail's retry window starts there), likewise added before production.
ALTER TABLE "wiki_conflicts" ADD COLUMN IF NOT EXISTS "firstSettleAt" TIMESTAMP(3);

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

-- Where each revision was saved: 'wikios' (a WikiOS save, stamped later by the mirror) or 'classic' (a MediaWiki
-- revision brought in by an import or the inbound sync). MediaWiki ids order only classic revisions: the mirror's import
-- gives a WikiOS revision a new id with its older time. The backfill runs only when the column is added, so a re-run
-- never touches what the code wrote since. A row is classic only when it carries a MediaWiki id that it came in with:
-- api.php's trigger (prisma/manual-migrations/2026-09-30-wikios-api.sql) gave a MediaWiki row revId = mwRevId, while
-- a WikiOS save keeps its own sequence revId after the mirror stamps it. A row a WikiOS save queued for the mirror stays
-- wikios as well (finished jobs are purged after a month, so that alone could not tell). Without revId (the api.php SQL
-- not applied, so WikiOS never took a save), the MediaWiki id and the jobs decide. The author is no signal: imported
-- classic rows are tagged with the account holding their editor's claim.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = 'wiki_revisions' AND column_name = 'origin'
    ) THEN
        ALTER TABLE "wiki_revisions" ADD COLUMN "origin" TEXT NOT NULL DEFAULT 'wikios';
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = current_schema() AND table_name = 'wiki_revisions' AND column_name = 'revId'
        ) THEN
            UPDATE "wiki_revisions" r SET "origin" = 'classic'
            WHERE r."mwRevId" IS NOT NULL
              AND r."revId" = r."mwRevId"
              AND NOT EXISTS (
                  SELECT 1 FROM "wiki_mirror_jobs" j WHERE j."kind" = 'revision' AND j."revisionId" = r."id"
              );
        ELSE
            UPDATE "wiki_revisions" r SET "origin" = 'classic'
            WHERE r."mwRevId" IS NOT NULL
              AND NOT EXISTS (
                  SELECT 1 FROM "wiki_mirror_jobs" j WHERE j."kind" = 'revision' AND j."revisionId" = r."id"
              );
        END IF;
    END IF;
END $$;

COMMIT;
