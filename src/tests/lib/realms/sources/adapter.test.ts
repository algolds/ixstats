/** @jest-environment node */
import fs from "node:fs";
import path from "node:path";
import {
  jsNationTableAdapter,
  wikiTitleFromLink,
  type JsNationTableSettings,
} from "~/lib/realms/sources/adapters/js-nation-table";
import { sourcePreset } from "~/lib/realms/sources/presets";

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
describe("the eurth-map adapter", () => {
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
});
