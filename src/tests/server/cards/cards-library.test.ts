/** @jest-environment node */
/** The Library: realm-scoped filters, an audited edit with a rarity override, and bulk hide. */
import { MAX_FILTER_REVIEW } from "~/lib/cards/curation-limits";
import { CARD_VALUATION_DEFAULTS, computeCardValue } from "~/lib/cards/valuation";
import {
  LibraryFilterSchema,
  bulkSetRetired,
  libraryWhere,
  listLibrary,
  updateLibraryCard,
  type BulkSetRetiredInput,
  type LibraryEdit,
} from "~/server/modules/cards/cards.library";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const actor = { dbId: "db_admin", clerkId: "clerk_admin" };
const AS_OF = new Date("2026-10-01T12:00:00Z");
const ELM = "https://iiwiki.com/images/a/ab/Elm.png";
const ELM_FLAG = "https://iiwiki.com/images/b/bc/Elm_flag.png";
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

describe("libraryWhere", () => {
  it("scopes by realm, type, rarity and title, and counts legacy unsourced Lore cards as IxWiki", () => {
    expect(
      libraryWhere(
        filter({
          realmId: "eurth",
          cardType: "LORE",
          rarity: "RARE",
          search: " Elm ",
          source: "ixwiki",
        })
      )
    ).toEqual({
      AND: [
        { realmId: "eurth" },
        { cardType: "LORE" },
        { rarity: "RARE" },
        { title: { contains: "Elm", mode: "insensitive" } },
        { OR: [{ wikiSource: "ixwiki" }, { wikiSource: null, cardType: "LORE" }] },
        {},
      ],
    });
  });

  it("reads every other source as stored, and an empty filter as every card", () => {
    expect(libraryWhere(filter({ source: "commons" })).AND).toContainEqual({
      wikiSource: "commons",
    });
    expect(libraryWhere(filter({}))).toEqual({ AND: [{}, {}, {}, {}, {}, {}] });
  });

  it("finds retired cards, art hidden by a takedown and bound cards", () => {
    expect(libraryWhere(filter({ show: "retired" })).AND).toContainEqual({ isRetired: true });
    expect(libraryWhere(filter({ show: "art_hidden" })).AND).toContainEqual({
      takedowns: { some: { status: "HIDDEN" } },
    });
    expect(libraryWhere(filter({ show: "bound" })).AND).toContainEqual({ isBound: true });
  });
});

