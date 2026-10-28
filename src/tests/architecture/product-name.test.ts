/** @jest-environment node */
/** UI copy names the product "IxStates" (Facet §9); code identifiers and the wiki user agent keep IxStats. */
import fs from "fs";
import path from "path";

const ROOT = path.resolve(__dirname, "../..");
const DIRS = ["app", "components"];

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : e.name.endsWith(".tsx") ? [p] : [];
  });
}

const isComment = (line: string) => /^\s*(\/\/|\*|\/\*|\{\s*\/\*)/.test(line);
const NAME = /(?<![\w-])IxStats(?![\w-])/;
const EXEMPT = /^\s*import\b|IxStats-Builder|https?:\/\/|process\.env|product-name:/;

describe("product name in UI copy", () => {
  it("says IxStates", () => {
    const offenders = DIRS.flatMap((d) => walk(path.join(ROOT, d))).flatMap((file) =>
      fs
        .readFileSync(file, "utf8")
        .split("\n")
        .flatMap((line, i) =>
          !isComment(line) && NAME.test(line) && !EXEMPT.test(line)
            ? [`${path.relative(ROOT, file)}:${i + 1}: ${line.trim().slice(0, 100)}`]
            : []
        )
    );
    expect(offenders).toEqual([]);
  });
});
