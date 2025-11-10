-- CreateEnum
CREATE TYPE "CardType" AS ENUM ('NATION', 'LORE', 'NS_IMPORT', 'SPECIAL', 'COMMUNITY');

-- CreateEnum
CREATE TYPE "CardRarity" AS ENUM ('COMMON', 'UNCOMMON', 'RARE', 'ULTRA_RARE', 'EPIC', 'LEGENDARY');

-- CreateEnum
CREATE TYPE "PackType" AS ENUM ('BASIC', 'PREMIUM', 'ELITE', 'THEMED', 'SEASONAL', 'EVENT');

-- CreateEnum
CREATE TYPE "AcquireMethod" AS ENUM ('PACK', 'TRADE', 'AUCTION', 'CRAFT', 'GIFT', 'NS_IMPORT', 'ACHIEVEMENT', 'EVENT');

-- CreateEnum
CREATE TYPE "AuctionStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TradeStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "VaultTransactionType" AS ENUM ('EARN_PASSIVE', 'EARN_ACTIVE', 'EARN_CARDS', 'EARN_SOCIAL', 'SPEND_PACKS', 'SPEND_MARKET', 'SPEND_CRAFT', 'SPEND_BOOST', 'SPEND_COSMETIC', 'ADMIN_ADJUSTMENT');

-- DropForeignKey
ALTER TABLE "ComponentEffectivenessHistory" DROP CONSTRAINT "ComponentEffectivenessHistory_countryId_fkey";

-- DropForeignKey
ALTER TABLE "DiplomaticRelationshipHistory" DROP CONSTRAINT "DiplomaticRelationshipHistory_country1Id_fkey";

-- DropForeignKey
ALTER TABLE "DiplomaticRelationshipHistory" DROP CONSTRAINT "DiplomaticRelationshipHistory_country2Id_fkey";

-- DropForeignKey
ALTER TABLE "VitalityHistory" DROP CONSTRAINT "VitalityHistory_countryId_fkey";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "collectorLevel" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "collectorXp" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "deckValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "totalCards" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "cities" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "points_of_interest" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "subdivisions" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- DropTable
DROP TABLE "map_layer_altitudes";

-- DropTable
DROP TABLE "map_layer_climate";

-- DropTable
DROP TABLE "map_layer_icecaps";

-- DropTable
DROP TABLE "map_layer_lakes";

-- DropTable
DROP TABLE "map_layer_political";

-- DropTable
DROP TABLE "map_layer_rivers";

-- CreateTable
CREATE TABLE "temp_political_import" (
    "ogc_fid" SERIAL NOT NULL,
    "id" VARCHAR,
    "ixmap_subgroup" VARCHAR,
    "fill" VARCHAR,
    "wkb_geometry" geometry,

    CONSTRAINT "temp_political_import_pkey" PRIMARY KEY ("ogc_fid")
);

