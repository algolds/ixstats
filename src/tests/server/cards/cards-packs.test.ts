import {
  PackEditorSchema,
  previewPackPool,
  savePack,
  setPackActive,
  type PackEditorInput,
} from "~/server/modules/cards/cards.packs";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const actor = { dbId: "db_admin", clerkId: "clerk_admin" };
const odds = {
  commonOdds: 65,
  uncommonOdds: 25,
  rareOdds: 7,
  ultraRareOdds: 2,
  epicOdds: 0.9,
  legendaryOdds: 0.1,
};

const input = (overrides: Partial<PackEditorInput> = {}): PackEditorInput => ({
  id: "pack_1",
  name: "IIWiki booster",
  description: null,
  artwork: null,
  packType: "BASIC",
  priceCredits: 250,
  cardCount: 5,
  cardType: null,
  guaranteedRarity: null,
  isActive: true,
  odds,
  pool: { realmIds: ["iiwiki"], categories: ["HISTORY"], cardTypes: [] },
  limitedQuantity: null,
  purchaseLimit: 3,
  expiresAt: null,
  ...overrides,
});

const RARITIES = ["COMMON", "UNCOMMON", "RARE", "ULTRA_RARE", "EPIC", "LEGENDARY"] as const;
/** The pool's groupBy rows: four cards of each rarity named. */
const tiers = (...rarities: string[]) =>
  rarities.map((rarity) => ({ rarity, _count: { _all: 4 } }));
/** A database whose pool has cards of every rarity, so a save on sale goes through. */
const stockedDb = () => {
  const db = createMockPrisma();
  db.card.groupBy.mockResolvedValue(tiers(...RARITIES));
  return db;
};
describe("PackEditorSchema", () => {
  it("takes any card type a pack can draw, and refuses Special, Trophy or a season", () => {
    for (const cardType of [null, "LORE", "NATION", "NS"] as const) {
      expect(PackEditorSchema.safeParse(input({ cardType })).success).toBe(true);
    }
    for (const cardType of ["SPECIAL", "TROPHY"] as const) {
      expect(PackEditorSchema.safeParse(input({ cardType })).error?.issues[0]?.message).toBe(
        "A pack draws Lore, Nation or NationStates cards, or any of them"
      );
    }
    expect(PackEditorSchema.safeParse({ ...input(), season: 2 }).success).toBe(false);
    expect(PackEditorSchema.safeParse({ ...input(), cardType: undefined }).success).toBe(false);
  });

  it("caps the stock and the per-player limit, saying why", () => {
    const tooMany = PackEditorSchema.safeParse(input({ limitedQuantity: 2 ** 31 }));
    expect(tooMany.error?.issues[0]?.message).toBe(
      "Total stock is blank or a whole number from 1 to 1,000,000"
    );
    const perPlayer = PackEditorSchema.safeParse(input({ purchaseLimit: 0 }));
    expect(perPlayer.error?.issues[0]?.message).toBe(
      "The per-player limit is blank or a whole number from 1 to 1,000,000"
    );
    expect(PackEditorSchema.safeParse(input({ limitedQuantity: 1_000_000 })).success).toBe(true);
  });
});

