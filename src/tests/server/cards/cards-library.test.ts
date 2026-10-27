/** @jest-environment node */
/** The Library: realm-scoped filters, an audited edit with a rarity override, and bulk hide. */
import { MAX_FILTER_REVIEW } from "~/lib/cards/curation-limits";
import { CARD_VALUATION_DEFAULTS, referenceValue } from "~/lib/cards/valuation";
import {
  LibraryEditSchema,
  LibraryFilterSchema,
  bulkSetRetired,
  updateLibraryCard,
  type BulkSetRetiredInput,
  type LibraryEdit,
} from "~/server/modules/cards/cards.library";
import { setCardCategoryTx } from "~/server/modules/cards/cards.categories";
import { createMockPrisma } from "~/tests/helpers/mock-db";

jest.mock("~/server/modules/cards/cards.categories", () => ({
  setCardCategoryTx: jest.fn(async () => ({ changed: true })),
}));

beforeEach(() => jest.clearAllMocks());

const actor = { dbId: "db_admin", clerkId: "clerk_admin" };
const AS_OF = new Date("2026-10-01T12:00:00Z");
const ELM = "https://iiwiki.com/images/a/ab/Elm.png";
const filter = (input: Record<string, string>) => LibraryFilterSchema.parse(input);
const COMPLIANCE_FREE = [
  { takedowns: { none: { status: "HIDDEN" } } },
  { artLicence: { isNot: { status: "RESTRICTED" } } },
];

/** A database whose `$transaction` hands its callback a separate client, so a test sees which writes it holds. */
function withTx() {
  const db = createMockPrisma();
  const tx = createMockPrisma({ $executeRaw: jest.fn() });
  db.$transaction.mockImplementation((run: (client: typeof tx) => Promise<unknown>) => run(tx));
  return { db, tx };
}

