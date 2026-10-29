-- Agent C (owner ruling 2026-10-28): an alliance whose founder left before succession existed gets its
-- longest-standing active member as founder; an alliance whose members all left is dissolved. Idempotent.
-- Alliances created by a realm source sync (externalSourceKey) and alliances that never had a member are left alone.
BEGIN;

UPDATE "AllianceMember" m
SET role = 'founder', "updatedAt" = now()
WHERE m.id IN (
  SELECT DISTINCT ON (am."allianceId") am.id
  FROM "AllianceMember" am
  WHERE am."isActive"
    AND NOT EXISTS (
      SELECT 1 FROM "AllianceMember" f
      WHERE f."allianceId" = am."allianceId" AND f."isActive" AND f.role = 'founder'
    )
  ORDER BY am."allianceId", am."joinedAt" ASC, am.id ASC
);

DELETE FROM "Alliance" a
WHERE a."externalSourceKey" IS NULL
  AND NOT EXISTS (SELECT 1 FROM "AllianceMember" m WHERE m."allianceId" = a.id AND m."isActive")
  AND EXISTS (SELECT 1 FROM "AllianceMember" m WHERE m."allianceId" = a.id AND m.status = 'left');

UPDATE "Alliance" a
SET "memberCount" = (SELECT count(*) FROM "AllianceMember" m WHERE m."allianceId" = a.id AND m."isActive")
WHERE a."memberCount" <> (SELECT count(*) FROM "AllianceMember" m WHERE m."allianceId" = a.id AND m."isActive");

COMMIT;
