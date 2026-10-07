/** @jest-environment node */
import type { SourceNation, SourceSnapshot } from "~/lib/realms/sources/adapters";
import { DEFAULT_SYNC_OPTIONS, type RealmSyncOverrides } from "~/lib/realms/sources/config";
import { matchSourceNations, normalizeNationName } from "~/lib/realms/sources/matching";
import { geometryHash, planSourceSync, type PlanCountry, type PlanInput } from "~/lib/realms/sources/plan";
import { newNationFields } from "~/lib/realms/sources/stats";

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
  ...over,
});

const square = (x: number) => ({
  type: "MultiPolygon" as const,
  coordinates: [[[[x, 0], [x + 1, 0], [x + 1, 1], [x, 1], [x, 0]]]],
});

const noOverrides: RealmSyncOverrides = { nations: {}, organizations: {} };

function input(
  over: Partial<Omit<PlanInput, "snapshot">> & { snapshot?: Partial<SourceSnapshot> } = {}
): PlanInput {
  const { snapshot, ...rest } = over;
  return {
    countries: [],
    rosterPages: [],
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

describe("normalizeNationName", () => {
  it("ignores case, accents, hyphens, underscores and URI encoding", () => {
    expect(normalizeNationName("Kíziáuke")).toBe("kiziauke");
    expect(normalizeNationName("Bainbridge-Islands")).toBe(normalizeNationName("Bainbridge_Islands"));
    expect(normalizeNationName("K%C3%ADzi%C3%A1uke")).toBe("kiziauke");
    expect(normalizeNationName("Ide-Jima")).toBe("ide jima");
  });
});

describe("matchSourceNations", () => {
  const countries = [
    { id: "c1", name: "Kíziáuke", wikiPageTitle: "Kíziáuke", externalSourceKey: null },
    { id: "c2", name: "Tavok", wikiPageTitle: "Tavok", externalSourceKey: "Tavok" },
  ];

  it("matches by stored key, then by name against countries, then roster pages; the rest are new", () => {
    const result = matchSourceNations(
      [nation("Tavok"), nation("Kiziauke", { wikiTitle: "Kíziáuke" }), nation("Bainbridge-Islands"), nation("Deseti")],
      countries,
      [{ title: "Bainbridge Islands" }],
      {}
    );
    expect(result.get("Tavok")).toEqual({ kind: "country", countryId: "c2", via: "key" });
    expect(result.get("Kiziauke")).toEqual({ kind: "country", countryId: "c1", via: "name" });
    expect(result.get("Bainbridge-Islands")).toEqual({ kind: "page", pageTitle: "Bainbridge Islands" });
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
    expect(two.get("Aurora")).toMatchObject({ kind: "ambiguous", candidates: [{ countryId: "a" }, { countryId: "b" }] });
  });

  it("follows staff decisions: a manual match wins, an excluded key is left out", () => {
    const result = matchSourceNations(
      [nation("Kiziauke"), nation("Deseti")],
      countries,
      [],
      { Kiziauke: { countryId: "c2" }, Deseti: { exclude: true } }
    );
    expect(result.get("Kiziauke")).toEqual({ kind: "country", countryId: "c2", via: "override" });
    expect(result.get("Deseti")).toEqual({ kind: "excluded" });
  });
});

describe("planSourceSync", () => {
  it("creates map nations and roster-only pages, naming a matched roster nation after its page", () => {
    const plan = planSourceSync(
      input({
        snapshot: { nations: [nation("Bainbridge-Islands"), nation("Deseti", { wikiTitle: null })] },
        rosterPages: [{ title: "Bainbridge Islands" }, { title: "Rostervania" }],
        continentMap: { Deseti: "Europa" },
      })
    );
    expect(plan.creates.map((c) => [c.name, c.key, c.from])).toEqual([
      ["Bainbridge Islands", "Bainbridge-Islands", "source"],
      ["Deseti", "Deseti", "source"],
      ["Rostervania", null, "roster"],
    ]);
    expect(plan.creates[1]).toMatchObject({ continent: "Europa", wikiTitle: null, readInfobox: false });
    expect(plan.creates[0]!.readInfobox).toBe(true);
  });

  it("uses the traced area only when the source states no land area", () => {
    const plan = planSourceSync(
      input({
        snapshot: {
          nations: [nation("A", { landArea: null }), nation("B")],
          features: [
            { key: "A", geometry: square(0), areaKm2: 6895 },
            { key: "B", geometry: square(2), areaKm2: 99 },
          ],
        },
      })
    );
    expect(plan.creates.find((c) => c.key === "A")!.landArea).toBe(6895);
    expect(plan.creates.find((c) => c.key === "B")!.landArea).toBe(50_000);
    expect(plan.features.find((f) => f.key === "A")!.setLandArea).toBe(true);
    expect(plan.features.find((f) => f.key === "B")!.setLandArea).toBe(false);
  });

  it("updates unclaimed nations' figures but leaves claimed nations alone by default", () => {
    const snapshot = { nations: [nation("Free", { population: 2_000_000 }), nation("Owned", { population: 3_000_000 })] };
    const countries = [
      country("f", "Free", { externalSourceKey: "Free" }),
      country("o", "Owned", { externalSourceKey: "Owned", ownerUserId: "u1" }),
    ];
    const plan = planSourceSync(input({ snapshot, countries }));
    expect(plan.updates).toEqual([
      expect.objectContaining({ countryId: "f", changes: [{ field: "population", from: 1_000_000, to: 2_000_000 }] }),
    ]);
    expect(plan.skippedClaimed).toEqual([{ countryId: "o", name: "Owned", fields: ["population"] }]);

    const both = planSourceSync(input({ snapshot, countries, options: { ...DEFAULT_SYNC_OPTIONS, updateClaimedStats: true } }));
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
        countries: [country("k", "Kept", { externalSourceKey: "Kept" }), country("g", "Gone", { externalSourceKey: "Gone" })],
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

  it("keeps new entries out when adding new nations is off, and lists them for staff", () => {
    const plan = planSourceSync(
      input({ snapshot: { nations: [nation("New")] }, options: { ...DEFAULT_SYNC_OPTIONS, addNewNations: false } })
    );
    expect(plan.creates).toEqual([]);
    expect(plan.unmatched[0]).toMatchObject({ key: "New", reason: expect.stringContaining("off") });
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
          { featureId: "A", countryId: "a", sourceHash: geometryHash(geometry) },
          { featureId: "B", countryId: "someone-else", sourceHash: "old" },
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

  it("creates realm alliances with members, types them by the rules unless staff chose, and reports unknown members", () => {
    const plan = planSourceSync(
      input({
        snapshot: {
          nations: [nation("A"), nation("B")],
          organizations: [
            { key: "pact", name: "Some Pact", shortName: "SP", color: "#ff0000", members: ["A", "B", "Haitu"], suggestedType: "military" },
            { key: "club", name: "Club", shortName: null, color: null, members: ["A"], suggestedType: "political" },
          ],
        },
        countries: [country("a", "A", { externalSourceKey: "A" })],
        alliances: [
          { id: "al1", name: "Club", shortName: null, color: "#6366f1", type: "political", externalSourceKey: null, activeMemberIds: ["a", "x"] },
        ],
        overrides: { nations: {}, organizations: { club: { type: "regional" } } },
      })
    );
    const pact = plan.alliances.find((a) => a.key === "pact")!;
    expect(pact).toMatchObject({ allianceId: null, type: "military", name: "Some Pact", shortName: "SP" });
    expect(pact.addMembers.map((m) => m.name)).toEqual(["A", "B"]);
    expect(plan.unknownMembers).toEqual([
      { organization: "Some Pact", member: "Haitu", reason: "No nation of that key in the source" },
    ]);
    const club = plan.alliances.find((a) => a.key === "club")!;
    expect(club).toMatchObject({ allianceId: "al1", type: "regional", addMembers: [], notInSource: ["x"] });
    expect(club.changes).toEqual(expect.arrayContaining(["type", "key"]));
  });

  it("is idempotent: a second plan over the written state changes nothing", () => {
    const geometry = square(0);
    const plan = planSourceSync(
      input({
        snapshot: { nations: [nation("A")], features: [{ key: "A", geometry, areaKm2: 5 }] },
        countries: [country("a", "A", { externalSourceKey: "A" })],
        features: [{ featureId: "A", countryId: "a", sourceHash: geometryHash(geometry) }],
        linkedFeatureByCountry: { a: "A" },
      })
    );
    expect(plan.creates).toEqual([]);
    expect(plan.updates).toEqual([]);
    expect(plan.features).toEqual([]);
  });
});

describe("newNationFields: precedence for a created nation", () => {
  const planned = {
    name: "Deseti",
    key: "Deseti",
    from: "source" as const,
    wikiTitle: "Deseti",
    officialName: null,
    capital: "Map Capital",
    population: 5_000_000,
    gdpPerCapita: null,
    landArea: null,
    continent: "Europa",
    readInfobox: true,
  };

  it("takes the map's figures first, then the infobox's, then leaves the rest to the defaults", () => {
    const fields = newNationFields(planned, {
      country: { baselinePopulation: 9, baselineGdpPerCapita: 31_000, flag: "https://x/flag.png", leader: "Someone" },
      identity: { capitalCity: "Wiki Capital", officialName: "Commonwealth of Deseti", motto: "Onward" },
    });
    expect(fields.initial).toEqual({
      baselinePopulation: 5_000_000,
      baselineGdpPerCapita: 31_000,
      continent: "Europa",
      flag: "https://x/flag.png",
      leader: "Someone",
    });
    expect(fields.initial.landArea).toBeUndefined();
    expect(fields.identity).toEqual({
      capitalCity: "Map Capital",
      officialName: "Commonwealth of Deseti",
      motto: "Onward",
    });
  });

  it("without an infobox gives only the map's values", () => {
    expect(newNationFields(planned, null)).toEqual({
      initial: { baselinePopulation: 5_000_000, continent: "Europa" },
      identity: { capitalCity: "Map Capital" },
    });
  });
});
