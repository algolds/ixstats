import { CORE_FEATURES } from "~/components/halo/halo-registry";
import type { CountrySummary, SearchFilter } from "~/components/halo/types";
import {
  buildIndex,
  commandEntriesFor,
  searchCatalog,
  type SearchSources,
  type WikiSearchItem,
} from "~/lib/halo/search";

function buildCountries(): CountrySummary[] {
  const matching: CountrySummary[] = Array.from({ length: 14 }, (_, index) => ({
    id: `c${index}`,
    name: `Eastmark ${index}`,
    slug: `eastmark-${index}`,
    economicTier: "Developed",
    flagUrl: `/flags/eastmark-${index}.png`,
  }));
  return [
    ...matching.slice(0, 2),
    { id: "other", name: "Brava", slug: "brava", economicTier: "Emerging", flagUrl: "/b.png" },
    ...matching.slice(2),
  ];
}

function buildWiki(count: number): WikiSearchItem[] {
  return Array.from({ length: count }, (_, index) => ({
    title: `Stonebridge ${index}`,
    snippet: `About <b>Stonebridge ${index}</b>`,
  }));
}

function makeSources({
  isAdmin = false,
  signedIn = false,
  pathname = "/",
  countries = buildCountries(),
  wiki = buildWiki(5),
}: {
  isAdmin?: boolean;
  signedIn?: boolean;
  pathname?: string | null;
  countries?: CountrySummary[];
  wiki?: WikiSearchItem[];
} = {}): SearchSources {
  return {
    countries: buildIndex(countries),
    commands: buildIndex(commandEntriesFor({ isAdmin, signedIn, pathname })),
    features: buildIndex(CORE_FEATURES),
    wiki,
  };
}

const titles = (items: Array<{ title: string }>) => items.map((i) => i.title);
const kinds = (items: Array<{ kind: string }>) => items.map((i) => i.kind);

