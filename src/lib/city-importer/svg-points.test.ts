import { describe, it, expect, jest } from "@jest/globals";

jest.mock("../province-importer/svg-element-converter", () => {
  return {
    SHAPE_TAGS: new Set(["path", "polygon", "polyline", "rect", "circle", "ellipse"]),
    elementToRings: jest.fn((el: any) => {
      const tag = el.localName || el.tagName;
      if (tag === "circle") {
        const cx = parseFloat(el.getAttribute("cx") || "0");
        const cy = parseFloat(el.getAttribute("cy") || "0");
        return [[[cx, cy]]];
      }
      if (tag === "path") {
        const id = el.getAttribute("id");
        if (id === "prov-a")
          return [
            [
              [100, 100],
              [200, 100],
              [150, 200],
              [100, 100],
            ],
          ];
        if (id === "prov-b")
          return [
            [
              [300, 100],
              [400, 100],
              [350, 200],
              [300, 100],
            ],
          ];
        if (id === "prov-c")
          return [
            [
              [500, 100],
              [600, 100],
              [550, 200],
              [500, 100],
            ],
          ];
      }
      return [];
    }),
  };
});

import { parseCitySvg } from "./svg-points";

describe("parseCitySvg", () => {
  const sampleSvg = `
    <svg viewBox="0 0 1000 1000" xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape">
      <g id="prov-layer" inkscape:label="Provinces">
        <!-- 3 triangles (provinces) -->
        <path id="prov-a" inkscape:label="Province A" d="M 100 100 L 200 100 L 150 200 Z" fill="#ff0000" />
        <path id="prov-b" inkscape:label="Province B" d="M 300 100 L 400 100 L 350 200 Z" fill="#00ff00" />
        <path id="prov-c" inkscape:label="Province C" d="M 500 100 L 600 100 L 550 200 Z" fill="#ff00ff" />
      </g>
      <g id="cities-layer" inkscape:label="Cities">
        <!-- 4 dots (cities) -->
        <circle id="city-1" cx="150" cy="150" r="6" fill="#ffffff" />
        <circle id="city-2" cx="350" cy="150" r="6" fill="#ffffff" />
        <circle id="city-3" cx="550" cy="150" r="6" fill="#ffffff" />
        <circle id="city-4" cx="750" cy="150" r="6" fill="#ffffff" />
      </g>
      <g id="capitals-layer" inkscape:label="Capitals">
        <!-- 1 capital dot -->
        <circle id="capital-1" cx="850" cy="150" r="6" fill="#ffff00" />
      </g>
      <text x="150" y="160">London</text>
      <text x="350" y="160">Paris</text>
      <text x="550" y="160">Berlin</text>
      <text x="750" y="160">Rome</text>
      <text x="850" y="160">Madrid</text>
      <text x="137.5" y="120">Province A Label</text>
      <text x="337.5" y="120">Province B Label</text>
      <text x="537.5" y="120">Province C Label</text>
    </svg>
  `;

  it("extracts layers with correct shape/text/marker counts", () => {
    const result = parseCitySvg(sampleSvg);
    expect(result.layers).toBeDefined();

    const provLayer = result.layers.find((l) => l.name === "Provinces");
    expect(provLayer).toBeDefined();
    expect(provLayer!.shapeCount).toBe(3);
    expect(provLayer!.depth).toBe(0);

    const citiesLayer = result.layers.find((l) => l.name === "Cities");
    expect(citiesLayer).toBeDefined();
    expect(citiesLayer!.shapeCount).toBe(4);
    expect(citiesLayer!.markerCount).toBe(4);
    expect(citiesLayer!.depth).toBe(0);

    const capitalsLayer = result.layers.find((l) => l.name === "Capitals");
    expect(capitalsLayer).toBeDefined();
    expect(capitalsLayer!.shapeCount).toBe(1);
    expect(capitalsLayer!.markerCount).toBe(1);
    expect(capitalsLayer!.depth).toBe(0);
  });

  it("extracts city points matching nearest text labels", () => {
    const result = parseCitySvg(sampleSvg, { citiesLayerId: "cities-layer" });
    expect(result.points).toHaveLength(4);

    // City at 150, 150 should match nearest label "London"
    const p1 = result.points.find((p) => p.svgX === 150 && p.svgY === 150);
    expect(p1).toBeDefined();
    expect(p1!.name).toBe("London");

    const p2 = result.points.find((p) => p.svgX === 350 && p.svgY === 150);
    expect(p2).toBeDefined();
    expect(p2!.name).toBe("Paris");

    const p3 = result.points.find((p) => p.svgX === 550 && p.svgY === 150);
    expect(p3).toBeDefined();
    expect(p3!.name).toBe("Berlin");

    const p4 = result.points.find((p) => p.svgX === 750 && p.svgY === 150);
    expect(p4).toBeDefined();
    expect(p4!.name).toBe("Rome");
  });

  it("detects capitals based on opts.capitalLayerId", () => {
    // Both target cities and capitals are parsed when we use root or let it auto-detect,
    // or when we pass capitalLayerId explicitly.
    const result = parseCitySvg(sampleSvg, {
      citiesLayerId: "root",
      capitalLayerId: "capitals-layer",
    });

    const capital = result.points.find(
      (p) => p.svgX === 850 && p.svgY === 150 && p.name === "Madrid"
    );
    expect(capital).toBeDefined();
    expect(capital!.isCapital).toBe(true);
  });

  it("extracts province centroids paired with nearest text labels", () => {
    const result = parseCitySvg(sampleSvg);
    expect(result.svgProvinces).toHaveLength(3);

    const pa = result.svgProvinces.find((p) => p.name === "Province A Label");
    expect(pa).toBeDefined();
    expect(pa!.svgX).toBeCloseTo(137.5);
    expect(pa!.svgY).toBeCloseTo(125, 1);
  });

  it("auto-detects cities layer with CSS-styled circles (no inline fill)", () => {
    // Regression: circles styled via CSS class (no fill= attr) were being
    // dropped by collectShapeElements → isDecorativeElement, causing the layer
    // to report shapeCount=0 and be skipped by the auto-detect loop.
    const svgWithCssCircles = `
      <svg viewBox="0 0 1000 1000" xmlns="http://www.w3.org/2000/svg">
        <defs><style>.dot { fill: #fff; }</style></defs>
        <g id="base-map">
          <path id="prov-a" d="M 100 100 L 200 100 L 150 200 Z" fill="#ff0000" />
        </g>
        <g id="cities">
          <circle class="dot" cx="150" cy="150" r="5" />
          <circle class="dot" cx="350" cy="150" r="5" />
          <circle class="dot" cx="550" cy="150" r="5" />
        </g>
      </svg>
    `;
    const result = parseCitySvg(svgWithCssCircles);
    expect(result.detectedCitiesLayerId).toBe("cities");
    expect(result.points).toHaveLength(3);
  });

  it("ignores outlined text paths when circles are present in the same layer", () => {
    // Regression: city labels converted to vector outlines (<path> glyphs)
    // were being counted as point-like elements alongside real circle markers,
    // inflating the point count (e.g. 383 circles + 3300 glyph paths = 3683).
    const svgWithGlyphPaths = `
      <svg viewBox="0 0 1000 1000" xmlns="http://www.w3.org/2000/svg">
        <g id="cities">
          <circle cx="150" cy="150" r="5" />
          <circle cx="350" cy="150" r="5" />
          <!-- Glyph paths (letterforms from outlined text) — small enough to be "point-like" -->
          <path d="M150,140 l5,0 l0,8 l-5,0 z" />
          <path d="M156,140 l5,0 l0,8 l-5,0 z" />
          <path d="M162,140 l5,0 l0,8 l-5,0 z" />
          <path d="M350,140 l5,0 l0,8 l-5,0 z" />
          <path d="M356,140 l5,0 l0,8 l-5,0 z" />
        </g>
      </svg>
    `;
    const result = parseCitySvg(svgWithGlyphPaths);
    // Should only extract the 2 circles, not the 5 glyph paths
    expect(result.points).toHaveLength(2);
  });

  it("enumerates nested groups with correct depth", () => {
    const nestedSvg = `
      <svg viewBox="0 0 1000 1000" xmlns="http://www.w3.org/2000/svg">
        <g id="base-map">
          <g id="provinces">
            <path id="prov-a" d="M 100 100 L 200 100 L 150 200 Z" fill="#ff0000" />
          </g>
          <g id="borders">
            <path d="M 0 0 L 1000 0" stroke="#000" fill="none" />
          </g>
        </g>
        <g id="cities">
          <circle cx="150" cy="150" r="5" />
        </g>
        <g id="labels">
          <g id="province-names">
            <text x="150" y="120">Province A</text>
          </g>
          <g id="city-names">
            <text x="150" y="160">London</text>
          </g>
        </g>
      </svg>
    `;
    const result = parseCitySvg(nestedSvg);

    // All named groups should appear (both top-level and nested)
    const ids = result.layers.map((l) => l.id);
    expect(ids).toContain("base-map");
    expect(ids).toContain("provinces");
    expect(ids).toContain("borders");
    expect(ids).toContain("cities");
    expect(ids).toContain("labels");
    expect(ids).toContain("province-names");
    expect(ids).toContain("city-names");

    // Depth should reflect nesting
    expect(result.layers.find((l) => l.id === "base-map")!.depth).toBe(0);
    expect(result.layers.find((l) => l.id === "provinces")!.depth).toBe(1);
    expect(result.layers.find((l) => l.id === "cities")!.depth).toBe(0);
    expect(result.layers.find((l) => l.id === "province-names")!.depth).toBe(1);
  });

  it("auto-detects by group name even when another layer has more markers", () => {
    // The "dots" group has more circles, but "cities" should win on name match.
    const svgNamePriority = `
      <svg viewBox="0 0 1000 1000" xmlns="http://www.w3.org/2000/svg">
        <g id="decorative-dots">
          <circle cx="10" cy="10" r="3" />
          <circle cx="20" cy="20" r="3" />
          <circle cx="30" cy="30" r="3" />
          <circle cx="40" cy="40" r="3" />
          <circle cx="50" cy="50" r="3" />
        </g>
        <g id="cities">
          <circle cx="150" cy="150" r="5" />
          <circle cx="350" cy="150" r="5" />
        </g>
      </svg>
    `;
    const result = parseCitySvg(svgNamePriority);
    // "cities" should be auto-selected by name, not "decorative-dots" (which has 5 vs 2)
    expect(result.detectedCitiesLayerId).toBe("cities");
    expect(result.points).toHaveLength(2);
  });
});
