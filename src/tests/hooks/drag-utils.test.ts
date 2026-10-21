/**
 * The maps editor's drag helpers: a drag starts past 4px, Shift-drags lock to the dominant axis (the vertex lands
 * on that line), editor shortcuts never fire while the user types (a Delete in a text box must not delete the
 * selected feature), and the neighbours a region edit snaps to are the other regions only.
 */
import type { Polygon } from "geojson";
import {
  axisLock,
  detectAxis,
  exceedsHysteresis,
  isKeyboardInputTarget,
} from "~/components/maps/editor/hooks/drag-utils";
import { buildNeighborGeometries } from "~/components/maps/editor/hooks/vertex-edit-geometry";
import type { EditorFeature } from "~/hooks/useMapEditor";

it.each([
  [{ x: 100, y: 100 }, false],
  [{ x: 102, y: 102 }, false], // 2.83px
  [{ x: 104, y: 100 }, true], // exactly 4px
  [{ x: 103, y: 103 }, true], // 4.24px
])("a pointer at %o has started a drag: %s", (to, started) => {
  expect(exceedsHysteresis({ x: 100, y: 100 }, to)).toBe(started);
});

it.each([
  [20, 2, "h", [15, 20]],
  [-30, 5, "h", [15, 20]],
  [2, 20, "v", [10, 25]],
  [4, -35, "v", [10, 25]],
  [10, 10, "d", [15, 25]],
  [20, 15, "d", [15, 25]],
] as const)("a drag of (%d, %d) locks to axis %s and lands on it", (dx, dy, axis, locked) => {
  expect(detectAxis(dx, dy)).toBe(axis);
  expect(axisLock([10, 20], axis === "d" ? [14, 26] : [15, 25], axis)).toEqual(locked);
});

it("leaves the pointer unconstrained without an axis", () => {
  expect(axisLock([10, 20], [15, 25], null)).toEqual([15, 25]);
});

it("treats inputs, textareas, selects and contenteditable as typing, and the map canvas as not", () => {
  const editable = document.createElement("div");
  editable.setAttribute("contenteditable", "true");
  const typing = [document.createElement("input"), document.createElement("textarea"), document.createElement("select"), editable];
  for (const el of typing) expect(isKeyboardInputTarget(el)).toBe(true);
  for (const el of [document.createElement("canvas"), document.createElement("div"), null]) {
    expect(isKeyboardInputTarget(el)).toBe(false);
  }
});

it("snaps a region edit to the other regions only, never to itself or to points", () => {
  const square: Polygon = {
    type: "Polygon",
    coordinates: [
      [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10],
        [0, 0],
      ],
    ],
  };
  const features: EditorFeature[] = [
    { id: "sub-1", name: "Editing", type: "subdivision", geometry: square, properties: {} },
    { id: "sub-2", name: "Neighbour", type: "subdivision", geometry: square, properties: {} },
    { id: "city-1", name: "City", type: "city", coordinates: [5, 5], properties: {} },
  ];
  const neighbours = buildNeighborGeometries(features, "sub-1");
  expect(neighbours.map((n) => n.id)).toEqual(["sub-2"]);
  expect(neighbours[0]!.geometry).toEqual(square);
});
