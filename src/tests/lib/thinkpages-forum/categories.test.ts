/** @jest-environment node */
import { readFileSync } from "node:fs";
import {
  categoryVisibilityWhere,
  isBoardCategory,
  notBoardCategory,
  REALM_BOARD_KEY,
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

describe("the realm board category", () => {
  it("is keyed board and is not one of the realm's listed boards", () => {
    expect(REALM_BOARD_KEY).toBe("board");
    expect(REALM_CATEGORIES.map((c) => c.key)).not.toContain(REALM_BOARD_KEY);
  });

  it("is recognised by style board, or by the realm key board", () => {
    expect(isBoardCategory({ key: "board", style: "board" })).toBe(true);
    expect(isBoardCategory({ key: "anything", style: "board" })).toBe(true);
    expect(isBoardCategory({ key: "board", style: "ooc" })).toBe(true);
    expect(isBoardCategory({ key: "board" })).toBe(true);
    expect(isBoardCategory({ key: "board", style: null })).toBe(true);
  });

  it("applies the key rule to realm categories only: a sitewide category keyed board is not the board", () => {
    expect(isBoardCategory({ key: "board", scope: "site" })).toBe(false);
    expect(isBoardCategory({ key: "board", scope: "realm" })).toBe(true);
    expect(isBoardCategory({ key: "board", style: "board", scope: "site" })).toBe(true);
  });

  it("does not take ordinary categories for it", () => {
    expect(isBoardCategory({ key: "hub", style: "ooc" })).toBe(false);
    expect(isBoardCategory({ key: "character-threads", style: "ic" })).toBe(false);
    expect(isBoardCategory({ key: "boards" })).toBe(false);
    expect(isBoardCategory({ key: "hub", style: null })).toBe(false);
  });

  it("gives the same rule as a Prisma where fragment over the style column", () => {
    expect(notBoardCategory()).toEqual({
      style: { not: "board" },
      NOT: { scope: "realm", key: "board" },
    });
  });
});

describe("the realm board migration", () => {
  const boardSql = readFileSync(
    "prisma/migrations/20261014120000_thinkpages_realm_board/migration.sql",
    "utf8"
  );

  it("adds the post, realm and index columns idempotently", () => {
    for (const column of ["replyToPostId", "continuedThreadId", "emblemUrl", "boardVisitorsAllowed", "boardSlowModeSeconds"]) {
      expect(boardSql).toContain(`ADD COLUMN IF NOT EXISTS "${column}"`);
    }
    expect(boardSql).toContain('"forum_posts_replyToPostId_idx"');
    expect(boardSql.match(/ON DELETE SET NULL/g)).toHaveLength(2);
    expect(boardSql).toContain("IF NOT EXISTS");
  });

  it("backfills one board category and thread per realm, IxWorld included, guarded by NOT EXISTS", () => {
    expect(boardSql).toContain("UNION SELECT 'default'");
    expect(boardSql).toContain("'board'");
    expect(boardSql).toContain("0, 'public', 'any', true, 'board'");
    expect(boardSql).toContain("realm_board_thread:");
    expect(boardSql).toContain('WHERE NOT EXISTS (\n  SELECT 1 FROM "forum_categories"');
    expect(boardSql).toContain('AND NOT EXISTS (SELECT 1 FROM "forum_threads"');
  });
});
