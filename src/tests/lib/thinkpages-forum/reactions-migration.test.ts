/** @jest-environment node */
/**
 * The forum reactions migration: hand-written, additive and idempotent, so the controller can apply it (and re-apply
 * it) to the clone and dev databases and the owner to production.
 */
import { readdirSync, readFileSync } from "node:fs";

const DIR = "20261016120000_thinkpages_forum_reactions";
const sql = readFileSync(`prisma/migrations/${DIR}/migration.sql`, "utf8");
const schema = readFileSync("prisma/schema/forum.prisma", "utf8");
const core = readFileSync("prisma/schema/core.prisma", "utf8");
const statements = sql
  .replace(/--[^\n]*/g, "")
  .replace(/\s+/g, " ")
  .trim();

const modelBody = (name: string): string =>
  schema.match(new RegExp(`model ${name} \\{([^}]*)\\}`))?.[1] ?? "";

describe("forum reactions migration", () => {
  it("sorts after the engagement migration", () => {
    const dirs = readdirSync("prisma/migrations")
      .filter((d) => /^\d{14}_/.test(d))
      .sort();
    const engagement = "20261015120000_thinkpages_forum_engagement";
    expect(dirs.indexOf(engagement)).toBeGreaterThan(-1);
    expect(dirs.indexOf(DIR)).toBeGreaterThan(dirs.indexOf(engagement));
  });

  it("creates the table with one reaction per member and post, only when it is missing", () => {
    expect(statements).toContain('CREATE TABLE IF NOT EXISTS "forum_post_reactions"');
    expect(statements.match(/CREATE TABLE/g)).toHaveLength(1);
    expect(statements).toContain(
      'CREATE UNIQUE INDEX IF NOT EXISTS "forum_post_reactions_postId_userId_key" ON "forum_post_reactions"("postId", "userId")'
    );
    expect(statements).toContain(
      'CREATE INDEX IF NOT EXISTS "forum_post_reactions_postId_type_idx" ON "forum_post_reactions"("postId", "type")'
    );
    expect(statements.match(/CREATE (UNIQUE )?INDEX (?!IF NOT EXISTS)/g) ?? []).toEqual([]);
  });

  it("adds the counts column once, with an empty default", () => {
    expect(statements).toContain(
      `ALTER TABLE "forum_posts" ADD COLUMN IF NOT EXISTS "reactionCounts" JSONB NOT NULL DEFAULT '{}'`
    );
    expect(statements.match(/ADD COLUMN/g)).toHaveLength(1);
  });

  it("adds both foreign keys behind a catalogue check, cascading", () => {
    for (const name of ["forum_post_reactions_postId_fkey", "forum_post_reactions_userId_fkey"]) {
      expect(statements).toContain(`conname = '${name}'`);
    }
    expect(statements).toContain(
      'REFERENCES "forum_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE'
    );
    expect(statements).toContain('REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE');
  });

  it("changes no other table and removes or rewrites nothing", () => {
    const alters =
      statements.match(/ALTER TABLE "[A-Za-z_]+" (?:ADD COLUMN|ADD CONSTRAINT)/g) ?? [];
    expect(alters).toHaveLength(3);
    expect(statements.match(/ALTER TABLE "[A-Za-z_]+"/g)).toHaveLength(3);
    expect(statements).not.toMatch(/\b(?:DROP|TRUNCATE|INSERT)\b|(?<!ON )\b(?:UPDATE|DELETE)\b/);
  });

  it("has a Prisma model mapped to the table, with the unique key and the type index", () => {
    const body = modelBody("ForumPostReaction");
    expect(body).toContain('@@map("forum_post_reactions")');
    expect(body).toContain("@@unique([postId, userId])");
    expect(body).toContain("@@index([postId, type])");
    expect(body.match(/onDelete: Cascade/g)).toHaveLength(2);
  });

  it("gives the post its counts column and relation, and the user its back relation", () => {
    expect(schema).toMatch(/reactionCounts\s+Json\s+@default\("\{\}"\)/);
    expect(schema).toMatch(/reactions\s+ForumPostReaction\[\]/);
    expect(core).toMatch(/forumPostReactions\s+ForumPostReaction\[\]/);
  });
});
