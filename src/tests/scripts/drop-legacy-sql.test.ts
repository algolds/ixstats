/** @jest-environment node */
/**
 * The IxnayID removal SQL (design: "Removal (last)"): it deletes the IxWiki link rows, refuses while one exists that
 * the conversion never marked, keeps the sister-wiki links and the legacy User columns (the old app still reads them
 * while the new one builds), and is a no-op when the deploy runs it again.
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

  it("refuses while an IxWiki link is still there to convert", () => {
    expect(guard).toContain(
      `EXISTS (SELECT 1 FROM "wiki_account_links" WHERE "source" = 'ixwiki')`
    );
  });

  it("checks before it deletes anything", () => {
    expect(body.indexOf("DO $$")).toBeLessThan(body.indexOf("DELETE"));
    expect(body).toMatch(/^ ?BEGIN; .* COMMIT; ?$/);
  });

  it("deletes only the IxWiki links, so the sister-wiki links stay", () => {
    const deletes = [...unguarded.matchAll(/DELETE FROM ([^;]*);/g)].map((m) => m[1]!.trim());
    expect(deletes).toEqual([`"wiki_account_links" WHERE "source" = 'ixwiki'`]);
  });

  it("drops nothing, so the old app's User reads keep working until the new one starts", () => {
    expect(unguarded).not.toMatch(/\b(DROP|ALTER)\b/i);
  });

  it("keeps the legacy User columns in the schema, unread, for one release", () => {
    const user = readFileSync("prisma/schema/core.prisma", "utf8").match(/model User \{[\s\S]*?\n\}/)?.[0] ?? "";
    for (const column of ["wikiUserId", "wikiUsername", "lastWikiSync"]) {
      expect(user).toMatch(new RegExp(`\\n\\s*${column}\\s+\\w+\\?\\s+@ignore\\n`));
    }
  });
});
