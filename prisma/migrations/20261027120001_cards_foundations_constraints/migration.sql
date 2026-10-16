-- Cards refresh, Phase 1: the constraints (docs/specs/2026-10-15-cards-refresh-design.md §5.5 step 4). Hand-written
-- and idempotent: a re-run changes nothing. Run it with the app stopped, AFTER
-- `bun scripts/cards/backfill-cards-refresh.ts --apply` and BEFORE `db push`: it converts cards.rarity,
-- cards.cardType and CardPack.cardType to their enums in place (db push would drop and re-add those columns, losing
-- every value) and drops the dead schema, so the push that follows changes nothing here. Its first checks refuse,
-- changing nothing, while the backfill has not run. It is one transaction, so a failure anywhere changes nothing either
-- (prisma db execute already runs a file as one; BEGIN and COMMIT make psql do the same).
--
-- It is one-shot. Every deploy runs this file, so once cards.cardType is the CardType enum and the dead tables are gone
-- it skips the whole conversion: no lock, no DROP TYPE (Phase 4 may bring back enums named TradeStatus or
-- AuctionStatus) and no config DELETE. All of it is one DO block for that reason.
--
-- The Lore natural key is an expression and partial index, which Prisma cannot declare; Prisma 6 leaves such indexes
-- alone, so db push keeps it. A fresh database (db push, then db:bootstrap) passes the gate from the start, so the key
-- is created after the gated block whenever it is missing.
--
--   docker exec -i ixstats-postgres psql -U postgres -d ixstats -v ON_ERROR_STOP=1 \
--     < prisma/migrations/20261027120001_cards_foundations_constraints/migration.sql

BEGIN;

DO $$
DECLARE
  n bigint;
  type_col text;
  rarity_col text;
