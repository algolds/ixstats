-- MyCountry final round, R1: sanction asymmetry. Re-values the GDP level effects of sanctions, embargoes and
-- blockades still in force with the new rule (src/lib/statecraft/foreign-policy.ts): the target takes
-- base x severity x leverage (base: sanction 1%, embargo 1.5%, blockade 2.5%; severity light 0.5, moderate 1,
-- severe 1.5; leverage sqrt(initiator GDP / target GDP) clamped 0.5-2), the initiator a quarter of that divided
-- by leverage squared. The old rule cost the initiator a flat 0.5-1.2% and the target a few millionths.
--
-- Idempotent: only actions whose target hit is under 0.2% are touched; the new rule never goes below 0.25%, so a
-- re-run changes nothing. Run any time, and again after the R1 code deploy if a coercive action was imposed in
-- between (lifting or expiry unwinds whatever value the effect rows hold, so re-valued rows still unwind exactly).
--
--   run_sql scripts/migrations/2026-10-mycountry/r1-coercive-fp-effects.sql
--
-- Size first (read-only):
--   SELECT "actionType", severity, "initiatorGdpImpact", "targetGdpImpact" FROM "ForeignPolicyAction"
--   WHERE status = 'active' AND "actionType" IN ('sanction', 'embargo', 'blockade')
--     AND abs("targetGdpImpact") < 0.002;

BEGIN;

CREATE TEMP TABLE r1_fp_revalue ON COMMIT DROP AS
WITH sized AS (
  SELECT a.id, a."initiatorId", a."targetId", a."actionType", a.severity,
         i.name AS initiator_name, t.name AS target_name,
         CASE a."actionType" WHEN 'sanction' THEN 0.01 WHEN 'embargo' THEN 0.015 ELSE 0.025 END
           * CASE a.severity WHEN 'light' THEN 0.5 WHEN 'severe' THEN 1.5 ELSE 1.0 END AS hit,
         LEAST(2.0, GREATEST(0.5, sqrt(
           (COALESCE(NULLIF(i."currentGdpPerCapita", 0), 10000) * COALESCE(NULLIF(i."currentPopulation", 0), 1000000))
           / (COALESCE(NULLIF(t."currentGdpPerCapita", 0), 10000) * COALESCE(NULLIF(t."currentPopulation", 0), 1000000))
         ))) AS leverage
  FROM "ForeignPolicyAction" a
  JOIN "Country" i ON i.id = a."initiatorId"
  JOIN "Country" t ON t.id = a."targetId"
  WHERE a.status = 'active'
    AND a."actionType" IN ('sanction', 'embargo', 'blockade')
    AND abs(a."targetGdpImpact") < 0.002
)
SELECT id, "initiatorId", "targetId",
       -(hit * leverage) AS target_impact,
       -(hit * leverage) * 0.25 / (leverage * leverage) AS initiator_impact,
       'Foreign policy: ' || "actionType" || ' (' || severity || ') against ' || target_name AS initiator_description,
       'Affected by ' || initiator_name || ': ' || "actionType" || ' (' || severity || ')' AS target_description
FROM sized;

-- The initiator's effect row: keyed by the action, or (rows written before the key) by nation and description.
UPDATE "DmInputs" e
SET value = r.initiator_impact, "updatedAt" = now()
FROM r1_fp_revalue r
WHERE e."isActive" AND e."countryId" = r."initiatorId"
  AND (e."createdBy" = 'fp:' || r.id OR e.description = r.initiator_description)
  AND e.description NOT LIKE 'Ended:%';

-- The target's effect row.
UPDATE "DmInputs" e
SET value = r.target_impact, "updatedAt" = now()
FROM r1_fp_revalue r
WHERE e."isActive" AND e."countryId" = r."targetId"
  AND (e."createdBy" = 'fp:' || r.id OR e.description = r.target_description)
  AND e.description NOT LIKE 'Ended:%';

UPDATE "ForeignPolicyAction" a
SET "initiatorGdpImpact" = r.initiator_impact, "targetGdpImpact" = r.target_impact, "updatedAt" = now()
FROM r1_fp_revalue r
WHERE a.id = r.id;

COMMIT;
