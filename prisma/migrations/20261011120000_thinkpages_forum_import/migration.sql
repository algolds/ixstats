-- ThinkPages forum phase 4: XenForo import (docs/superpowers/plans/2026-10-09-thinkpages-forum-phase-4.md, Task 1).
-- Additive and idempotent. Imported threads and posts whose XenForo author has no IxStats account keep a null
-- author, the XenForo name and the XenForo user id (Q3). Dropping NOT NULL on an already nullable column is a no-op.

ALTER TABLE "forum_threads" ALTER COLUMN "authorUserId" DROP NOT NULL;
ALTER TABLE "forum_posts" ALTER COLUMN "authorUserId" DROP NOT NULL;

-- forum_posts already has its imported name (phase 1).
ALTER TABLE "forum_threads" ADD COLUMN IF NOT EXISTS "importedAuthorName" TEXT;
ALTER TABLE "forum_threads" ADD COLUMN IF NOT EXISTS "xenforoUserId" INTEGER;
ALTER TABLE "forum_posts" ADD COLUMN IF NOT EXISTS "xenforoUserId" INTEGER;

CREATE INDEX IF NOT EXISTS "forum_threads_xenforoUserId_idx" ON "forum_threads"("xenforoUserId");
CREATE INDEX IF NOT EXISTS "forum_posts_xenforoUserId_idx" ON "forum_posts"("xenforoUserId");

-- Ruling R4 (p2 deferred item): the directory's "posts this week" scans forum_posts by date, and the import
-- multiplies the row count.
CREATE INDEX IF NOT EXISTS "forum_posts_createdAt_idx" ON "forum_posts"("createdAt");
