/** @jest-environment node */
import type { SourceNation, SourceSnapshot } from "~/lib/realms/sources/adapters";
import { DEFAULT_SYNC_OPTIONS, type RealmSyncOverrides } from "~/lib/realms/sources/config";
import { matchSourceNations } from "~/lib/realms/sources/matching";
import {
  geometryHash,
  planSourceSync,
  type PlanCountry,
  type PlanInput,
} from "~/lib/realms/sources/plan";
import { wikiTitleFromLink } from "~/lib/realms/sources/adapters/js-nation-table";
const nation = (key: string, over: Partial<SourceNation> = {}): SourceNation => ({
  key,
  displayName: key.replace(/-/g, " "),
  wikiTitle: key.replace(/-/g, " "),
  officialName: `Republic of ${key}`,
  population: 1_000_000,
  gdpPerCapita: 20_000,
  landArea: 50_000,
  capital: `${key} City`,
  color: "#123456",
  secondary: [],
  ...over,
});

const country = (id: string, name: string, over: Partial<PlanCountry> = {}): PlanCountry => ({
  id,
  name,
  ownerUserId: null,
  externalSourceKey: null,
  wikiPageTitle: name,
  baselinePopulation: 1_000_000,
  baselineGdpPerCapita: 20_000,
  landArea: 50_000,
  continent: null,
  capital: `${name} City`,
  officialName: `Republic of ${name}`,
  wikiSource: "iiwiki",
  infoboxEmpty: false,
  ...over,
});

const square = (x: number) => ({
  type: "MultiPolygon" as const,
  coordinates: [
    [
      [
        [x, 0],
        [x + 1, 0],
        [x + 1, 1],
        [x, 1],
        [x, 0],
      ],
    ],
  ],
});

const noOverrides: RealmSyncOverrides = { nations: {}, organizations: {} };

function input(
  over: Partial<Omit<PlanInput, "snapshot">> & { snapshot?: Partial<SourceSnapshot> } = {}
): PlanInput {
  const { snapshot, ...rest } = over;
  return {
    countries: [],
    rosterPages: [],
    realmPageTitles: [],
    features: [],
    alliances: [],
    linkedFeatureByCountry: {},
    options: DEFAULT_SYNC_OPTIONS,
    overrides: noOverrides,
    continentMap: {},
    wikiSource: "iiwiki",
    ...rest,
    snapshot: { nations: [], organizations: [], features: [], warnings: [], ...snapshot },
  };
}

describe("matchSourceNations", () => {
  const countries = [
    { id: "c1", name: "Kíziáuke", wikiPageTitle: "Kíziáuke", externalSourceKey: null },
    { id: "c2", name: "Tavok", wikiPageTitle: "Tavok", externalSourceKey: "Tavok" },
  ];

  it("matches by stored key, then by name against countries, then roster pages; the rest are new", () => {
    const result = matchSourceNations(
      [
        nation("Tavok"),
        nation("Kiziauke", { wikiTitle: "Kíziáuke" }),
        nation("Bainbridge-Islands"),
        nation("Deseti"),
      ],
      countries,
      [{ title: "Bainbridge Islands" }],
      {}
    );
    expect(result.get("Tavok")).toEqual({ kind: "country", countryId: "c2", via: "key" });
    expect(result.get("Kiziauke")).toEqual({ kind: "country", countryId: "c1", via: "name" });
    expect(result.get("Bainbridge-Islands")).toEqual({
      kind: "page",
      pageTitle: "Bainbridge Islands",
    });
    expect(result.get("Deseti")).toEqual({ kind: "new" });
  });

  it("reports two entries on one nation, or one entry on two nations, as ambiguous", () => {
    const shared = matchSourceNations(
      [nation("Ide-Jima"), nation("Ide_Jima", { displayName: "Ide Jima", wikiTitle: null })],
      [{ id: "c3", name: "Ide Jima", wikiPageTitle: null, externalSourceKey: null }],
      [],
      {}
    );
    expect(shared.get("Ide-Jima")?.kind).toBe("ambiguous");
    expect(shared.get("Ide_Jima")?.kind).toBe("ambiguous");
    const two = matchSourceNations(
      [nation("Aurora")],
      [
        { id: "a", name: "Aurora", wikiPageTitle: null, externalSourceKey: null },
        { id: "b", name: "Auróra", wikiPageTitle: null, externalSourceKey: null },
      ],
      [],
      {}
    );
    expect(two.get("Aurora")).toMatchObject({
      kind: "ambiguous",
      candidates: [{ countryId: "a" }, { countryId: "b" }],
    });
  });
  it("prefers an exact name over a qualified one, and never matches two different qualifiers", () => {
    const result = matchSourceNations(
      [
        nation("Nanto"),
        nation("Congo-B", { displayName: "Congo (Brazzaville)", wikiTitle: "Congo (Brazzaville)" }),
      ],
      [
        { id: "n1", name: "Nanto", wikiPageTitle: null, externalSourceKey: null },
        { id: "n2", name: "Nanto (Eurth)", wikiPageTitle: null, externalSourceKey: null },
        { id: "k", name: "Congo (Kinshasa)", wikiPageTitle: null, externalSourceKey: null },
      ],
      [],
      {}
    );
    expect(result.get("Nanto")).toEqual({ kind: "country", countryId: "n1", via: "name" });
    expect(result.get("Congo-B")).toEqual({ kind: "new" });
  });

  it("follows staff decisions: a manual match wins, an excluded key is left out", () => {
    const result = matchSourceNations([nation("Kiziauke"), nation("Deseti")], countries, [], {
      Kiziauke: { countryId: "c2" },
      Deseti: { exclude: true },
    });
    expect(result.get("Kiziauke")).toEqual({ kind: "country", countryId: "c2", via: "override" });
    expect(result.get("Deseti")).toEqual({ kind: "excluded" });
  });
});

