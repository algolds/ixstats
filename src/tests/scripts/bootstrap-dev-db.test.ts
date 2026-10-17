import { describe, it, expect } from "@jest/globals";
import { readFileSync } from "node:fs";
import {
  ATLAS_R0_SQL,
  ATLAS_RA_SQL,
  ATLAS_STUDIO_SQL,
  bootstrapRefusal,
  CARDS_ADMIN_SQL,
  CARDS_BACKFILL_SCRIPT,
  CARDS_CONSTRAINTS_SQL,
  CARDS_FACE_HUB_SQL,
  CARDS_FOUNDATIONS_SQL,
  DB_SETUP_SQL_FILES,
  MAP_GEOMETRY_TRIGGERS_SQL,
  VAULT_HUB_SQL,
} from "../../../scripts/setup/bootstrap-dev-db";

const local = "postgresql://postgres:postgres@localhost:5433/ixstats";

describe("db:bootstrap guards", () => {
  it("allows a local development database", () => {
    expect(
      bootstrapRefusal({ nodeEnv: "development", databaseUrl: local, allowRemote: false })
    ).toBeNull();
  });

  it("refuses production", () => {
    expect(
      bootstrapRefusal({ nodeEnv: "production", databaseUrl: local, allowRemote: true })
    ).toMatch(/production/);
  });

  it("refuses a remote host unless explicitly allowed", () => {
    const remote = "postgresql://u:p@db.example.com:5432/ixstats";
    expect(
      bootstrapRefusal({ nodeEnv: "development", databaseUrl: remote, allowRemote: false })
    ).toMatch(/not a local database/);
    expect(
      bootstrapRefusal({ nodeEnv: "development", databaseUrl: remote, allowRemote: true })
    ).toBeNull();
  });

  it("refuses when DATABASE_URL is missing", () => {
    expect(
      bootstrapRefusal({ nodeEnv: "development", databaseUrl: undefined, allowRemote: false })
    ).toMatch(/DATABASE_URL/);
  });
});

