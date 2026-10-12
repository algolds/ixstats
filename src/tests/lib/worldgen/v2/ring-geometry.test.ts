/**
 * The pure-TS ring checks the polygon tests rely on: they must agree with exact arithmetic where the
 * exported coordinates (rounded to 1e-4) are collinear in decimal but not in binary.
 */

import type { Position } from "geojson";
import { generateWorld } from "~/lib/worldgen/v2/index";
import { DEFAULT_PARAMS } from "~/lib/worldgen/v2/config";
import { orient, ringFault, selfIntersections, segmentsMeet } from "~/tests/helpers/ring-geometry";

describe("ring-geometry orientation", () => {
  it("is exact for points that are collinear in decimal but not in binary", () => {
    // From an exported polar ring (earthlike seed 384, 1,500 cells): the double cross products come out as
    // 4.3e-19 or 0 depending on which point is the origin
    const p: Position[] = [
      [1.5271, -84.9908],
      [4.4015, -84.9904],
      [7.2759, -84.99],
      [10.1503, -84.9896],
    ];
    const signs = [
      orient(p[0]!, p[1]!, p[2]!),
      orient(p[1]!, p[2]!, p[3]!),
      orient(p[0]!, p[1]!, p[3]!),
      orient(p[0]!, p[2]!, p[3]!),
    ];
    // Exact arithmetic on the doubles: whichever way a point falls, it is the same from every origin
    expect(orient(p[2]!, p[0]!, p[1]!)).toBe(signs[0]);
    expect(orient(p[1]!, p[2]!, p[0]!)).toBe(signs[0]);
    expect(orient(p[2]!, p[1]!, p[0]!)).toBe(-signs[0]!);
    expect(signs.every((s) => s === -1 || s === 0 || s === 1)).toBe(true);
  });

  it("does not make segments with disjoint extents meet", () => {
    const p: Position[] = [
      [1.5271, -84.9908],
      [4.4015, -84.9904],
      [7.2759, -84.99],
      [10.1503, -84.9896],
    ];
    expect(segmentsMeet(p[0]!, p[1]!, p[2]!, p[3]!)).toBe(false);
    const ring: Position[] = [...p, [10.1503, -80], [1.5271, -80], p[0]!];
    expect(selfIntersections(ring)).toBe(0);
    expect(ringFault({ type: "Polygon", coordinates: [ring] })).toBeNull();
  });

  it("still finds real crossings, touches and spikes", () => {
    expect(segmentsMeet([0, 0], [2, 2], [0, 2], [2, 0])).toBe(true);
    expect(segmentsMeet([0, 0], [2, 0], [1, 0], [3, 0])).toBe(true);
    expect(segmentsMeet([0, 0], [1, 1], [1, 1], [2, 0])).toBe(true);
    expect(segmentsMeet([0, 0], [1, 1], [2, 2], [3, 3])).toBe(false);
    const bowtie: Position[] = [
      [0, 0],
      [2, 2],
      [2, 0],
      [0, 2],
      [0, 0],
    ];
    expect(selfIntersections(bowtie)).toBeGreaterThan(0);
    const spike: Position[] = [
      [0, 0],
      [4, 0],
      [2, 0],
      [2, 3],
      [0, 3],
      [0, 0],
    ];
    expect(selfIntersections(spike)).toBeGreaterThan(0);
  });

  it("reports no fault on the exported world whose rounded polar points were once flagged", () => {
    const world = generateWorld({ ...DEFAULT_PARAMS, seed: 384, cellCount: 1500 });
    for (const [name, layer] of Object.entries(world.layers)) {
      if (name === "rivers") continue;
      for (const feature of layer.features) {
        expect({ name, id: feature.id, fault: ringFault(feature.geometry) }).toEqual({
          name,
          id: feature.id,
          fault: null,
        });
      }
    }
  });
});
