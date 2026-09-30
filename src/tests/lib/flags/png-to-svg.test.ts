/** @jest-environment node */
import {
  assemblePoliticalSvg,
  convertPngToSvg,
  createColorMask,
  extractColors,
} from "~/lib/flags/png-to-svg";
import { parseSvgToGeoJson } from "~/lib/flags/svg-parser";
import { PngDecodeError } from "~/lib/maps/png-realm-map";
import { pngClaimingSize, twoNationPng } from "~/tests/fixtures/png-maps";

const square = "M 100 100 L 200 100 L 200 200 L 100 200 Z";

describe("assemblePoliticalSvg", () => {
  it("writes one political path per region, named by its feature id", () => {
    const svg = assemblePoliticalSvg(1000, 500, [
      { featureId: "Aurelia", d: square, fill: "#ff0000" },
    ]);
    expect(svg).toContain('viewBox="0 0 1000 500"');
    expect(svg).toContain('inkscape:label="political"');
    expect(svg).toContain(`<path id="Aurelia" d="${square}" fill="#ff0000" stroke="none" />`);
  });

  it("escapes nation names so the parser reads them back exactly", () => {
    const name = `Trinidad & Tobago "<North>"`;
    const svg = assemblePoliticalSvg(1000, 500, [{ featureId: name, d: square, fill: "#00ff00" }]);
    expect(svg).toContain('id="Trinidad &amp; Tobago &quot;&lt;North&gt;&quot;"');

    const parsed = parseSvgToGeoJson(svg, "political");
    expect(parsed.features.map((f) => f.featureId)).toEqual([name]);
    expect(parsed.featureCollection.features[0]!.id).toBe(name);
  });
});

/** The x extent of a traced path (its numbers alternate x, y). */
function xRange(d: string): [number, number] {
  const xs = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number).filter((_, i) => i % 2 === 0);
  return [Math.min(...xs), Math.max(...xs)];
}

describe("convertPngToSvg — real vectorisation (sharp + potrace)", () => {
  it("traces each mapped colour into one path carrying its nation, over that colour's pixels", async () => {
    const result = await convertPngToSvg(await twoNationPng(), {
      colorMapping: { "#ff0000": "Aurelia", "#00ff00": "Borealis" },
    });

    const paths = [...result.svg.matchAll(/<path id="([^"]+)" d="([^"]+)"/g)].map(([, id, d]) => ({
      id,
      d: d!,
    }));
    expect(paths.map((p) => p.id)).toEqual(["Aurelia", "Borealis"]);
    expect(result.log.join("\n")).not.toMatch(/potrace|ERROR/);

    // Each region covers its own half of the land (x 2–20 and 20–38), not the rest of the image.
    const [aureliaMin, aureliaMax] = xRange(paths[0]!.d);
    const [borealisMin, borealisMax] = xRange(paths[1]!.d);
    expect(aureliaMin).toBeGreaterThanOrEqual(1);
    expect(aureliaMax).toBeLessThanOrEqual(21);
    expect(borealisMin).toBeGreaterThanOrEqual(19);
    expect(borealisMax).toBeLessThanOrEqual(39);

    const parsed = parseSvgToGeoJson(result.svg, "political");
    expect(parsed.features.map((f) => f.featureId)).toEqual(["Aurelia", "Borealis"]);
  });

  it("says potrace could not be loaded (and why) when it is missing, and still reports the colours", async () => {
    // potrace resolves from the project root; a root with no node_modules has no potrace.
    const cwd = jest.spyOn(process, "cwd").mockReturnValue("/nonexistent-ixstats-root");
    try {
      const result = await convertPngToSvg(await twoNationPng(), { autoDetectColors: true });
      expect(result.log).toContainEqual(
        expect.stringMatching(/^ERROR potrace could not be loaded.*Cannot find module 'potrace'/)
      );
      expect(result.svg).not.toContain("<path");
      expect(result.detectedColors.map((c) => c.hex)).toEqual(["#ff0000", "#00ff00", "#0000ff"]);
    } finally {
      cwd.mockRestore();
    }
  });
});

describe("decoding the map image", () => {
  const decoders: Array<[string, (png: Buffer) => Promise<unknown>]> = [
    ["extractColors", (png) => extractColors(png)],
    ["createColorMask", (png) => createColorMask(png, "#ff0000")],
    ["convertPngToSvg", (png) => convertPngToSvg(png, { colorMapping: { "#ff0000": "Aurelia" } })],
  ];

  it.each(decoders)("%s turns an unreadable image into a PngDecodeError", async (_name, decode) => {
    await expect(decode(Buffer.from("not an image at all"))).rejects.toThrow(PngDecodeError);
  });

  it.each(decoders)("%s refuses an image over 64 megapixels", async (_name, decode) => {
    const huge = await pngClaimingSize(8193, 8192);
    await expect(decode(huge)).rejects.toMatchObject({
      name: "PngDecodeError",
      message: expect.stringMatching(/64 megapixels/),
    });
  });
});
