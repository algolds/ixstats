-- Forum action integration, credit rewards (docs/superpowers/specs/2026-10-10-thinkpages-forum-action-integration-design.md, section 5).
-- Hand-written, additive and idempotent: safe to re-apply. Everything here is expressible in Prisma (the primary key, the
-- index, the columns and the foreign key are in the schema too), so a `db push` does not drop any of it.

-- One payout per action, ever: the first post that links an activity pays its reward and records it here. A separate
-- table, not a column on post_action_links, because an edit or a moderator edit deletes link rows and would otherwise
-- reopen the cap slot. The primary key is the "paid once" guarantee; the per-country daily cap counts today's rows.
CREATE TABLE IF NOT EXISTS "forum_action_rewards" (
    "activityId" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "forum_action_rewards_pkey" PRIMARY KEY ("activityId")
);

CREATE INDEX IF NOT EXISTS "forum_action_rewards_countryId_createdAt_idx" ON "forum_action_rewards"("countryId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'forum_action_rewards_activityId_fkey') THEN
    ALTER TABLE "forum_action_rewards" ADD CONSTRAINT "forum_action_rewards_activityId_fkey"
      FOREIGN KEY ("activityId") REFERENCES "ActivityFeed"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
