-- Plan 336 Step 5: SportMatch (status, resolvedIxTime) index for getLiveMatches.
-- OPERATOR-APPLIED. Never run by an executor. On production run it outside a transaction:
CREATE INDEX CONCURRENTLY IF NOT EXISTS "sport_matches_status_resolvedIxTime_idx"
  ON "sport_matches" ("status", "resolvedIxTime");
