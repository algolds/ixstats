/** @jest-environment node */
/** The pack editor: what it saves, the guarantee cleared, the pool previewed. */
import { packThemePool, themeFilterWhere } from "~/lib/cards/pack-service";
import {
  PackEditorSchema,
  listPacks,
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
  guaranteedRarity: null,
  isActive: true,
  odds,
  pool: { realmIds: ["iiwiki"], categories: ["HISTORY"], cardTypes: [] },
  limitedQuantity: null,
  purchaseLimit: 3,
  expiresAt: null,
  ...overrides,
});

describe("themeFilterWhere", () => {
  it("narrows a pool to its realms", () => {
    expect(themeFilterWhere({ realmIds: ["iiwiki", "althistory"] })).toEqual([
      { realmId: { in: ["iiwiki", "althistory"] } },
    ]);
    expect(themeFilterWhere({ realmIds: [] })).toEqual([]);
  });
});

describe("packThemePool", () => {
  it("reads the editor's pool keys, keeping only known categories and types", () => {
    expect(
      packThemePool({
        realmIds: ["iiwiki", 4, ""],
        categories: ["HISTORY", "BOGUS"],
        cardTypes: ["NS", "SPECIAL", "MYSTERY"],
        subcategories: ["Treaties"],
      })
    ).toEqual({ realmIds: ["iiwiki"], categories: ["HISTORY"], cardTypes: ["NS", "SPECIAL"] });
  });

  it("is empty for a pack without a theme", () => {
    const empty = { realmIds: [], categories: [], cardTypes: [] };
    expect(packThemePool(null)).toEqual(empty);
    expect(packThemePool(["HISTORY"])).toEqual(empty);
  });
});

describe("listPacks", () => {
  it("lists every pack with its sales count and its pool", async () => {
    const db = createMockPrisma();
    db.cardPack.findMany.mockResolvedValue([
      { id: "pack_1", themeFilter: { realmIds: ["iiwiki"] }, _count: { UserPack: 12 } },
    ]);
    const packs = await listPacks(db as never);
    expect(packs).toEqual([
      expect.objectContaining({
        id: "pack_1",
        pool: { realmIds: ["iiwiki"], categories: [], cardTypes: [] },
      }),
    ]);
    expect(db.cardPack.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ include: { _count: { select: { UserPack: true } } } })
    );
  });
});

describe("PackEditorSchema", () => {
  it("refuses a season or card type, which the editor does not set", () => {
    expect(PackEditorSchema.safeParse(input()).success).toBe(true);
    expect(PackEditorSchema.safeParse({ ...input(), season: 2 }).success).toBe(false);
    expect(PackEditorSchema.safeParse({ ...input(), cardType: "NS" }).success).toBe(false);
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
    const db = createMockPrisma();
    db.cardPack.findUnique.mockResolvedValue({
      id: "pack_1",
      themeFilter: { subcategories: ["Treaties"], realmIds: ["old"] },
    });
    db.cardPack.update.mockResolvedValue({ id: "pack_1" });
    await expect(savePack(db as never, actor, input())).resolves.toEqual({ id: "pack_1" });
    expect(db.cardPack.update).toHaveBeenCalledWith({
      where: { id: "pack_1" },
      data: expect.objectContaining({
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
    expect(data).not.toHaveProperty("cardType");
  });

  it("keeps stored categories and types the editor cannot carry, so a legacy theme never widens", async () => {
    const db = createMockPrisma();
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

  it("creates a pack when there is no id", async () => {
    const db = createMockPrisma();
    db.cardPack.create.mockResolvedValue({ id: "pack_new" });
    await expect(savePack(db as never, actor, input({ id: undefined }))).resolves.toEqual({
      id: "pack_new",
    });
    expect(db.cardPack.findUnique).not.toHaveBeenCalled();
    expect(db.cardPack.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: "IIWiki booster",
        themeFilter: { realmIds: ["iiwiki"], categories: ["HISTORY"], cardTypes: [] },
      }),
    });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        target: "pack_new",
        details: 'Created the pack "IIWiki booster"',
      }),
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

describe("setPackActive", () => {
  it("takes a pack off sale and audits it", async () => {
    const db = createMockPrisma();
    db.cardPack.findUnique.mockResolvedValue({
      id: "pack_1",
      name: "Founder Pack",
      isActive: true,
    });
    await setPackActive(db as never, actor, { packId: "pack_1", isActive: false });
    expect(db.cardPack.update).toHaveBeenCalledWith({
      where: { id: "pack_1" },
      data: { isActive: false, updatedAt: expect.any(Date) },
    });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "CARD_PACK_SAVE",
        target: "pack_1",
        details: 'Took the pack "Founder Pack" off sale',
      }),
    });
  });

  it("writes and audits nothing when the pack is already in that state", async () => {
    const db = createMockPrisma();
    db.cardPack.findUnique.mockResolvedValue({
      id: "pack_1",
      name: "Founder Pack",
      isActive: true,
    });
    await setPackActive(db as never, actor, { packId: "pack_1", isActive: true });
    expect(db.cardPack.update).not.toHaveBeenCalled();
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });

  it("refuses a pack that does not exist", async () => {
    const db = createMockPrisma();
    await expect(
      setPackActive(db as never, actor, { packId: "pack_gone", isActive: true })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });
});

describe("previewPackPool", () => {
  it("counts the approved pool by rarity and warns where a rarity with odds has no card", async () => {
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
    const preview = await previewPackPool(db as never, {
      cardType: null,
      season: null,
      pool: input().pool,
      odds,
    });
    expect(preview.total).toBe(43);
    expect(preview.byRarity.find((row) => row.rarity === "UNCOMMON")).toEqual({
      rarity: "UNCOMMON",
      count: 0,
      odds: 25,
      fallsBack: true,
    });
    expect(preview.byRarity.find((row) => row.rarity === "RARE")?.fallsBack).toBe(false);
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

  it("does not warn for a rarity the pack never rolls, and keeps the pack's own type and season", async () => {
    const db = createMockPrisma();
    db.card.groupBy.mockResolvedValue([{ rarity: "COMMON", _count: { _all: 5 } }]);
    const preview = await previewPackPool(db as never, {
      cardType: "NS",
      season: 2,
      pool: { realmIds: [], categories: [], cardTypes: [] },
      odds: { ...odds, commonOdds: 65.1, legendaryOdds: 0 },
    });
    expect(preview.byRarity.find((row) => row.rarity === "LEGENDARY")).toEqual({
      rarity: "LEGENDARY",
      count: 0,
      odds: 0,
      fallsBack: false,
    });
    const where = JSON.stringify(db.card.groupBy.mock.calls[0]![0].where);
    expect(where).toContain('{"cardType":"NS"}');
    expect(where).toContain('{"season":2}');
    expect(where).not.toContain("realmId");
  });
});
