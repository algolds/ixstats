import { describe, it, expect } from "@jest/globals";
import {
  nextStorylineOrder,
  storyPlaceOptions,
} from "~/components/maps/editor/panels/storyline-helpers";
import type { EditorFeature } from "~/hooks/map-editor/editor-types";

const feature = (
  id: string,
  type: EditorFeature["type"],
  name: string,
  coordinates?: [number, number]
): EditorFeature => ({ id, type, name, coordinates, properties: {} });

describe("storyPlaceOptions (AT-14)", () => {
  it("offers the country's point features, cities first, then by name", () => {
    const options = storyPlaceOptions([
      feature("p1", "poi", "Old Fort", [3, 4]),
      feature("c2", "city", "Zeta", [1, 1]),
      feature("c1", "city", "Alpha", [2, 2]),
      feature("s1", "subdivision", "North"),
      feature("r1", "river", "Long River"),
      feature("c3", "city", "Unplaced"),
    ]);
    expect(options).toEqual([
      { value: "city:c1", label: "Alpha (City)", coordinates: [2, 2] },
      { value: "city:c2", label: "Zeta (City)", coordinates: [1, 1] },
      { value: "poi:p1", label: "Old Fort (POI)", coordinates: [3, 4] },
    ]);
  });
});

describe("nextStorylineOrder", () => {
  it("is one past the highest order, or the pin count when none is set", () => {
    expect(nextStorylineOrder([])).toBe(0);
    expect(nextStorylineOrder([{ storylineOrder: 0 }, { storylineOrder: 4 }])).toBe(5);
    expect(nextStorylineOrder([{ storylineOrder: null }, { storylineOrder: null }])).toBe(2);
  });
});
