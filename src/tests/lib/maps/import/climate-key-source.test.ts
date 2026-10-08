/** @jest-environment node */
import { readClimateKeySource } from "~/lib/maps/import/climate-key-source";

/** As eurth-map's src/data/climates.js writes it: wiki pages completed by a `.map` the reader must not run. */
const CLIMATES_JS = `// The Köppen zones painted on the climate map
const WIKI = "https://en.wikipedia.org/wiki/";

export const CLIMATE_ZONES = [
  // Hot
  { code: "Af", name: "Tropical Rainforest", group: "Hot", rgb: [0, 55, 255], wiki: "Tropical_rainforest_climate" },
  { code: "Aw/As", name: "Tropical Savannah", group: "Hot", rgb: [37, 172, 252], wiki: "Tropical_savanna_climate" },
  // Cold
  { code: "EF", name: "Ice Cap", group: "Cold", rgb: [104, 104, 104], wiki: "Ice_cap_climate" },
].map((zone) => ({ ...zone, wiki: WIKI + zone.wiki }));

export const zoneLabel = (zone) => \`\${zone.code} - \${zone.name}\`;
`;

describe("readClimateKeySource", () => {
  it("reads the zones as data: code, name, colour from rgb, and the wiki link completed with its prefix", () => {
    const key = readClimateKeySource(CLIMATES_JS, {
      system: "Köppen",
      zonesBinding: "CLIMATE_ZONES",
      linkPrefixBinding: "WIKI",
    });
    expect(key).toEqual({
      system: "Köppen",
      zones: [
        {
          code: "Af",
          name: "Tropical Rainforest",
          color: "#0037ff",
          link: "https://en.wikipedia.org/wiki/Tropical_rainforest_climate",
        },
        {
          code: "Aw/As",
          name: "Tropical Savannah",
          color: "#25acfc",
          link: "https://en.wikipedia.org/wiki/Tropical_savanna_climate",
        },
        {
          code: "EF",
          name: "Ice Cap",
          color: "#686868",
          link: "https://en.wikipedia.org/wiki/Ice_cap_climate",
        },
      ],
    });
  });

  it("takes a hex colour and a full link as they are, and leaves out a link that is not https", () => {
    const source = `const Z = [{ code: "ET", name: "Tundra", color: "#B2B2B2", link: "javascript:alert(1)" },
      { code: "EF", name: "Ice Cap", color: "#686868", wiki: "https://example.org/ef" }];`;
    expect(readClimateKeySource(source, { system: "Köppen", zonesBinding: "Z" }).zones).toEqual([
      { code: "ET", name: "Tundra", color: "#b2b2b2" },
      { code: "EF", name: "Ice Cap", color: "#686868", link: "https://example.org/ef" },
    ]);
  });

  it("refuses a zone without a colour and a file that is not plain data", () => {
    expect(() =>
      readClimateKeySource(`const Z = [{ code: "Af", name: "Rainforest" }];`, {
        system: "Köppen",
        zonesBinding: "Z",
      })
    ).toThrow(/colour/);
    expect(() =>
      readClimateKeySource(`const Z = [{ code: run() }];`, { system: "Köppen", zonesBinding: "Z" })
    ).toThrow();
  });
});
