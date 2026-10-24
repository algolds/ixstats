/** @jest-environment node */
// Plan 409: the operator's rights SQL is applied by hand. Its default-protections backfill is what the rights import's
// step-1 check (scripts/wikios-import-rights.ts, assertDefaultProtectionsApplied) waits for, so it keeps its guards.
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SQL = readFileSync(
  join(process.cwd(), "prisma/manual-migrations/2026-09-30-wikios-rights.sql"),
  "utf8"
);
/** The statements, comments and blank lines removed. */
const statements = SQL.replace(/--.*$/gm, "")
  .split(";")
  .map((statement) => statement.replace(/\s+/g, " ").trim())
  .filter(Boolean);

describe("2026-09-30-wikios-rights.sql", () => {
  it("backfills an edit restriction from every protected page that has not expired, failing closed", () => {
    const backfill = statements.find((s) => s.startsWith('INSERT INTO "wiki_restrictions"')) ?? "";
    expect(backfill).toContain(`"protectionLevel" <> 'ALL'`);
    expect(backfill).toContain(
      `"protectionExpiry" IS NULL OR a."protectionExpiry" > CURRENT_TIMESTAMP`
    );
    expect(backfill).toContain(`WHEN 'AUTOCONFIRMED' THEN 'autoconfirmed' ELSE 'sysop'`);
    expect(backfill).toContain(`'edit'`);
    expect(backfill).toContain(`ON CONFLICT ("source", "title", "action") DO NOTHING`);
  });
});
