-- Realm time, WP-T3: platform systems on real time (design 2026-10-25 §3).
-- The exchange and sports stop writing IxTime into their *IxTime / ixTime Float columns and write real epoch-ms
-- (Date.now()) instead; ThinkTank posts stop stamping ixTimeTimestamp with IxTime. This converts the rows already
-- stored, so open contracts, queued decisions, running seasons and scheduled fixtures keep their deadlines, and every
-- column holds one meaning (history tables are ordered by these columns, so they convert too).
--
-- Run it in the same window as the T3 code deploy (old code would read the converted deadlines as IxTime and fire
-- them at once; new code would read unconverted ones as far in the future):
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/migrations/2026-10-realm-time/t3-platform-real-time.sql
--
-- Idempotent: only values above 2035-01-01 (epoch-ms 2051222400000) are IxTime. Real time stays below that until
-- 2035, and every IxTime written since 2023 is above it (IxTime passed 2040 in July 2025), so a re-run converts
-- nothing.
--
-- The conversion is the inverse of IxTime.convertToIxTime (src/lib/ixtime/core.ts), including the bot's shared
-- override (SystemConfig `ixtime_clock_state`, src/lib/ixtime/shared-clock.ts):
--   - at or after an override anchor: real = timeOverrideSetAt + (ix - timeOverride) / multiplier
--     (multiplierOverride, or the natural 2x; a paused clock (0) maps at 2x so its deadlines still arrive);
--   - otherwise the canonical clock: 2x from 2040-01-01 IxTime = 2025-07-27 real (2208988800000 / 1753574400000),
--     4x from the real-world epoch 2020-10-04 (1601769600000) before that.
--
-- Size first (read-only):
--   SELECT count(*) FILTER (WHERE "endIxTime" > 2051222400000), count(*) FROM exchange_contracts;
--   SELECT status, count(*) FILTER (WHERE "startIxTime" > 2051222400000), count(*) FROM sport_seasons GROUP BY 1;
--   SELECT status, count(*) FILTER (WHERE "scheduledIxTime" > 2051222400000), count(*) FROM sport_matches GROUP BY 1;

BEGIN;

CREATE TEMP TABLE t3_clock ON COMMIT DROP AS
SELECT (v ->> 'timeOverride')::float8 AS t_override,
       (v ->> 'timeOverrideSetAt')::float8 AS t_set_at,
       COALESCE(NULLIF((v ->> 'multiplierOverride')::float8, 0), 2) AS mult
FROM (SELECT value::jsonb AS v FROM "SystemConfig" WHERE key = 'ixtime_clock_state') s
WHERE jsonb_typeof(v) = 'object';

CREATE FUNCTION pg_temp.t3_real(ix float8) RETURNS float8 LANGUAGE sql STABLE AS $$
  SELECT CASE
    WHEN ix IS NULL OR ix <= 2051222400000 THEN ix
    WHEN c.t_override IS NOT NULL AND c.t_set_at IS NOT NULL AND ix >= c.t_override
      THEN c.t_set_at + (ix - c.t_override) / c.mult
    WHEN ix >= 2208988800000 THEN 1753574400000 + (ix - 2208988800000) / 2
    ELSE 1601769600000 + (ix - 1601769600000) / 4
  END
  FROM (SELECT 1) one LEFT JOIN (SELECT * FROM t3_clock LIMIT 1) c ON true
$$;

-- Exchange ------------------------------------------------------------------------------------------------------

UPDATE exchange_contracts
SET "endIxTime" = pg_temp.t3_real("endIxTime"),
    "createdIxTime" = pg_temp.t3_real("createdIxTime"),
    "closedIxTime" = pg_temp.t3_real("closedIxTime")
WHERE GREATEST("endIxTime", "createdIxTime", COALESCE("closedIxTime", 0)) > 2051222400000;

UPDATE exchange_contract_bids SET "createdIxTime" = pg_temp.t3_real("createdIxTime")
WHERE "createdIxTime" > 2051222400000;

UPDATE exchange_company_decisions
SET "submittedIxTime" = pg_temp.t3_real("submittedIxTime"),
    "appliedIxTime" = pg_temp.t3_real("appliedIxTime")
