/**
 * P2-14: MyCountry labels are sentence case (Facet: no uppercase labels or eyebrows). The uppercase stat style and
 * `uppercase` / `tracking-wide*` classes stay out of src/components/mycountry; `first-letter:uppercase` (sentence
 * case for generated text) and the MyCountry wordmark are the exceptions.
 */
import fs from "fs";
import path from "path";

const DIR = path.resolve(__dirname, "../../components/mycountry");
const WORDMARK = path.join("shared", "primitives", "mycountry-logo.tsx");

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : e.name.endsWith(".tsx") ? [p] : [];
  });
}

it("has no uppercase label styles in MyCountry", () => {
  const offenders = walk(DIR)
    .filter((file) => path.relative(DIR, file) !== WORDMARK)
    .flatMap((file) =>
      fs
        .readFileSync(file, "utf8")
        .split("\n")
        .map((line, i) => ({ line, at: `${path.relative(DIR, file)}:${i + 1}` }))
        .filter(({ line }) =>
          /\btext-stat-label\b|(?<![\w:-])uppercase\b|\btracking-wide(?:r|st)?\b/.test(line)
        )
        .map(({ at }) => at)
    );
  expect(offenders).toEqual([]);
});
