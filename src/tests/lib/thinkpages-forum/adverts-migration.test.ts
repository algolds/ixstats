/** @jest-environment node */
/**
 * The realm adverts migration: hand-written, additive and idempotent, so the controller can apply it (and re-apply it)
 * to the clone and dev databases and the owner to production.
 */
import { readdirSync, readFileSync } from "node:fs";

const DIR = "20261018120000_thinkpages_realm_adverts";
const sql = readFileSync(`prisma/migrations/${DIR}/migration.sql`, "utf8");
const forumSchema = readFileSync("prisma/schema/forum.prisma", "utf8");
const mapsSchema = readFileSync("prisma/schema/maps.prisma", "utf8");
const statements = sql
  .replace(/--[^\n]*/g, "")
  .replace(/\s+/g, " ")
  .trim();

describe("realm adverts migration", () => {
  it("sorts after the engagement, reactions and action link rewards migrations", () => {
    const dirs = readdirSync("prisma/migrations")
      .filter((d) => /^\d{14}_/.test(d))
      .sort();
    for (const earlier of [
      "20261015120000_thinkpages_forum_engagement",
      "20261016120000_thinkpages_forum_reactions",
      "20261017120000_action_link_rewards",
    ]) {
      expect(dirs.indexOf(earlier)).toBeGreaterThan(-1);
      expect(dirs.indexOf(DIR)).toBeGreaterThan(dirs.indexOf(earlier));
    }
  });

  it("adds the column, its unique index and its foreign key only when they are missing", () => {
    expect(statements).toContain(
      'ALTER TABLE "forum_threads" ADD COLUMN IF NOT EXISTS "advertRealmId" TEXT'
    );
    expect(statements).toContain(
      'CREATE UNIQUE INDEX IF NOT EXISTS "forum_threads_advertRealmId_key" ON "forum_threads"("advertRealmId")'
    );
    expect(statements).toContain("conname = 'forum_threads_advertRealmId_fkey'");
    expect(statements).toMatch(
      /FOREIGN KEY \("advertRealmId"\) REFERENCES "realms"\("id"\) ON DELETE SET NULL/
    );
  });

  it("changes nothing else", () => {
    expect(statements.match(/CREATE (UNIQUE )?INDEX (?!IF NOT EXISTS)/g) ?? []).toEqual([]);
    expect(
      statements.match(/ALTER TABLE "[a-z_]+" (?!ADD COLUMN IF NOT EXISTS|ADD CONSTRAINT)/g) ?? []
    ).toEqual([]);
    expect(statements).not.toMatch(
      /\b(?:DROP|TRUNCATE|INSERT)\b|(?<!ON )\b(?:UPDATE|DELETE)\b/
    );
  });

  it("matches the Prisma schema", () => {
    const thread = forumSchema.match(/model ForumThread \{([\s\S]*?)\n\}/)?.[1] ?? "";
    expect(thread).toMatch(/advertRealmId\s+String\?\s+@unique/);
    expect(thread).toMatch(
      /advertRealm\s+Realm\?\s+@relation\("RealmAdvert", fields: \[advertRealmId\], references: \[id\], onDelete: SetNull\)/
    );
    const realm = mapsSchema.match(/model Realm \{([\s\S]*?)\n\}/)?.[1] ?? "";
    expect(realm).toMatch(/advertThread\s+ForumThread\?\s+@relation\("RealmAdvert"\)/);
  });
});
