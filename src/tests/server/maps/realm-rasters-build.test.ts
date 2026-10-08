/**
 * @jest-environment node
 *
 * Building a realm's raster layer from a small generated globe: tiles land at the latitude the image shows them
 * (the high-latitude band included, where an image stretched without reprojection would be far off), the legend
 * is written, the grey copy is grey, a version is built once, and stale versions are pruned.
 */
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import {
  buildRealmRaster,
  pruneRasterVersions,
  rasterVersion,
} from "~/server/modules/maps/realm-rasters.build";
import { mercatorLatitude } from "~/lib/maps/raster-tiles";

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

async function legendImage(): Promise<Uint8Array> {
  const data = new Uint8Array(4 * 2 * 3).fill(0);
  data.set([200, 10, 10], 0);
  return new Uint8Array(
    await sharp(data, { raw: { width: 4, height: 2, channels: 3 } })
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
  it("writes the pyramid up to the image's width, rows at their Mercator latitude", async () => {
    const image = await globe();
    const result = await buildRealmRaster({ realmId: "r1", layerId: "geo", kind: "base", image });
    expect(result).toMatchObject({ maxZoom: 1, built: true, tiles: 5, legend: false });
    expect(readdirSync(path.join(root, "r1", "geo"))).toEqual([result.version]);

    // Every row of tile 1/0/0 (the northern half) shows the colour of its latitude, the 60–70°N band included
    const north = path.join(result.dir, "1", "0", "0.webp");
    for (let row = 2; row < 256; row += 3) {
      const lat = mercatorLatitude(row + 0.5, 512);
      if (Math.abs(lat - 60) < 1 || Math.abs(lat - 70) < 1) continue; // the band's soft edges
      expect([row, near(await pixel(north, 100, row), colourAt(lat))]).toEqual([row, true]);
    }
    expect(near(await pixel(path.join(result.dir, "1", "1", "1.webp"), 10, 10), BLUE)).toBe(true);
    expect(near(await pixel(path.join(result.dir, "0", "0", "0.webp"), 128, 200), BLUE)).toBe(true);
  });

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

  it("builds a version once and names it by its inputs", async () => {
    const image = await globe();
    const input = { realmId: "r1", layerId: "geo", kind: "overlay" as const, image };
    const first = await buildRealmRaster(input);
    const again = await buildRealmRaster(input);
    expect(again).toMatchObject({ version: first.version, built: false, tiles: 0 });
    expect(rasterVersion({ ...input, grey: true })).not.toBe(first.version);
    expect(rasterVersion({ ...input, kind: "base" })).not.toBe(first.version);
    expect(await buildRealmRaster({ ...input, force: true })).toMatchObject({ built: true });
  });

  it("writes the legend, and the grey copy greys tiles and legend alike", async () => {
    const result = await buildRealmRaster({
      realmId: "r1",
      layerId: "geo-grey",
      kind: "base",
      image: await globe(),
      legend: await legendImage(),
      grey: true,
    });
    expect(result.legend).toBe(true);
    expect(await pixel(path.join(result.dir, "legend.webp"), 0, 0)).toEqual([200, 200, 200]);
    const [r, g, b] = await pixel(path.join(result.dir, "1", "1", "1.webp"), 10, 10);
    expect([g, b]).toEqual([r, r]);
    expect(r).toBeGreaterThan(200); // blue's brightest channel
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
