/**
 * @jest-environment node
 *
 * A realm's stored altitude bands as a zone grid for relief: drawn in zone order with no anti-aliasing (a pixel is
 * never a blend of two zones), across the antimeridian without a streak or a gap, and with the band limits the
 * features carry.
 */
import type { Feature, Geometry, Position } from "geojson";
import { loadAltitudeBands, rasterizeBands } from "~/server/modules/maps/realm-relief.bands";
import { fakeDb } from "./map-import-fakes";

const W = 512;
const H = 256;

const px = (lng: number) => Math.floor(((lng + 180) / 360) * W);
const py = (lat: number) => Math.floor(((90 - lat) / 180) * H);

const rect = (west: number, south: number, east: number, north: number): Position[] => [
  [west, south],
  [east, south],
  [east, north],
  [west, north],
  [west, south],
];

const band = (
  zone: number,
  coordinates: Position[][],
  extra: Record<string, number> = {}
): Feature<Geometry> => ({
  type: "Feature",
  properties: { zone: `zone_${zone}`, ...extra },
  geometry: { type: "Polygon", coordinates },
});

async function grid(features: Feature<Geometry>[]) {
  const result = await rasterizeBands(features, W, H);
  if (!result) throw new Error("no bands");
  return { ...result, at: (lng: number, lat: number) => result.zoneGrid[py(lat) * W + px(lng)]! };
}

const painted = (zoneGrid: Uint8Array, row: number) =>
  zoneGrid.subarray(row * W, (row + 1) * W).reduce((n, v) => n + (v > 0 ? 1 : 0), 0);

