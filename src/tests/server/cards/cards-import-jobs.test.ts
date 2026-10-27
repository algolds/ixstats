/** @jest-environment node */
/**
 * Server-side imports (cards refresh spec §2.4): every item is worked once, oldest job first; a wiki that stops
 * answering fails the job, keeps its items for Retry and is read no more in that run; a run never goes past its
 * time budget; every MediaWiki read of a run goes through one paced discovery client per wiki.
 */
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: {
    cardImportItem: {
      updateMany: jest.fn(async () => ({ count: 0 })),
      findMany: jest.fn(async () => []),
    },
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
import { DiscoveryStopped } from "~/lib/realms/sources/wiki-discovery-client";
import { DEFAULT_RARITY_THRESHOLDS } from "~/lib/cards/rarity-engine";
import {
  cancelImportJob,
  runImportJobs,
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
  status?: string;
  updatedAt?: { lt: Date };
  job?: { status: StatusFilter };
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
  const jobStatus = (item: ItemRow) => jobs.find((job) => job.id === item.jobId)?.status ?? "";
  const itemMatches = (item: ItemRow, where: ItemWhere) =>
    (where.id === undefined || item.id === where.id) &&
    (where.jobId === undefined || item.jobId === where.jobId) &&
    (where.status === undefined || item.status === where.status) &&
    (where.updatedAt === undefined || item.updatedAt < where.updatedAt.lt) &&
    (where.job === undefined || inStatus(jobStatus(item), where.job.status));
  const touch = (item: ItemRow, data: Partial<ItemRow>) =>
    Object.assign(item, data, { updatedAt: new Date() });
  /** The status writes to either table, and whether each ran inside an interactive transaction. */
  const writes: Array<{ write: string; inTx: boolean }> = [];
  let inTx = false;
  const note = (write: string) => writes.push({ write, inTx });
  const db = {
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
          note(`job ${data.status}`);
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
      update: jest.fn(
        async ({ where, data }: { where: { id: string }; data: Partial<ItemRow> }) => {
          note(`item ${data.status}`);
          return touch(
            items.find((item) => item.id === where.id)!,
            data
          );
        }
      ),
      count: jest.fn(
        async ({ where }: { where: { jobId: string; status: { in: string[] } } }) =>
          items.filter(
            (item) => item.jobId === where.jobId && where.status.in.includes(item.status)
          ).length
      ),
      findMany: jest.fn(async ({ where }: { where: ItemWhere }) =>
        items.filter((item) => itemMatches(item, where))
      ),
    },
    systemConfig: { findMany: jest.fn(async () => []) },
  };
  /** A transaction over the fake runs its work at once: a callback gets the fake itself, a batch is awaited. */
  const $transaction = jest.fn(
    async <T>(work: ((tx: typeof db) => Promise<T>) | Array<Promise<T>>) => {
      if (typeof work !== "function") return Promise.all(work);
      inTx = true;
      try {
        return await work(db);
      } finally {
        inTx = false;
      }
    }
  );
  return Object.assign(db, { $transaction, writes });
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
  it("fails the job and parks its item in one transaction, so a cancel after the stop counts every item", async () => {
    const jobs = [jobRow("j", 1)];
    const items = [itemRow("j", "A"), itemRow("j", "B")];
    const db = fakeDb(jobs, items);
    const error = jest.spyOn(console, "error").mockImplementation(() => undefined);
    await runImportJobs(
      db as never,
      deps(
        stageMock(async () => {
          throw stoppedBy403();
        })
      )
    );
    expect(
      db.writes.filter(({ write }) => write === "job FAILED" || write === "item QUEUED")
    ).toEqual([
      { write: "job FAILED", inTx: true },
      { write: "item QUEUED", inTx: true },
    ]);

    await cancelImportJob(db as never, "j");
    expect(jobs[0]).toMatchObject({ status: "CANCELLED", processed: 2, skipped: 2 });
    expect(jobs[0]!.processed).toBe(items.length);
    error.mockRestore();
  });
  it("keeps a long failure reason to 500 characters", async () => {
    const jobs = [jobRow("j", 1)];
    const items = [itemRow("j", "A")];
    const stage = stageMock(async () => ({ status: "FAILED", reason: "x".repeat(900) }));
    await runImportJobs(fakeDb(jobs, items) as never, deps(stage));
    expect(items[0]!.reason).toHaveLength(500);
  });
});
