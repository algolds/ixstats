import {
  activePoints,
  autoBanTier,
  banExpiry,
  banNotice,
  DAY_MS,
  isBanActive,
  strongestBan,
  warningExpiry,
} from "~/lib/thinkpages-forum/moderation-policy";

const NOW = new Date("2026-10-10T12:00:00.000Z");
const later = (days: number) => new Date(NOW.getTime() + days * DAY_MS);
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