WHERE GREATEST("submittedIxTime", COALESCE("appliedIxTime", 0)) > 2051222400000;

UPDATE exchange_companies SET "createdIxTime" = pg_temp.t3_real("createdIxTime")
WHERE "createdIxTime" > 2051222400000;

UPDATE exchange_company_value_history SET "recordedIxTime" = pg_temp.t3_real("recordedIxTime")
WHERE "recordedIxTime" > 2051222400000;

UPDATE exchange_share_issuances SET "issuedIxTime" = pg_temp.t3_real("issuedIxTime")
WHERE "issuedIxTime" > 2051222400000;

UPDATE exchange_share_listings SET "createdIxTime" = pg_temp.t3_real("createdIxTime")
WHERE "createdIxTime" > 2051222400000;

UPDATE exchange_company_dividends SET "ixTime" = pg_temp.t3_real("ixTime")
WHERE "ixTime" > 2051222400000;

UPDATE exchange_sector_indices SET "computedIxTime" = pg_temp.t3_real("computedIxTime")
WHERE "computedIxTime" > 2051222400000;

UPDATE exchange_sector_index_history SET "recordedIxTime" = pg_temp.t3_real("recordedIxTime")
WHERE "recordedIxTime" > 2051222400000;

UPDATE exchange_conversion_logs SET "ixTime" = pg_temp.t3_real("ixTime")
WHERE "ixTime" > 2051222400000;

UPDATE exchange_transactions SET "ixTime" = pg_temp.t3_real("ixTime")
WHERE "ixTime" > 2051222400000;

-- Sports --------------------------------------------------------------------------------------------------------

UPDATE sport_seasons
SET "startIxTime" = pg_temp.t3_real("startIxTime"),
    "endIxTime" = pg_temp.t3_real("endIxTime")
WHERE GREATEST("startIxTime", COALESCE("endIxTime", 0)) > 2051222400000;

UPDATE sport_matches
SET "scheduledIxTime" = pg_temp.t3_real("scheduledIxTime"),
    "resolvedIxTime" = pg_temp.t3_real("resolvedIxTime")
WHERE GREATEST("scheduledIxTime", COALESCE("resolvedIxTime", 0)) > 2051222400000;

UPDATE sport_brackets
SET "scheduledIxTime" = pg_temp.t3_real("scheduledIxTime"),
    "resolvedIxTime" = pg_temp.t3_real("resolvedIxTime")
WHERE GREATEST("scheduledIxTime", COALESCE("resolvedIxTime", 0)) > 2051222400000;

UPDATE sport_races
SET "qualifyingIxTime" = pg_temp.t3_real("qualifyingIxTime"),
    "raceIxTime" = pg_temp.t3_real("raceIxTime")
WHERE GREATEST(COALESCE("qualifyingIxTime", 0), COALESCE("raceIxTime", 0)) > 2051222400000;

UPDATE sport_predictions
SET "createdIxTime" = pg_temp.t3_real("createdIxTime"),
    "resolvedIxTime" = pg_temp.t3_real("resolvedIxTime")
WHERE GREATEST("createdIxTime", COALESCE("resolvedIxTime", 0)) > 2051222400000;

UPDATE sport_rookie_classes SET "generatedIxTime" = pg_temp.t3_real("generatedIxTime")
WHERE "generatedIxTime" > 2051222400000;

UPDATE sport_players SET "contractExpiresIxTime" = pg_temp.t3_real("contractExpiresIxTime")
WHERE "contractExpiresIxTime" > 2051222400000;

UPDATE sport_teams SET "foundedIxTime" = pg_temp.t3_real("foundedIxTime")
WHERE "foundedIxTime" > 2051222400000;

-- ThinkPages ----------------------------------------------------------------------------------------------------

-- ThinkTank posts outside realm boards were stamped with IxTime (years ahead of createdAt); the feed orders by this
-- column, so they take their real creation time.
UPDATE "ThinkpagesPost" SET "ixTimeTimestamp" = "createdAt"
WHERE visibility = 'thinktank' AND "ixTimeTimestamp" > "createdAt" + interval '1 year';

COMMIT;
