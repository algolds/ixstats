/**
 * Where the World tab opens from: the realm's Manage page, the admin studio and the `?editor=world` address, and
 * the realm layers the "This realm's map" source hands the generator.
 */

import type { FeatureCollection } from "geojson";
import {
  WORLD_SANDBOX_HREF,
  isWorldSandbox,
  realmManageHref,
  realmWorldEditorHref,
  wantsRealmMapEditor,
  wantsRealmWorldEditor,
} from "~/lib/maps/realm-world-editor";
import { hasRealmBorders, landMaskLayersFrom } from "~/lib/worldgen/realm-land-mask";

const params = (query: string) => new URLSearchParams(query);

describe("editor entry addresses", () => {
  it("opens the World tab of a realm's map editor from ?editor=world", () => {
    expect(realmWorldEditorHref("eurth")).toBe("/maps?realm=eurth&editor=world");
    expect(realmWorldEditorHref("new world")).toBe("/maps?realm=new%20world&editor=world");
    expect(wantsRealmWorldEditor(params("realm=eurth&editor=world"))).toBe(true);
    expect(wantsRealmWorldEditor(params("realm=eurth&editor=labels"))).toBe(false);
    expect(wantsRealmWorldEditor(null)).toBe(false);
  });

  it("opens the editor itself for the labels address and the world address, and no other", () => {
    expect(wantsRealmMapEditor(params("editor=labels"))).toBe(true);
    expect(wantsRealmMapEditor(params("editor=world"))).toBe(true);
    expect(wantsRealmMapEditor(params("editor=other"))).toBe(false);
    expect(wantsRealmMapEditor(params("realm=eurth"))).toBe(false);
    expect(wantsRealmMapEditor(null)).toBe(false);
  });

  it("links the studio to the editor's sandbox", () => {
    expect(WORLD_SANDBOX_HREF).toBe("/admin/maps/editor?sandbox=1");
    expect(isWorldSandbox(params("sandbox=1"))).toBe(true);
    expect(isWorldSandbox(params("sandbox=0"))).toBe(false);
    expect(isWorldSandbox(params(""))).toBe(false);
    expect(isWorldSandbox(null)).toBe(false);
  });

  it("links to a section of the realm's Manage page", () => {
    expect(realmManageHref("eurth", "map-import")).toBe("/r/eurth/manage#map-import");
    expect(realmManageHref("new world", "claims")).toBe("/r/new%20world/manage#claims");
  });
});

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

  it("leaves out a layer that did not arrive", () => {
    const layers = landMaskLayersFrom({ political: collection(1) });
    expect(Object.keys(layers)).toEqual(["political"]);
    expect(landMaskLayersFrom(undefined)).toEqual({});
  });

  it("knows whether the realm has borders to keep", () => {
    expect(hasRealmBorders(landMaskLayersFrom({ political: collection(2) }))).toBe(true);
    expect(hasRealmBorders(landMaskLayersFrom({ political: collection(0) }))).toBe(false);
    expect(hasRealmBorders(landMaskLayersFrom({ background: collection(2) }))).toBe(false);
    expect(hasRealmBorders(landMaskLayersFrom(undefined))).toBe(false);
  });
});
