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

  /** The refusal whose message contains `message`: its index, and the column check that gates it. */
  const refusal = (message: string) => {
    const at = body.indexOf(message);
    const gate = body.lastIndexOf("column_name = ", at);
    return { at, gatedOn: body.slice(gate, body.indexOf(")", gate)) };
  };

  it("refuses, before the drops, while an NS card's stats or nsData have not reached metadata.nsData", () => {
    for (const [message, column] of [
      ["NS cards have stats but no metadata.nsData", "stats"],
      ["NS cards have nsData but no metadata.nsData", "nsData"],
    ] as const) {
      const check = refusal(message);
      expect(check.at).toBeGreaterThan(0);
      expect(check.gatedOn).toBe(`column_name = '${column}'`);
      expect(body.indexOf(`DROP COLUMN IF EXISTS "${column}"`)).toBeGreaterThan(check.at);
    }
    expect(body).toContain(`jsonb_typeof("metadata"->'nsData') IS DISTINCT FROM 'object'`);
  });

  it("refuses, before the drops, while an artworkUrl has not reached a blank artwork", () => {
    const check = refusal("cards have an artworkUrl but no artwork");
    expect(check.at).toBeGreaterThan(0);
    expect(check.gatedOn).toBe("column_name = 'artworkUrl'");
    expect(body).toContain(`"artworkUrl" ~ '\\S' AND ("artwork" IS NULL OR "artwork" !~ '\\S')`);
    expect(body.indexOf('DROP COLUMN IF EXISTS "artworkUrl"')).toBeGreaterThan(check.at);
  });

  it("is one block, so its one-shot gate covers every statement in the file", () => {
    expect(body.trim()).toMatch(/^BEGIN;\s*DO \$\$[\s\S]*\$\$;\s*COMMIT;$/);
    expect(body.match(/\$\$/g)).toHaveLength(2);
  });

  it("does nothing once the types are enums and the dead tables are gone: no lock, no DROP TYPE, no DELETE", () => {
    const gate = body.indexOf("EXIT conversion WHEN");
    expect(gate).toBeGreaterThan(0);
    for (const first of ["RAISE EXCEPTION", "ALTER TABLE", "DROP ", "DELETE ", "CREATE "]) {
      expect(body.indexOf(first)).toBeGreaterThan(gate);
    }
    const condition = body.slice(gate, body.indexOf(";", gate));
    expect(condition).toContain("column_name = 'cardType') = 'CardType'");
    for (const table of [
      '"CraftingHistory"',
      '"CraftingRecipe"',
      '"CardTrade"',
      '"ns_imports"',
      '"sync_checkpoints"',
    ]) {
      expect(condition).toContain(`to_regclass('${table}') IS NULL`);
    }
    // Everything that changes the database sits inside the gated block, apart from the Lore natural key below.
    const end = body.indexOf("END conversion;");
    expect(body.lastIndexOf("DELETE FROM")).toBeLessThan(end);
    expect(body.lastIndexOf("DROP ")).toBeLessThan(end);
    expect(body.lastIndexOf("ALTER TABLE")).toBeLessThan(end);
  });

  it("still adds the Lore natural key on a fresh database, where the gate holds from the start", () => {
    const end = body.indexOf("END conversion;");
    const key = body.indexOf('CREATE UNIQUE INDEX IF NOT EXISTS "cards_lore_natural_key"');
    expect(key).toBeGreaterThan(end);
    expect(
      body.lastIndexOf("IF to_regclass('cards_lore_natural_key') IS NULL THEN", key)
    ).toBeGreaterThan(end);
  });
});
