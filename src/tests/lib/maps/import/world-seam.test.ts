/** @jest-environment node */
/**
 * Longitudes past ±180 in a world bundle (the generator's rivers run to about ±205) are cut at the seam and shifted
 * into range, so the realm map writer accepts them.
 */
import type {
  Geometry,
  LineString,
  MultiLineString,
  MultiPolygon,
  Polygon,
  Position,
} from "geojson";
import { fitToSeam, passesSeam } from "~/lib/maps/import/world-seam";

type Nested = number | Nested[];

/** Every longitude of a geometry. */
const lng = (geometry: Geometry): number[] => {
  const walk = (nested: Nested): number[] =>
    typeof nested === "number"
      ? []
      : typeof nested[0] === "number"
        ? [nested[0]]
        : nested.flatMap(walk);
  return "coordinates" in geometry ? walk(geometry.coordinates as Nested) : [];
};

describe("fitToSeam", () => {
  it("leaves a geometry within ±180 as it is, whatever its shape", () => {
    const river: LineString = {
      type: "LineString",
      coordinates: [
        [170, 10],
        [180, 12],
        [-180, 12],
        [-170, 14],
      ],
    };
    expect(passesSeam(river)).toBe(false);
    expect(fitToSeam(river)).toBe(river);
  });

  it("cuts a river that runs east past 180 at the seam and shifts the far part in", () => {
    const river: LineString = {
      type: "LineString",
      coordinates: [
        [170, 10],
        [190, 20],
        [200, 20],
      ],
    };
    const fitted = fitToSeam(river) as MultiLineString;
    expect(fitted.type).toBe("MultiLineString");
    expect(fitted.coordinates).toEqual([
      [
        [170, 10],
        [180, 15],
      ],
      [
        [-180, 15],
        [-170, 20],
        [-160, 20],
      ],
    ]);
  });

  it("cuts a river that runs west past -180, as the generator's does down to about -203", () => {
    const river: LineString = {
      type: "LineString",
      coordinates: [
        [-170, 0],
        [-190, 10],
        [-203, 10],
      ],
    };
    const fitted = fitToSeam(river) as MultiLineString;
    expect(fitted.coordinates).toEqual([
      [
        [-170, 0],
        [-180, 5],
      ],
      [
        [180, 5],
        [170, 10],
        [157, 10],
      ],
    ]);
  });

  it("cuts a river that crosses and comes back into several parts", () => {
    const river: LineString = {
      type: "LineString",
      coordinates: [
        [170, 0],
        [190, 0],
        [170, 4],
      ],
    };
    const fitted = fitToSeam(river) as MultiLineString;
    expect(fitted.coordinates).toHaveLength(3);
    expect(lng(fitted).every((x) => Math.abs(x) <= 180)).toBe(true);
  });

  it("drops what is left of a line that is only a point on the far side", () => {
    const river: MultiLineString = {
      type: "MultiLineString",
      coordinates: [
        [
          [185, 0],
          [185, 0],
        ],
      ],
    };
    expect(fitToSeam(river)).toBeNull();
  });

  it("splits a polygon over the seam into the part either side, both inside ±180", () => {
    const polygon: Polygon = {
      type: "Polygon",
      coordinates: [
        [
          [170, 0],
          [190, 0],
          [190, 10],
          [170, 10],
          [170, 0],
        ],
      ],
    };
    const fitted = fitToSeam(polygon) as MultiPolygon;
    expect(fitted.type).toBe("MultiPolygon");
    expect(fitted.coordinates).toHaveLength(2);
    const [west, east] = fitted.coordinates.map((rings) => rings[0]!.map(([x]) => x!));
    expect(Math.min(...west!)).toBe(170);
    expect(Math.max(...west!)).toBe(180);
    expect(Math.min(...east!)).toBe(-180);
    expect(Math.max(...east!)).toBe(-170);
  });

  it("shifts a polygon that lies wholly past -180 back in", () => {
    const polygon: Polygon = {
      type: "Polygon",
      coordinates: [
        [
          [-203, 10],
          [-190, 10],
          [-190, 20],
          [-203, 20],
          [-203, 10],
        ],
      ],
    };
    const fitted = fitToSeam(polygon) as MultiPolygon;
    expect(fitted.coordinates).toHaveLength(1);
    expect(new Set(lng(fitted))).toEqual(new Set([157, 170]));
  });

  it("keeps a hole with the part it falls in", () => {
    const polygon: Polygon = {
      type: "Polygon",
      coordinates: [
        [
          [170, 0],
          [200, 0],
          [200, 30],
          [170, 30],
          [170, 0],
        ],
        [
          [175, 10],
          [176, 10],
          [176, 12],
          [175, 12],
          [175, 10],
        ],
      ],
    };
    const fitted = fitToSeam(polygon) as MultiPolygon;
    const holes = fitted.coordinates.map((rings) => rings.length - 1);
    expect(holes.sort()).toEqual([0, 1]);
  });

  it("cuts a ring of 200,000 positions without running out of stack", () => {
    const n = 200_000;
    const ring: Position[] = Array.from({ length: n }, (_, i) => {
      const angle = (i / n) * 2 * Math.PI;
      return [180 + 10 * Math.cos(angle), 10 * Math.sin(angle)];
    });
    ring.push(ring[0]!);
    const fitted = fitToSeam({ type: "Polygon", coordinates: [ring] }) as MultiPolygon;
    expect(fitted.coordinates).toHaveLength(2);
    expect(lng(fitted).every((x) => Math.abs(x) <= 180)).toBe(true);
  });
});
