import fs from "fs";
import path from "path";

describe("Plan 162: Barrel Elimination Architecture", () => {
  const rootDir = path.resolve(__dirname, "../../..");
  const srcDir = path.join(rootDir, "src");

  const domains = ["system", "vault", "cards"];

  test.each(domains)("domain '%s' has deleted root index.ts", (domain) => {
    const indexPath = path.join(srcDir, "lib", domain, "index.ts");
    expect(fs.existsSync(indexPath)).toBe(false);
  });

  test("no active typescript file imports from deleted barrel roots", () => {
    const tsFiles: string[] = [];

    function scanDir(dir: string) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name !== "node_modules" && entry.name !== ".next") {
            scanDir(fullPath);
          }
        } else if (/\.(ts|tsx)$/.test(entry.name)) {
          tsFiles.push(fullPath);
        }
      }
    }

    scanDir(srcDir);

    const violations: { file: string; line: number; text: string }[] = [];

    const barrelRegex = /from\s+["'](?:~\/lib\/(?:system|vault|cards))["']/;

    for (const file of tsFiles) {
      const content = fs.readFileSync(file, "utf-8");
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        if (barrelRegex.test(line)) {
          violations.push({
            file: path.relative(rootDir, file),
            line: i + 1,
            text: line.trim(),
          });
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
