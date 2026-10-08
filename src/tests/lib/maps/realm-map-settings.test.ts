import {
  EARTH_RADIUS_KM,
  haversineKm,
  polygonalAreaSqKm,
  scaleAreaToRadius,
  scaleDistanceToRadius,
} from "~/lib/maps/planet";
import {
  isMapBaseImageUrl,
  parseRealmMapSettings,
  realmGeoreference,
  realmRadiusKm,
  realmRasterLayers,
  withRealmMapSettings,
} from "~/lib/maps/realm-map-settings";
import {
  buildMeasureFeatures,
  formatDistance,
  measureTotalKm,
} from "~/components/maps/core/utils/measure-helpers";

const HALF_EARTH = EARTH_RADIUS_KM / 2;

describe("planet radius scaling", () => {
  it("scales distances with the radius and areas with its square", () => {
    expect(scaleDistanceToRadius(1000, HALF_EARTH)).toBeCloseTo(500);
    expect(scaleAreaToRadius(1000, HALF_EARTH)).toBeCloseTo(250);
    expect(scaleAreaToRadius(1000, EARTH_RADIUS_KM * 2)).toBeCloseTo(4000);
    expect(scaleAreaToRadius(1000)).toBe(1000);
  });

  it("measures great-circle distances on the given planet", () => {
    // A quarter of the equator is a quarter of the circumference, 2πr / 4.
    expect(haversineKm([0, 0], [90, 0])).toBeCloseTo((Math.PI * EARTH_RADIUS_KM) / 2, 3);
    expect(haversineKm([0, 0], [90, 0], 1000)).toBeCloseTo((Math.PI * 1000) / 2, 3);
  });

  it("the flat area helpers agree with scaleAreaToRadius", () => {
    const square = {
      type: "Polygon" as const,
      coordinates: [
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 1],
          [0, 0],
        ],
      ],
    };
    expect(polygonalAreaSqKm(square, HALF_EARTH)).toBeCloseTo(
      scaleAreaToRadius(polygonalAreaSqKm(square), HALF_EARTH),
      6
    );
  });

  it("the measure tool measures on the realm's planet", () => {
    const pts: [number, number][] = [
      [0, 0],
      [10, 0],
    ];
    expect(measureTotalKm(pts, HALF_EARTH)).toBeCloseTo(measureTotalKm(pts) / 2, 6);
    const label = buildMeasureFeatures(pts, HALF_EARTH).find((f) => f.properties?.kind === "label");
    expect(label?.properties?.text).toBe(formatDistance(measureTotalKm(pts) / 2));
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
  const points = [
    { x: 0, y: 0, lon: -10, lat: 10 },
    { x: 100, y: 0, lon: 10, lat: 10 },
    { x: 0, y: 100, lon: -10, lat: -10 },
  ];

  it("reads the projection, bounds and control points, dropping a malformed one on its own", () => {
    const settings = {
      map: {
        projection: "mercator",
        bounds: { west: 10, south: -5, east: 5, north: 20 }, // west > east
        controlPoints: points,
        source: "iiwiki",
        file: "File:Eurth.png",
      },
    };
    expect(parseRealmMapSettings(settings)).toEqual({
      projection: "mercator",
      controlPoints: points,
    });
    expect(realmGeoreference(settings)).toEqual({ projection: "mercator", controlPoints: points });
    expect(realmGeoreference(null)).toEqual({});
  });

  it("needs at least three control points", () => {
    expect(parseRealmMapSettings({ map: { controlPoints: points.slice(0, 2) } })).toEqual({});
  });

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
  const base = {
    id: "geography",
    label: "Geography",
    kind: "base",
    version: "0a1b2c3d",
    maxZoom: 5,
    legend: true,
  };

  it("keeps valid raster layers in their drawing order and drops a malformed list", () => {
    const parsed = parseRealmMapSettings({
      map: {
        rasterLayers: [
          { ...base, id: "currents", label: "Ocean currents", kind: "overlay", order: 2 },
          base,
          { ...base, id: "climate", label: "Climate", kind: "overlay", order: 1 },
        ],
      },
    });
    expect(realmRasterLayers(parsed).map((l) => l.id)).toEqual([
      "geography",
      "climate",
      "currents",
    ]);
    expect(parseRealmMapSettings({ map: { rasterLayers: [{ ...base, id: "../x" }] } })).toEqual({});
    expect(
      parseRealmMapSettings({ map: { rasterLayers: [base, { ...base, label: "Twice" }] } })
    ).toEqual({});
  });

  it("ignores a stored layer's old default-on flag: every map opens on its standard style", () => {
    const parsed = parseRealmMapSettings({ map: { rasterLayers: [{ ...base, defaultOn: true }] } });
    expect(parsed.rasterLayers).toEqual([base]);
  });

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
