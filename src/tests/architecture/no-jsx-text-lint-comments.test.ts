/** @jest-environment node */
/**
 * MC-9: a `// oxlint-disable-next-line` written between JSX tags is JSX text, not a comment, so
 * it rendered as literal text in the notification tray. Inside JSX a directive has to be a
 * `{/* ... *\/}` expression comment. This flags a `//` lint directive whose previous line closes
 * a JSX tag (ends in `>` but not `=>`), which is where it becomes visible text.
 */
import fs from "fs";
import path from "path";

const srcDir = path.resolve(__dirname, "../..");
const testsDir = path.join(srcDir, "tests");

function listTsxFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return full === testsDir ? [] : listTsxFiles(full);
    return entry.name.endsWith(".tsx") ? [full] : [];
  });
}

const LINT_DIRECTIVE = /^\/\/\s*(oxlint|eslint)-disable/;

function jsxTextDirectives(source: string): number[] {
  const lines = source.split("\n");
  const hits: number[] = [];
  lines.forEach((line, i) => {
    if (!LINT_DIRECTIVE.test(line.trim())) return;
    const prev = (lines[i - 1] ?? "").trimEnd();
    if (prev.endsWith(">") && !prev.endsWith("=>")) hits.push(i + 1);
  });
  return hits;
}

describe("lint directives inside JSX", () => {
  it("detects a directive written as JSX text", () => {
    const sample = [
      '<span className="x">',
      "  // oxlint-disable-next-line",
      "  {value}",
      "</span>",
    ];
    expect(jsxTextDirectives(sample.join("\n"))).toEqual([2]);
    expect(jsxTextDirectives("const f = () =>\n  // oxlint-disable-next-line\n  g();")).toEqual([]);
  });

  it("no .tsx file renders a lint directive as text", () => {
    const offenders = listTsxFiles(srcDir).flatMap((file) =>
      jsxTextDirectives(fs.readFileSync(file, "utf-8")).map(
        (line) => `${path.relative(srcDir, file)}:${line}`
      )
    );
    expect(offenders).toEqual([]);
  });
});
