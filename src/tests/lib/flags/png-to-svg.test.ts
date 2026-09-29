/** @jest-environment node */
import { assemblePoliticalSvg } from "~/lib/flags/png-to-svg";
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
