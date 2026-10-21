/** @jest-environment node */
import {
  categoryVisibilityWhere,
  isBoardCategory,
  notBoardCategory,
  onlyBoardCategory,
  visibleForumVisibilities,
} from "~/lib/thinkpages-forum/categories";
describe("category visibility (M8)", () => {
  const anonymous = { signedIn: false, siteAdmin: false };
  const member = { signedIn: true, siteAdmin: false };
  const admin = { signedIn: true, siteAdmin: true };

  it("shows public to everyone, reporter_staff to members and staff to site admins", () => {
    expect(visibleForumVisibilities(anonymous)).toEqual(["public"]);
    expect(visibleForumVisibilities(member)).toEqual(["public", "reporter_staff"]);
    expect(visibleForumVisibilities(admin)).toEqual(["public", "reporter_staff", "staff"]);
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
  it("applies the key rule to realm categories only: a sitewide category keyed board is not the board", () => {
    expect(isBoardCategory({ key: "board", scope: "site" })).toBe(false);
    expect(isBoardCategory({ key: "board", scope: "realm" })).toBe(true);
    expect(isBoardCategory({ key: "board", style: "board", scope: "site" })).toBe(true);
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
