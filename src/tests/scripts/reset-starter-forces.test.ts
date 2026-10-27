/** @jest-environment node */
/**
 * The starter-force reset (runbook step 4): its dry run creates every DefensePolicy column the generated client reads
 * (D3's columns included, or the first nation fails with P2022), it refuses a database that is not a known clone
 * unless `--i-know` names it, and an empty run prints no distribution.
 */
import fs from "fs";
import path from "path";
import {
  CLONE_DATABASES,
  DRY_RUN_SQL,
  report,
  resetRefusal,
  sqlStatements,
} from "../../../scripts/defense/reset-starter-forces";

const ROOT = path.resolve(__dirname, "../../..");
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8");

/** The scalar columns of a Prisma model (relations left out). */
function modelColumns(schema: string, model: string): string[] {
  const body = schema.match(new RegExp(`model ${model} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? "";
  return body
    .split("\n")
    .map((line) => line.trim().match(/^(\w+)\s+(\w+)(\?|\[\])?\b/))
    .filter((m): m is RegExpMatchArray => m !== null && m[2] !== "Country")
    .map((m) => m[1]!);
}

describe("the reset's dry run", () => {
  const statements = DRY_RUN_SQL.flatMap((file) =>
    sqlStatements(read(`scripts/migrations/2026-10-realm-time/${file}`))
  ).join("\n");

  it("creates every DefensePolicy column the client selects", () => {
    const columns = modelColumns(read("prisma/schema/military.prisma"), "DefensePolicy");
    expect(columns).toEqual(expect.arrayContaining(["terrainProfile", "npcBurdenAdjustment", "sharePersonnel"]));
    for (const column of columns) expect(statements).toContain(`"${column}"`);
  });

  it("applies D2a before D3", () => {
    expect(DRY_RUN_SQL).toEqual(["d2a-defense-model.sql", "d3-combat.sql"]);
  });
});

describe("resetRefusal", () => {
  it("lets a known clone run without confirmation", () => {
    expect(CLONE_DATABASES).toContain("ixstats_wv1");
    expect(resetRefusal("ixstats_wv1", ["--apply"])).toBeNull();
  });

  it("refuses any other database unless --i-know names it", () => {
    expect(resetRefusal("ixstats", ["--apply"])).toMatch(/--i-know ixstats/);
    expect(resetRefusal("ixstats", ["--apply", "--i-know", "ixstats_wv1"])).toMatch(/names "ixstats_wv1"/);
    expect(resetRefusal("ixstats", ["--apply", "--i-know"])).toMatch(/not a known clone/);
    expect(resetRefusal("ixstats", ["--apply", "--i-know", "ixstats"])).toBeNull();
  });
});

describe("report", () => {
  it("prints only the count on an empty run", () => {
    const log = jest.spyOn(console, "log").mockImplementation(() => undefined);
    report([], ["Caphiria"]);
    const printed = log.mock.calls.map((c) => String(c[0])).join("\n");
    log.mockRestore();
    expect(printed).toContain("Nations reset: 0");
    expect(printed).not.toMatch(/min|median|Budget sources/);
  });
});
