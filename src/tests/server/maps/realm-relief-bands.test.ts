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

  it("keeps a hole across the antimeridian cut out of its band, whichever side its first vertex is on", async () => {
    // Outer 170°E to 170°W, hole 177°E to 177°W, both stored with longitudes that jump 180 to -180
    const outer: Position[] = [
      [170, -10],
      [170, 10],
      [-170, 10],
      [-170, -10],
      [170, -10],
    ];
    const holes: Record<string, Position[]> = {
      "east of the seam": [
        [177, -3],
        [177, 3],
        [-177, 3],
        [-177, -3],
        [177, -3],
      ],
      "west of the seam": [
        [-177, -3],
        [177, -3],
        [177, 3],
        [-177, 3],
        [-177, -3],
      ],
    };
    for (const [first, hole] of Object.entries(holes)) {
      const g = await grid([band(4, [outer, hole])]);
      const seen = (lng: number, lat: number) => [first, g.at(lng, lat)];
      expect(seen(172, 0)).toEqual([first, 5]); // the band east of the hole
      expect(seen(-172, 0)).toEqual([first, 5]); // and west of it
      expect(seen(180, 6)).toEqual([first, 5]); // above the hole, on the seam
      expect(seen(179, 0)).toEqual([first, 0]); // the hole, east of the seam
      expect(seen(-179, 0)).toEqual([first, 0]); // and west of it
    }
  });
});

describe("loadAltitudeBands", () => {
  it("reads past the database guard's 1000-row cap (Ixnay has 4068 bands)", async () => {
    const db = fakeDb();
    for (let i = 0; i < 1001; i++) {
      db.mapLayer.rows.push({
        realmId: "realm_1",
        layerType: "altitudes",
        isActive: true,
        geometry: null,
        properties: { zone: "zone_1" },
      });
    }
    // fakeDb answers at most 1000 rows to a findMany with no take, as the guarded client does
    expect(await loadAltitudeBands(db, "realm_1")).toHaveLength(1001);
  });
});