describe("listLibrary", () => {
  it("reads the page, the total and what each bulk change would change, as of one moment", async () => {
    const db = createMockPrisma();
    db.card.findMany.mockResolvedValue([{ id: "card_1" }]);
    db.card.count.mockResolvedValueOnce(51).mockResolvedValueOnce(40).mockResolvedValueOnce(3);
    const page = await listLibrary(db as never, {
      filter: filter({ realmId: "eurth" }),
      offset: 50,
      limit: 50,
    });
    expect(page).toEqual({
      rows: [{ id: "card_1" }],
      total: 51,
      hideable: 40,
      unhideable: 3,
      asOf: expect.any(Date),
    });
    const query = db.card.findMany.mock.calls[0]![0];
    const shown = [{ realmId: "eurth" }, {}, {}, {}, {}, {}, { createdAt: { lte: page.asOf } }];
    expect(query.where).toEqual({ AND: shown });
    expect(query).toMatchObject({
      skip: 50,
      take: 50,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      select: { rewardAchievementKey: true },
    });
    const counted = db.card.count.mock.calls.map(([args]: [{ where: object }]) => args.where);
    expect(counted).toEqual([
      query.where,
      {
        AND: [...shown, { isRetired: false }, ...COMPLIANCE_FREE, { rewardAchievementKey: null }],
      },
      { AND: [...shown, { isRetired: true }, ...COMPLIANCE_FREE] },
    ]);
  });
});

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
    metadata: object | null;
    artLicence: { status: string } | null;
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
    metadata: null,
    artLicence: null,
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
      marketValue: computeCardValue({ rarity: "EPIC", cardType: "LORE" }, CARD_VALUATION_DEFAULTS),
    });
    expect(actions(tx)).toEqual(["CARD_RARITY_OVERRIDE"]);
    expect(tx.auditLog.create.mock.calls[0]![0].data).toMatchObject({
      userId: "clerk_admin",
      target: "card_1",
      details: "Rarity COMMON → EPIC: Featured article",
    });
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });

  it("re-prices an NS card from its NationStates bank value", async () => {
    const { db, tx, edit } = setUp(
      stored({ cardType: "NS", metadata: { nsData: { market_value: "1000" } } })
    );
    await updateLibraryCard(db as never, actor, { ...edit, rarity: "RARE", reason: "Season fix" });
    expect(tx.card.updateMany.mock.calls[0]![0].data.marketValue).toBe(
      computeCardValue(
        { rarity: "RARE", cardType: "NS", nsMarketValue: 1000 },
        CARD_VALUATION_DEFAULTS
      )
    );
  });

  it("writes only what changed, under the art, visibility and rarity it read", async () => {
    const { db, tx, edit } = setUp();
    await updateLibraryCard(db as never, actor, {
      ...edit,
      title: "Elm Republic",
      description: "A republic",
      artwork: ELM_FLAG,
      reason: "unused",
    });
    expect(tx.card.updateMany.mock.calls[0]![0]).toEqual({
      where: { id: "card_1", artwork: ELM, isRetired: false, rarity: "COMMON" },
      data: {
        title: "Elm Republic",
        description: "A republic",
        artwork: ELM_FLAG,
        artworkSource: "UPLOADED",
        artworkCredit: null,
      },
    });
    expect(actions(tx)).toEqual(["CARD_UPDATE"]);
    expect(tx.auditLog.create.mock.calls[0]![0].data.details).toBe(
      "Edited the title, description, art of Elm Republic"
    );
  });

  it("sends new art to Licence review as unknown, named by its file on the card's wiki", async () => {
    const { db, tx, edit } = setUp();
    await updateLibraryCard(db as never, actor, { ...edit, artwork: ELM_FLAG });
    const licence = {
      wiki: "iiwiki",
      status: "UNKNOWN",
      fileUrl: ELM_FLAG,
      fileTitle: "Elm_flag.png",
      descriptionUrl: null,
      licence: null,
      licenceUrl: null,
      artist: null,
      attribution: null,
      reviewedBy: null,
      reviewedAt: null,
      note: "Art changed in the Library",
    };
    expect(tx.cardArtLicence.upsert).toHaveBeenCalledWith({
      where: { cardId: "card_1" },
      create: { cardId: "card_1", ...licence },
      update: licence,
    });
    expect(tx.cardArtLicence.upsert.mock.invocationCallOrder[0]).toBeGreaterThan(
      tx.card.updateMany.mock.invocationCallOrder[0]!
    );

    // Art on another host names no file; a card with no source is IxWiki's
    const legacy = setUp(stored({ wikiSource: null }));
    await updateLibraryCard(legacy.db as never, actor, {
      ...legacy.edit,
      artwork: "https://example.com/elm.png",
    });
    expect(legacy.tx.cardArtLicence.upsert.mock.calls[0]![0].update).toMatchObject({
      wiki: "ixwiki",
      fileUrl: "https://example.com/elm.png",
      fileTitle: null,
    });
  });

  it("clears art to the placeholder, with no credit and no licence row", async () => {
    const { db, tx, edit } = setUp(stored({ description: "Old" }));
    await updateLibraryCard(db as never, actor, { ...edit, artwork: null, description: "" });
    expect(tx.card.updateMany.mock.calls[0]![0].data).toEqual({
      description: null,
      artwork: null,
      artworkSource: "PROCEDURAL",
      artworkCredit: null,
    });
    expect(tx.cardArtLicence.deleteMany).toHaveBeenCalledWith({ where: { cardId: "card_1" } });
    expect(tx.cardArtLicence.upsert).not.toHaveBeenCalled();
  });

  it("hides and unhides a card, auditing each", async () => {
    const { db, tx, edit } = setUp();
    await updateLibraryCard(db as never, actor, { ...edit, retired: true });
    expect(tx.card.updateMany.mock.calls[0]![0]).toMatchObject({
      where: { isRetired: false },
      data: { isRetired: true, retiredAt: expect.any(Date) },
    });
    expect(tx.auditLog.create.mock.calls[0]![0].data).toMatchObject({
      action: "CARD_HIDE",
      details: "Hid Elm",
    });

    const hidden = stored({ isRetired: true });
    tx.card.findUnique.mockResolvedValue(hidden);
    await updateLibraryCard(db as never, actor, { ...unchanged(hidden), retired: false });
    expect(tx.card.updateMany.mock.calls[1]![0].data).toEqual({
      isRetired: false,
      retiredAt: null,
    });
    expect(tx.auditLog.create.mock.calls[1]![0].data).toMatchObject({
      action: "CARD_HIDE",
      details: "Unhid Elm",
    });
    expect(tx.cardArtLicence.upsert).not.toHaveBeenCalled();
    expect(tx.cardArtLicence.deleteMany).not.toHaveBeenCalled();
  });

  it("writes nothing for a save that changes nothing", async () => {
    const { db, tx, edit } = setUp();
    await updateLibraryCard(db as never, actor, { ...edit, reason: "No change" });
    expect(tx.card.updateMany).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it("takes new art only as an https address, and keeps stored art of any form", async () => {
    const { db, tx, edit } = setUp(stored({ artwork: "/api/wiki/file/Elm.png" }));
    for (const artwork of ["http://example.com/a.png", "javascript:alert(1)", "/images/a.png"]) {
      await expect(updateLibraryCard(db as never, actor, { ...edit, artwork })).rejects.toThrow(
        /https/
      );
    }
    await updateLibraryCard(db as never, actor, { ...edit, title: "Elm II" });
    expect(tx.card.updateMany.mock.calls[0]![0].data).toEqual({ title: "Elm II" });
    expect(tx.cardArtLicence.upsert).not.toHaveBeenCalled();
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

  it("refuses a card that is gone, or that changed between its read and its write", async () => {
    const gone = setUp(null);
    await expect(updateLibraryCard(gone.db as never, actor, gone.edit)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });

    const { db, tx, edit } = setUp();
    tx.card.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      updateLibraryCard(db as never, actor, { ...edit, artwork: ELM_FLAG })
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: "This card changed while you edited it. Reload and try again.",
    });
    expect(tx.cardArtLicence.upsert).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
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

  it("refuses a change of no cards, so no empty change is audited", async () => {
    const { db, tx } = withTx();
    await expect(bulkSetRetired(db as never, actor, input({ expected: 0 }))).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "No matching card would change",
    });
    expect(tx.card.count).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
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

  it("unhides the hidden cards it counted, reward cards included, naming the whole filter", async () => {
    const { db, tx } = withTx();
    tx.card.count.mockResolvedValue(1);
    tx.card.updateMany.mockResolvedValue({ count: 1 });
    const narrow = filter({
      cardType: "NS",
      rarity: "EPIC",
      source: "iiwiki",
      show: "retired",
      search: "Elm",
    });
    await bulkSetRetired(
      db as never,
      actor,
      input({ filter: narrow, retired: false, expected: 1 })
    );
    const { where, data } = tx.card.updateMany.mock.calls[0]![0];
    expect(data).toEqual({ isRetired: false, retiredAt: null });
    expect(where).toEqual(tx.card.count.mock.calls[0]![0].where);
    expect(where.AND.slice(-3)).toEqual([{ isRetired: true }, ...COMPLIANCE_FREE]);
    expect(tx.auditLog.create.mock.calls[0]![0].data.details).toBe(
      'Unhid 1 card matching type NS, rarity EPIC, source iiwiki, showing retired, title "Elm": Realm closed'
    );
  });
});
