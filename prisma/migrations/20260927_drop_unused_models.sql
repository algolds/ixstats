-- Plan 347: drop 37 unused Prisma models (tables) and 1 orphaned enum.
-- OPERATOR-APPLIED. Never run by an executor or by db:push/db:migrate.
-- The models were removed from prisma/schema/*.prisma in the same change; the
-- evidence for each table is in plans/347-drop-unused-prisma-models.md.
--
-- ============================================================================
-- STEP 0 - BACKUP FIRST (on the prod host, `ssh ixwiki`)
-- ============================================================================
--   df -h /        # a full root disk crashes Postgres; write the dump elsewhere if tight
--   docker exec ixstats-postgres pg_dump -U postgres -Fc ixstats \
--     > ~/ixstats-pre-347-$(date +%F).dump
--   ls -lh ~/ixstats-pre-347-*.dump      # must be non-empty
--
--   Optional, for a quick per-table restore: a dump of only the tables below.
--   docker exec ixstats-postgres pg_dump -U postgres -Fc ixstats \
--     -t '"consent"' -t '"auditLog"' -t '"consentPolicy"' -t '"runtimePolicyDecision"' \
--     -t '"subject"' -t '"domain"' -t '"consentPurpose"' -t '"private_c15t_settings"' \
--     -t '"ns_imports"' -t '"LogRetentionPolicy"' -t '"EncryptionKey"' \
--     -t '"EncryptionAuditLog"' -t '"UserArchetypeSelection"' -t '"CountryArchetypeMatch"' \
--     -t '"ScenarioTemplate"' -t '"ScenarioUsageAnalytics"' -t '"FiscalPolicy"' \
--     -t '"AtomicEconomicImpact"' -t 'exchange_company_value_history' \
--     -t 'exchange_share_issuances' -t 'exchange_shareholdings' -t 'exchange_company_decisions' \
--     -t 'exchange_contract_bids' -t 'exchange_sector_positions' -t 'exchange_conversion_logs' \
--     -t 'exchange_sector_index_history' -t 'exchange_sector_indices' -t 'exchange_contracts' \
--     -t 'exchange_companies' -t 'territory_claims' -t '"PlaylistTrack"' -t '"PlaybackHistory"' \
--     -t '"MediaPlaylist"' -t '"MediaTrack"' -t '"ActivityLike"' -t '"ActivityComment"' \
--     -t '"ActivityShare"' > ~/ixstats-347-tables-$(date +%F).dump
--
-- Run the steps interactively:
--   docker exec -it ixstats-postgres psql -U postgres -d ixstats
-- and paste STEP 1, then STEP 2, then (after reading the output) STEP 3.
--
-- WARNING - case matters. "auditLog" (lower-case a, the c15t table) is dropped.
-- "AuditLog" (upper-case A) is the live admin audit table and must stay.
-- Every identifier below is double-quoted on purpose; do not unquote them.

-- ============================================================================
-- STEP 1 - READ-ONLY ROW COUNTS. Run these first and STOP if any table holds
-- rows you care about. "relation ... does not exist" only means that table was
-- never created in this database; the DROP below uses IF EXISTS.
-- ============================================================================

-- c15t consent library (package removed in 2b3cd9053)
SELECT 'consent'                        AS table_name, count(*) FROM "consent";
SELECT 'auditLog (c15t, NOT AuditLog)'  AS table_name, count(*) FROM "auditLog";
SELECT 'consentPolicy'                  AS table_name, count(*) FROM "consentPolicy";
SELECT 'runtimePolicyDecision'          AS table_name, count(*) FROM "runtimePolicyDecision";
SELECT 'subject'                        AS table_name, count(*) FROM "subject";
SELECT 'domain'                         AS table_name, count(*) FROM "domain";
SELECT 'consentPurpose'                 AS table_name, count(*) FROM "consentPurpose";
SELECT 'private_c15t_settings'          AS table_name, count(*) FROM "private_c15t_settings";
-- cards.prisma
SELECT 'ns_imports'                     AS table_name, count(*) FROM "ns_imports";
-- core.prisma
SELECT 'LogRetentionPolicy'             AS table_name, count(*) FROM "LogRetentionPolicy";
SELECT 'EncryptionKey'                  AS table_name, count(*) FROM "EncryptionKey";
SELECT 'EncryptionAuditLog'             AS table_name, count(*) FROM "EncryptionAuditLog";
SELECT 'UserArchetypeSelection'         AS table_name, count(*) FROM "UserArchetypeSelection";
SELECT 'CountryArchetypeMatch'          AS table_name, count(*) FROM "CountryArchetypeMatch";
-- diplomacy.prisma
SELECT 'ScenarioTemplate'               AS table_name, count(*) FROM "ScenarioTemplate";
SELECT 'ScenarioUsageAnalytics'         AS table_name, count(*) FROM "ScenarioUsageAnalytics";
-- economy.prisma
SELECT 'FiscalPolicy'                   AS table_name, count(*) FROM "FiscalPolicy";
SELECT 'AtomicEconomicImpact'           AS table_name, count(*) FROM "AtomicEconomicImpact";
-- exchange.prisma (unbuilt Exchange M2-M4 tables; exchange_wallets / exchange_transactions stay)
SELECT 'exchange_company_value_history' AS table_name, count(*) FROM "exchange_company_value_history";
SELECT 'exchange_share_issuances'       AS table_name, count(*) FROM "exchange_share_issuances";
SELECT 'exchange_shareholdings'         AS table_name, count(*) FROM "exchange_shareholdings";
SELECT 'exchange_company_decisions'     AS table_name, count(*) FROM "exchange_company_decisions";
SELECT 'exchange_contract_bids'         AS table_name, count(*) FROM "exchange_contract_bids";
SELECT 'exchange_sector_positions'      AS table_name, count(*) FROM "exchange_sector_positions";
SELECT 'exchange_conversion_logs'       AS table_name, count(*) FROM "exchange_conversion_logs";
SELECT 'exchange_sector_index_history'  AS table_name, count(*) FROM "exchange_sector_index_history";
SELECT 'exchange_sector_indices'        AS table_name, count(*) FROM "exchange_sector_indices";
SELECT 'exchange_contracts'             AS table_name, count(*) FROM "exchange_contracts";
SELECT 'exchange_companies'             AS table_name, count(*) FROM "exchange_companies";
-- maps.prisma
SELECT 'territory_claims'               AS table_name, count(*) FROM "territory_claims";
-- media.prisma
SELECT 'PlaylistTrack'                  AS table_name, count(*) FROM "PlaylistTrack";
SELECT 'PlaybackHistory'                AS table_name, count(*) FROM "PlaybackHistory";
SELECT 'MediaPlaylist'                  AS table_name, count(*) FROM "MediaPlaylist";
SELECT 'MediaTrack'                     AS table_name, count(*) FROM "MediaTrack";
-- social.prisma
SELECT 'ActivityLike'                   AS table_name, count(*) FROM "ActivityLike";
SELECT 'ActivityComment'                AS table_name, count(*) FROM "ActivityComment";
SELECT 'ActivityShare'                  AS table_name, count(*) FROM "ActivityShare";

-- ============================================================================
-- STEP 2 - READ-ONLY DEPENDENCY CHECKS. Both queries should return 0 rows /
-- only the MediaTrack.type row. Anything else is a dependency the schema does
-- not know about: stop and investigate.
-- ============================================================================

-- 2a. Foreign keys from tables that STAY into tables that are dropped. Expected: 0 rows.
WITH drop_set(name) AS (VALUES
  ('consent'), ('auditLog'), ('consentPolicy'), ('runtimePolicyDecision'), ('subject'),
  ('domain'), ('consentPurpose'), ('private_c15t_settings'), ('ns_imports'),
  ('LogRetentionPolicy'), ('EncryptionKey'), ('EncryptionAuditLog'),
  ('UserArchetypeSelection'), ('CountryArchetypeMatch'), ('ScenarioTemplate'),
  ('ScenarioUsageAnalytics'), ('FiscalPolicy'), ('AtomicEconomicImpact'),
  ('exchange_company_value_history'), ('exchange_share_issuances'),
  ('exchange_shareholdings'), ('exchange_company_decisions'), ('exchange_contract_bids'),
  ('exchange_sector_positions'), ('exchange_conversion_logs'),
  ('exchange_sector_index_history'), ('exchange_sector_indices'), ('exchange_contracts'),
  ('exchange_companies'), ('territory_claims'), ('PlaylistTrack'), ('PlaybackHistory'),
  ('MediaPlaylist'), ('MediaTrack'), ('ActivityLike'), ('ActivityComment'), ('ActivityShare')
)
SELECT src.relname AS referencing_table, c.conname, dst.relname AS dropped_table
FROM pg_constraint c
JOIN pg_class src ON src.oid = c.conrelid
JOIN pg_class dst ON dst.oid = c.confrelid
JOIN pg_namespace n ON n.oid = dst.relnamespace AND n.nspname = 'public'
WHERE c.contype = 'f'
  AND dst.relname IN (SELECT name FROM drop_set)
  AND src.relname NOT IN (SELECT name FROM drop_set);

-- 2b. Columns that use the "MediaType" enum. Expected: exactly one row, MediaTrack.type.
SELECT c.relname AS table_name, a.attname AS column_name
FROM pg_attribute a
JOIN pg_class c ON c.oid = a.attrelid
JOIN pg_type t ON t.oid = a.atttypid
WHERE t.typname = 'MediaType' AND NOT a.attisdropped AND c.relkind IN ('r', 'v', 'm');

-- ============================================================================
-- STEP 3 - DROP. RUN ONLY AFTER REVIEWING THE COUNTS (STEP 1) AND CHECKS (STEP 2).
--
-- The block ends in ROLLBACK, so pasting it as-is is a dry run: it proves every
-- DROP succeeds (no hidden dependency; no CASCADE is used on purpose) and then
-- undoes everything. To apply, run it again with the last line changed to COMMIT.
-- ============================================================================

BEGIN;
SET LOCAL lock_timeout = '5s';

-- c15t: children first (consent -> subject/domain/consentPolicy/runtimePolicyDecision,
-- auditLog -> subject), then the parents and standalone tables.
DROP TABLE IF EXISTS "consent";
DROP TABLE IF EXISTS "auditLog";              -- c15t table. NOT "AuditLog".
DROP TABLE IF EXISTS "consentPolicy";
DROP TABLE IF EXISTS "runtimePolicyDecision";
DROP TABLE IF EXISTS "subject";
DROP TABLE IF EXISTS "domain";
DROP TABLE IF EXISTS "consentPurpose";
DROP TABLE IF EXISTS "private_c15t_settings";

-- cards.prisma
DROP TABLE IF EXISTS "ns_imports";

-- core.prisma (UserArchetypeSelection -> User/Archetype and CountryArchetypeMatch ->
-- Country/Archetype are child-side FKs; they go away with these tables)
DROP TABLE IF EXISTS "LogRetentionPolicy";
DROP TABLE IF EXISTS "EncryptionKey";
DROP TABLE IF EXISTS "EncryptionAuditLog";
DROP TABLE IF EXISTS "UserArchetypeSelection";
DROP TABLE IF EXISTS "CountryArchetypeMatch";

-- diplomacy.prisma
DROP TABLE IF EXISTS "ScenarioTemplate";
DROP TABLE IF EXISTS "ScenarioUsageAnalytics";

-- economy.prisma (child-side FKs to Country)
DROP TABLE IF EXISTS "FiscalPolicy";
DROP TABLE IF EXISTS "AtomicEconomicImpact";

-- exchange.prisma: children of exchange_companies / exchange_contracts first
DROP TABLE IF EXISTS "exchange_company_value_history";
DROP TABLE IF EXISTS "exchange_share_issuances";
DROP TABLE IF EXISTS "exchange_shareholdings";
DROP TABLE IF EXISTS "exchange_company_decisions";
DROP TABLE IF EXISTS "exchange_contract_bids";
DROP TABLE IF EXISTS "exchange_sector_positions";
DROP TABLE IF EXISTS "exchange_conversion_logs";
DROP TABLE IF EXISTS "exchange_sector_index_history";
DROP TABLE IF EXISTS "exchange_sector_indices";
DROP TABLE IF EXISTS "exchange_contracts";
DROP TABLE IF EXISTS "exchange_companies";

-- maps.prisma (child-side FK to realms)
DROP TABLE IF EXISTS "territory_claims";

-- media.prisma: join/child tables first, then parents, then the enum
DROP TABLE IF EXISTS "PlaylistTrack";
DROP TABLE IF EXISTS "PlaybackHistory";
DROP TABLE IF EXISTS "MediaPlaylist";
DROP TABLE IF EXISTS "MediaTrack";
DROP TYPE IF EXISTS "MediaType";

-- social.prisma (child-side FKs to ActivityFeed)
DROP TABLE IF EXISTS "ActivityLike";
DROP TABLE IF EXISTS "ActivityComment";
DROP TABLE IF EXISTS "ActivityShare";

-- Guard: the live admin audit table (same name, different case) is untouched.
DO $$
BEGIN
  IF to_regclass('public."AuditLog"') IS NULL THEN
    RAISE EXCEPTION 'live table "AuditLog" is missing - aborting';
  END IF;
END $$;

ROLLBACK;  -- dry run. Change to COMMIT; to apply.