describe("rasterizeBands", () => {
  it("draws bands in zone order: a higher band covers the lower ones, the sea is 0", async () => {
    const g = await grid([
      band(8, [rect(-10, -5, 10, 5)]),
      band(0, [rect(-60, -30, 60, 30)]),
      band(3, [rect(-30, -15, 30, 15)]),
    ]);
    expect(g.at(100, 60)).toBe(0);
    expect(g.at(-50, 20)).toBe(1); // zone 0 is value 1
    expect(g.at(-20, 10)).toBe(4);
    expect(g.at(0, 0)).toBe(9);
    expect(g.zoneGrid.length).toBe(W * H);
  });

  it("reads Ixnay's subgroup names and band colours as well as generated zone ids", async () => {
    const polygon = (properties: Record<string, string>, west: number) => ({
      type: "Feature" as const,
      properties,
      geometry: { type: "Polygon" as const, coordinates: [rect(west, -10, west + 20, 10)] },
    });
    const g = await grid([
      polygon({ "ixmap-subgroup": "coastlines" }, -170),
      polygon({ "ixmap-subgroup": "Altitude-5" }, -120),
      polygon({ fill: "#9c7b50" }, -70), // Ixnay's zone 6 colour
    ]);
    expect([g.at(-160, 0), g.at(-110, 0), g.at(-60, 0)]).toEqual([1, 6, 7]);
  });

  it("gives an edge pixel one of the two neighbouring zones, never one in between", async () => {
    // A diagonal border between the lowest and the highest band, where anti-aliasing would blend them
    const g = await grid([
      band(1, [
        [
          [-90, -60],
          [90, -60],
          [90, 60],
          [-90, 60],
          [-90, -60],
        ],
      ]),
      band(8, [
        [
          [-90, -60],
          [90, 60],
          [-90, 60],
          [-90, -60],
        ],
      ]),
    ]);
    const seen = new Set(g.zoneGrid);
    expect([...seen].sort()).toEqual([0, 2, 9]);
  });

  it("closes a ring that jumps across the antimeridian instead of streaking round the world", async () => {
    // An island at 178°E to 178°W, stored as Ixnay stores one: longitudes jump from 178 to -178
    const g = await grid([
      band(2, [
        [
          [178, 10],
          [178, 20],
          [-178, 20],
          [-178, 10],
          [178, 10],
        ],
      ]),
    ]);
    const row = py(15);
    expect(g.zoneGrid[row * W]).toBe(3); // the west edge of the map
    expect(g.zoneGrid[row * W + W - 1]).toBe(3); // the east edge
    expect(g.at(0, 15)).toBe(0);
    // 4° of 360 in all, 2° each side of the seam: no streak round the world, no gap
    expect(Math.abs(painted(g.zoneGrid, row) - (W * 4) / 360)).toBeLessThanOrEqual(2);
  });

  it("draws a band whose longitudes run past 180 on both sides of the seam", async () => {
    const g = await grid([band(2, [rect(170, 10, 190, 20)])]);
    const row = py(15);
    expect(g.at(175, 15)).toBe(3);
    expect(g.at(-175, 15)).toBe(3);
    expect(g.at(0, 15)).toBe(0);
    expect(Math.abs(painted(g.zoneGrid, row) - (W * 20) / 360)).toBeLessThanOrEqual(2);
  });

  it("draws the parts of a multipolygon at both edges of the map", async () => {
    const g = await grid([
      {
        type: "Feature",
        properties: { zone: "zone_4" },
        geometry: {
          type: "MultiPolygon",
          coordinates: [[rect(-180, 40, -170, 50)], [rect(170, 40, 180, 50)]],
        },
      },
    ]);
    expect([g.at(-175, 45), g.at(175, 45), g.at(0, 45)]).toEqual([5, 5, 0]);
  });

  it("keeps a ring that circles a pole as it is", async () => {
    // Antarctica as maps store it: the coast from 180°W to 180°E, closed along the pole
    const g = await grid([
      band(1, [
        [
          [-180, -70],
          [-90, -72],
          [0, -70],
          [90, -72],
          [180, -70],
          [180, -90],
          [-180, -90],
          [-180, -70],
        ],
      ]),
    ]);
    expect(painted(g.zoneGrid, py(-80))).toBe(W);
    expect(painted(g.zoneGrid, py(-60))).toBe(0);
  });

  it("leaves a hole where a ring is cut out of a band", async () => {
    const g = await grid([band(4, [rect(-50, -30, 50, 30), rect(-10, -10, 10, 10)])]);
    expect(g.at(-30, 0)).toBe(5);
    expect(g.at(0, 0)).toBe(0);
  });

  it("returns each zone's limits, from the features that carry them and Ixnay's bands otherwise", async () => {
    const g = await grid([
      band(1, [rect(-50, -30, 50, 30)], { elevationMin: 40, elevationMax: 480 }),
      band(2, [rect(-20, -10, 20, 10)]),
    ]);
    expect(g.zones).toHaveLength(9);
    expect(g.zones[1]).toEqual({ min: 40, max: 480 });
    expect(g.zones[2]).toEqual({ min: 350, max: 499 });
    expect(g.zones[8]).toEqual({ min: 5000, max: 9999 });
  });

  it("returns null for a realm with no elevation bands", async () => {
    expect(await rasterizeBands([], W, H)).toBeNull();
    const land: Feature<Geometry> = {
      type: "Feature",
      properties: { zoneId: "land", "ixmap-subgroup": "coastlines" },
      geometry: { type: "Polygon", coordinates: [rect(-50, -30, 50, 30)] },
    };
    expect(await rasterizeBands([land], W, H)).toBeNull();
    const noGeometry: Feature<Geometry | null> = {
      type: "Feature",
      properties: { zone: "zone_3" },
      geometry: null,
    };
    expect(await rasterizeBands([noGeometry], W, H)).toBeNull();
  });
});

describe("loadAltitudeBands", () => {
  it("reads the realm's active altitude features from the geometry column", async () => {
    const db = fakeDb();
    const row = (over: object) => ({
      realmId: "realm_1",
      layerType: "altitudes",
      isActive: true,
      geometry: { type: "Polygon", coordinates: [rect(0, 0, 1, 1)] },
      properties: { zone: "zone_2" },
      geom_postgis: "not read",
      ...over,
    });
    db.mapLayer.rows.push(
      row({}),
      row({ realmId: "realm_2" }),
      row({ layerType: "climate" }),
      row({ isActive: false })
    );
    const features = await loadAltitudeBands(db, "realm_1");
    expect(db.mapLayer.findMany).toHaveBeenCalledWith({
      where: { realmId: "realm_1", layerType: "altitudes", isActive: true },
      select: { geometry: true, properties: true },
    });
    expect(features).toEqual([
      {
        type: "Feature",
        properties: { zone: "zone_2" },
        geometry: { type: "Polygon", coordinates: [rect(0, 0, 1, 1)] },
      },
    ]);
  });
});