BEGIN
  <<conversion>>
  BEGIN
    -- 0. The gate: the conversion is done once cards.cardType is the enum and the dead tables are gone.
    EXIT conversion WHEN
      (SELECT udt_name FROM information_schema.columns
       WHERE table_schema = current_schema() AND table_name = 'cards' AND column_name = 'cardType') = 'CardType'
      AND to_regclass('"CraftingHistory"') IS NULL AND to_regclass('"CraftingRecipe"') IS NULL
      AND to_regclass('"CardTrade"') IS NULL AND to_regclass('"ns_imports"') IS NULL
      AND to_regclass('"sync_checkpoints"') IS NULL;

    -- 1. Refuse until the additive SQL and the backfill have run. Each check applies only while its conversion is to
    --    come.
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = current_schema() AND table_name = 'cards' AND column_name = 'realmId') THEN
      RAISE EXCEPTION 'cards refresh: cards.realmId is missing; apply 20261027120000_cards_foundations first';
    END IF;
    SELECT count(*) INTO n FROM "cards" WHERE "realmId" IS NULL;
    IF n > 0 THEN
      RAISE EXCEPTION 'cards refresh: % cards have no realmId; run scripts/cards/backfill-cards-refresh.ts --apply first', n;
    END IF;
    SELECT count(*) INTO n FROM "cards" c WHERE NOT EXISTS (SELECT 1 FROM "realms" r WHERE r."id" = c."realmId");
    IF n > 0 THEN
      RAISE EXCEPTION 'cards refresh: % cards point at a realm that does not exist; run the backfill (it seeds the system realms) first', n;
    END IF;

    SELECT udt_name INTO type_col FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = 'cards' AND column_name = 'cardType';
    IF type_col = 'text' THEN
      SELECT count(*) INTO n FROM "cards" WHERE "cardType" NOT IN ('LORE', 'NATION', 'NS', 'SPECIAL', 'TROPHY');
      IF n > 0 THEN RAISE EXCEPTION 'cards refresh: % cards carry a pre-refresh cardType; run the backfill first', n; END IF;
      SELECT count(*) INTO n FROM "CardPack"
        WHERE "cardType" IS NOT NULL AND "cardType" NOT IN ('LORE', 'NATION', 'NS', 'SPECIAL', 'TROPHY');
      IF n > 0 THEN RAISE EXCEPTION 'cards refresh: % packs carry a pre-refresh cardType; run the backfill first', n; END IF;
    END IF;

    SELECT udt_name INTO rarity_col FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = 'cards' AND column_name = 'rarity';
    IF rarity_col = 'text' THEN
      SELECT count(*) INTO n FROM "cards"
        WHERE "rarity" NOT IN ('COMMON', 'UNCOMMON', 'RARE', 'ULTRA_RARE', 'EPIC', 'LEGENDARY');
      IF n > 0 THEN RAISE EXCEPTION 'cards refresh: % cards carry a pre-refresh rarity; run the backfill first', n; END IF;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
               WHERE t.typname = 'LoreCategory' AND e.enumlabel = 'NS_IMPORT') THEN
      SELECT count(*) INTO n FROM "cards" WHERE "category"::text = 'NS_IMPORT';
      IF n > 0 THEN RAISE EXCEPTION 'cards refresh: % cards still have the NS_IMPORT category; run the backfill first', n; END IF;
      SELECT count(*) INTO n FROM "lore_card_requests" WHERE "category"::text = 'NS_IMPORT';
      IF n > 0 THEN RAISE EXCEPTION 'cards refresh: % lore requests still have the NS_IMPORT category; run the backfill first', n; END IF;
    END IF;

    SELECT count(*) INTO n FROM (
      SELECT 1 FROM "CardOwnership" GROUP BY "cardId", "serialNumber" HAVING count(*) > 1
    ) collisions;
    IF n > 0 THEN RAISE EXCEPTION 'cards refresh: % serial numbers are shared by two copies; run the backfill first', n; END IF;

    SELECT count(*) INTO n FROM (
      SELECT 1 FROM "cards"
      WHERE "cardType"::text = 'LORE' AND "wikiArticleTitle" IS NOT NULL
      GROUP BY COALESCE("wikiSource", 'ixwiki'), lower("wikiArticleTitle") HAVING count(*) > 1
    ) duplicates;
    IF n > 0 THEN RAISE EXCEPTION 'cards refresh: % articles have two Lore cards; run the backfill first', n; END IF;

    -- Nothing step 7 drops may be lost: an NS card's stats and nsData live on in metadata.nsData, and an artworkUrl in
    -- a blank artwork (backfill steps 5 and 10). Each check runs while its source column exists.
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = current_schema() AND table_name = 'cards' AND column_name = 'stats') THEN
      SELECT count(*) INTO n FROM "cards"
        WHERE "cardType"::text IN ('NS', 'NS_IMPORT') AND jsonb_typeof("metadata"->'nsData') IS DISTINCT FROM 'object'
          AND "stats" IS NOT NULL AND "stats" NOT IN ('{}'::jsonb, '[]'::jsonb, 'null'::jsonb);
      IF n > 0 THEN RAISE EXCEPTION 'cards refresh: % NS cards have stats but no metadata.nsData; run the backfill first', n; END IF;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = current_schema() AND table_name = 'cards' AND column_name = 'nsData') THEN
      SELECT count(*) INTO n FROM "cards"
        WHERE "cardType"::text IN ('NS', 'NS_IMPORT') AND jsonb_typeof("metadata"->'nsData') IS DISTINCT FROM 'object'
          AND "nsData" IS NOT NULL;
      IF n > 0 THEN RAISE EXCEPTION 'cards refresh: % NS cards have nsData but no metadata.nsData; run the backfill first', n; END IF;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = current_schema() AND table_name = 'cards' AND column_name = 'artworkUrl') THEN
      SELECT count(*) INTO n FROM "cards"
        WHERE "artworkUrl" ~ '\S' AND ("artwork" IS NULL OR "artwork" !~ '\S');
      IF n > 0 THEN RAISE EXCEPTION 'cards refresh: % cards have an artworkUrl but no artwork; run the backfill first', n; END IF;
    END IF;

    -- 2. The refreshed CardType. The pre-refresh type (NATION, LORE, NS_IMPORT, SPECIAL, COMMUNITY) is used by no
    --    column.
    IF EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
               WHERE t.typname = 'CardType' AND e.enumlabel = 'NS_IMPORT') THEN
      DROP TYPE "CardType";
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CardType') THEN
      CREATE TYPE "CardType" AS ENUM ('LORE', 'NATION', 'NS', 'SPECIAL', 'TROPHY');
    END IF;

    -- 3. Type and rarity strings become enums, in place.
    IF (SELECT udt_name FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = 'cards' AND column_name = 'cardType') = 'text' THEN
      ALTER TABLE "cards" ALTER COLUMN "cardType" TYPE "CardType" USING ("cardType"::"CardType");
    END IF;
    IF (SELECT udt_name FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = 'CardPack' AND column_name = 'cardType') = 'text' THEN
      ALTER TABLE "CardPack" ALTER COLUMN "cardType" TYPE "CardType" USING ("cardType"::"CardType");
    END IF;
    IF (SELECT udt_name FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = 'cards' AND column_name = 'rarity') = 'text' THEN
      ALTER TABLE "cards" ALTER COLUMN "rarity" TYPE "CardRarity" USING ("rarity"::"CardRarity");
    END IF;

    -- 4. LoreCategory without NS_IMPORT (Postgres cannot drop an enum value: swap the type).
    ALTER TABLE "cards" ALTER COLUMN "category" DROP DEFAULT;
    IF EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
               WHERE t.typname = 'LoreCategory' AND e.enumlabel = 'NS_IMPORT') THEN
      ALTER TYPE "LoreCategory" RENAME TO "LoreCategory_old";
      CREATE TYPE "LoreCategory" AS ENUM ('MILITARY', 'DIPLOMACY', 'GEOGRAPHY', 'RELIGION', 'CULTURE', 'GOVERNMENT',
        'PEOPLE', 'ECONOMY', 'SCIENCE', 'HISTORY', 'NATION', 'SPECIAL');
      ALTER TABLE "cards" ALTER COLUMN "category" TYPE "LoreCategory" USING ("category"::text::"LoreCategory");
      ALTER TABLE "lore_card_requests" ALTER COLUMN "category" TYPE "LoreCategory" USING ("category"::text::"LoreCategory");
      DROP TYPE "LoreCategory_old";
    END IF;

    -- 5. Every card has a home realm; a realm with cards cannot be deleted.
    ALTER TABLE "cards" ALTER COLUMN "realmId" SET NOT NULL;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cards_realmId_fkey') THEN
      ALTER TABLE "cards" ADD CONSTRAINT "cards_realmId_fkey"
        FOREIGN KEY ("realmId") REFERENCES "realms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    -- 6. One serial per copy of a card (the Lore natural key follows the block).
    CREATE UNIQUE INDEX IF NOT EXISTS "CardOwnership_cardId_serialNumber_key" ON "CardOwnership"("cardId", "serialNumber");

    -- 7. The dead columns.
    DROP INDEX IF EXISTS "CardOwnership_userId_idx";
    ALTER TABLE "CardOwnership"
      DROP COLUMN IF EXISTS "userId",
      DROP COLUMN IF EXISTS "lastSalePrice",
      DROP COLUMN IF EXISTS "lastSaleDate",
      DROP COLUMN IF EXISTS "quantity";
    ALTER TABLE "cards"
      DROP COLUMN IF EXISTS "stats",
      DROP COLUMN IF EXISTS "attributes",
      DROP COLUMN IF EXISTS "enhancements",
      DROP COLUMN IF EXISTS "level",
      DROP COLUMN IF EXISTS "artworkVariants",
      DROP COLUMN IF EXISTS "wikiPageId",
      DROP COLUMN IF EXISTS "wikiImageUrl",
      DROP COLUMN IF EXISTS "name",
      DROP COLUMN IF EXISTS "artworkUrl",
      DROP COLUMN IF EXISTS "nsData";
    ALTER TABLE "CardPack" DROP COLUMN IF EXISTS "pdsConfig";
    ALTER TABLE "User"
      DROP COLUMN IF EXISTS "totalCards",
      DROP COLUMN IF EXISTS "deckValue",
      DROP COLUMN IF EXISTS "collectorLevel",
      DROP COLUMN IF EXISTS "collectorXp";

    -- 8. The dead tables and enums.
    DROP TABLE IF EXISTS "CraftingHistory";
    DROP TABLE IF EXISTS "CraftingRecipe";
    DROP TABLE IF EXISTS "CardTrade";
    DROP TABLE IF EXISTS "ns_imports";
    DROP TABLE IF EXISTS "sync_checkpoints";
    DROP TYPE IF EXISTS "AcquireMethod";
    DROP TYPE IF EXISTS "AuctionStatus";
    DROP TYPE IF EXISTS "TradeStatus";

    -- 9. Config nothing reads any more: five unread card_system_* keys, and junk's two.
    DELETE FROM "SystemConfig" WHERE "key" IN (
      'card_system_trading_enabled', 'card_system_daily_free_packs', 'card_system_daily_pack_cooldown_hours',
      'card_system_allow_player_minting', 'card_system_auto_lore_thumbnails',
      'card_system_max_junk_batch_size', 'card_valuation_junk_rate'
    );
  END conversion;

  -- 6b. One Lore card per article (wiki, lower-cased canonical title). Checked first, so a re-run takes no lock.
  IF to_regclass('cards_lore_natural_key') IS NULL THEN
    CREATE UNIQUE INDEX IF NOT EXISTS "cards_lore_natural_key"
      ON "cards" (COALESCE("wikiSource", 'ixwiki'), lower("wikiArticleTitle"))
      WHERE "cardType" = 'LORE';
  END IF;
END $$;

COMMIT;
