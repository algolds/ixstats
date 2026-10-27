-- ThinkPages forum Find a Realm adverts (docs/superpowers/specs/2026-10-10-thinkpages-forum-realm-adverts-design.md, section 1).
-- Hand-written, additive and idempotent: safe to re-apply. Everything here is expressible in Prisma (the unique index and the
-- foreign key are in the schema too), so a `db push` does not drop any of it.

-- The realm a thread advertises. At most one advert per realm (the unique index; NULLs are distinct, so every other thread,
-- imported ones included, keeps NULL). The advert is cleared, not cascaded, when its realm goes.
ALTER TABLE "forum_threads" ADD COLUMN IF NOT EXISTS "advertRealmId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "forum_threads_advertRealmId_key" ON "forum_threads"("advertRealmId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'forum_threads_advertRealmId_fkey') THEN
    ALTER TABLE "forum_threads" ADD CONSTRAINT "forum_threads_advertRealmId_fkey"
      FOREIGN KEY ("advertRealmId") REFERENCES "realms"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
