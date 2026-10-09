/** @jest-environment node */
import { readdirSync, readFileSync } from "node:fs";

const DIR = "20261011120000_thinkpages_forum_import";
const sql = readFileSync(`prisma/migrations/${DIR}/migration.sql`, "utf8");
const schema = readFileSync("prisma/schema/forum.prisma", "utf8");

const count = (text: string, pattern: RegExp): number => text.match(pattern)?.length ?? 0;
/** One model's body in the Prisma schema. */
const modelBody = (name: string): string =>
  schema.match(new RegExp(`model ${name} \\{([^}]*)\\}`))?.[1] ?? "";

describe("forum import migration (phase 4)", () => {
  it("sorts after the phase 3 moderation and uploaded-assets migrations", () => {
    const dirs = readdirSync("prisma/migrations")
      .filter((d) => /^\d{14}_/.test(d))
      .sort();
    const at = (name: string) => dirs.indexOf(name);
    expect(at("20261010120000_thinkpages_forum_moderation")).toBeGreaterThan(-1);
    expect(at("20261010030000_uploaded_assets")).toBeGreaterThan(-1);
    expect(at(DIR)).toBeGreaterThan(at("20261010120000_thinkpages_forum_moderation"));
    expect(at(DIR)).toBeGreaterThan(at("20261010030000_uploaded_assets"));
  });

  it("makes the author nullable on threads and posts", () => {
    expect(sql).toContain('ALTER TABLE "forum_threads" ALTER COLUMN "authorUserId" DROP NOT NULL;');
    expect(sql).toContain('ALTER TABLE "forum_posts" ALTER COLUMN "authorUserId" DROP NOT NULL;');
    expect(count(sql, /DROP NOT NULL/g)).toBe(2);
  });

  it("adds the imported name to threads and the XenForo user id to both, idempotently", () => {
    expect(sql).toContain(
      'ALTER TABLE "forum_threads" ADD COLUMN IF NOT EXISTS "importedAuthorName" TEXT;'
    );
    expect(sql).toContain(
      'ALTER TABLE "forum_threads" ADD COLUMN IF NOT EXISTS "xenforoUserId" INTEGER;'
    );
    expect(sql).toContain(
      'ALTER TABLE "forum_posts" ADD COLUMN IF NOT EXISTS "xenforoUserId" INTEGER;'
    );
    expect(count(sql, /ADD COLUMN/g)).toBe(3);
    expect(count(sql, /ADD COLUMN IF NOT EXISTS/g)).toBe(3);
    expect(count(sql, /"importedAuthorName"/g)).toBe(1);
  });

  it("creates the XenForo user id and post date indexes idempotently, with Prisma's default names", () => {
    expect(sql).toContain(
      'CREATE INDEX IF NOT EXISTS "forum_threads_xenforoUserId_idx" ON "forum_threads"("xenforoUserId");'
    );
    expect(sql).toContain(
      'CREATE INDEX IF NOT EXISTS "forum_posts_xenforoUserId_idx" ON "forum_posts"("xenforoUserId");'
    );
    expect(sql).toContain(
      'CREATE INDEX IF NOT EXISTS "forum_posts_createdAt_idx" ON "forum_posts"("createdAt");'
    );
    expect(count(sql, /CREATE (UNIQUE )?INDEX/g)).toBe(3);
    expect(count(sql, /CREATE INDEX IF NOT EXISTS/g)).toBe(3);
  });

  it("is additive: no table is created or dropped and no column removed", () => {
    expect(sql).not.toMatch(/CREATE TABLE|DROP TABLE|DROP COLUMN|DROP INDEX/);
  });

  it("matches the Prisma schema", () => {
    const thread = modelBody("ForumThread");
    const post = modelBody("ForumPost");
    for (const body of [thread, post]) {
      expect(body).toMatch(/\n\s+authorUserId\s+String\?/);
      expect(body).toMatch(/\n\s+xenforoUserId\s+Int\?/);
      expect(body).toContain("@@index([xenforoUserId])");
      expect(body).toMatch(/\n\s+importedAuthorName\s+String\?/);
    }
    expect(post).toContain("@@index([createdAt])");
  });
});
