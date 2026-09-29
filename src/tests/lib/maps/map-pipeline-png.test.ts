/** @jest-environment node */
// `jest` is the injected global on purpose: @swc/jest only hoists jest.mock() on the global.
jest.mock("~/lib/flags/png-to-svg", () => ({
  ...jest.requireActual("~/lib/flags/png-to-svg"),
  convertPngToSvg: jest.fn(),
}));

import { assemblePoliticalSvg, convertPngToSvg } from "~/lib/flags/png-to-svg";
import { runMapPipeline } from "~/lib/maps/map-pipeline";
import { getZoneByColor } from "~/lib/maps/elevation-config";

const convertMock = convertPngToSvg as jest.Mock;
const detectedColors = [
  { hex: "#ff0000", pixelCount: 0, featureId: "Aurelia" },
  { hex: "#00ff00", pixelCount: 0, featureId: "Borealis" },
];

beforeEach(() => {
  convertMock.mockReset();
  convertMock.mockResolvedValue({
    svg: assemblePoliticalSvg(1000, 500, [
      { featureId: "Aurelia", d: "M 100 100 L 200 100 L 200 200 L 100 200 Z", fill: "#ff0000" },
    ]),
    width: 1000,
    height: 500,
    detectedColors,
    log: ["Using 2 provided color mappings"],
  });
});

describe("runMapPipeline — PNG source", () => {
  it("converts the PNG with its config, parses the result and surfaces the detected colours", async () => {
    const pngBuffer = Buffer.from([1, 2, 3]);
    const pngConfig = { colorMapping: { "#ff0000": "Aurelia", "#00ff00": "Borealis" } };

    const result = await runMapPipeline({ source: "png", pngBuffer, pngConfig });

    expect(convertMock).toHaveBeenCalledWith(pngBuffer, pngConfig);
    expect(result.detectedColors).toEqual(detectedColors);
    expect(result.layers.political!.features.map((f) => f.id)).toEqual(["Aurelia"]);
    expect(result.metadata.log).toContain("Using 2 provided color mappings");
  });

  it("keeps the nations out of the altitude layer: a PNG map is political only", async () => {
    const result = await runMapPipeline({ source: "png", pngBuffer: Buffer.from([1]) });
    expect(Object.keys(result.layers)).toEqual(["political"]);
    expect(result.metadata.featureCounts).toEqual({ political: 1 });
  });

  it("requires the PNG buffer", async () => {
    await expect(runMapPipeline({ source: "png" })).rejects.toThrow("PNG buffer required");
    expect(convertMock).not.toHaveBeenCalled();
  });

  it("has no detected colours for SVG input", async () => {
    const result = await runMapPipeline({
      source: "svg",
      svgContent: assemblePoliticalSvg(1000, 500, []),
    });
    expect(result.detectedColors).toBeUndefined();
    expect(convertMock).not.toHaveBeenCalled();
  });
});

describe("runMapPipeline — altitude enrichment (characterization)", () => {
  it("tags altitude features whose fill matches an elevation zone, and counts them", async () => {
    const square = "M 100 100 L 200 100 L 200 200 L 100 200 Z";
    const svgContent = [
      `<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" viewBox="0 0 1000 500">`,
      `  <g id="political" inkscape:label="political" inkscape:groupmode="layer">`,
      `    <path id="Aurelia" d="${square}" fill="#ff0000" />`,
      `  </g>`,
      `  <g id="altitudes" inkscape:label="altitudes" inkscape:groupmode="layer">`,
      `    <path id="z1" d="${square}" fill="#a8c995" />`,
      `    <path id="z2" d="${square}" fill="#123456" />`,
      `  </g>`,
      `</svg>`,
    ].join("\n");

    const result = await runMapPipeline({ source: "svg", svgContent });

    const zone = getZoneByColor("#a8c995")!;
    const [tagged, untagged] = result.layers.altitudes!.features;
    expect(tagged!.properties).toMatchObject({
      zoneId: zone.zoneId,
      elevationMin: zone.elevationMin,
      elevationMax: zone.elevationMax,
      elevationLabel: `${zone.elevationMin}-${zone.elevationMax}m`,
    });
    expect(untagged!.properties!.elevationMin).toBeUndefined();
    expect(result.metadata.log).toContain("[enrichment] Enriched 1/2 altitude features");
    expect(result.metadata.featureCounts).toEqual({ political: 1, altitudes: 2 });
    expect(result.metadata.warnings).toEqual([]);
  });
});
