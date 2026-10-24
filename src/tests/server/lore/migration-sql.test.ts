/** @jest-environment node */
/**
 * The country-lore migration: the lore team and the owner's curation tables. It is one transaction, creates both
 * tables and both unique keys idempotently, and cascades the lore team with its country and user.
 */
import { readFileSync } from "node:fs";

const FILE = "prisma/migrations/20261104120000_country_lore/migration.sql";
/** The SQL with its full-line comments gone and its whitespace collapsed. */
const body = readFileSync(FILE, "utf8")
  .replace(/^\s*--[^\n]*/gm, "")
  .replace(/\s+/g, " ")
  .trim();

describe("the country-lore migration SQL", () => {
  it("is one transaction", () => {
    expect(body.startsWith("BEGIN;")).toBe(true);
    expect(body.endsWith("COMMIT;")).toBe(true);
  });

  it("creates both tables idempotently", () => {
    expect(body).toMatch(/CREATE TABLE IF NOT EXISTS "country_lore_authors"/);
    expect(body).toMatch(/CREATE TABLE IF NOT EXISTS "country_lore_pages"/);
  });

  it("creates both unique keys idempotently", () => {
    expect(body).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS "country_lore_authors_countryId_userId_key" ON "country_lore_authors"\("countryId", "userId"\)/
    );
    expect(body).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS "country_lore_pages_countryId_title_key" ON "country_lore_pages"\("countryId", "title"\)/
    );
  });

  it("indexes the lookups", () => {
    expect(body).toMatch(/CREATE INDEX IF NOT EXISTS "country_lore_authors_userId_idx"/);
    expect(body).toMatch(/CREATE INDEX IF NOT EXISTS "country_lore_pages_countryId_idx"/);
  });

  it("cascades the lore team with its country and its user, guarded for a re-run", () => {
    expect(body).toMatch(
      /"country_lore_authors_countryId_fkey" FOREIGN KEY \("countryId"\) REFERENCES "Country"\("id"\) ON DELETE CASCADE/
    );
    expect(body).toMatch(
      /"country_lore_authors_userId_fkey" FOREIGN KEY \("userId"\) REFERENCES "User"\("id"\) ON DELETE CASCADE/
    );
    expect(body).toMatch(/IF NOT EXISTS \(SELECT 1 FROM pg_constraint WHERE conname = 'country_lore_authors_countryId_fkey'\)/);
  });
});
