-- WikiOS plan 416: a stash may hold the same title once per content type.
--
-- `lore_stash_items` was unique on (stashId, pageTitle), so an Onoma name "Rome" and the article
-- "Rome" in one stash overwrote each other. The key becomes (stashId, contentType, pageTitle).
--
-- Idempotent: safe to run more than once. Apply with:  psql <database> -f <this file>
-- The new key is strictly weaker than the old one, so no existing row can violate it.

BEGIN;

-- `contentType` is NOT NULL DEFAULT 'wiki'; this only repairs any row written with an empty value.
UPDATE lore_stash_items SET "contentType" = 'wiki' WHERE "contentType" IS NULL OR "contentType" = '';

-- Prisma creates the old key as a unique index; a database built by hand may hold it as a constraint.
ALTER TABLE lore_stash_items DROP CONSTRAINT IF EXISTS "lore_stash_items_stashId_pageTitle_key";
DROP INDEX IF EXISTS "lore_stash_items_stashId_pageTitle_key";

CREATE UNIQUE INDEX IF NOT EXISTS "lore_stash_items_stashId_contentType_pageTitle_key"
  ON lore_stash_items ("stashId", "contentType", "pageTitle");

COMMIT;
