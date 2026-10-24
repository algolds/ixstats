-- IxnayID identity, removal (docs/superpowers/specs/2026-10-23-ixnayid-identity-and-lorewards-design.md, "Removal
-- (last)"): the legacy User wiki columns and the IxWiki link rows. The IIWiki and AltHistory links stay. It runs after
-- the conversion (scripts/identity/convert-wiki-name-claims.ts --apply) and before `db push`, and refuses to run while
-- the legacy column or an IxWiki link is still there and the conversion never left its marker. Idempotent: once the
-- columns and rows are gone it is a no-op, and on a fresh database (after the push) it has nothing to do.
--
--   docker exec -i ixstats-postgres psql -U postgres -d <database> -v ON_ERROR_STOP=1 \
--     < prisma/migrations/20261103120001_ixnayid_drop_legacy/migration.sql

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "AdminAuditLog" WHERE "action" = 'WIKI_NAME_CLAIMS_CONVERTED')
     AND (EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'User' AND column_name = 'wikiUsername')
          OR EXISTS (SELECT 1 FROM "wiki_account_links" WHERE "source" = 'ixwiki'))
  THEN
    RAISE EXCEPTION 'Convert the IxWiki links first: bun scripts/identity/convert-wiki-name-claims.ts --apply';
  END IF;
END $$;

DELETE FROM "wiki_account_links" WHERE "source" = 'ixwiki';

ALTER TABLE "User" DROP COLUMN IF EXISTS "wikiUsername";
ALTER TABLE "User" DROP COLUMN IF EXISTS "wikiUserId";
ALTER TABLE "User" DROP COLUMN IF EXISTS "lastWikiSync";

COMMIT;
