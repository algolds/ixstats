-- Card categories (docs/superpowers/specs/2026-10-23-card-categories-design.md): who set each lore card's category,
-- the classifier's confidence, the review flag and reviewer, and players' category suggestions. Hand-written,
-- additive and idempotent: safe to re-run, and a no-op on a database that already has it. It runs after the Phase 4
-- economy SQL and before `db push`; on a fresh database it runs after the push, where every statement is a no-op.
-- The categories themselves are written by scripts/cards/backfill-card-categories.ts, not here.
--
--   docker exec -i ixstats-postgres psql -U postgres -d <database> -v ON_ERROR_STOP=1 \
--     < prisma/migrations/20261102120000_cards_categories/migration.sql

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CardCategorySource') THEN
    CREATE TYPE "CardCategorySource" AS ENUM ('CLASSIFIER', 'ADMIN', 'REALM_OWNER', 'SUGGESTION');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CardCategorySuggestionStatus') THEN
    CREATE TYPE "CardCategorySuggestionStatus" AS ENUM ('PENDING', 'ACCEPTED', 'CHANGED', 'REJECTED');
  END IF;
END $$;

ALTER TABLE "cards" ADD COLUMN IF NOT EXISTS "categorySource" "CardCategorySource";
ALTER TABLE "cards" ADD COLUMN IF NOT EXISTS "categoryConfidence" DOUBLE PRECISION;
ALTER TABLE "cards" ADD COLUMN IF NOT EXISTS "categoryNeedsReview" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "cards" ADD COLUMN IF NOT EXISTS "categoryReviewedAt" TIMESTAMP(3);
ALTER TABLE "cards" ADD COLUMN IF NOT EXISTS "categoryReviewedBy" TEXT;
-- The filters' counts (Explore groups its catalogue by type and category) and the review queue.
CREATE INDEX IF NOT EXISTS "cards_cardType_category_idx" ON "cards" ("cardType", "category");
CREATE INDEX IF NOT EXISTS "cards_categoryNeedsReview_categoryConfidence_idx"
  ON "cards" ("categoryNeedsReview", "categoryConfidence");

CREATE TABLE IF NOT EXISTS "card_category_suggestions" (
  "id" TEXT NOT NULL,
  "cardId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "category" "LoreCategory" NOT NULL,
  "subcategory" TEXT,
  "note" VARCHAR(500),
  "status" "CardCategorySuggestionStatus" NOT NULL DEFAULT 'PENDING',
  "reviewedBy" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "card_category_suggestions_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'card_category_suggestions_cardId_fkey') THEN
    ALTER TABLE "card_category_suggestions" ADD CONSTRAINT "card_category_suggestions_cardId_fkey"
      FOREIGN KEY ("cardId") REFERENCES "cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "card_category_suggestions_status_createdAt_idx"
  ON "card_category_suggestions" ("status", "createdAt");
CREATE INDEX IF NOT EXISTS "card_category_suggestions_cardId_status_idx"
  ON "card_category_suggestions" ("cardId", "status");
CREATE INDEX IF NOT EXISTS "card_category_suggestions_userId_createdAt_idx"
  ON "card_category_suggestions" ("userId", "createdAt");

COMMIT;
