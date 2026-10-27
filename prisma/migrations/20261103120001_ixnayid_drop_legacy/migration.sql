-- IxnayID identity, removal (docs/superpowers/specs/2026-10-23-ixnayid-identity-and-lorewards-design.md, "Removal
-- (last)"): the IxWiki link rows. The IIWiki and AltHistory links stay. It runs after the conversion
-- (scripts/identity/convert-wiki-name-claims.ts --apply) and before `db push`, and refuses to run while an IxWiki link is
-- still there and the conversion never left its marker. Idempotent: once the rows are gone it is a no-op.
--
-- The legacy User columns (wikiUsername, wikiUserId, lastWikiSync) are not dropped here: the old app reads every User
-- column and keeps serving while the new one builds. They stay, unread (@ignore in core.prisma), for one release; the
-- next release drops them before its push.
--
--   docker exec -i ixstats-postgres psql -U postgres -d <database> -v ON_ERROR_STOP=1 \
--     < prisma/migrations/20261103120001_ixnayid_drop_legacy/migration.sql

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "AdminAuditLog" WHERE "action" = 'WIKI_NAME_CLAIMS_CONVERTED')
     AND EXISTS (SELECT 1 FROM "wiki_account_links" WHERE "source" = 'ixwiki')
  THEN
    RAISE EXCEPTION 'Convert the IxWiki links first: bun scripts/identity/convert-wiki-name-claims.ts --apply';
  END IF;
END $$;

DELETE FROM "wiki_account_links" WHERE "source" = 'ixwiki';

COMMIT;
