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
  const db = createMockPrisma();
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

describe("nationLoader", () => {
  it("is a country loader that declares every key it returns", async () => {
    const { load } = setup();
    expect(nationLoader.scope).toBe("country");
    expect(Object.keys(await load()).sort()).toEqual([...nationLoader.keys].sort());
  });

  it("returns nothing for a user with no country", async () => {
    const { ctx } = setup();
    expect(await nationLoader.load({ ...ctx, countryId: null })).toEqual({});
  });

  it("ownedMonths reads Country.ownedSince; null ownedSince gives 0 months", async () => {
    expect((await setup({ ownedSince: null }).load()).ownedMonths).toBe(0);
    expect((await setup({ ownedSince: ago(18 * MONTH_MS) }).load()).ownedMonths).toBe(18);
    expect((await setup(null).load()).ownedMonths).toBe(0);
  });

  it("armsAttached is 1 only for a coat of arms the Vexel render wrote, not an imported wiki image", async () => {
    expect((await setup({ coatOfArms: RENDERED }).load()).armsAttached).toBe(1);
    expect(
      (await setup({ coatOfArms: "https://ixwiki.com/images/arms.png" }).load()).armsAttached
    ).toBe(0);
    expect((await setup({ coatOfArms: "/images/uploads/arms.png" }).load()).armsAttached).toBe(0);
    expect((await setup({ coatOfArms: null }).load()).armsAttached).toBe(0);
  });

  it("identityComplete reads the country's national identity", async () => {
    expect((await setup({ nationalIdentity: COMPLETE_IDENTITY }).load()).identityComplete).toBe(1);
    expect(
      (await setup({ nationalIdentity: { ...COMPLETE_IDENTITY, motto: null } }).load())
        .identityComplete
    ).toBe(0);
    expect((await setup({ nationalIdentity: null }).load()).identityComplete).toBe(0);
  });
});

describe("story pins", () => {
  const pin = (monthsAgo: number, year: number | null) => ({
    createdAt: ago(monthsAgo * MONTH_MS),
    ixTimeYear: year,
  });
  /** 25 pins over 6 real months and 5 in-world years. */
  const chronicle = () => Array.from({ length: 25 }, (_, i) => pin((i % 6) + 1, 2000 + (i % 5)));

  it("asks for the country's approved pins", async () => {
    const { db, load } = setup();
    await load();
    expect(db.storyPin.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { countryId: "c1", status: "approved" } })
    );
  });

  it("storyPinsApproved counts the pins once they span 6 different real months, else 0", async () => {
    const { db, load } = setup();
    db.storyPin.findMany.mockResolvedValue(chronicle());
    const metrics = await load();
    expect(metrics.storyPinsApproved).toBe(25);
    expect(metrics.storyPinYears).toBe(5);

    db.storyPin.findMany.mockResolvedValue(
      chronicle().map((p, i) => pin(1 + (i % 5), p.ixTimeYear ?? 0))
    );
    expect((await load()).storyPinsApproved).toBe(0);
  });

  it("storyPinYears counts different in-world years once each and skips pins with no year", async () => {
    const { db, load } = setup();
    db.storyPin.findMany.mockResolvedValue([
      pin(1, 1900),
      pin(1, 1900),
      pin(2, 1901),
      pin(3, null),
    ]);
    expect((await load()).storyPinYears).toBe(2);
  });
});

describe("nationAccountLoader", () => {
  function accountSetup() {
    const db = createMockPrisma();
    const ctx: MetricContext = {
      db: db as never,
      clerkUserId: "clerk_1",
      userId: "user_1",
      countryId: null,
      now: NOW,
    };
    return { db, load: () => nationAccountLoader.load(ctx) };
  }

  it("is an account loader and works without a country", async () => {
    const { load } = accountSetup();
    expect(nationAccountLoader.scope).toBe("account");
    expect(Object.keys(await load()).sort()).toEqual([...nationAccountLoader.keys].sort());
  });

  it("heraldryPublishedInstitutions counts the user's published institution and dynasty designs by Clerk id", async () => {
    const { db, load } = accountSetup();
    db.heraldryAchievement.count.mockResolvedValue(3);
    expect((await load()).heraldryPublishedInstitutions).toBe(3);
    expect(db.heraldryAchievement.count).toHaveBeenCalledWith({
      where: {
        ownerId: "clerk_1",
        subjectType: { in: ["INSTITUTION", "DYNASTY"] },
        isPublished: true,
      },
    });
  });

  it("mapEditsApproved counts the user's approved map edits by Clerk id", async () => {
    const { db, load } = accountSetup();
    db.mapEditRequest.count.mockResolvedValue(10);
    expect((await load()).mapEditsApproved).toBe(10);
    expect(db.mapEditRequest.count).toHaveBeenCalledWith({
      where: { userId: "clerk_1", status: "approved" },
    });
  });
});
