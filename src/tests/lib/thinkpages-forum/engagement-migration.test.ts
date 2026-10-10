/** @jest-environment node */
/**
 * The forum engagement migration: hand-written, additive and idempotent, so the controller can apply it (and re-apply it)
 * to the clone and dev databases and the owner to production.
 */
import { readdirSync, readFileSync } from "node:fs";

const DIR = "20261015120000_thinkpages_forum_engagement";
const sql = readFileSync(`prisma/migrations/${DIR}/migration.sql`, "utf8");
const schema = readFileSync("prisma/schema/forum.prisma", "utf8");
const statements = sql
  .replace(/--[^\n]*/g, "")
  .replace(/\s+/g, " ")
  .trim();

const TABLES: ReadonlyArray<readonly [model: string, table: string]> = [
  ["ForumThreadRead", "forum_thread_reads"],
  ["ForumReader", "forum_readers"],
  ["ForumThreadWatch", "forum_thread_watches"],
  ["ForumPostMention", "forum_post_mentions"],
];

describe("forum engagement migration", () => {
  it("sorts after the realm board migration", () => {
    const dirs = readdirSync("prisma/migrations")
      .filter((d) => /^\d{14}_/.test(d))
      .sort();
    expect(dirs.indexOf("20261014120000_thinkpages_realm_board")).toBeGreaterThan(-1);
    expect(dirs.indexOf(DIR)).toBeGreaterThan(dirs.indexOf("20261014120000_thinkpages_realm_board"));
  });

  it("creates the four tables and their indexes only when they are missing", () => {
    for (const [, table] of TABLES) {
      expect(statements).toContain(`CREATE TABLE IF NOT EXISTS "${table}"`);
    }
    expect(statements.match(/CREATE TABLE/g)).toHaveLength(4);
    expect(statements.match(/CREATE (UNIQUE )?INDEX (?!IF NOT EXISTS)/g) ?? []).toEqual([]);
  });

  it("adds each foreign key behind a catalogue check and changes no other table", () => {
    for (const name of [
      "forum_thread_reads_threadId_fkey",
      "forum_thread_watches_threadId_fkey",
      "forum_post_mentions_postId_fkey",
    ]) {
      expect(statements).toContain(`conname = '${name}'`);
    }
    expect(statements.match(/ALTER TABLE "[a-z_]+" (?!ADD CONSTRAINT)/g) ?? []).toEqual([]);
    expect(statements).not.toMatch(/\b(?:DROP|TRUNCATE|INSERT)\b|(?<!ON )\b(?:UPDATE|DELETE)\b/);
  });

  it("has a Prisma model for every table, mapped to its name", () => {
    for (const [model, table] of TABLES) {
      const body = schema.match(new RegExp(`model ${model} \\{([^}]*)\\}`))?.[1] ?? "";
      expect(body).toContain(`@@map("${table}")`);
    }
  });
});
