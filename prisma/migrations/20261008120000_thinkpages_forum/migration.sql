-- ThinkPages forum phase 1 (docs/superpowers/specs/2026-10-07-forum-concept-b-thinkpages-forum-design.md).
-- Additive and idempotent: three new tables, plus the seeded sitewide categories.

CREATE TABLE IF NOT EXISTS "forum_categories" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'site',
    "realmId" TEXT,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "visibility" TEXT NOT NULL DEFAULT 'public',
    "postRole" TEXT NOT NULL DEFAULT 'any',
    "icAllowed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "forum_categories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "forum_threads" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "authorPersonaId" TEXT,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "postCount" INTEGER NOT NULL DEFAULT 0,
    "lastPostAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "xenforoThreadId" INTEGER,
    CONSTRAINT "forum_threads_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "forum_posts" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "authorPersonaId" TEXT,
    "contentHtml" TEXT NOT NULL,
    "plainText" TEXT NOT NULL,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "editedAt" TIMESTAMP(3),
    "importedAuthorName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "xenforoPostId" INTEGER,
    CONSTRAINT "forum_posts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "forum_categories_scope_realmId_key_key" ON "forum_categories"("scope", "realmId", "key");
CREATE INDEX IF NOT EXISTS "forum_categories_scope_realmId_order_idx" ON "forum_categories"("scope", "realmId", "order");
-- NULLs are distinct in a unique index, so the composite key above cannot stop duplicate sitewide keys (realmId NULL).
CREATE UNIQUE INDEX IF NOT EXISTS "forum_categories_site_key_unique" ON "forum_categories"("key") WHERE "scope" = 'site';

CREATE UNIQUE INDEX IF NOT EXISTS "forum_threads_xenforoThreadId_key" ON "forum_threads"("xenforoThreadId");
CREATE INDEX IF NOT EXISTS "forum_threads_categoryId_pinned_lastPostAt_idx" ON "forum_threads"("categoryId", "pinned", "lastPostAt");

CREATE UNIQUE INDEX IF NOT EXISTS "forum_posts_xenforoPostId_key" ON "forum_posts"("xenforoPostId");
CREATE INDEX IF NOT EXISTS "forum_posts_threadId_createdAt_idx" ON "forum_posts"("threadId", "createdAt");
CREATE INDEX IF NOT EXISTS "forum_posts_authorUserId_idx" ON "forum_posts"("authorUserId");

DO $$ BEGIN
  ALTER TABLE "forum_threads" ADD CONSTRAINT "forum_threads_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "forum_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "forum_posts" ADD CONSTRAINT "forum_posts_threadId_fkey"
    FOREIGN KEY ("threadId") REFERENCES "forum_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Sitewide categories (src/lib/thinkpages-forum/categories.ts). Re-runs skip rows that exist.
INSERT INTO "forum_categories" ("id", "scope", "key", "name", "description", "order", "visibility", "postRole", "icAllowed")
VALUES (gen_random_uuid()::text, 'site', 'rules', 'Rules', 'How the community works.', 10, 'public', 'staff', false)
ON CONFLICT ("key") WHERE "scope" = 'site' DO NOTHING;
INSERT INTO "forum_categories" ("id", "scope", "key", "name", "description", "order", "visibility", "postRole", "icAllowed")
VALUES (gen_random_uuid()::text, 'site', 'announcements', 'Announcements', 'News from the team.', 20, 'public', 'staff', false)
ON CONFLICT ("key") WHERE "scope" = 'site' DO NOTHING;
INSERT INTO "forum_categories" ("id", "scope", "key", "name", "description", "order", "visibility", "postRole", "icAllowed")
VALUES (gen_random_uuid()::text, 'site', 'reports', 'Reports', 'Report a problem to the team.', 30, 'reporter_staff', 'any', false)
ON CONFLICT ("key") WHERE "scope" = 'site' DO NOTHING;
INSERT INTO "forum_categories" ("id", "scope", "key", "name", "description", "order", "visibility", "postRole", "icAllowed")
VALUES (gen_random_uuid()::text, 'site', 'staff', 'Staff', 'Team discussion.', 40, 'staff', 'any', false)
ON CONFLICT ("key") WHERE "scope" = 'site' DO NOTHING;
INSERT INTO "forum_categories" ("id", "scope", "key", "name", "description", "order", "visibility", "postRole", "icAllowed")
VALUES (gen_random_uuid()::text, 'site', 'find-a-realm', 'Find a Realm', 'Advertise your realm or find one to join.', 50, 'public', 'any', false)
ON CONFLICT ("key") WHERE "scope" = 'site' DO NOTHING;
INSERT INTO "forum_categories" ("id", "scope", "key", "name", "description", "order", "visibility", "postRole", "icAllowed")
VALUES (gen_random_uuid()::text, 'site', 'general', 'General', 'Out-of-character talk about anything.', 60, 'public', 'any', false)
ON CONFLICT ("key") WHERE "scope" = 'site' DO NOTHING;
INSERT INTO "forum_categories" ("id", "scope", "key", "name", "description", "order", "visibility", "postRole", "icAllowed")
VALUES (gen_random_uuid()::text, 'site', 'side-games', 'Side Games', 'Play-by-post games and other things to play.', 70, 'public', 'any', true)
ON CONFLICT ("key") WHERE "scope" = 'site' DO NOTHING;