describe("updateLibraryCard", () => {
  interface Stored {
    id: string;
    title: string;
    description: string | null;
    artwork: string | null;
    rarity: LibraryEdit["rarity"];
    cardType: string;
    wikiSource: string | null;
    isRetired: boolean;
    firstSoldAt: Date | null;
    metadata: object | null;
    artLicence: { status: string } | null;
    category: "HISTORY" | "MILITARY" | null;
    subcategory: string | null;
    _count: { takedowns: number };
  }
  const stored = (over: Partial<Stored> = {}): Stored => ({
    id: "card_1",
    title: "Elm",
    description: null,
    artwork: ELM,
    rarity: "COMMON",
    cardType: "LORE",
    wikiSource: "iiwiki",
    isRetired: false,
    firstSoldAt: null,
    metadata: null,
    artLicence: null,
    category: "HISTORY",
    subcategory: null,
    _count: { takedowns: 0 },
    ...over,
  });
  /** A save of the card as the admin opened it, changing nothing. */
  const unchanged = (card: Stored): LibraryEdit => ({
    cardId: card.id,
    title: card.title,
    description: card.description ?? "",
    artwork: card.artwork,
    rarity: card.rarity,
    retired: card.isRetired,
    expected: { artwork: card.artwork, isRetired: card.isRetired, rarity: card.rarity },
  });
  /** The card as stored, read in the edit's transaction, the conditional write it makes, and a no-op edit of it. */
  function setUp(card: Stored | null = stored()) {
    const { db, tx } = withTx();
    db.systemConfig.findMany.mockResolvedValue([]);
    tx.card.findUnique.mockResolvedValue(card);
    tx.card.updateMany.mockResolvedValue({ count: 1 });
    return { db, tx, edit: unchanged(card ?? stored()) };
  }
  const actions = (tx: ReturnType<typeof createMockPrisma>) =>
    tx.auditLog.create.mock.calls.map(([args]: [{ data: { action: string } }]) => args.data.action);

  it("reads and writes under the card's takedown lock, which every hide takes", async () => {
    const { db, tx, edit } = setUp();
    await updateLibraryCard(db as never, actor, { ...edit, title: "Elm II" });
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(tx.$executeRaw.mock.calls[0]).toEqual([expect.anything(), 7335, "card_1"]);
    expect(tx.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.card.findUnique.mock.invocationCallOrder[0]!
    );
  });

  it("refuses an edit over a card that changed since the admin opened it", async () => {
    const { db, tx, edit } = setUp();
    for (const expected of [
      { ...edit.expected, isRetired: true },
      { ...edit.expected, artwork: null },
      { ...edit.expected, rarity: "RARE" as const },
    ]) {
      await expect(
        updateLibraryCard(db as never, actor, { ...edit, title: "Elm II", expected })
      ).rejects.toMatchObject({
        code: "CONFLICT",
        message: "This card changed since you opened it. Reopen it and try again.",
      });
    }
    expect(tx.card.updateMany).not.toHaveBeenCalled();
  });

  it("needs a reason to override rarity, and re-prices and audits the override in one transaction", async () => {
    const { db, tx, edit } = setUp();
    await expect(
      updateLibraryCard(db as never, actor, { ...edit, rarity: "EPIC" })
    ).rejects.toThrow(/Say why/);
    await expect(
      updateLibraryCard(db as never, actor, { ...edit, rarity: "EPIC", reason: "  a  " })
    ).rejects.toThrow(/Say why/);
    expect(tx.card.updateMany).not.toHaveBeenCalled();

    await updateLibraryCard(db as never, actor, {
      ...edit,
      rarity: "EPIC",
      reason: "Featured article",
    });
    const write = tx.card.updateMany.mock.calls[0]![0];
    expect(write.data).toEqual({
      rarity: "EPIC",
      marketValue: referenceValue(
        {
          rarity: "EPIC",
          cardType: "LORE",
          firstSoldAt: null,
          nsBankValue: null,
          isRetired: false,
        },
        null,
        CARD_VALUATION_DEFAULTS
      ),
    });
    expect(actions(tx)).toEqual(["CARD_RARITY_OVERRIDE"]);
    expect(tx.auditLog.create.mock.calls[0]![0].data).toMatchObject({
      userId: "clerk_admin",
      target: "card_1",
      details: "Rarity COMMON → EPIC: Featured article",
    });
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });
  it("leaves art and visibility that a takedown hides to Compliance, and lets the words change", async () => {
    const { db, tx, edit } = setUp(
      stored({ artwork: null, isRetired: true, _count: { takedowns: 1 } })
    );
    await expect(
      updateLibraryCard(db as never, actor, { ...edit, artwork: "https://example.com/new.png" })
    ).rejects.toThrow(/from Compliance/);
    await expect(
      updateLibraryCard(db as never, actor, { ...edit, retired: false })
    ).rejects.toThrow(/from Compliance/);
    expect(tx.card.updateMany).not.toHaveBeenCalled();
    await updateLibraryCard(db as never, actor, { ...edit, title: "Elm Republic" });
    // Prisma reads `artwork: null` as IS NULL
    expect(tx.card.updateMany.mock.calls[0]![0]).toEqual({
      where: { id: "card_1", artwork: null, isRetired: true, rarity: "COMMON" },
      data: { title: "Elm Republic" },
    });
  });

  it("leaves a card whose art licence is restricted to Compliance", async () => {
    const { db, tx, edit } = setUp(
      stored({ isRetired: true, artLicence: { status: "RESTRICTED" } })
    );
    await expect(
      updateLibraryCard(db as never, actor, { ...edit, retired: false })
    ).rejects.toThrow(/from Compliance/);
    expect(tx.card.updateMany).not.toHaveBeenCalled();
  });

  it("changes only the category through the one category write, inside the edit's transaction", async () => {
    const { db, tx, edit } = setUp();
    await updateLibraryCard(db as never, actor, {
      ...edit,
      category: { category: "MILITARY", subcategory: "unit" },
    });
    expect(jest.mocked(setCardCategoryTx)).toHaveBeenCalledWith(tx, {
      cardId: "card_1",
      choice: { category: "MILITARY", subcategory: "unit" },
      source: "ADMIN",
      editor: actor,
    });
    expect(tx.card.updateMany).not.toHaveBeenCalled();
    expect(actions(tx)).toEqual([]);
  });

  it("writes the words and the category together when both change", async () => {
    const { db, tx, edit } = setUp();
    await updateLibraryCard(db as never, actor, {
      ...edit,
      title: "Elm II",
      category: { category: "HISTORY", subcategory: "event" },
    });
    expect(tx.card.updateMany.mock.calls[0]![0].data).toEqual({ title: "Elm II" });
    expect(actions(tx)).toEqual(["CARD_UPDATE"]);
    expect(jest.mocked(setCardCategoryTx)).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ choice: { category: "HISTORY", subcategory: "event" } })
    );
  });

  it("leaves the category alone when the sheet sends it unchanged, or not at all", async () => {
    const { db, edit } = setUp();
    await updateLibraryCard(db as never, actor, {
      ...edit,
      category: { category: "HISTORY", subcategory: null },
    });
    await updateLibraryCard(db as never, actor, edit);
    expect(jest.mocked(setCardCategoryTx)).not.toHaveBeenCalled();
  });

  it("refuses a subcategory that is not in its category before reading anything", () => {
    expect(
      LibraryEditSchema.safeParse({
        cardId: "card_1",
        title: "Elm",
        description: "",
        artwork: null,
        rarity: "COMMON",
        retired: false,
        category: { category: "HISTORY", subcategory: "army" },
        expected: { artwork: null, isRetired: false, rarity: "COMMON" },
      }).success
    ).toBe(false);
  });
});

