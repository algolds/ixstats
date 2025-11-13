-- IxCards Phase 4: Lore Card Request System + Activity Feed
-- Adds LoreCardRequest and Activity models for user-requested lore cards and activity tracking
-- SAFE: Only adds new tables, does not drop anything

-- 1. Create LoreCardRequest table
CREATE TABLE IF NOT EXISTS "lore_card_requests" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "wikiSource" TEXT NOT NULL,
    "articleTitle" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "costPaid" DOUBLE PRECISION NOT NULL DEFAULT 50.0,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "rejectionReason" TEXT,
    "generatedCardId" TEXT,
    CONSTRAINT "lore_card_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Create indexes for LoreCardRequest
CREATE INDEX IF NOT EXISTS "lore_card_requests_userId_status_idx" ON "lore_card_requests"("userId", "status");
CREATE INDEX IF NOT EXISTS "lore_card_requests_status_requestedAt_idx" ON "lore_card_requests"("status", "requestedAt");
CREATE INDEX IF NOT EXISTS "lore_card_requests_wikiSource_articleTitle_idx" ON "lore_card_requests"("wikiSource", "articleTitle");

-- 2. Create Activity table
CREATE TABLE IF NOT EXISTS "activities" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "activityType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isRead" BOOLEAN NOT NULL DEFAULT false
);

-- Create indexes for Activity
CREATE INDEX IF NOT EXISTS "activities_userId_timestamp_idx" ON "activities"("userId", "timestamp");
CREATE INDEX IF NOT EXISTS "activities_userId_isRead_idx" ON "activities"("userId", "isRead");
CREATE INDEX IF NOT EXISTS "activities_activityType_timestamp_idx" ON "activities"("activityType", "timestamp");

-- Verification: Show what was added
DO $$
BEGIN
    RAISE NOTICE 'Migration complete! Added:';
    RAISE NOTICE '- LoreCardRequest table with 3 indexes and foreign key to User';
    RAISE NOTICE '- Activity table with 3 indexes';
    RAISE NOTICE '';
    RAISE NOTICE 'No existing data was modified or dropped.';
END $$;
