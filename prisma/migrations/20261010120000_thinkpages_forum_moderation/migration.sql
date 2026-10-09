-- ThinkPages forum phase 3: moderation (docs/superpowers/plans/2026-10-09-thinkpages-forum-phase-3.md).
-- Additive and idempotent: six new tables, their indexes, one foreign key, and append-only rules on the mod log.

CREATE TABLE IF NOT EXISTS "forum_category_moderators" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "grantedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "forum_category_moderators_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "forum_reports" (
    "id" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "reason" VARCHAR(1000) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "handledBy" TEXT,
    "handledAt" TIMESTAMP(3),
    "note" VARCHAR(1000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "forum_reports_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "forum_warnings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "issuedBy" TEXT NOT NULL,
    "reason" VARCHAR(1000) NOT NULL,
    "points" INTEGER NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "categoryId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "revokedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "forum_warnings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "forum_bans" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "scopeId" TEXT,
    "reason" VARCHAR(1000) NOT NULL,
    "issuedBy" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "auto" BOOLEAN NOT NULL DEFAULT false,
    "liftedAt" TIMESTAMP(3),
    "liftedBy" TEXT,
    "sourceRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "forum_bans_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "forum_mod_log" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "scopeId" TEXT,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "forum_mod_log_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "forum_appeals" (
    "id" TEXT NOT NULL,
    "subjectType" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "body" VARCHAR(4000) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "response" VARCHAR(2000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "forum_appeals_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "forum_category_moderators_categoryId_userId_key" ON "forum_category_moderators"("categoryId", "userId");
CREATE INDEX IF NOT EXISTS "forum_category_moderators_userId_idx" ON "forum_category_moderators"("userId");

CREATE INDEX IF NOT EXISTS "forum_reports_status_categoryId_createdAt_idx" ON "forum_reports"("status", "categoryId", "createdAt");
CREATE INDEX IF NOT EXISTS "forum_reports_targetType_targetId_idx" ON "forum_reports"("targetType", "targetId");
CREATE INDEX IF NOT EXISTS "forum_reports_reporterId_idx" ON "forum_reports"("reporterId");

CREATE INDEX IF NOT EXISTS "forum_warnings_userId_expiresAt_idx" ON "forum_warnings"("userId", "expiresAt");
CREATE INDEX IF NOT EXISTS "forum_warnings_categoryId_createdAt_idx" ON "forum_warnings"("categoryId", "createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "forum_bans_sourceRef_key" ON "forum_bans"("sourceRef");
CREATE INDEX IF NOT EXISTS "forum_bans_userId_scope_scopeId_idx" ON "forum_bans"("userId", "scope", "scopeId");
CREATE INDEX IF NOT EXISTS "forum_bans_scope_scopeId_createdAt_idx" ON "forum_bans"("scope", "scopeId", "createdAt");

CREATE INDEX IF NOT EXISTS "forum_mod_log_createdAt_idx" ON "forum_mod_log"("createdAt");
CREATE INDEX IF NOT EXISTS "forum_mod_log_targetType_targetId_idx" ON "forum_mod_log"("targetType", "targetId");
CREATE INDEX IF NOT EXISTS "forum_mod_log_scope_scopeId_createdAt_idx" ON "forum_mod_log"("scope", "scopeId", "createdAt");
CREATE INDEX IF NOT EXISTS "forum_mod_log_actorId_createdAt_idx" ON "forum_mod_log"("actorId", "createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "forum_appeals_subjectType_subjectId_key" ON "forum_appeals"("subjectType", "subjectId");
CREATE INDEX IF NOT EXISTS "forum_appeals_status_createdAt_idx" ON "forum_appeals"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "forum_appeals_userId_idx" ON "forum_appeals"("userId");

DO $$ BEGIN
  ALTER TABLE "forum_category_moderators" ADD CONSTRAINT "forum_category_moderators_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "forum_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Append-only (M16). Re-runs replace the rules. prisma db push does not manage rules; the code guard is the durable one.
CREATE OR REPLACE RULE "forum_mod_log_no_update" AS ON UPDATE TO "forum_mod_log" DO INSTEAD NOTHING;
CREATE OR REPLACE RULE "forum_mod_log_no_delete" AS ON DELETE TO "forum_mod_log" DO INSTEAD NOTHING;
