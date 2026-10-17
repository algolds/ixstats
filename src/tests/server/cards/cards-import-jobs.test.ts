/** @jest-environment node */
/**
 * Server-side imports (cards refresh spec §2.4): every item is worked once, oldest job first; a wiki that stops
 * answering fails the job, keeps its items for Retry and is read no more in that run; a run never goes past its
 * time budget; every MediaWiki read of a run goes through one paced discovery client per wiki.
 */
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: {
    cardImportItem: { updateMany: jest.fn(async () => ({ count: 0 })) },
    cardImportJob: { findFirst: jest.fn(async () => null) },
  },
}));
jest.mock("~/lib/system/job-lock", () => ({ withJobLock: jest.fn() }));
jest.mock("~/lib/realms/sources/wiki-discovery-client", () => ({
  ...jest.requireActual<typeof import("~/lib/realms/sources/wiki-discovery-client")>(
    "~/lib/realms/sources/wiki-discovery-client"
  ),
  createDiscoveryClient: jest.fn(),
}));

import { db as appDb } from "~/server/db";
import { withJobLock } from "~/lib/system/job-lock";
import {
  createDiscoveryClient,
  DiscoveryStopped,
} from "~/lib/realms/sources/wiki-discovery-client";
import { DEFAULT_RARITY_THRESHOLDS } from "~/lib/cards/rarity-engine";
import {
  cancelImportJob,
  createImportJob,
  importJobItems,
  kickImportRunner,
  listImportJobs,
  MAX_IMPORT_TITLES,
  retryImportJob,
  runImportJobs,
  runQueuedCardImports,
  type RunDeps,
  type StageItem,
} from "~/server/modules/cards/cards.import-jobs";
import type { ImportContext, StageOutcome } from "~/server/modules/cards/cards.importer";

interface JobRow {
  id: string;
  source: string;
  status: string;
  requestedBy: string | null;
  requireImage: boolean;
  createdAt: Date;
  processed: number;
  staged: number;
  skipped: number;
  blocked: number;
  failed: number;
  error: string | null;
}
interface ItemRow {
  id: string;
  jobId: string;
  title: string;
  status: string;
  reason: string | null;
  cardId?: string;
  rarity?: string;
  licence?: string | null;
  updatedAt: Date;
}
type Counter = "processed" | "staged" | "skipped" | "blocked" | "failed";
type StatusFilter = string | { in: string[] };
interface JobWhere {
  status: { in: string[] };
  id?: { notIn: string[] };
  source?: { notIn: string[] };
}
interface ItemWhere {
  id?: string;
  jobId?: string;
  status: string;
  updatedAt?: { lt: Date };
}
interface CreateData {
  source: string;
  kind: string;
  label: string;
  requestedBy: string | null;
  requireImage: boolean;
  total: number;
  items: { createMany: { data: Array<{ title: string }> } };
}

const MINUTE = 60_000;
const inStatus = (status: string, wanted?: StatusFilter) =>
  wanted === undefined ||
  (typeof wanted === "string" ? status === wanted : wanted.in.includes(status));

