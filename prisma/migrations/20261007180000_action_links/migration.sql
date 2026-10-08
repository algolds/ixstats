-- Action-linked posts and story chains (docs/superpowers/specs/2026-10-07-action-linked-posts-design.md).
-- Additive and idempotent: one new table, new nullable/defaulted columns on storylines.

CREATE TABLE IF NOT EXISTS "post_action_links" (
    "id" TEXT NOT NULL,
    "postSource" TEXT NOT NULL,
    "postRef" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,
    "storylineId" TEXT,
    "chainOrder" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "post_action_links_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "post_action_links_postSource_postRef_activityId_key"
    ON "post_action_links"("postSource", "postRef", "activityId");
CREATE INDEX IF NOT EXISTS "post_action_links_activityId_idx" ON "post_action_links"("activityId");
CREATE INDEX IF NOT EXISTS "post_action_links_storylineId_idx" ON "post_action_links"("storylineId");
CREATE INDEX IF NOT EXISTS "post_action_links_postSource_postRef_idx" ON "post_action_links"("postSource", "postRef");

DO $$ BEGIN
  ALTER TABLE "post_action_links" ADD CONSTRAINT "post_action_links_activityId_fkey"
    FOREIGN KEY ("activityId") REFERENCES "ActivityFeed"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "post_action_links" ADD CONSTRAINT "post_action_links_storylineId_fkey"
    FOREIGN KEY ("storylineId") REFERENCES "storylines"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "storylines" ADD COLUMN IF NOT EXISTS "kind" TEXT NOT NULL DEFAULT 'map';
ALTER TABLE "storylines" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'open';
ALTER TABLE "storylines" ADD COLUMN IF NOT EXISTS "reviewedBy" TEXT;
ALTER TABLE "storylines" ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP(3);
ALTER TABLE "storylines" ADD COLUMN IF NOT EXISTS "reviewNote" TEXT;
ALTER TABLE "storylines" ADD COLUMN IF NOT EXISTS "wikiPageTitle" TEXT;
ALTER TABLE "storylines" ADD COLUMN IF NOT EXISTS "wikiSyncedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "storylines_kind_status_idx" ON "storylines"("kind", "status");
