import { EARTH_RADIUS_KM, polygonAreaSqKm, sphericalRingAreaSqKm } from "~/lib/maps/planet";
import {
  buildMeasureFeatures,
  formatArea,
  measurePerimeterKm,
} from "~/components/maps/core/utils/measure-helpers";

type Coord = [number, number];

const HALF_EARTH = EARTH_RADIUS_KM / 2;
const SPHERE_SQ_KM = 4 * Math.PI * EARTH_RADIUS_KM ** 2;

// One eighth of the sphere: the equator from 0° to 90° E and up to the north pole.
const OCTANT: Coord[] = [
  [0, 0],
  [90, 0],
  [0, 90],
];

/** A ring of vertices every `step`° of longitude along latitude `lat`, eastward. */
const parallelRing = (lat: number, step = 1): Coord[] =>
  Array.from({ length: 360 / step }, (_, i) => [-180 + i * step, lat]);

/** Area (km²) of the cap poleward of latitude `lat` on Earth's radius. */
const capSqKm = (lat: number) =>
  2 * Math.PI * EARTH_RADIUS_KM ** 2 * (1 - Math.sin((Math.abs(lat) * Math.PI) / 180));

describe("sphericalRingAreaSqKm", () => {
  it("measures a spherical octant as an eighth of the sphere, either way round", () => {
    expect(sphericalRingAreaSqKm(OCTANT)).toBeCloseTo(SPHERE_SQ_KM / 8, 3);
    expect(sphericalRingAreaSqKm([...OCTANT].reverse())).toBeCloseTo(SPHERE_SQ_KM / 8, 3);
  });

  it("treats an explicitly closed ring like an open one", () => {
    expect(sphericalRingAreaSqKm([...OCTANT, OCTANT[0]!])).toBeCloseTo(SPHERE_SQ_KM / 8, 3);
  });

  it("is 0 below three vertices", () => {
    expect(sphericalRingAreaSqKm([])).toBe(0);
    expect(sphericalRingAreaSqKm(OCTANT.slice(0, 2))).toBe(0);
  });

  it("scales with the square of the realm's radius", () => {
    expect(sphericalRingAreaSqKm(OCTANT, HALF_EARTH)).toBeCloseTo(
      sphericalRingAreaSqKm(OCTANT) / 4,
      3
    );
  });

  it("agrees with the flat approximation for a small square near the equator", () => {
    const square: Coord[] = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ];
    const flat = polygonAreaSqKm([[...square, square[0]!]]);
    expect(Math.abs(sphericalRingAreaSqKm(square) / flat - 1)).toBeLessThan(0.01);
  });

  it("measures a ring across the antimeridian like the same ring away from it", () => {
    const across: Coord[] = [
      [179, 10],
      [-179, 10],
      [-179, 12],
      [179, 12],
    ];
    const away: Coord[] = [
      [0, 10],
      [2, 10],
      [2, 12],
      [0, 12],
    ];
    expect(sphericalRingAreaSqKm(across)).toBeCloseTo(sphericalRingAreaSqKm(away), 3);
  });

  it("measures a ring around a pole as the polar cap it encloses", () => {
    for (const lat of [80, -80, 60]) {
      const area = sphericalRingAreaSqKm(parallelRing(lat));
      expect(Math.abs(area / capSqKm(lat) - 1)).toBeLessThan(0.01);
      expect(sphericalRingAreaSqKm(parallelRing(lat).reverse())).toBeCloseTo(area, 3);
    }
  });

  it("measures the smaller side of a ring", () => {
    // A ring just south of the equator around the north pole: the smaller side is the southern one.
    const area = sphericalRingAreaSqKm(parallelRing(-1));
    expect(area).toBeLessThanOrEqual(SPHERE_SQ_KM / 2);
    expect(Math.abs(area / capSqKm(-1) - 1)).toBeLessThan(0.01);
    // A band ±40° round all but 10° of longitude is more than half the sphere: the rest is measured.
    const north = Array.from({ length: 351 }, (_, i): Coord => [i, 40]);
    const band = [...north, ...north.map(([lng]): Coord => [lng, -40]).reverse()];
    const bandSqKm = (350 / 360) * SPHERE_SQ_KM * Math.sin((40 * Math.PI) / 180);
    const rest = sphericalRingAreaSqKm(band);
    expect(Math.abs(rest / (SPHERE_SQ_KM - bandSqKm) - 1)).toBeLessThan(0.01);
  });
});

describe("the measure tool's area mode", () => {
  it("measures the perimeter round the closed ring", () => {
    // Each side of the octant is a quarter of a great circle.
    expect(measurePerimeterKm(OCTANT)).toBeCloseTo((3 * Math.PI * EARTH_RADIUS_KM) / 2, 3);
    expect(measurePerimeterKm(OCTANT, HALF_EARTH)).toBeCloseTo(measurePerimeterKm(OCTANT) / 2, 3);
    expect(measurePerimeterKm(OCTANT.slice(0, 1))).toBe(0);
  });

  it("formats areas in km² and mi²", () => {
    expect(formatArea(1234.4)).toBe("1,234 km² (477 mi²)");
    expect(formatArea(12.34)).toBe("12.3 km² (4.8 mi²)");
    expect(formatArea(0.5)).toBe("500,000 m² (5,381,955 ft²)");
  });

  const fillOf = (pts: Coord[], radiusKm?: number) => {
    const fill = buildMeasureFeatures(pts, radiusKm, "area").find(
      (f) => f.properties?.kind === "area"
    );
    return fill?.geometry.type === "Polygon" ? fill.geometry.coordinates[0]! : undefined;
  };

  it("fills the polygon and labels it with the realm-scaled area", () => {
    const features = buildMeasureFeatures(OCTANT, HALF_EARTH, "area");
    expect(fillOf(OCTANT)).toBeDefined();
    const label = features.find((f) => f.properties?.kind === "label");
    expect(label?.properties?.text).toBe(formatArea(sphericalRingAreaSqKm(OCTANT, HALF_EARTH)));
    // Area mode draws the outline, not per-leg distance labels.
    expect(features.filter((f) => f.properties?.kind === "label")).toHaveLength(1);
    expect(features.filter((f) => f.properties?.kind === "point")).toHaveLength(3);
  });

  it("draws no fill or label below three points", () => {
    const features = buildMeasureFeatures(OCTANT.slice(0, 2), undefined, "area");
    expect(features.some((f) => f.properties?.kind === "area")).toBe(false);
    expect(features.some((f) => f.properties?.kind === "label")).toBe(false);
  });

  it("keeps the fill's longitudes continuous across the antimeridian", () => {
    const ring = fillOf([
      [179, 10],
      [-179, 10],
      [-179, 12],
      [179, 12],
    ])!;
    for (let i = 1; i < ring.length; i++) {
      expect(Math.abs(ring[i]![0]! - ring[i - 1]![0]!)).toBeLessThan(180);
    }
  });

  it("closes a pole-enclosing fill through the enclosed pole", () => {
    expect(fillOf(parallelRing(80, 30))!.some((p) => p[1] === 90)).toBe(true);
    expect(fillOf(parallelRing(-80, 30))!.some((p) => p[1] === -90)).toBe(true);
  });

  it("leaves distance mode as it was", () => {
    expect(buildMeasureFeatures(OCTANT, HALF_EARTH, "distance")).toEqual(
      buildMeasureFeatures(OCTANT, HALF_EARTH)
    );
    expect(buildMeasureFeatures(OCTANT).filter((f) => f.properties?.kind === "label")).toHaveLength(
      2
    );
  });
});
