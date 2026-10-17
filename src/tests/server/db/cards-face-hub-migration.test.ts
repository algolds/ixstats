/** @jest-environment node */
/**
 * Cards refresh Phase 3 SQL: hand-written and idempotent, run before `db push` (it drops two tables), so what it
 * creates must be exactly what the Prisma schema declares.
 */
import { readdirSync, readFileSync } from "node:fs";

const DIR = "20261031120000_cards_face_hub";
const sql = readFileSync(`prisma/migrations/${DIR}/migration.sql`, "utf8");
const cardsSchema = readFileSync("prisma/schema/cards.prisma", "utf8");
const statements = sql
  .replace(/--[^\n]*/g, "")
  .replace(/\s+/g, " ")
  .trim();
const model = (name: string) =>
  cardsSchema.match(new RegExp(`model ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? "";

describe("cards face-hub migration", () => {
  it("sorts after every earlier cards refresh migration", () => {
    const dirs = readdirSync("prisma/migrations")
      .filter((d) => /^\d{14}_/.test(d))
      .sort();
    const earlier = dirs.filter((d) => /_cards_/.test(d) && d < DIR);
    expect(dirs.indexOf(DIR)).toBeGreaterThan(-1);
    expect(earlier).toContain("20261028120000_cards_admin");
    for (const dir of earlier) expect(dirs.indexOf(DIR)).toBeGreaterThan(dirs.indexOf(dir));
  });

  it("is one transaction, so a failure part-way changes nothing", () => {
    expect(statements.startsWith("BEGIN;")).toBe(true);
    expect(statements.endsWith("COMMIT;")).toBe(true);
  });

  it("adds the collector number the schema declares, unique per realm", () => {
    expect(model("Card")).toMatch(/collectorNumber\s+Int\?/);
    expect(model("Card")).toContain("@@unique([realmId, collectorNumber])");
    expect(statements).toContain(
      'ALTER TABLE "cards" ADD COLUMN IF NOT EXISTS "collectorNumber" INTEGER;'
    );
    expect(statements).toContain(
      'CREATE UNIQUE INDEX IF NOT EXISTS "cards_realmId_collectorNumber_key" ON "cards" ("realmId", "collectorNumber");'
    );
  });

  it("numbers existing cards after the realm's highest number, oldest first", () => {
    expect(statements).toMatch(/UPDATE "cards" AS c SET "collectorNumber" = numbered\.n/);
    expect(statements).toContain(
      'ROW_NUMBER() OVER (PARTITION BY x."realmId" ORDER BY x."createdAt", x."id")'
    );
    expect(statements).toContain('WHERE x."collectorNumber" IS NULL');
  });

  it("numbers every new card under a per-realm lock, so two mints never share a number", () => {
    expect(statements).toContain('CREATE OR REPLACE FUNCTION "cards_assign_collector_number"()');
    expect(statements).toContain('PERFORM pg_advisory_xact_lock(7337, hashtext(NEW."realmId"));');
    expect(statements).toContain(
      'SELECT COALESCE(MAX("collectorNumber"), 0) + 1 INTO NEW."collectorNumber" FROM "cards" WHERE "realmId" = NEW."realmId";'
    );
    expect(statements).toContain(
      'DROP TRIGGER IF EXISTS "cards_assign_collector_number" ON "cards";'
    );
    expect(statements).toContain(
      'CREATE TRIGGER "cards_assign_collector_number" BEFORE INSERT OR UPDATE OF "realmId" ON "cards" FOR EACH ROW'
    );
  });

  it("gives a card that moves realm the next number in its new realm, so the move never trips the unique index", () => {
    expect(statements).toContain(
      `IF NEW."collectorNumber" IS NULL OR (TG_OP = 'UPDATE' AND NEW."realmId" IS DISTINCT FROM OLD."realmId") THEN`
    );
  });

  it("adds the showcase pin the schema declares", () => {
    expect(model("CardCollection")).toMatch(/pinnedAt\s+DateTime\?/);
    expect(model("CardCollection")).toContain("@@index([userId, pinnedAt])");
    expect(statements).toContain(
      'ALTER TABLE "CardCollection" ADD COLUMN IF NOT EXISTS "pinnedAt" TIMESTAMP(3);'
    );
    expect(statements).toContain(
      'CREATE INDEX IF NOT EXISTS "CardCollection_userId_pinnedAt_idx" ON "CardCollection" ("userId", "pinnedAt");'
    );
  });

  it("drops showcase copies their owner no longer holds, now and on every later owner change", () => {
    expect(statements).toMatch(
      /DELETE FROM "CardCollectionItem" AS i USING "CardCollection" AS c, "CardOwnership" AS o WHERE .*o\."ownerId" <> c\."userId";/
    );
    expect(statements).toContain(
      'CREATE TRIGGER "card_showcase_detach_on_transfer" AFTER UPDATE OF "ownerId" ON "CardOwnership" FOR EACH ROW WHEN (OLD."ownerId" IS DISTINCT FROM NEW."ownerId")'
    );
  });

  it("drops the like and comment tables, and is safe to re-run", () => {
    expect(statements).toContain('DROP TABLE IF EXISTS "CollectionLike";');
    expect(statements).toContain('DROP TABLE IF EXISTS "CollectionComment";');
    expect(statements).not.toMatch(/CREATE TABLE (?!IF NOT EXISTS)/);
    expect(statements).not.toMatch(/ADD COLUMN (?!IF NOT EXISTS)/);
    expect(statements).not.toMatch(/CREATE (UNIQUE )?INDEX (?!IF NOT EXISTS)/);
    expect(statements).not.toMatch(/CREATE FUNCTION/);
    expect(statements.match(/CREATE TRIGGER/g)).toHaveLength(
      statements.match(/DROP TRIGGER IF EXISTS/g)?.length ?? 0
    );
  });
});
