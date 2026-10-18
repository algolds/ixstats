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

import type { Prisma } from "@prisma/client";
import { mintCopy } from "~/lib/cards/mint";
import { PACK_ODDS_FIELDS } from "~/lib/cards/pack-odds";
import { grantCardXp } from "~/lib/cards/xp-utils";
import { notificationAPI } from "~/lib/notifications/api";
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
  reviewState?: string;
  season?: number;
  category?: string | null;
  description?: string | null;
  totalSupply?: number | null;
  metadata?: any;
  lorewardEntryId?: string | null;
  /** The card's art licence record; none when absent. */
  artLicence?: { status: string };
  /** The card's realm; a published one when absent. */
  realm?: { status: string };
}

/** Evaluates the subset of Prisma CardWhereInput the pack pool uses. */
function matches(card: FakeCard, where: any): boolean {
  if (!where) return true;
  if (where.AND) return where.AND.every((w: any) => matches(card, w));
  if (where.OR) return where.OR.some((w: any) => matches(card, w));
  return Object.entries(where).every(([key, cond]: [string, any]) => {
    if (key === "metadata") return card.metadata?.[cond.path[0]] === cond.equals;
    // A to-one `isNot` keeps a card with no related row
    if (key === "artLicence") return card.artLicence?.status !== cond.isNot.status;
    if (key === "realm") return !cond.status.notIn.includes(card.realm?.status ?? "active");
    const value = (card as any)[key] ?? null;
    if (cond && typeof cond === "object") {
      if ("not" in cond) return value !== cond.not;
      if ("in" in cond) return cond.in.includes(value);
      if ("notIn" in cond) return !cond.notIn.includes(value);
      if ("startsWith" in cond)
        return typeof value === "string" && value.startsWith(cond.startsWith);
    }
    if (key === "isRetired") return (value ?? false) === cond;
    if (key === "reviewState") return (value ?? "APPROVED") === cond; // the column's default
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
    // findMany: the router reads the minted copies' faces back.
    cardOwnership: {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
    },
  };
  const card = {
    findMany: jest.fn(async ({ where }: { where: Prisma.CardWhereInput }) =>
      cards.filter((c) => matches(c, where))
    ),
    groupBy: jest.fn(async ({ where }: { where: Prisma.CardWhereInput }) => {
      const tiers = new Map<string, number>();
      for (const row of cards.filter((c) => matches(c, where))) {
        tiers.set(row.rarity, (tiers.get(row.rarity) ?? 0) + 1);
      }
      return [...tiers].map(([rarity, all]) => ({ rarity, _count: { _all: all } }));
    }),
    findFirst: jest.fn(
      async ({ where, skip }: { where: Prisma.CardWhereInput; skip?: number }) =>
        cards.filter((c) => matches(c, where))[skip ?? 0] ?? null
    ),
  };
  // The capacity lock and the card pool exist only on the transaction client, so a lock taken or a pool read on db
  // (an autocommit statement) fails
  const tx = { ...db, card, $executeRaw: jest.fn().mockResolvedValue(1) };
  db.$transaction = jest.fn((cb: (tx: any) => Promise<unknown>) => cb(tx));
  return { db, tx };
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

  it.each(PACK_ODDS_FIELDS)("rolls every slot %s when %s is the only odds", (rarity, field) => {
    expect(generatePackCards({ ...allCommon, commonOdds: 0, [field]: 100 })).toEqual(
      Array(5).fill(rarity)
    );
  });

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

  it("honours a guaranteed rarity in any casing", () => {
    const rarities = generatePackCards({ ...allCommon, guaranteedRarity: "epic" });
    expect(rarities.filter((r) => r === "EPIC")).toHaveLength(1);
    expect(rarities.filter((r) => r === "COMMON")).toHaveLength(4);
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

  it("never pulls a card waiting in review, or one rejected", async () => {
    const { db } = makeDb([
      { id: "pending", rarity: "COMMON", cardType: "LORE", reviewState: "PENDING" },
      { id: "rejected", rarity: "COMMON", cardType: "LORE", reviewState: "REJECTED" },
      { id: "ok", rarity: "COMMON", cardType: "LORE", reviewState: "APPROVED" },
    ]);
    const pulled = await openPack(db, USER, USER_PACK_ID);
    expect(pulled.map((p) => p.card.id)).toEqual(Array(5).fill("ok"));
  });

  it("never pulls restricted-licence art, but pulls art with no licence record", async () => {
    const { db, tx } = makeDb([
      {
        id: "restricted",
        rarity: "COMMON",
        cardType: "LORE",
        artLicence: { status: "RESTRICTED" },
      },
      { id: "unrecorded", rarity: "COMMON", cardType: "LORE" },
    ]);
    const pulled = await openPack(db, USER, USER_PACK_ID);
    expect(pulled.map((p) => p.card.id)).toEqual(Array(5).fill("unrecorded"));
    expect(tx.card.groupBy.mock.calls[0][0].where.AND).toContainEqual({
      artLicence: { isNot: { status: "RESTRICTED" } },
    });
  });

  it("pulls art whose licence is open", async () => {
    const { db } = makeDb([
      { id: "open", rarity: "COMMON", cardType: "LORE", artLicence: { status: "OPEN" } },
    ]);
    const pulled = await openPack(db, USER, USER_PACK_ID);
    expect(pulled.map((p) => p.card.id)).toEqual(Array(5).fill("open"));
  });

  it("never pulls a Loreward trophy card", async () => {
    const { db } = makeDb([
      { id: "trophy", rarity: "COMMON", cardType: "TROPHY", lorewardEntryId: "e1" },
      { id: "ok", rarity: "COMMON", cardType: "LORE" },
    ]);
    const pulled = await openPack(db, USER, USER_PACK_ID);
    expect(pulled.map((p) => p.card.id)).toEqual(Array(5).fill("ok"));
  });

  it("refuses to open, minting nothing, when a rarity it gives has no cards", async () => {
    const { db, tx } = makeDb(
      [
        { id: "common", rarity: "COMMON", cardType: "NATION" },
        { id: "uncommon", rarity: "UNCOMMON", cardType: "NATION" },
      ],
      { commonOdds: 90, epicOdds: 5, legendaryOdds: 5 }
    );
    await expect(openPack(db, USER, USER_PACK_ID)).rejects.toMatchObject({
      name: "PackError",
      code: "PRECONDITION_FAILED",
      message:
        "This pack can't be opened right now: it has no Epic and Legendary cards to give. It stays unopened; try again later.",
    });
    // The refusal rejects the transaction, so the pack's claim rolls back and the player keeps it unopened
    await expect(db.$transaction.mock.results[0].value).rejects.toBeInstanceOf(PackError);
    expect(jest.mocked(mintCopy)).not.toHaveBeenCalled();
    expect(tx.card.findFirst).not.toHaveBeenCalled();
  });

  it("refuses to open when its guaranteed rarity has no cards, before drawing", async () => {
    const { db, tx } = makeDb([{ id: "common", rarity: "COMMON", cardType: "NATION" }], {
      guaranteedRarity: "rare",
    });
    await expect(openPack(db, USER, USER_PACK_ID)).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: expect.stringContaining("it has no Rare cards to give"),
    });
    expect(tx.card.findFirst).not.toHaveBeenCalled();
    expect(jest.mocked(mintCopy)).not.toHaveBeenCalled();
  });

  it("refuses, minting nothing, when a drawn rarity's cards go between the count and the draw", async () => {
    // Uncommon still has a card, but a pack never draws another rarity in place of the rolled one
    const { db, tx } = makeDb([
      { id: "common", rarity: "COMMON", cardType: "NATION" },
      { id: "uncommon", rarity: "UNCOMMON", cardType: "NATION" },
    ]);
    // The first draw finds its card; the second finds its tier emptied since the count
    tx.card.findFirst.mockResolvedValueOnce({ id: "common" }).mockResolvedValueOnce(null);
    await expect(openPack(db, USER, USER_PACK_ID)).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message:
        "This pack can't be opened right now: it has no Common cards to give. It stays unopened; try again later.",
    });
    expect(tx.card.findFirst).toHaveBeenCalledTimes(2);
    expect(jest.mocked(mintCopy)).not.toHaveBeenCalled();
  });

  it("never pulls a card homed in a draft or generating realm", async () => {
    const { db } = makeDb([
      { id: "draft", rarity: "COMMON", cardType: "LORE", realm: { status: "draft" } },
      { id: "generating", rarity: "COMMON", cardType: "LORE", realm: { status: "generating" } },
      { id: "ok", rarity: "COMMON", cardType: "LORE", realm: { status: "active" } },
    ]);
    const pulled = await openPack(db, USER, USER_PACK_ID);
    expect(pulled.map((p) => p.card.id)).toEqual(Array(5).fill("ok"));
  });

  it("refuses to open when a rarity's only cards are in an unpublished realm", async () => {
    const { db } = makeDb(
      [
        { id: "common", rarity: "COMMON", cardType: "LORE" },
        { id: "draft-legend", rarity: "LEGENDARY", cardType: "LORE", realm: { status: "draft" } },
      ],
      { commonOdds: 90, legendaryOdds: 10 }
    );
    await expect(openPack(db, USER, USER_PACK_ID)).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: expect.stringContaining("it has no Legendary cards to give"),
    });
    expect(jest.mocked(mintCopy)).not.toHaveBeenCalled();
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

  it("mints every pulled card through mintCopy, its finish rolled, from the pack's transaction", async () => {
    const { db, tx } = makeDb([{ id: "ok", rarity: "COMMON", cardType: "LORE" }]);
    jest.mocked(grantCardXp).mockClear();
    const result = await openPack(db, USER, USER_PACK_ID);
    expect(result.map((r) => r.ownershipId)).toEqual([
      "copy_1",
      "copy_2",
      "copy_3",
      "copy_4",
      "copy_5",
    ]);
    expect(jest.mocked(mintCopy)).toHaveBeenCalledWith(tx, {
      cardId: "ok",
      ownerId: USER,
      source: "PACK_OPEN",
    });
    expect(jest.mocked(grantCardXp)).toHaveBeenCalledTimes(5);
    expect(jest.mocked(grantCardXp)).toHaveBeenCalledWith(
      tx,
      "copy_1",
      "PACK_OPEN",
      JSON.stringify({ packId: "p1", packName: "Test Pack" })
    );
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

  it("refuses a pack that would overflow the collection, inside its transaction, before minting", async () => {
    const { db, tx } = makeDb([{ id: "ok", rarity: "COMMON", cardType: "LORE" }], { cardCount: 3 });
    db.cardOwnership.count.mockResolvedValue(149); // a capacity of 150, so room for 1

    await expect(openPack(db, USER, USER_PACK_ID)).rejects.toMatchObject({
      name: "PackError",
      code: "PRECONDITION_FAILED",
      message:
        "Your inventory is full. Purchase a Card Capacity Upgrade in the Store to hold more.",
    });

    // The refusal rejects the transaction, so the pack's claim rolls back with it and nothing is minted
    await expect(db.$transaction.mock.results[0].value).rejects.toBeInstanceOf(PackError);
    expect(jest.mocked(mintCopy)).not.toHaveBeenCalled();
    expect(tx.card.groupBy).not.toHaveBeenCalled();
    // The owner's capacity lock comes before the count it guards
    const [, namespace, owner] = tx.$executeRaw.mock.calls[0];
    expect([namespace, owner]).toEqual([7334, USER]);
    expect(tx.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
      db.cardOwnership.count.mock.invocationCallOrder[0]
    );
  });

  it("passes any other failure of the capacity check through, minting nothing", async () => {
    const { db, tx } = makeDb([{ id: "ok", rarity: "COMMON", cardType: "LORE" }], { cardCount: 3 });
    tx.$executeRaw.mockRejectedValueOnce(new Error("connection reset"));
    await expect(openPack(db, USER, USER_PACK_ID)).rejects.toThrow("connection reset");
    expect(jest.mocked(mintCopy)).not.toHaveBeenCalled();
  });

  it("opens a pack that exactly fills the collection", async () => {
    const { db } = makeDb([{ id: "ok", rarity: "COMMON", cardType: "LORE" }], { cardCount: 3 });
    db.cardOwnership.count.mockResolvedValue(147);
    await expect(openPack(db, USER, USER_PACK_ID)).resolves.toHaveLength(3);
  });

  it("throws a typed error when the pool is empty", async () => {
    const { db } = makeDb([{ id: "special", rarity: "COMMON", cardType: "SPECIAL" }]);
    await expect(openPack(db, USER, USER_PACK_ID)).rejects.toMatchObject({
      name: "PackError",
      code: "PRECONDITION_FAILED",
      message: expect.stringContaining("it has no Common cards to give"),
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

describe("cardPacks.openPack notification", () => {
  const open = (cards: FakeCard[], odds: Record<string, number>) =>
    createCallerFactory(cardPacksUserRouter)(
      createMockRouterContext({ db: makeDb(cards, { commonOdds: 0, ...odds }).db }) as never
    ).openPack({ userPackId: USER_PACK_ID });

  it("is high priority from an Epic best pull up, as Epic ranks above Ultra Rare", async () => {
    const create = jest.mocked(notificationAPI.create);
    create.mockClear();
    await open([{ id: "e", rarity: "EPIC", cardType: "LORE" }], { epicOdds: 100 });
    await open([{ id: "l", rarity: "LEGENDARY", cardType: "LORE" }], { legendaryOdds: 100 });
    await open([{ id: "u", rarity: "ULTRA_RARE", cardType: "LORE" }], { ultraRareOdds: 100 });
    expect(create.mock.calls.map(([note]) => [note.metadata?.bestRarity, note.priority])).toEqual([
      ["EPIC", "high"],
      ["LEGENDARY", "high"],
      ["ULTRA_RARE", "medium"],
    ]);
  });
});

describe("bestPulledRarity", () => {
  it("ranks in schema order, so Epic beats Ultra Rare", () => {
    expect(
      bestPulledRarity([{ rarity: "ULTRA_RARE" }, { rarity: "EPIC" }, { rarity: "COMMON" }])
    ).toBe("EPIC");
    expect(bestPulledRarity([])).toBe("COMMON");
  });

  it("never lets an unknown rarity beat Common", () => {
    expect(bestPulledRarity([{ rarity: "MYTHIC" }])).toBe("COMMON");
    expect(bestPulledRarity([{ rarity: "MYTHIC" }, { rarity: "RARE" }])).toBe("RARE");
  });

  it("reads a rarity in any casing as its enum", () => {
    expect(bestPulledRarity([{ rarity: "RARE" }, { rarity: "epic" }])).toBe("EPIC");
  });
});
