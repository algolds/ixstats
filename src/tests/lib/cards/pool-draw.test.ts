/** @jest-environment node */
/** Cards refresh §4: packs and the daily card roll a rarity and draw exactly it; only the daily card redistributes. */
import {
  createPoolDrawer,
  DAILY_POOL_WHERE,
  oddsWithCards,
  rollRarity,
  tierCounts,
} from "~/lib/cards/pool-draw";

const odds = { COMMON: 65, UNCOMMON: 25, RARE: 7, ULTRA_RARE: 2, EPIC: 0.9, LEGENDARY: 0.1 };
const none = { COMMON: 0, UNCOMMON: 0, RARE: 0, ULTRA_RARE: 0, EPIC: 0, LEGENDARY: 0 };

afterEach(() => jest.restoreAllMocks());

describe("rollRarity", () => {
  it.each([
    [0, "COMMON"],
    [0.6499, "COMMON"],
    [0.65, "UNCOMMON"],
    [0.9, "RARE"],
    [0.97, "ULTRA_RARE"],
    [0.99, "EPIC"],
    [0.9995, "LEGENDARY"],
  ] as const)("rolls %d as %s", (roll, rarity) => {
    expect(rollRarity(odds, () => roll)).toBe(rarity);
  });

  it("rolls over the odds it is given, so odds short of 100 leave nothing over for Common", () => {
    expect(rollRarity({ ...none, UNCOMMON: 1 }, () => 0.99)).toBe("UNCOMMON");
  });

  it("never rolls a rarity with no odds", () => {
    expect(rollRarity({ ...none, RARE: 100 }, () => 0)).toBe("RARE");
  });

  it("reads negative odds as none", () => {
    expect(rollRarity({ ...none, COMMON: -50, UNCOMMON: 50 }, () => 0)).toBe("UNCOMMON");
  });

  it("rolls Common when no rarity has odds", () => {
    expect(rollRarity(none, () => 0.5)).toBe("COMMON");
  });

  it("rolls with Math.random by default", () => {
    jest.spyOn(Math, "random").mockReturnValue(0.99);
    expect(rollRarity(odds)).toBe("EPIC");
  });
});

describe("tierCounts", () => {
  it("counts the pool's cards of each rarity in one grouped read", async () => {
    const groupBy = jest.fn().mockResolvedValue([
      { rarity: "COMMON", _count: { _all: 5 } },
      { rarity: "RARE", _count: { _all: 2 } },
    ]);
    const counts = await tierCounts({ card: { groupBy } } as never, { isRetired: false });
    expect(counts).toEqual({ COMMON: 5, RARE: 2 });
    expect(groupBy).toHaveBeenCalledTimes(1);
    expect(groupBy).toHaveBeenCalledWith({
      by: ["rarity"],
      where: { isRetired: false },
      _count: { _all: true },
    });
  });
});

describe("createPoolDrawer", () => {
  const card = { id: "card_u" };
  const txWith = (found: { id: string } | null) => ({
    card: { findFirst: jest.fn().mockResolvedValue(found), count: jest.fn() },
  });

  it("draws exactly the rolled rarity, at a random place in its tier", async () => {
    const tx = txWith(card);
    const drawer = createPoolDrawer(tx as never, { isRetired: false }, { UNCOMMON: 4 }, () => 0.7);
    expect(await drawer.draw("UNCOMMON")).toEqual(card);
    expect(tx.card.findFirst).toHaveBeenCalledWith({
      where: { AND: [{ isRetired: false }, { rarity: "UNCOMMON" }] },
      orderBy: { id: "asc" },
      skip: 2,
    });
    expect(tx.card.count).not.toHaveBeenCalled();
  });

  it("can draw the last card of a tier", async () => {
    const tx = txWith(card);
    await createPoolDrawer(tx as never, {}, { RARE: 4 }, () => 0.99).draw("RARE");
    expect(tx.card.findFirst).toHaveBeenCalledWith(expect.objectContaining({ skip: 3 }));
  });

  it("returns null for an empty tier, never another rarity's card", async () => {
    const tx = txWith(card);
    const drawer = createPoolDrawer(tx as never, {}, { COMMON: 9, RARE: 0 });
    expect(await drawer.draw("RARE")).toBeNull();
    expect(await drawer.draw("EPIC")).toBeNull();
    expect(tx.card.findFirst).not.toHaveBeenCalled();
  });

  it("returns null when the tier's cards went between the count and the draw, never another tier's card", async () => {
    // The Epic card went since the count; Common still has cards
    const findFirst = jest.fn(
      async ({ where }: { where: { AND: [object, { rarity: string }] } }) =>
        where.AND[1].rarity === "EPIC" ? null : card
    );
    const drawer = createPoolDrawer({ card: { findFirst } } as never, {}, { COMMON: 9, EPIC: 1 });
    expect(await drawer.draw("EPIC")).toBeNull();
    expect(findFirst).toHaveBeenCalledTimes(1);
  });

  it("picks the place with Math.random by default", async () => {
    jest.spyOn(Math, "random").mockReturnValue(0.5);
    const tx = txWith(card);
    await createPoolDrawer(tx as never, {}, { COMMON: 10 }).draw("COMMON");
    expect(tx.card.findFirst).toHaveBeenCalledWith(expect.objectContaining({ skip: 5 }));
  });
});

describe("oddsWithCards", () => {
  it("drops the odds of every rarity with no card, an uncounted one included", () => {
    expect(oddsWithCards(odds, { UNCOMMON: 3, RARE: 0, LEGENDARY: 1 })).toEqual({
      ...none,
      UNCOMMON: 25,
      LEGENDARY: 0.1,
    });
    expect(odds.COMMON).toBe(65);
  });

  it("gives the empty rarities' share to the rarities that have cards, in proportion", () => {
    const shared = oddsWithCards(odds, { UNCOMMON: 3, LEGENDARY: 1 });
    // 25 to 0.1: Legendary takes the top 0.1 / 25.1 of the roll
    expect(rollRarity(shared, () => 0)).toBe("UNCOMMON");
    expect(rollRarity(shared, () => 0.99)).toBe("UNCOMMON");
    expect(rollRarity(shared, () => 0.999)).toBe("LEGENDARY");
  });
});

it("keeps unreviewed, retired, unpublished-realm, bound, Special, Trophy, Nation and restricted-art cards out of the daily pool", () => {
  expect(DAILY_POOL_WHERE).toEqual({
    reviewState: "APPROVED",
    isRetired: false,
    realm: { status: { notIn: ["draft", "generating"] } },
    isBound: false,
    cardType: { notIn: ["SPECIAL", "TROPHY", "NATION"] },
    artLicence: { isNot: { status: "RESTRICTED" } },
  });
});
