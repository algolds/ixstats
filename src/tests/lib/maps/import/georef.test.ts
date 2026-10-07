/** @jest-environment node */
import {
  GeorefError,
  inverseMercatorY,
  mercatorY,
  resolveGeoreference,
} from "~/lib/maps/import/georef";

describe("resolveGeoreference", () => {
  it("defaults to a whole-globe equirectangular map", () => {
    const geo = resolveGeoreference(undefined, 2000, 1000);
    expect(geo.method).toBe("whole-globe");
    expect(geo.transform(0, 0)).toEqual([-180, 90]);
    expect(geo.transform(1000, 500)).toEqual([0, 0]);
    expect(geo.transform(2000, 1000)).toEqual([180, -90]);
    expect(geo.warnings).toEqual([]);
  });

  it("warns when a whole-globe map is not 2:1", () => {
    expect(resolveGeoreference(undefined, 1000, 1000).warnings[0]).toMatch(/2:1/);
  });

  it("places a crop by its bounds", () => {
    const geo = resolveGeoreference(
      { bounds: { west: -20, south: 30, east: 40, north: 60 } },
      600,
      300
    );
    expect(geo.method).toBe("bounds");
    expect(geo.transform(0, 0)).toEqual([-20, 60]);
    expect(geo.transform(300, 150)).toEqual([10, 45]);
    expect(geo.transform(600, 300)).toEqual([40, 30]);
    expect(geo.extent).toEqual({ west: -20, south: 30, east: 40, north: 60 });
  });

  it("applies the inverse Mercator to a Mercator crop", () => {
    const bounds = { west: -10, south: 0, east: 30, north: 60 };
    const geo = resolveGeoreference({ projection: "mercator", bounds }, 400, 400);
    const [, top] = geo.transform(0, 0);
    const [, bottom] = geo.transform(0, 400);
    expect(top).toBeCloseTo(60, 6);
    expect(bottom).toBeCloseTo(0, 6);
    // Halfway down the image is halfway in Mercator y: north of 30°, since Mercator stretches the north.
    const [, middle] = geo.transform(0, 200);
    expect(middle).toBeCloseTo(inverseMercatorY(mercatorY(60) / 2), 6);
    expect(middle).toBeGreaterThan(35);
  });

  it("round-trips the Mercator formulas", () => {
    for (const lat of [-80, -45, 0, 12.5, 66])
      expect(inverseMercatorY(mercatorY(lat))).toBeCloseTo(lat, 9);
  });

  it("fits control points (equirectangular)", () => {
    // A 1000×500 crop covering lon -50..50, lat 0..50.
    const toPixel = (lon: number, lat: number) => ({
      x: (lon + 50) * 10,
      y: (50 - lat) * 10,
      lon,
      lat,
    });
    const geo = resolveGeoreference(
      { controlPoints: [toPixel(-40, 40), toPixel(30, 45), toPixel(10, 5), toPixel(-20, 10)] },
      1000,
      500
    );
    expect(geo.method).toBe("control-points");
    expect(geo.rmseDegrees).toBeLessThan(1e-6);
    const [lon, lat] = geo.transform(500, 250);
    expect(lon).toBeCloseTo(0, 6);
    expect(lat).toBeCloseTo(25, 6);
  });

  it("fits control points on a Mercator map in Mercator space", () => {
    const scale = 5; // pixels per degree of longitude / Mercator y
    const toPixel = (lon: number, lat: number) => ({
      x: (lon + 100) * scale,
      y: (mercatorY(70) - mercatorY(lat)) * scale,
      lon,
      lat,
    });
    const points = [toPixel(-80, 60), toPixel(40, 65), toPixel(0, 10), toPixel(-30, -20)];
    const geo = resolveGeoreference({ projection: "mercator", controlPoints: points }, 1000, 1000);
    expect(geo.rmseDegrees).toBeLessThan(1e-6);
    const probe = toPixel(20, 45);
    const [lon, lat] = geo.transform(probe.x, probe.y);
    expect(lon).toBeCloseTo(20, 6);
    expect(lat).toBeCloseTo(45, 6);
  });

  it("refuses control points that cannot be fitted", () => {
    const collinear = [
      { x: 0, y: 0, lon: 0, lat: 0 },
      { x: 0, y: 10, lon: 0, lat: -1 },
      { x: 0, y: 20, lon: 0, lat: -2 },
    ];
    expect(() => resolveGeoreference({ controlPoints: collinear }, 100, 100)).toThrow(GeorefError);
  });
});
