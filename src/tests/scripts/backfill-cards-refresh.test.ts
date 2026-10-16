/** @jest-environment node */
/** Cards refresh §5.5 step 3 and §5.6: the backfill on a fixture database. */
import type { LedgerRow } from "~/lib/cards/legacy-mapping";
import {
  applyPlan,
  isEmptyPlan,
  planBackfill,
  runBackfill,
} from "../../../scripts/cards/backfill-cards-refresh-plan";
import type {
  BackfillIo,
  BackfillSnapshot,
  BackfillWriter,
  CardMerge,
  CardPatch,
  CopyPatch,
  PackPatch,
  RealmInsert,
  SnapshotCard,
  SnapshotCopy,
} from "../../../scripts/cards/backfill-cards-refresh-types";

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const OPTIONS = { nsPremium: 1.5, floor: (rarity: string) => (rarity === "COMMON" ? 10 : 100) };

function card(id: string, overrides: Partial<SnapshotCard> = {}): SnapshotCard {
  return {
    id,
    cardType: "LORE",
    rarity: "COMMON",
    category: "NS_IMPORT",
    title: id,
    wikiSource: "ixwiki",
    wikiArticleTitle: id,
    countryId: null,
    lorewardEntryId: null,
    nsCardId: null,
    nsSeason: null,
    season: 1,
    realmId: null,
    isBound: false,
    artwork: "art.png",
    artworkUrl: null,
    metadata: null,
    stats: null,
    nsData: null,
    createdAt: d("2026-01-01"),
    ...overrides,
  };
}

function copy(id: string, cardId: string, overrides: Partial<SnapshotCopy> = {}): SnapshotCopy {
  return {
    id,
    cardId,
    ownerId: "u1",
    serialNumber: 1,
    acquiredAt: d("2026-02-01"),
    finish: "STANDARD",
    ...overrides,
  };
}

function fixture(): BackfillSnapshot {
  return {
    realms: [
      { id: "default", slug: "ixnay", isSystem: false },
      { id: "eurth", slug: "eurth", isSystem: false },
    ],
    cards: [
      card("ns1", {
        cardType: "NS_IMPORT",
        title: "Heku",
        wikiSource: null,
        wikiArticleTitle: "Heku",
        nsCardId: 7,
        nsSeason: 1,
        stats: { region: "Abydos", marketValue: "100", govt: "x" },
        metadata: {
          importedFrom: "region:abydos",
          nsData: { name: "Heku", govt: "x", market_value: "0.05" },
        },
      }),
      card("ns2", {
        cardType: "NS_IMPORT",
        title: "Kiro",
        wikiArticleTitle: null,
        nsCardId: 8,
        nsSeason: 1,
      }),
      card("foo_new", {
        cardType: "LORE_BATCH",
        wikiSource: "iiwiki",
        wikiArticleTitle: "foo_bar",
        createdAt: d("2026-03-01"),
      }),
      card("foo_old", {
        wikiSource: "iiwiki",
        wikiArticleTitle: "Foo bar",
        metadata: { loreStats: { a: 1 }, qualityScore: 40 },
      }),
      card("elsewhere", { wikiSource: "iiwiki", wikiArticleTitle: "Elsewhere" }),
      card("flag", {
        cardType: "COMMONS_IMPORT",
        wikiSource: null,
        wikiArticleTitle: null,
        artwork: null,
        artworkUrl: "flag.svg",
      }),
      card("relic", { cardType: "SPECIAL", rarity: "MYTHIC", category: "SPECIAL" }),
      card("trophy", { lorewardEntryId: "e1", rarity: "EPIC" }),
      card("cup", {
        cardType: "SPECIAL",
        title: "Kiro Reds Season 3 Champions",
        rarity: "ultra-rare",
      }),
      card("card-achievement-veteran", { cardType: "SPECIAL", rarity: "EPIC" }),
      card("nation", { cardType: "NATION", countryId: "c_eurth" }),
    ],
    copies: [
      copy("o_ns1_a", "ns1", { ownerId: "u_imp" }),
      copy("o_ns1_b", "ns1", { ownerId: "u_pack", acquiredAt: d("2026-03-01") }),
      copy("o_foo_new", "foo_new"),
      copy("o_foo_old", "foo_old"),
      copy("o_relic", "relic"),
      copy("o_trophy", "trophy"),
    ],
    packs: [
      {
        id: "pack_s1",
        cardType: "NS_IMPORT",
        themeFilter: null,
        guaranteedRarity: null,
        season: 1,
      },
      {
        id: "pack_theme",
        cardType: null,
        themeFilter: { cardTypes: ["LORE_BATCH"] },
        guaranteedRarity: "MYTHIC",
        season: null,
      },
    ],
    realmPages: [
      { realmId: "eurth", wikiSource: "iiwiki", title: "Foo bar", importedAt: d("2026-01-01") },
    ],
    countries: [{ id: "c_eurth", realmId: "eurth" }],
    transfers: [
      { ownershipId: "o_ns1_b", action: "PACK_OPEN", fromUserId: null, createdAt: d("2026-03-01") },
    ],
    verifications: [{ userId: "u_imp", nationName: "Test Landia" }],
    ledger: [],
    requestSuggestedRarities: ["RARE"],
    requestNsImportCategories: 2,
  };
}

