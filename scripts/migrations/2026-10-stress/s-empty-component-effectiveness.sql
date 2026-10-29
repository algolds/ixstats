-- Issue content tuning S (owner decision 3): a stored soft score is a lasting offset over the derived one,
-- so an empty component save's governmentEffectiveness 0 read as a -50 offset. A nation with no components
-- stores the seeded 50 (no offset), as the save now writes. Data only, idempotent; safe before or after the code.
UPDATE "GovernmentStructure" gs
SET "governmentEffectiveness" = 50
WHERE gs."governmentEffectiveness" = 0
  AND NOT EXISTS (SELECT 1 FROM "GovernmentComponent" gc WHERE gc."countryId" = gs."countryId");
