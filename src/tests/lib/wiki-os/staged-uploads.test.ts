/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals": the hoisted jest.mock() factory relies on the ambient global.
//
// Plan 411, review: the orphan sweeper (a crash between staging and commit leaves a staged file nothing names), its hourly throttle,
// and the options of the lock transaction. The staging directory is a real temp directory, the tables an in-memory fake whose
// advisory locks queue as PostgreSQL's do.
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: jest.requireActual("~/tests/helpers/fake-wiki-db").fakeWikiDb.db,
}));

import { mkdtempSync, readdirSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { STAGED_FILE_PATH } from "~/lib/wiki-os/config";
import {
  STAGED_FILE_LOCK_NAMESPACE,
  STAGED_ORPHAN_AGE_MS,
  STAGED_SWEEP_INTERVAL_MS,
  STAGED_SWEEP_KEY,
  sweepStagedOrphans,
  sweepStagedOrphansIfDue,
  withStagedFileLock,
} from "~/lib/wiki-os/services/staged-uploads";
import { advisoryLocks, fakeWikiDb, transactionOptions } from "~/tests/helpers/fake-wiki-db";

const { tables } = fakeWikiDb;
const NOW = new Date("2026-10-01T12:00:00Z");
const hoursAgo = (hours: number) => new Date(NOW.getTime() - hours * 3_600_000);
/** A 31-character base-36 name, as the hash of a file is. */
const hash = (n: number) => `orphan${String(n).padStart(25, "0")}`;
let directory: string;

/** A file in the staging directory last written `hours` ago. */
const stage = (name: string, hours: number) => {
  const path = join(directory, name);
  writeFileSync(path, "bytes");
  utimesSync(path, hoursAgo(hours), hoursAgo(hours));
};
const left = () => readdirSync(directory).sort();

const servedAsset = (sha1: string) =>
  tables.wikiAsset.seed({
    filename: `${sha1}.png`,
    sha1,
    url: `${STAGED_FILE_PATH}${sha1}.png`,
  });
const uploadJob = (sha1: string, state: string) =>
  tables.wikiMirrorJob.seed({
    source: "ixwiki",
    kind: "upload",
    title: "File:Flag.png",
    state,
    payload: { sha1, comment: "c" },
  });

beforeAll(() => {
  directory = mkdtempSync(join(tmpdir(), "wikios-staged-uploads-test-"));
  process.env.WIKIOS_UPLOAD_DIR = directory;
});
afterAll(() => {
  rmSync(directory, { recursive: true, force: true });
  delete process.env.WIKIOS_UPLOAD_DIR;
});
beforeEach(() => {
  fakeWikiDb.reset();
  for (const name of readdirSync(directory)) rmSync(join(directory, name), { force: true });
});

describe("sweepStagedOrphans", () => {
  it("deletes a staged file older than a day that nothing needs, and keeps one just under that age", async () => {
    stage(hash(1), STAGED_ORPHAN_AGE_MS / 3_600_000 + 0.01);
    stage(hash(2), STAGED_ORPHAN_AGE_MS / 3_600_000 - 0.01);

    await expect(sweepStagedOrphans(NOW)).resolves.toBe(1);

    expect(left()).toEqual([hash(2)]);
  });

  it("keeps an old file an asset is still served from, and one an unfinished upload job names (a dead one included)", async () => {
    for (const n of [1, 2, 3, 4, 5]) stage(hash(n), 48);
    servedAsset(hash(1));
    uploadJob(hash(2), "pending");
    uploadJob(hash(3), "dead");
    uploadJob(hash(4), "done");

    await expect(sweepStagedOrphans(NOW)).resolves.toBe(2);

    // 4 (only a finished job names it) and 5 (nothing does) are orphans
    expect(left()).toEqual([hash(1), hash(2), hash(3)]);
  });

  it("deletes the temporary files of writes that never finished once they are a day old, and touches nothing else", async () => {
    stage(`${hash(1)}.abcdef012345.tmp`, 30);
    stage(`${hash(2)}.abcdef012345.tmp`, 1);
    stage("notes.txt", 100);
    stage("SHORT", 100);

    await sweepStagedOrphans(NOW);

    expect(left()).toEqual(["SHORT", `${hash(2)}.abcdef012345.tmp`, "notes.txt"].sort());
  });

  it("does nothing when nothing was ever staged: there is no directory yet", async () => {
    process.env.WIKIOS_UPLOAD_DIR = join(directory, "not-made-yet");

    await expect(sweepStagedOrphans(NOW)).resolves.toBe(0);

    process.env.WIKIOS_UPLOAD_DIR = directory;
  });

  it("judges each file under its own lock, and sees the rows of an upload that was recording them at that moment", async () => {
    stage(hash(1), 48);
    stage(hash(2), 48);
    let sweeping: Promise<number> | undefined;

    // an upload of the bytes of hash(1) holds the lock while it records its asset; the sweep starts meanwhile
    await withStagedFileLock(hash(1), async () => {
      advisoryLocks.length = 0;
      sweeping = sweepStagedOrphans(NOW);
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(left()).toEqual([hash(1), hash(2)].sort()); // it waits for hash(1)'s lock, and goes in order
      servedAsset(hash(1));
    });

    await expect(sweeping).resolves.toBe(1);
    expect(left()).toEqual([hash(1)]);
    expect(advisoryLocks).toEqual(
      expect.arrayContaining([
        `${STAGED_FILE_LOCK_NAMESPACE}:${hash(1)}`,
        `${STAGED_FILE_LOCK_NAMESPACE}:${hash(2)}`,
      ])
    );
  });
});

describe("sweepStagedOrphansIfDue", () => {
  it("sweeps at most once an hour, and remembers when", async () => {
    stage(hash(1), 48);

    await expect(sweepStagedOrphansIfDue(NOW)).resolves.toBe(1);
    expect(tables.systemConfig.rows[0]).toMatchObject({
      key: STAGED_SWEEP_KEY,
      value: NOW.toISOString(),
    });

    stage(hash(2), 48);
    const soon = new Date(NOW.getTime() + STAGED_SWEEP_INTERVAL_MS - 1);
    await expect(sweepStagedOrphansIfDue(soon)).resolves.toBeNull();
    expect(left()).toEqual([hash(2)]);

    const later = new Date(NOW.getTime() + STAGED_SWEEP_INTERVAL_MS);
    await expect(sweepStagedOrphansIfDue(later)).resolves.toBe(1);
    expect(left()).toEqual([]);
  });

  it("stores the time before it sweeps, so a sweep that fails waits for the next hour too", async () => {
    // a path below a file: listing it fails with ENOTDIR
    const file = join(directory, "plain-file");
    writeFileSync(file, "x");
    process.env.WIKIOS_UPLOAD_DIR = join(file, "staging");

    await expect(sweepStagedOrphansIfDue(NOW)).rejects.toThrow();
    expect(tables.systemConfig.rows[0]).toMatchObject({ value: NOW.toISOString() });
    await expect(sweepStagedOrphansIfDue(new Date(NOW.getTime() + 60_000))).resolves.toBeNull();

    process.env.WIKIOS_UPLOAD_DIR = directory;
  });
});

describe("withStagedFileLock", () => {
  it("gives its transaction a 30 second timeout (the default 5 s would cut a slow disk off mid-write)", async () => {
    await withStagedFileLock(hash(1), async () => undefined);

    expect(transactionOptions).toEqual([{ timeout: 30_000 }]);
  });
});
