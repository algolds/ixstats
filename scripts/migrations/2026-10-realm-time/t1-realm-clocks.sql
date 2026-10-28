-- Realm time, WP-T1 (docs/specs/2026-10-25-realm-time-design.md §1): every realm has a clock.
-- Gives every realm but Ixnay ('default', whose clock is the bot-synced IxTime) that lacks `settings.clock` one,
-- continuous with Ixnay's IxTime now (so no stored timestamp moves), at ×2, Gregorian. The retired in-world date
-- (`settings.inWorldDate`) sets the calendar so the realm keeps reading the same year and era:
--   offset mode: year = this real year + offset, its era;
--   fixed label: the label's last number as the year and the text after it as the era ("14 Harvest 1203 AE");
--   none (or a label without a number): IxTime's own date, no era.
-- The month and day are today's (UTC). `changedAt` 0: no founder speed cooldown starts. The label is removed.
-- Idempotent: only realms without `settings.clock` change, so a re-run changes nothing.
-- Run BEFORE deploying the T1 code (a realm without a clock is logged and shows Ixnay's date).
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/migrations/2026-10-realm-time/t1-realm-clocks.sql
--
-- Size first (read-only):
--   SELECT id, slug, settings->'inWorldDate' FROM realms
--   WHERE id <> 'default' AND NOT (COALESCE(settings, '{}'::jsonb) ? 'clock');

WITH
ixnay AS (
  -- IxTime.getCurrentIxTime(): the shared override state when anchored, else the canonical 2x from
  -- 1 Jan 2040 IxTime at 27 Jul 2025 real (src/lib/ixtime/core.ts).
  SELECT
    n.real_ms,
    round(CASE
      WHEN st.s ->> 'timeOverride' IS NOT NULL AND st.s ->> 'timeOverrideSetAt' IS NOT NULL THEN
        (st.s ->> 'timeOverride')::numeric
        + (n.real_ms - (st.s ->> 'timeOverrideSetAt')::numeric)
          * COALESCE((st.s ->> 'multiplierOverride')::numeric, 2)
      ELSE 2208988800000 + (n.real_ms - 1753574400000) * 2
    END) AS ix_ms
  FROM (SELECT round(EXTRACT(EPOCH FROM clock_timestamp()) * 1000) AS real_ms) n
  LEFT JOIN (
    SELECT value::jsonb AS s FROM "SystemConfig" WHERE key = 'ixtime_clock_state'
  ) st ON true
),
targets AS (
  SELECT
    r.id,
    CASE WHEN jsonb_typeof(r.settings) = 'object' THEN r.settings ELSE '{}'::jsonb END AS settings,
    r.settings -> 'inWorldDate' AS iwd
  FROM realms r
  WHERE r.id <> 'default'
    AND NOT (CASE WHEN jsonb_typeof(r.settings) = 'object' THEN r.settings ? 'clock' ELSE false END)
),
labels AS (
  SELECT
    t.id,
    t.settings,
    CASE
      WHEN t.iwd ->> 'mode' = 'offset' AND (t.iwd ->> 'offset') ~ '^-?\d+$' THEN
        EXTRACT(YEAR FROM now() AT TIME ZONE 'UTC')::int + (t.iwd ->> 'offset')::int
      WHEN t.iwd ->> 'mode' = 'fixed' THEN
        substring(t.iwd ->> 'label' FROM '(\d{1,4})\D*$')::int
    END AS year,
    left(btrim(CASE
      WHEN t.iwd ->> 'mode' = 'offset' THEN COALESCE(t.iwd ->> 'era', '')
      WHEN t.iwd ->> 'mode' = 'fixed' THEN COALESCE(substring(t.iwd ->> 'label' FROM '\d\s*(\D*)$'), '')
      ELSE ''
    END), 16) AS era
  FROM targets t
),
dated AS (
  SELECT
    l.id,
    l.settings,
    l.era,
    CASE WHEN l.year IS NULL THEN NULL ELSE LEAST(9999, GREATEST(1, l.year)) END AS year,
    EXTRACT(MONTH FROM now() AT TIME ZONE 'UTC')::int AS month,
    EXTRACT(DAY FROM now() AT TIME ZONE 'UTC')::int AS day
  FROM labels l
),
clocks AS (
  SELECT
    d.id,
    d.settings,
    d.era,
    i.real_ms,
    i.ix_ms,
    CASE
      WHEN d.year IS NULL THEN 0
      ELSE
        -- Midnight (UTC) of today's month and day in that year, clamped to the month's end (29 February),
        -- plus IxTime's time of day, minus IxTime now.
        EXTRACT(EPOCH FROM make_date(
          d.year, d.month,
          LEAST(d.day, EXTRACT(DAY FROM make_date(d.year, d.month, 1) + interval '1 month - 1 day')::int)
        )::timestamp)::numeric * 1000
        + (i.ix_ms - floor(i.ix_ms / 86400000) * 86400000)
        - i.ix_ms
    END AS offset_ms
  FROM dated d CROSS JOIN ixnay i
)
UPDATE realms r
SET settings = (c.settings - 'inWorldDate') || jsonb_build_object(
  'clock', jsonb_build_object(
    'anchorRealMs', c.real_ms,
    'anchorClockMs', c.ix_ms,
    'multiplier', 2,
    'changedAt', 0,
    'calendarOffsetMs', round(c.offset_ms),
    'era', c.era
  )
)
FROM clocks c
WHERE r.id = c.id;

-- Check: no realm but Ixnay lacks a clock.
SELECT count(*) AS realms_without_clock
FROM realms
WHERE id <> 'default' AND NOT (COALESCE(settings, '{}'::jsonb) ? 'clock');
