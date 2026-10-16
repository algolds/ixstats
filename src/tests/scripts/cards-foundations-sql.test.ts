/** @jest-environment node */
/** Cards refresh §5.5: the additive SQL is safe under the old code; the constraints refuse until the backfill ran. */
import { describe, it, expect } from "@jest/globals";
import { readFileSync } from "node:fs";
import {
  CARDS_CONSTRAINTS_SQL,
  CARDS_FOUNDATIONS_SQL,
} from "../../../scripts/setup/bootstrap-dev-db";

const additive = readFileSync(CARDS_FOUNDATIONS_SQL, "utf8");
const constraints = readFileSync(CARDS_CONSTRAINTS_SQL, "utf8");
const statements = (sql: string) =>
  sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");

describe("cards foundations: additive SQL", () => {
  it("only adds, and every addition is idempotent", () => {
    const body = statements(additive);
    expect(body).not.toMatch(/\bDROP\b|\bUPDATE\b|\bDELETE\b|SET NOT NULL/i);
    for (const line of body.split("\n").filter((l) => /ADD COLUMN/.test(l))) {
      expect(line).toContain("ADD COLUMN IF NOT EXISTS");
    }
    expect(body).toContain('CREATE TABLE IF NOT EXISTS "ns_import_ledger"');
    expect(body).toContain(
      'CREATE UNIQUE INDEX IF NOT EXISTS "ns_import_ledger_nsCardId_nsSeason_nation_key"'
    );
    expect(body).toMatch(/IF NOT EXISTS \(SELECT 1 FROM pg_type WHERE typname = 'CardFinish'\)/);
  });

  it("adds what the schema declares: realm, bound, finish, isSystem", () => {
    expect(additive).toContain('ALTER TABLE "cards" ADD COLUMN IF NOT EXISTS "realmId" TEXT;');
    expect(additive).toContain(
      'ALTER TABLE "cards" ADD COLUMN IF NOT EXISTS "isBound" BOOLEAN NOT NULL DEFAULT false;'
    );
    expect(additive).toContain(
      `ALTER TABLE "CardOwnership" ADD COLUMN IF NOT EXISTS "finish" "CardFinish" NOT NULL DEFAULT 'STANDARD';`
    );
    expect(additive).toContain(
      'ALTER TABLE "realms" ADD COLUMN IF NOT EXISTS "isSystem" BOOLEAN NOT NULL DEFAULT false;'
    );
  });
});

describe("cards foundations: constraint SQL", () => {
  const body = statements(constraints);

  it("refuses before it changes anything while the backfill has not run", () => {
    const guard = body.indexOf("RAISE EXCEPTION");
    expect(guard).toBeGreaterThan(0);
    expect(body.indexOf("ALTER TABLE")).toBeGreaterThan(guard);
    expect(body.indexOf("DROP ")).toBeGreaterThan(guard);
    for (const check of ['"realmId" IS NULL', "NS_IMPORT", "HAVING count(*) > 1"]) {
      expect(body).toContain(check);
    }
  });

  it("refuses while a card points at a missing realm, which would fail the foreign key half way", () => {
    const orphan = body.indexOf('NOT EXISTS (SELECT 1 FROM "realms" r WHERE r."id" = c."realmId")');
    expect(orphan).toBeGreaterThan(0);
    expect(body.indexOf("RAISE EXCEPTION", orphan)).toBeGreaterThan(orphan);
    expect(body.indexOf("ALTER TABLE")).toBeGreaterThan(orphan);
  });

  it("is one transaction, so a failure under psql changes nothing either", () => {
    expect(body.trim().startsWith("BEGIN;")).toBe(true);
    expect(body.trim().endsWith("COMMIT;")).toBe(true);
  });

  it("converts the string columns in place, never by drop and re-add", () => {
    expect(body).toContain(
      'ALTER COLUMN "cardType" TYPE "CardType" USING ("cardType"::"CardType")'
    );
    expect(body).toContain(
      'ALTER COLUMN "rarity" TYPE "CardRarity" USING ("rarity"::"CardRarity")'
    );
    expect(body).not.toMatch(/DROP COLUMN (IF EXISTS )?"(rarity|cardType)"/);
  });

  it("adds both unique keys and the realm foreign key", () => {
    expect(body).toContain(
      'CREATE UNIQUE INDEX IF NOT EXISTS "CardOwnership_cardId_serialNumber_key" ON "CardOwnership"("cardId", "serialNumber");'
    );
    expect(body).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS "cards_lore_natural_key"\s+ON "cards" \(COALESCE\("wikiSource", 'ixwiki'\), lower\("wikiArticleTitle"\)\)\s+WHERE "cardType" = 'LORE';/
    );
    expect(body).toContain('FOREIGN KEY ("realmId") REFERENCES "realms"("id") ON DELETE RESTRICT');
  });

  it("drops the dead tables, columns, enums and config keys idempotently", () => {
    for (const table of [
      '"CraftingHistory"',
      '"CraftingRecipe"',
      '"CardTrade"',
      '"ns_imports"',
      '"sync_checkpoints"',
    ]) {
      expect(body).toContain(`DROP TABLE IF EXISTS ${table}`);
    }
    for (const type of ['"AcquireMethod"', '"AuctionStatus"', '"TradeStatus"']) {
      expect(body).toContain(`DROP TYPE IF EXISTS ${type}`);
    }
    expect(body).toContain('DROP COLUMN IF EXISTS "userId"');
    expect(body).toContain("'card_system_max_junk_batch_size'");
    expect(body).toContain("'card_valuation_junk_rate'");
  });
});
