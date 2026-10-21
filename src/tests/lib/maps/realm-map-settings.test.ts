import { EARTH_RADIUS_KM, scaleAreaToRadius, scaleDistanceToRadius } from "~/lib/maps/planet";
import {
  isMapBaseImageUrl,
  parseRealmMapSettings,
  realmRadiusKm,
  withRealmMapSettings,
} from "~/lib/maps/realm-map-settings";
const HALF_EARTH = EARTH_RADIUS_KM / 2;

describe("planet radius scaling", () => {
  it("scales distances with the radius and areas with its square", () => {
    expect(scaleDistanceToRadius(1000, HALF_EARTH)).toBeCloseTo(500);
    expect(scaleAreaToRadius(1000, HALF_EARTH)).toBeCloseTo(250);
    expect(scaleAreaToRadius(1000, EARTH_RADIUS_KM * 2)).toBeCloseTo(4000);
    expect(scaleAreaToRadius(1000)).toBe(1000);
  });
});

describe("Realm.settings.map", () => {
  it("reads each key on its own and drops malformed ones", () => {
    const settings = {
      maxNationsPerUser: 2,
      map: {
        radiusKm: 3000,
        attribution: "  Map by the Eurth community  ",
        baseImage: "javascript:alert(1)",
        defaultView: { center: [10, 200], zoom: 3 },
        projection: { kind: "equirectangular" },
        controlPoints: [[0, 0]],
      },
    };
    // A malformed projection and control points are dropped like any other malformed key.
    expect(parseRealmMapSettings(settings)).toEqual({
      radiusKm: 3000,
      attribution: "Map by the Eurth community",
    });
  });

  it("defaults the planet radius to Earth's, and refuses an implausible one", () => {
    expect(realmRadiusKm(null)).toBe(EARTH_RADIUS_KM);
    expect(realmRadiusKm({ map: { radiusKm: 12 } })).toBe(EARTH_RADIUS_KM);
    expect(realmRadiusKm({ map: { radiusKm: 8000 } })).toBe(8000);
  });

  it("takes a base image from https or the app's upload storage only", () => {
    expect(isMapBaseImageUrl("https://example.org/eurth.png")).toBe(true);
    expect(isMapBaseImageUrl("/images/uploads/uploaded_abc123.png")).toBe(true);
    expect(isMapBaseImageUrl("http://example.org/eurth.png")).toBe(false);
    expect(isMapBaseImageUrl("/images/uploads/../secret.png")).toBe(false);
    expect(isMapBaseImageUrl("data:image/png;base64,AAAA")).toBe(false);
  });

  it("changes the map keys and keeps every other setting", () => {
    const stored = { maxNationsPerUser: 3, map: { radiusKm: 3000, attribution: "Old" } };
    expect(
      withRealmMapSettings(stored, {
        attribution: null,
        defaultView: { center: [1, 2], zoom: 4 },
        radiusKm: undefined,
      })
    ).toEqual({
      maxNationsPerUser: 3,
      map: { radiusKm: 3000, defaultView: { center: [1, 2], zoom: 4 } },
    });
  });
});

describe("Realm.settings.map georeference", () => {
  it("saves a georeference without dropping the wiki map's keys", () => {
    const stored = {
      maxNationsPerUser: 2,
      map: { source: "iiwiki", file: "File:Eurth.png", radiusKm: 4000 },
    };
    expect(
      withRealmMapSettings(stored, {
        projection: "equirectangular",
        bounds: { west: -20, south: -10, east: 20, north: 10 },
        controlPoints: null,
      })
    ).toEqual({
      maxNationsPerUser: 2,
      map: {
        source: "iiwiki",
        file: "File:Eurth.png",
        radiusKm: 4000,
        projection: "equirectangular",
        bounds: { west: -20, south: -10, east: 20, north: 10 },
      },
    });
  });
});

describe("Realm.settings.map raster layers and climate key", () => {
  it("keeps a climate key with hex colours, and refuses a zone without one", () => {
    const climateKey = {
      system: "Köppen",
      zones: [{ code: "Af", name: "Tropical rainforest", color: "#0000fe" }],
    };
    expect(parseRealmMapSettings({ map: { climateKey } }).climateKey).toEqual(climateKey);
    expect(
      parseRealmMapSettings({
        map: {
          climateKey: { system: "Köppen", zones: [{ code: "Af", name: "x", color: "blue" }] },
        },
      })
    ).toEqual({});
  });
});
