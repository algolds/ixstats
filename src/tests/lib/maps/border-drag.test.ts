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

describe("startBorderDrag", () => {
  it("finds the neighbour vertices that sit on the dragged one", () => {
    const start = startBorderDrag("A", A, { B, C }, ref(0, 1, [1, 0]));
    expect(start.at).toEqual([1, 0]);
    // B's (1,0) is its first and its closing vertex
    expect(start.partners).toEqual([
      { featureId: "B", ringIndex: 0, vertexIndex: 0 },
      { featureId: "B", ringIndex: 0, vertexIndex: 4 },
    ]);
  });

  it("has no partners for a vertex nobody else touches", () => {
    expect(startBorderDrag("A", A, { B, C }, ref(0, 0, [0, 0])).partners).toEqual([]);
  });
});

describe("dragBorderVertex", () => {
  it("moves the vertex and leaves the starting geometry as it was", () => {
    const start = startBorderDrag("A", A, { B, C }, ref(0, 0, [0, 0]));
    const before = JSON.stringify(A);

    const { geometry, moved, to } = dragBorderVertex(start, [-0.3, -0.2]);

    expect(to).toEqual([-0.3, -0.2]);
    expect(geometry.coordinates[0]![0]).toEqual([-0.3, -0.2]);
    expect(geometry.coordinates[0]![4]).toEqual([-0.3, -0.2]);
    expect(moved).toEqual({});
    expect(JSON.stringify(A)).toBe(before);
  });

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

  it("snaps to a neighbouring border vertex within range", () => {
    const start = startBorderDrag("A", A, { B, C }, ref(0, 0, [0, 0]));
    // C's corner (10,10) is nowhere near; B's (2,1) is 0.01 away
    const { to } = dragBorderVertex(start, [2.01, 1.0]);
    expect(to).toEqual([2, 1]);
  });

  it("does not snap back onto the vertex it is dragging (its neighbour copies stay put until commit)", () => {
    const start = startBorderDrag("A", A, { B, C }, ref(0, 1, [1, 0]));
    const { to } = dragBorderVertex(start, [1.02, 0.01]);
    expect(to).toEqual([1.02, 0.01]);
  });

  it("describes the dragged vertex and the edges around it for the overlay", () => {
    const start = startBorderDrag("A", A, { B, C }, ref(0, 1, [1, 0]));

    const { frame } = dragBorderVertex(start, [1.2, -0.1]);

    expect(frame.vertex).toEqual([1.2, -0.1]);
    expect(frame.geometry.coordinates[0]![1]).toEqual([1.2, -0.1]);
    // A: previous (0,0), the vertex, next (1,1). B: the same vertex seen from B's ring, once
    expect(frame.edges).toEqual([
      [
        [0, 0],
        [1.2, -0.1],
        [1, 1],
      ],
      [
        [1, 1],
        [1.2, -0.1],
        [2, 0],
      ],
    ]);
  });

  it("wraps the edges around the first vertex of a ring", () => {
    const start = startBorderDrag("A", A, { C }, ref(0, 0, [0, 0]));
    const { frame } = dragBorderVertex(start, [0.1, 0.1]);
    expect(frame.edges).toEqual([
      [
        [0, 1],
        [0.1, 0.1],
        [1, 0],
      ],
    ]);
  });
});
