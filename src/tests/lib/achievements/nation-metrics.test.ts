/** @jest-environment node */
/**
 * The Nation metric loaders: stewardship from the real ownership date, the identity checklist, a
 * rendered Vexel coat of arms, and the account-level heraldry and map-edit counts.
 */
import {
  isIdentityComplete,
  nationAccountLoader,
  nationLoader,
  ownedMonths,
} from "~/lib/achievements/metrics/nation";
import type { MetricContext } from "~/lib/achievements/metrics/registry";
import { MONTH_MS } from "~/lib/achievements/time-buckets";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const NOW = new Date("2026-10-14T12:00:00.000Z");
const DAY_MS = 86_400_000;
const ago = (ms: number) => new Date(NOW.getTime() - ms);
const RENDERED =
  "/images/uploads/heraldry_0a1b2c3d-0a1b-0a1b-0a1b-0a1b2c3d4e5f_0123456789abcdef_256.png";

const COMPLETE_IDENTITY = {
  officialName: "Republic of Test",
  motto: "Onward",
  demonym: "Testan",
  currency: "Tester",
  officialLanguages: "Testish",
  nationalAnthem: "Song of Test",
  nationalDay: "1 May",
  capitalCityId: "city_1",
  nationalBird: "Heron",
  nationalFish: "Trout",
  nationalFlower: "Iris",
  nationalDish: null,
  nationalFruit: "  ",
  nationalDrink: null,
  nationalInstrument: null,
  nationalSymbol: null,
  nationalSport: null,
};

function setup(country: Record<string, unknown> | null = {}) {
  const db = createMockPrisma({ $queryRaw: jest.fn().mockResolvedValue([]) });
  db.country.findUnique.mockResolvedValue(
    country && { ownedSince: null, coatOfArms: null, nationalIdentity: null, ...country }
  );
  const ctx: MetricContext = {
    db: db as never,
    clerkUserId: "clerk_1",
    userId: "user_1",
    countryId: "c1",
    now: NOW,
  };
  return { db, ctx, load: () => nationLoader.load(ctx) };
}

describe("ownedMonths", () => {
  it("is whole real months since ownedSince, and 0 for null", () => {
    expect(ownedMonths(null, NOW)).toBe(0);
    expect(ownedMonths(ago(6 * MONTH_MS), NOW)).toBe(6);
    expect(ownedMonths(ago(6 * MONTH_MS - 1), NOW)).toBe(5);
    expect(ownedMonths(ago(36 * MONTH_MS), NOW)).toBe(36);
    expect(ownedMonths(new Date(NOW.getTime() + DAY_MS), NOW)).toBe(0);
  });
});

describe("isIdentityComplete", () => {
  it("needs the core fields, a linked capital and 3 symbols, and nothing less", () => {
    expect(isIdentityComplete(COMPLETE_IDENTITY)).toBe(true);
    expect(isIdentityComplete(null)).toBe(false);
  });

  it.each([
    "officialName",
    "motto",
    "demonym",
    "currency",
    "officialLanguages",
    "nationalAnthem",
    "nationalDay",
    "capitalCityId",
  ])("is incomplete without %s", (field) => {
    expect(isIdentityComplete({ ...COMPLETE_IDENTITY, [field]: null })).toBe(false);
    expect(isIdentityComplete({ ...COMPLETE_IDENTITY, [field]: "   " })).toBe(false);
  });

  it("needs 3 non-blank symbols: 2 fall short", () => {
    expect(isIdentityComplete({ ...COMPLETE_IDENTITY, nationalFlower: " " })).toBe(false);
    expect(
      isIdentityComplete({ ...COMPLETE_IDENTITY, nationalFlower: " ", nationalSport: "Polo" })
    ).toBe(true);
  });
});

describe("loaders", () => {
  it.each([
    ["an 18-month owner with a rendered coat of arms and a full identity", { ownedSince: ago(18 * MONTH_MS), coatOfArms: RENDERED, nationalIdentity: COMPLETE_IDENTITY }, { ownedMonths: 18, armsAttached: 1, identityComplete: 1 }],
    ["an imported wiki coat of arms", { coatOfArms: "https://ixwiki.com/images/arms.png" }, { armsAttached: 0 }],
    ["an uploaded, not rendered, coat of arms", { coatOfArms: "/images/uploads/arms.png" }, { armsAttached: 0 }],
    ["an identity without a motto", { nationalIdentity: { ...COMPLETE_IDENTITY, motto: null } }, { identityComplete: 0 }],
    ["no ownership date, arms or identity", { ownedSince: null }, { ownedMonths: 0, armsAttached: 0, identityComplete: 0 }],
    ["a missing country row", null, { ownedMonths: 0, armsAttached: 0, identityComplete: 0 }],
  ] as const)("nationLoader reads %s", async (_case, country, expected) => {
    const metrics = await setup(country as Record<string, unknown> | null).load();
    expect(Object.keys(metrics).sort()).toEqual([...nationLoader.keys].sort());
    expect(metrics).toMatchObject(expected);
  });

  it.each([
    [25, 6, 5, { storyPinsApproved: 25, storyPinYears: 5 }],
    [25, 5, 5, { storyPinsApproved: 0, storyPinYears: 5 }],
    [4, 2, 2, { storyPinsApproved: 0, storyPinYears: 2 }],
    [0, 0, 0, { storyPinsApproved: 0, storyPinYears: 0 }],
  ])(
    "story pins: %d approved pins over %d real months and %d in-world years read as %o, from one aggregate",
    async (pins, months, years, expected) => {
      const { db, load } = setup();
      db.$queryRaw.mockResolvedValue([{ pins: BigInt(pins), months: BigInt(months), years: BigInt(years) }]);
      expect(await load()).toMatchObject(expected);
      const [strings, ...values] = db.$queryRaw.mock.calls[0] as [string[], ...string[]];
      expect(values).toEqual(["c1"]);
      expect(strings.join("?")).toMatch(/status = 'approved'/);
      expect(db.storyPin.findMany).not.toHaveBeenCalled();
    }
  );

  it("nationLoader loads nothing without a country", async () => {
    const { ctx } = setup();
    expect(await nationLoader.load({ ...ctx, countryId: null })).toEqual({});
  });

  it("nationAccountLoader counts the user's published institution and dynasty designs and approved map edits by Clerk id, with no country", async () => {
    const db = createMockPrisma();
    db.heraldryAchievement.count.mockResolvedValue(3);
    db.mapEditRequest.count.mockResolvedValue(10);
    const metrics = await nationAccountLoader.load({
      db: db as never,
      clerkUserId: "clerk_1",
      userId: "user_1",
      countryId: null,
      now: NOW,
    });
    expect(nationAccountLoader.scope).toBe("account");
    expect(metrics).toEqual({ heraldryPublishedInstitutions: 3, mapEditsApproved: 10 });
    expect(db.heraldryAchievement.count).toHaveBeenCalledWith({
      where: { ownerId: "clerk_1", subjectType: { in: ["INSTITUTION", "DYNASTY"] }, isPublished: true },
    });
    expect(db.mapEditRequest.count).toHaveBeenCalledWith({ where: { userId: "clerk_1", status: "approved" } });
  });
});