describe("savePack", () => {
  it("updates the editor's fields, clears the guarantee, and keeps theme keys the editor does not show", async () => {
    const db = stockedDb();
    db.cardPack.findUnique.mockResolvedValue({
      id: "pack_1",
      themeFilter: { subcategories: ["Treaties"], realmIds: ["old"] },
      season: null,
    });
    db.cardPack.update.mockResolvedValue({ id: "pack_1" });
    await expect(savePack(db as never, actor, input({ cardType: "NS" }))).resolves.toEqual({
      id: "pack_1",
    });
    expect(db.cardPack.update).toHaveBeenCalledWith({
      where: { id: "pack_1" },
      data: expect.objectContaining({
        cardType: "NS",
        guaranteedRarity: null,
        commonOdds: 65,
        legendaryOdds: 0.1,
        purchaseLimit: 3,
        updatedAt: expect.any(Date),
        themeFilter: {
          subcategories: ["Treaties"],
          realmIds: ["iiwiki"],
          categories: ["HISTORY"],
          cardTypes: [],
        },
      }),
    });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "CARD_PACK_SAVE",
        userId: "clerk_admin",
        target: "pack_1",
        details: 'Edited the pack "IIWiki booster"',
      }),
    });
    expect(db.$transaction).toHaveBeenCalled();
    const { data } = db.cardPack.update.mock.calls[0]![0];
    expect(data).not.toHaveProperty("season");
  });
  it("keeps stored categories and types the editor cannot carry, so a legacy theme never widens", async () => {
    const db = stockedDb();
    db.cardPack.findUnique.mockResolvedValue({
      id: "pack_1",
      themeFilter: { categories: ["BOGUS"], cardTypes: ["MYSTERY", "SPECIAL"] },
    });
    db.cardPack.update.mockResolvedValue({ id: "pack_1" });
    await savePack(
      db as never,
      actor,
      input({ pool: { realmIds: [], categories: [], cardTypes: ["SPECIAL"] } })
    );
    expect(db.cardPack.update.mock.calls[0]![0].data.themeFilter).toEqual({
      realmIds: [],
      categories: ["BOGUS"],
      cardTypes: ["SPECIAL", "MYSTERY"],
    });
  });
  it("refuses a pack id that does not exist rather than making a new pack", async () => {
    const db = createMockPrisma();
    await expect(savePack(db as never, actor, input({ id: "pack_gone" }))).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(db.cardPack.create).not.toHaveBeenCalled();
    expect(db.cardPack.update).not.toHaveBeenCalled();
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });
});

/** A database whose transaction runs on its own client, so a pool read outside the transaction finds nothing. */
const inTransaction = () => {
  const tx = createMockPrisma();
  const db = createMockPrisma({
    $transaction: jest.fn(<T>(run: (client: typeof tx) => T) => run(tx)),
  });
  return { db, tx };
};
const NO_EPIC = tiers("COMMON", "UNCOMMON", "RARE", "ULTRA_RARE", "LEGENDARY");
const noEpicOdds = { ...odds, commonOdds: 65.9, epicOdds: 0 };
const cannotSell = (rarities: string) =>
  `This pack can't go on sale: it has no ${rarities} cards to give. Set those odds to 0, clear the guarantee or widen the pool.`;
const poolWhere = (tx: ReturnType<typeof createMockPrisma>) =>
  JSON.stringify(tx.card.groupBy.mock.calls[0]![0].where);

describe("savePack on sale", () => {
  const stored = { id: "pack_1", themeFilter: { subcategories: ["Treaties"] }, season: 3 };

  it("refuses a pack with odds on a rarity its pool has no card of, writing nothing", async () => {
    const { db, tx } = inTransaction();
    tx.cardPack.findUnique.mockResolvedValue(stored);
    tx.card.groupBy.mockResolvedValue(NO_EPIC);
    await expect(savePack(db as never, actor, input({ cardType: "NS" }))).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: cannotSell("Epic"),
    });
    expect(tx.cardPack.update).not.toHaveBeenCalled();
    expect(tx.cardPack.create).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
    // The pool is the one the save would store: its new type, its own season, and the merged theme
    expect(tx.cardPack.findUnique).toHaveBeenCalledWith({
      where: { id: "pack_1" },
      select: { id: true, themeFilter: true, season: true },
    });
    const where = poolWhere(tx);
    expect(where).toContain('{"cardType":"NS"}');
    expect(where).toContain('{"season":3}');
    expect(where).toContain('{"subcategory":{"in":["Treaties"]}}');
    expect(where).toContain('{"realmId":{"in":["iiwiki"]}}');
    expect(where).toContain('{"category":{"in":["HISTORY"]}}');
  });
  it("refuses a guarantee its pool has no card of, even at odds 0", async () => {
    const { db, tx } = inTransaction();
    tx.cardPack.findUnique.mockResolvedValue(stored);
    tx.card.groupBy.mockResolvedValue(NO_EPIC);
    await expect(
      savePack(db as never, actor, input({ odds: noEpicOdds, guaranteedRarity: "EPIC" }))
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED", message: cannotSell("Epic") });
    expect(tx.cardPack.update).not.toHaveBeenCalled();
  });

  it("refuses a new pack put on sale the same way, creating nothing", async () => {
    const { db, tx } = inTransaction();
    tx.card.groupBy.mockResolvedValue(NO_EPIC);
    await expect(savePack(db as never, actor, input({ id: undefined }))).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
    expect(tx.cardPack.create).not.toHaveBeenCalled();
    expect(poolWhere(tx)).not.toContain("season");
  });
});

