import { buildRouteGeometry } from "./route-geometry";

describe("buildRouteGeometry", () => {
  const a: [number, number] = [-78.8, 42.9];
  const b: [number, number] = [-79.4, 43.7];

  it("returns straight waypoints for non-curved types", () => {
    const geo = buildRouteGeometry([a, b], "rail");
    expect(geo.type).toBe("LineString");
    expect(geo.coordinates).toEqual([a, b]);
  });

  it("densifies air_corridor into a great-circle arc", () => {
    const geo = buildRouteGeometry([a, b], "air_corridor");
    expect(geo.type).toBe("LineString");
    expect(geo.coordinates.length).toBeGreaterThan(2);
    expect(geo.coordinates[0]![0]).toBeCloseTo(a[0], 1);
    const last = geo.coordinates[geo.coordinates.length - 1]!;
    expect(last[0]).toBeCloseTo(b[0], 1);
  });

  it("returns input unchanged for <2 waypoints", () => {
    const geo = buildRouteGeometry([a], "air_corridor");
    expect(geo.coordinates).toEqual([a]);
  });

  it("does not crash on identical consecutive points", () => {
    expect(() => buildRouteGeometry([a, a, b], "shipping_lane")).not.toThrow();
  });
});
