/** @jest-environment node */
import { loreImportOptions } from "~/lib/realms/lore-import";
import {
  REALM_WIKI_SOURCES,
  realmWikiMap,
  realmWikiSettings,
  realmWikiSettingsSchema,
  withRealmWikiMap,
  withRealmWikiSettings,
  type RealmWikiMap,
} from "~/lib/realms/realm-wiki-settings";
import { sourcePreset } from "~/lib/realms/sources/presets";
import { SISTER_WIKI_HOSTS } from "~/lib/wiki-os/wiki-hosts";

const EURTH_WIKI = {
  source: "iiwiki" as const,
  rootCategory: "Category:Eurth",
  keyword: "Eurth",
  rosterCategory: "Category:Countries (Eurth)",
  portalTitle: "Portal:Eurth",
  mapCategories: [] as string[],
};

const parse = (input: Record<string, unknown>) => realmWikiSettingsSchema.safeParse(input);
const base = { source: "iiwiki", rootCategory: "Category:Eurth", keyword: "Eurth" };

describe("realm wiki settings validation", () => {
  it("accepts the Eurth values and fills the optional ones", () => {
    expect(parse(base)).toMatchObject({
      success: true,
      data: { ...base, rosterCategory: null, portalTitle: null, mapCategories: [] },
    });
  });

  it("normalizes titles the way MediaWiki spells them", () => {
    const result = parse({
      ...base,
      rootCategory: "category: eurth",
      rosterCategory: "Category:Countries_(Eurth)",
      portalTitle: "portal:Eurth",
      mapCategories: ["category:Maps  of Eurth"],
    });
    expect(result.success && result.data).toMatchObject({
      rootCategory: "Category:Eurth",
      rosterCategory: "Category:Countries (Eurth)",
      portalTitle: "Portal:Eurth",
      mapCategories: ["Category:Maps of Eurth"],
    });
  });

  it.each<[Record<string, unknown>, string]>([
    [{ ...base, source: "ixwiki" }, "IxWiki is IxWorld's and never crawled"],
    [{ ...base, source: "https://evil.example" }, "a wiki is named by id, never by URL"],
    [{ ...base, rootCategory: "Eurth" }, "the root must be a category"],
    [{ ...base, rootCategory: "Category:" }, "an empty category name"],
    [{ ...base, rootCategory: "Category:Eurth|x" }, "characters MediaWiki forbids"],
    [{ ...base, keyword: "  " }, "an empty keyword"],
    [{ ...base, rosterCategory: "Category:Retired countries (Eurth)" }, "a retired roster"],
    [{ ...base, mapCategories: Array.from({ length: 6 }, (_, i) => `Category:M${i}`) }, "too many map categories"],
  ])("refuses %j (%s)", (input) => {
    expect(parse(input).success).toBe(false);
  });

  it("offers every sister wiki WikiOS reads, and only those", () => {
    const readers = Object.entries(SISTER_WIKI_HOSTS)
      .filter(([, host]) => host.reader)
      .map(([id]) => id);
    expect([...REALM_WIKI_SOURCES]).toEqual(readers);
    expect(REALM_WIKI_SOURCES).not.toContain("commons");
  });

  it("ships Eurth's values in the eurth-map preset", () => {
    expect(sourcePreset("eurth-map")?.wiki).toEqual(EURTH_WIKI);
  });
});

describe("reading and writing Realm.settings", () => {
  it("keeps every other key when the wiki is set or cleared", () => {
    const stored = { maxNationsPerUser: 3, inWorldDate: { kind: "fixed", label: "Year 1" } };
    const withWiki = withRealmWikiSettings(stored, EURTH_WIKI);
    expect(withWiki).toEqual({ ...stored, wiki: EURTH_WIKI });
    expect(realmWikiSettings(withWiki)).toEqual(EURTH_WIKI);
    expect(withRealmWikiSettings(withWiki, null)).toEqual(stored);
  });

  it("reads nothing from a missing or malformed value", () => {
    expect(realmWikiSettings(null)).toBeNull();
    expect(realmWikiSettings({ wiki: { source: "iiwiki" } })).toBeNull();
    expect(realmWikiSettings(["not", "an", "object"])).toBeNull();
  });

  it("stores the chosen map under settings.map, keeping other map keys", () => {
    const map: RealmWikiMap = {
      source: { wiki: "iiwiki", fileTitle: "File:Eurth political map 2024.png", sha1: "a".repeat(40) },
      attribution: "Map by Cartographer, CC BY-SA 4.0, via IIWiki",
      file: {
        width: 8192,
        height: 4096,
        size: 9876543,
        mime: "image/png",
        licence: "CC BY-SA 4.0",
        descriptionUrl: "https://iiwiki.com/wiki/File:Eurth_political_map_2024.png",
        chosenAt: "2026-10-07T12:00:00.000Z",
        chosenBy: "clerk_founder",
        checkedAt: null,
      },
    };
    const settings = withRealmWikiMap({ maxNationsPerUser: 2, map: { projection: "equirectangular" } }, map);
    expect(settings).toMatchObject({
      maxNationsPerUser: 2,
      map: { projection: "equirectangular", source: map.source, attribution: map.attribution },
    });
    expect(realmWikiMap(settings)).toEqual(map);
    expect(realmWikiMap({ map: { source: { wiki: "iiwiki", fileTitle: "File:X.png", sha1: "nope" } } })).toBeNull();
  });
});

describe("import-realm-lore defaults from the realm's wiki settings", () => {
  it("fills every option from the settings, so --realm alone is enough", () => {
    expect(loreImportOptions({}, EURTH_WIKI)).toEqual({
      source: "iiwiki",
      category: "Category:Eurth",
      keyword: "Eurth",
      roster: "Category:Countries (Eurth)",
    });
  });

  it("lets a flag win over the settings", () => {
    expect(loreImportOptions({ keyword: "Eurthian", roster: "Category:Nations (Eurth)" }, EURTH_WIKI)).toMatchObject({
      category: "Category:Eurth",
      keyword: "Eurthian",
      roster: "Category:Nations (Eurth)",
    });
  });

  it("does not apply one wiki's settings to another wiki", () => {
    expect(() => loreImportOptions({ source: "althistory" }, EURTH_WIKI)).toThrow("missing --category, --keyword");
  });

  it("asks for what is missing when the realm has no wiki settings", () => {
    expect(() => loreImportOptions({ source: "iiwiki" }, null)).toThrow(/missing --category, --keyword.*Wiki/);
    expect(loreImportOptions({ source: "iiwiki", category: "Category:X", keyword: "X" }, null)).toEqual({
      source: "iiwiki",
      category: "Category:X",
      keyword: "X",
      roster: undefined,
    });
  });
});