describe("Halo pure search (src/lib/halo/search)", () => {
  it("returns empty array for empty or whitespace queries", () => {
    const sources = makeSources();
    expect(searchCatalog("", "all", sources, { wikiFirst: false })).toEqual([]);
    expect(searchCatalog("   ", "all", sources, { wikiFirst: false })).toEqual([]);
  });

  it("returns nothing when no entry matches and wiki is empty", () => {
    const sources = makeSources({ wiki: [] });
    expect(searchCatalog("zzzzqq", "all", sources, { wikiFirst: false })).toEqual([]);
  });

  it("limits each type to 3 under filter 'all' in order countries, commands, features, wiki", () => {
    const results = searchCatalog("st", "all", makeSources(), { wikiFirst: false });
    expect(results).toHaveLength(12);
    expect(kinds(results)).toEqual([
      ...Array(3).fill("country"),
      ...Array(3).fill("command"),
      ...Array(3).fill("feature"),
      ...Array(3).fill("wiki"),
    ]);
    expect(titles(results.filter((r) => r.kind === "country"))).toEqual([
      "Eastmark 0",
      "Eastmark 1",
      "Eastmark 2",
    ]);
    expect(titles(results.filter((r) => r.kind === "feature"))).toEqual([
      "Refresh data",
      "Notifications",
      "Search",
    ]);
    expect(titles(results.filter((r) => r.kind === "wiki"))).toEqual([
      "Stonebridge 0",
      "Stonebridge 1",
      "Stonebridge 2",
    ]);
  });

  it("puts wiki results first under filter 'all' when wikiFirst is true", () => {
    const results = searchCatalog("st", "all", makeSources(), { wikiFirst: true });
    expect(results).toHaveLength(12);
    expect(kinds(results)).toEqual([
      ...Array(3).fill("wiki"),
      ...Array(3).fill("country"),
      ...Array(3).fill("command"),
      ...Array(3).fill("feature"),
    ]);
  });

  it("lists up to 12 entries of a single type under dedicated filters", () => {
    const sources = makeSources({ wiki: buildWiki(15) });
    for (const [filter, expectedKind, expectedCount] of [
      ["countries", "country", 12],
      ["commands", "command", 12],
      ["features", "feature", 3],
      ["wiki", "wiki", 12],
    ] as Array<[SearchFilter, string, number]>) {
      const results = searchCatalog("st", filter, sources, { wikiFirst: false });
      expect(results).toHaveLength(expectedCount);
      expect(new Set(kinds(results))).toEqual(new Set([expectedKind]));
    }
  });

  it("matches case-insensitively and by substring", () => {
    const sources = makeSources();
    expect(searchCatalog("EASTM", "countries", sources, { wikiFirst: false })).toHaveLength(12);
    expect(titles(searchCatalog("rava", "countries", sources, { wikiFirst: false }))).toEqual([
      "Brava",
    ]);
  });

  it("describes a country descriptor with tier, flagUrl, slug, and path", () => {
    const [first] = searchCatalog("st", "countries", makeSources(), { wikiFirst: false });
    expect(first).toMatchObject({
      kind: "country",
      key: "country-c0",
      title: "Eastmark 0",
      description: "Tier: Developed",
      category: "Country",
      flagUrl: "/flags/eastmark-0.png",
      economicTier: "Developed",
      slug: "eastmark-0",
      path: "/countries/eastmark-0",
    });
  });

  it("strips HTML markup from wiki snippets and falls back when absent", () => {
    const sources = makeSources({
      wiki: [{ title: "Plain Record" }, { title: "Marked up", snippet: "<i>x</i> y" }],
    });
    const results = searchCatalog("st", "wiki", sources, { wikiFirst: false });
    expect(results.map((r) => r.description)).toEqual(["Wiki article", "x y"]);
    expect(results[0]?.path).toBe("/wiki/Plain_Record");
  });

  it("offers no wiki results for a one-character query", () => {
    const results = searchCatalog("e", "all", makeSources(), { wikiFirst: false });
    expect(kinds(results)).not.toContain("wiki");
  });

  it("surfaces Sign in under filter 'all' for signed-out viewer typing 'sign'", () => {
    const sources = makeSources({ signedIn: false, countries: [], wiki: [] });
    const results = searchCatalog("sign", "all", sources, { wikiFirst: false });
    expect(titles(results)).toContain("Sign in");
    expect(titles(results)).toContain("Sign up");
    expect(titles(results)).not.toContain("Sign out");
  });

  it("offers Sign out when signed in, gates Admin panel on isAdmin, and adds Country profile on /countries/<id>", () => {
    const signedInSources = makeSources({ signedIn: true, countries: [], wiki: [] });
    expect(titles(searchCatalog("sign", "all", signedInSources, { wikiFirst: false }))).toContain(
      "Sign out"
    );
    expect(
      titles(searchCatalog("sign", "commands", signedInSources, { wikiFirst: false }))
    ).not.toContain("Sign in");

    expect(
      titles(searchCatalog("admin", "all", makeSources({ isAdmin: false }), { wikiFirst: false }))
    ).not.toContain("Admin panel");
    expect(
      titles(searchCatalog("admin", "all", makeSources({ isAdmin: true }), { wikiFirst: false }))
    ).toContain("Admin panel");

    const onCountry = makeSources({ pathname: "/countries/abc" });
    const profile = searchCatalog("profile", "commands", onCountry, { wikiFirst: false }).find(
      (r) => r.title === "Country profile"
    );
    expect(profile?.key).toBe("command-/countries/abc");
    expect(profile?.path).toBe("/countries/abc");

    for (const p of ["/", "/countries/new", "/countries/"]) {
      expect(
        titles(
          searchCatalog("profile", "commands", makeSources({ pathname: p }), { wikiFirst: false })
        )
      ).not.toContain("Country profile");
    }
  });

  it("generates unique keys within 'all' and single-type filter results", () => {
    const sources = makeSources({ wiki: buildWiki(15) });
    for (const filter of ["all", "countries", "commands", "wiki"] as const) {
      const keys = searchCatalog("st", filter, sources, { wikiFirst: false }).map((r) => r.key);
      expect(keys.length).toBeGreaterThan(0);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });
});
