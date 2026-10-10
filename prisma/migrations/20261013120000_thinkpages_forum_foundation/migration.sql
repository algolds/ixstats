-- ThinkPages forum foundation (docs/superpowers/specs/2026-10-09-thinkpages-forum-foundation-design.md §3).
-- Hand-written, additive and idempotent: safe to re-apply. Everything here is expressible in Prisma.

-- IC categories render as WikiOS articles; 'ooc' (default) renders compact.
ALTER TABLE "forum_categories" ADD COLUMN IF NOT EXISTS "style" TEXT NOT NULL DEFAULT 'ooc';
UPDATE "forum_categories" SET "style" = 'ic'
WHERE "scope" = 'realm' AND "key" IN ('character-threads', 'current-events') AND "style" <> 'ic';

-- Canvas posts keep their wikitext (null: an HTML-only post) and how/when it was rendered.
ALTER TABLE "forum_posts" ADD COLUMN IF NOT EXISTS "contentWikitext" TEXT;
ALTER TABLE "forum_posts" ADD COLUMN IF NOT EXISTS "rendererVersion" TEXT;
ALTER TABLE "forum_posts" ADD COLUMN IF NOT EXISTS "renderedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "forum_posts_stale_idx" ON "forum_posts"("renderedAt") WHERE "contentWikitext" IS NOT NULL;

-- Templates (and Lua modules) a post's render used, as MediaWiki titles, for re-rendering when one changes.
CREATE TABLE IF NOT EXISTS "forum_post_templates" (
  "postId" TEXT NOT NULL REFERENCES "forum_posts"("id") ON DELETE CASCADE,
  "title" TEXT NOT NULL,
  PRIMARY KEY ("postId", "title")
);
CREATE INDEX IF NOT EXISTS "forum_post_templates_title_idx" ON "forum_post_templates"("title");
