/** @jest-environment node */
import { readFileSync } from "node:fs";
import {
  activePoints,
  autoBanTier,
  banExpiry,
  banNotice,
  BAN_SCOPES,
  DAY_MS,
  isBanActive,
  MODERATION_POLICY,
  strongestBan,
  warningExpiry,
} from "~/lib/thinkpages-forum/moderation-policy";

const NOW = new Date("2026-10-10T12:00:00.000Z");
const later = (days: number) => new Date(NOW.getTime() + days * DAY_MS);

describe("moderation policy constants", () => {
  it("encodes the owner decisions", () => {
    expect(MODERATION_POLICY.warningTtlDays).toBe(90);
    expect(MODERATION_POLICY.autoBanTiers).toEqual([
      { points: 10, days: 30 },
      { points: 5, days: 7 },
    ]);
    expect(MODERATION_POLICY.maxPointsPerWarning).toEqual({ siteAdmin: 5, moderator: 2 });
    expect(BAN_SCOPES).toEqual(["site", "realm", "category"]);
  });
});

describe("warningExpiry", () => {
  it("adds the warning lifetime", () => {
    expect(warningExpiry(NOW).getTime() - NOW.getTime()).toBe(90 * DAY_MS);
  });
});

describe("activePoints", () => {
  it("counts live warnings and ignores expired and revoked rows", () => {
    const warnings = [
      { points: 2, expiresAt: later(10), revokedAt: null },
      { points: 3, expiresAt: later(-1), revokedAt: null },
      { points: 4, expiresAt: later(10), revokedAt: later(-2) },
      { points: 1, expiresAt: later(1), revokedAt: null },
    ];
    expect(activePoints(warnings, NOW)).toBe(3);
  });

  it("treats a warning as expired at the instant it expires", () => {
    expect(activePoints([{ points: 2, expiresAt: NOW, revokedAt: null }], NOW)).toBe(0);
  });

  it("is zero with no warnings", () => {
    expect(activePoints([], NOW)).toBe(0);
  });
});

describe("autoBanTier", () => {
  it("returns the highest tier reached", () => {
    expect(autoBanTier(4)).toBeNull();
    expect(autoBanTier(0)).toBeNull();
    expect(autoBanTier(5)?.days).toBe(7);
    expect(autoBanTier(9)?.days).toBe(7);
    expect(autoBanTier(10)?.days).toBe(30);
    expect(autoBanTier(25)?.days).toBe(30);
  });
});

describe("banExpiry", () => {
  it("is permanent for null days", () => {
    expect(banExpiry(null, NOW)).toBeNull();
  });

  it("adds whole days", () => {
    expect(banExpiry(7, NOW)).toEqual(later(7));
  });
});

describe("isBanActive", () => {
  it("is active while permanent or unexpired and not lifted", () => {
    expect(isBanActive({ expiresAt: null, liftedAt: null }, NOW)).toBe(true);
    expect(isBanActive({ expiresAt: later(1), liftedAt: null }, NOW)).toBe(true);
  });

  it("is inactive once lifted or expired", () => {
    expect(isBanActive({ expiresAt: null, liftedAt: later(-1) }, NOW)).toBe(false);
    expect(isBanActive({ expiresAt: later(-1), liftedAt: null }, NOW)).toBe(false);
    expect(isBanActive({ expiresAt: NOW, liftedAt: null }, NOW)).toBe(false);
  });
});

describe("banNotice", () => {
  it("names the scope, the end date and the reason", () => {
    const expiresAt = new Date("2026-10-12T00:00:00.000Z");
    expect(banNotice({ scope: "site", expiresAt, reason: "Spam" })).toBe(
      "You are banned from the forum until 12 Oct 2026: Spam"
    );
    expect(banNotice({ scope: "realm", expiresAt, reason: "Spam" })).toBe(
      "You are banned from this realm's forum until 12 Oct 2026: Spam"
    );
    expect(banNotice({ scope: "category", expiresAt, reason: "Spam" })).toBe(
      "You are banned from this category until 12 Oct 2026: Spam"
    );
  });

  it("says a permanent ban lasts until a moderator lifts it", () => {
    expect(banNotice({ scope: "site", expiresAt: null, reason: "Harassment" })).toBe(
      "You are banned from the forum until a moderator lifts it: Harassment"
    );
  });

  it("ends with a full stop when there is no reason", () => {
    expect(banNotice({ scope: "site", expiresAt: null, reason: "  " })).toBe(
      "You are banned from the forum until a moderator lifts it."
    );
    expect(banNotice({ scope: "realm", expiresAt: new Date("2026-01-05T00:00:00.000Z"), reason: "" })).toBe(
      "You are banned from this realm's forum until 5 Jan 2026."
    );
  });

  it("never uses an em dash", () => {
    for (const scope of BAN_SCOPES) {
      expect(banNotice({ scope, expiresAt: null, reason: "x" })).not.toContain("—");
    }
  });
});

