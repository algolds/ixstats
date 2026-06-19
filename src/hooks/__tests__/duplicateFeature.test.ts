/**
 * Unit tests for buildDuplicateInput — the pure clone/offset/name transform
 * exported from useMapEditor.ts.
 *
 * No React, no tRPC, no map — just data in / data out.
 */

import { buildDuplicateInput } from "../useMapEditor";
import type { EditorFeature } from "../useMapEditor";

const OFFSET = 0.05;

// Helpers
const city = (overrides?: Partial<EditorFeature>): EditorFeature => ({
  id: "c1",
  type: "city",
  name: "Riverdale",
  coordinates: [10.0, 20.0],
  properties: {
    cityType: "city",
    population: 50000,
    isNationalCapital: true,
    isSubdivisionCapital: false,
    elevation: 100,
    foundedYear: 1850,
  },
  ...overrides,
});

const subdivision = (overrides?: Partial<EditorFeature>): EditorFeature => ({
  id: "s1",
  type: "subdivision",
  name: "Northshire",
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [10.0, 20.0],
        [11.0, 20.0],
        [11.0, 21.0],
        [10.0, 21.0],
        [10.0, 20.0],
      ],
    ],
  },
  properties: {
    type: "province",
    level: 2,
    color: "#cc0000",
    population: 200000,
    areaSqKm: 1500,
  },
  ...overrides,
});

const poi = (overrides?: Partial<EditorFeature>): EditorFeature => ({
  id: "p1",
  type: "poi",
  name: "Old Tower",
  coordinates: [5.0, 15.0],
  properties: {
    category: "historical",
    description: "An ancient tower",
    icon: "tower",
  },
  ...overrides,
});

const storyPin = (overrides?: Partial<EditorFeature>): EditorFeature => ({
  id: "sp1",
  type: "storyPin",
  name: "Battle of the River",
  coordinates: [7.0, 17.0],
  properties: {
    content: "A great battle occurred here",
    category: "battle",
    ixTimeYear: 1200,
  },
  ...overrides,
});

const mapLabel = (overrides?: Partial<EditorFeature>): EditorFeature => ({
  id: "ml1",
  type: "mapLabel",
  name: "Mountain Range",
  coordinates: [3.0, 13.0],
  properties: {
    labelType: "mountain_range",
    fontSize: 18,
    color: "#ffffff",
    rotation: 45,
    opacity: 0.9,
    letterSpacing: 2,
    fontWeight: "bold",
    minZoom: 5,
    maxZoom: 16,
  },
  ...overrides,
});

// ── Name tests ──

describe("buildDuplicateInput — name appends ' (copy)'", () => {
  it("city", () => {
    expect(buildDuplicateInput(city()).name).toBe("Riverdale (copy)");
  });
  it("subdivision", () => {
    expect(buildDuplicateInput(subdivision()).name).toBe("Northshire (copy)");
  });
  it("poi", () => {
    expect(buildDuplicateInput(poi()).name).toBe("Old Tower (copy)");
  });
  it("storyPin uses title field", () => {
    expect(buildDuplicateInput(storyPin()).title).toBe("Battle of the River (copy)");
  });
  it("mapLabel uses text field", () => {
    expect(buildDuplicateInput(mapLabel()).text).toBe("Mountain Range (copy)");
  });
});

// ── Coordinate offset tests ──

describe("buildDuplicateInput — point coordinate offset", () => {
  it("city offsets coordinates by DUPLICATE_OFFSET_DEG on both axes", () => {
    const result = buildDuplicateInput(city());
    expect(result.coordinates).toEqual([10.0 + OFFSET, 20.0 + OFFSET]);
  });

  it("poi offsets coordinates", () => {
    const result = buildDuplicateInput(poi());
    expect(result.coordinates).toEqual([5.0 + OFFSET, 15.0 + OFFSET]);
  });

  it("storyPin offsets coordinates", () => {
    const result = buildDuplicateInput(storyPin());
    expect(result.coordinates).toEqual([7.0 + OFFSET, 17.0 + OFFSET]);
  });

  it("mapLabel offsets coordinates", () => {
    const result = buildDuplicateInput(mapLabel());
    expect(result.coordinates).toEqual([3.0 + OFFSET, 13.0 + OFFSET]);
  });

  it("handles undefined coordinates gracefully", () => {
    const f = city({ coordinates: undefined });
    const result = buildDuplicateInput(f);
    expect(result.coordinates).toBeUndefined();
  });
});

