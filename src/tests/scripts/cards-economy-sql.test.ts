/** @jest-environment node */
/**
 * Cards refresh Phase 4 SQL: hand-written and idempotent. It runs before `db push` on an existing database (it converts
 * the status columns in place and drops two columns), and after it on a fresh one, where every statement is a no-op;
 * so what it creates must be exactly what the Prisma schema declares.
 */
import { readdirSync, readFileSync } from "node:fs";
import { CARDS_ECONOMY_SQL } from "../../../scripts/setup/bootstrap-dev-db";

const DIR = "20261101120000_cards_economy";
const sql = readFileSync(CARDS_ECONOMY_SQL, "utf8");
const statements = sql
  .replace(/--[^\n]*/g, "")
  .replace(/\s+/g, " ")
  .trim();
const schema = (file: string) => readFileSync(`prisma/schema/${file}.prisma`, "utf8");
const block = (file: string, kind: "model" | "enum", name: string) =>
  schema(file).match(new RegExp(`${kind} ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? "";
const model = (name: string) => block("cards", "model", name);
/** The statements between `from` and the next `END IF;`: what a one-shot guard runs. */
const guarded = (from: string) => {
  const at = statements.indexOf(from);
  return at < 0 ? "" : statements.slice(at, statements.indexOf("END IF;", at));
};

describe("the cards economy SQL", () => {
  it("lives at the Phase 4 stamp, sorting after every earlier cards refresh migration", () => {
    expect(CARDS_ECONOMY_SQL).toBe(`prisma/migrations/${DIR}/migration.sql`);
    const dirs = readdirSync("prisma/migrations")
      .filter((d) => /^\d{14}_/.test(d))
      .sort();
    const cards = dirs.filter((d) => /_cards_/.test(d));
    expect(cards).toContain("20261031120000_cards_face_hub");
    expect(cards.at(-1)).toBe(DIR);
  });

  it("is one transaction, so a failure part-way changes nothing", () => {
    expect(statements.startsWith("BEGIN;")).toBe(true);
    expect(statements.endsWith("COMMIT;")).toBe(true);
  });

  it("is safe to re-run: every create and add is guarded", () => {
    expect(statements).not.toMatch(/CREATE TABLE (?!IF NOT EXISTS)/);
    expect(statements).not.toMatch(/ADD COLUMN (?!IF NOT EXISTS)/);
    expect(statements).not.toMatch(/CREATE (UNIQUE )?INDEX (?!IF NOT EXISTS)/);
    expect(statements).not.toMatch(/DROP (COLUMN|INDEX) (?!IF EXISTS)/);
    for (const type of ["TradeOfferStatus", "CardAuctionStatus", "CardListingStatus"]) {
      expect(statements).toContain(
        `IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = '${type}') THEN CREATE TYPE "${type}" AS ENUM`
      );
    }
  });

  it("creates every new table idempotently", () => {
    for (const table of [
      "card_listings",
      "card_dust_balances",
      "card_dust_events",
      "card_market_prices",
      "card_notification_mutes",
      "card_inscription_reports",
    ]) {
      expect(statements).toContain(`CREATE TABLE IF NOT EXISTS "${table}"`);
      expect(schema("cards")).toContain(`@@map("${table}")`);
    }
  });

  it("refuses to convert a status column holding an unknown value, and converts only a text column", () => {
    expect(statements).toMatch(/RAISE EXCEPTION 'TradeOffer\.status/);
    expect(statements).toMatch(/RAISE EXCEPTION 'CardAuction\.status/);
    expect(statements).toContain(
      `ALTER TABLE "TradeOffer" ALTER COLUMN "status" TYPE "TradeOfferStatus" USING "status"::"TradeOfferStatus";`
    );
    expect(statements).toContain(
      `ALTER TABLE "CardAuction" ALTER COLUMN "status" TYPE "CardAuctionStatus" USING "status"::"CardAuctionStatus";`
    );
    expect(statements.match(/column_name = 'status'\) = 'text' THEN/g)).toHaveLength(2);
    expect(model("TradeOffer")).toMatch(/status\s+TradeOfferStatus\n/);
    expect(model("CardAuction")).toMatch(/status\s+CardAuctionStatus\s+@default\(ACTIVE\)/);
    expect(block("enums", "enum", "TradeOfferStatus").split(/\s+/).filter(Boolean)).toEqual([
      "PENDING",
      "ACCEPTED",
      "REJECTED",
      "CANCELLED",
      "EXPIRED",
    ]);
  });

  it("clamps levels to 10 once, on the deploy that adds the daily XP cap, and keeps XP", () => {
    const clamp = `UPDATE "CardOwnership" SET "level" = 10 WHERE "level" > 10;`;
    expect(guarded(`AND column_name = 'xpDay') THEN`)).toContain(clamp);
    expect(statements).not.toMatch(/SET "experience"/);
    expect(model("CardOwnership")).toMatch(/xpDay\s+DateTime\?\s+@db\.Date/);
  });

  it("records each event's finish, filled in for old rows, and stamps old rows with their card and serial", () => {
    expect(statements).toContain(
      `ALTER TABLE "card_transfer_events" ADD COLUMN IF NOT EXISTS "finish" "CardFinish";`
    );
    expect(statements).toContain(
      `UPDATE "card_transfer_events" e SET "finish" = o."finish" FROM "CardOwnership" o WHERE e."ownershipId" = o.id AND e."finish" IS NULL;`
    );
    // A burned copy's serial stays issued: the high-water mark reads the events (serial-number.ts)
    expect(statements).toContain(
      `UPDATE "card_transfer_events" e SET "cardId" = o."cardId", "serialNumber" = o."serialNumber" FROM "CardOwnership" o WHERE e."ownershipId" = o.id AND (e."cardId" IS NULL OR e."serialNumber" IS NULL);`
    );
    expect(statements).toContain(`DROP INDEX IF EXISTS "card_transfer_events_cardId_idx";`);
    expect(statements).toContain(
      `CREATE INDEX IF NOT EXISTS "card_transfer_events_cardId_action_createdAt_idx" ON "card_transfer_events" ("cardId", "action", "createdAt");`
    );
    expect(model("CardTransferEvent")).toContain("@@index([cardId, action, createdAt])");
    expect(model("CardTransferEvent")).not.toContain("@@index([cardId])");
  });

  it("adds the frozen signer name with no backfill: an older inscription shows the current name", () => {
    expect(statements).toContain(
      `ALTER TABLE "CardOwnership" ADD COLUMN IF NOT EXISTS "inscribedName" TEXT;`
    );
    expect(statements).not.toMatch(/SET "inscribedName"/);
    expect(model("CardOwnership")).toMatch(/inscribedName\s+String\?/);
  });

  it("marks every imported copy for the import share of the dust, from the import ledger", () => {
    expect(statements).toContain(
      `UPDATE "CardOwnership" o SET "importDiscounted" = true FROM "ns_import_ledger" l WHERE l."ownershipId" = o.id AND o."importDiscounted" = false;`
    );
  });

  it("names the proposer of every trade, and drops the old counter link and the wishlist target price", () => {
    const backfill = statements.indexOf(
      `UPDATE "TradeOffer" SET "proposerId" = "initiatorId" WHERE "proposerId" IS NULL;`
    );
    expect(backfill).toBeGreaterThan(
      statements.indexOf(`ADD COLUMN IF NOT EXISTS "proposerId" TEXT;`)
    );
    expect(statements.indexOf(`ALTER COLUMN "proposerId" SET NOT NULL;`)).toBeGreaterThan(backfill);
    expect(statements).toContain(
      `ALTER TABLE "TradeOffer" DROP COLUMN IF EXISTS "counterOfferFromId";`
    );
    expect(statements).toContain(
      `ALTER TABLE "card_watchlist" DROP COLUMN IF EXISTS "targetPrice";`
    );
    expect(model("TradeOffer")).toMatch(/proposerId\s+String\n/);
    expect(model("TradeOffer")).not.toContain("counterOfferFromId");
    expect(model("TradeOffer")).not.toContain("COUNTERED");
    expect(model("CardWatchlist")).not.toContain("targetPrice");
  });

  it("keeps an auction when its copy is burned: the link goes SET NULL and the row keeps its card and serial", () => {
    expect(statements).toContain(
      `ALTER TABLE "CardAuction" ALTER COLUMN "cardInstanceId" DROP NOT NULL;`
    );
    // The cascading FK is swapped once; a re-run finds SET NULL and leaves it
    expect(statements).toContain(
      `conname = 'CardAuction_cardInstanceId_fkey' AND conrelid = '"CardAuction"'::regclass AND confdeltype = 'c'`
    );
    expect(statements).toContain(
      `FOREIGN KEY ("cardInstanceId") REFERENCES "CardOwnership"("id") ON DELETE SET NULL ON UPDATE CASCADE`
    );
    const backfill = statements.indexOf(
      `UPDATE "CardAuction" a SET "cardId" = o."cardId", "serialNumber" = o."serialNumber" FROM "CardOwnership" o WHERE a."cardInstanceId" = o.id AND (a."cardId" IS NULL OR a."serialNumber" IS NULL);`
    );
    expect(backfill).toBeGreaterThan(0);
    expect(statements.indexOf(`ALTER COLUMN "cardId" SET NOT NULL;`)).toBeGreaterThan(backfill);
    expect(statements.indexOf(`ALTER COLUMN "serialNumber" SET NOT NULL;`)).toBeGreaterThan(
      backfill
    );
    expect(statements).toContain(
      `FOREIGN KEY ("cardId") REFERENCES "cards"("id") ON DELETE CASCADE ON UPDATE CASCADE`
    );
    expect(model("CardAuction")).toMatch(/cardInstanceId\s+String\?/);
    expect(model("CardAuction")).toMatch(
      /CardOwnership\s+CardOwnership\?\s+@relation\(fields: \[cardInstanceId\], references: \[id\], onDelete: SetNull\)/
    );
    expect(model("CardAuction")).toMatch(/serialNumber\s+Int\n/);
  });

  it("stores the fee each auction paid once, when the column is new, so a later fee of 0 is never rewritten", () => {
    const once = guarded(`AND column_name = 'listingFee') THEN`);
    expect(once).toContain(
      `ALTER TABLE "CardAuction" ADD COLUMN IF NOT EXISTS "listingFee" INTEGER NOT NULL DEFAULT 0;`
    );
    expect(once).toContain(
      `UPDATE "CardAuction" SET "listingFee" = CASE WHEN "isFeatured" THEN 10 ELSE 5 END;`
    );
    expect(statements.match(/SET "listingFee"/g)).toHaveLength(1);
  });

  it("keeps a listing when its copy is burned, with the copy's serial and finish on the row", () => {
    expect(statements).toContain(
      `CONSTRAINT "card_listings_ownershipId_fkey" FOREIGN KEY ("ownershipId") REFERENCES "CardOwnership"("id") ON DELETE SET NULL ON UPDATE CASCADE`
    );
    expect(statements).toContain(`"ownershipId" TEXT, "cardId" TEXT NOT NULL,`);
    expect(statements).toContain(
      `"serialNumber" INTEGER NOT NULL, "finish" "CardFinish" NOT NULL,`
    );
    expect(model("CardListing")).toMatch(
      /ownership\s+CardOwnership\?\s+@relation\(fields: \[ownershipId\], references: \[id\], onDelete: SetNull\)/
    );
  });

  it("adds the player takedown request origin, outside the main block", () => {
    const add = `ALTER TYPE "CardTakedownOrigin" ADD VALUE IF NOT EXISTS 'PLAYER_REQUEST';`;
    expect(statements).toContain(add);
    expect(statements.indexOf(add)).toBeGreaterThan(statements.indexOf("END $$;"));
    expect(statements.indexOf(add)).toBeLessThan(statements.lastIndexOf("COMMIT;"));
    expect(block("enums", "enum", "CardTakedownOrigin")).toMatch(/ADMIN\s+PLAYER_REQUEST\s*$/);
  });
});
