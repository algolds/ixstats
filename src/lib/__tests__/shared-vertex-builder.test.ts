/**
 * Tests for shared-vertex-builder.ts - Shared vertex detection and movement
 * for synchronizing edits across neighboring political features.
 *
 * Pure-function characterization tests; no React or database dependencies.
 */

import type { Polygon, Position } from "geojson";
import { buildSharedVertexIndex, moveSharedVertex } from "~/lib/maps/shared-vertex-builder;

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

describe("moveSharedVertex", () => {
  test("moves the coincident vertex in BOTH feature geometries", () => {
    // Same adjacent-squares fixture as above.
    const a = square(0, 0, 1, 1);
    const b = square(1, 0, 2, 1);
    const shared = buildSharedVertexIndex([
      { featureId: "A", geometry: a },
      { featureId: "B", geometry: b },
    ]);
    expect(shared).toHaveLength(2);

    // Pick one of the shared vertices (the one at [1,0]).
    const target = shared.find((sv) => sv.lng === 1 && sv.lat === 0);
    expect(target).toBeDefined();
    if (!target) throw new Error("shared vertex at [1,0] not found");

    const to: Position = [1.25, 0.5];
    const map = new Map<string, Polygon>([
      ["A", a],
      ["B", b],
    ]);
    const updated = moveSharedVertex(target, to, map);

    expect(updated.size).toBe(2);
    const newA = updated.get("A");
    const newB = updated.get("B");
    expect(newA).toBeDefined();
    expect(newB).toBeDefined();
    if (!newA || !newB) throw new Error("updated map missing one feature");

    // The moved vertex should be present at the referenced ring/vertex index
    // in BOTH updated geometries.
    for (const ref of target.featureRefs) {
      const geom = ref.featureId === "A" ? newA : newB;
      expect(geom.type).toBe("Polygon");
      const ring = geom.coordinates[ref.ringIndex]!;
      expect(ring[ref.vertexIndex]).toEqual(to);
    }
  });
});
