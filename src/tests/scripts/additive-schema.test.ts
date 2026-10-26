/** @jest-environment node */
/**
 * The deploy's pre-push schema step keeps only what is safe to add before the hand-written SQL runs (new types, enum
 * values, tables, nullable or defaulted columns, indexes and foreign keys among the new tables) and leaves the rest,
 * and everything the deploy SQL creates or converts itself, to that SQL and `db push`.
 */
import { readFileSync } from "node:fs";
import {
  NEVER_EARLY,
  deferredObjects,
  planAdditive,
  splitStatements,
} from "../../../scripts/deployment/additive-schema";
import { deploySqlBeforePush } from "../../../scripts/deployment/apply-additive-schema";

const diff = readFileSync("src/tests/fixtures/additive-schema/diff.sql", "utf8");

/** Deploy SQL in the forms the real files use: plain, guarded by IF NOT EXISTS, inside DO blocks. */
const deploySql = [
  `CREATE TABLE IF NOT EXISTS "ns_import_ledger" ("id" TEXT NOT NULL);`,
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CardFinish') THEN
       CREATE TYPE "CardFinish" AS ENUM ('STANDARD', 'FOIL');
     END IF;
   END $$;
   ALTER TABLE "CardOwnership" ADD COLUMN IF NOT EXISTS "finish" "CardFinish" NOT NULL DEFAULT 'STANDARD';`,
  `DO $$ BEGIN
     -- the fee is filled once, when the column is new
     IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE column_name = 'listingFee') THEN
       ALTER TABLE "CardAuction" ADD COLUMN IF NOT EXISTS "listingFee" INTEGER NOT NULL DEFAULT 0;
       UPDATE "CardAuction" SET "listingFee" = 5;
     END IF;
   END $$;`,
  `ALTER TABLE "MilitaryBranch"
     ALTER COLUMN "activeDuty" TYPE DOUBLE PRECISION USING "activeDuty"::double precision;
   ALTER TABLE "old_pages" RENAME TO "new_pages";`,
];

describe("splitStatements", () => {
  it("splits on top-level semicolons, drops comments and keeps quotes and $$ bodies whole", () => {
    expect(
      splitStatements(`/* a; b */ SELECT 'x;y' AS "a;b"; -- c; d
        DO $$ BEGIN PERFORM 1; END $$;
        SELECT 2`)
    ).toEqual([`SELECT 'x;y' AS "a;b"`, "DO $$ BEGIN PERFORM 1; END $$", "SELECT 2"]);
  });
});

describe("deferredObjects", () => {
  const deferred = deferredObjects(deploySql);

  it("collects the tables, columns and types the deploy SQL creates, converts or renames", () => {
    expect([...deferred.tables].sort()).toEqual(["new_pages", "ns_import_ledger"]);
    expect([...deferred.types]).toEqual(["CardFinish"]);
    expect([...deferred.columns].sort()).toEqual([
      "CardAuction.listingFee",
      "CardOwnership.finish",
      "MilitaryBranch.activeDuty",
    ]);
  });
});

describe("planAdditive", () => {
  const plan = planAdditive(diff, deferredObjects(deploySql));
  const reasonFor = (needle: string) =>
    plan.changes.find((change) => change.source.includes(needle))?.reason;

  it("applies the additive statements, in the diff's order, regrouping kept columns per table", () => {
    expect(plan.statements).toEqual([
      `CREATE TYPE "Rarity" AS ENUM ('COMMON', 'RARE')`,
      `CREATE TYPE "Brand" AS ENUM ('x')`,
      `ALTER TYPE "Grow" ADD VALUE 'b'`,
      `ALTER TABLE "cards" ADD COLUMN "amount" DECIMAL(65,30), ADD COLUMN "isBound" BOOLEAN NOT NULL DEFAULT false, ` +
        `ADD COLUMN "note" TEXT, ADD COLUMN "label" TEXT NOT NULL DEFAULT 'NOT NULL', ` +
        `ADD COLUMN "tags" TEXT[] DEFAULT ARRAY[]::TEXT[]`,
      `ALTER TABLE "wiki_revisions" ADD COLUMN "authorId" TEXT, ADD COLUMN "parked" BOOLEAN NOT NULL DEFAULT false`,
      `ALTER TABLE "CardAuction" ADD COLUMN "seq" SERIAL NOT NULL`,
      `ALTER TABLE "Country" ADD COLUMN "ownerUserId" TEXT`,
      `CREATE TABLE "job_leases" ( "name" TEXT NOT NULL, "holder" TEXT NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL, ` +
        `CONSTRAINT "job_leases_pkey" PRIMARY KEY ("name") )`,
      `CREATE TABLE "realm_pages" ( "id" TEXT NOT NULL, "title" TEXT NOT NULL, "brand" "Brand" NOT NULL, ` +
        `CONSTRAINT "realm_pages_pkey" PRIMARY KEY ("id") )`,
      `CREATE TABLE "realm_items" ( "id" TEXT NOT NULL, "pageId" TEXT NOT NULL, ` +
        `CONSTRAINT "realm_items_pkey" PRIMARY KEY ("id") )`,
      `CREATE INDEX "realm_pages_brand_idx" ON "realm_pages"("brand")`,
      `CREATE UNIQUE INDEX "realm_pages_title_key" ON "realm_pages"("title")`,
      `CREATE INDEX "realm_items_pageId_idx" ON "realm_items"("pageId")`,
      `ALTER TABLE "realm_items" ADD CONSTRAINT "realm_items_pageId_fkey" FOREIGN KEY ("pageId") ` +
        `REFERENCES "realm_pages"("id") ON DELETE RESTRICT ON UPDATE CASCADE`,
    ]);
  });

  it("leaves drops, renames, type and default changes and constraints on existing tables to the push", () => {
    expect(reasonFor(`DROP TABLE "world_configs"`)).toMatch(/not additive/);
    expect(reasonFor(`DROP INDEX "cards_title_idx"`)).toMatch(/not additive/);
    expect(reasonFor(`DROP CONSTRAINT "cards_oldId_fkey"`)).toMatch(/not additive/);
    expect(reasonFor(`DROP COLUMN "oldCol"`)).toMatch(/not additive/);
    expect(reasonFor(`ALTER INDEX "cards_old_key"`)).toMatch(/not additive/);
    expect(reasonFor(`SET DEFAULT 50`)).toMatch(/not additive/);
    expect(reasonFor(`SET DATA TYPE DOUBLE PRECISION`)).toMatch(/not additive/);
    expect(reasonFor(`"cards_title_key"`)).toMatch(/existing table "cards"/);
    expect(reasonFor(`"Country_ownerUserId_idx"`)).toMatch(/existing table "Country"/);
    expect(reasonFor(`"cards_realmId_fkey"`)).toMatch(/foreign key touching an existing table/);
    expect(reasonFor(`"realm_pages_ownerId_fkey"`)).toMatch(/foreign key touching an existing table/);
  });

  it("leaves required columns without a default, and type changes Prisma writes as drop and add", () => {
    expect(reasonFor(`"realmId" TEXT NOT NULL`)).toBe("cards.realmId is required without a default");
    expect(reasonFor(`"slug" TEXT NOT NULL`)).toBe("Country.slug is required without a default");
    expect(reasonFor(`ADD COLUMN "rarity"`)).toBe("cards.rarity changes type (dropped and re-added)");
  });

  it("leaves every statement of an enum rewrite, and anything new that uses the rewritten type", () => {
    const rewrite = plan.changes.filter((change) => /Mood/.test(change.source));
    expect(rewrite.length).toBeGreaterThanOrEqual(6);
    expect(rewrite.every((change) => !change.kept)).toBe(true);
    expect(reasonFor(`CREATE TYPE "Mood_new"`)).toMatch(/enum rewrite/);
    expect(reasonFor(`"mood2" "Mood"`)).toMatch(/uses type "Mood"/);
    expect(reasonFor(`CREATE TABLE "mood_log"`)).toMatch(/uses type "Mood"/);
  });

  it("leaves what the deploy SQL creates or converts, so its when-new steps still run", () => {
    expect(reasonFor(`CREATE TYPE "CardFinish"`)).toMatch(/created by the deploy SQL/);
    expect(reasonFor(`ALTER TYPE "CardFinish" ADD VALUE`)).toMatch(/deploy SQL/);
    expect(reasonFor(`CREATE TABLE "ns_import_ledger"`)).toMatch(/created by the deploy SQL/);
    expect(reasonFor(`"ns_import_ledger_id_idx"`)).toMatch(/existing table/);
    expect(reasonFor(`"listingFee"`)).toBe("CardAuction.listingFee is added or converted by the deploy SQL");
    expect(reasonFor(`"finish" "CardFinish"`)).toBe("CardOwnership.finish is added or converted by the deploy SQL");
  });

  it("never adds wiki_revisions.origin before the WikiOS conflicts SQL labels the revisions", () => {
    expect(NEVER_EARLY).toContain("wiki_revisions.origin");
    expect(reasonFor(`"origin" TEXT`)).toBe("wiki_revisions.origin must wait for its data SQL");
    const bare = planAdditive(diff, deferredObjects([]));
    expect(bare.statements.join("\n")).not.toContain(`"origin"`);
  });

  it("has nothing to apply when the database already matches", () => {
    expect(planAdditive("", deferredObjects([]))).toEqual({ changes: [], statements: [] });
  });
});

describe("against the real deploy", () => {
  const script = readFileSync("scripts/deploy-production.sh", "utf8");
  const files = deploySqlBeforePush(script);
  const deferred = deferredObjects(files.map((file) => readFileSync(file, "utf8")));

  it("reads the SQL files the deploy runs before its push", () => {
    expect(files).toContain("prisma/migrations/20261105120000_wikios_conflicts/migration.sql");
    expect(files).not.toContain("prisma/migrations/20261021120000_atlas_r0/migration.sql");
  });

  it("defers the columns the deploy SQL fills only when it adds them", () => {
    for (const column of [
      "CardAuction.listingFee",
      "CardOwnership.xpDay",
      "card_transfer_events.finish",
      "wiki_revisions.origin",
      "cards.realmId",
      "TradeOffer.proposerId",
      "MilitaryBranch.domain",
    ])
      expect(deferred.columns).toContain(column);
    expect(deferred.types).toContain("CardType");
  });

  it("creates what the deploy SQL reads but never creates itself (the push-only objects)", () => {
    for (const table of ["job_leases", "realm_pages", "wiki_account_links", "wiki_mirror_jobs"])
      expect(deferred.tables).not.toContain(table);
    for (const column of [
      "wiki_revisions.authorId",
      "wiki_revisions.parked",
      "wiki_revisions.parkReason",
      "Country.ownerUserId",
      "exchange_contracts.closedIxTime",
    ])
      expect(deferred.columns).not.toContain(column);
  });
});
