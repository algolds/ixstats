/** @jest-environment node */
/** Cards refresh §5.3: the legacy mapping the backfill runs. */
import {
  articleKey,
  boundFor,
  canonicalArticleTitle,
  categoryFor,
  earliestRealmByArticle,
  finishFor,
  homeRealmFor,
  inferImportLedger,
  legacyNsFacts,
  loreMergeGroups,
  mapCardType,
  mapRarity,
  mapTypeString,
  renumberCollisions,
  renumberOnto,
  SYSTEM_REALMS,
  wikiFallbackRealm,
  withoutStatKeys,
} from "~/lib/cards/legacy-mapping";

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const card = (cardType: string, extra: { lorewardEntryId?: string; title?: string } = {}) => ({
  cardType,
  lorewardEntryId: extra.lorewardEntryId ?? null,
  title: extra.title ?? "A card",
});

describe("card type", () => {
  it.each([
    ["LORE", "LORE"],
    ["LORE_BATCH", "LORE"],
    ["WIKI_LORE", "LORE"],
    ["COMMONS_IMPORT", "LORE"],
    ["USER_CUSTOM", "LORE"],
    ["NS_IMPORT", "NS"],
    ["NATION", "NATION"],
    ["SPECIAL", "SPECIAL"],
    ["NS", "NS"],
    ["TROPHY", "TROPHY"],
  ])("%s becomes %s", (from, to) => {
    expect(mapCardType(card(from))).toBe(to);
  });

  it("makes any card with a Loreward entry a Trophy, whatever its type", () => {
    expect(mapCardType(card("LORE", { lorewardEntryId: "e1" }))).toBe("TROPHY");
    expect(mapCardType(card("NS_IMPORT", { lorewardEntryId: "e1" }))).toBe("TROPHY");
  });

  it("makes a sports championship's Special card a Trophy, and leaves other Special cards alone", () => {
    expect(mapCardType(card("SPECIAL", { title: "Kiro Reds Season 3 Champions" }))).toBe("TROPHY");
    expect(mapCardType(card("SPECIAL", { title: "Caphiria World Cup Season 2 Champions" }))).toBe(
      "TROPHY"
    );
    expect(mapCardType(card("SPECIAL", { title: "Veteran" }))).toBe("SPECIAL");
  });

  it("knows no other value, so the dry run can fail on it", () => {
    expect(mapCardType(card("COMMUNITY"))).toBeNull();
    expect(mapTypeString("bogus")).toBeNull();
    expect(mapTypeString(" ns_import ")).toBe("NS");
  });
});

describe("rarity and finish", () => {
  it.each(["COMMON", "UNCOMMON", "RARE", "ULTRA_RARE", "EPIC", "LEGENDARY"])("%s stays", (r) => {
    expect(mapRarity(r)).toEqual({ rarity: r, retiredTopTier: false });
  });

  it("normalises casing and ultra-rare", () => {
    expect(mapRarity("ultra-rare")).toEqual({ rarity: "ULTRA_RARE", retiredTopTier: false });
    expect(mapRarity("Epic")).toEqual({ rarity: "EPIC", retiredTopTier: false });
  });

  it("folds Mythic and Divine into Legendary, flagged for Holo copies", () => {
    expect(mapRarity("MYTHIC")).toEqual({ rarity: "LEGENDARY", retiredTopTier: true });
    expect(mapRarity("divine")).toEqual({ rarity: "LEGENDARY", retiredTopTier: true });
  });

  it("knows no other rarity", () => {
    expect(mapRarity("SHINY")).toBeNull();
  });

  it("makes trophy copies Serialised, retired top-tier copies Holo, and never downgrades a copy", () => {
    expect(finishFor({ type: "TROPHY", retiredTopTier: false, current: "STANDARD" })).toBe(
      "SERIALISED"
    );
    expect(finishFor({ type: "SPECIAL", retiredTopTier: true, current: "STANDARD" })).toBe("HOLO");
    expect(finishFor({ type: "LORE", retiredTopTier: false, current: "STANDARD" })).toBe(
      "STANDARD"
    );
    expect(finishFor({ type: "LORE", retiredTopTier: false, current: "HOLO" })).toBe("HOLO");
  });
});