/** An in-memory stand-in for the two tables, with the compare-and-swap semantics the runner relies on. */
function fakeDb(jobs: JobRow[], items: ItemRow[]) {
  const jobMatches = (job: JobRow, where: JobWhere) =>
    inStatus(job.status, where.status) &&
    !(where.id?.notIn ?? []).includes(job.id) &&
    !(where.source?.notIn ?? []).includes(job.source);
  const itemMatches = (item: ItemRow, where: ItemWhere) =>
    (where.id === undefined || item.id === where.id) &&
    (where.jobId === undefined || item.jobId === where.jobId) &&
    item.status === where.status &&
    (where.updatedAt === undefined || item.updatedAt < where.updatedAt.lt);
  const touch = (item: ItemRow, data: Partial<ItemRow>) =>
    Object.assign(item, data, { updatedAt: new Date() });
  return {
    cardImportJob: {
      findFirst: jest.fn(
        async ({ where }: { where: JobWhere }) =>
          [...jobs]
            .sort((a, b) => +a.createdAt - +b.createdAt)
            .find((job) => jobMatches(job, where)) ?? null
      ),
      updateMany: jest.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string; status?: StatusFilter };
          data: Partial<JobRow>;
        }) => {
          const hit = jobs.filter(
            (job) => job.id === where.id && inStatus(job.status, where.status)
          );
          hit.forEach((job) => Object.assign(job, data));
          return { count: hit.length };
        }
      ),
      update: jest.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string };
          data: Record<string, { increment: number } | Date>;
        }) => {
          const job = jobs.find((row) => row.id === where.id)!;
          for (const [key, value] of Object.entries(data)) {
            if (!(value instanceof Date)) job[key as Counter] += value.increment;
          }
          return job;
        }
      ),
      create: jest.fn(async ({ data }: { data: CreateData }) => {
        const job: JobRow = {
          ...jobRow(`job_${jobs.length + 1}`, 0),
          source: data.source,
          requestedBy: data.requestedBy,
          requireImage: data.requireImage,
        };
        jobs.push(job);
        data.items.createMany.data.forEach(({ title }, i) =>
          items.push(itemRow(job.id, title, "QUEUED", `${job.id}_${i}`))
        );
        return { id: job.id };
      }),
      findMany: jest.fn(async () => jobs),
    },
    cardImportItem: {
      findFirst: jest.fn(
        async ({ where }: { where: ItemWhere }) =>
          items.find((item) => itemMatches(item, where)) ?? null
      ),
      updateMany: jest.fn(async ({ where, data }: { where: ItemWhere; data: Partial<ItemRow> }) => {
        const hit = items.filter((item) => itemMatches(item, where));
        hit.forEach((item) => touch(item, data));
        return { count: hit.length };
      }),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: Partial<ItemRow> }) =>
        touch(
          items.find((item) => item.id === where.id)!,
          data
        )
      ),
      count: jest.fn(
        async ({ where }: { where: { jobId: string; status: { in: string[] } } }) =>
          items.filter(
            (item) => item.jobId === where.jobId && where.status.in.includes(item.status)
          ).length
      ),
      findMany: jest.fn(async () => items),
    },
    systemConfig: { findMany: jest.fn(async () => []) },
  };
}

function jobRow(id: string, minutesAgo: number, status = "QUEUED", source = "iiwiki"): JobRow {
  return {
    id,
    source,
    status,
    requestedBy: "admin_db",
    requireImage: false,
    createdAt: new Date(Date.now() - minutesAgo * MINUTE),
    processed: 0,
    staged: 0,
    skipped: 0,
    blocked: 0,
    failed: 0,
    error: null,
  };
}
function itemRow(
  jobId: string,
  title: string,
  status = "QUEUED",
  id = `${jobId}:${title}`,
  minutesAgo = 0
): ItemRow {
  return {
    id,
    jobId,
    title,
    status,
    reason: null,
    updatedAt: new Date(Date.now() - minutesAgo * MINUTE),
  };
}

const staged: StageOutcome = { status: "STAGED", cardId: "c", rarity: "RARE", licence: null };
/** A typed stage mock, so its calls read as (db, source, input, context). */
const stageMock = (impl: StageItem = async () => staged) =>
  jest.fn<ReturnType<StageItem>, Parameters<StageItem>>(impl);
const fakeContext = (): ImportContext => ({
  query: jest.fn(),
  thresholds: DEFAULT_RARITY_THRESHOLDS.iiwiki,
});
const deps = (stage: StageItem, extra: Partial<RunDeps> = {}): RunDeps => ({
  stage,
  contextFor: async () => fakeContext(),
  ...extra,
});
const titlesStaged = (stage: ReturnType<typeof stageMock>) =>
  stage.mock.calls.map(([, , input]) => input.title);
const stoppedBy403 = () =>
  new DiscoveryStopped({
    kind: "blocked",
    status: 403,
    message: "iiwiki refused the request (HTTP 403)",
  });

beforeEach(() => jest.clearAllMocks());

