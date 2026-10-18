-- Cards refresh, Phase 4: the economy (docs/specs/2026-10-15-cards-refresh-design.md §2.2 and §2.3). Hand-written and
-- idempotent: safe to re-run, and a no-op on a database that already has it. It runs BEFORE `db push`: it converts
-- TradeOffer.status and CardAuction.status to enums in place (db push would drop and re-add those columns, losing every
-- value) and drops TradeOffer.counterOfferFromId and card_watchlist.targetPrice, which the schema no longer has. On a
-- fresh database it runs after the push, where every statement is a no-op. It needs Phases 1 and 2 first (CardFinish,
-- the transfer events' card and serial, CardTakedownOrigin), and it is one transaction, so a failure changes nothing
-- (prisma db execute already runs a file as one; BEGIN and COMMIT make psql do the same). Stop the app for the window:
-- the old code reads and writes the columns it converts and drops.
--
--   docker exec -i ixstats-postgres psql -U postgres -d ixstats -v ON_ERROR_STOP=1 \
--     < prisma/migrations/20261101120000_cards_economy/migration.sql

BEGIN;

DO $$
DECLARE
  bad_values text;
BEGIN
  -- 1. The status enums.
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TradeOfferStatus') THEN
    CREATE TYPE "TradeOfferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'EXPIRED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CardAuctionStatus') THEN
    CREATE TYPE "CardAuctionStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CardListingStatus') THEN
    CREATE TYPE "CardListingStatus" AS ENUM ('ACTIVE', 'SOLD', 'CANCELLED', 'EXPIRED');
  END IF;

  -- 2. Cards: the first sale of any copy ends an NS card's bank-value term.
  ALTER TABLE "cards" ADD COLUMN IF NOT EXISTS "firstSoldAt" TIMESTAMP(3);

  -- 3. Copies. The signer's display name is frozen at signing; the inscriptions before this phase keep none and show
  -- the signer's current name, so there is no backfill.
  ALTER TABLE "CardOwnership" ADD COLUMN IF NOT EXISTS "inscribedName" TEXT;
  -- An imported NS copy breaks down for the import share of the dust; the import ledger names every one.
  ALTER TABLE "CardOwnership" ADD COLUMN IF NOT EXISTS "importDiscounted" BOOLEAN NOT NULL DEFAULT false;
  UPDATE "CardOwnership" o SET "importDiscounted" = true
    FROM "ns_import_ledger" l WHERE l."ownershipId" = o.id AND o."importDiscounted" = false;
  -- The daily XP cap per copy, and levels stop at 10 (XP is kept). The clamp runs once, on the deploy that adds the
  -- cap's day, so a later and higher level cap is never clamped back.
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = current_schema() AND table_name = 'CardOwnership' AND column_name = 'xpDay') THEN
    ALTER TABLE "CardOwnership" ADD COLUMN IF NOT EXISTS "xpDay" DATE;
    UPDATE "CardOwnership" SET "level" = 10 WHERE "level" > 10;
  END IF;
  ALTER TABLE "CardOwnership" ADD COLUMN IF NOT EXISTS "xpToday" INTEGER NOT NULL DEFAULT 0;

  -- 4. Transfer events. The copy's finish on every row (the market median is per finish): every writer stamps it from
  -- now on, and the rows written before take their copy's finish once, when the column is new, so a later re-run never
  -- labels old events with a finish a fusion upgraded since. The card and serial on the rows written before Phase 2,
  -- so a copy broken down or fused keeps its trail and the serial high-water mark still sees its serial
  -- (serial-number.ts).
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = current_schema()
                   AND table_name = 'card_transfer_events' AND column_name = 'finish') THEN
    ALTER TABLE "card_transfer_events" ADD COLUMN IF NOT EXISTS "finish" "CardFinish";
    UPDATE "card_transfer_events" e SET "finish" = o."finish" FROM "CardOwnership" o WHERE e."ownershipId" = o.id;
  END IF;
  UPDATE "card_transfer_events" e SET "cardId" = o."cardId", "serialNumber" = o."serialNumber"
    FROM "CardOwnership" o WHERE e."ownershipId" = o.id AND (e."cardId" IS NULL OR e."serialNumber" IS NULL);
  -- The sales record reads by card, action and date; the composite also serves the lookups by card.
  DROP INDEX IF EXISTS "card_transfer_events_cardId_idx";
  CREATE INDEX IF NOT EXISTS "card_transfer_events_cardId_action_createdAt_idx"
    ON "card_transfer_events" ("cardId", "action", "createdAt");

  -- 5. Trade offers: a counter-offer edits the same row (proposer and revision), so the old counter link goes.
  ALTER TABLE "TradeOffer" ADD COLUMN IF NOT EXISTS "proposerId" TEXT;
  UPDATE "TradeOffer" SET "proposerId" = "initiatorId" WHERE "proposerId" IS NULL;
  ALTER TABLE "TradeOffer" ALTER COLUMN "proposerId" SET NOT NULL;
  ALTER TABLE "TradeOffer" ADD COLUMN IF NOT EXISTS "revision" INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE "TradeOffer" ADD COLUMN IF NOT EXISTS "isCrossRealm" BOOLEAN NOT NULL DEFAULT false;
  ALTER TABLE "TradeOffer" DROP COLUMN IF EXISTS "counterOfferFromId";
  IF (SELECT data_type FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = 'TradeOffer' AND column_name = 'status') = 'text' THEN
    SELECT string_agg(DISTINCT "status", ', ') INTO bad_values FROM "TradeOffer"
      WHERE "status" NOT IN ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'EXPIRED');
    IF bad_values IS NOT NULL THEN
      RAISE EXCEPTION 'TradeOffer.status holds % (not a TradeOfferStatus); map them first (Phase 4 deploy runbook)',
        bad_values;
    END IF;
    ALTER TABLE "TradeOffer" ALTER COLUMN "status" TYPE "TradeOfferStatus" USING "status"::"TradeOfferStatus";
  END IF;

  -- 6. Auctions. Status becomes an enum.
  IF (SELECT data_type FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = 'CardAuction' AND column_name = 'status') = 'text' THEN
    SELECT string_agg(DISTINCT "status", ', ') INTO bad_values FROM "CardAuction"
      WHERE "status" NOT IN ('ACTIVE', 'COMPLETED', 'CANCELLED');
    IF bad_values IS NOT NULL THEN
      RAISE EXCEPTION 'CardAuction.status holds % (not a CardAuctionStatus); map them first (Phase 4 deploy runbook)',
        bad_values;
    END IF;
    ALTER TABLE "CardAuction" ALTER COLUMN "status" DROP DEFAULT;
    ALTER TABLE "CardAuction" ALTER COLUMN "status" TYPE "CardAuctionStatus" USING "status"::"CardAuctionStatus";
    ALTER TABLE "CardAuction" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';
  END IF;
  -- The fee each auction paid, stored for the refund. Filled once, when the column is new (10 IxC featured, 5 IxC
  -- standard, the fees until now), so a later auction listed at a fee of 0 is never rewritten.
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = current_schema() AND table_name = 'CardAuction'
                   AND column_name = 'listingFee') THEN
    ALTER TABLE "CardAuction" ADD COLUMN IF NOT EXISTS "listingFee" INTEGER NOT NULL DEFAULT 0;
    UPDATE "CardAuction" SET "listingFee" = CASE WHEN "isFeatured" THEN 10 ELSE 5 END;
  END IF;
  -- Breaking down or fusing a copy never erases its auctions (nor a seller's sales): the copy link goes nullable and
  -- SET NULL, and each auction keeps its card and serial. Admin revoke still refuses a copy with any auction
  -- (src/lib/cards/remove-copy.ts). The cascading FK is swapped once; a re-run finds SET NULL and leaves it.
  ALTER TABLE "CardAuction" ALTER COLUMN "cardInstanceId" DROP NOT NULL;
  IF EXISTS (SELECT 1 FROM pg_constraint
             WHERE conname = 'CardAuction_cardInstanceId_fkey' AND conrelid = '"CardAuction"'::regclass
               AND confdeltype = 'c') THEN
    ALTER TABLE "CardAuction" DROP CONSTRAINT "CardAuction_cardInstanceId_fkey";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'CardAuction_cardInstanceId_fkey' AND conrelid = '"CardAuction"'::regclass) THEN
    ALTER TABLE "CardAuction" ADD CONSTRAINT "CardAuction_cardInstanceId_fkey"
      FOREIGN KEY ("cardInstanceId") REFERENCES "CardOwnership"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  ALTER TABLE "CardAuction" ADD COLUMN IF NOT EXISTS "cardId" TEXT;
  ALTER TABLE "CardAuction" ADD COLUMN IF NOT EXISTS "serialNumber" INTEGER;
  UPDATE "CardAuction" a SET "cardId" = o."cardId", "serialNumber" = o."serialNumber"
    FROM "CardOwnership" o WHERE a."cardInstanceId" = o.id AND (a."cardId" IS NULL OR a."serialNumber" IS NULL);
  ALTER TABLE "CardAuction" ALTER COLUMN "cardId" SET NOT NULL;
  ALTER TABLE "CardAuction" ALTER COLUMN "serialNumber" SET NOT NULL;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'CardAuction_cardId_fkey' AND conrelid = '"CardAuction"'::regclass) THEN
    ALTER TABLE "CardAuction" ADD CONSTRAINT "CardAuction_cardId_fkey"
      FOREIGN KEY ("cardId") REFERENCES "cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  CREATE INDEX IF NOT EXISTS "CardAuction_cardId_status_idx" ON "CardAuction" ("cardId", "status");

  -- 7. The wishlist (card_watchlist): targetPrice had no writer, and its one reader (the auction-listed alert) is gone.
  ALTER TABLE "card_watchlist" DROP COLUMN IF EXISTS "targetPrice";

  -- 8. The new tables: fixed-price listings, dust, market prices, per-card mutes and inscription reports.
  CREATE TABLE IF NOT EXISTS "card_listings" (
    "id" TEXT NOT NULL,
    "ownershipId" TEXT,
    "cardId" TEXT NOT NULL,
    "serialNumber" INTEGER NOT NULL,
    "finish" "CardFinish" NOT NULL,
    "sellerId" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "listingFee" INTEGER NOT NULL,
    "status" "CardListingStatus" NOT NULL DEFAULT 'ACTIVE',
    "buyerId" TEXT,
    "soldAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "card_listings_pkey" PRIMARY KEY ("id"),
    -- A listing outlives its copy, as an auction does
    CONSTRAINT "card_listings_ownershipId_fkey" FOREIGN KEY ("ownershipId")
      REFERENCES "CardOwnership"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "card_listings_cardId_fkey" FOREIGN KEY ("cardId")
      REFERENCES "cards"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "card_listings_sellerId_fkey" FOREIGN KEY ("sellerId")
      REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
  );
  CREATE INDEX IF NOT EXISTS "card_listings_status_isFeatured_createdAt_idx"
    ON "card_listings" ("status", "isFeatured", "createdAt");
  CREATE INDEX IF NOT EXISTS "card_listings_status_expiresAt_idx" ON "card_listings" ("status", "expiresAt");
  CREATE INDEX IF NOT EXISTS "card_listings_sellerId_status_idx" ON "card_listings" ("sellerId", "status");
  CREATE INDEX IF NOT EXISTS "card_listings_cardId_status_idx" ON "card_listings" ("cardId", "status");
  CREATE INDEX IF NOT EXISTS "card_listings_ownershipId_idx" ON "card_listings" ("ownershipId");

  CREATE TABLE IF NOT EXISTS "card_dust_balances" (
    "userId" TEXT NOT NULL,
    "realmId" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "card_dust_balances_pkey" PRIMARY KEY ("userId", "realmId"),
    CONSTRAINT "card_dust_balances_userId_fkey" FOREIGN KEY ("userId")
      REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "card_dust_balances_realmId_fkey" FOREIGN KEY ("realmId")
      REFERENCES "realms"("id") ON DELETE CASCADE ON UPDATE CASCADE
  );
  CREATE INDEX IF NOT EXISTS "card_dust_balances_realmId_idx" ON "card_dust_balances" ("realmId");

  CREATE TABLE IF NOT EXISTS "card_dust_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "realmId" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "cardId" TEXT,
    "ownershipId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "card_dust_events_pkey" PRIMARY KEY ("id")
  );
  CREATE INDEX IF NOT EXISTS "card_dust_events_userId_createdAt_idx" ON "card_dust_events" ("userId", "createdAt");

  CREATE TABLE IF NOT EXISTS "card_market_prices" (
    "cardId" TEXT NOT NULL,
    "finish" "CardFinish" NOT NULL,
    "median" DOUBLE PRECISION NOT NULL,
    "sales" INTEGER NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "card_market_prices_pkey" PRIMARY KEY ("cardId", "finish"),
    CONSTRAINT "card_market_prices_cardId_fkey" FOREIGN KEY ("cardId")
      REFERENCES "cards"("id") ON DELETE CASCADE ON UPDATE CASCADE
  );

  CREATE TABLE IF NOT EXISTS "card_notification_mutes" (
    "userId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "card_notification_mutes_pkey" PRIMARY KEY ("userId", "cardId"),
    CONSTRAINT "card_notification_mutes_userId_fkey" FOREIGN KEY ("userId")
      REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "card_notification_mutes_cardId_fkey" FOREIGN KEY ("cardId")
      REFERENCES "cards"("id") ON DELETE CASCADE ON UPDATE CASCADE
  );

  CREATE TABLE IF NOT EXISTS "card_inscription_reports" (
    "id" TEXT NOT NULL,
    "ownershipId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "text" VARCHAR(60) NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "handledBy" TEXT,
    "handledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "card_inscription_reports_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "card_inscription_reports_ownershipId_fkey" FOREIGN KEY ("ownershipId")
      REFERENCES "CardOwnership"("id") ON DELETE CASCADE ON UPDATE CASCADE
  );
  CREATE UNIQUE INDEX IF NOT EXISTS "card_inscription_reports_ownershipId_reporterId_key"
    ON "card_inscription_reports" ("ownershipId", "reporterId");
  CREATE INDEX IF NOT EXISTS "card_inscription_reports_status_createdAt_idx"
    ON "card_inscription_reports" ("status", "createdAt");
END $$;

-- 9. A player's takedown request (for a card not from NationStates) files under its own origin. PostgreSQL 12 and later
-- add an enum value inside a transaction; nothing in this file uses it.
ALTER TYPE "CardTakedownOrigin" ADD VALUE IF NOT EXISTS 'PLAYER_REQUEST';

COMMIT;
