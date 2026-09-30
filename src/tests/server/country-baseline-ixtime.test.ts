/** @jest-environment node */
/**
 * Plan 339 Step 4: the calculator treats Country.baselineDate and Country.lastCalculated as
 * IxTime, so every country create must set both explicitly, from one IxTime value (the schema
 * default `now()` is real time, years behind IxTime).
 */
import fs from "fs";
import path from "path";

const srcDir = path.resolve(__dirname, "../..");

const CREATE_SITES = [
  "server/api/routers/countries/management/create.ts",
  "server/api/routers/geo/editor/linkage/assignment.ts",
];

/** Source of each `country.create(...)` / `country.upsert(...)` argument object in `source`. */
function countryWriteBlocks(source: string): string[] {
  const blocks: string[] = [];
  const pattern = /country\.(?:create|upsert)\(\s*\{/g;
  for (let match = pattern.exec(source); match; match = pattern.exec(source)) {
    const start = match.index + match[0].length - 1;
    let depth = 0;
    let end = start;
    for (; end < source.length; end++) {
      if (source[end] === "{") depth++;
      if (source[end] === "}") depth--;
      if (depth === 0) break;
    }
    blocks.push(source.slice(start, end + 1));
  }
  return blocks;
}

function listTsFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listTsFiles(full);
    return entry.name.endsWith(".ts") ? [full] : [];
  });
}

describe("country creation stores an IxTime baselineDate and lastCalculated", () => {
  it.each(CREATE_SITES)("%s sets both from one IxTime value on every country write", (file) => {
    const source = fs.readFileSync(path.join(srcDir, file), "utf-8");
    expect(source).toMatch(/const ixNow = new Date\(IxTime\.getCurrentIxTime\(\)\);/);
    const blocks = countryWriteBlocks(source);
    expect(blocks.length).toBeGreaterThan(0);
    for (const block of blocks) {
      expect(block).toMatch(/baselineDate:\s*ixNow\b/);
      expect(block).toMatch(/lastCalculated:\s*ixNow\b/);
    }
  });

  it("no router stores real time as baselineDate", () => {
    const offenders = listTsFiles(path.join(srcDir, "server/api/routers")).filter((file) =>
      /baselineDate:\s*new Date\(\)/.test(fs.readFileSync(file, "utf-8"))
    );
    expect(offenders).toEqual([]);
  });
});
