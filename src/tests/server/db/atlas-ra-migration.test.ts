/** @jest-environment node */
/**
 * Atlas Release A migration: hand-written and idempotent, so the controller can apply it (and re-apply it) to the
 * clone and dev databases and the owner to production. It only adds the two Country columns the Prisma schema has.
 */
import { readdirSync, readFileSync } from "node:fs";

const DIR = "20261022120000_atlas_ra";
const sql = readFileSync(`prisma/migrations/${DIR}/migration.sql`, "utf8");
const coreSchema = readFileSync("prisma/schema/core.prisma", "utf8");
const mapsSchema = readFileSync("prisma/schema/maps.prisma", "utf8");
const statements = sql
  .replace(/--[^\n]*/g, "")
  .replace(/\s+/g, " ")
  .trim();
const countryModel = coreSchema.match(/model Country \{([\s\S]*?)\n\}/)?.[1] ?? "";

describe("atlas ra migration", () => {
  it("sorts after the atlas r0 migration", () => {
    const dirs = readdirSync("prisma/migrations")
      .filter((d) => /^\d{14}_/.test(d))
      .sort();
    const earlier = "20261021120000_atlas_r0";
    expect(dirs.indexOf(earlier)).toBeGreaterThan(-1);
    expect(dirs.indexOf(DIR)).toBeGreaterThan(dirs.indexOf(earlier));
  });

  it("adds the worldgen column only when it is missing, defaulting as the schema does", () => {
    expect(statements).toContain(
      'ALTER TABLE "Country" ADD COLUMN IF NOT EXISTS "worldgen" BOOLEAN NOT NULL DEFAULT false'
    );
    expect(countryModel).toMatch(/worldgen\s+Boolean\s+@default\(false\)/);
  });

  it("adds the claimable column only when it is missing, defaulting as the schema does", () => {
    expect(statements).toContain(
      'ALTER TABLE "Country" ADD COLUMN IF NOT EXISTS "claimable" BOOLEAN NOT NULL DEFAULT true'
    );
    expect(countryModel).toMatch(/claimable\s+Boolean\s+@default\(true\)/);
  });

  it("uses only idempotent statement forms and never drops or rewrites data", () => {
    expect(statements.match(/ALTER TABLE/g)).toHaveLength(2);
    expect(
      statements.match(/ALTER TABLE "[A-Za-z_]+" (?!ADD COLUMN IF NOT EXISTS)/g) ?? []
    ).toEqual([]);
    expect(statements).not.toMatch(
      /DROP |TRUNCATE|INSERT INTO|DELETE FROM|UPDATE |CREATE (?!INDEX IF NOT EXISTS)/
    );
  });

  it("keeps the procedural world models and the realm template link (ruling A6)", () => {
    expect(mapsSchema).toMatch(/model ProceduralWorld \{/);
    expect(mapsSchema).toMatch(/model WorldTemplate \{/);
    expect(mapsSchema.match(/model Realm \{([\s\S]*?)\n\}/)?.[1] ?? "").toMatch(/templateId\s/);
  });
});
