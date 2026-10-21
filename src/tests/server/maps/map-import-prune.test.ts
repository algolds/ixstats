/** @jest-environment node */
/**
 * Pruning the stored world bundles: each "Use this world" check stores a 2 to 8 MB gzip in the map import folder, and
 * nothing else removes it. Bundles older than 14 days go, except the one each realm's latest applied world import
 * (and its relief rebuild) reads; other uploads are never touched, nor anything outside the folder; at most once an
 * hour, started by a new upload.
 */
jest.mock("~/env", () => ({
  env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test", CRON_ENABLED_JOBS: "" },
}));
jest.mock("~/server/db", () => ({ db: {} }));

import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { pruneWorldUploads, WORLD_UPLOAD_MAX_AGE_MS } from "~/server/modules/maps/map-import.prune";
import { saveMapUpload } from "~/server/modules/maps/map-import.storage";
import { fakeDb } from "./map-import-fakes";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 9, 12, 12, 0, 0);

let root: string;
let outside: string;
beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), "map-prune-"));
  outside = mkdtempSync(path.join(tmpdir(), "map-prune-outside-"));
  process.env.MAP_IMPORT_DIR = root;
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  rmSync(outside, { recursive: true, force: true });
  delete process.env.MAP_IMPORT_DIR;
});

const uploadFile = (id: string) => path.join(root, "uploads", id);
const age = (id: string, days: number) => {
  const at = new Date(NOW - days * DAY);
  utimesSync(uploadFile(id), at, at);
};
/** A stored gzip (a world bundle, as far as the folder can tell) `days` old; its upload id. */
async function bundle(label: string, days: number) {
  const id = await saveMapUpload(gzipSync(label));
  age(id, days);
  return id;
}

/** The import a realm's applied world left, and the job whose upload it read. */
function appliedWorld(
  db: ReturnType<typeof fakeDb>,
  realmId: string,
  uploadId: string,
  over: { source?: string; layerTypes?: string[]; rolledBackAt?: Date | null; day?: number } = {}
) {
  const jobId = `j_${uploadId.slice(0, 6)}`;
  db.mapImportJob.rows.push({ id: jobId, realmId, uploadId });
  db.mapImport.rows.push({
    id: `i_${jobId}`,
    realmId,
    jobId,
    layerTypes: over.layerTypes ?? ["political", "altitudes"],
    summary: { source: over.source ?? "world" },
    rolledBackAt: over.rolledBackAt ?? null,
    createdAt: new Date(NOW - (over.day ?? 20) * DAY),
  });
}

describe("pruneWorldUploads", () => {
  it("removes world bundles older than 14 days and keeps the newer ones", async () => {
    const old = await bundle("old world", 15);
    const fresh = await bundle("fresh world", 13);
    const removed = await pruneWorldUploads(fakeDb(), NOW);
    expect(removed).toEqual([old]);
    expect(existsSync(uploadFile(old))).toBe(false);
    expect(existsSync(uploadFile(fresh))).toBe(true);
    expect(WORLD_UPLOAD_MAX_AGE_MS).toBe(14 * DAY);
  });

  it("keeps the bundle of each realm's latest applied world import, and prunes the earlier ones", async () => {
    const db = fakeDb();
    const first = await bundle("first world", 40);
    const second = await bundle("second world", 30);
    const other = await bundle("another realm's world", 50);
    appliedWorld(db, "r1", first, { day: 40 });
    appliedWorld(db, "r1", second, { day: 30 });
    appliedWorld(db, "r2", other, { day: 50 });
    await pruneWorldUploads(db, NOW);
    expect(existsSync(uploadFile(first))).toBe(false);
    expect(existsSync(uploadFile(second))).toBe(true);
    expect(existsSync(uploadFile(other))).toBe(true);
  });

  it("keeps the bundle of a realm whose latest world import is older than the newest 1000 imports", async () => {
    const db = fakeDb();
    const mine = await bundle("an old realm's world", 40);
    appliedWorld(db, "r1", mine, { day: 40 });
    for (let i = 0; i < 1001; i++) {
      db.mapImport.rows.push({
        id: `busy_${i}`,
        realmId: "busy",
        jobId: null,
        layerTypes: ["political"],
        summary: { source: "pipeline" },
        rolledBackAt: null,
        createdAt: new Date(NOW - DAY + i),
      });
    }
    await pruneWorldUploads(db, NOW);
    expect(existsSync(uploadFile(mine))).toBe(true);
  });

  it("keeps the bundle the relief rebuild reads when a later world kept the realm's elevation", async () => {
    const db = fakeDb();
    const shaded = await bundle("world with elevation", 40);
    const fitted = await bundle("world fitted to the map", 30);
    appliedWorld(db, "r1", shaded, { day: 40 });
    appliedWorld(db, "r1", fitted, { day: 30, layerTypes: ["climate"] });
    await pruneWorldUploads(db, NOW);
    expect(existsSync(uploadFile(shaded))).toBe(true);
    expect(existsSync(uploadFile(fitted))).toBe(true);
  });
  it("never follows a link out of the folder", async () => {
    const target = path.join(outside, "precious.gz");
    writeFileSync(target, gzipSync("not an upload"));
    utimesSync(target, new Date(NOW - 100 * DAY), new Date(NOW - 100 * DAY));
    mkdirSync(path.join(root, "uploads"), { recursive: true });
    const linked = "a".repeat(64);
    symlinkSync(target, uploadFile(linked));
    await pruneWorldUploads(fakeDb(), NOW);
    expect(existsSync(target)).toBe(true);
    expect(existsSync(uploadFile(linked))).toBe(true);
  });

  it("does nothing when the uploads folder is a link to somewhere else", async () => {
    const elsewhere = path.join(outside, "uploads");
    mkdirSync(elsewhere);
    const file = path.join(elsewhere, "b".repeat(64));
    writeFileSync(file, gzipSync("a bundle in another folder"));
    utimesSync(file, new Date(NOW - 100 * DAY), new Date(NOW - 100 * DAY));
    symlinkSync(elsewhere, path.join(root, "uploads"));
    expect(await pruneWorldUploads(fakeDb(), NOW)).toEqual([]);
    expect(existsSync(file)).toBe(true);
  });

  it("counts the age from the last time the bundle was stored, so storing it again keeps it", async () => {
    const id = await bundle("a world uploaded again", 30);
    // The same bytes arrive again: the upload is the same id and its age starts over
    await saveMapUpload(gzipSync("a world uploaded again"));
    expect(await pruneWorldUploads(fakeDb(), Date.now())).toEqual([]);
    expect(existsSync(uploadFile(id))).toBe(true);
  });
});
