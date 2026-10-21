import {
  categoryVisibilityWhere,
  isBoardCategory,
  notBoardCategory,
  onlyBoardCategory,
  REALM_BOARD_KEY,
  REALM_CATEGORIES,
  REALM_HUB_KEY,
  SITE_CATEGORIES,
  visibleForumVisibilities,
} from "~/lib/thinkpages-forum/categories";
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

  it("gives the opposite fragment for reading only boards", () => {
    expect(onlyBoardCategory()).toEqual({
      OR: [{ style: "board" }, { scope: "realm", key: "board" }],
    });
  });
});
