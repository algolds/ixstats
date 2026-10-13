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
import {
  pruneWorldUploads,
  pruneWorldUploadsIfDue,
  WORLD_UPLOAD_MAX_AGE_MS,
} from "~/server/modules/maps/map-import.prune";
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

  it("does not keep the bundle of a world that was rolled back, nor one that was another kind of import", async () => {
    const db = fakeDb();
    const undone = await bundle("rolled back world", 40);
    const pipeline = await bundle("a pipeline's file", 45);
    appliedWorld(db, "r1", undone, { rolledBackAt: new Date(NOW - 35 * DAY) });
    appliedWorld(db, "r1", pipeline, { source: "pipeline", day: 45 });
    await pruneWorldUploads(db, NOW);
    expect(existsSync(uploadFile(undone))).toBe(false);
    expect(existsSync(uploadFile(pipeline))).toBe(false);
  });

  it("leaves uploads that are not world bundles, and anything its names don't make an upload", async () => {
    const png = await saveMapUpload(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]));
    age(png, 100);
    const stray = path.join(root, "uploads", "notes.txt");
    writeFileSync(stray, "not an upload");
    utimesSync(stray, new Date(NOW - 100 * DAY), new Date(NOW - 100 * DAY));
    await pruneWorldUploads(fakeDb(), NOW);
    expect(existsSync(uploadFile(png))).toBe(true);
    expect(existsSync(stray)).toBe(true);
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

  it("does nothing when the folder has no uploads", async () => {
    expect(await pruneWorldUploads(fakeDb(), NOW)).toEqual([]);
  });
});

describe("pruneWorldUploadsIfDue (started by a new upload)", () => {
  it("prunes, then not again within the hour, then again when the hour has passed", async () => {
    const db = fakeDb();
    const first = await bundle("one", 20);
    expect(await pruneWorldUploadsIfDue(db, NOW)).toEqual([first]);

    const second = await bundle("two", 20);
    expect(await pruneWorldUploadsIfDue(db, NOW + 59 * 60_000)).toBeNull();
    expect(existsSync(uploadFile(second))).toBe(true);
    expect(await pruneWorldUploadsIfDue(db, NOW + 61 * 60_000)).toEqual([second]);
  });

  it("shares the hour between processes, through the folder", async () => {
    await pruneWorldUploadsIfDue(fakeDb(), NOW);
    // another process, same folder, no memory of the first
    expect(await pruneWorldUploadsIfDue(fakeDb(), NOW + 60_000)).toBeNull();
  });
});
