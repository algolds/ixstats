/** @jest-environment node */
/**
 * Dragging a ring's first vertex moves its closing duplicate too, so the ring stays closed.
 */
import type { Polygon } from "geojson";
import { moveVertex } from "~/lib/maps/border-editor";

const square: Polygon = {
  type: "Polygon",
  coordinates: [
    [
      [0, 0],
      [4, 0],
      [4, 4],
      [0, 4],
      [0, 0],
    ],
  ],
};

describe("moveVertex", () => {
  it("keeps the ring closed when vertex 0 moves", () => {
    const moved = moveVertex(
      square,
      { ringIndex: 0, vertexIndex: 0, coord: [0, 0] },
      [-1, -1]
    ) as Polygon;
    const ring = moved.coordinates[0]!;
    expect(ring[0]).toEqual([-1, -1]);
    expect(ring[ring.length - 1]).toEqual([-1, -1]);
  });

  it("leaves the closing vertex alone for other vertices", () => {
    const moved = moveVertex(
      square,
      { ringIndex: 0, vertexIndex: 2, coord: [4, 4] },
      [5, 5]
    ) as Polygon;
    const ring = moved.coordinates[0]!;
    expect(ring[2]).toEqual([5, 5]);
    expect(ring[ring.length - 1]).toEqual([0, 0]);
  });
});
