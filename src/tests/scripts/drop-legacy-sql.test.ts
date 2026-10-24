/** @jest-environment node */
/**
 * The IxnayID removal SQL (design: "Removal (last)"): it drops the legacy User wiki columns and the IxWiki link rows,
 * refuses while legacy data exists that the conversion never marked, keeps the sister-wiki links, and is a no-op when
 * the deploy runs it again.
 */
import { readFileSync } from "node:fs";

const FILE = "prisma/migrations/20261103120001_ixnayid_drop_legacy/migration.sql";
/** The SQL with its full-line comments gone (the guard's message names `--apply`) and its whitespace collapsed. */
const body = readFileSync(FILE, "utf8")
  .replace(/^\s*--[^\n]*/gm, "")
  .replace(/\s+/g, " ");
const guard = body.match(/DO \$\$(.*?)\$\$;/)?.[1] ?? "";
const unguarded = body.replace(/DO \$\$.*?\$\$;/g, "");

describe("the IxnayID removal SQL", () => {
  it("refuses unless the conversion left its marker", () => {
    expect(guard).toContain(
      `NOT EXISTS (SELECT 1 FROM "AdminAuditLog" WHERE "action" = 'WIKI_NAME_CLAIMS_CONVERTED')`
    );
    expect(guard).toMatch(/RAISE EXCEPTION '[^']*convert-wiki-name-claims\.ts --apply'/);
  });

  it("refuses while the legacy column or an IxWiki link is still there to convert", () => {
    expect(guard).toMatch(
      /information_schema\.columns WHERE table_schema = current_schema\(\) AND table_name = 'User' AND column_name = 'wikiUsername'/
    );
    expect(guard).toContain(
      `EXISTS (SELECT 1 FROM "wiki_account_links" WHERE "source" = 'ixwiki')`
    );
  });

  it("checks before it deletes or drops anything", () => {
    expect(body.indexOf("DO $$")).toBeLessThan(body.indexOf("DELETE"));
    expect(body.indexOf("DO $$")).toBeLessThan(body.indexOf("DROP"));
    expect(body).toMatch(/^ ?BEGIN; .* COMMIT; ?$/);
  });

  it("deletes only the IxWiki links, so the sister-wiki links stay", () => {
    const deletes = [...unguarded.matchAll(/DELETE FROM ([^;]*);/g)].map((m) => m[1]!.trim());
    expect(deletes).toEqual([`"wiki_account_links" WHERE "source" = 'ixwiki'`]);
  });

  it("drops the three legacy User columns, each only if it is still there", () => {
    const drops = [...unguarded.matchAll(/DROP COLUMN ([^;]*);/g)].map((m) => m[1]!.trim());
    expect(drops).toEqual([
      `IF EXISTS "wikiUsername"`,
      `IF EXISTS "wikiUserId"`,
      `IF EXISTS "lastWikiSync"`,
    ]);
    expect(unguarded).not.toMatch(/DROP (TABLE|INDEX|TYPE|CONSTRAINT)/i);
  });
});
