/** @jest-environment node */
/**
 * Atlas and World Studio migration: hand-written and idempotent, run before `db push`, so it must create exactly
 * what the Prisma schema declares (the push after it is then a no-op for the preset tables) and drop the dead models.
 */
import { readdirSync, readFileSync } from "node:fs";

const DIR = "20261023120000_atlas_studio";
const sql = readFileSync(`prisma/migrations/${DIR}/migration.sql`, "utf8");
const mapsSchema = readFileSync("prisma/schema/maps.prisma", "utf8");
const statements = sql
  .replace(/--[^\n]*/g, "")
  .replace(/\s+/g, " ")
  .trim();
const model = (name: string) =>
  mapsSchema.match(new RegExp(`model ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? "";
const presetModel = model("WorldPreset");
const versionModel = model("WorldPresetVersion");
const createTable = (table: string) =>
  statements.match(new RegExp(`CREATE TABLE IF NOT EXISTS "${table}" \\((.*?)\\);`))?.[1] ?? "";

describe("atlas studio migration", () => {
  it("sorts after the atlas ra migration", () => {
    const dirs = readdirSync("prisma/migrations")
      .filter((d) => /^\d{14}_/.test(d))
      .sort();
    const earlier = "20261022120000_atlas_ra";
    expect(dirs.indexOf(earlier)).toBeGreaterThan(-1);
    expect(dirs.indexOf(DIR)).toBeGreaterThan(dirs.indexOf(earlier));
  });

  it.each([
    [
      "world_presets",
      [
        "id",
        "slug",
        "name",
        "description",
        "sortOrder",
        "builtIn",
        "publishedVersionId",
        "draftVersionId",
        "archivedAt",
        "createdAt",
        "updatedAt",
      ],
      presetModel,
    ],
    [
      "world_preset_versions",
      ["id", "presetId", "params", "note", "createdBy", "createdAt", "updatedAt", "publishedAt"],
      versionModel,
    ],
  ])("creates %s with a column for each field of its model", (table, columns, modelBody) => {
    const body = createTable(table);
    expect(body).not.toBe("");
    for (const column of columns) {
      expect(body).toContain(`"${column}" `);
      expect(modelBody).toMatch(new RegExp(`\\n\\s+${column}\\s`));
    }
    expect(body.match(/"[A-Za-z]+" [A-Z]/g)).toHaveLength(columns.length);
  });

  it("declares the schema's defaults and nullability", () => {
    const presets = createTable("world_presets");
    expect(presets).toContain(`"description" TEXT NOT NULL DEFAULT ''`);
    expect(presets).toContain('"sortOrder" INTEGER NOT NULL DEFAULT 0');
    expect(presets).toContain('"builtIn" BOOLEAN NOT NULL DEFAULT false');
    expect(presets).toContain('"publishedVersionId" TEXT,');
    expect(presets).toContain('"draftVersionId" TEXT,');
    expect(presets).toContain('"archivedAt" TIMESTAMP(3),');
    expect(presetModel).toMatch(/description\s+String\s+@default\(""\)/);
    expect(presetModel).toMatch(/archivedAt\s+DateTime\?/);
    const versions = createTable("world_preset_versions");
    expect(versions).toContain('"params" JSONB NOT NULL');
    expect(versions).toContain('"publishedAt" TIMESTAMP(3)');
    expect(versionModel).toMatch(/publishedAt\s+DateTime\?/);
  });

  it("creates the schema's indexes and foreign keys, each only when missing", () => {
    expect(statements).toContain(
      'CREATE UNIQUE INDEX IF NOT EXISTS "world_presets_slug_key" ON "world_presets"("slug")'
    );
    expect(presetModel).toMatch(/slug\s+String\s+@unique/);
    expect(statements).toContain(
      'CREATE INDEX IF NOT EXISTS "world_presets_archivedAt_sortOrder_idx" ON "world_presets"("archivedAt", "sortOrder")'
    );
    expect(presetModel).toMatch(/@@index\(\[archivedAt, sortOrder\]\)/);
    expect(statements).toContain(
      'CREATE INDEX IF NOT EXISTS "world_preset_versions_presetId_createdAt_idx" ON "world_preset_versions"("presetId", "createdAt")'
    );
    expect(versionModel).toMatch(/@@index\(\[presetId, createdAt\]\)/);
    for (const [name, ondelete] of [
      ["world_presets_publishedVersionId_fkey", "SET NULL"],
      ["world_presets_draftVersionId_fkey", "SET NULL"],
      ["world_preset_versions_presetId_fkey", "CASCADE"],
    ]) {
      expect(statements).toContain(
        `IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${name}')`
      );
      expect(statements).toMatch(
        new RegExp(
          `CONSTRAINT "${name}" FOREIGN KEY \\("\\w+"\\) REFERENCES "\\w+"\\("id"\\) ON DELETE ${ondelete} ON UPDATE CASCADE`
        )
      );
    }
  });

  it("drops the dead models and the realm template link, each only if present", () => {
    expect(statements).toContain('DROP TABLE IF EXISTS "procedural_worlds"');
    expect(statements).toContain('DROP TABLE IF EXISTS "world_templates"');
    expect(statements).toContain(
      'ALTER TABLE IF EXISTS "realms" DROP COLUMN IF EXISTS "templateId"'
    );
  });

  it("is idempotent: every create has an IF NOT EXISTS, every drop an IF EXISTS, and no data is written", () => {
    expect(statements.match(/CREATE TABLE/g)).toHaveLength(2);
    expect(statements.match(/CREATE TABLE IF NOT EXISTS/g)).toHaveLength(2);
    expect(statements.match(/CREATE (UNIQUE )?INDEX/g)).toHaveLength(3);
    expect(statements.match(/CREATE (UNIQUE )?INDEX IF NOT EXISTS/g)).toHaveLength(3);
    expect(statements.match(/DROP /g)).toHaveLength(3);
    expect(statements.match(/DROP (TABLE|COLUMN) IF EXISTS/g)).toHaveLength(3);
    expect(statements).not.toMatch(/TRUNCATE|INSERT INTO|DELETE FROM|UPDATE "/);
  });

  it("is gone from the schema: the dead models and Realm.templateId", () => {
    expect(mapsSchema).not.toMatch(/model (ProceduralWorld|WorldTemplate) \{/);
    expect(model("Realm")).not.toMatch(/templateId\s/);
  });
});