describe("runImportJobs", () => {
  it("works every item once, oldest job first, then finishes each job with its counts", async () => {
    const jobs = [jobRow("new", 1, "QUEUED", "althistory"), jobRow("old", 10)];
    jobs[1]!.requireImage = true;
    const items = [itemRow("new", "B"), itemRow("old", "A1"), itemRow("old", "A2")];
    const stage = stageMock();
    const db = fakeDb(jobs, items);
    const result = await runImportJobs(db as never, deps(stage));

    expect(result.items).toBe(3);
    expect(db.cardImportJob.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: "asc" } })
    );
    expect(db.cardImportItem.findFirst).toHaveBeenCalledWith({
      where: { jobId: "old", status: "QUEUED" },
      orderBy: { id: "asc" },
    });
    expect(jobs[1]).toMatchObject({ startedAt: expect.any(Date), finishedAt: expect.any(Date) });
    expect(stage.mock.calls.map(([, source, input]) => [source, input])).toEqual([
      ["iiwiki", { title: "A1", requestedBy: "admin_db", jobId: "old", requireImage: true }],
      ["iiwiki", { title: "A2", requestedBy: "admin_db", jobId: "old", requireImage: true }],
      ["althistory", { title: "B", requestedBy: "admin_db", jobId: "new", requireImage: false }],
    ]);
    expect(jobs.map((j) => [j.id, j.status, j.staged, j.processed])).toEqual([
      ["new", "DONE", 1, 1],
      ["old", "DONE", 2, 2],
    ]);
    expect(items.map((i) => [i.status, i.cardId, i.rarity])).toEqual([
      ["STAGED", "c", "RARE"],
      ["STAGED", "c", "RARE"],
      ["STAGED", "c", "RARE"],
    ]);
  });

  it("records each outcome on its item and its counter", async () => {
    const jobs = [jobRow("j", 1)];
    const items = ["S", "K", "B", "F"].map((title) => itemRow("j", title));
    const outcomes: Record<string, StageOutcome> = {
      S: { status: "STAGED", cardId: "card_s", rarity: "EPIC", licence: "CC BY-SA 4.0" },
      K: { status: "SKIPPED", reason: "Already a card" },
      B: { status: "BLOCKED", reason: "Its art is licensed CC BY-NC 4.0" },
      F: { status: "FAILED", reason: "IIWiki answered HTTP 503." },
    };
    const stage = stageMock(async (_db, _source, input) => outcomes[input.title]!);
    const db = fakeDb(jobs, items);
    await runImportJobs(db as never, deps(stage));

    expect(items.map((i) => [i.status, i.reason, i.cardId, i.rarity, i.licence])).toEqual([
      ["STAGED", null, "card_s", "EPIC", "CC BY-SA 4.0"],
      ["SKIPPED", "Already a card", undefined, undefined, undefined],
      ["BLOCKED", "Its art is licensed CC BY-NC 4.0", undefined, undefined, undefined],
      ["FAILED", "IIWiki answered HTTP 503.", undefined, undefined, undefined],
    ]);
    expect(jobs[0]).toMatchObject({
      status: "DONE",
      processed: 4,
      staged: 1,
      skipped: 1,
      blocked: 1,
      failed: 1,
    });
    expect(db.cardImportJob.update).toHaveBeenCalledWith({
      where: { id: "j" },
      data: {
        processed: { increment: 1 },
        staged: { increment: 1 },
        heartbeatAt: expect.any(Date),
      },
    });
  });

  it("never stages an item another runner already claimed", async () => {
    const jobs = [jobRow("j", 1)];
    const items = [itemRow("j", "A"), itemRow("j", "B")];
    const db = fakeDb(jobs, items);
    // Another runner takes "A" between this runner's read and its claim.
    db.cardImportItem.findFirst.mockImplementationOnce(async () => {
      const row = items[0]!;
      const seen = { ...row };
      row.status = "PROCESSING";
      return seen;
    });
    const stage = stageMock();
    await runImportJobs(db as never, deps(stage));
    expect(titlesStaged(stage)).toEqual(["B"]);
    // The claim stamps its time, which tells a dead runner's item from a live one.
    expect(db.cardImportItem.updateMany).toHaveBeenCalledWith({
      where: { id: "j:B", status: "QUEUED" },
      data: { status: "PROCESSING", updatedAt: expect.any(Date) },
    });
  });

  it("puts back an item a dead runner left PROCESSING for longer than a lease, before it starts", async () => {
    const jobs = [jobRow("j", 10, "RUNNING")];
    const items = [itemRow("j", "A", "PROCESSING", "j:A", 6)];
    const stage = stageMock();
    await runImportJobs(fakeDb(jobs, items) as never, deps(stage));
    expect(titlesStaged(stage)).toEqual(["A"]);
    expect(items[0]!.status).toBe("STAGED");
    expect(jobs[0]!.status).toBe("DONE");
  });

  it("leaves a job whose last item another runner holds, and goes on to the next job", async () => {
    const jobs = [jobRow("held", 10, "RUNNING"), jobRow("next", 1)];
    const items = [itemRow("held", "A", "PROCESSING", "held:A", 1), itemRow("next", "B")];
    const stage = stageMock();
    await runImportJobs(fakeDb(jobs, items) as never, deps(stage));
    expect(titlesStaged(stage)).toEqual(["B"]);
    expect(items[0]!.status).toBe("PROCESSING");
    expect(jobs.map((j) => j.status)).toEqual(["RUNNING", "DONE"]);
  });

  it("fails the job when its wiki stops answering, keeps the item for Retry, and reads that wiki no more", async () => {
    const jobs = [
      jobRow("j", 3),
      jobRow("same wiki", 2),
      jobRow("other wiki", 1, "QUEUED", "althistory"),
    ];
    const items = [
      itemRow("j", "A"),
      itemRow("j", "B"),
      itemRow("same wiki", "C"),
      itemRow("other wiki", "D"),
    ];
    const db = fakeDb(jobs, items);
    const error = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const stage = stageMock(async (_db, source) => {
      if (source === "iiwiki") throw stoppedBy403();
      return staged;
    });
    const result = await runImportJobs(db as never, deps(stage));

    expect(titlesStaged(stage)).toEqual(["A", "D"]);
    expect(result.items).toBe(1);
    expect(jobs.map((j) => [j.id, j.status, j.error, j.processed])).toEqual([
      ["j", "FAILED", "IIWiki stopped answering (HTTP 403).", 0],
      ["same wiki", "QUEUED", null, 0],
      ["other wiki", "DONE", null, 1],
    ]);
    expect(items.map((i) => i.status)).toEqual(["QUEUED", "QUEUED", "QUEUED", "STAGED"]);
    expect(error).toHaveBeenCalledWith(
      '[Card imports] IIWiki stopped answering for "A": iiwiki refused the request (HTTP 403)'
    );

    expect(jobs[0]).toMatchObject({ finishedAt: expect.any(Date) });
    await retryImportJob(db as never, "j");
    expect(jobs[0]).toMatchObject({ status: "QUEUED", error: null, finishedAt: null });
    error.mockRestore();
  });

  it("skips the item a stopped wiki was reading when an admin cancelled the job meanwhile", async () => {
    const jobs = [jobRow("j", 1)];
    const items = [itemRow("j", "A"), itemRow("j", "B")];
    const db = fakeDb(jobs, items);
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    const stage = stageMock(async () => {
      await cancelImportJob(db as never, "j");
      throw stoppedBy403();
    });
    await runImportJobs(db as never, deps(stage));
    expect(jobs[0]!.status).toBe("CANCELLED");
    expect(items.map((i) => [i.status, i.reason])).toEqual([
      ["SKIPPED", "Cancelled"],
      ["SKIPPED", "Cancelled"],
    ]);
    jest.mocked(console.error).mockRestore();
  });

  it("records an item whose stage throws as failed and goes on", async () => {
    const jobs = [jobRow("j", 1)];
    const items = [itemRow("j", "A"), itemRow("j", "B")];
    const error = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const failure = new Error("database went away");
    const stage = stageMock().mockRejectedValueOnce(failure);
    await runImportJobs(fakeDb(jobs, items) as never, deps(stage));
    expect(items.map((i) => [i.status, i.reason])).toEqual([
      ["FAILED", "database went away"],
      ["STAGED", null],
    ]);
    expect(jobs[0]).toMatchObject({ status: "DONE", failed: 1, staged: 1 });
    expect(error).toHaveBeenCalledWith('[Card imports] Staging "A" failed:', failure);
    error.mockRestore();
  });

  it("keeps a long failure reason to 500 characters", async () => {
    const jobs = [jobRow("j", 1)];
    const items = [itemRow("j", "A")];
    const stage = stageMock(async () => ({ status: "FAILED", reason: "x".repeat(900) }));
    await runImportJobs(fakeDb(jobs, items) as never, deps(stage));
    expect(items[0]!.reason).toHaveLength(500);
  });

  it("stops taking items once its time budget is spent", async () => {
    const jobs = [jobRow("j", 1)];
    const items = [itemRow("j", "A"), itemRow("j", "B")];
    let clock = 0;
    const stage = stageMock(async () => {
      clock += 4 * MINUTE;
      return staged;
    });
    await runImportJobs(fakeDb(jobs, items) as never, deps(stage, { now: () => clock }));
    expect(titlesStaged(stage)).toEqual(["A"]);
    expect(items[1]!.status).toBe("QUEUED");
    expect(jobs[0]!.status).toBe("RUNNING");
  });

  it("fails a job whose source is not a card wiki, staging nothing", async () => {
    const jobs = [jobRow("j", 1, "QUEUED", "wikipedia")];
    const items = [itemRow("j", "A")];
    const stage = stageMock();
    await runImportJobs(fakeDb(jobs, items) as never, deps(stage));
    expect(stage).not.toHaveBeenCalled();
    expect(jobs[0]).toMatchObject({ status: "FAILED", error: 'Unknown source wiki "wikipedia"' });
  });

  it("stages a Commons job's files and an article wiki's pages", async () => {
    const jobs = [jobRow("files", 2, "QUEUED", "commons"), jobRow("pages", 1, "QUEUED", "ixwiki")];
    const items = [itemRow("files", "Flag of Elm.svg"), itemRow("pages", "Elm")];
    const stage = stageMock();
    await runImportJobs(fakeDb(jobs, items) as never, deps(stage));
    expect(stage.mock.calls.map(([, source]) => source)).toEqual(["commons", "ixwiki"]);
  });

  it("gives each wiki one paced discovery client per run, with the stored rarity table", async () => {
    const client = { query: jest.fn(), pace: jest.fn() };
    jest.mocked(createDiscoveryClient).mockReturnValue(client as never);
    const jobs = [jobRow("j", 2), jobRow("k", 1)];
    const items = [itemRow("j", "A"), itemRow("j", "B"), itemRow("k", "C")];
    const db = fakeDb(jobs, items);
    const contexts: ImportContext[] = [];
    const stage = stageMock(async (_db, _source, _input, context) => {
      contexts.push(context);
      return staged;
    });
    await runImportJobs(db as never, { stage });

    expect(createDiscoveryClient).toHaveBeenCalledTimes(1);
    expect(createDiscoveryClient).toHaveBeenCalledWith("iiwiki", { maxRequests: 1200 });
    expect(contexts).toHaveLength(3);
    expect(new Set(contexts).size).toBe(1);
    expect(contexts[0]).toEqual({
      query: client.query,
      pace: client.pace,
      thresholds: DEFAULT_RARITY_THRESHOLDS.iiwiki,
    });
    expect(db.systemConfig.findMany).toHaveBeenCalled();
  });

  it("asks only for items left PROCESSING longer than a lease", async () => {
    const db = fakeDb([], []);
    await runImportJobs(db as never, deps(stageMock(), { now: () => 10 * MINUTE }));
    expect(db.cardImportItem.updateMany).toHaveBeenCalledWith({
      where: { status: "PROCESSING", updatedAt: { lt: new Date(5 * MINUTE) } },
      data: { status: "QUEUED" },
    });
  });
});