describe("planSourceSync", () => {
  it("keeps a map entry's wiki link only when it is one of the realm's pages, and warns otherwise", () => {
    const plan = planSourceSync(
      input({
        snapshot: {
          nations: [
            nation("Tavok", { wikiTitle: "tavok" }),
            nation("Elsewhere", { wikiTitle: "Elsewhere (Other World)" }),
          ],
        },
        realmPageTitles: ["Tavok", "History of Tavok"],
      })
    );
    expect(plan.creates.find((c) => c.key === "Tavok")).toMatchObject({
      wikiTitle: "Tavok",
      readInfobox: true,
    });
    expect(plan.creates.find((c) => c.key === "Elsewhere")).toMatchObject({
      wikiTitle: null,
      readInfobox: false,
    });
    expect(plan.warnings).toEqual([
      expect.stringMatching(
        /Elsewhere: its wiki link "Elsewhere \(Other World\)" is not one of the realm's pages/
      ),
    ]);
  });

  it("follows a wiki link's redirect to a realm page, and never creates that roster page a second time", () => {
    const plan = planSourceSync(
      input({
        snapshot: {
          nations: [
            nation("Salvia", { wikiTitle: "Salvia" }),
            nation("Deseti", { wikiTitle: "Deseti" }),
          ],
        },
        rosterPages: [{ title: "Sanctum Imperium Catholicum" }],
        realmPageTitles: ["Sanctum Imperium Catholicum"],
        // Deseti redirects to a page outside the realm: still no wiki page.
        wikiRedirects: { Salvia: "Sanctum Imperium Catholicum", Deseti: "Orioni" },
      })
    );
    expect(plan.creates.map((c) => [c.name, c.from, c.wikiTitle])).toEqual([
      ["Salvia", "source", "Sanctum Imperium Catholicum"],
      ["Deseti", "source", null],
    ]);
    expect(plan.warnings).toEqual([
      expect.stringMatching(/Deseti: its wiki link "Deseti" is not one of the realm's pages/),
    ]);
  });

  it("never follows a redirect onto a page another nation lands on (a region folded into that nation)", () => {
    const plan = planSourceSync(
      input({
        snapshot: {
          nations: [
            nation("Orioni", { wikiTitle: "Orioni" }),
            nation("Deseti", { wikiTitle: "Deseti" }),
            nation("Elbenau", { wikiTitle: "Elbenau" }),
            nation("Veldoria", { wikiTitle: "Veldoria" }),
          ],
        },
        realmPageTitles: ["Orioni", "Velaheria"],
        wikiRedirects: { Deseti: "Orioni", Elbenau: "Velaheria", Veldoria: "Velaheria" },
      })
    );
    expect(plan.creates.map((c) => [c.name, c.wikiTitle])).toEqual([
      ["Orioni", "Orioni"],
      ["Deseti", null],
      ["Elbenau", null],
      ["Veldoria", null],
    ]);
    expect(plan.warnings).toEqual([
      expect.stringMatching(/Deseti: its wiki link "Deseti" redirects to "Orioni"/),
      expect.stringMatching(/Elbenau: its wiki link "Elbenau" redirects to "Velaheria"/),
      expect.stringMatching(/Veldoria: its wiki link "Veldoria" redirects to "Velaheria"/),
    ]);
  });
  it("updates unclaimed nations' figures but leaves claimed nations alone by default", () => {
    const snapshot = {
      nations: [
        nation("Free", { population: 2_000_000 }),
        nation("Owned", { population: 3_000_000 }),
      ],
    };
    const countries = [
      country("f", "Free", { externalSourceKey: "Free" }),
      country("o", "Owned", { externalSourceKey: "Owned", ownerUserId: "u1" }),
    ];
    const plan = planSourceSync(input({ snapshot, countries }));
    expect(plan.updates).toEqual([
      expect.objectContaining({
        countryId: "f",
        changes: [{ field: "population", from: 1_000_000, to: 2_000_000 }],
      }),
    ]);
    expect(plan.skippedClaimed).toEqual([
      { countryId: "o", name: "Owned", fields: ["population"] },
    ]);

    const both = planSourceSync(
      input({ snapshot, countries, options: { ...DEFAULT_SYNC_OPTIONS, updateClaimedStats: true } })
    );
    expect(both.updates.map((u) => u.countryId)).toEqual(["f", "o"]);
    expect(both.skippedClaimed).toEqual([]);
  });

  it("never changes a field staff pinned, and lists it", () => {
    const plan = planSourceSync(
      input({
        snapshot: { nations: [nation("Free", { population: 2_000_000, capital: "New Capital" })] },
        countries: [country("f", "Free", { externalSourceKey: "Free" })],
        overrides: { nations: { Free: { lockedFields: ["population"] } }, organizations: {} },
      })
    );
    expect(plan.updates[0]!.changes.map((c) => c.field)).toEqual(["capital"]);
    expect(plan.locked).toEqual([{ countryId: "f", name: "Free", fields: ["population"] }]);
  });

  it("flags nations the source no longer lists and never plans to delete anything", () => {
    const plan = planSourceSync(
      input({
        snapshot: { nations: [nation("Kept")] },
        countries: [
          country("k", "Kept", { externalSourceKey: "Kept" }),
          country("g", "Gone", { externalSourceKey: "Gone" }),
        ],
      })
    );
    expect(plan.missing).toEqual([{ countryId: "g", name: "Gone", key: "Gone" }]);
    expect(Object.keys(plan)).not.toContain("deletes");
    const ignored = planSourceSync(
      input({
        snapshot: { nations: [nation("Kept")] },
        countries: [country("g", "Gone", { externalSourceKey: "Gone" })],
        options: { ...DEFAULT_SYNC_OPTIONS, missingNations: "ignore" },
      })
    );
    expect(ignored.missing).toEqual([]);
  });
  it("writes only changed borders, links them, and never takes another nation's region", () => {
    const geometry = square(0);
    const plan = planSourceSync(
      input({
        snapshot: {
          nations: [nation("A"), nation("B"), nation("C")],
          features: [
            { key: "A", geometry, areaKm2: 10 },
            { key: "B", geometry: square(2), areaKm2: 10 },
            { key: "C", geometry: square(4), areaKm2: 10 },
            { key: "Orphan", geometry: square(6), areaKm2: 10 },
          ],
        },
        countries: [
          country("a", "A", { externalSourceKey: "A" }),
          country("b", "B", { externalSourceKey: "B" }),
          country("c", "C", { externalSourceKey: "C" }),
        ],
        features: [
          { featureId: "A", countryId: "a", sourceHash: geometryHash(geometry), fill: "#123456" },
          { featureId: "B", countryId: "someone-else", sourceHash: "old", fill: "#123456" },
        ],
        linkedFeatureByCountry: { a: "A", c: "C-from-a-png" },
      })
    );
    expect(plan.featuresUnchanged).toBe(1);
    expect(plan.features.map((f) => [f.key, f.action, f.nation])).toEqual([
      ["B", "update", null],
      ["C", "create", null],
      ["Orphan", "create", null],
    ]);
    expect(plan.warnings.join(" ")).toMatch(/B: not linked/);
    expect(plan.warnings.join(" ")).toMatch(/already has region C-from-a-png/);
  });
  it("is idempotent: a second plan over the written state changes nothing", () => {
    const geometry = square(0);
    const plan = planSourceSync(
      input({
        snapshot: { nations: [nation("A")], features: [{ key: "A", geometry, areaKm2: 5 }] },
        countries: [country("a", "A", { externalSourceKey: "A" })],
        features: [
          { featureId: "A", countryId: "a", sourceHash: geometryHash(geometry), fill: "#123456" },
        ],
        linkedFeatureByCountry: { a: "A" },
      })
    );
    expect(plan.creates).toEqual([]);
    expect(plan.updates).toEqual([]);
    expect(plan.features).toEqual([]);
  });
});

describe("helpers", () => {
  it("wikiTitleFromLink only reads links on the realm wiki's prefixes, decoding them", () => {
    const prefixes = ["https://iiwiki.com/w/"];
    expect(wikiTitleFromLink("https://iiwiki.com/w/Nova_Occidentalis", prefixes)).toBe(
      "Nova Occidentalis"
    );
    expect(wikiTitleFromLink("https://iiwiki.com/w/K%C3%ADzi%C3%A1uke?x=1#top", prefixes)).toBe(
      "Kíziáuke"
    );
    expect(wikiTitleFromLink("https://evil.example/w/Tavok", prefixes)).toBeNull();
    expect(wikiTitleFromLink(null, prefixes)).toBeNull();
  });
});
