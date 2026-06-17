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
        if (id === "prov-a") return [[[100, 100], [200, 100], [150, 200], [100, 100]]];
        if (id === "prov-b") return [[[300, 100], [400, 100], [350, 200], [300, 100]]];
        if (id === "prov-c") return [[[500, 100], [600, 100], [550, 200], [500, 100]]];
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

  it("extracts layers with correct shape/text counts", () => {
    const result = parseCitySvg(sampleSvg);
    expect(result.layers).toBeDefined();
    
    const provLayer = result.layers.find(l => l.name === "Provinces");
    expect(provLayer).toBeDefined();
    expect(provLayer!.shapeCount).toBe(3);

    const citiesLayer = result.layers.find(l => l.name === "Cities");
    expect(citiesLayer).toBeDefined();
    expect(citiesLayer!.shapeCount).toBe(4);

    const capitalsLayer = result.layers.find(l => l.name === "Capitals");
    expect(capitalsLayer).toBeDefined();
    expect(capitalsLayer!.shapeCount).toBe(1);
  });

  it("extracts city points matching nearest text labels", () => {
    const result = parseCitySvg(sampleSvg, { citiesLayerId: "cities-layer" });
    expect(result.points).toHaveLength(4);

    // City at 150, 150 should match nearest label "London"
    const p1 = result.points.find(p => p.svgX === 150 && p.svgY === 150);
    expect(p1).toBeDefined();
    expect(p1!.name).toBe("London");

    const p2 = result.points.find(p => p.svgX === 350 && p.svgY === 150);
    expect(p2).toBeDefined();
    expect(p2!.name).toBe("Paris");

    const p3 = result.points.find(p => p.svgX === 550 && p.svgY === 150);
    expect(p3).toBeDefined();
    expect(p3!.name).toBe("Berlin");

    const p4 = result.points.find(p => p.svgX === 750 && p.svgY === 150);
    expect(p4).toBeDefined();
    expect(p4!.name).toBe("Rome");
  });

  it("detects capitals based on opts.capitalLayerId", () => {
    // Both target cities and capitals are parsed when we use root or let it auto-detect,
    // or when we pass capitalLayerId explicitly.
    const result = parseCitySvg(sampleSvg, {
      citiesLayerId: "root",
      capitalLayerId: "capitals-layer"
    });

    const capital = result.points.find(p => p.svgX === 850 && p.svgY === 150 && p.name === "Madrid");
    expect(capital).toBeDefined();
    expect(capital!.isCapital).toBe(true);
  });

  it("extracts province centroids paired with nearest text labels", () => {
    const result = parseCitySvg(sampleSvg);
    expect(result.svgProvinces).toHaveLength(3);

    const pa = result.svgProvinces.find(p => p.name === "Province A Label");
    expect(pa).toBeDefined();
    expect(pa!.svgX).toBeCloseTo(137.5);
    expect(pa!.svgY).toBeCloseTo(125, 1);
  });
});
