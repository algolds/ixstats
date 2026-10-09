/** @jest-environment node */
import { readFileSync } from "node:fs";
import {
  categoryVisibilityWhere,
  REALM_CATEGORIES,
  REALM_HUB_KEY,
  SITE_CATEGORIES,
  visibleForumVisibilities,
} from "~/lib/thinkpages-forum/categories";

const sql = readFileSync("prisma/migrations/20261008120000_thinkpages_forum/migration.sql", "utf8");
const realmSql = readFileSync("prisma/migrations/20261009120000_thinkpages_forum_realms/migration.sql", "utf8");

describe("sitewide forum categories", () => {
  it("has unique keys in a valid format", () => {
    const keys = SITE_CATEGORIES.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) expect(key).toMatch(/^[a-z0-9-]{2,40}$/);
  });

  it("matches the spec's sitewide section", () => {
    expect(SITE_CATEGORIES.map((c) => c.name)).toEqual([
      "Rules", "Announcements", "Reports", "Staff", "Find a Realm", "General", "Side Games",
    ]);
    expect(SITE_CATEGORIES.filter((c) => c.icAllowed).map((c) => c.key)).toEqual(["side-games"]);
  });

  it("is seeded by the migration, one row per category", () => {
    for (const c of SITE_CATEGORIES) {
      expect(sql).toContain(`'${c.key}'`);
      expect(sql).toContain(`'${c.name.replace(/'/g, "''")}'`);
    }
    expect(sql).toMatch(/ON CONFLICT[\s\S]*DO NOTHING/);
  });
});

describe("realm forum categories", () => {
  it("has the three section categories in order, with valid unique keys", () => {
    const keys = REALM_CATEGORIES.map((c) => c.key);
    expect(keys).toEqual(["hub", "character-threads", "current-events"]);
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) expect(key).toMatch(/^[a-z0-9-]{2,40}$/);
    expect(REALM_HUB_KEY).toBe(keys[0]);
  });

  it("allows in-character posting only in the last two", () => {
    expect(REALM_CATEGORIES.filter((c) => c.icAllowed).map((c) => c.key)).toEqual([
      "character-threads",
      "current-events",
    ]);
  });

  it("is seeded by the phase 2 migration for every realm and IxWorld", () => {
    for (const c of REALM_CATEGORIES) {
      expect(realmSql).toContain(`'${c.key}'`);
      expect(realmSql).toContain(`'${c.name.replace(/'/g, "''")}'`);
      expect(realmSql).toContain(`'${c.description.replace(/'/g, "''")}'`);
    }
    expect(realmSql).toContain("UNION SELECT 'default'");
    expect(realmSql).toContain('ON CONFLICT ("scope", "realmId", "key") DO NOTHING');
  });

  it("adds the archive source refs idempotently", () => {
    expect(realmSql).toContain("ADD COLUMN IF NOT EXISTS");
    expect(realmSql).toMatch(/"forum_threads"[\s\S]*"sourceRef"/);
    expect(realmSql).toMatch(/"forum_posts"[\s\S]*"sourceRef"/);
    expect(realmSql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS "forum_threads_sourceRef_key"');
    expect(realmSql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS "forum_posts_sourceRef_key"');
  });
});

describe("category visibility (M8)", () => {
  const anonymous = { signedIn: false, siteAdmin: false };
  const member = { signedIn: true, siteAdmin: false };
  const admin = { signedIn: true, siteAdmin: true };

  it("shows public to everyone, reporter_staff to members and staff to site admins", () => {
    expect(visibleForumVisibilities(anonymous)).toEqual(["public"]);
    expect(visibleForumVisibilities(member)).toEqual(["public", "reporter_staff"]);
    expect(visibleForumVisibilities(admin)).toEqual(["public", "reporter_staff", "staff"]);
  });

  it("covers every visibility a seeded category uses", () => {
    const all = visibleForumVisibilities(admin);
    for (const c of SITE_CATEGORIES) expect(all).toContain(c.visibility);
  });

  it("gives the same rule as a Prisma where fragment", () => {
    for (const viewer of [anonymous, member, admin]) {
      expect(categoryVisibilityWhere(viewer)).toEqual({
        visibility: { in: [...visibleForumVisibilities(viewer)] },
      });
    }
  });
});
