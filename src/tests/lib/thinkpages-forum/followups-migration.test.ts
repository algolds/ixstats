/** @jest-environment node */
/**
 * The forum follow-ups migration (M7, M8, M11, N5): hand-written, additive and idempotent, so the owner can apply it
 * (and re-apply it) on the clone, dev and production databases.
 */
import { readdirSync, readFileSync } from "node:fs";

const DIR = "20261012120000_thinkpages_forum_followups";
const sql = readFileSync(`prisma/migrations/${DIR}/migration.sql`, "utf8");
const schema = readFileSync("prisma/schema/forum.prisma", "utf8");

const count = (text: string, pattern: RegExp): number => text.match(pattern)?.length ?? 0;
/** One model's body in the Prisma schema. */
const modelBody = (name: string): string =>
  schema.match(new RegExp(`model ${name} \\{([^}]*)\\}`))?.[1] ?? "";
/** The statements, comments stripped, whitespace collapsed. */
const statements = sql
  .replace(/--[^\n]*/g, "")
  .replace(/\s+/g, " ")
  .trim();

describe("forum follow-ups migration", () => {
  it("sorts after every earlier forum migration", () => {
    const dirs = readdirSync("prisma/migrations")
      .filter((d) => /^\d{14}_/.test(d))
      .sort();
    expect(dirs.indexOf(DIR)).toBeGreaterThan(
      dirs.indexOf("20261011120000_thinkpages_forum_import")
    );
    expect(dirs.indexOf("20261011120000_thinkpages_forum_import")).toBeGreaterThan(-1);
  });

  it("denormalizes the appeal's subject scope (M7) and the report's target author (M8), idempotently", () => {
    for (const column of [
      'ALTER TABLE "forum_appeals" ADD COLUMN IF NOT EXISTS "scope" TEXT;',
      'ALTER TABLE "forum_appeals" ADD COLUMN IF NOT EXISTS "scopeId" TEXT;',
      'ALTER TABLE "forum_reports" ADD COLUMN IF NOT EXISTS "targetAuthorId" TEXT;',
    ]) {
      expect(statements).toContain(column);
    }
    expect(count(sql, /ADD COLUMN/g)).toBe(3);
    expect(count(sql, /ADD COLUMN IF NOT EXISTS/g)).toBe(3);
  });

  it("backfills only rows still unset, from the ban, the warning, the thread and the post", () => {
    const updates = statements.match(/UPDATE "forum_(appeals|reports)"[^;]*;/g) ?? [];
    expect(updates).toHaveLength(4);
    for (const update of updates) expect(update).toMatch(/IS NULL/);
    expect(statements).toMatch(
      /UPDATE "forum_appeals" AS a SET "scope" = b\."scope", "scopeId" = b\."scopeId" FROM "forum_bans" AS b WHERE a\."subjectType" = 'ban' AND a\."subjectId" = b\."id" AND a\."scope" IS NULL;/
    );
    expect(statements).toMatch(
      /UPDATE "forum_appeals" AS a SET "scope" = CASE WHEN w\."categoryId" IS NULL THEN 'site' ELSE 'category' END, "scopeId" = w\."categoryId" FROM "forum_warnings" AS w WHERE a\."subjectType" = 'warning' AND a\."subjectId" = w\."id" AND a\."scope" IS NULL;/
    );
    for (const [type, table] of [
      ["thread", "forum_threads"],
      ["post", "forum_posts"],
    ]) {
      expect(statements).toContain(
        `UPDATE "forum_reports" AS r SET "targetAuthorId" = t."authorUserId" FROM "${table}" AS t WHERE r."targetType" = '${type}' AND r."targetId" = t."id" AND r."targetAuthorId" IS NULL AND t."authorUserId" IS NOT NULL;`
      );
    }
  });

  it("indexes the scoped appeal queue and the report author, idempotently, with Prisma's default names", () => {
    expect(statements).toContain(
      'CREATE INDEX IF NOT EXISTS "forum_appeals_scope_scopeId_status_createdAt_idx" ON "forum_appeals"("scope", "scopeId", "status", "createdAt");'
    );
    expect(statements).toContain(
      'CREATE INDEX IF NOT EXISTS "forum_reports_targetAuthorId_idx" ON "forum_reports"("targetAuthorId");'
    );
  });

  it("replaces the silent append-only rules with triggers that raise on UPDATE, DELETE and TRUNCATE (M11)", () => {
    expect(statements).toContain(
      'DROP RULE IF EXISTS "forum_mod_log_no_update" ON "forum_mod_log";'
    );
    expect(statements).toContain(
      'DROP RULE IF EXISTS "forum_mod_log_no_delete" ON "forum_mod_log";'
    );
    expect(statements).toMatch(
      /CREATE OR REPLACE FUNCTION "forum_mod_log_append_only"\(\) RETURNS trigger LANGUAGE plpgsql AS \$\$ BEGIN RAISE EXCEPTION/
    );
    expect(statements).toContain(
      'DROP TRIGGER IF EXISTS "forum_mod_log_no_update_delete" ON "forum_mod_log"; CREATE TRIGGER "forum_mod_log_no_update_delete" BEFORE UPDATE OR DELETE ON "forum_mod_log" FOR EACH ROW EXECUTE FUNCTION "forum_mod_log_append_only"();'
    );
    expect(statements).toContain(
      'DROP TRIGGER IF EXISTS "forum_mod_log_no_truncate" ON "forum_mod_log"; CREATE TRIGGER "forum_mod_log_no_truncate" BEFORE TRUNCATE ON "forum_mod_log" FOR EACH STATEMENT EXECUTE FUNCTION "forum_mod_log_append_only"();'
    );
    expect(count(sql, /CREATE TRIGGER/g)).toBe(count(sql, /DROP TRIGGER IF EXISTS/g));
  });

  it("restores the sitewide category key's partial unique index, which db push may drop (N5)", () => {
    expect(statements).toContain(
      `CREATE UNIQUE INDEX IF NOT EXISTS "forum_categories_site_key_unique" ON "forum_categories"("key") WHERE "scope" = 'site';`
    );
  });

  it("is additive: no table, column or index is dropped and no constraint tightened", () => {
    expect(sql).not.toMatch(/CREATE TABLE|DROP TABLE|DROP COLUMN|DROP INDEX|SET NOT NULL/);
  });

  it("matches the Prisma schema, which documents what Prisma cannot express", () => {
    const appeal = modelBody("ForumAppeal");
    expect(appeal).toMatch(/\n\s+scope\s+String\?/);
    expect(appeal).toMatch(/\n\s+scopeId\s+String\?/);
    expect(appeal).toContain("@@index([scope, scopeId, status, createdAt])");
    const report = modelBody("ForumReport");
    expect(report).toMatch(/\n\s+targetAuthorId\s+String\?/);
    expect(report).toContain("@@index([targetAuthorId])");
    expect(schema).toContain("forum_categories_site_key_unique");
    expect(schema).toContain("forum_mod_log_append_only");
  });
});
