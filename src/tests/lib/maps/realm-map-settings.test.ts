/** @jest-environment node */
import {
  readRealmGeoreference,
  readRealmMapSettings,
  withRealmMapSettings,
} from "~/lib/maps/realm-map-settings";

describe("readRealmMapSettings", () => {
  it("reads a realm with no settings, or no map key, as empty", () => {
    expect(readRealmMapSettings(null)).toEqual({});
    expect(readRealmMapSettings({ maxNationsPerUser: 2 })).toEqual({});
    expect(readRealmMapSettings({ map: "nonsense" })).toEqual({});
  });

  it("keeps the valid keys and drops a malformed one on its own", () => {
    const settings = {
      map: {
        radiusKm: 3000,
        projection: "mercator",
        bounds: { west: 10, south: -5, east: 5, north: 20 }, // west > east: dropped
        controlPoints: [
          { x: 0, y: 0, lon: -10, lat: 10 },
          { x: 100, y: 0, lon: 10, lat: 10 },
          { x: 0, y: 100, lon: -10, lat: -10 },
        ],
        attribution: "Map by someone",
        unknownKey: true,
      },
    };
    const read = readRealmMapSettings(settings);
    expect(read).toEqual({
      radiusKm: 3000,
      projection: "mercator",
      controlPoints: settings.map.controlPoints,
      attribution: "Map by someone",
    });
    expect(readRealmGeoreference(settings)).toEqual({
      projection: "mercator",
      controlPoints: settings.map.controlPoints,
    });
  });

  it("needs at least three control points", () => {
    expect(
      readRealmMapSettings({ map: { controlPoints: [{ x: 0, y: 0, lon: 0, lat: 0 }] } })
    ).toEqual({});
  });
});

describe("withRealmMapSettings", () => {
  it("sets and removes map keys, keeping every other key", () => {
    const stored = { maxNationsPerUser: 3, inWorldDate: { label: "x" }, map: { radiusKm: 4000, attribution: "a" } };
    const next = withRealmMapSettings(stored, {
      projection: "equirectangular",
      bounds: { west: -20, south: -10, east: 20, north: 10 },
      attribution: null,
    });
    expect(next).toEqual({
      maxNationsPerUser: 3,
      inWorldDate: { label: "x" },
      map: {
        radiusKm: 4000,
        projection: "equirectangular",
        bounds: { west: -20, south: -10, east: 20, north: 10 },
      },
    });
  });

  it("starts from an empty object when the settings are not one", () => {
    expect(withRealmMapSettings("bad", { projection: "mercator" })).toEqual({
      map: { projection: "mercator" },
    });
  });
});
