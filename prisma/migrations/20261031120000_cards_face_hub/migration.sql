-- Cards refresh, Phase 3: face and hub (docs/specs/2026-10-15-cards-refresh-design.md §2.3 and §4). Hand-written and
-- idempotent: safe to re-run, and a no-op on a database that already has it. It runs BEFORE `db push`, because it
-- drops two tables the schema no longer has (db push refuses to drop a table with rows); on a fresh database it runs
-- after the push and installs the two triggers. It needs Phase 1's cards."realmId", and it is one transaction, so a
-- failure changes nothing (prisma db execute already runs a file as one; BEGIN and COMMIT make psql do the same).
--
--   docker exec -i ixstats-postgres psql -U postgres -d ixstats -v ON_ERROR_STOP=1 \
--     < prisma/migrations/20261031120000_cards_face_hub/migration.sql

BEGIN;

-- 1. Collector numbers. Silhouettes show a number: each card's place in its home realm.
ALTER TABLE "cards" ADD COLUMN IF NOT EXISTS "collectorNumber" INTEGER;

UPDATE "cards" AS c
SET "collectorNumber" = numbered.n
FROM (
  SELECT x."id",
         COALESCE(top.max_n, 0)
           + ROW_NUMBER() OVER (PARTITION BY x."realmId" ORDER BY x."createdAt", x."id") AS n
  FROM "cards" AS x
  LEFT JOIN (
    SELECT "realmId", MAX("collectorNumber") AS max_n FROM "cards" GROUP BY "realmId"
  ) AS top ON top."realmId" = x."realmId"
  WHERE x."collectorNumber" IS NULL
) AS numbered
WHERE c."id" = numbered."id";

CREATE UNIQUE INDEX IF NOT EXISTS "cards_realmId_collectorNumber_key" ON "cards" ("realmId", "collectorNumber");

-- Every path that creates a card (imports, trophies, sports, the Designer) gets its number here, so none of them has to. The per-realm lock is namespace 7337
-- (7331-7336 are taken, 7334 is reserved for Phase 4). A card that moves realm (a trophy reassign, a Special card
-- edit) takes the next number in its new realm, since its old one may be taken there.
CREATE OR REPLACE FUNCTION "cards_assign_collector_number"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."collectorNumber" IS NULL OR (TG_OP = 'UPDATE' AND NEW."realmId" IS DISTINCT FROM OLD."realmId") THEN
    PERFORM pg_advisory_xact_lock(7337, hashtext(NEW."realmId"));
    SELECT COALESCE(MAX("collectorNumber"), 0) + 1 INTO NEW."collectorNumber"
      FROM "cards" WHERE "realmId" = NEW."realmId";
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS "cards_assign_collector_number" ON "cards";
CREATE TRIGGER "cards_assign_collector_number" BEFORE INSERT OR UPDATE OF "realmId" ON "cards"
  FOR EACH ROW EXECUTE FUNCTION "cards_assign_collector_number"();

-- 2. Showcases (the free-form collections). A player's pinned showcase is the one pinned last.
ALTER TABLE "CardCollection" ADD COLUMN IF NOT EXISTS "pinnedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "CardCollection_userId_pinnedAt_idx" ON "CardCollection" ("userId", "pinnedAt");

-- A showcase holds only copies its owner still has: drop the ones that left before this release...
DELETE FROM "CardCollectionItem" AS i
USING "CardCollection" AS c, "CardOwnership" AS o
WHERE c."id" = i."collectionId" AND o."id" = i."cardOwnershipId" AND o."ownerId" <> c."userId";

-- ...and each copy that leaves from now on, whichever path (trade, sale, grant, reassign) moves it.
CREATE OR REPLACE FUNCTION "card_showcase_detach_on_transfer"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM "CardCollectionItem" AS i
  USING "CardCollection" AS c
  WHERE i."cardOwnershipId" = NEW."id" AND c."id" = i."collectionId" AND c."userId" <> NEW."ownerId";
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS "card_showcase_detach_on_transfer" ON "CardOwnership";
CREATE TRIGGER "card_showcase_detach_on_transfer" AFTER UPDATE OF "ownerId" ON "CardOwnership"
  FOR EACH ROW WHEN (OLD."ownerId" IS DISTINCT FROM NEW."ownerId")
  EXECUTE FUNCTION "card_showcase_detach_on_transfer"();

-- 3. Collection likes and comments go with the collection page that read them.
DROP TABLE IF EXISTS "CollectionLike";
DROP TABLE IF EXISTS "CollectionComment";

-- 4. The Vault config's streak bonus cap went with the second daily claim; nothing reads its setting.
DELETE FROM "SystemConfig" WHERE "key" = 'vault_maxStreakBonus';

COMMIT;
