/** @jest-environment node */
import fs from "fs";
import path from "path";

/**
 * M16: the moderation log is append-only. Nothing in application code updates or deletes a ForumModLog row; the
 * phase 3 migration adds Postgres rules as the second line of defence.
 */
const ROOT = path.resolve(__dirname, "../../..");
const SCAN_ROOTS = [path.join(ROOT, "src/server"), path.join(ROOT, "scripts")];
const SKIPPED = [path.join(ROOT, "scripts/archive")];
const FORBIDDEN = /forumModLog\s*\.\s*(update|updateMany|upsert|delete|deleteMany)\b/;

function walk(dir: string): string[] {
  if (SKIPPED.includes(dir) || !fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "node_modules" ? [] : walk(full);
    return /\.(ts|tsx|mjs|cjs|js)$/.test(entry.name) ? [full] : [];
  });
}

describe("forum moderation log is append-only", () => {
  it("no server or script code updates or deletes a forumModLog row", () => {
    const offenders = SCAN_ROOTS.flatMap(walk).filter((file) => FORBIDDEN.test(fs.readFileSync(file, "utf8")));
    expect(offenders.map((file) => path.relative(ROOT, file))).toEqual([]);
  });

  it("the guard recognises every forbidden call", () => {
    for (const call of ["update", "updateMany", "upsert", "delete", "deleteMany"]) {
      expect(FORBIDDEN.test(`tx.forumModLog.${call}({})`)).toBe(true);
    }
    expect(FORBIDDEN.test("tx.forumModLog.create({})")).toBe(false);
    expect(FORBIDDEN.test("db.forumModLog.findMany({})")).toBe(false);
  });

  // Flipped in Task 2 once mod-log.ts lands.
  it.todo("src/server/modules/thinkpages-forum/mod-log.ts exports logModAction");
});
