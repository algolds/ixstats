-- Plan 340, Step 3 — READ-ONLY diagnostic. Do not backfill from this file.
--
-- Before the fix, the manual-result path (leagues/schedule.ts) wrote real-time seconds
-- (Date.now() / 1000, ~1.7e9) into "resolvedIxTime", which everywhere else holds IxTime
-- milliseconds (> 1e12). Those matches sort as ~1970 and drop out of "latest results".
-- This counts the rows written that way.
--
-- Run against the ixstats database (Docker container ixstats-postgres, host port 5433).

SELECT count(*) AS second_based_rows
FROM "sport_matches"
WHERE "resolvedIxTime" IS NOT NULL
  AND "resolvedIxTime" < 1e11;