/** Applies a plan to the snapshot itself, as the SQL writer applies it to the database. */
function memoryWriter(db: BackfillSnapshot) {
  const patch = <T extends { id: string }>(rows: T[], patches: ReadonlyArray<{ id: string }>) => {
    for (const p of patches) Object.assign(rows.find((row) => row.id === p.id) ?? {}, p);
  };
  return {
    insertRealms: jest.fn(async (rows: RealmInsert[]) => {
      db.realms.push(...rows.map(({ id, slug, isSystem }) => ({ id, slug, isSystem })));
    }),
    updateCards: jest.fn(async (patches: CardPatch[]) => patch(db.cards, patches)),
    updatePacks: jest.fn(async (patches: PackPatch[]) => patch(db.packs, patches)),
    updateCopies: jest.fn(async (patches: CopyPatch[]) => patch(db.copies, patches)),
    insertLedger: jest.fn(async (rows: LedgerRow[]) => {
      db.ledger.push(...rows);
    }),
    clearRequestCategories: jest.fn(async () => {
      db.requestNsImportCategories = 0;
    }),
    // Deleting a card cascades to its copies (CardOwnership_cardId_fkey ON DELETE CASCADE), as in the database.
    mergeCards: jest.fn(async ({ loserIds }: CardMerge) => {
      db.cards = db.cards.filter((row) => !loserIds.includes(row.id));
      db.copies = db.copies.filter((row) => !loserIds.includes(row.cardId));
    }),
  } satisfies BackfillWriter;
}

function io(db: BackfillSnapshot, writer: BackfillWriter) {
  return {
    load: async () => db,
    options: async () => OPTIONS,
    write: jest.fn(async (apply: (w: BackfillWriter) => Promise<void>) => apply(writer)),
  } satisfies BackfillIo;
}

function byId<T extends { id: string }>(rows: T[], id: string): T {
  const row = rows.find((candidate) => candidate.id === id);
  if (!row) throw new Error(`no row ${id}`);
  return row;
}

async function applied(): Promise<BackfillSnapshot> {
  const db = fixture();
  await applyPlan(memoryWriter(db), planBackfill(db, OPTIONS).plan);
  return db;
}

