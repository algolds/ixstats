/** @jest-environment node */
import fs from "node:fs";
import path from "node:path";
import { sourceAdapter } from "~/lib/realms/sources/adapters";
import {
  allianceTypeFor,
  jsNationTableAdapter,
  splitAcronym,
  wikiTitleFromLink,
  type JsNationTableSettings,
} from "~/lib/realms/sources/adapters/js-nation-table";
import { sourcePreset, SOURCE_PRESETS } from "~/lib/realms/sources/presets";

const FIXTURES = path.resolve(__dirname, "../../../fixtures/realm-sources/eurth-map");
const read = (name: string) => fs.readFileSync(path.join(FIXTURES, name), "utf8");
const settings = jsNationTableAdapter.settingsSchema.parse(
  sourcePreset("eurth-map")!.settings
) as JsNationTableSettings;
const files = {
  nations: read("nations.js"),
  organizations: read("organizations.js"),
  borders: read("nations.geojson"),
};

describe("the eurth-map preset", () => {
  it("is the only place the Eurth values live, and its settings validate", () => {
    const preset = sourcePreset("eurth-map")!;
    expect(preset).toMatchObject({
      repo: "a-seth-harrison/eurth-map",
      ref: "main",
      format: "eurth-map",
    });
    expect(settings.files).toEqual({
      nations: "eurth-map/src/data/nations.js",
      organizations: "eurth-map/src/data/organizations.js",
      borders: "eurth-map/public/nations.geojson",
    });
    expect(settings.attribution).toBe("Map: Eurth community, via eurth-map by Seth Harrison");
    expect(SOURCE_PRESETS.map((p) => p.id)).toEqual(["eurth-map"]);
  });

  it("carries the continent guesses, free text, with unknowns left out", () => {
    const map = sourcePreset("eurth-map")!.continentMap!;
    expect(Object.keys(map)).toHaveLength(115);
    expect(map.Variota).toBe("Alharu");
    expect(map["Rupes-Nigra"]).toBe("Europa");
    expect(Object.values(map).every((c) => c.trim().length > 0)).toBe(true);
  });
});

describe("the eurth-map adapter", () => {
  it("is registered under its format id, and its files come from the realm's settings", () => {
    expect(sourceAdapter("eurth-map")).toBe(jsNationTableAdapter);
    expect(sourceAdapter("unknown")).toBeNull();
    const custom = { ...settings, files: { nations: "data/countries.js" } };
    expect(jsNationTableAdapter.files(custom)).toEqual([
      { role: "nations", path: "data/countries.js", required: true },
    ]);
  });

  it("maps nations: figures, nulls, official name, capital, colour and the wiki title from the link", () => {
    const snapshot = jsNationTableAdapter.parse(files, settings);
    const byKey = Object.fromEntries(snapshot.nations.map((n) => [n.key, n]));
    expect(byKey.Tavok).toEqual({
      key: "Tavok",
      displayName: "Tavok",
      wikiTitle: "Tavok",
      officialName: "Republic of Tavok",
      population: 48000000,
      gdpPerCapita: 39500,
      landArea: 248153,
      capital: "Tyyrik",
      color: "#0a3d2a",
      secondary: [],
    });
    expect(byKey["Bainbridge-Islands"]!.wikiTitle).toBe("Bainbridge Islands");
    expect(byKey.Kiziauke!.wikiTitle).toBe("Kíziáuke");
    expect(byKey.Deseti).toMatchObject({
      population: null,
      gdpPerCapita: null,
      landArea: null,
      capital: null,
    });
  });

  it("reads the entries' secondary-source fields as figure names", () => {
    const snapshot = jsNationTableAdapter.parse(files, settings);
    const byKey = Object.fromEntries(snapshot.nations.map((n) => [n.key, n]));
    expect(byKey.Mito).toMatchObject({
      secondary: ["gdpPerCapita", "landArea", "capital"],
    });
    expect(byKey["Bainbridge-Islands"]).toMatchObject({
      secondary: ["population", "gdpPerCapita", "landArea", "capital"],
    });
    const unmapped = jsNationTableAdapter.parse(
      { nations: `const t = { X: { pop: 5, secondaryFields: ["pop", "unknown"] } };` },
      {
        ...settings,
        files: { nations: "t.js" },
        bindings: { nations: "t" },
        nationFields: { population: "pop" },
      }
    );
    // Without the settings naming the list field, it is not read.
    expect(unmapped.nations[0]).toMatchObject({ secondary: [] });
  });

  it("reads field names from the settings, not from the code", () => {
    const renamed = jsNationTableAdapter.parse(
      { nations: `const t = { X: { pop: 5, cap: "Y" } };` },
      {
        ...settings,
        files: { nations: "t.js" },
        bindings: { nations: "t" },
        nationFields: { population: "pop", capital: "cap" },
      }
    );
    expect(renamed.nations[0]).toMatchObject({
      key: "X",
      population: 5,
      capital: "Y",
      gdpPerCapita: null,
    });
  });

  it("maps organisations: acronym as short name, colour, members, and the type rules' suggestion", () => {
    const { organizations } = jsNationTableAdapter.parse(files, settings);
    expect(organizations).toEqual([
      expect.objectContaining({
        key: "aurelian-league",
        name: "Aurelian League",
        shortName: "AL",
        color: "#f6aa27",
        members: ["Mito", "Kiziauke"],
        suggestedType: "political",
      }),
      expect.objectContaining({
        key: "west-argic-security-pact",
        name: "West Argic Security Pact",
        shortName: "WASP",
        color: "#8e44ad",
        suggestedType: "military",
      }),
    ]);
  });

  it("maps border features with their traced area, keyed by the nation key", () => {
    const { features } = jsNationTableAdapter.parse(files, settings);
    expect(features.map((f) => f.key)).toEqual(["Tavok", "Deseti"]);
    expect(features[0]!.areaKm2).toBe(264334);
    expect(features[0]!.geometry.type).toBe("MultiPolygon");
  });

  it("skips bad entries with a warning instead of failing the run", () => {
    const snapshot = jsNationTableAdapter.parse(
      {
        nations: `const nations = { A: { population: -5 }, B: "not an entry", C: { population: 1e30 } };`,
        borders: JSON.stringify({
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              id: "A",
              properties: { id: "A" },
              geometry: { type: "Point", coordinates: [0, 0] },
            },
          ],
        }),
      },
      {
        ...settings,
        files: { nations: "n.js", borders: "b.json" },
        bindings: { nations: "nations" },
      }
    );
    expect(snapshot.nations.map((n) => n.key)).toEqual(["A", "C"]);
    expect(snapshot.nations[0]!.population).toBeNull();
    expect(snapshot.features).toEqual([]);
    expect(snapshot.warnings.length).toBeGreaterThanOrEqual(4);
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

  it("splitAcronym and allianceTypeFor follow the configured rules", () => {
    expect(splitAcronym("Oriental States (OS)")).toEqual({
      name: "Oriental States",
      shortName: "OS",
    });
    expect(splitAcronym("No Acronym")).toEqual({ name: "No Acronym", shortName: null });
    const rules = settings.allianceTypeRules;
    expect(allianceTypeFor("Tricontinental Defence Treaty Organisation", rules)).toBe("military");
    expect(allianceTypeFor("Argic Economic Community", rules)).toBe("economic");
    expect(allianceTypeFor("Oriental States", rules, "political")).toBe("political");
    expect(allianceTypeFor("Anything", [{ keywords: ["Anything"], type: "regional" }])).toBe(
      "regional"
    );
  });
});
