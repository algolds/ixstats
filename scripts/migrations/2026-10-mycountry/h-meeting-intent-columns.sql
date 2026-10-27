-- MyCountry fix plan, WP-H (P0-02): the cabinet-meeting columns production lacks.
-- Live errors (ixworld-error.log, 2026-10-21/22): `meetings.getMeetings` x310 ("The column t0.intentId does not exist",
-- "t6.linkedIntentId does not exist") and `intelCore.getOverview` x47, which reads cabinet meetings. The schema declares
-- both columns (government.prisma CabinetMeeting.intentId, MeetingAgendaItem.linkedIntentId); this is the additive DDL
-- `prisma migrate diff` produces for them, copied from the local clone where they exist.
-- Idempotent (IF NOT EXISTS, guarded constraints): a re-run, or the deploy script's `db push` afterwards, changes nothing.
-- Safe while the old build runs (it never reads the columns), so run it first: it also ends the live errors.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/migrations/2026-10-mycountry/h-meeting-intent-columns.sql
--
-- Check first (read-only): expect 0 rows on production today, 2 after.
--   SELECT table_name, column_name FROM information_schema.columns
--   WHERE (table_name = 'CabinetMeeting' AND column_name = 'intentId')
--      OR (table_name = 'MeetingAgendaItem' AND column_name = 'linkedIntentId');

BEGIN;

ALTER TABLE "CabinetMeeting" ADD COLUMN IF NOT EXISTS "intentId" TEXT;
ALTER TABLE "MeetingAgendaItem" ADD COLUMN IF NOT EXISTS "linkedIntentId" TEXT;

CREATE INDEX IF NOT EXISTS "CabinetMeeting_intentId_idx" ON "CabinetMeeting"("intentId");
CREATE INDEX IF NOT EXISTS "MeetingAgendaItem_linkedIntentId_idx" ON "MeetingAgendaItem"("linkedIntentId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CabinetMeeting_intentId_fkey') THEN
    ALTER TABLE "CabinetMeeting" ADD CONSTRAINT "CabinetMeeting_intentId_fkey"
      FOREIGN KEY ("intentId") REFERENCES "intents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MeetingAgendaItem_linkedIntentId_fkey') THEN
    ALTER TABLE "MeetingAgendaItem" ADD CONSTRAINT "MeetingAgendaItem_linkedIntentId_fkey"
      FOREIGN KEY ("linkedIntentId") REFERENCES "intents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

COMMIT;