-- CreateTable
CREATE TABLE "map_edit_logs" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "changes" JSONB,
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "map_edit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "my_vault" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "credits" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lifetimeEarned" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lifetimeSpent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "vaultLevel" INTEGER NOT NULL DEFAULT 1,
    "vaultXp" INTEGER NOT NULL DEFAULT 0,
    "loginStreak" INTEGER NOT NULL DEFAULT 0,
    "lastLoginDate" TIMESTAMP(3),
    "todayEarned" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastDailyReset" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "my_vault_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vault_transactions" (
    "id" TEXT NOT NULL,
    "vaultId" TEXT NOT NULL,
    "credits" DOUBLE PRECISION NOT NULL,
    "balanceAfter" DOUBLE PRECISION NOT NULL,
    "type" "VaultTransactionType" NOT NULL,
    "source" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vault_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cards" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "artwork" TEXT NOT NULL,
    "artworkVariants" JSONB,
    "cardType" "CardType" NOT NULL,
    "rarity" "CardRarity" NOT NULL,
    "season" INTEGER NOT NULL,
    "nsCardId" INTEGER,
    "nsSeason" INTEGER,
    "wikiSource" TEXT,
    "wikiArticleTitle" TEXT,
    "countryId" TEXT,
    "stats" JSONB NOT NULL,
    "marketValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalSupply" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "enhancements" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_ownership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "acquiredDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acquiredMethod" "AcquireMethod" NOT NULL,
    "isLeveledUp" BOOLEAN NOT NULL DEFAULT false,
    "hasAlternateArt" BOOLEAN NOT NULL DEFAULT false,
    "customizations" JSONB,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "card_ownership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_packs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "artwork" TEXT NOT NULL,
    "cardCount" INTEGER NOT NULL DEFAULT 5,
    "packType" "PackType" NOT NULL,
    "priceCredits" DOUBLE PRECISION NOT NULL,
    "commonOdds" DOUBLE PRECISION NOT NULL DEFAULT 65,
    "uncommonOdds" DOUBLE PRECISION NOT NULL DEFAULT 25,
    "rareOdds" DOUBLE PRECISION NOT NULL DEFAULT 7,
    "ultraRareOdds" DOUBLE PRECISION NOT NULL DEFAULT 2,
    "epicOdds" DOUBLE PRECISION NOT NULL DEFAULT 0.9,
    "legendaryOdds" DOUBLE PRECISION NOT NULL DEFAULT 0.1,
    "season" INTEGER,
    "cardType" "CardType",
    "themeFilter" JSONB,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "limitedQuantity" INTEGER,
    "purchaseLimit" INTEGER,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "card_packs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_packs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "isOpened" BOOLEAN NOT NULL DEFAULT false,
    "openedAt" TIMESTAMP(3),
    "acquiredDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acquiredMethod" TEXT NOT NULL,

    CONSTRAINT "user_packs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_collections" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "slug" TEXT NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "theme" TEXT,
    "sortOrder" TEXT NOT NULL DEFAULT 'rarity_desc',
    "cardIds" JSONB NOT NULL,
    "cardCount" INTEGER NOT NULL DEFAULT 0,
    "deckValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rarityBreakdown" JSONB,
    "views" INTEGER NOT NULL DEFAULT 0,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "card_collections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_auctions" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "askPrice" DOUBLE PRECISION NOT NULL,
    "currentBid" DOUBLE PRECISION,
    "currentBidderId" TEXT,
    "buyoutPrice" DOUBLE PRECISION,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" "AuctionStatus" NOT NULL DEFAULT 'ACTIVE',
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "isExpress" BOOLEAN NOT NULL DEFAULT false,
    "finalPrice" DOUBLE PRECISION,
    "winnerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "card_auctions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auction_bids" (
    "id" TEXT NOT NULL,
    "auctionId" TEXT NOT NULL,
    "bidderId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "wasSnipe" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "auction_bids_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_trades" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "receiverId" TEXT NOT NULL,
    "offeredCards" JSONB NOT NULL,
    "requestedCards" JSONB NOT NULL,
    "creditsOffer" DOUBLE PRECISION,
    "status" "TradeStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "card_trades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crafting_recipes" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "inputRules" JSONB NOT NULL,
    "creditsCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "outputCardId" TEXT NOT NULL,
    "successRate" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "isRepeatable" BOOLEAN NOT NULL DEFAULT true,
    "isDiscovered" BOOLEAN NOT NULL DEFAULT false,
    "requiredLevel" INTEGER NOT NULL DEFAULT 1,
    "craftedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crafting_recipes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_TradeCards" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_TradeCards_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_InputCards" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_InputCards_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "temp_political_import_wkb_geometry_geom_idx" ON "temp_political_import" USING GIST ("wkb_geometry");

-- CreateIndex
CREATE INDEX "map_edit_logs_entityType_entityId_idx" ON "map_edit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "map_edit_logs_userId_createdAt_idx" ON "map_edit_logs"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "map_edit_logs_action_createdAt_idx" ON "map_edit_logs"("action", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "my_vault_userId_key" ON "my_vault"("userId");

-- CreateIndex
CREATE INDEX "my_vault_userId_idx" ON "my_vault"("userId");

-- CreateIndex
CREATE INDEX "my_vault_credits_idx" ON "my_vault"("credits");

-- CreateIndex
CREATE INDEX "my_vault_vaultLevel_idx" ON "my_vault"("vaultLevel");

-- CreateIndex
CREATE INDEX "vault_transactions_vaultId_createdAt_idx" ON "vault_transactions"("vaultId", "createdAt");

