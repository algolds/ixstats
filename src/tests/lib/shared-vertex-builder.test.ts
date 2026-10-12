/**
 * Tests for shared-vertex-builder.ts - Shared vertex detection
 * for synchronizing edits across neighboring political features.
 *
 * Pure-function characterization tests; no React or database dependencies.
 */

import type { Polygon, Position } from "geojson";
import { buildSharedVertexIndex } from "~/lib/maps/shared-vertex-builder";

/** Build a closed square ring (lng, lat) → [lng, lat] ring with closing duplicate. */
function square(minLng: number, minLat: number, maxLng: number, maxLat: number): Polygon {
  const ring: Position[] = [
    [minLng, minLat],
    [maxLng, minLat],
    [maxLng, maxLat],
    [minLng, maxLat],
    [minLng, minLat],
  ];
  return { type: "Polygon", coordinates: [ring] };
}

describe("buildSharedVertexIndex", () => {
  test("returns shared vertices for two unit squares sharing an edge", () => {
    // Square A: [0,0]-[1,0]-[1,1]-[0,1] (closed)
    // Square B: [1,0]-[2,0]-[2,1]-[1,1] (closed)
    // They share the edge from [1,0] to [1,1], i.e. two shared vertices.
    const a = square(0, 0, 1, 1);
    const b = square(1, 0, 2, 1);

    const shared = buildSharedVertexIndex([
      { featureId: "A", geometry: a },
      { featureId: "B", geometry: b },
    ]);

    expect(shared).toHaveLength(2);
    for (const sv of shared) {
      expect(sv.featureRefs).toHaveLength(2);
      const ids = sv.featureRefs.map((r) => r.featureId).sort();
      expect(ids).toEqual(["A", "B"]);
    }
    // Shared coordinates should be the endpoints of the shared edge.
    const coords = shared.map((sv) => [sv.lng, sv.lat]).sort();
    expect(coords).toEqual(
      [
        [1, 0],
        [1, 1],
      ].sort()
    );
  });

  test("returns [] when two squares share no vertices", () => {
    const a = square(0, 0, 1, 1);
    const b = square(5, 5, 6, 6);

    const shared = buildSharedVertexIndex([
      { featureId: "A", geometry: a },
      { featureId: "B", geometry: b },
    ]);

    expect(shared).toEqual([]);
  });

  test("only records vertices shared by 2+ features (not 1)", () => {
    // Even a single square has 4 vertices; with no neighbors, none should be shared.
    const a = square(0, 0, 1, 1);
    const shared = buildSharedVertexIndex([{ featureId: "A", geometry: a }]);
    expect(shared).toEqual([]);
  });
});