describe("setPackActive on sale", () => {
  const storedPack = {
    id: "pack_1",
    name: "Founder Pack",
    isActive: false,
    cardType: "LORE",
    season: 2,
    themeFilter: { realmIds: ["iiwiki"] },
    guaranteedRarity: null,
    ...odds,
  };

  it("puts a pack whose pool has every rarity it shows on sale, and audits it", async () => {
    const { db, tx } = inTransaction();
    tx.cardPack.findUnique.mockResolvedValue(storedPack);
    tx.card.groupBy.mockResolvedValue(tiers(...RARITIES));
    await setPackActive(db as never, actor, { packId: "pack_1", isActive: true });
    expect(tx.cardPack.update).toHaveBeenCalledWith({
      where: { id: "pack_1" },
      data: { isActive: true, updatedAt: expect.any(Date) },
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ details: 'Put the pack "Founder Pack" on sale' }),
    });
  });

  it("refuses one with an empty rarity it shows, writing nothing", async () => {
    const { db, tx } = inTransaction();
    tx.cardPack.findUnique.mockResolvedValue(storedPack);
    tx.card.groupBy.mockResolvedValue(NO_EPIC);
    await expect(
      setPackActive(db as never, actor, { packId: "pack_1", isActive: true })
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED", message: cannotSell("Epic") });
    expect(tx.cardPack.update).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
    const where = poolWhere(tx);
    expect(where).toContain('{"cardType":"LORE"}');
    expect(where).toContain('{"season":2}');
    expect(where).toContain('{"realmId":{"in":["iiwiki"]}}');
  });

  it("refuses one whose stored guarantee has no card, even at odds 0", async () => {
    const { db, tx } = inTransaction();
    tx.cardPack.findUnique.mockResolvedValue({
      ...storedPack,
      ...noEpicOdds,
      guaranteedRarity: "EPIC",
    });
    tx.card.groupBy.mockResolvedValue(NO_EPIC);
    await expect(
      setPackActive(db as never, actor, { packId: "pack_1", isActive: true })
    ).rejects.toMatchObject({ message: cannotSell("Epic") });
  });
});
describe("previewPackPool", () => {
  it("counts the approved pool by rarity, flags each rarity it shows with no card, and counts bought packs waiting", async () => {
    const db = createMockPrisma();
    db.card.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: "c1", title: "Elm", rarity: "RARE", realm: { name: "IIWiki" } },
      ]);
    db.card.groupBy.mockResolvedValue([
      { rarity: "COMMON", _count: { _all: 40 } },
      { rarity: "RARE", _count: { _all: 3 } },
    ]);
    db.userPack.count.mockResolvedValue(3);
    const preview = await previewPackPool(db as never, {
      packId: "pack_1",
      cardType: null,
      season: null,
      pool: input().pool,
      odds,
      guaranteedRarity: null,
    });
    expect(preview.total).toBe(43);
    expect(preview.byRarity.find((row) => row.rarity === "UNCOMMON")).toEqual({
      rarity: "UNCOMMON",
      count: 0,
      odds: 25,
      empty: true,
    });
    expect(preview.byRarity.find((row) => row.rarity === "RARE")?.empty).toBe(false);
    expect(preview.undeliverable).toEqual(["UNCOMMON", "ULTRA_RARE", "EPIC", "LEGENDARY"]);
    expect(preview.unopened).toBe(3);
    expect(db.userPack.count).toHaveBeenCalledWith({
      where: { packId: "pack_1", isOpened: false },
    });
    expect(preview.samples).toEqual([
      { id: "c1", title: "Elm", rarity: "RARE", realmName: "IIWiki" },
    ]);
    const where = db.card.groupBy.mock.calls[0]![0].where;
    expect(JSON.stringify(where)).toContain('"reviewState":"APPROVED"');
    expect(JSON.stringify(where)).toContain('"realmId":{"in":["iiwiki"]}');
    // The sample is unordered, so Postgres stops after 12 index rows instead of sorting the whole pool
    expect(db.card.findMany.mock.calls[1]![0]).toEqual({
      where,
      take: 12,
      select: { id: true, title: true, rarity: true, realm: { select: { name: true } } },
    });
  });
});