describe("strongestBan", () => {
  it("is null for no bans", () => {
    expect(strongestBan([])).toBeNull();
  });

  it("prefers site over realm over category", () => {
    const site = { scope: "site" as const, expiresAt: later(1) };
    const realm = { scope: "realm" as const, expiresAt: null };
    const category = { scope: "category" as const, expiresAt: null };
    expect(strongestBan([category, realm, site])).toBe(site);
    expect(strongestBan([category, realm])).toBe(realm);
  });

  it("then prefers permanent, then the later expiry", () => {
    const short = { scope: "realm" as const, expiresAt: later(2) };
    const long = { scope: "realm" as const, expiresAt: later(9) };
    const permanent = { scope: "realm" as const, expiresAt: null };
    expect(strongestBan([short, long])).toBe(long);
    expect(strongestBan([long, permanent, short])).toBe(permanent);
  });
});

describe("moderation migration", () => {
  const sql = readFileSync("prisma/migrations/20261010120000_thinkpages_forum_moderation/migration.sql", "utf8");

  it("creates every table idempotently", () => {
    for (const table of [
      "forum_category_moderators",
      "forum_reports",
      "forum_warnings",
      "forum_bans",
      "forum_mod_log",
      "forum_appeals",
    ]) {
      expect(sql).toContain(`CREATE TABLE IF NOT EXISTS "${table}"`);
    }
    const creates = sql.match(/CREATE TABLE/g) ?? [];
    expect(creates.length).toBe(6);
    expect(sql.match(/CREATE TABLE IF NOT EXISTS/g)?.length).toBe(6);
  });

  it("adds the automatic ban tier column idempotently, after its table", () => {
    expect(sql).toContain('ALTER TABLE "forum_bans" ADD COLUMN IF NOT EXISTS "autoTier" INTEGER;');
    expect(sql.match(/ADD COLUMN/g)?.length).toBe(sql.match(/ADD COLUMN IF NOT EXISTS/g)?.length);
    expect(sql.indexOf('ADD COLUMN IF NOT EXISTS "autoTier"')).toBeGreaterThan(
      sql.indexOf('CREATE TABLE IF NOT EXISTS "forum_bans"')
    );
  });

  it("creates every index idempotently with Prisma's default names", () => {
    const indexes = [
      "forum_category_moderators_categoryId_userId_key",
      "forum_category_moderators_userId_idx",
      "forum_reports_status_categoryId_createdAt_idx",
      "forum_reports_targetType_targetId_idx",
      "forum_reports_reporterId_idx",
      "forum_warnings_userId_expiresAt_idx",
      "forum_warnings_categoryId_createdAt_idx",
      "forum_bans_sourceRef_key",
      "forum_bans_userId_scope_scopeId_idx",
      "forum_bans_scope_scopeId_createdAt_idx",
      "forum_mod_log_createdAt_idx",
      "forum_mod_log_targetType_targetId_idx",
      "forum_mod_log_scope_scopeId_createdAt_idx",
      "forum_mod_log_actorId_createdAt_idx",
      "forum_appeals_subjectType_subjectId_key",
      "forum_appeals_status_createdAt_idx",
      "forum_appeals_userId_idx",
    ];
    for (const name of indexes) expect(sql).toMatch(new RegExp(`CREATE (UNIQUE )?INDEX IF NOT EXISTS "${name}"`));
    expect(sql.match(/CREATE (UNIQUE )?INDEX/g)?.length).toBe(indexes.length);
    expect(sql.match(/CREATE (UNIQUE )?INDEX IF NOT EXISTS/g)?.length).toBe(indexes.length);
  });

  it("adds the category moderator foreign key idempotently", () => {
    expect(sql).toContain("forum_category_moderators_categoryId_fkey");
    expect(sql).toMatch(/EXCEPTION WHEN duplicate_object THEN NULL/);
  });

  it("makes the mod log append-only", () => {
    expect(sql).toMatch(/CREATE OR REPLACE RULE "forum_mod_log_no_update" AS ON UPDATE TO "forum_mod_log" DO INSTEAD NOTHING/);
    expect(sql).toMatch(/CREATE OR REPLACE RULE "forum_mod_log_no_delete" AS ON DELETE TO "forum_mod_log" DO INSTEAD NOTHING/);
  });
});
