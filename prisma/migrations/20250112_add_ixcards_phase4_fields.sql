-- IxCards Phase 4: NS Importer + Economy Integration
-- Adds checkpoint system, budget multipliers, and card value tracking
-- SAFE: Only adds new fields/tables, does not drop anything

-- 1. Add metadata field to SyncLog (if not exists)
ALTER TABLE "sync_logs"
ADD COLUMN IF NOT EXISTS "metadata" TEXT;

-- 2. Create SyncCheckpoint table (if not exists)
CREATE TABLE IF NOT EXISTS "sync_checkpoints" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "season" INTEGER NOT NULL UNIQUE,
    "status" TEXT NOT NULL,
    "cardsProcessed" INTEGER NOT NULL DEFAULT 0,
    "totalCards" INTEGER NOT NULL,
    "lastProcessedCardId" TEXT,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastCheckpointAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "metadata" JSONB
);

-- Create indexes for SyncCheckpoint
CREATE INDEX IF NOT EXISTS "sync_checkpoints_season_status_idx" ON "sync_checkpoints"("season", "status");

-- 3. Add vaultMultiplier to SubBudgetCategory (if not exists)
ALTER TABLE "SubBudgetCategory"
ADD COLUMN IF NOT EXISTS "vaultMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.0;

-- 4. Create CardValueHistory table (if not exists)
CREATE TABLE IF NOT EXISTS "card_value_history" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cardId" TEXT NOT NULL,
    "marketValue" DOUBLE PRECISION NOT NULL,
    "totalSupply" INTEGER,
    "ownedBy" INTEGER NOT NULL DEFAULT 0,
    "avgSalePrice" DOUBLE PRECISION,
    "highestSale" DOUBLE PRECISION,
    "lowestSale" DOUBLE PRECISION,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "card_value_history_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "cards"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Create indexes for CardValueHistory
CREATE INDEX IF NOT EXISTS "card_value_history_cardId_timestamp_idx" ON "card_value_history"("cardId", "timestamp");
CREATE INDEX IF NOT EXISTS "card_value_history_timestamp_idx" ON "card_value_history"("timestamp");

-- Verification: Show what was added
DO $$
BEGIN
    RAISE NOTICE 'Migration complete! Added:';
    RAISE NOTICE '- SyncCheckpoint table with 2 indexes';
    RAISE NOTICE '- CardValueHistory table with 2 indexes';
    RAISE NOTICE '- SubBudgetCategory.vaultMultiplier column';
    RAISE NOTICE '- SyncLog.metadata column';
    RAISE NOTICE '';
    RAISE NOTICE 'No existing data was modified or dropped.';
END $$;
