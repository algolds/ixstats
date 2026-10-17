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
const filter = (input: Record<string, string>) => LibraryFilterSchema.parse(input);
const COMPLIANCE_FREE = [
  { takedowns: { none: { status: "HIDDEN" } } },
  { artLicence: { isNot: { status: "RESTRICTED" } } },
];

/** A database whose `$transaction` hands its callback a separate client, so a test sees which writes it holds. */
function withTx() {
  const db = createMockPrisma();
  const tx = createMockPrisma();
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
  it("reads the page and the total as of one moment, newest first", async () => {
    const db = createMockPrisma();
    db.card.findMany.mockResolvedValue([{ id: "card_1" }]);
    db.card.count.mockResolvedValue(51);
    const page = await listLibrary(db as never, {
      filter: filter({ realmId: "eurth" }),
      offset: 50,
      limit: 50,
    });
    expect(page).toEqual({ rows: [{ id: "card_1" }], total: 51, asOf: expect.any(Date) });
    const query = db.card.findMany.mock.calls[0]![0];
    expect(query.where).toEqual({
      AND: [...libraryWhere(filter({ realmId: "eurth" })).AND, { createdAt: { lte: page.asOf } }],
    });
    expect(query).toMatchObject({
      skip: 50,
      take: 50,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    });
    expect(db.card.count.mock.calls[0]![0].where).toBe(query.where);
  });
});

