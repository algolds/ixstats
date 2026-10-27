/*
  Warnings:

  - You are about to drop the column `oldCol` on the `cards` table. All the data in the column will be lost.
  - Added the required column `realmId` to the `cards` table without a default value. This is not possible if the table is not empty.

*/
-- The shape of `prisma migrate diff --from-url ... --to-schema-datamodel prisma/schema --script` (Prisma 6.19), one
-- statement of each kind the additive step keeps or leaves to the push.

-- CreateEnum
CREATE TYPE "Rarity" AS ENUM ('COMMON', 'RARE');

-- CreateEnum
CREATE TYPE "Brand" AS ENUM ('x');

-- CreateEnum
CREATE TYPE "CardFinish" AS ENUM ('STANDARD', 'FOIL');

-- AlterEnum
BEGIN;
CREATE TYPE "Mood_new" AS ENUM ('happy', 'sad');
ALTER TABLE "cards" ALTER COLUMN "mood" TYPE "Mood_new" USING ("mood"::text::"Mood_new");
ALTER TYPE "Mood" RENAME TO "Mood_old";
ALTER TYPE "Mood_new" RENAME TO "Mood";
DROP TYPE "public"."Mood_old";
COMMIT;

-- AlterEnum
ALTER TYPE "Grow" ADD VALUE 'b';

-- AlterEnum
ALTER TYPE "CardFinish" ADD VALUE 'HOLO';

-- DropForeignKey
ALTER TABLE "cards" DROP CONSTRAINT "cards_oldId_fkey";

-- DropIndex
DROP INDEX "cards_title_idx";

-- AlterTable
ALTER TABLE "cards" DROP COLUMN "oldCol",
ADD COLUMN     "amount" DECIMAL(65,30),
ADD COLUMN     "isBound" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "note" TEXT,
ADD COLUMN     "label" TEXT NOT NULL DEFAULT 'NOT NULL',
ADD COLUMN     "realmId" TEXT NOT NULL,
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "mood2" "Mood",
DROP COLUMN "rarity",
ADD COLUMN     "rarity" "Rarity" NOT NULL DEFAULT 'COMMON';

-- AlterTable
ALTER TABLE "wiki_revisions" ADD COLUMN     "authorId" TEXT,
ADD COLUMN     "origin" TEXT NOT NULL DEFAULT 'wikios',
ADD COLUMN     "parked" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "CardAuction" ADD COLUMN     "listingFee" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "seq" SERIAL NOT NULL;

-- AlterTable
ALTER TABLE "CardOwnership" ADD COLUMN     "finish" "CardFinish" NOT NULL DEFAULT 'STANDARD';

-- AlterTable
ALTER TABLE "GovernmentStructure" ALTER COLUMN "politicalStability" SET DEFAULT 50;

-- AlterTable
ALTER TABLE "MilitaryBranch" ALTER COLUMN "activeDuty" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Country" ADD COLUMN     "ownerUserId" TEXT,
ADD COLUMN     "slug" TEXT NOT NULL;

-- DropTable
DROP TABLE "world_configs";

-- CreateTable
CREATE TABLE "job_leases" (
    "name" TEXT NOT NULL,
    "holder" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_leases_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "realm_pages" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "brand" "Brand" NOT NULL,

    CONSTRAINT "realm_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "realm_items" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,

    CONSTRAINT "realm_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ns_import_ledger" (
    "id" TEXT NOT NULL,

    CONSTRAINT "ns_import_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mood_log" (
    "id" TEXT NOT NULL,
    "mood" "Mood" NOT NULL,

    CONSTRAINT "mood_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "realm_pages_brand_idx" ON "realm_pages"("brand");

-- CreateIndex
CREATE UNIQUE INDEX "realm_pages_title_key" ON "realm_pages"("title");

-- CreateIndex
CREATE INDEX "realm_items_pageId_idx" ON "realm_items"("pageId");

-- CreateIndex
CREATE INDEX "ns_import_ledger_id_idx" ON "ns_import_ledger"("id");

-- CreateIndex
CREATE UNIQUE INDEX "cards_title_key" ON "cards"("title");

-- CreateIndex
CREATE INDEX "Country_ownerUserId_idx" ON "Country"("ownerUserId");

-- RenameIndex
ALTER INDEX "cards_old_key" RENAME TO "cards_new_key";

-- AddForeignKey
ALTER TABLE "cards" ADD CONSTRAINT "cards_realmId_fkey" FOREIGN KEY ("realmId") REFERENCES "realm_pages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "realm_items" ADD CONSTRAINT "realm_items_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "realm_pages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "realm_pages" ADD CONSTRAINT "realm_pages_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
