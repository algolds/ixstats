-- ThinkPages realm board (docs/superpowers/specs/2026-10-10-thinkpages-realm-board-design.md §1).
-- Hand-written, additive and idempotent: safe to re-apply. Everything here is expressible in Prisma (the foreign keys and the
-- index are in the schema too), so a `db push` does not drop any of it.

-- Board messages are forum posts: a reply points at another message in the same thread, and a message turned into a thread
-- leaves a placeholder post that links to it. Both links are cleared, not cascaded, when their target goes.
ALTER TABLE "forum_posts" ADD COLUMN IF NOT EXISTS "replyToPostId" TEXT;
ALTER TABLE "forum_posts" ADD COLUMN IF NOT EXISTS "continuedThreadId" TEXT;
CREATE INDEX IF NOT EXISTS "forum_posts_replyToPostId_idx" ON "forum_posts"("replyToPostId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'forum_posts_replyToPostId_fkey') THEN
    ALTER TABLE "forum_posts" ADD CONSTRAINT "forum_posts_replyToPostId_fkey"
      FOREIGN KEY ("replyToPostId") REFERENCES "forum_posts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'forum_posts_continuedThreadId_fkey') THEN
    ALTER TABLE "forum_posts" ADD CONSTRAINT "forum_posts_continuedThreadId_fkey"
      FOREIGN KEY ("continuedThreadId") REFERENCES "forum_threads"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- The realm's emblem and its board settings (visitors may post; slow mode in seconds, 0 = off).
ALTER TABLE "realms" ADD COLUMN IF NOT EXISTS "emblemUrl" TEXT;
ALTER TABLE "realms" ADD COLUMN IF NOT EXISTS "boardVisitorsAllowed" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "realms" ADD COLUMN IF NOT EXISTS "boardSlowModeSeconds" INTEGER NOT NULL DEFAULT 0;

-- One hidden board category per realm plus IxWorld, whose realmId is "default" even when it has no realms row (as the phase 2
-- migration seeds its Hub). Style "board" keeps it out of every forum list (src/lib/thinkpages-forum/categories.ts,
-- isBoardCategory); personas may post on it. Re-runs skip rows that exist.
INSERT INTO "forum_categories" ("id", "scope", "realmId", "key", "name", "description", "order", "visibility", "postRole", "icAllowed", "style")
SELECT gen_random_uuid()::text, 'realm', r."id", 'board', 'Board', 'The realm''s live message board.', 0, 'public', 'any', true, 'board'
FROM (SELECT "id" FROM "realms" UNION SELECT 'default') AS r
WHERE NOT EXISTS (
  SELECT 1 FROM "forum_categories" c WHERE c."scope" = 'realm' AND c."realmId" = r."id" AND c."key" = 'board'
)
ON CONFLICT ("scope", "realmId", "key") DO NOTHING;

UPDATE "forum_categories" SET "style" = 'board'
WHERE "scope" = 'realm' AND "key" = 'board' AND "style" <> 'board';

-- Each board category's one thread, "<Realm> board", with no author. Its sourceRef is unique, so a race or a re-run cannot
-- make a second one.
INSERT INTO "forum_threads" ("id", "categoryId", "title", "authorUserId", "pinned", "sourceRef")
SELECT gen_random_uuid()::text, c."id", LEFT(COALESCE(r."name", 'IxWorld'), 190) || ' board', NULL, false, 'realm_board_thread:' || c."realmId"
FROM "forum_categories" c
LEFT JOIN "realms" r ON r."id" = c."realmId"
WHERE c."scope" = 'realm' AND c."key" = 'board'
  AND NOT EXISTS (SELECT 1 FROM "forum_threads" t WHERE t."categoryId" = c."id")
ON CONFLICT ("sourceRef") DO NOTHING;
