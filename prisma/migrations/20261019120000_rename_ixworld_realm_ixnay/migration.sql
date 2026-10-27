-- The tenant-0 realm (id "default") is Ixnay, slug "ixnay". The old slugs "ixworld" and "default" still resolve in
-- code (isIxnaySlug) and /r/ixworld, /thinkpages/r/ixworld redirect (next.config.js). The name changes only while it is
-- still the old one, and the slug only if no other realm has taken "ixnay".
UPDATE "realms" SET "name" = 'Ixnay' WHERE "id" = 'default' AND "name" = 'IxWorld';
UPDATE "realms" SET "slug" = 'ixnay'
WHERE "id" = 'default' AND NOT EXISTS (SELECT 1 FROM "realms" WHERE "slug" = 'ixnay' AND "id" <> 'default');
