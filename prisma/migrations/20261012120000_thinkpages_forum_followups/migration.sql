-- ThinkPages forum follow-ups (M7, M8, M11, N5; .superpowers/sdd/followups/forum-followups.md). Hand-written,
-- additive and idempotent: safe to re-apply. Apply it before (or with) the code that reads the new columns: until
-- the backfill below has run, older appeals show only to site admins and older reports are not yet attributed.

-- M7: an appeal carries its subject's scope, in ForumBan/ForumModLog form ('site' | 'realm' | 'category' and the
-- realm or category id), so the scoped appeal queue filters appeals directly instead of reading every appeal of a
-- status. A ban's scope is its own; a warning's is its category ('category') or the site.
ALTER TABLE "forum_appeals" ADD COLUMN IF NOT EXISTS "scope" TEXT;
ALTER TABLE "forum_appeals" ADD COLUMN IF NOT EXISTS "scopeId" TEXT;

UPDATE "forum_appeals" AS a
SET "scope" = b."scope", "scopeId" = b."scopeId"
FROM "forum_bans" AS b
WHERE a."subjectType" = 'ban' AND a."subjectId" = b."id" AND a."scope" IS NULL;

UPDATE "forum_appeals" AS a
SET "scope" = CASE WHEN w."categoryId" IS NULL THEN 'site' ELSE 'category' END, "scopeId" = w."categoryId"
FROM "forum_warnings" AS w
WHERE a."subjectType" = 'warning' AND a."subjectId" = w."id" AND a."scope" IS NULL;

CREATE INDEX IF NOT EXISTS "forum_appeals_scope_scopeId_status_createdAt_idx" ON "forum_appeals"("scope", "scopeId", "status", "createdAt");

-- M8: a report carries its target's author (null for imported content without an IxStats author, or a target that is
-- gone), so a moderator's queue leaves out reports about their own content without scanning the report history.
ALTER TABLE "forum_reports" ADD COLUMN IF NOT EXISTS "targetAuthorId" TEXT;

UPDATE "forum_reports" AS r
SET "targetAuthorId" = t."authorUserId"
FROM "forum_threads" AS t
WHERE r."targetType" = 'thread' AND r."targetId" = t."id" AND r."targetAuthorId" IS NULL AND t."authorUserId" IS NOT NULL;

UPDATE "forum_reports" AS r
SET "targetAuthorId" = t."authorUserId"
FROM "forum_posts" AS t
WHERE r."targetType" = 'post' AND r."targetId" = t."id" AND r."targetAuthorId" IS NULL AND t."authorUserId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "forum_reports_targetAuthorId_idx" ON "forum_reports"("targetAuthorId");

-- M11: the moderation log is append-only (M16). The phase 3 rules turned a stray UPDATE or DELETE into a silent no-op
-- and left TRUNCATE open; these triggers raise instead, so the attempt fails loudly. prisma db push manages neither
-- rules nor triggers; src/tests/architecture/forum-mod-log-append-only.test.ts guards the code.
DROP RULE IF EXISTS "forum_mod_log_no_update" ON "forum_mod_log";
DROP RULE IF EXISTS "forum_mod_log_no_delete" ON "forum_mod_log";

CREATE OR REPLACE FUNCTION "forum_mod_log_append_only"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'forum_mod_log is append-only: % is not allowed', TG_OP;
END;
$$;

DROP TRIGGER IF EXISTS "forum_mod_log_no_update_delete" ON "forum_mod_log";
CREATE TRIGGER "forum_mod_log_no_update_delete" BEFORE UPDATE OR DELETE ON "forum_mod_log"
  FOR EACH ROW EXECUTE FUNCTION "forum_mod_log_append_only"();

DROP TRIGGER IF EXISTS "forum_mod_log_no_truncate" ON "forum_mod_log";
CREATE TRIGGER "forum_mod_log_no_truncate" BEFORE TRUNCATE ON "forum_mod_log"
  FOR EACH STATEMENT EXECUTE FUNCTION "forum_mod_log_append_only"();

-- N5: sitewide categories have a NULL realmId, so @@unique([scope, realmId, key]) cannot stop duplicate sitewide keys.
-- This partial index (phase 1) has no Prisma form, and prisma db push may drop it as drift; re-create it here.
CREATE UNIQUE INDEX IF NOT EXISTS "forum_categories_site_key_unique" ON "forum_categories"("key") WHERE "scope" = 'site';