// ── Polygon geometry offset tests ──

describe("buildDuplicateInput — subdivision polygon offset", () => {
  it("offsets all ring vertices by DUPLICATE_OFFSET_DEG", () => {
    const result = buildDuplicateInput(subdivision());
    const geom = result.geometry as any;
    expect(geom.type).toBe("Polygon");
    const ring = geom.coordinates[0];
    // Each point should be offset
    ring.forEach((pt: [number, number], i: number) => {
      const original = (subdivision().geometry as any).coordinates[0][i];
      expect(pt[0]).toBeCloseTo(original[0] + OFFSET, 8);
      expect(pt[1]).toBeCloseTo(original[1] + OFFSET, 8);
    });
  });

  it("handles undefined geometry gracefully", () => {
    const f = subdivision({ geometry: undefined });
    const result = buildDuplicateInput(f);
    expect(result.geometry).toBeUndefined();
  });

  it("preserves non-coordinate properties (type, level, color)", () => {
    const result = buildDuplicateInput(subdivision());
    expect(result.type).toBe("province");
    expect(result.level).toBe(2);
    expect(result.color).toBe("#cc0000");
    expect(result.population).toBe(200000);
    expect(result.areaSqKm).toBe(1500);
  });
});

// ── Capital flag tests ──

describe("buildDuplicateInput — city does not carry capital flags", () => {
  it("isNationalCapital is always false on copy", () => {
    const f = city(); // source has isNationalCapital: true
    expect(buildDuplicateInput(f).isNationalCapital).toBe(false);
  });
  it("isSubdivisionCapital is always false on copy", () => {
    const f = city();
    expect(buildDuplicateInput(f).isSubdivisionCapital).toBe(false);
  });
  it("wikiPageTitle is cleared on copy", () => {
    expect(buildDuplicateInput(city()).wikiPageTitle).toBeUndefined();
  });
});

// ── StoryPin / MapLabel field mapping ──

describe("buildDuplicateInput — storyPin fields", () => {
  it("carries content and category", () => {
    const result = buildDuplicateInput(storyPin());
    expect(result.content).toBe("A great battle occurred here");
    expect(result.category).toBe("battle");
    expect(result.ixTimeYear).toBe(1200);
  });
});

describe("buildDuplicateInput — mapLabel fields", () => {
  it("carries all label styling properties", () => {
    const result = buildDuplicateInput(mapLabel());
    expect(result.labelType).toBe("mountain_range");
    expect(result.fontSize).toBe(18);
    expect(result.color).toBe("#ffffff");
    expect(result.rotation).toBe(45);
    expect(result.opacity).toBeCloseTo(0.9, 5);
    expect(result.letterSpacing).toBe(2);
    expect(result.fontWeight).toBe("bold");
    expect(result.minZoom).toBe(5);
    expect(result.maxZoom).toBe(16);
  });
});

// ── Edge cases ──

describe("buildDuplicateInput — edge cases", () => {
  it("MultiPolygon: offsets all rings in all polygons", () => {
    const f: EditorFeature = {
      id: "mp1",
      type: "subdivision",
      name: "Multi",
      geometry: {
        type: "MultiPolygon",
        coordinates: [
          [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
          [[[5, 5], [6, 5], [6, 6], [5, 6], [5, 5]]],
        ],
      },
      properties: { type: "province", level: 1 },
    };
    const result = buildDuplicateInput(f);
    const geom = result.geometry as any;
    expect(geom.type).toBe("MultiPolygon");
    // First polygon first ring first vertex
    expect(geom.coordinates[0][0][0]).toEqual([OFFSET, OFFSET]);
    // Second polygon first ring first vertex
    expect(geom.coordinates[1][0][0]).toEqual([5 + OFFSET, 5 + OFFSET]);
  });

  it("unknown geometry type is returned unchanged", () => {
    const f: EditorFeature = {
      id: "x1",
      type: "subdivision",
      name: "Weird",
      geometry: { type: "Point", coordinates: [0, 0] } as any,
      properties: { type: "province", level: 1 },
    };
    const result = buildDuplicateInput(f);
    // No offset applied to unknown geometry type
    expect((result.geometry as any).coordinates).toEqual([0, 0]);
  });
});
