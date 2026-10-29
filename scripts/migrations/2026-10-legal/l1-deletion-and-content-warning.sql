-- Legal compliance, L1: the account-deletion grace column and the ThinkPages content-warning column.
-- Additive and nullable; idempotent (IF NOT EXISTS), so a re-run changes nothing.
--
-- Run BEFORE the legal-compliance code is deployed (the new build reads both columns):
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/migrations/2026-10-legal/l1-deletion-and-content-warning.sql

BEGIN;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "deletionRequestedAt" TIMESTAMP(3);
ALTER TABLE "ThinkpagesPost" ADD COLUMN IF NOT EXISTS "contentWarning" TEXT;

COMMIT;