describe("category and bound", () => {
  it("gives NS cards and the retired NS_IMPORT bucket no category", () => {
    expect(categoryFor({ type: "NS", category: "MILITARY" })).toBeNull();
    expect(categoryFor({ type: "LORE", category: "NS_IMPORT" })).toBeNull();
    expect(categoryFor({ type: "LORE", category: "HISTORY" })).toBe("HISTORY");
  });

  it("binds trophies and achievement reward cards, and keeps a bound card bound", () => {
    const ids = new Set(["card-achievement-veteran"]);
    expect(boundFor({ id: "t", type: "TROPHY", isBound: false }, ids)).toBe(true);
    expect(boundFor({ id: "card-achievement-veteran", type: "SPECIAL", isBound: false }, ids)).toBe(
      true
    );
    expect(boundFor({ id: "x", type: "SPECIAL", isBound: true }, ids)).toBe(true);
    expect(boundFor({ id: "x", type: "LORE", isBound: false }, ids)).toBe(false);
  });
});

describe("home realm", () => {
  const lookups = {
    countryRealm: new Map([["c_eurth", "eurth"]]),
    articleRealm: earliestRealmByArticle([
      { realmId: "later", wikiSource: "iiwiki", title: "Foo bar", importedAt: d("2026-09-02") },
      { realmId: "eurth", wikiSource: "iiwiki", title: "Foo bar", importedAt: d("2026-09-01") },
    ]),
  };
  const home = (type: string, extra: Partial<Parameters<typeof homeRealmFor>[0]> = {}) =>
    homeRealmFor(
      {
        type: type as Parameters<typeof homeRealmFor>[0]["type"],
        countryId: null,
        wikiSource: null,
        wikiArticleTitle: null,
        title: "T",
        ...extra,
      },
      lookups
    );

  it("puts NS cards in nationstates and Special cards in Ixnay", () => {
    expect(home("NS")).toBe("nationstates");
    expect(home("SPECIAL")).toBe("default");
  });

  it("puts a Nation card in its country's realm, else Ixnay", () => {
    expect(home("NATION", { countryId: "c_eurth" })).toBe("eurth");
    expect(home("NATION", { countryId: "c_gone" })).toBe("default");
  });

  it("puts a Lore or Trophy card in the realm that imported its page earliest, matching canonical titles", () => {
    expect(home("LORE", { wikiSource: "iiwiki", wikiArticleTitle: "foo_bar" })).toBe("eurth");
    expect(home("TROPHY", { wikiSource: "iiwiki", wikiArticleTitle: "Foo bar" })).toBe("eurth");
  });

  it("falls back by wiki: IxWiki or none to Ixnay, IIWiki and AltHistory to their system realms", () => {
    expect(home("LORE", { wikiSource: "ixwiki", wikiArticleTitle: "X" })).toBe("default");
    expect(home("LORE", { wikiSource: null, wikiArticleTitle: "X" })).toBe("default");
    expect(home("LORE", { wikiSource: "iiwiki", wikiArticleTitle: "Elsewhere" })).toBe("iiwiki");
    expect(home("LORE", { wikiSource: "althistory", wikiArticleTitle: "X" })).toBe("althistory");
    expect(wikiFallbackRealm("wikios")).toBe("default");
  });

  it("seeds the three system realms with their ids as slugs", () => {
    expect(SYSTEM_REALMS.map((r) => [r.id, r.slug])).toEqual([
      ["nationstates", "nationstates"],
      ["iiwiki", "iiwiki"],
      ["althistory", "althistory"],
    ]);
  });
});