describe("cards refresh backfill", () => {
  it("dry run: reports and writes nothing", async () => {
    const db = fixture();
    const writer = memoryWriter(db);
    const result = await runBackfill(io(db, writer), false);
    expect(result.applied).toBe(false);
    expect(result.errors).toEqual([]);
    for (const write of Object.values(writer)) expect(write).not.toHaveBeenCalled();
    expect(result.report.commonsCards).toEqual([{ id: "flag", title: "flag" }]);
    expect(result.report.holoCopies).toBe(1);
    expect(result.report.serialisedCopies).toBe(1);
    expect(result.report.realmsSeeded).toEqual(["nationstates", "iiwiki", "althistory"]);
    expect(result.report.packCardTypes).toEqual(["NS_IMPORT"]);
    expect(result.report.suggestedRarities).toEqual(["RARE"]);
    // ns1's bank value is "100" (stats wins over metadata.nsData): 100 × 1.5 is above the Common floor of 10.
    expect(result.report.nsTermCards.count).toBe(1);
    expect(result.report.mergeGroups).toHaveLength(1);
    expect(result.report.ledgerRows).toBe(1);
    expect(result.report.requestCategoriesCleared).toBe(2);
  });

  it("applies every mapping, and a second run plans nothing", async () => {
    const db = await applied();

    expect(byId(db.cards, "ns1")).toMatchObject({
      cardType: "NS",
      realmId: "nationstates",
      category: null,
    });
    expect(byId(db.cards, "ns1").metadata).toEqual({
      importedFrom: "region:abydos",
      nsData: { name: "Heku", region: "Abydos", market_value: "100", id: "7", season: "1" },
    });
    expect(byId(db.cards, "ns2").metadata).toEqual({ nsData: { id: "8", season: "1" } });
    expect(byId(db.cards, "foo_old")).toMatchObject({
      realmId: "eurth",
      wikiArticleTitle: "Foo bar",
      metadata: { qualityScore: 40 },
    });
    expect(byId(db.cards, "elsewhere").realmId).toBe("iiwiki");
    expect(byId(db.cards, "flag")).toMatchObject({
      cardType: "LORE",
      realmId: "default",
      artwork: "flag.svg",
    });
    expect(byId(db.cards, "relic")).toMatchObject({
      rarity: "LEGENDARY",
      realmId: "default",
      category: "SPECIAL",
    });
    expect(byId(db.cards, "trophy")).toMatchObject({ cardType: "TROPHY", isBound: true });
    expect(byId(db.cards, "cup")).toMatchObject({
      cardType: "TROPHY",
      rarity: "ULTRA_RARE",
      isBound: true,
    });
    expect(byId(db.cards, "card-achievement-veteran")).toMatchObject({
      cardType: "SPECIAL",
      isBound: true,
    });
    expect(byId(db.cards, "nation").realmId).toBe("eurth");
    expect(byId(db.copies, "o_relic").finish).toBe("HOLO");
    expect(byId(db.copies, "o_trophy").finish).toBe("SERIALISED");
    expect(db.ledger).toEqual([
      { nsCardId: 7, nsSeason: 1, nation: "test_landia", userId: "u_imp", ownershipId: "o_ns1_a" },
    ]);
    expect(byId(db.packs, "pack_theme")).toMatchObject({
      themeFilter: { cardTypes: ["LORE"] },
      guaranteedRarity: "LEGENDARY",
    });
    expect(db.requestNsImportCategories).toBe(0);

    const again = planBackfill(db, OPTIONS);
    expect(again.errors).toEqual([]);
    expect(isEmptyPlan(again.plan)).toBe(true);
  });

  it("merges duplicate Lore cards onto the survivor with unique serials", async () => {
    const db = await applied();
    expect(db.cards.map((c) => c.id)).not.toContain("foo_new");
    const merged = db.copies.filter((c) => c.cardId === "foo_old").map((c) => c.serialNumber);
    expect(merged.sort()).toEqual([1, 2]);
  });

  it("keeps a merged-away card's copies: they move before the card is deleted", async () => {
    const db = await applied();
    expect(byId(db.copies, "o_foo_new").cardId).toBe("foo_old");
    expect(db.copies).toHaveLength(fixture().copies.length);
  });

  it("writes exactly the NS facts the constraints compare: stats first, trimmed as JS trims, numbers as text", async () => {
    const db = fixture();
    db.cards.push(
      card("ns3", {
        cardType: "NS_IMPORT",
        nsCardId: 9,
        nsSeason: 2,
        stats: { marketValue: 12.5, region: "\u00a0Abydos\t", category: " common " },
        metadata: { nsData: { market_value: "1", region: "Elsewhere", flag: "f.png" } },
        nsData: { name: "Kel", region: "Old", govt: "g" },
      })
    );
    await applyPlan(memoryWriter(db), planBackfill(db, OPTIONS).plan);
    expect(byId(db.cards, "ns3").metadata).toEqual({
      nsData: {
        id: "9",
        name: "Kel",
        flag: "f.png",
        region: "Abydos",
        category: "common",
        season: "2",
        market_value: "12.5",
      },
    });
  });

  it("renumbers serial collisions by acquisition", async () => {
    const db = await applied();
    expect(byId(db.copies, "o_ns1_a").serialNumber).toBe(1);
    expect(byId(db.copies, "o_ns1_b").serialNumber).toBe(2);
  });

  it("leaves NS packs a pool after the type remap", async () => {
    const db = await applied();
    const pack = byId(db.packs, "pack_s1");
    expect(pack.cardType).toBe("NS");
    expect(
      db.cards.filter((c) => c.cardType === pack.cardType && c.season === pack.season)
    ).toHaveLength(2);
  });

  it("fails the dry run on an unknown type or rarity, naming the cards, and never writes", async () => {
    const db = fixture();
    db.cards.push(card("odd", { cardType: "COMMUNITY" }), card("shiny", { rarity: "SHINY" }));
    const writer = memoryWriter(db);
    const result = await runBackfill(io(db, writer), true);
    expect(result.applied).toBe(false);
    expect(result.errors.join("\n")).toMatch(/cardType "COMMUNITY".*odd/);
    expect(result.errors.join("\n")).toMatch(/rarity "SHINY".*shiny/);
    for (const write of Object.values(writer)) expect(write).not.toHaveBeenCalled();
  });

  it("refuses a system realm id another realm already uses", () => {
    const db = fixture();
    db.realms.push({ id: "iiwiki", slug: "iiwiki", isSystem: false });
    expect(planBackfill(db, OPTIONS).errors.join("\n")).toMatch(/iiwiki/);
  });

  it("seeds Ixnay when missing and the system realms in the one write, before any card points at them", async () => {
    const db = fixture();
    db.realms = db.realms.filter((realm) => realm.id !== "default");
    const writer = memoryWriter(db);
    const run = io(db, writer);
    const result = await runBackfill(run, true);
    expect(result.applied).toBe(true);
    expect(run.write).toHaveBeenCalledTimes(1);
    expect(result.report.realmsSeeded).toEqual(["default", "nationstates", "iiwiki", "althistory"]);
    const [realmsOrder] = writer.insertRealms.mock.invocationCallOrder;
    const [cardsOrder] = writer.updateCards.mock.invocationCallOrder;
    expect(realmsOrder).toBeLessThan(cardsOrder ?? 0);
    expect(byId(db.realms, "nationstates").isSystem).toBe(true);
    expect(byId(db.realms, "default").isSystem).toBe(false);
  });

  it("leaves no card on a realm that does not exist, and refuses a card already on a missing realm", async () => {
    const db = await applied();
    const realms = new Set(db.realms.map((realm) => realm.id));
    expect(db.cards.filter((c) => !c.realmId || !realms.has(c.realmId))).toEqual([]);

    const orphan = fixture();
    orphan.cards.push(card("lost", { realmId: "gone" }));
    expect(planBackfill(orphan, OPTIONS).errors.join("\n")).toMatch(/gone.*lost/);
  });

  it("refuses Lore cards the constraints' natural key would still reject after the merges", () => {
    const db = fixture();
    // Blank titles are never merged, yet both are ("ixwiki", "") to the key's COALESCE(wikiSource) and lower(title).
    db.cards.push(
      card("blank_a", { wikiArticleTitle: " " }),
      card("blank_b", { wikiArticleTitle: "" })
    );
    const result = planBackfill(db, OPTIONS);
    expect(result.errors.join("\n")).toMatch(/blank_a, blank_b/);
    expect(isEmptyPlan(result.plan)).toBe(true);
  });

  it("clears the retired NS_IMPORT category from every card, Lore included, and from the lore requests", async () => {
    const db = await applied();
    expect(db.cards.filter((c) => c.category === "NS_IMPORT")).toEqual([]);
    expect(byId(db.cards, "foo_old").category).toBeNull();
    expect(db.requestNsImportCategories).toBe(0);
  });

  it("copies artworkUrl into a blank artwork, and leaves a set artwork alone", async () => {
    const db = fixture();
    db.cards.push(
      card("blank", { artwork: "  ", artworkUrl: "blank.png" }),
      card("kept", { artwork: "own.png", artworkUrl: "other.png" })
    );
    const result = planBackfill(db, OPTIONS);
    await applyPlan(memoryWriter(db), result.plan);
    expect(byId(db.cards, "blank").artwork).toBe("blank.png");
    expect(byId(db.cards, "kept").artwork).toBe("own.png");
    expect(result.report.artworkCopied).toBe(2);
  });

  it("remaps every theme type, keeping a single-type string a string, and refuses an unknown one", async () => {
    const db = fixture();
    db.packs.push(
      {
        id: "pack_one",
        cardType: null,
        themeFilter: { cardTypes: "NS_IMPORT", categories: ["HISTORY"] },
        guaranteedRarity: null,
        season: null,
      },
      {
        id: "pack_new",
        cardType: "LORE",
        themeFilter: { cardTypes: ["LORE", "NATION"] },
        guaranteedRarity: "EPIC",
        season: null,
      }
    );
    const result = planBackfill(db, OPTIONS);
    expect(result.plan.packs.map((p) => p.id).sort()).toEqual([
      "pack_one",
      "pack_s1",
      "pack_theme",
    ]);
    await applyPlan(memoryWriter(db), result.plan);
    expect(byId(db.packs, "pack_one").themeFilter).toEqual({
      cardTypes: "NS",
      categories: ["HISTORY"],
    });

    const odd = fixture();
    odd.packs.push({
      id: "pack_odd",
      cardType: null,
      themeFilter: { cardTypes: ["COMMUNITY"] },
      guaranteedRarity: null,
      season: null,
    });
    expect(planBackfill(odd, OPTIONS).errors.join("\n")).toMatch(/pack_odd/);
  });

  it("reports each typed pack's pool before and after the remap", () => {
    const { report } = planBackfill(fixture(), OPTIONS);
    expect(report.packPools).toEqual([
      { id: "pack_s1", cardType: "NS", season: 1, before: 2, after: 2 },
      // LORE_BATCH folds into LORE: the theme now draws every Lore card (foo_new is merged away).
      { id: "pack_theme", cardType: null, season: null, before: 1, after: 3 },
    ]);
  });

  it("counts the imports attributed to their current owner rather than to a trade giver", () => {
    const db = fixture();
    db.copies.push(copy("o_ns2_t", "ns2", { ownerId: "u_two" }));
    db.transfers.push({
      ownershipId: "o_ns2_t",
      action: "TRADE",
      fromUserId: "u_imp",
      createdAt: d("2026-04-01"),
    });
    const { report, plan } = planBackfill(db, OPTIONS);
    // o_ns1_a has no trail, so its owner is taken as its importer; o_ns2_t's importer is its trade giver.
    expect(report.ownerInferredImports).toBe(1);
    expect(plan.ledger.map((row) => row.ownershipId)).toEqual(["o_ns1_a", "o_ns2_t"]);
  });

  it("a second --apply writes nothing", async () => {
    const db = await applied();
    const writer = memoryWriter(db);
    const run = io(db, writer);
    const result = await runBackfill(run, true);
    expect(result.applied).toBe(false);
    expect(run.write).not.toHaveBeenCalled();
  });

  it("once the legacy columns are gone, only seeds missing realms", () => {
    const realmsOnly = (realms: BackfillSnapshot["realms"]): BackfillSnapshot => ({
      ...fixture(),
      realms,
      cards: [],
      copies: [],
      packs: [],
      requestSuggestedRarities: [],
      requestNsImportCategories: 0,
    });
    const fresh = planBackfill(realmsOnly([]), OPTIONS);
    expect(fresh.plan.realms.map((realm) => realm.id)).toEqual([
      "default",
      "nationstates",
      "iiwiki",
      "althistory",
    ]);
    expect(fresh.plan.cards).toEqual([]);

    const done = realmsOnly([
      { id: "default", slug: "ixnay", isSystem: false },
      { id: "nationstates", slug: "nationstates", isSystem: true },
      { id: "iiwiki", slug: "iiwiki", isSystem: true },
      { id: "althistory", slug: "althistory", isSystem: true },
    ]);
    expect(isEmptyPlan(planBackfill(done, OPTIONS).plan)).toBe(true);
  });
});
