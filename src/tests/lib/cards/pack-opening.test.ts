/**
 * Code audit VT-18: pack opening ignored `guaranteedRarity` and `themeFilter`, could pull
 * SPECIAL and crafted cards, threw (a 500) when a rarity tier was empty, and built ownership
 * ids from Date.now() + user + card, which collide when a pack pulls the same card twice.
 */

jest.mock("~/lib/notifications/api", () => ({
  notificationAPI: { create: jest.fn().mockResolvedValue(undefined) },
}));
jest.mock("~/lib/achievements/queue", () => ({ queueAchievementCheck: jest.fn() }));
jest.mock("~/lib/cards/xp-utils", () => ({ grantCardXp: jest.fn() }));
jest.mock("~/lib/cards/mint", () => ({ mintCopy: jest.fn() }));

import { mintCopy } from "~/lib/cards/mint";
import {
  bestPulledRarity,
  generatePackCards,
  openPack,
  PackError,
  themeFilterWhere,
} from "~/lib/cards/pack-service";
import { invalidateVaultConfigCache, clearUserPerksCache } from "~/lib/vault/vault-perks";
import { cardPacksUserRouter } from "~/server/api/routers/card-packs/user";
import { createCallerFactory } from "~/server/api/trpc";
import { createMockRouterContext } from "~/tests/helpers/router-context";

const USER = "user_db_id_1";
const USER_PACK_ID = "ckpackabcdefghijklmnop12"; // cuid-shaped, as the router validates

interface FakeCard {
  id: string;
  rarity: string;
  cardType: string;
  isRetired?: boolean;
  season?: number;
  category?: string | null;
  description?: string | null;
  totalSupply?: number | null;
  metadata?: any;
  lorewardEntryId?: string | null;
}

/** Evaluates the subset of Prisma CardWhereInput the pack pool uses. */
function matches(card: FakeCard, where: any): boolean {
  if (!where) return true;
  if (where.AND) return where.AND.every((w: any) => matches(card, w));
  if (where.OR) return where.OR.some((w: any) => matches(card, w));
  return Object.entries(where).every(([key, cond]: [string, any]) => {
    if (key === "metadata") return card.metadata?.[cond.path[0]] === cond.equals;
    const value = (card as any)[key] ?? null;
    if (cond && typeof cond === "object") {
      if ("not" in cond) return value !== cond.not;
      if ("in" in cond) return cond.in.includes(value);
      if ("notIn" in cond) return !cond.notIn.includes(value);
      if ("startsWith" in cond)
        return typeof value === "string" && value.startsWith(cond.startsWith);
    }
    if (key === "isRetired") return (value ?? false) === cond;
    return value === cond;
  });
}

function makeDb(cards: FakeCard[], pack: Record<string, unknown> = {}, userPack: any = {}) {
  const userPackRow = {
    id: USER_PACK_ID,
    userId: USER,
    isOpened: false,
    pack: {
      id: "p1",
      name: "Test Pack",
      cardCount: 5,
      commonOdds: 100,
      uncommonOdds: 0,
      rareOdds: 0,
      ultraRareOdds: 0,
      epicOdds: 0,
      legendaryOdds: 0,
      guaranteedRarity: null,
      cardType: null,
      season: null,
      themeFilter: null,
      ...pack,
    },
    ...userPack,
  };
  const db: any = {
    systemConfig: { findMany: jest.fn().mockResolvedValue([]) },
    userPack: {
      updateMany: jest.fn(async ({ where }: any) => {
        const claim =
          where.id === userPackRow.id &&
          where.userId === userPackRow.userId &&
          !userPackRow.isOpened;
        if (claim) userPackRow.isOpened = true;
        return { count: claim ? 1 : 0 };
      }),
      findFirst: jest.fn(async ({ where }: any) =>
        where.userId === userPackRow.userId ? { id: userPackRow.id } : null
      ),
      findUniqueOrThrow: jest.fn(async () => userPackRow),
    },
    user: { findUnique: jest.fn().mockResolvedValue({ id: USER, role: { level: 100 } }) },
    vaultTransaction: { findMany: jest.fn().mockResolvedValue([]) },
    vaultStoreItem: { findMany: jest.fn().mockResolvedValue([]) },
    card: {
      findMany: jest.fn(async ({ where }: any) => cards.filter((c) => matches(c, where))),
      count: jest.fn(async ({ where }: any) => cards.filter((c) => matches(c, where)).length),
      findFirst: jest.fn(
        async ({ where, skip }: any) => cards.filter((c) => matches(c, where))[skip ?? 0] ?? null
      ),
    },
    cardOwnership: { count: jest.fn().mockResolvedValue(0) },
  };
  db.$transaction = jest.fn((cb: (tx: any) => Promise<unknown>) => cb(db));
  return { db };
}

