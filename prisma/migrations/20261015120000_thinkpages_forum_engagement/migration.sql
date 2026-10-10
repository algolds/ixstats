-- ThinkPages forum unread, watch and mentions (docs/superpowers/specs/2026-10-10-thinkpages-forum-unread-notifications-design.md, section 1).
-- Hand-written, additive and idempotent: safe to re-apply. Everything here is expressible in Prisma (the primary keys, the
-- indexes and the foreign keys are in the schema too), so a `db push` does not drop any of it.

-- What a member has read of a thread: the lastPostAt they have seen up to.
CREATE TABLE IF NOT EXISTS "forum_thread_reads" (
    "userId" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "forum_thread_reads_pkey" PRIMARY KEY ("userId", "threadId")
);
CREATE INDEX IF NOT EXISTS "forum_thread_reads_threadId_idx" ON "forum_thread_reads"("threadId");

-- "Mark all read": nothing before this time is unread for the member.
CREATE TABLE IF NOT EXISTS "forum_readers" (
    "userId" TEXT NOT NULL,
    "allReadAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "forum_readers_pkey" PRIMARY KEY ("userId")
);

-- A member watching a thread. notifiedAt is set when a reply notified them and cleared when they next open the thread, so
-- they are told once until they visit.
CREATE TABLE IF NOT EXISTS "forum_thread_watches" (
    "userId" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notifiedAt" TIMESTAMP(3),

    CONSTRAINT "forum_thread_watches_pkey" PRIMARY KEY ("userId", "threadId")
);
CREATE INDEX IF NOT EXISTS "forum_thread_watches_threadId_idx" ON "forum_thread_watches"("threadId");

-- Who a post has already mentioned (the recipient's User.id), so an edit notifies only the mentions it adds.
CREATE TABLE IF NOT EXISTS "forum_post_mentions" (
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "forum_post_mentions_pkey" PRIMARY KEY ("postId", "userId")
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'forum_thread_reads_threadId_fkey') THEN
    ALTER TABLE "forum_thread_reads" ADD CONSTRAINT "forum_thread_reads_threadId_fkey"
      FOREIGN KEY ("threadId") REFERENCES "forum_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'forum_thread_watches_threadId_fkey') THEN
    ALTER TABLE "forum_thread_watches" ADD CONSTRAINT "forum_thread_watches_threadId_fkey"
      FOREIGN KEY ("threadId") REFERENCES "forum_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'forum_post_mentions_postId_fkey') THEN
    ALTER TABLE "forum_post_mentions" ADD CONSTRAINT "forum_post_mentions_postId_fkey"
      FOREIGN KEY ("postId") REFERENCES "forum_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
