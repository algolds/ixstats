/** @jest-environment node */
/**
 * Plan 339 Step 5: `framer-motion` is not a declared dependency (only a transitive one of
 * `motion`), so source must import the project standard `motion/react` instead.
 */
import fs from "fs";
import path from "path";

const srcDir = path.resolve(__dirname, "../..");
const testsDir = path.join(srcDir, "tests");

function listSourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return full === testsDir ? [] : listSourceFiles(full);
    return /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

describe("motion imports", () => {
  it("no source file imports framer-motion directly", () => {
    const offenders = listSourceFiles(srcDir)
      .filter((file) => /from\s+["']framer-motion/.test(fs.readFileSync(file, "utf-8")))
      .map((file) => path.relative(srcDir, file));
    expect(offenders).toEqual([]);
  });
});