beforeEach(() => {
  let n = 0;
  jest
    .mocked(mintCopy)
    .mockImplementation(async (_tx, input) => ({ id: `copy_${++n}`, ...input }) as never);
  invalidateVaultConfigCache();
  clearUserPerksCache();
  for (const level of ["error", "warn", "info", "log"] as const) {
    jest.spyOn(console, level).mockImplementation(() => {});
  }
});
afterEach(() => {
  jest.restoreAllMocks();
  jest.mocked(mintCopy).mockReset();
});

describe("generatePackCards", () => {
  const allCommon = {
    cardCount: 5,
    commonOdds: 100,
    uncommonOdds: 0,
    rareOdds: 0,
    ultraRareOdds: 0,
    epicOdds: 0,
    legendaryOdds: 0,
  };

  it("upgrades one slot when no roll reaches the guaranteed rarity", () => {
    const rarities = generatePackCards({ ...allCommon, guaranteedRarity: "RARE" });
    expect(rarities).toHaveLength(5);
    expect(rarities.filter((r) => r === "RARE")).toHaveLength(1);
    expect(rarities.filter((r) => r === "COMMON")).toHaveLength(4);
  });

  it("leaves the rolls alone when one already meets the guarantee", () => {
    const rarities = generatePackCards({
      ...allCommon,
      commonOdds: 0,
      legendaryOdds: 100,
      guaranteedRarity: "RARE",
    });
    expect(rarities).toEqual(Array(5).fill("LEGENDARY"));
  });

  it("ignores an unknown guaranteed rarity", () => {
    expect(generatePackCards({ ...allCommon, guaranteedRarity: "MYTHIC" })).toEqual(
      Array(5).fill("COMMON")
    );
  });
});

describe("themeFilterWhere", () => {
  it("builds filters from each known key and ignores the rest", () => {
    expect(
      themeFilterWhere({
        categories: ["MILITARY", "NOT_A_CATEGORY"],
        cardTypes: "LORE",
        countryIds: ["c1"],
        bogus: ["x"],
      })
    ).toEqual([
      { category: { in: ["MILITARY"] } },
      { cardType: { in: ["LORE"] } },
      { countryId: { in: ["c1"] } },
    ]);
  });

  it("keeps only the card types the enum knows, and matches nothing for none", () => {
    expect(themeFilterWhere({ cardTypes: ["LORE", "BOGUS"] })).toEqual([
      { cardType: { in: ["LORE"] } },
    ]);
    expect(themeFilterWhere({ cardTypes: ["BOGUS"] })).toEqual([{ cardType: { in: [] } }]);
  });

  it("returns no filters when there is no theme", () => {
    expect(themeFilterWhere(null)).toEqual([]);
    expect(themeFilterWhere([])).toEqual([]);
  });
});