describe("canonical titles and the Lore merge", () => {
  it("canonicalises titles so spellings of one page share a key", () => {
    expect(canonicalArticleTitle("battle_of_kiro", "ixwiki")).toBe("Battle of kiro");
    expect(articleKey("iiwiki", "foo_bar")).toBe(articleKey("iiwiki", "Foo bar"));
    expect(articleKey(null, "X")).toBe(articleKey("ixwiki", "X"));
    expect(articleKey("iiwiki", "X")).not.toBe(articleKey("ixwiki", "X"));
  });

  it("groups duplicate Lore cards; the survivor has the most copies, then is the oldest", () => {
    const base = { type: "LORE" as const, wikiSource: "iiwiki", createdAt: d("2026-01-01") };
    const groups = loreMergeGroups([
      { ...base, id: "a", wikiArticleTitle: "Foo bar", copies: 1, createdAt: d("2026-02-01") },
      { ...base, id: "b", wikiArticleTitle: "foo_bar", copies: 3 },
      { ...base, id: "c", wikiArticleTitle: "FOO BAR", copies: 3, createdAt: d("2025-12-01") },
      { ...base, id: "t", type: "TROPHY", wikiArticleTitle: "Foo bar", copies: 9 },
      { ...base, id: "solo", wikiArticleTitle: "Other", copies: 0 },
    ]);
    expect(groups).toEqual([
      { key: articleKey("iiwiki", "Foo bar"), survivorId: "c", loserIds: ["b", "a"] },
    ]);
  });

  it("renumbers moving copies after the survivor's highest serial, in acquisition order", () => {
    const copy = (id: string, serialNumber: number, at: string) => ({
      id,
      cardId: "loser",
      ownerId: "u",
      serialNumber,
      acquiredAt: d(at),
    });
    expect(renumberOnto(4, [copy("x", 1, "2026-03-01"), copy("y", 1, "2026-01-01")])).toEqual([
      { id: "y", serialNumber: 5 },
      { id: "x", serialNumber: 6 },
    ]);
  });

  it("renumbers serial collisions within a card: the earliest keeps the number", () => {
    const copy = (id: string, serialNumber: number, at: string) => ({
      id,
      cardId: "c",
      ownerId: "u",
      serialNumber,
      acquiredAt: d(at),
    });
    expect(
      renumberCollisions([
        copy("late", 1, "2026-02-01"),
        copy("early", 1, "2026-01-01"),
        copy("two", 2, "2026-01-05"),
      ])
    ).toEqual([{ id: "late", serialNumber: 3 }]);
  });
});

describe("NS facts and stat keys", () => {
  it("takes facts from stats first (kept freshest), then metadata.nsData, then the nsData column", () => {
    expect(
      legacyNsFacts({
        stats: { region: "Abydos", marketValue: "0.20", govt: "x" },
        metadata: { nsData: { name: "Heku", market_value: "0.05", region: "Old" } },
        nsData: { flag: "f.png", category: "Empire" },
        nsCardId: 7,
        nsSeason: 3,
      })
    ).toEqual({
      region: "Abydos",
      market_value: "0.20",
      name: "Heku",
      flag: "f.png",
      category: "Empire",
      id: "7",
      season: "3",
    });
  });

  it("drops loreStats and the legacy stats copy from metadata, and nothing else", () => {
    expect(withoutStatKeys({ loreStats: { a: 1 }, stats: {}, qualityScore: 50 })).toEqual({
      qualityScore: 50,
    });
    const untouched = { qualityScore: 50 };
    expect(withoutStatKeys(untouched)).toBe(untouched);
    expect(withoutStatKeys(null)).toBeNull();
  });
});

describe("import ledger inference", () => {
  const copy = (id: string, ownerId: string) => ({
    id,
    cardId: "card_ns_7_s3",
    ownerId,
    serialNumber: 1,
    acquiredAt: d("2026-01-01"),
    nsCardId: 7,
    nsSeason: 3,
  });

  it("records imported copies against their importer's verified nations, skipping pack and daily copies", () => {
    const result = inferImportLedger({
      copies: [
        copy("imp", "u_imp"),
        copy("pack", "u_imp"),
        copy("traded", "u_two"),
        copy("lost", "u_three"),
      ],
      transfers: [
        { ownershipId: "pack", action: "PACK_OPEN", fromUserId: null, createdAt: d("2026-01-01") },
        { ownershipId: "traded", action: "TRADE", fromUserId: "u_imp", createdAt: d("2026-02-01") },
      ],
      verifiedNations: new Map([["u_imp", ["heku", "new_heku"]]]),
      existing: new Set(["7:3:new_heku"]),
    });
    expect(result.rows).toEqual([
      { nsCardId: 7, nsSeason: 3, nation: "heku", userId: "u_imp", ownershipId: "imp" },
    ]);
    expect(result.unattributed).toBe(1);
  });
});