describe("runQueuedCardImports", () => {
  it("runs the queue against the app's database", async () => {
    await expect(runQueuedCardImports()).resolves.toEqual({ items: 0 });
    expect(jest.mocked(appDb.cardImportJob.findFirst)).toHaveBeenCalled();
  });
});

describe("kickImportRunner", () => {
  const flush = () => new Promise((resolve) => setImmediate(resolve));

  it("starts a run under the import lease", async () => {
    const lock = jest.mocked(withJobLock);
    lock.mockImplementation(async (_db, _name, run) => ({
      ran: true as const,
      result: await run(),
    }));
    const db = fakeDb([], []);
    kickImportRunner(db as never);
    await flush();
    expect(lock).toHaveBeenCalledWith(db, "card-import-jobs", expect.any(Function), {
      timeoutMs: 5 * MINUTE,
    });
    expect(db.cardImportJob.findFirst).toHaveBeenCalled();
  });

  it("logs a failed run instead of throwing", async () => {
    const failure = new Error("lease table missing");
    jest.mocked(withJobLock).mockRejectedValue(failure);
    const error = jest.spyOn(console, "error").mockImplementation(() => undefined);
    kickImportRunner(fakeDb([], []) as never);
    await flush();
    expect(error).toHaveBeenCalledWith("[Card imports] Run failed:", failure);
    error.mockRestore();
  });
});

