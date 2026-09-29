/** @jest-environment node */
import sharp from "sharp";
import { assemblePoliticalSvg, convertPngToSvg } from "~/lib/flags/png-to-svg";
import { parseSvgToGeoJson } from "~/lib/flags/svg-parser";

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

const WIDTH = 40;
const HEIGHT = 20;
type Rgb = [number, number, number];

/** A 40×20 flat-colour map: Aurelia (red) west, Borealis (green) east, inside a 2px blue ocean. */
function twoNationPng(): Promise<Buffer> {
  const raw = Buffer.alloc(WIDTH * HEIGHT * 3);
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const ocean = x < 2 || x >= WIDTH - 2 || y < 2 || y >= HEIGHT - 2;
      const rgb: Rgb = ocean ? [0, 0, 255] : x < WIDTH / 2 ? [255, 0, 0] : [0, 255, 0];
      raw.set(rgb, (y * WIDTH + x) * 3);
    }
  }
  return sharp(raw, { raw: { width: WIDTH, height: HEIGHT, channels: 3 } })
    .png()
    .toBuffer();
}

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
