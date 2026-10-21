import {
  activePoints,
  banNotice,
  DAY_MS,
  strongestBan,
} from "~/lib/thinkpages-forum/moderation-policy";

const NOW = new Date("2026-10-10T12:00:00.000Z");
const later = (days: number) => new Date(NOW.getTime() + days * DAY_MS);
describe("activePoints", () => {
  it("treats a warning as expired at the instant it expires", () => {
    expect(activePoints([{ points: 2, expiresAt: NOW, revokedAt: null }], NOW)).toBe(0);
  });
});
describe("banNotice", () => {
  it("says a permanent ban lasts until a moderator lifts it", () => {
    expect(banNotice({ scope: "site", expiresAt: null, reason: "Harassment" })).toBe(
      "You are banned from the forum until a moderator lifts it: Harassment"
    );
  });
});

describe("strongestBan", () => {
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
