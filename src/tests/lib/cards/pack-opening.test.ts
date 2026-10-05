/**
 * Code audit VT-18: pack opening ignored `guaranteedRarity` and `themeFilter`, could pull
 * SPECIAL and crafted cards, threw (a 500) when a rarity tier was empty, and built ownership
 * ids from Date.now() + user + card, which collide when a pack pulls the same card twice.
 */

jest.mock("~/server/modules/forum", () => ({
  syncUserToForum: jest.fn().mockResolvedValue(true),
}));
jest.mock("~/lib/notifications/api", () => ({
  notificationAPI: { create: jest.fn().mockResolvedValue(undefined) },
}));
jest.mock("~/lib/achievements/queue", () => ({ queueAchievementCheck: jest.fn() }));
jest.mock("~/lib/cards/xp-utils", () => ({ grantCardXp: jest.fn() }));

import { generatePackCards, openPack, PackError, themeFilterWhere } from "~/lib/cards/pack-service";
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
  const created: any[] = [];
  const db: any = {
    systemConfig: { findMany: jest.fn().mockResolvedValue([]) },
    userPack: {
      findUnique: jest.fn().mockResolvedValue({
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
      }),
      update: jest.fn().mockResolvedValue({}),
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
    cardOwnership: {
      count: jest.fn().mockResolvedValue(0),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn(async ({ data }: any) => {
        created.push(data);
        return data;
      }),
    },
    cardTransferEvent: { create: jest.fn().mockResolvedValue({}) },
  };
  db.$transaction = jest.fn((cb: (tx: any) => Promise<unknown>) => cb(db));
  return { db, created };
}

beforeEach(() => {
  invalidateVaultConfigCache();
  clearUserPerksCache();
  for (const level of ["error", "warn", "info", "log"] as const) {
    jest.spyOn(console, level).mockImplementation(() => {});
  }
});
afterEach(() => jest.restoreAllMocks());

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

  it("gives every ownership a distinct id even for repeat pulls in one pack", async () => {
    const { db, created } = makeDb([{ id: "only", rarity: "COMMON", cardType: "NATION" }]);
    await openPack(db, USER, USER_PACK_ID);
    const ids = created.map((c) => c.id);
    expect(new Set(ids).size).toBe(5);
    expect(ids.every((id) => !id.includes(USER))).toBe(true);
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

  it("maps an already-opened pack to BAD_REQUEST", async () => {
    const { db } = makeDb([], {}, { isOpened: true });
    await expect(call(db)).rejects.toMatchObject({ code: "BAD_REQUEST" });
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
