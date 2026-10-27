-- Realm time (2026-10): sports moved from IxTime days (12 real hours at 2x) to real days, so a league's stored
-- matchIntervalDays / raceIntervalDays now mean twice as long. Halve them once to keep each league's pace.
-- Idempotent: the `intervalsInRealDays` marker records that a league was converted.
BEGIN;
UPDATE sport_leagues
SET settings = (
      settings::jsonb
      || CASE WHEN settings::jsonb ? 'matchIntervalDays'
              THEN jsonb_build_object('matchIntervalDays', round(((settings::jsonb ->> 'matchIntervalDays')::numeric) / 2, 2))
              ELSE '{}'::jsonb END
      || CASE WHEN settings::jsonb ? 'raceIntervalDays'
              THEN jsonb_build_object('raceIntervalDays', round(((settings::jsonb ->> 'raceIntervalDays')::numeric) / 2, 2))
              ELSE '{}'::jsonb END
      || '{"intervalsInRealDays": true}'::jsonb)
WHERE settings IS NOT NULL
  AND (settings::jsonb ? 'matchIntervalDays' OR settings::jsonb ? 'raceIntervalDays')
  AND NOT (settings::jsonb ? 'intervalsInRealDays');
COMMIT;
