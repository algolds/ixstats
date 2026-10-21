/**
 * Where the World tab opens from: the realm's Manage page and the `?editor=world` address, and
 * the realm layers the "This realm's map" source hands the generator.
 */

import type { FeatureCollection } from "geojson";
import { hasRealmBorders, landMaskLayersFrom } from "~/lib/worldgen/realm-land-mask";
const collection = (n: number): FeatureCollection => ({
  type: "FeatureCollection",
  features: Array.from({ length: n }, () => ({
    type: "Feature",
    properties: {},
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 0],
        ],
      ],
    },
  })),
});

describe("landMaskLayersFrom", () => {
  it("hands over the background, political and altitude layers, and nothing else", () => {
    const [background, political, altitudes] = [collection(1), collection(2), collection(3)];
    const layers = landMaskLayersFrom({ rivers: collection(4), background, political, altitudes });
    expect(layers).toEqual({ background, political, altitudes });
  });
  it("knows whether the realm has borders to keep", () => {
    expect(hasRealmBorders(landMaskLayersFrom({ political: collection(2) }))).toBe(true);
    expect(hasRealmBorders(landMaskLayersFrom({ political: collection(0) }))).toBe(false);
    expect(hasRealmBorders(landMaskLayersFrom({ background: collection(2) }))).toBe(false);
    expect(hasRealmBorders(landMaskLayersFrom(undefined))).toBe(false);
  });
});
