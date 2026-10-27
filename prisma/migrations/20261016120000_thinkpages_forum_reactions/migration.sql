-- ThinkPages forum reactions (docs/superpowers/specs/2026-10-10-thinkpages-forum-reactions-design.md, section 1).
-- Hand-written, additive and idempotent: safe to re-apply. Everything here is expressible in Prisma (the primary key, the
-- unique key, the index, the column and both foreign keys are in the schema too), so a `db push` does not drop any of it.

-- A member's one reaction to a post (a thread post or a realm board message): the reaction type is a built-in name or
-- discord:<name>[:<id>].
CREATE TABLE IF NOT EXISTS "forum_post_reactions" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "forum_post_reactions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "forum_post_reactions_postId_userId_key" ON "forum_post_reactions"("postId", "userId");
CREATE INDEX IF NOT EXISTS "forum_post_reactions_postId_type_idx" ON "forum_post_reactions"("postId", "type");

-- The denormalized {type: count} of a post's reactions, rewritten in the same transaction as the reaction row.
ALTER TABLE "forum_posts" ADD COLUMN IF NOT EXISTS "reactionCounts" JSONB NOT NULL DEFAULT '{}';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'forum_post_reactions_postId_fkey') THEN
    ALTER TABLE "forum_post_reactions" ADD CONSTRAINT "forum_post_reactions_postId_fkey"
      FOREIGN KEY ("postId") REFERENCES "forum_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'forum_post_reactions_userId_fkey') THEN
    ALTER TABLE "forum_post_reactions" ADD CONSTRAINT "forum_post_reactions_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
