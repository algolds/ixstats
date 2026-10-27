-- Realm community links, rules and the in-world date (docs/specs/2026-10-05-realm-regions-design.md).
-- Additive and nullable: `db push` applies the same columns with no data-loss prompt. The in-world date needs no
-- column (it is the `inWorldDate` key of "realms"."settings"). Safe to re-run.
ALTER TABLE "realms" ADD COLUMN IF NOT EXISTS "communityLinks" JSONB;
ALTER TABLE "realms" ADD COLUMN IF NOT EXISTS "rulesWikitext" TEXT;
ALTER TABLE "realms" ADD COLUMN IF NOT EXISTS "rulesHtml" TEXT;
ALTER TABLE "realms" ADD COLUMN IF NOT EXISTS "rulesUpdatedAt" TIMESTAMP(3);
ALTER TABLE "realms" ADD COLUMN IF NOT EXISTS "rulesUpdatedBy" TEXT;

ALTER TABLE "realm_claims" ADD COLUMN IF NOT EXISTS "rulesAcceptedAt" TIMESTAMP(3);
