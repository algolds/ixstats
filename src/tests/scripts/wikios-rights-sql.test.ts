/** @jest-environment node */
// Plan 409: the operator's rights SQL is applied by hand, possibly more than once. This checks, without a
// database, that every statement in it is written to be safe to run again and that the backfill keeps
// its guards.
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
  it("has only statements that can be run twice", () => {
    for (const statement of statements) {
      if (/^(BEGIN|COMMIT)$/.test(statement)) continue;
      const repeatable =
        /^CREATE TABLE IF NOT EXISTS /.test(statement) ||
        /^CREATE (UNIQUE )?INDEX IF NOT EXISTS /.test(statement) ||
        /^ALTER TABLE "\w+" ADD COLUMN IF NOT EXISTS /.test(statement) ||
        /^INSERT INTO .* ON CONFLICT \([^)]*\) DO NOTHING$/.test(statement);
      expect({ statement, repeatable }).toEqual({ statement, repeatable: true });
    }
  });

  it("balances its transactions", () => {
    const count = (word: string) => statements.filter((s) => s === word).length;
    expect(count("BEGIN")).toBe(count("COMMIT"));
    expect(count("BEGIN")).toBeGreaterThan(0);
  });

  it("adds the wiki link columns the review asked for", () => {
    for (const column of ["verifiedById", "mwRegisteredAt", "mwEditCount"]) {
      expect(SQL).toContain(`ADD COLUMN IF NOT EXISTS "${column}"`);
    }
  });

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
