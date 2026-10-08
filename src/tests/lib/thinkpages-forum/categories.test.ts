/** @jest-environment node */
import { readFileSync } from "node:fs";
import { SITE_CATEGORIES } from "~/lib/thinkpages-forum/categories";

const sql = readFileSync("prisma/migrations/20261008120000_thinkpages_forum/migration.sql", "utf8");

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
