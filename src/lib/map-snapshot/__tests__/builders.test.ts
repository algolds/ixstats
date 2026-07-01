import { buildCountryLayers, type CountrySnapshotData } from "../builders";

/** Minimal fake MapLibre map that records sources/layers so we can assert output. */
function fakeMap() {
  const sources: Record<string, any> = {};
  const layers: string[] = [];
  return {
    sources,
    layers,
    addSource: (id: string, def: any) => {
      sources[id] = def.data;
    },
    addLayer: (def: any) => {
      layers.push(def.id);
    },
    hasImage: () => true, // skip addImage/createStarImage (no ImageData in jsdom)
    addImage: () => {},
  };
}

const worldPolitical: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [
    { type: "Feature", properties: { _countryId: "target" }, geometry: { type: "Point", coordinates: [0, 0] } },
    { type: "Feature", properties: { _countryId: "neighbor-a" }, geometry: { type: "Point", coordinates: [1, 1] } },
    { type: "Feature", properties: { _countryId: "neighbor-b" }, geometry: { type: "Point", coordinates: [2, 2] } },
  ],
};

const baseData: CountrySnapshotData = {
  countryId: "target",
  geometry: { type: "Polygon", coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] },
  worldPolitical,
  cities: [
    { id: "cap", name: "Capital", coordinates: [0, 0], isNationalCapital: true, population: 100000 },
    { id: "big", name: "Big City", coordinates: [1, 0], population: 900000 },
    { id: "small", name: "Small Town", coordinates: [0, 1], population: 10000 },
  ],
};

test("neighbours exclude the target country", () => {
  const map = fakeMap();
  buildCountryLayers(map as any, {} as any, baseData);
  const world = map.sources["snap-world"] as GeoJSON.FeatureCollection;
  const ids = world.features.map((f) => f.properties?._countryId);
  expect(ids).toEqual(["neighbor-a", "neighbor-b"]);
  expect(ids).not.toContain("target");
});

test("cities keep capital + large city, drop small town", () => {
  const map = fakeMap();
  buildCountryLayers(map as any, {} as any, baseData);
  const cities = map.sources["snap-cities"] as GeoJSON.FeatureCollection;
  const names = cities.features.map((f) => f.properties?.name).sort();
  expect(names).toEqual(["Big City", "Capital"]);
});

test("country fill + stroke always rendered when geometry present", () => {
  const map = fakeMap();
  buildCountryLayers(map as any, {} as any, baseData);
  expect(map.layers).toContain("snap-country-fill");
  expect(map.layers).toContain("snap-country-stroke");
});
