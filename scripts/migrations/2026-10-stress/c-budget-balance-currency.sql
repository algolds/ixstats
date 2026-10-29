-- Agent C (C-12): Country."budgetDeficitSurplus" is a currency amount (the builder writes revenue minus spending, and
-- the economy tiles show it as $). A few rows were entered as a percent of GDP through the economy editor (e.g. 0.5):
-- an amount under 100 in magnitude cannot be a real national budget balance, so it is read as % of GDP and stored
-- as currency. Idempotent: converted rows are far above 100 in magnitude.
UPDATE "Country"
SET "budgetDeficitSurplus" = "budgetDeficitSurplus" / 100.0 * "currentTotalGdp"
WHERE "budgetDeficitSurplus" <> 0
  AND abs("budgetDeficitSurplus") < 100
  AND "currentTotalGdp" > 0;
