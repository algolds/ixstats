import {
  CARRIER_POLE_LAT,
  clampFlatCenterLat,
  flatTileBounds,
  flatWorldCoverZoom,
  fromCarrier,
  fromCarrierLat,
  toCarrierGeoJSON,
  toCarrierLat,
} from "./flat-projection";

/** Web Mercator's y (radians) for a latitude: what MapLibre does with the carrier latitude. */
const mercatorY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));

describe("flat-projection", () => {
  it("draws every latitude where Plate Carrée puts it: Mercator y of the carrier = the latitude in radians", () => {
    for (const lat of [-89.9, -60, -12.5, 0, 33, 75, 89.9]) {
      expect(mercatorY(toCarrierLat(lat))).toBeCloseTo((lat * Math.PI) / 180, 10);
    }
  });

  it("round-trips latitudes and keeps longitude", () => {
    for (const lat of [-90, -45, 0, 10, 66, 90]) {
      expect(fromCarrierLat(toCarrierLat(lat))).toBeCloseTo(lat, 9);
    }
    expect(fromCarrier({ lng: 179.5, lat: toCarrierLat(-30) })).toEqual({
      lng: 179.5,
      lat: expect.closeTo(-30, 9),
    });
  });

  it("holds a read past a pole (the blank band above the flat world) at the pole", () => {
    expect(fromCarrierLat(80)).toBe(90);
    expect(fromCarrierLat(-85)).toBe(-90);
  });

  it("puts the poles inside Mercator's cut", () => {
    expect(CARRIER_POLE_LAT).toBeCloseTo(66.513, 3);
    expect(CARRIER_POLE_LAT).toBeLessThan(85.0511);
  });

  it("converts every coordinate of a feature collection and drops bounding boxes", () => {
    const out = toCarrierGeoJSON({
      type: "FeatureCollection",
      bbox: [-180, -90, 180, 90],
      features: [
        {
          type: "Feature",
          properties: { name: "cap" },
          geometry: {
            type: "MultiPolygon",
            coordinates: [
              [
                [
                  [-180, 70],
                  [180, 70],
                  [180, 90],
                  [-180, 90],
                  [-180, 70],
                ],
              ],
            ],
          },
        },
        {
          type: "Feature",
          properties: null,
          geometry: { type: "Point", coordinates: [5, -40, 12] },
        },
      ],
    });
    expect(out.bbox).toBeUndefined();
    const cap = out.features[0]!.geometry as { coordinates: number[][][][] };
    expect(cap.coordinates[0]![0]![2]).toEqual([180, expect.closeTo(CARRIER_POLE_LAT, 9)]);
    expect(out.features[0]!.properties).toEqual({ name: "cap" });
    expect((out.features[1]!.geometry as { coordinates: number[] }).coordinates).toEqual([
      5,
      expect.closeTo(toCarrierLat(-40), 9),
      12,
    ]);
  });

  it("covers a box with the 2:1 world", () => {
    expect(flatWorldCoverZoom(512, 256)).toBe(0);
    expect(flatWorldCoverZoom(1024, 100)).toBe(1);
    expect(flatWorldCoverZoom(300, 512)).toBe(1);
    expect(flatWorldCoverZoom(300, 1024)).toBe(2);
  });

  it("holds the camera so the view never passes a pole, and centres a view taller than the world", () => {
    // Zoom 1: the world is 1024 × 512 px. A 256 px view may centre down to ±45° (90° − 128 px of 512).
    expect(fromCarrierLat(clampFlatCenterLat(toCarrierLat(80), 1, 256))).toBeCloseTo(45, 9);
    expect(fromCarrierLat(clampFlatCenterLat(toCarrierLat(-20), 1, 256))).toBeCloseTo(-20, 9);
    expect(clampFlatCenterLat(toCarrierLat(30), 0, 600)).toBeCloseTo(0, 9);
  });

  it("gives a flat tile's true bounds, and none for a tile wholly past a pole", () => {
    expect(flatTileBounds(0, 0, 0)).toEqual({ west: -180, south: -90, east: 180, north: 90 });
    expect(flatTileBounds(1, 1, 0)).toEqual({ west: 0, south: 0, east: 180, north: 90 });
    // At zoom 2 the world fills the middle two rows; the outer rows are past the poles
    expect(flatTileBounds(2, 0, 0)).toBeNull();
    expect(flatTileBounds(2, 0, 3)).toBeNull();
    expect(flatTileBounds(2, 0, 1)).toEqual({ west: -180, south: 0, east: -90, north: 90 });
  });
});
