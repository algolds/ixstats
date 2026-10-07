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
  realmRadiusKm,
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
    expect(parseRealmMapSettings(settings)).toEqual({
      radiusKm: 3000,
      attribution: "Map by the Eurth community",
      projection: { kind: "equirectangular" },
      controlPoints: [[0, 0]],
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
