/**
 * @jest-environment node
 *
 * A realm's stored altitude bands as a zone grid for relief: drawn in zone order with no anti-aliasing (a pixel is
 * never a blend of two zones), across the antimeridian without a streak or a gap, and with the band limits the
 * features carry.
 */
jest.mock("~/env", () => ({
  env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test", CRON_ENABLED_JOBS: "" },
}));
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/lib/maps/raster-tiles", () => ({
  ...jest.requireActual("~/lib/maps/raster-tiles"),
  RELIEF_MAX_ZOOM: 2,
}));
jest.mock("~/lib/cache", () => ({
  ...jest.requireActual("~/lib/cache"),
  invalidateCache: jest.fn().mockResolvedValue(undefined),
}));

import type { Feature, Geometry, Position } from "geojson";
import { loadAltitudeBands, rasterizeBands } from "~/server/modules/maps/realm-relief.bands";
import { fakeDb } from "./map-import-fakes";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { buildRealmRaster, pruneRasterVersions } from "~/server/modules/maps/realm-rasters.build";
import { readdirSync, readFileSync } from "node:fs";
import { buildRealmRelief } from "~/server/modules/maps/realm-relief";

const W = 512;
const H = 256;

const px = (lng: number) => Math.floor(((lng + 180) / 360) * W);
const py = (lat: number) => Math.floor(((90 - lat) / 180) * H);
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

/**
 *
 *
 * Building a realm's raster layer from a small generated globe: tiles land at the latitude the image shows them
 * (the high-latitude band included, where an image stretched without reprojection would be far off), the legend
 * is written, the grey copy is grey, a version is built once, and stale versions are pruned.
 */
describe("building a realm raster", () => {
  const W = 512;
  const H = 256;
  const RED = [220, 40, 40];
  const GREEN = [40, 200, 60];
  const BLUE = [30, 60, 220];
  /** Northern hemisphere red with a green band from 60°N to 70°N, southern hemisphere blue. */
  function colourAt(lat: number): number[] {
    if (lat >= 60 && lat < 70) return GREEN;
    return lat >= 0 ? RED : BLUE;
  }
  async function globe(width = W, height = H): Promise<Uint8Array> {
    const data = new Uint8Array(width * height * 3);
    for (let y = 0; y < height; y++) {
      const rgb = colourAt(90 - ((y + 0.5) / height) * 180);
      for (let x = 0; x < width; x++) data.set(rgb, (y * width + x) * 3);
    }
    return new Uint8Array(
      await sharp(data, { raw: { width, height, channels: 3 } })
        .png()
        .toBuffer()
    );
  }
  async function pixel(file: string, x: number, y: number): Promise<number[]> {
    const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true });
    const i = (y * info.width + x) * info.channels;
    return [...data.subarray(i, i + 3)];
  }
  const near = (actual: number[], expected: number[]) =>
    actual.every((v, i) => Math.abs(v - expected[i]!) <= 12);
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), "raster-build-"));
    process.env.MAP_RASTER_DIR = root;
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
    delete process.env.MAP_RASTER_DIR;
  });
  describe("buildRealmRaster", () => {
    it("puts the 60–70°N band where Web Mercator has it, not where a stretched image would", async () => {
      const result = await buildRealmRaster({
        realmId: "r1",
        layerId: "geo",
        kind: "base",
        image: await globe(),
      });
      const north = path.join(result.dir, "1", "0", "0.webp");
      // 65°N is row 133 of z1's northern tile; a plain stretch of ±85° over the tile would put it at row 30
      expect(near(await pixel(north, 50, 133), GREEN)).toBe(true);
      expect(near(await pixel(north, 50, 30), RED)).toBe(true);
    });
    it("refuses an image that is not a whole globe", async () => {
      await expect(
        buildRealmRaster({
          realmId: "r1",
          layerId: "geo",
          kind: "base",
          image: await globe(300, 256),
        })
      ).rejects.toThrow(/2:1/);
    });

    it("prunes every version but the ones kept", async () => {
      const a = await buildRealmRaster({
        realmId: "r1",
        layerId: "geo",
        kind: "base",
        image: await globe(),
      });
      const b = await buildRealmRaster({
        realmId: "r1",
        layerId: "geo",
        kind: "overlay",
        image: await globe(),
      });
      const c = await buildRealmRaster({
        realmId: "r1",
        layerId: "geo",
        kind: "base",
        image: await globe(),
        grey: true,
      });
      expect(await pruneRasterVersions("r1", "geo", [b.version, c.version])).toEqual([a.version]);
      expect(existsSync(a.dir)).toBe(false);
      expect(existsSync(c.dir)).toBe(true);
    });
  });
});