describe("the SQL a fresh database needs besides db push", () => {
  it("runs the geometry triggers, then the Atlas R0 SQL (it backfills through them), then Atlas RA", () => {
    expect(DB_SETUP_SQL_FILES).toEqual([MAP_GEOMETRY_TRIGGERS_SQL, ATLAS_R0_SQL, ATLAS_RA_SQL]);
  });

  it("keeps the Atlas Studio SQL out of the after-push list: it runs before db push, which cannot drop a table", () => {
    expect(DB_SETUP_SQL_FILES).not.toContain(ATLAS_STUDIO_SQL);
    expect(ATLAS_STUDIO_SQL).toContain("20261023120000_atlas_studio");
  });

  it("runs the Atlas Studio SQL before the schema push", () => {
    const source = readFileSync("scripts/setup/bootstrap-dev-db.ts", "utf8");
    const studio = source.lastIndexOf('--file", ATLAS_STUDIO_SQL');
    const push = source.indexOf('"db", "push"');
    expect(studio).toBeGreaterThan(0);
    expect(push).toBeGreaterThan(studio);
  });

  it("runs the Vault hub SQL right after the Atlas Studio SQL, before the schema push", () => {
    const source = readFileSync("scripts/setup/bootstrap-dev-db.ts", "utf8");
    const studio = source.indexOf('--file", ATLAS_STUDIO_SQL');
    const vault = source.indexOf('--file", VAULT_HUB_SQL');
    const push = source.indexOf('"db", "push"');
    expect(VAULT_HUB_SQL).toContain("20261024120000_vault_hub");
    expect(studio).toBeGreaterThan(0);
    expect(vault).toBeGreaterThan(studio);
    expect(push).toBeGreaterThan(vault);
  });

  it("runs the cards additive SQL, the backfill (it seeds the system realms) and the constraints after the push, before the seed", () => {
    const source = readFileSync("scripts/setup/bootstrap-dev-db.ts", "utf8");
    const push = source.indexOf('"db", "push"');
    // Prettier wraps these two calls one argument per line, so match across the line break.
    const additive = source.search(/"--file",\s*CARDS_FOUNDATIONS_SQL/);
    const backfill = source.indexOf('CARDS_BACKFILL_SCRIPT, "--apply"');
    const constraints = source.search(/"--file",\s*CARDS_CONSTRAINTS_SQL/);
    const seed = source.indexOf("scripts/setup/seed-db.ts");
    expect(CARDS_FOUNDATIONS_SQL).toContain("20261027120000_cards_foundations");
    expect(CARDS_CONSTRAINTS_SQL).toContain("20261027120001_cards_foundations_constraints");
    expect(CARDS_BACKFILL_SCRIPT).toBe("scripts/cards/backfill-cards-refresh.ts");
    expect(additive).toBeGreaterThan(push);
    expect(backfill).toBeGreaterThan(additive);
    expect(constraints).toBeGreaterThan(backfill);
    expect(seed).toBeGreaterThan(constraints);
  });

  it("runs the cards admin SQL after Phase 1's constraints SQL, before the seed", () => {
    const source = readFileSync("scripts/setup/bootstrap-dev-db.ts", "utf8");
    // Prettier wraps the Phase 1 calls one argument per line, so match across the line break.
    const constraints = source.search(/"--file",\s*CARDS_CONSTRAINTS_SQL/);
    const admin = source.search(/"--file",\s*CARDS_ADMIN_SQL/);
    const seed = source.indexOf("scripts/setup/seed-db.ts");
    expect(CARDS_ADMIN_SQL).toContain("20261028120000_cards_admin");
    expect(constraints).toBeGreaterThan(0);
    expect(admin).toBeGreaterThan(constraints);
    expect(seed).toBeGreaterThan(admin);
  });

  it("runs the cards face-hub SQL after Phase 2's admin SQL, before the seed", () => {
    const source = readFileSync("scripts/setup/bootstrap-dev-db.ts", "utf8");
    // Prettier wraps these calls one argument per line, so match across the line break.
    const admin = source.search(/"--file",\s*CARDS_ADMIN_SQL/);
    const faceHub = source.search(/"--file",\s*CARDS_FACE_HUB_SQL/);
    const seed = source.indexOf("scripts/setup/seed-db.ts");
    expect(CARDS_FACE_HUB_SQL).toContain("20261031120000_cards_face_hub");
    expect(DB_SETUP_SQL_FILES).not.toContain(CARDS_FACE_HUB_SQL);
    expect(admin).toBeGreaterThan(0);
    expect(faceHub).toBeGreaterThan(admin);
    expect(seed).toBeGreaterThan(faceHub);
  });

  it("the cards admin SQL is idempotent and creates the import, licence and takedown tables", () => {
    const sql = readFileSync(CARDS_ADMIN_SQL, "utf8");
    for (const table of [
      "card_art_licences",
      "card_import_jobs",
      "card_import_items",
      "card_takedowns",
    ]) {
      expect(sql).toContain(`CREATE TABLE IF NOT EXISTS "${table}"`);
    }
    expect(sql).toContain(
      `ADD COLUMN IF NOT EXISTS "reviewState" "CardReviewState" NOT NULL DEFAULT 'APPROVED'`
    );
    expect(sql).toContain(`ALTER COLUMN "ownershipId" DROP NOT NULL`);
    expect(sql).not.toMatch(/^\s*CREATE TYPE/m); // every type is created inside a duplicate_object guard
  });

  it("the cards admin SQL keeps a transfer event once its copy is gone, with the card and serial", () => {
    const sql = readFileSync(CARDS_ADMIN_SQL, "utf8");
    expect(sql).toContain(
      `ALTER TABLE "card_transfer_events" ADD COLUMN IF NOT EXISTS "cardId" TEXT;`
    );
    expect(sql).toContain(
      `ALTER TABLE "card_transfer_events" ADD COLUMN IF NOT EXISTS "serialNumber" INTEGER;`
    );
    expect(sql).toContain(`ALTER COLUMN "toUserId" DROP NOT NULL`);
    // The cascading FK is swapped for SET NULL once; a re-run finds SET NULL and leaves it.
    expect(sql).toContain(
      `conname = 'card_transfer_events_ownershipId_fkey' AND confdeltype = 'c'`
    );
    expect(sql).toContain(`REFERENCES "CardOwnership"("id") ON DELETE SET NULL`);
  });

  it("the cards admin SQL marks the legacy Commons flag cards as Commons, and no IxWiki article", () => {
    const sql = readFileSync(CARDS_ADMIN_SQL, "utf8");
    const backfill = sql.slice(sql.indexOf(`UPDATE "cards" SET "wikiSource" = 'commons'`));
    const statement = backfill.slice(0, backfill.indexOf(";"));
    expect(statement).toContain(`"cardType" = 'LORE'`);
    expect(statement).toContain(`"wikiSource" IS NULL`);
    // An IxWiki article (a title, no source) may show a Commons image; only the titleless flag cards move.
    expect(statement).toContain(`"wikiArticleTitle" IS NULL`);
    const commonsUpload = String.raw`'^(https?:)?//upload\.wikimedia\.org/wikipedia/commons/'`;
    expect(statement).toContain(`"artwork" ~* ${commonsUpload}`);
    expect(statement).toContain(`"metadata"->>'descriptionUrl' ~* ${commonsUpload}`);
  });

  it("the cards admin SQL is one transaction, so a failure part-way changes nothing", () => {
    const sql = readFileSync(CARDS_ADMIN_SQL, "utf8");
    expect(sql).toMatch(/^BEGIN;$/m);
    expect(sql.trimEnd().endsWith("COMMIT;")).toBe(true);
  });

  it("the Atlas Studio SQL is the idempotent one that creates the preset tables and drops the dead models", () => {
    const sql = readFileSync(ATLAS_STUDIO_SQL, "utf8");
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "world_presets"');
    expect(sql).toContain('DROP TABLE IF EXISTS "procedural_worlds"');
  });

  it("the Atlas RA SQL is the idempotent one that adds the Country slot flags", () => {
    const sql = readFileSync(ATLAS_RA_SQL, "utf8");
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS "worldgen"');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS "claimable"');
  });

  it("the Atlas R0 SQL is the idempotent one that creates what the code calls", () => {
    const sql = readFileSync(ATLAS_R0_SQL, "utf8");
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS "mapVersion"');
    expect(sql).toContain("CREATE OR REPLACE FUNCTION atlas_country_union(");
    expect(sql).toContain("CREATE OR REPLACE FUNCTION sync_country_geom()");
  });
});

