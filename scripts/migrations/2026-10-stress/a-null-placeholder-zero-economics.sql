-- Stress test A (2026-10-28): legacy seed rows carry 0 as "unknown" for Gini and for tax revenue.
-- A Gini of exactly 0 (perfect equality) and a 0% tax take with 0 revenue are impossible for a nation; MyCountry
-- showed "Gini 0.0 (Low)" and fed 0 into the stability formula. Null means "not recorded", which every reader shows
-- as "—" and the engine replaces with its stand-in. Idempotent: reruns match nothing.
UPDATE "Country" SET "incomeInequalityGini" = NULL WHERE "incomeInequalityGini" = 0;
UPDATE "Country"
SET "taxRevenueGDPPercent" = NULL, "governmentRevenueTotal" = NULL
WHERE "taxRevenueGDPPercent" = 0 AND COALESCE("governmentRevenueTotal", 0) = 0;
-- The same seed rows hold 0 for social mobility, poverty, life expectancy and literacy (MyCountry showed
-- "Social mobility 0/100"); none can be 0 for a real nation.
UPDATE "Country" SET "socialMobilityIndex" = NULL WHERE "socialMobilityIndex" = 0;
UPDATE "Country" SET "povertyRate" = NULL WHERE "povertyRate" = 0;
UPDATE "Country" SET "lifeExpectancy" = NULL WHERE "lifeExpectancy" = 0;
UPDATE "Country" SET "literacyRate" = NULL WHERE "literacyRate" = 0;
