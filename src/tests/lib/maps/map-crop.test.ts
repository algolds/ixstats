import { geometryPath, mapCropFrame } from "~/lib/maps/map-crop";

/** A 10° × 4° country, its capital in the east, a city far west. */
const COUNTRY = {
  bbox: [10, 40, 20, 44] as [number, number, number, number],
  capital: [18, 42] as [number, number],
  cities: [
    [18, 42],
    [8, 41],
  ] as [number, number][],
  neighbors: [
    [30, 42],
    [0, 50],
  ] as [number, number][],
};
const ASPECT = 3;

/** Whether a point (lng, lat) falls inside a frame, in SVG space (y = −lat). */
const inside = (f: { x: number; y: number; w: number; h: number }, [lng, lat]: [number, number]) =>
  lng >= f.x && lng <= f.x + f.w && -lat >= f.y && -lat <= f.y + f.h;

describe("mapCropFrame", () => {
  it("frames each kind at the cover's aspect ratio", () => {
    for (const kind of ["economy", "state", "foreign"] as const) {
      const f = mapCropFrame(kind, COUNTRY, ASPECT);
      expect(f.w / f.h).toBeCloseTo(ASPECT, 5);
    }
  });

  it("economy holds the whole country and every city", () => {
    const f = mapCropFrame("economy", COUNTRY, ASPECT);
    expect(inside(f, [10, 40]) && inside(f, [20, 44])).toBe(true);
    expect(inside(f, [8, 41])).toBe(true);
  });

  it("state centres on the capital and zooms in past the country's width", () => {
    const f = mapCropFrame("state", COUNTRY, ASPECT);
    expect(f.x + f.w / 2).toBeCloseTo(18, 5);
    expect(f.y + f.h / 2).toBeCloseTo(-42, 5);
    expect(f.w).toBeLessThan(10);
  });

  it("foreign stays centred on the country and zooms out towards the neighbours", () => {
    const f = mapCropFrame("foreign", COUNTRY, ASPECT);
    expect(f.x + f.w / 2).toBeCloseTo(15, 5);
    expect(f.y + f.h / 2).toBeCloseTo(-42, 5);
    expect(inside(f, [30, 42])).toBe(true);
  });

  it("foreign caps the zoom so a far neighbour cannot shrink the country to a speck", () => {
    const far = mapCropFrame("foreign", { ...COUNTRY, neighbors: [[175, 42]] }, ASPECT);
    expect(far.w).toBeLessThanOrEqual(10 * 4 + 1e-9);
  });

  it("falls back to the country when State has no capital, and survives a point-sized country", () => {
    const noCapital = mapCropFrame("state", { ...COUNTRY, capital: null }, ASPECT);
    expect(inside(noCapital, [10, 40]) && inside(noCapital, [20, 44])).toBe(true);
    const dot = mapCropFrame(
      "economy",
      { bbox: [5, 5, 5, 5], capital: null, cities: [], neighbors: [] },
      ASPECT
    );
    expect(dot.w).toBeGreaterThan(0);
    expect(dot.h).toBeGreaterThan(0);
  });
});

describe("geometryPath", () => {
  it("draws polygon rings in SVG space (y = −lat), closed", () => {
    expect(
      geometryPath({
        type: "Polygon",
        coordinates: [
          [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 0],
          ],
        ],
      })
    ).toBe("M0,0L1,0L1,-1L0,0Z");
  });

  it("joins multipolygon parts and ignores other geometry types", () => {
    const square = [
      [
        [0, 0],
        [1, 0],
        [1, 1],
      ],
    ];
    expect(geometryPath({ type: "MultiPolygon", coordinates: [square, square] })).toBe(
      "M0,0L1,0L1,-1ZM0,0L1,0L1,-1Z"
    );
    expect(geometryPath({ type: "Point", coordinates: [0, 0] })).toBe("");
  });
});
