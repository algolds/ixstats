/** @jest-environment node */
/**
 * The drop of `forum_readers`: a hand-written, idempotent migration file (never applied from here), the owner runs it.
 * "Mark all read" is gone, so nothing writes the all-read time and the unread floor is always the 30-day window.
 */
import { readdirSync, readFileSync } from "node:fs";

const DIR = "20261027120000_drop_forum_readers";
const sql = readFileSync(`prisma/migrations/${DIR}/migration.sql`, "utf8");
const schema = readFileSync("prisma/schema/forum.prisma", "utf8");
const statements = sql
  .replace(/--[^\n]*/g, "")
  .replace(/\s+/g, " ")
  .trim();

describe("drop forum_readers migration", () => {
  it("sorts after the engagement migration and is the newest forum migration", () => {
    const dirs = readdirSync("prisma/migrations")
      .filter((d) => /^\d{14}_/.test(d))
      .sort();
    expect(dirs.indexOf(DIR)).toBeGreaterThan(
      dirs.indexOf("20261015120000_thinkpages_forum_engagement")
    );
    const forumDirs = dirs.filter((d) => /forum|thinkpages/.test(d));
    expect(forumDirs[forumDirs.length - 1]).toBe(DIR);
  });

  it("is exactly one idempotent DROP TABLE", () => {
    expect(statements).toBe('DROP TABLE IF EXISTS "forum_readers";');
  });

  it("leaves no model mapped to forum_readers in the schema", () => {
    expect(schema).not.toContain("forum_readers");
    expect(schema).not.toMatch(/model Forum\w*Reader\b/);
  });
});
