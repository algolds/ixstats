/**
 * @jest-environment node
 *
 * One real relief build, tiles included: a ridge of generator cells becomes the z0 to 5 pyramid of lossy WebP shading
 * without the tiles that hold none. (A pyramid takes seconds under Jest, so the rest of realm-relief's behaviour is
 * tested with the tile writer replaced, in realm-relief.test.ts.)
 */
jest.mock("~/env", () => ({
  env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test", CRON_ENABLED_JOBS: "" },
}));
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/lib/cache", () => ({
  ...jest.requireActual("~/lib/cache"),
  invalidateCache: jest.fn().mockResolvedValue(undefined),
}));

import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { buildRealmRelief } from "~/server/modules/maps/realm-relief";
import { fakeDb } from "./map-import-fakes";

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

it("writes the shaded tiles of z0 to 5 as lossy WebP and leaves the empty ones out", async () => {
  const db = fakeDb();
  db.realm.rows.push({ id: "r1", slug: "r1", name: "R1", mapVersion: 1, settings: {} });
  const entry = await buildRealmRelief(db, "r1", { cells: ridgeCells() });
  const dir = path.join(root, "r1", "relief", entry.version);

  // 1 + 4 + 16 + 64 + 256 + 1024 tiles in the pyramid; the sea and the poles are not among the files
  expect(entry.tiles + entry.skipped).toBe(1365);
  expect(webpFiles(dir)).toHaveLength(entry.tiles);
  expect(entry.skipped).toBeGreaterThan(entry.tiles);
  expect(webpFiles(path.join(dir, "5")).length).toBeLessThan(entry.tiles);
  expect(webpFiles(path.join(dir, "5"))).not.toContain(path.join("0", "0.webp")); // the Arctic
  expect(webpFiles(path.join(dir, "5"))).not.toContain(path.join("31", "31.webp")); // the Antarctic

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
      maxZoom: 5,
      order: 10,
    },
  ]);
});
