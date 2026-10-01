/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals": the hoisted jest.mock() factories rely on the ambient global.
//
// Plan 411, review M3: an upload of the same bytes and the mirror job that finishes with them at the same moment. The real upload
// service and the real mirror job run over the fake tables, whose advisory locks behave as PostgreSQL's (a transaction waits
// for the one that holds the key), MediaWiki is the scripted fake, and the staging directory is a real one. Before the fix, B
// found the file staged and skipped writing it, A's job released it before B's rows committed, and B's job went dead with
// "staged file is gone".
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: jest.requireActual("~/tests/helpers/fake-wiki-db").fakeWikiDb.db,
}));
jest.mock("~/lib/wiki-os/permissions", () => ({
  __esModule: true,
  ...jest.requireActual("~/lib/wiki-os/permissions"),
  authorizeAction: jest.fn().mockResolvedValue(undefined),
  requireRight: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("~/lib/wiki-os/services/mirror-outbox", () => ({
  __esModule: true,
  ...jest.requireActual("~/lib/wiki-os/services/mirror-outbox"),
  scheduleMirrorKick: jest.fn(),
}));
jest.mock("~/lib/wiki-os/services/render-service", () => ({
  enqueueRender: jest.fn(),
  invalidateDependents: jest.fn(),
}));
jest.mock("~/lib/wiki-os/services/watchlist-notify", () => ({
  notifyWatchers: jest.fn().mockResolvedValue(0),
}));
jest.mock("~/lib/wiki-os/guardian/cloudflare-guardian", () => ({
  CloudflareGuardian: { purgeArticleEdgeCache: jest.fn() },
}));
// the release can be held back by a test (see `holdRelease`)
jest.mock("~/lib/wiki-os/services/upload-staging", () => {
  const actual = jest.requireActual("~/lib/wiki-os/services/upload-staging");
  return { __esModule: true, ...actual, releaseStaged: jest.fn(actual.releaseStaged) };
});

import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { invalidateCsrfToken } from "~/lib/wiki-os/adapters/mediawiki/csrf-cache";
import { hashFile } from "~/lib/wiki-os/core/file-hash";
import { runUploadJob } from "~/lib/wiki-os/services/mirror-upload";
import { isStaged, releaseStaged } from "~/lib/wiki-os/services/upload-staging";
import { uploadFile } from "~/lib/wiki-os/services/upload-service";
import { API_URL, createFakeMediaWiki } from "~/tests/helpers/fake-mediawiki";
import { advisoryLocks, fakeWikiDb } from "~/tests/helpers/fake-wiki-db";

const { tables } = fakeWikiDb;
const realFetch = globalThis.fetch;
let directory: string;
let wiki: ReturnType<typeof createFakeMediaWiki>;

const be32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const BYTES = Uint8Array.from([
  0x89,
  0x50,
  0x4e,
  0x47,
  0x0d,
  0x0a,
  0x1a,
  0x0a,
  ...be32(13),
  ...Buffer.from("IHDR"),
  ...be32(8),
  ...be32(8),
  8,
  6,
  0,
  0,
  0,
  0xff,
  0x80,
]);
const SHA1 = hashFile(BYTES).base36;
const ctx = {
  auth: { userId: "clerk_1" },
  user: { id: "user-1", clerkUserId: "clerk_1", wikiUsername: "Heku" },
};

const upload = (filename: string, over: { ignoreWarnings?: boolean } = {}) =>
  uploadFile({ ctx, bytes: BYTES, filename, ...over });

const jobsOf = (title: string) =>
  tables.wikiMirrorJob.rows.filter((job) => job.kind === "upload" && job.title === title);

/** A held-back gate: `wait` resolves when `open` is called. */
function gate() {
  let open!: () => void;
  const wait = new Promise<void>((resolve) => (open = resolve));
  return { wait, open };
}

const tick = () => new Promise((resolve) => setImmediate(resolve));

beforeAll(() => {
  directory = mkdtempSync(join(tmpdir(), "wikios-staging-race-test-"));
  process.env.WIKIOS_UPLOAD_DIR = directory;
});

afterAll(() => {
  rmSync(directory, { recursive: true, force: true });
  delete process.env.WIKIOS_UPLOAD_DIR;
});

beforeEach(() => {
  fakeWikiDb.reset();
  for (const name of readdirSync(directory)) rmSync(join(directory, name), { force: true });
  invalidateCsrfToken();
  process.env.WIKIOS_MEDIAWIKI_API = API_URL;
  process.env.WIKIOS_MEDIAWIKI_BOT_USER = "WikiOSMirror@wikios";
  process.env.WIKIOS_MEDIAWIKI_BOT_TOKEN = "bot-password";
  wiki = createFakeMediaWiki();
  globalThis.fetch = wiki.fetch as unknown as typeof fetch;
  // MediaWiki holds nothing yet, and takes every upload
  wiki.on("query", ({ params }) => ({
    query: { pages: [{ title: params.titles ?? "", missing: true }] },
  }));
  wiki.on("upload", () => ({ upload: { result: "Success" } }));
  tables.user.seed({ id: "user-1", clerkUserId: "clerk_1" });
});

afterEach(() => {
  globalThis.fetch = realFetch;
  jest.restoreAllMocks();
});

describe("an upload and the mirror job of the same bytes, at the same moment (review M3)", () => {
  it("takes the file's advisory lock to record the rows and again to finish the job", async () => {
    await upload("Flag.png");
    const [first] = jobsOf("File:Flag.png");
    expect(advisoryLocks).toEqual([`wiki-upload:${SHA1}`]);

    await runUploadJob(first!);

    expect(advisoryLocks).toEqual([`wiki-upload:${SHA1}`, `wiki-upload:${SHA1}`]);
  });

  it("B records its rows while A's job finishes: A waits for B, sees its rows and keeps the file, and B's job finds it", async () => {
    await upload("Flag.png");
    const [jobA] = jobsOf("File:Flag.png");

    // B pauses inside its transaction, after it recorded its rows and holds the lock
    const inside = gate();
    const resume = gate();
    const log = tables.wikiLog.create.bind(tables.wikiLog);
    jest.spyOn(tables.wikiLog, "create").mockImplementation(async (args) => {
      const row = await log(args);
      inside.open();
      await resume.wait;
      return row;
    });
    const b = upload("Copy of the flag.png", { ignoreWarnings: true });
    await inside.wait;

    // A's job finishes meanwhile: it uploads to MediaWiki, then waits for the lock
    let aDone = false;
    const a = runUploadJob(jobA!).then(() => (aDone = true));
    for (let i = 0; i < 20; i++) await tick();
    expect(aDone).toBe(false);

    resume.open();
    await Promise.all([a, b]);
    // (the worker marks a job done once its handler returns)
    tables.wikiMirrorJob.rows.find((job) => job.id === jobA!.id)!.state = "done";

    // A's finish saw B's committed rows: the file stays, for B's job
    expect(await isStaged(SHA1)).toBe(true);
    const [jobB] = jobsOf("File:Copy of the flag.png");
    await expect(runUploadJob(jobB!)).resolves.toBeUndefined();
    // B's job is the last that needed the file
    expect(await isStaged(SHA1)).toBe(false);
  });

  it("A deletes the file first: B waits for the lock, finds the file gone and writes it again, and B's job finds it", async () => {
    await upload("Flag.png");
    const [jobA] = jobsOf("File:Flag.png");

    // A pauses inside its finish, holding the lock, just before it deletes the file
    const deleting = gate();
    const proceed = gate();
    const release = jest.mocked(releaseStaged);
    const real = release.getMockImplementation()!;
    release.mockImplementationOnce(async (sha1) => {
      deleting.open();
      await proceed.wait;
      return real(sha1);
    });
    const a = runUploadJob(jobA!);
    await deleting.wait;

    // B starts now: it does its checks, then waits for the lock
    const b = upload("Copy of the flag.png", { ignoreWarnings: true });
    for (let i = 0; i < 20; i++) await tick();
    expect(jobsOf("File:Copy of the flag.png")).toHaveLength(0);

    proceed.open();
    await Promise.all([a, b]);

    // the file A deleted is back, written by B under the lock, with B's rows
    expect(await isStaged(SHA1)).toBe(true);
    const [jobB] = jobsOf("File:Copy of the flag.png");
    expect(jobB).toMatchObject({ state: "pending" });
    await expect(runUploadJob(jobB!)).resolves.toBeUndefined();
    expect(wiki.calls().filter((call) => call.params.action === "upload")).toHaveLength(2);
  });

  it("an identical re-upload of a version still waiting for its job writes the file again if it is gone", async () => {
    await upload("Flag.png");
    rmSync(join(directory, SHA1));
    expect(await isStaged(SHA1)).toBe(false);

    const result = await upload("Flag.png", { ignoreWarnings: true });

    expect(result).toMatchObject({ result: "Success", noChange: true });
    expect(await isStaged(SHA1)).toBe(true);
    // ... and nothing was queued for it
    expect(jobsOf("File:Flag.png")).toHaveLength(1);
  });

  it("an identical re-upload of a version MediaWiki already holds writes nothing", async () => {
    await upload("Flag.png");
    const [job] = jobsOf("File:Flag.png");
    await runUploadJob(job!);
    expect(await isStaged(SHA1)).toBe(false);

    const result = await upload("Flag.png", { ignoreWarnings: true });

    expect(result).toMatchObject({ result: "Success", noChange: true });
    expect(await isStaged(SHA1)).toBe(false);
  });
});
