-- IxnayID identity (docs/superpowers/specs/2026-10-23-ixnayid-identity-and-lorewards-design.md): the old IxWiki names
-- an account holds or asked for (wiki_name_claims), and every revision authorId a claim set (wiki_revision_claim_tags),
-- so a revoke undoes exactly those. Hand-written, additive and idempotent: safe to re-run, and a no-op on a database
-- that already has it. It runs after the card categories SQL and before `db push`; on a fresh database it runs after
-- the push, where every statement but the two partial unique indexes is a no-op.
--
--   docker exec -i ixstats-postgres psql -U postgres -d <database> -v ON_ERROR_STOP=1 \
--     < prisma/migrations/20261103120000_ixnayid_claims/migration.sql

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'WikiNameClaimStatus') THEN
    CREATE TYPE "WikiNameClaimStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'REVOKED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'WikiNameClaimOrigin') THEN
    CREATE TYPE "WikiNameClaimOrigin" AS ENUM ('PLAYER', 'ADMIN_LINK', 'CONVERSION');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "wiki_name_claims" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'ixwiki',
  "name" TEXT NOT NULL,
  "status" "WikiNameClaimStatus" NOT NULL DEFAULT 'PENDING',
  "visible" BOOLEAN NOT NULL DEFAULT true,
  "rightsPass" BOOLEAN NOT NULL DEFAULT false,
  "origin" "WikiNameClaimOrigin" NOT NULL,
  "evidence" VARCHAR(1000),
  "decisionNote" VARCHAR(1000),
  "requestedById" TEXT NOT NULL,
  "decidedById" TEXT,
  "decidedAt" TIMESTAMP(3),
  "mwUserId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "wiki_name_claims_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "wiki_revision_claim_tags" (
  "id" TEXT NOT NULL,
  "claimId" TEXT NOT NULL,
  "revisionId" TEXT NOT NULL,
  "taggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "undoneAt" TIMESTAMP(3),
  CONSTRAINT "wiki_revision_claim_tags_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'wiki_name_claims_userId_fkey') THEN
    ALTER TABLE "wiki_name_claims" ADD CONSTRAINT "wiki_name_claims_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'wiki_revision_claim_tags_claimId_fkey') THEN
    ALTER TABLE "wiki_revision_claim_tags" ADD CONSTRAINT "wiki_revision_claim_tags_claimId_fkey"
      FOREIGN KEY ("claimId") REFERENCES "wiki_name_claims"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'wiki_revision_claim_tags_revisionId_fkey') THEN
    ALTER TABLE "wiki_revision_claim_tags" ADD CONSTRAINT "wiki_revision_claim_tags_revisionId_fkey"
      FOREIGN KEY ("revisionId") REFERENCES "wiki_revisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "wiki_name_claims_source_name_idx" ON "wiki_name_claims" ("source", "name");
CREATE INDEX IF NOT EXISTS "wiki_name_claims_userId_status_idx" ON "wiki_name_claims" ("userId", "status");
CREATE INDEX IF NOT EXISTS "wiki_name_claims_status_createdAt_idx" ON "wiki_name_claims" ("status", "createdAt");
CREATE INDEX IF NOT EXISTS "wiki_revision_claim_tags_claimId_undoneAt_idx"
  ON "wiki_revision_claim_tags" ("claimId", "undoneAt");
CREATE INDEX IF NOT EXISTS "wiki_revision_claim_tags_revisionId_idx" ON "wiki_revision_claim_tags" ("revisionId");

-- One approved owner per name, and one open request per account and name. Prisma's schema cannot express a partial
-- index, so they live only here; identity.name-claims.ts also checks both under the name's advisory lock.
CREATE UNIQUE INDEX IF NOT EXISTS "wiki_name_claims_one_approved_key"
  ON "wiki_name_claims" ("source", "name") WHERE "status" = 'APPROVED';
CREATE UNIQUE INDEX IF NOT EXISTS "wiki_name_claims_one_pending_key"
  ON "wiki_name_claims" ("userId", "source", "name") WHERE "status" = 'PENDING';

COMMIT;