-- CreateIndex
CREATE INDEX "vault_transactions_type_createdAt_idx" ON "vault_transactions"("type", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "cards_nsCardId_key" ON "cards"("nsCardId");

-- CreateIndex
CREATE INDEX "cards_cardType_rarity_season_idx" ON "cards"("cardType", "rarity", "season");

-- CreateIndex
CREATE INDEX "cards_marketValue_idx" ON "cards"("marketValue");

-- CreateIndex
CREATE INDEX "cards_countryId_idx" ON "cards"("countryId");

-- CreateIndex
CREATE INDEX "cards_nsCardId_idx" ON "cards"("nsCardId");

-- CreateIndex
CREATE INDEX "card_ownership_userId_acquiredDate_idx" ON "card_ownership"("userId", "acquiredDate");

-- CreateIndex
CREATE INDEX "card_ownership_cardId_idx" ON "card_ownership"("cardId");

-- CreateIndex
CREATE UNIQUE INDEX "card_ownership_userId_cardId_key" ON "card_ownership"("userId", "cardId");

-- CreateIndex
CREATE INDEX "card_packs_isAvailable_expiresAt_idx" ON "card_packs"("isAvailable", "expiresAt");

-- CreateIndex
CREATE INDEX "card_packs_packType_season_idx" ON "card_packs"("packType", "season");

-- CreateIndex
CREATE INDEX "user_packs_userId_isOpened_idx" ON "user_packs"("userId", "isOpened");

-- CreateIndex
CREATE INDEX "user_packs_packId_idx" ON "user_packs"("packId");

-- CreateIndex
CREATE UNIQUE INDEX "card_collections_slug_key" ON "card_collections"("slug");

-- CreateIndex
CREATE INDEX "card_collections_userId_isPublic_idx" ON "card_collections"("userId", "isPublic");

-- CreateIndex
CREATE INDEX "card_collections_slug_idx" ON "card_collections"("slug");

-- CreateIndex
CREATE INDEX "card_auctions_status_endsAt_idx" ON "card_auctions"("status", "endsAt");

-- CreateIndex
CREATE INDEX "card_auctions_cardId_status_idx" ON "card_auctions"("cardId", "status");

-- CreateIndex
CREATE INDEX "card_auctions_sellerId_idx" ON "card_auctions"("sellerId");

-- CreateIndex
CREATE INDEX "auction_bids_auctionId_timestamp_idx" ON "auction_bids"("auctionId", "timestamp");

-- CreateIndex
CREATE INDEX "auction_bids_bidderId_idx" ON "auction_bids"("bidderId");

-- CreateIndex
CREATE INDEX "card_trades_senderId_status_idx" ON "card_trades"("senderId", "status");

-- CreateIndex
CREATE INDEX "card_trades_receiverId_status_idx" ON "card_trades"("receiverId", "status");

-- CreateIndex
CREATE INDEX "card_trades_status_expiresAt_idx" ON "card_trades"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "crafting_recipes_isDiscovered_requiredLevel_idx" ON "crafting_recipes"("isDiscovered", "requiredLevel");

-- CreateIndex
CREATE INDEX "crafting_recipes_outputCardId_idx" ON "crafting_recipes"("outputCardId");

-- CreateIndex
CREATE INDEX "_TradeCards_B_index" ON "_TradeCards"("B");

-- CreateIndex
CREATE INDEX "_InputCards_B_index" ON "_InputCards"("B");

-- AddForeignKey
ALTER TABLE "VitalityHistory" ADD CONSTRAINT "VitalityHistory_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComponentEffectivenessHistory" ADD CONSTRAINT "ComponentEffectivenessHistory_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiplomaticRelationshipHistory" ADD CONSTRAINT "DiplomaticRelationshipHistory_country1Id_fkey" FOREIGN KEY ("country1Id") REFERENCES "Country"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiplomaticRelationshipHistory" ADD CONSTRAINT "DiplomaticRelationshipHistory_country2Id_fkey" FOREIGN KEY ("country2Id") REFERENCES "Country"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "my_vault" ADD CONSTRAINT "my_vault_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vault_transactions" ADD CONSTRAINT "vault_transactions_vaultId_fkey" FOREIGN KEY ("vaultId") REFERENCES "my_vault"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cards" ADD CONSTRAINT "cards_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_ownership" ADD CONSTRAINT "card_ownership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_ownership" ADD CONSTRAINT "card_ownership_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_packs" ADD CONSTRAINT "user_packs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_packs" ADD CONSTRAINT "user_packs_packId_fkey" FOREIGN KEY ("packId") REFERENCES "card_packs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_collections" ADD CONSTRAINT "card_collections_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_auctions" ADD CONSTRAINT "card_auctions_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_auctions" ADD CONSTRAINT "card_auctions_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_auctions" ADD CONSTRAINT "card_auctions_currentBidderId_fkey" FOREIGN KEY ("currentBidderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_auctions" ADD CONSTRAINT "card_auctions_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auction_bids" ADD CONSTRAINT "auction_bids_auctionId_fkey" FOREIGN KEY ("auctionId") REFERENCES "card_auctions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auction_bids" ADD CONSTRAINT "auction_bids_bidderId_fkey" FOREIGN KEY ("bidderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_trades" ADD CONSTRAINT "card_trades_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_trades" ADD CONSTRAINT "card_trades_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crafting_recipes" ADD CONSTRAINT "crafting_recipes_outputCardId_fkey" FOREIGN KEY ("outputCardId") REFERENCES "cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TradeCards" ADD CONSTRAINT "_TradeCards_A_fkey" FOREIGN KEY ("A") REFERENCES "cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TradeCards" ADD CONSTRAINT "_TradeCards_B_fkey" FOREIGN KEY ("B") REFERENCES "card_trades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_InputCards" ADD CONSTRAINT "_InputCards_A_fkey" FOREIGN KEY ("A") REFERENCES "cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_InputCards" ADD CONSTRAINT "_InputCards_B_fkey" FOREIGN KEY ("B") REFERENCES "crafting_recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "ComponentEffectivenessHistory_countryId_componentType_idx" RENAME TO "ComponentEffectivenessHistory_countryId_componentType_times_idx";

-- RenameIndex
ALTER INDEX "DiplomaticRelationshipHistory_country1Id_country2Id_idx" RENAME TO "DiplomaticRelationshipHistory_country1Id_country2Id_timesta_idx";

