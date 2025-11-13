-- Add vaultMultiplier column to SubBudgetCategory
-- This multiplier affects passive income calculation (0.5x - 3.0x)

-- Add column with default value of 1.0 (neutral)
ALTER TABLE "SubBudgetCategory" ADD COLUMN IF NOT EXISTS "vaultMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.0;

-- Add comment to column for documentation
COMMENT ON COLUMN "SubBudgetCategory"."vaultMultiplier" IS 'Multiplier for passive income (0.5x - 3.0x). Economic departments boost income, military reduces it.';