describe("bulkSetRetired", () => {
  const input = (over: Partial<BulkSetRetiredInput> = {}): BulkSetRetiredInput => ({
    filter: filter({ realmId: "eurth" }),
    retired: true,
    asOf: AS_OF,
    expected: 12,
    reason: "Realm closed",
    ...over,
  });
  const shown = [{ realmId: "eurth" }, {}, {}, {}, {}, {}, { createdAt: { lte: AS_OF } }];

  it("refuses an empty filter, so one click never hides every card", async () => {
    const { db, tx } = withTx();
    await expect(bulkSetRetired(db as never, actor, input({ filter: filter({}) }))).rejects.toThrow(
      /Narrow the filter/
    );
    expect(tx.card.updateMany).not.toHaveBeenCalled();
  });
  it("changes at most MAX_FILTER_REVIEW cards, as of a read that has happened", async () => {
    const { db, tx } = withTx();
    await expect(
      bulkSetRetired(db as never, actor, input({ expected: MAX_FILTER_REVIEW + 1 }))
    ).rejects.toThrow(/at most 2,000 cards/);
    await expect(
      bulkSetRetired(db as never, actor, input({ asOf: new Date(Date.now() + 60_000) }))
    ).rejects.toThrow(/in the future/);
    expect(tx.card.updateMany).not.toHaveBeenCalled();

    tx.card.count.mockResolvedValue(MAX_FILTER_REVIEW);
    tx.card.updateMany.mockResolvedValue({ count: MAX_FILTER_REVIEW });
    await expect(
      bulkSetRetired(db as never, actor, input({ expected: MAX_FILTER_REVIEW }))
    ).resolves.toEqual({ count: MAX_FILTER_REVIEW });
  });

  it("refuses when the cards it would change changed since the Library was read", async () => {
    const { db, tx } = withTx();
    tx.card.count.mockResolvedValue(13);
    await expect(bulkSetRetired(db as never, actor, input())).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(tx.card.updateMany).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it("hides the visible cards it counted, leaving Compliance's cards and achievement rewards out", async () => {
    const { db, tx } = withTx();
    tx.card.count.mockResolvedValue(12);
    tx.card.updateMany.mockResolvedValue({ count: 12 });
    await expect(bulkSetRetired(db as never, actor, input())).resolves.toEqual({ count: 12 });
    const where = {
      AND: [...shown, { isRetired: false }, ...COMPLIANCE_FREE, { rewardAchievementKey: null }],
    };
    expect(tx.card.count.mock.calls[0]![0].where).toEqual(where);
    expect(tx.card.updateMany.mock.calls[0]![0]).toEqual({
      where,
      data: { isRetired: true, retiredAt: expect.any(Date) },
    });
    expect(tx.auditLog.create.mock.calls[0]![0].data).toMatchObject({
      action: "CARD_HIDE",
      userId: "clerk_admin",
      target: null,
      details: "Hid 12 cards matching realm eurth: Realm closed",
    });
  });
});