describe("updateLibraryCard", () => {
  const stored = (over: Record<string, unknown> = {}) => ({
    id: "card_1",
    title: "Elm",
    description: null,
    artwork: "https://iiwiki.com/images/a/ab/Elm.png",
    rarity: "COMMON",
    cardType: "LORE",
    isRetired: false,
    metadata: null,
    artLicence: null,
    _count: { takedowns: 0 },
    ...over,
  });
  const edit: LibraryEdit = {
    cardId: "card_1",
    title: "Elm",
    description: "",
    artwork: "https://iiwiki.com/images/a/ab/Elm.png",
    rarity: "COMMON",
    retired: false,
  };
  /** The card as stored, read in the edit's transaction, and the conditional write it makes. */
  function setUp(card: ReturnType<typeof stored> | null = stored()) {
    const { db, tx } = withTx();
    db.systemConfig.findMany.mockResolvedValue([]);
    tx.card.findUnique.mockResolvedValue(card);
    tx.card.updateMany.mockResolvedValue({ count: 1 });
    return { db, tx };
  }
  const actions = (tx: ReturnType<typeof createMockPrisma>) =>
    tx.auditLog.create.mock.calls.map(([args]: [{ data: { action: string } }]) => args.data.action);

  it("needs a reason to override rarity, and re-prices and audits the override in one transaction", async () => {
    const { db, tx } = setUp();
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
    const { db, tx } = setUp(
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
    const { db, tx } = setUp();
    await updateLibraryCard(db as never, actor, {
      ...edit,
      title: "Elm Republic",
      description: "A republic",
      artwork: "https://iiwiki.com/images/b/bc/Elm_flag.png",
      reason: "unused",
    });
    expect(tx.card.updateMany.mock.calls[0]![0]).toEqual({
      where: {
        id: "card_1",
        artwork: "https://iiwiki.com/images/a/ab/Elm.png",
        isRetired: false,
        rarity: "COMMON",
        takedowns: { none: { status: "HIDDEN" } },
      },
      data: {
        title: "Elm Republic",
        description: "A republic",
        artwork: "https://iiwiki.com/images/b/bc/Elm_flag.png",
        artworkSource: "UPLOADED",
      },
    });
    expect(actions(tx)).toEqual(["CARD_UPDATE"]);
    expect(tx.auditLog.create.mock.calls[0]![0].data.details).toBe(
      "Edited the title, description, art of Elm Republic"
    );
  });

  it("clears art to the placeholder and a description to none", async () => {
    const { db, tx } = setUp(stored({ description: "Old" }));
    await updateLibraryCard(db as never, actor, { ...edit, artwork: null, description: "" });
    expect(tx.card.updateMany.mock.calls[0]![0].data).toEqual({
      description: null,
      artwork: null,
      artworkSource: "PROCEDURAL",
    });
  });

  it("hides and unhides a card, auditing each", async () => {
    const { db, tx } = setUp();
    await updateLibraryCard(db as never, actor, { ...edit, retired: true });
    expect(tx.card.updateMany.mock.calls[0]![0]).toMatchObject({
      where: { isRetired: false, takedowns: { none: { status: "HIDDEN" } } },
      data: { isRetired: true, retiredAt: expect.any(Date) },
    });
    expect(tx.auditLog.create.mock.calls[0]![0].data).toMatchObject({
      action: "CARD_HIDE",
      details: "Hid Elm",
    });

    tx.card.findUnique.mockResolvedValue(stored({ isRetired: true }));
    await updateLibraryCard(db as never, actor, edit);
    expect(tx.card.updateMany.mock.calls[1]![0].data).toEqual({
      isRetired: false,
      retiredAt: null,
    });
    expect(tx.auditLog.create.mock.calls[1]![0].data).toMatchObject({
      action: "CARD_HIDE",
      details: "Unhid Elm",
    });
  });

  it("writes nothing for a save that changes nothing", async () => {
    const { db, tx } = setUp();
    await updateLibraryCard(db as never, actor, { ...edit, reason: "No change" });
    expect(tx.card.updateMany).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it("takes new art only as an https address, and keeps stored art of any form", async () => {
    const { db, tx } = setUp(stored({ artwork: "/api/wiki/file/Elm.png" }));
    for (const artwork of ["http://example.com/a.png", "javascript:alert(1)", "/images/a.png"]) {
      await expect(updateLibraryCard(db as never, actor, { ...edit, artwork })).rejects.toThrow(
        /https/
      );
    }
    await updateLibraryCard(db as never, actor, {
      ...edit,
      artwork: "/api/wiki/file/Elm.png",
      title: "Elm II",
    });
    expect(tx.card.updateMany.mock.calls[0]![0].data).toEqual({ title: "Elm II" });
    expect(tx.card.updateMany.mock.calls[0]![0].where).not.toHaveProperty("takedowns");
  });

  it("leaves art and visibility that a takedown hides to Compliance, and lets the words change", async () => {
    const { db, tx } = setUp(stored({ artwork: null, isRetired: true, _count: { takedowns: 1 } }));
    const hidden = { ...edit, artwork: null, retired: true };
    await expect(
      updateLibraryCard(db as never, actor, { ...hidden, artwork: "https://example.com/new.png" })
    ).rejects.toThrow(/from Compliance/);
    await expect(
      updateLibraryCard(db as never, actor, { ...hidden, retired: false })
    ).rejects.toThrow(/from Compliance/);
    expect(tx.card.updateMany).not.toHaveBeenCalled();
    await updateLibraryCard(db as never, actor, { ...hidden, title: "Elm Republic" });
    expect(tx.card.updateMany.mock.calls[0]![0].data).toEqual({ title: "Elm Republic" });
  });

  it("leaves a card whose art licence is restricted to Compliance", async () => {
    const { db, tx } = setUp(stored({ isRetired: true, artLicence: { status: "RESTRICTED" } }));
    await expect(updateLibraryCard(db as never, actor, edit)).rejects.toThrow(/from Compliance/);
    expect(tx.card.updateMany).not.toHaveBeenCalled();
  });

  it("refuses a card that is gone or changed since it was read", async () => {
    const gone = setUp(null);
    await expect(updateLibraryCard(gone.db as never, actor, edit)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });

    const { db, tx } = setUp();
    tx.card.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      updateLibraryCard(db as never, actor, { ...edit, title: "Elm II" })
    ).rejects.toMatchObject({
      code: "CONFLICT",
    });
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
  });

  it("refuses when the matching cards changed since the Library was read", async () => {
    const { db, tx } = withTx();
    tx.card.count.mockResolvedValue(13);
    await expect(bulkSetRetired(db as never, actor, input())).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(tx.card.updateMany).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it("hides the visible cards the admin was shown, leaving Compliance's cards out", async () => {
    const { db, tx } = withTx();
    tx.card.count.mockResolvedValue(12);
    tx.card.updateMany.mockResolvedValue({ count: 10 });
    await expect(bulkSetRetired(db as never, actor, input())).resolves.toEqual({ count: 10 });
    const shown = [{ realmId: "eurth" }, {}, {}, {}, {}, {}, { createdAt: { lte: AS_OF } }];
    expect(tx.card.count.mock.calls[0]![0].where).toEqual({ AND: shown });
    expect(tx.card.updateMany.mock.calls[0]![0]).toEqual({
      where: { AND: [...shown, { isRetired: false }, ...COMPLIANCE_FREE] },
      data: { isRetired: true, retiredAt: expect.any(Date) },
    });
    expect(tx.auditLog.create.mock.calls[0]![0].data).toMatchObject({
      action: "CARD_HIDE",
      userId: "clerk_admin",
      target: null,
      details: "Hid 10 cards matching realm eurth: Realm closed",
    });
  });

  it("unhides the hidden cards the admin was shown, naming the whole filter", async () => {
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
    expect(tx.card.updateMany.mock.calls[0]![0].data).toEqual({
      isRetired: false,
      retiredAt: null,
    });
    expect(tx.card.updateMany.mock.calls[0]![0].where.AND).toContainEqual({ isRetired: true });
    expect(tx.auditLog.create.mock.calls[0]![0].data.details).toBe(
      'Unhid 1 card matching type NS, rarity EPIC, source iiwiki, showing retired, title "Elm": Realm closed'
    );
  });
});
