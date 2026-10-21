/**
 * Duplicating a map feature in the editor (`buildDuplicateInput`): the copy is renamed and offset so it never sits on
 * the original, keeps the feature's own fields, and is never a second national or subdivision capital nor a second
 * claim on the original's wiki page.
 */
import type { MultiPolygon, Polygon } from "geojson";
import { buildDuplicateInput, type EditorFeature } from "~/hooks/useMapEditor";

const OFFSET = 0.05;

const square: Polygon = {
  type: "Polygon",
  coordinates: [
    [
      [10, 20],
      [11, 20],
      [11, 21],
      [10, 21],
      [10, 20],
    ],
  ],
};
const islands: MultiPolygon = {
  type: "MultiPolygon",
  coordinates: [
    [
      [
        [0, 0],
        [1, 0],
        [0, 1],
        [0, 0],
      ],
    ],
    [
      [
        [5, 5],
        [6, 5],
        [5, 6],
        [5, 5],
      ],
    ],
  ],
};

const feature = (type: EditorFeature["type"], over: Partial<EditorFeature>): EditorFeature => ({
  id: `${type}-1`,
  type,
  name: "Riverdale",
  properties: {},
  ...over,
});

it.each([
  {
    type: "city" as const,
    over: {
      coordinates: [10, 20] as [number, number],
      properties: { cityType: "city", population: 50000, isNationalCapital: true, isSubdivisionCapital: true, wikiPageTitle: "Riverdale" },
    },
    nameField: "name",
    kept: { population: 50000, isNationalCapital: false, isSubdivisionCapital: false, wikiPageTitle: undefined },
  },
  {
    type: "poi" as const,
    over: { coordinates: [5, 15] as [number, number], properties: { category: "historical", icon: "tower" } },
    nameField: "name",
    kept: { category: "historical", icon: "tower" },
  },
  {
    type: "storyPin" as const,
    over: { coordinates: [7, 17] as [number, number], properties: { content: "A great battle", category: "battle", ixTimeYear: 1200 } },
    nameField: "title",
    kept: { content: "A great battle", category: "battle", ixTimeYear: 1200 },
  },
  {
    type: "mapLabel" as const,
    over: {
      coordinates: [3, 13] as [number, number],
      properties: { labelType: "mountain_range", fontSize: 18, rotation: 45, opacity: 0.9, minZoom: 5, maxZoom: 16 },
    },
    nameField: "text",
    kept: { labelType: "mountain_range", fontSize: 18, rotation: 45, opacity: 0.9, minZoom: 5, maxZoom: 16 },
  },
])("a copied $type is renamed in its $nameField, offset, and keeps its own fields", ({ type, over, nameField, kept }) => {
  const original = feature(type, over);
  const copy = buildDuplicateInput(original) as Record<string, unknown>;
  expect(copy[nameField]).toBe("Riverdale (copy)");
  const [lng, lat] = original.coordinates!;
  expect(copy.coordinates).toEqual([lng + OFFSET, lat + OFFSET]);
  expect(copy).toMatchObject(kept);
});

it.each([
  ["Polygon", square],
  ["MultiPolygon", islands],
])("a copied region (%s) moves every vertex of every ring and keeps its attributes", (_kind, geometry) => {
  const copy = buildDuplicateInput(
    feature("subdivision", { name: "Northshire", geometry, properties: { type: "province", level: 2, color: "#cc0000" } })
  );
  expect(copy).toMatchObject({ name: "Northshire (copy)", type: "province", level: 2, color: "#cc0000" });
  const flat = (g: Polygon | MultiPolygon) =>
    (g.type === "Polygon" ? [g.coordinates] : g.coordinates).flat(2) as number[][];
  const moved = flat(copy.geometry as Polygon | MultiPolygon);
  flat(geometry).forEach(([x, y], i) => {
    expect(moved[i]![0]).toBeCloseTo(x! + OFFSET, 8);
    expect(moved[i]![1]).toBeCloseTo(y! + OFFSET, 8);
  });
});