describe("job lifecycle", () => {
  it("creates one item per distinct trimmed title, and refuses an empty import", async () => {
    const jobs: JobRow[] = [];
    const items: ItemRow[] = [];
    const db = fakeDb(jobs, items);
    const created = await createImportJob(db as never, {
      source: "iiwiki",
      kind: "MANUAL",
      label: "Category:Elm",
      titles: [" A ", "A", "B", ""],
      requestedBy: "admin_db",
    });
    expect(created).toEqual({ jobId: "job_1", queued: 2 });
    expect(items.map((i) => i.title)).toEqual(["A", "B"]);
    expect(db.cardImportJob.create).toHaveBeenCalledWith({
      data: {
        source: "iiwiki",
        kind: "MANUAL",
        label: "Category:Elm",
        requestedBy: "admin_db",
        requireImage: false,
        total: 2,
        items: { createMany: { data: [{ title: "A" }, { title: "B" }] } },
      },
      select: { id: true },
    });
    await expect(
      createImportJob(db as never, {
        source: "iiwiki",
        kind: "MANUAL",
        label: "x",
        titles: ["  "],
        requestedBy: null,
      })
    ).rejects.toThrow(/at least one page/);
  });

  it("keeps at most the title cap and a 200-character label", async () => {
    const db = fakeDb([], []);
    const titles = Array.from({ length: MAX_IMPORT_TITLES + 5 }, (_, i) => `Page ${i}`);
    const created = await createImportJob(db as never, {
      source: "ixwiki",
      kind: "DAILY",
      label: "L".repeat(300),
      titles,
      requestedBy: null,
      requireImage: true,
    });
    expect(created.queued).toBe(MAX_IMPORT_TITLES);
    const { data } = db.cardImportJob.create.mock.calls[0]![0];
    expect(data).toMatchObject({ kind: "DAILY", requireImage: true, total: MAX_IMPORT_TITLES });
    expect(data.label).toHaveLength(200);
  });

  it("cancels a running job, skipping what is still queued, and refuses to cancel a finished one", async () => {
    const jobs = [jobRow("j", 1, "RUNNING"), jobRow("done", 2, "DONE")];
    const items = [itemRow("j", "A", "STAGED"), itemRow("j", "B")];
    const db = fakeDb(jobs, items);
    await cancelImportJob(db as never, "j");
    expect(jobs[0]).toMatchObject({ status: "CANCELLED", finishedAt: expect.any(Date) });
    expect(items.map((i) => [i.status, i.reason])).toEqual([
      ["STAGED", null],
      ["SKIPPED", "Cancelled"],
    ]);
    await expect(cancelImportJob(db as never, "done")).rejects.toThrow(/already finished/);
  });

  it("cancels a queued or failed job too", async () => {
    const jobs = [jobRow("q", 1), jobRow("f", 2, "FAILED")];
    const db = fakeDb(jobs, []);
    await cancelImportJob(db as never, "q");
    await cancelImportJob(db as never, "f");
    expect(jobs.map((j) => j.status)).toEqual(["CANCELLED", "CANCELLED"]);
  });

  it("retries only a failed job", async () => {
    const jobs = [jobRow("running", 1, "RUNNING"), jobRow("done", 2, "DONE")];
    const db = fakeDb(jobs, []);
    await expect(retryImportJob(db as never, "running")).rejects.toThrow(/Only a failed import/);
    await expect(retryImportJob(db as never, "done")).rejects.toThrow(/Only a failed import/);
    expect(jobs.map((j) => j.status)).toEqual(["RUNNING", "DONE"]);
  });

  it("lists the newest jobs, and a job's items in order, filtered by status", async () => {
    const db = fakeDb([], []);
    await listImportJobs(db as never);
    expect(db.cardImportJob.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    await importJobItems(db as never, "j", "FAILED");
    await importJobItems(db as never, "j");
    const select = {
      id: true,
      title: true,
      status: true,
      cardId: true,
      rarity: true,
      licence: true,
      reason: true,
    };
    expect(db.cardImportItem.findMany.mock.calls).toEqual([
      [{ where: { jobId: "j", status: "FAILED" }, orderBy: { id: "asc" }, take: 500, select }],
      [{ where: { jobId: "j" }, orderBy: { id: "asc" }, take: 500, select }],
    ]);
  });
});
