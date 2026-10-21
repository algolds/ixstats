import type { Polygon, Position } from "geojson";
import { dragBorderVertex, startBorderDrag } from "~/lib/maps/border-drag";

const square = (x0: number, y0: number, x1: number, y1: number): Polygon => ({
  type: "Polygon",
  coordinates: [
    [
      [x0, y0],
      [x1, y0],
      [x1, y1],
      [x0, y1],
      [x0, y0],
    ],
  ],
});

// A and B share the edge x=1 between (1,0) and (1,1); C is far away.
const A = square(0, 0, 1, 1);
const B = square(1, 0, 2, 1);
const C = square(10, 10, 11, 11);

const ref = (ringIndex: number, vertexIndex: number, coord: Position) => ({
  ringIndex,
  vertexIndex,
  coord,
});
describe("dragBorderVertex", () => {
  it("carries the neighbours sharing the vertex, and only those", () => {
    const start = startBorderDrag("A", A, { B, C }, ref(0, 1, [1, 0]));

    const { geometry, moved } = dragBorderVertex(start, [1.2, -0.1]);

    expect(geometry.coordinates[0]![1]).toEqual([1.2, -0.1]);
    expect(Object.keys(moved)).toEqual(["B"]);
    expect(moved.B!.coordinates[0]![0]).toEqual([1.2, -0.1]);
    expect(moved.B!.coordinates[0]![4]).toEqual([1.2, -0.1]);
    expect(moved.B!.coordinates[0]![1]).toBe(B.coordinates[0]![1]);
  });

  it("is computed from the starting shapes, so frames do not accumulate", () => {
    const start = startBorderDrag("A", A, { B, C }, ref(0, 1, [1, 0]));
    dragBorderVertex(start, [1.4, -0.4]);
    const { geometry } = dragBorderVertex(start, [1.1, -0.1]);
    expect(geometry.coordinates[0]![1]).toEqual([1.1, -0.1]);
    expect(geometry.coordinates[0]![2]).toEqual([1, 1]);
  });
  it("does not snap back onto the vertex it is dragging (its neighbour copies stay put until commit)", () => {
    const start = startBorderDrag("A", A, { B, C }, ref(0, 1, [1, 0]));
    const { to } = dragBorderVertex(start, [1.02, 0.01]);
    expect(to).toEqual([1.02, 0.01]);
  });
});