describe("openPack", () => {
  it("never pulls SPECIAL or crafted cards", async () => {
    const { db } = makeDb([
      { id: "special", rarity: "COMMON", cardType: "SPECIAL" },
      { id: "crafted", rarity: "COMMON", cardType: "NATION", metadata: { crafted: true } },
      {
        id: "legacy-craft",
        rarity: "COMMON",
        cardType: "NATION",
        description: "Crafted via Common Fusion",
        totalSupply: 1,
      },
      { id: "retired", rarity: "COMMON", cardType: "NATION", isRetired: true },
      { id: "ok", rarity: "COMMON", cardType: "NATION" },
    ]);
    const pulled = await openPack(db, USER, USER_PACK_ID);
    expect(pulled.map((p) => p.card.id)).toEqual(Array(5).fill("ok"));
  });

  it("never pulls a Loreward trophy card", async () => {
    const { db } = makeDb([
      { id: "trophy", rarity: "COMMON", cardType: "TROPHY", lorewardEntryId: "e1" },
      { id: "ok", rarity: "COMMON", cardType: "LORE" },
    ]);
    const pulled = await openPack(db, USER, USER_PACK_ID);
    expect(pulled.map((p) => p.card.id)).toEqual(Array(5).fill("ok"));
  });

  it("falls back to the next-lower rarity when a tier is empty", async () => {
    const { db } = makeDb(
      [
        { id: "common", rarity: "COMMON", cardType: "NATION" },
        { id: "uncommon", rarity: "UNCOMMON", cardType: "NATION" },
      ],
      { commonOdds: 0, ultraRareOdds: 100 }
    );
    const pulled = await openPack(db, USER, USER_PACK_ID);
    expect(pulled.map((p) => p.card.id)).toEqual(Array(5).fill("uncommon"));
  });

  it("applies the pack's theme filter and guaranteed rarity", async () => {
    const { db } = makeDb(
      [
        { id: "mil-common", rarity: "COMMON", cardType: "LORE", category: "MILITARY" },
        { id: "mil-rare", rarity: "RARE", cardType: "LORE", category: "MILITARY" },
        { id: "geo-common", rarity: "COMMON", cardType: "LORE", category: "GEOGRAPHY" },
        { id: "geo-rare", rarity: "RARE", cardType: "LORE", category: "GEOGRAPHY" },
      ],
      { themeFilter: { categories: ["MILITARY"] }, guaranteedRarity: "RARE" }
    );
    const ids = (await openPack(db, USER, USER_PACK_ID)).map((p) => p.card.id);
    expect(ids.every((id) => id.startsWith("mil-"))).toBe(true);
    expect(ids).toContain("mil-rare");
  });

  it("mints every pulled card through mintCopy, Standard, from the pack's transaction", async () => {
    const { db } = makeDb([{ id: "ok", rarity: "COMMON", cardType: "LORE" }]);
    const result = await openPack(db, USER, USER_PACK_ID);
    expect(result.map((r) => r.ownershipId)).toEqual([
      "copy_1",
      "copy_2",
      "copy_3",
      "copy_4",
      "copy_5",
    ]);
    expect(jest.mocked(mintCopy)).toHaveBeenCalledWith(db, {
      cardId: "ok",
      ownerId: USER,
      finish: "STANDARD",
      source: "PACK_OPEN",
    });
  });

  it("mints in cardId order, so concurrent opens take the serial locks in one order", async () => {
    const { db } = makeDb(
      [
        { id: "b-card", rarity: "COMMON", cardType: "LORE" },
        { id: "a-card", rarity: "COMMON", cardType: "LORE" },
      ],
      { cardCount: 6 }
    );
    // Six rarity rolls first, then one pick per slot: b-card, then a-card, so the draw order is not the mint order
    const rolls = [0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.9, 0.1, 0.9, 0.1, 0.9];
    const random = jest.spyOn(Math, "random");
    for (const roll of rolls) random.mockReturnValueOnce(roll);
    const result = await openPack(db, USER, USER_PACK_ID);
    const mintOrder = jest.mocked(mintCopy).mock.calls.map(([, input]) => input.cardId);
    expect(mintOrder).toEqual(["a-card", "a-card", "a-card", "b-card", "b-card", "b-card"]);
    expect(result).toHaveLength(6);
  });

  it("lets only one of two concurrent opens mint: the second is a CONFLICT", async () => {
    const { db } = makeDb([{ id: "ok", rarity: "COMMON", cardType: "LORE" }]);
    const [first, second] = await Promise.allSettled([
      openPack(db, USER, USER_PACK_ID),
      openPack(db, USER, USER_PACK_ID),
    ]);
    expect(first.status).toBe("fulfilled");
    expect(second).toMatchObject({ status: "rejected", reason: { code: "CONFLICT" } });
    expect(jest.mocked(mintCopy)).toHaveBeenCalledTimes(5);
  });

  it("never pulls a Trophy or Special card, whatever its other fields", async () => {
    const { db } = makeDb([
      { id: "trophy", rarity: "COMMON", cardType: "TROPHY" },
      { id: "special", rarity: "COMMON", cardType: "SPECIAL" },
      { id: "ns", rarity: "COMMON", cardType: "NS" },
    ]);
    const result = await openPack(db, USER, USER_PACK_ID);
    expect(new Set(result.map((r) => r.card.id))).toEqual(new Set(["ns"]));
  });

  it("throws a typed error when the pool is empty", async () => {
    const { db } = makeDb([{ id: "special", rarity: "COMMON", cardType: "SPECIAL" }]);
    await expect(openPack(db, USER, USER_PACK_ID)).rejects.toMatchObject({
      name: "PackError",
      code: "PRECONDITION_FAILED",
    });
  });
});

describe("cardPacks.openPack errors", () => {
  const createCaller = createCallerFactory(cardPacksUserRouter);
  const call = (db: any) =>
    createCaller(createMockRouterContext({ db }) as never).openPack({ userPackId: USER_PACK_ID });

  it("maps an empty pool to PRECONDITION_FAILED instead of a 500", async () => {
    const { db } = makeDb([]);
    await expect(call(db)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });

  it("maps another user's pack to NOT_FOUND", async () => {
    const { db } = makeDb([], {}, { userId: "someone_else" });
    await expect(call(db)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("maps an already-opened pack to CONFLICT", async () => {
    const { db } = makeDb([], {}, { isOpened: true });
    await expect(call(db)).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("maps a full inventory to PRECONDITION_FAILED", async () => {
    const { db } = makeDb([{ id: "ok", rarity: "COMMON", cardType: "NATION" }]);
    db.cardOwnership.count.mockResolvedValue(150);
    await expect(call(db)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });

  it("keeps PackError a plain Error for other callers", () => {
    expect(new PackError("NOT_FOUND", "x")).toBeInstanceOf(Error);
  });
});

describe("bestPulledRarity", () => {
  it("ranks in schema order, so Epic beats Ultra Rare", () => {
    expect(
      bestPulledRarity([{ rarity: "ULTRA_RARE" }, { rarity: "EPIC" }, { rarity: "COMMON" }])
    ).toBe("EPIC");
    expect(bestPulledRarity([])).toBe("COMMON");
  });
});
