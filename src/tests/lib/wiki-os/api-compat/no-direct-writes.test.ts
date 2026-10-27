/** @jest-environment node */
/**
 * Plan 410 done criterion: writes go only through the existing services. Nothing under
 * src/lib/wiki-os/api-compat touches the article or revision tables with a write; the only
 * tables it writes itself are its own (bot passwords and their sessions).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(process.cwd(), "src/lib/wiki-os/api-compat");
const OWN_TABLES = new Set(["wikiBotPassword", "wikiApiSession"]);
const WRITE = /\bdb\.(\w+)\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\(/g;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? sourceFiles(path) : name.endsWith(".ts") ? [path] : [];
  });
}

describe("api-compat writes only through the existing services", () => {
  const files = sourceFiles(ROOT);

  it("finds the module files", () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it("never writes the article, revision or any other WikiOS table directly", () => {
    const offenders = files.flatMap((file) => {
      const text = readFileSync(file, "utf8");
      return [...text.matchAll(WRITE)]
        .filter((match) => !OWN_TABLES.has(match[1]!))
        .map((match) => `${file.slice(ROOT.length + 1)}: db.${match[1]}.${match[2]}()`);
    });
    expect(offenders).toEqual([]);
  });

  it("runs no raw write SQL and no transaction of its own", () => {
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      expect(text).not.toMatch(/\$executeRaw|\$executeRawUnsafe|\$transaction/);
    }
  });

  it("keeps `db.wikiArticle.update` and `db.wikiRevision.create` out of the directory", () => {
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      expect(text).not.toMatch(/db\.wikiArticle\.update|db\.wikiRevision\.create/);
    }
  });
});
