-- ThinkPages forum phase 2: realm sections (docs/superpowers/plans/2026-10-08-thinkpages-forum-phase-2.md).
-- Additive and idempotent: archive source refs on threads and posts, plus the three seeded categories per realm.

ALTER TABLE "forum_threads" ADD COLUMN IF NOT EXISTS "sourceRef" TEXT;
ALTER TABLE "forum_posts" ADD COLUMN IF NOT EXISTS "sourceRef" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "forum_threads_sourceRef_key" ON "forum_threads"("sourceRef");
CREATE UNIQUE INDEX IF NOT EXISTS "forum_posts_sourceRef_key" ON "forum_posts"("sourceRef");

-- Realm categories (src/lib/thinkpages-forum/categories.ts, REALM_CATEGORIES), one set per realm plus IxWorld, whose
-- realmId is "default" even when it has no realms row. The (scope, realmId, key) index holds because realmId is not
-- NULL here; re-runs skip rows that exist.
INSERT INTO "forum_categories" ("id", "scope", "realmId", "key", "name", "description", "order", "visibility", "postRole", "icAllowed")
SELECT gen_random_uuid()::text, 'realm', r."id", c."key", c."name", c."description", c."ord", 'public', 'any', c."ic"
FROM (SELECT "id" FROM "realms" UNION SELECT 'default') AS r
CROSS JOIN (VALUES
  ('hub', 'Hub', 'Out-of-character talk for the realm.', 10, false),
  ('character-threads', 'Character Threads', 'In-character stories and correspondence.', 20, true),
  ('current-events', 'Current Events', 'In-character news from the realm''s nations.', 30, true)
) AS c("key", "name", "description", "ord", "ic")
ON CONFLICT ("scope", "realmId", "key") DO NOTHING;
