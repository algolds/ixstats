/** @jest-environment node */
import fs from "fs";
import path from "path";
/**
 * `ST_Intersects(ST_MakeValid(a), ST_MakeValid(b))` cannot use the GiST index on `geom_postgis`, so without a
 * bounding-box `&&` test beside it every feature of the layer is repaired and intersected (2-3 s per subdivision
 * profile in prod, 2026-10). Every SQL string that intersects repaired geometries must carry the `&&` prefilter.
 */
const ROOT = path.resolve(__dirname, "../../..");
const SKIPPED = [path.join(ROOT, "src/tests")];
const UNINDEXED = /ST_Intersects\(\s*ST_MakeValid\(/;

function walk(dir: string): string[] {
  if (SKIPPED.includes(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.(ts|tsx|mjs)$/.test(entry.name) ? [full] : [];
  });
}

/** Template-literal bodies (odd chunks between backticks) that intersect repaired geometries without `&&`. */
function unprefiltered(source: string): string[] {
  return source
    .split("`")
    .filter((chunk, i) => i % 2 === 1 && UNINDEXED.test(chunk) && !chunk.includes(" && "));
}

describe("spatial queries keep the GiST index", () => {
  it("every ST_Intersects over ST_MakeValid has a && bounding-box prefilter", () => {
    const offenders = walk(path.join(ROOT, "src")).filter(
      (file) => unprefiltered(fs.readFileSync(file, "utf8")).length > 0
    );
    expect(offenders.map((file) => path.relative(ROOT, file))).toEqual([]);
  });

  it("the guard flags a query without the prefilter and passes one with it", () => {
    const join = "JOIN map_layers ml ON true";
    const where = "WHERE ST_Intersects(ST_MakeValid(s.geom_postgis), ST_MakeValid(ml.geom_postgis))";
    expect(unprefiltered(`x = \`${join} ${where}\``)).toHaveLength(1);
    expect(unprefiltered(`x = \`${join} AND ml.geom_postgis && s.geom_postgis ${where}\``)).toEqual([]);
  });
});