describe("map geometry sync triggers", () => {
  const sql = readFileSync(MAP_GEOMETRY_TRIGGERS_SQL, "utf8");

  it.each([
    ["map_layers", "map_layer_geom_sync", "sync_map_layer_geom", "geometry"],
    ["subdivisions", "subdivision_geom_sync", "sync_map_layer_geom", "geometry"],
    ["cities", "city_geom_sync", "sync_coordinate_geom", "coordinates"],
    ["points_of_interest", "poi_geom_sync", "sync_coordinate_geom", "coordinates"],
  ])(
    "%s: the trigger is re-creatable and old rows are backfilled",
    (table, trigger, fn, column) => {
      expect(sql).toContain(`CREATE OR REPLACE FUNCTION ${fn}()`);
      const drop = sql.indexOf(`DROP TRIGGER IF EXISTS ${trigger} ON ${table};`);
      const create = sql.indexOf(`CREATE TRIGGER ${trigger}`);
      expect(drop).toBeGreaterThanOrEqual(0);
      expect(create).toBeGreaterThan(drop);
      expect(sql).toContain(
        `BEFORE INSERT OR UPDATE OF ${column} ON ${table}\n  FOR EACH ROW EXECUTE FUNCTION ${fn}();`
      );
      expect(sql).toMatch(
        new RegExp(
          `UPDATE ${table} SET ${column} = ${column}\\s+WHERE ${column} IS NOT NULL AND geom_postgis IS NULL;`
        )
      );
    }
  );

  it("never creates a function or trigger that a re-run would trip over", () => {
    expect(sql).not.toMatch(/CREATE FUNCTION/);
    expect(sql.match(/CREATE TRIGGER/g)).toHaveLength(sql.match(/DROP TRIGGER IF EXISTS/g)!.length);
  });
});
