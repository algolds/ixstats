import {
  EARTH_RADIUS_KM,
  KM_PER_DEGREE,
  KM_PER_DEGREE_LAT,
  kmPerDegree,
  kmPerDegreeLat,
  kmPerDegreeLng,
  ringAreaSqKm,
} from "~/lib/maps/planet";

/** A closed lng/lat square with its south-west corner at (lng, lat). */
const square = (lng: number, lat: number, size: number) => [
  [lng, lat],
  [lng + size, lat],
  [lng + size, lat + size],
  [lng, lat + size],
  [lng, lat],
];

describe("planet constants", () => {
  it("keeps the figures the map code has always used", () => {
    expect(EARTH_RADIUS_KM).toBe(6371);
    expect(kmPerDegree()).toBe(111.32);
    expect(kmPerDegreeLat()).toBe(110.574);
    expect(kmPerDegreeLng(0)).toBe(111.32);
    expect(kmPerDegreeLng(60)).toBeCloseTo(111.32 * 0.5, 10);
  });

  it("scales every figure with the planet radius", () => {
    const double = EARTH_RADIUS_KM * 2;
    expect(kmPerDegree(double)).toBeCloseTo(KM_PER_DEGREE * 2, 10);
    expect(kmPerDegreeLat(double)).toBeCloseTo(KM_PER_DEGREE_LAT * 2, 10);
    expect(kmPerDegreeLng(60, double)).toBeCloseTo(KM_PER_DEGREE, 10);
  });
});

describe("ringAreaSqKm", () => {
  it("measures a 1° square at the equator as km per degree of longitude × latitude", () => {
    expect(ringAreaSqKm(square(0, 0, 1))).toBeCloseTo(kmPerDegreeLng(0.4) * KM_PER_DEGREE_LAT, 6);
  });

  it("ignores the ring's direction", () => {
    const ring = square(10, 40, 2);
    expect(ringAreaSqKm([...ring].reverse())).toBeCloseTo(ringAreaSqKm(ring), 9);
  });

  it("quadruples on a planet of twice the radius", () => {
    const ring = square(10, 40, 2);
    expect(ringAreaSqKm(ring, EARTH_RADIUS_KM * 2)).toBeCloseTo(ringAreaSqKm(ring) * 4, 6);
  });

  it("is 0 for an empty ring", () => {
    expect(ringAreaSqKm([])).toBe(0);
  });
});