/**
 *
 *
 * One real relief build, tiles included: a ridge of generator cells becomes the pyramid of lossy WebP shading without
 * the tiles that hold none. The pyramid stops at z2 here (z5 in the app: its 1,365 tiles took 16 s under Jest); the
 * zoom limit itself is raster-tiles' to test. The rest of realm-relief's behaviour is tested with the tile writer
 * replaced, in realm-relief.test.ts.
 */
describe("the relief tile pyramid", () => {
  jest.setTimeout(120_000);
  let root: string;
  beforeAll(() => {
    root = mkdtempSync(path.join(tmpdir(), "realm-relief-tiles-"));
    process.env.MAP_RASTER_DIR = root;
  });
  afterAll(() => {
    rmSync(root, { recursive: true, force: true });
    delete process.env.MAP_RASTER_DIR;
  });
  /** A 3,000 m ridge along 0°E over 60°W–60°E and 30°S–30°N, on a 3° grid of cells. */
  function ridgeCells(): Float32Array {
    const cells: number[] = [];
    for (let lng = -60; lng <= 60; lng += 3) {
      for (let lat = -30; lat <= 30; lat += 3) {
        cells.push(lng, lat, 50 + 2950 * Math.exp(-((lng / 18) ** 2) - (lat / 24) ** 2));
      }
    }
    return new Float32Array(cells);
  }
  const webpFiles = (dir: string) =>
    readdirSync(dir, { recursive: true }).filter((f) => String(f).endsWith(".webp"));
  it("writes the shaded tiles of z0 to the top zoom as lossy WebP and leaves the empty ones out", async () => {
    const db = fakeDb();
    db.realm.rows.push({ id: "r1", slug: "r1", name: "R1", mapVersion: 1, settings: {} });
    const entry = await buildRealmRelief(db, "r1", { cells: ridgeCells() });
    const dir = path.join(root, "r1", "relief", entry.version);

    // 1 + 4 + 16 tiles in the pyramid; the sea and the poles are not among the files
    expect(entry.tiles + entry.skipped).toBe(21);
    expect(webpFiles(dir)).toHaveLength(entry.tiles);
    expect(entry.skipped).toBeGreaterThan(0);
    expect(webpFiles(path.join(dir, "2")).length).toBeLessThan(entry.tiles);
    expect(webpFiles(path.join(dir, "2"))).not.toContain(path.join("0", "0.webp")); // the Arctic
    expect(webpFiles(path.join(dir, "2"))).not.toContain(path.join("3", "3.webp")); // the Antarctic

    // Lossy (no VP8L chunk), 256 px, with shadow and light in it
    const file = path.join(dir, "2", "1", "2.webp");
    expect(readFileSync(file).includes("VP8L")).toBe(false);
    const { data, info } = await sharp(file)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    expect([info.width, info.height]).toEqual([256, 256]);
    expect(data.some((v, i) => i % 4 === 3 && v > 0)).toBe(true);

    expect(db.realm.rows[0].settings.map.rasterLayers).toEqual([
      {
        id: "relief",
        label: "Relief",
        kind: "overlay",
        version: entry.version,
        maxZoom: 2,
        order: 10,
      },
    ]);
  });
});
