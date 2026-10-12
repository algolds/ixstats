/** @jest-environment node */
import { isFeaturable, pickFeaturedRealm } from "~/lib/front-page";

const DAY = 86_400_000;
const realm = (slug: string, nationCount = 5, hasPoliticalMap = true) => ({
  slug,
  nationCount,
  hasPoliticalMap,
});

describe("isFeaturable", () => {
  it("needs a political map and at least three nations", () => {
    expect(isFeaturable(realm("a", 3))).toBe(true);
    expect(isFeaturable(realm("a", 2))).toBe(false);
    expect(isFeaturable(realm("a", 50, false))).toBe(false);
  });
});

describe("pickFeaturedRealm", () => {
  const realms = [realm("eurth"), realm("ixnay"), realm("caphiria"), realm("empty", 0)];

  it("walks the eligible realms in slug order, one per UTC day, and wraps", () => {
    const picks = [0, 1, 2, 3].map((day) => pickFeaturedRealm(realms, day * DAY)?.slug);
    expect(picks).toEqual(["caphiria", "eurth", "ixnay", "caphiria"]);
  });

  it("keeps the same realm all day and changes at midnight UTC", () => {
    expect(pickFeaturedRealm(realms, 5 * DAY)).toBe(pickFeaturedRealm(realms, 6 * DAY - 1));
    expect(pickFeaturedRealm(realms, 6 * DAY)).not.toBe(pickFeaturedRealm(realms, 6 * DAY - 1));
  });

  it("ignores input order", () => {
    expect(pickFeaturedRealm([...realms].reverse(), 0)?.slug).toBe("caphiria");
  });

  it("returns the only eligible realm every day, and null when none qualifies", () => {
    expect(pickFeaturedRealm([realm("solo")], 123 * DAY)?.slug).toBe("solo");
    expect(pickFeaturedRealm([realm("empty", 0)], 0)).toBeNull();
  });
});
