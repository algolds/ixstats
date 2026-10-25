/** @jest-environment node */
/**
 * Plan 407: the mirror worker over an in-memory outbox. Jobs run oldest first and per title in order, the revision
 * jobs of a title that wait next in line go as one batch, a failure backs off, the 8th failed attempt makes a job
 * dead (a Discord warning, and its title is blocked), a busy lock means no work, and SKIP_MEDIAWIKI_SYNC stops the
 * worker with the jobs left in the outbox.
 */
import type { WikiMirrorJob } from "@prisma/client";
import {
  DEFAULT_DEADLINE_MS,
  LOCK_TIMEOUT_MS,
  MAX_CYCLE_MS,
  runMirrorCycle,
  runMirrorCycleLocked,
} from "~/lib/wiki-os/services/mirror-worker";
import { requestSignal } from "~/lib/wiki-os/adapters/mediawiki/attempt-scope";
import { ATTEMPT_TIMEOUT_MS, INTERRUPTED_AFTER_MS } from "~/lib/wiki-os/services/mirror-queue";
import { CRON_JOBS } from "~/server/cron/jobs";
import { executeRevisionBatch, planRevisionBatch } from "~/lib/wiki-os/services/mirror-revision";
import { checkCollision, type BatchCollision } from "~/lib/wiki-os/services/mirror-collision";
import { runPageJob } from "~/lib/wiki-os/services/mirror-page-ops";
import { runUploadJob } from "~/lib/wiki-os/services/mirror-upload";
import { invalidateTemplateDependents } from "~/lib/wiki-os/services/render-service";
import { sweepStagedOrphansIfDue } from "~/lib/wiki-os/services/staged-uploads";
import { discordWebhook } from "~/lib/discord/webhook";
import {
  alertDeadJobs,
  ATTEMPT_KEY,
  DEAD_ALERT_KEY,
  SATURATION_ALERT_KEY,
  SATURATION_ATTEMPT_KEY,
} from "~/lib/wiki-os/services/mirror-alerts";
import {
  discardDeadJobs,
  requeueDeadJobs,
  requeueMirrorJob,
} from "~/lib/wiki-os/services/mirror-admin";
import { WINDOW_SIZE } from "~/lib/wiki-os/services/mirror-queue";
import { withJobLock } from "~/lib/system/job-lock";
import { WIKIOS_MODES, seedWikiosMode } from "~/tests/helpers/wikios-modes";
import { db } from "~/server/db";

type Row = WikiMirrorJob;
let rows: Row[] = [];
/** Ids of jobs another runner claims just before this worker's claim. */
const racedClaims = new Set<string>();
/** Ids of jobs whose outcome cannot be stored (the database fails when the job is marked done). */
const storeFails = new Set<string>();
let counter = 0;
/** Runs once, right after the next read of the window (what another process does in between two reads). */
let afterWindowRead: (() => void) | null = null;

const matches = (row: Row, where: Record<string, unknown>): boolean =>
  Object.entries(where).every(([key, condition]) => {
    if (key === "OR")
      return (condition as Record<string, unknown>[]).some((one) => matches(row, one));
    const value = (row as unknown as Record<string, unknown>)[key];
    if (condition !== null && typeof condition === "object" && !(condition instanceof Date)) {
      const cond = condition as {
        not?: unknown;
        lt?: Date;
        gt?: Date;
        in?: unknown[];
        notIn?: unknown[];
        path?: string[];
        equals?: unknown;
      };
      if ("path" in cond) {
        const at = cond.path!.reduce<unknown>(
          (inner, step) => (inner as Record<string, unknown> | null)?.[step],
          value
        );
        return at === cond.equals;
      }
      if ("not" in cond) return value !== cond.not;
      if ("gt" in cond) return (value as Date) > (cond.gt as Date);
      if ("in" in cond) return (cond.in as unknown[]).includes(value);
      if ("notIn" in cond) return !(cond.notIn as unknown[]).includes(value);
      if ("lt" in cond) return (value as Date) < (cond.lt as Date);
    }
    return value === condition;
  });

const apply = (row: Row, data: Record<string, unknown>) => {
  for (const [key, value] of Object.entries(data)) {
    const change = value as { increment?: number; decrement?: number } | null;
    const delta =
      change?.increment ?? (change?.decrement === undefined ? undefined : -change.decrement);
    (row as unknown as Record<string, unknown>)[key] =
      delta === undefined ? value : (row as unknown as Record<string, number>)[key]! + delta;
  }
  row.updatedAt = new Date();
};

/** `SystemConfig` rows by key (the time of the last dead-job warning is kept there). */
const config = new Map<string, string>();

jest.mock("~/server/db", () => ({
  db: {
    systemConfig: {
      findUnique: async ({ where }: { where: { key: string } }) =>
        config.has(where.key) ? { value: config.get(where.key) } : null,
      upsert: async ({ where, create }: { where: { key: string }; create: { value: string } }) =>
        void config.set(where.key, create.value),
    },
    wikiMirrorJob: {
      count: async ({ where }: { where: Record<string, unknown> }) =>
        rows.filter((row) => matches(row, where)).length,
      findMany: async ({
        where,
        take,
        orderBy,
      }: {
        where: Record<string, unknown>;
        take: number;
        orderBy?: { updatedAt?: "desc" } | object[];
      }) => {
        const found = rows
          .filter((row) => matches(row, where))
          .sort((a, b) =>
            !Array.isArray(orderBy) && orderBy?.updatedAt === "desc"
              ? b.updatedAt.getTime() - a.updatedAt.getTime()
              : a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id)
          )
          .slice(0, take)
          .map((row) => ({ ...row }));
        if (Array.isArray(orderBy) && afterWindowRead) {
          const between = afterWindowRead;
          afterWindowRead = null;
          between();
        }
        return found;
      },
      findUnique: async ({ where }: { where: { id: string } }) => {
        const row = rows.find((candidate) => candidate.id === where.id);
        return row ? { ...row } : null;
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        if (data.state === "done" && storeFails.has(where.id)) throw new Error("db down");
        const row = rows.find((candidate) => candidate.id === where.id)!;
        apply(row, data);
        return { ...row };
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: Record<string, unknown>;
        data: Record<string, unknown>;
      }) => {
        // another runner takes the job a moment before this claim (see `racedClaims`)
        if (data.state === "running" && racedClaims.has(String(where.id))) {
          const taken = rows.find((row) => row.id === where.id);
          if (taken) taken.state = "running";
        }
        const found = rows.filter((row) => matches(row, where));
        for (const row of found) apply(row, data);
        return { count: found.length };
      },
      deleteMany: async ({ where }: { where: Record<string, unknown> }) => {
        const before = rows.length;
        rows = rows.filter((row) => !matches(row, where));
        return { count: before - rows.length };
      },
    },
  },
}));
jest.mock("~/lib/wiki-os/services/mirror-revision", () => ({
  planRevisionBatch: jest.fn(),
  executeRevisionBatch: jest.fn(),
}));
jest.mock("~/lib/wiki-os/services/mirror-collision", () => ({ checkCollision: jest.fn() }));
jest.mock("~/lib/wiki-os/services/mirror-page-ops", () => ({ runPageJob: jest.fn() }));
jest.mock("~/lib/wiki-os/services/mirror-upload", () => ({ runUploadJob: jest.fn() }));
jest.mock("~/lib/wiki-os/services/render-service", () => ({
  invalidateTemplateDependents: jest.fn().mockResolvedValue(0),
}));
jest.mock("~/lib/discord/webhook", () => ({
  discordWebhook: {
    isEnabled: jest.fn().mockReturnValue(true),
    sendWarning: jest.fn().mockResolvedValue(true),
  },
}));
jest.mock("~/lib/system/job-lock", () => ({ withJobLock: jest.fn() }));
jest.mock("~/lib/wiki-os/services/mirror-outbox", () => ({
  ...jest.requireActual("~/lib/wiki-os/services/mirror-outbox"),
  scheduleMirrorKick: jest.fn(),
}));
jest.mock("~/lib/wiki-os/services/staged-uploads", () => ({
  sweepStagedOrphansIfDue: jest.fn(),
}));

const planBatch = jest.mocked(planRevisionBatch);
const judgeBatch = jest.mocked(checkCollision);
const sendBatch = jest.mocked(executeRevisionBatch);
/** What sending one revision does (MediaWiki's revision id, or a rejection): the batch sends its jobs in order. */
const revisionJob = jest.fn<Promise<number | null>, [WikiMirrorJob]>();
const pageJob = jest.mocked(runPageJob);
const uploadJob = jest.mocked(runUploadJob);
const warn = jest.mocked(discordWebhook.sendWarning);

/** A job in the outbox, `ageMs` old (older jobs are written first). */
function addJob(over: Partial<Row> = {}, ageMs = 60_000 - counter * 1_000): Row {
  counter += 1;
  const row: Row = {
    id: `job${String(counter).padStart(3, "0")}`,
    source: "ixwiki",
    kind: "revision",
    title: "Foo",
    articleId: "a1",
    revisionId: `r${counter}`,
    logId: null,
    payload: null,
    state: "pending",
    attempts: 0,
    nextAttemptAt: new Date(Date.now() - 5_000),
    lastError: null,
    mwRevId: null,
    createdAt: new Date(Date.now() - ageMs),
    updatedAt: new Date(),
    ...over,
  };
  rows.push(row);
  return row;
}

const byId = (id: string) => rows.find((row) => row.id === id)!;
/** Make a backed-off job due again (the test does not wait out the backoff). */
const makeDue = (id: string) => void (byId(id).nextAttemptAt = new Date(Date.now() - 1));

beforeEach(() => {
  jest.clearAllMocks();
  rows = [];
  counter = 0;
  racedClaims.clear();
  storeFails.clear();
  afterWindowRead = null;
  config.clear();
  delete process.env.SKIP_MEDIAWIKI_SYNC;
  revisionJob.mockReset().mockResolvedValue(555);
  // The planner takes every job it is given (a size cap is the real one's business, tested with it).
  planBatch.mockImplementation(async (jobs) => ({
    title: jobs[0].title,
    members: jobs.map((job) => ({ job, send: false as const, mwRevId: null })),
    xml: null,
    importSummary: "summary",
  }));
  judgeBatch.mockResolvedValue(null);
  sendBatch.mockImplementation(async (plan) => {
    const outcomes = [];
    for (const { job } of plan.members) outcomes.push({ job, mwRevId: await revisionJob(job) });
    return outcomes;
  });
  pageJob.mockResolvedValue({});
  uploadJob.mockResolvedValue(undefined);
  jest.mocked(sweepStagedOrphansIfDue).mockResolvedValue(null);
  jest.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("runMirrorCycle", () => {
  it("runs the page operations through their own handler, and re-renders the users of a template after its revision", async () => {
    addJob({
      kind: "move",
      title: "Old",
      payload: { to: "New", reason: "", leaveRedirect: true },
      revisionId: null,
    });
    addJob({ title: "Template:Box" });

    await runMirrorCycle();

    expect(pageJob).toHaveBeenCalledTimes(1);
    expect(revisionJob).toHaveBeenCalledTimes(1);
    expect(invalidateTemplateDependents).toHaveBeenCalledTimes(1);
    expect(invalidateTemplateDependents).toHaveBeenCalledWith("Template:Box", "ixwiki");
    expect(rows.map((row) => row.state)).toEqual(["done", "done"]);
  });

  it("completes a page operation the conflict rule ruled lost with its note, keeping its payload", async () => {
    pageJob.mockResolvedValue({ note: "Lost to a later edit in MediaWiki" });
    const job = addJob({
      kind: "delete",
      title: "Old",
      payload: { reason: "spam" },
      revisionId: null,
    });

    await expect(runMirrorCycle()).resolves.toMatchObject({ done: 1, failed: 0 });

    expect(byId(job.id)).toMatchObject({
      state: "done",
      payload: { reason: "spam", note: "Lost to a later edit in MediaWiki" },
    });
  });
  it("keeps the order of one title after a failure: a job behind a backing-off one waits, other titles go on", async () => {
    const failing = addJob({
      title: "A",
      state: "pending",
      attempts: 1,
      nextAttemptAt: new Date(Date.now() + 60_000),
    });
    const waiting = addJob({ title: "A" });
    const other = addJob({ title: "B" });

    const result = await runMirrorCycle();

    expect(result).toMatchObject({ done: 1, failed: 0 });
    expect(byId(failing.id)).toMatchObject({ state: "pending", attempts: 1 });
    expect(byId(waiting.id)).toMatchObject({ state: "pending", attempts: 0 });
    expect(byId(other.id).state).toBe("done");
  });

  it("fails the jobs of a batch together, and other titles go on", async () => {
    const first = addJob({ title: "A" });
    const second = addJob({ title: "A" });
    const other = addJob({ title: "B" });
    revisionJob.mockImplementation(async (job) => {
      if (job.title === "A") throw new Error("MediaWiki 503");
      return 600;
    });

    const result = await runMirrorCycle();

    expect(result).toMatchObject({ done: 1, failed: 2, dead: 0 });
    for (const job of [first, second]) {
      expect(byId(job.id)).toMatchObject({
        state: "pending",
        attempts: 1,
        lastError: "MediaWiki 503",
      });
    }
    expect(byId(other.id).state).toBe("done");
  });

  it("retries a failed job after its backoff, and not before", async () => {
    const failing = addJob();
    revisionJob.mockRejectedValueOnce(new Error("MediaWiki 503"));

    await runMirrorCycle();
    expect(byId(failing.id)).toMatchObject({
      state: "pending",
      attempts: 1,
      lastError: "MediaWiki 503",
    });
    const wait = byId(failing.id).nextAttemptAt.getTime() - Date.now();
    expect(wait).toBeGreaterThan(55_000);
    expect(wait).toBeLessThanOrEqual(60_000);

    await runMirrorCycle(); // not due yet
    expect(revisionJob).toHaveBeenCalledTimes(1);

    makeDue(failing.id);
    await runMirrorCycle();
    expect(byId(failing.id)).toMatchObject({ state: "done", attempts: 2, lastError: null });
  });

  it("makes a job dead on its 8th failed attempt, once: a Discord warning, then it blocks its title", async () => {
    const failing = addJob({ title: "Foo" });
    const behindMove = addJob({
      kind: "move",
      title: "Foo",
      payload: { to: "Bar", reason: "", leaveRedirect: true },
      revisionId: null,
    });
    revisionJob.mockRejectedValue(new Error("MediaWiki bot login failed: Failed"));

    for (let attempt = 1; attempt < 8; attempt++) {
      await runMirrorCycle();
      expect(byId(failing.id)).toMatchObject({ state: "pending", attempts: attempt });
      expect(warn).not.toHaveBeenCalled();
      makeDue(failing.id);
    }
    const last = await runMirrorCycle();

    expect(byId(failing.id)).toMatchObject({
      state: "dead",
      attempts: 8,
      lastError: "MediaWiki bot login failed: Failed",
    });
    expect(last).toMatchObject({ failed: 1, dead: 1 });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      "WikiOS mirror job dead",
      "revision Foo: MediaWiki bot login failed: Failed"
    );
    // the dead job blocks its title: the job behind it never runs, and nothing is attempted again
    await runMirrorCycle();
    await runMirrorCycle();
    expect(byId(behindMove.id)).toMatchObject({ state: "pending", attempts: 0 });
    expect(revisionJob).toHaveBeenCalledTimes(8);
    expect(pageJob).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("warns once about all the jobs that went dead in a run: the first few named, the rest counted", async () => {
    for (let i = 0; i < 7; i++) addJob({ title: `Page ${i}`, attempts: 7 });
    revisionJob.mockRejectedValue(new Error("MediaWiki down"));

    const result = await runMirrorCycle();

    expect(result.dead).toBe(7);
    expect(warn).toHaveBeenCalledTimes(1);
    const [title, message] = warn.mock.calls[0]!;
    expect(title).toBe("WikiOS mirror jobs dead");
    expect(message).toContain("7 mirror jobs went dead since the last warning");
    expect(message.match(/revision Page \d: MediaWiki down/g)).toHaveLength(5);
    expect(message).toContain("...and 2 more");
  });
  it("looks for orphaned staged files at the end of a cycle (the sweep throttles itself), and a failing sweep does not fail the cycle", async () => {
    addJob();

    await expect(runMirrorCycle()).resolves.toMatchObject({ done: 1, failed: 0 });
    expect(sweepStagedOrphansIfDue).toHaveBeenCalledTimes(1);

    jest.mocked(sweepStagedOrphansIfDue).mockRejectedValue(new Error("disk unreadable"));
    addJob();
    await expect(runMirrorCycle()).resolves.toMatchObject({ done: 1, failed: 0 });
    expect(console.warn).toHaveBeenCalledWith(
      "[WikiMirror] Sweeping orphaned staged files failed:",
      expect.objectContaining({ message: "disk unreadable" })
    );
  });
  it("starts no job once its time is up", async () => {
    addJob();

    const result = await runMirrorCycle({ deadlineMs: 0 });

    expect(result.done).toBe(0);
    expect(revisionJob).not.toHaveBeenCalled();
  });

  it("takes up a job a dead run left running, and leaves one that is still being worked on", async () => {
    const abandoned = addJob({
      title: "A",
      state: "running",
      attempts: 1,
      updatedAt: new Date(Date.now() - 11 * 60_000),
    });
    // updatedAt is rewritten by the in-memory update: pin it back
    abandoned.updatedAt = new Date(Date.now() - 11 * 60_000);
    const live = addJob({ title: "B", state: "running", attempts: 1 });

    const result = await runMirrorCycle();

    expect(result.done).toBe(1);
    expect(byId(abandoned.id)).toMatchObject({ state: "done", attempts: 2 });
    expect(byId(live.id)).toMatchObject({ state: "running", attempts: 1 });
  });

  it("does not let a discarded job hold its title, and keeps it out of the cycle", async () => {
    const discarded = addJob({
      title: "Foo",
      state: "discarded",
      attempts: 8,
      lastError: "gave up",
    });
    const behind = addJob({ title: "Foo" });

    const result = await runMirrorCycle();

    expect(result.done).toBe(1);
    expect(byId(behind.id).state).toBe("done");
    expect(byId(discarded.id)).toMatchObject({
      state: "discarded",
      attempts: 8,
      lastError: "gave up",
    });
  });
});

describe("batches of revision jobs", () => {
  it("imports the revision jobs of one title that wait next in line as one batch", async () => {
    const first = addJob({ title: "Foo" });
    const second = addJob({ title: "Foo" });
    const third = addJob({ title: "Foo" });
    const elsewhere = addJob({ title: "Bar" });
    revisionJob.mockImplementation(async (job) => 700 + Number(job.id.slice(-3)));

    const result = await runMirrorCycle();

    expect(result).toEqual({ skipped: false, done: 4, failed: 0, dead: 0 });
    expect(planBatch).toHaveBeenCalledTimes(2);
    expect(planBatch.mock.calls[0]?.[0].map((job) => job.id)).toEqual([
      first.id,
      second.id,
      third.id,
    ]);
    expect(planBatch.mock.calls[1]?.[0].map((job) => job.id)).toEqual([elsewhere.id]);
    expect(sendBatch).toHaveBeenCalledTimes(2);
    for (const job of [first, second, third]) {
      expect(byId(job.id)).toMatchObject({
        state: "done",
        attempts: 1,
        mwRevId: 700 + Number(job.id.slice(-3)),
      });
    }
  });
  it("settles the jobs the plan took and gives the rest back untried, for the next batch", async () => {
    const jobs = [addJob({ title: "Foo" }), addJob({ title: "Foo" }), addJob({ title: "Foo" })];
    planBatch.mockImplementationOnce(async (given) => ({
      title: "Foo",
      members: given.slice(0, 2).map((job) => ({ job, send: false as const, mwRevId: null })),
      xml: null,
      importSummary: "summary",
    }));

    const result = await runMirrorCycle();

    // the first batch took two, the second took the third
    expect(result.done).toBe(3);
    expect(planBatch.mock.calls.map(([given]) => given.length)).toEqual([3, 1]);
    expect(sendBatch.mock.calls[0]?.[0].members.map((member) => member.job.id)).toEqual([
      jobs[0]!.id,
      jobs[1]!.id,
    ]);
    // an attempt that was given back is not counted
    expect(byId(jobs[2]!.id)).toMatchObject({ state: "done", attempts: 1 });
  });
  it("makes every job of a failed batch dead on the same attempt, with one warning for them all", async () => {
    addJob({ title: "Foo", attempts: 7 });
    addJob({ title: "Foo", attempts: 7 });
    revisionJob.mockRejectedValue(new Error("MediaWiki down"));

    const result = await runMirrorCycle();

    expect(result).toMatchObject({ failed: 2, dead: 2 });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[1]).toContain("2 mirror jobs went dead");
  });

  it("leaves alone a job another runner claimed first, and never runs a later job of the batch before it", async () => {
    const first = addJob({ title: "Foo" });
    const second = addJob({ title: "Foo" });
    const third = addJob({ title: "Foo" });
    racedClaims.add(second.id);

    const result = await runMirrorCycle();

    // the first was claimed; the second was taken by the other runner, so the batch stops there
    expect(planBatch.mock.calls[0]?.[0].map((job) => job.id)).toEqual([first.id]);
    expect(result.done).toBe(1);
    expect(byId(second.id)).toMatchObject({ state: "running", attempts: 0 });
    expect(byId(third.id)).toMatchObject({ state: "pending", attempts: 0 });
  });
  describe("the conflict rule before a batch is sent", () => {
    const verdict = (wikiosWon: boolean): BatchCollision => ({
      verdict: {
        winner: {
          side: wikiosWon ? "wikios" : "classic",
          action: "edit",
          ref: wikiosWon ? "r1" : "900",
          at: new Date(),
          author: { userId: null, classicName: null, ip: null, label: null },
        },
        overwritten: [],
        incomingWins: wikiosWon,
        key: "k",
      },
      conflictId: "c1",
      wikiosWon,
    });

    it("sends a batch as planned when there is no collision", async () => {
      addJob({ title: "Foo" });

      await runMirrorCycle();

      expect(judgeBatch).toHaveBeenCalledWith(await planBatch.mock.results[0]?.value);
      expect(planBatch).toHaveBeenCalledTimes(1);
      expect(sendBatch).toHaveBeenCalledWith(await planBatch.mock.results[0]?.value, null);
    });

    it("plans a batch that lost again (a revision of it may carry an earlier win's trail) and sends it with its verdict", async () => {
      addJob({ title: "Foo" });
      addJob({ title: "Foo" });
      const lost = verdict(false);
      judgeBatch.mockResolvedValueOnce(lost);

      await expect(runMirrorCycle()).resolves.toMatchObject({ done: 2, failed: 0 });

      expect(planBatch).toHaveBeenCalledTimes(2);
      expect(sendBatch).toHaveBeenCalledTimes(1);
      expect(sendBatch).toHaveBeenCalledWith(await planBatch.mock.results[1]?.value, lost);
    });

    it("plans a batch WikiOS won again, so the trail written into its summary goes out, and sends that plan", async () => {
      const jobs = [addJob({ title: "Foo" }), addJob({ title: "Foo" })];
      const won = verdict(true);
      judgeBatch.mockResolvedValueOnce(won);

      await runMirrorCycle();

      expect(planBatch.mock.calls.map(([given]) => given.map((job) => job.id))).toEqual([
        jobs.map((job) => job.id),
        jobs.map((job) => job.id),
      ]);
      expect(sendBatch).toHaveBeenCalledTimes(1);
      expect(sendBatch).toHaveBeenCalledWith(await planBatch.mock.results[1]?.value, won);
    });

    it("gives back, untried, the jobs the second plan no longer takes: they run in the next batch", async () => {
      const jobs = [addJob({ title: "Foo" }), addJob({ title: "Foo" })];
      judgeBatch.mockResolvedValueOnce(verdict(true));
      const unsent = (given: readonly Row[]) =>
        given.map((job) => ({ job, send: false as const, mwRevId: null }));
      planBatch
        .mockImplementationOnce(async (given) => ({
          title: "Foo",
          members: unsent(given),
          xml: null,
          importSummary: "summary",
        }))
        .mockImplementationOnce(async (given) => ({
          title: "Foo",
          members: unsent(given.slice(0, 1)),
          xml: null,
          importSummary: "summary",
        }));

      await expect(runMirrorCycle()).resolves.toMatchObject({ done: 2, failed: 0 });

      expect(planBatch.mock.calls.map(([given]) => given.length)).toEqual([2, 2, 1]);
      for (const job of jobs) expect(byId(job.id)).toMatchObject({ state: "done", attempts: 1 });
    });

    it("leaves a job the second plan gave back untouched when the batch then fails", async () => {
      const jobs = [addJob({ title: "Foo" }), addJob({ title: "Foo" })];
      judgeBatch.mockResolvedValueOnce(verdict(true));
      const unsent = (given: readonly Row[]) =>
        given.map((job) => ({ job, send: false as const, mwRevId: null }));
      planBatch
        .mockImplementationOnce(async (given) => ({
          title: "Foo",
          members: unsent(given),
          xml: null,
          importSummary: "summary",
        }))
        .mockImplementationOnce(async (given) => ({
          title: "Foo",
          members: unsent(given.slice(0, 1)),
          xml: null,
          importSummary: "summary",
        }));
      sendBatch.mockRejectedValueOnce(new Error("MediaWiki down"));

      await runMirrorCycle();

      expect(byId(jobs[0]!.id)).toMatchObject({ attempts: 1, lastError: "MediaWiki down" });
      expect(byId(jobs[1]!.id)).toMatchObject({ state: "pending", attempts: 0, lastError: null });
    });

    it("fails every job of the batch when the check fails, and sends nothing", async () => {
      const jobs = [addJob({ title: "Foo" }), addJob({ title: "Foo" })];
      judgeBatch.mockRejectedValueOnce(new Error("MediaWiki down"));

      await expect(runMirrorCycle()).resolves.toMatchObject({ done: 0, failed: 2 });

      expect(sendBatch).not.toHaveBeenCalled();
      for (const job of jobs) {
        expect(byId(job.id)).toMatchObject({ state: "pending", lastError: "MediaWiki down" });
      }
    });
  });

  it("fails only the jobs not settled yet when an outcome cannot be stored, never one already done", async () => {
    const first = addJob({ title: "Foo" });
    const second = addJob({ title: "Foo" });
    const third = addJob({ title: "Foo" });
    storeFails.add(second.id);

    const result = await runMirrorCycle();

    expect(byId(first.id)).toMatchObject({ state: "done", attempts: 1, lastError: null });
    // the second could not be marked done, and the third was never reached: both are failed, for the retry
    expect(byId(second.id)).toMatchObject({ state: "pending", attempts: 1, lastError: "db down" });
    expect(byId(third.id)).toMatchObject({ state: "pending", attempts: 1, lastError: "db down" });
    expect(result).toMatchObject({ done: 1, failed: 2 });
  });
});

describe("the bounds that keep a lock transaction from expiring mid-attempt", () => {
  it("bounds an attempt well under the lock, and a cycle by its deadline plus one attempt", () => {
    expect(ATTEMPT_TIMEOUT_MS).toBe(6 * 60_000);
    expect(MAX_CYCLE_MS).toBe(DEFAULT_DEADLINE_MS + ATTEMPT_TIMEOUT_MS);
    expect(LOCK_TIMEOUT_MS).toBe(10 * 60_000);
    expect(LOCK_TIMEOUT_MS).toBeGreaterThan(MAX_CYCLE_MS);
  });

  it("runs everything a revision attempt asks of MediaWiki, and a page operation, inside one attempt scope", async () => {
    const timeout = jest.spyOn(AbortSignal, "timeout");
    const seen: boolean[] = [];
    // a request made in an attempt's scope is tied to the attempt's signal
    const tied = jest.spyOn(AbortSignal, "any");
    const judgedInScope: boolean[] = [];
    judgeBatch.mockImplementation(async () => {
      const before = tied.mock.calls.length;
      seen.push(requestSignal(30_000).aborted);
      judgedInScope.push(tied.mock.calls.length > before);
      return null;
    });
    sendBatch.mockImplementation(async (plan) => {
      seen.push(requestSignal(30_000).aborted);
      return plan.members.map(({ job }) => ({ job, mwRevId: 1 }));
    });
    pageJob.mockImplementation(async () => {
      seen.push(requestSignal(30_000).aborted);
      return {};
    });
    addJob({ title: "Foo" });
    addJob({ kind: "delete", title: "Bar", payload: { reason: "" }, revisionId: null });

    await runMirrorCycle();

    const attemptScopes = timeout.mock.calls.filter(([ms]) => ms === ATTEMPT_TIMEOUT_MS);
    expect(attemptScopes).toHaveLength(2); // one per attempt, not per call
    expect(seen).toEqual([false, false, false]);
    expect(judgedInScope).toEqual([true]);
    timeout.mockRestore();
  });

  it("gives the cron job the same lock allowance as the in-process run, longer than a cycle can take", () => {
    const row = CRON_JOBS.find((job) => job.name === "wiki-mirror");

    expect(row?.timeoutMs).toBe(LOCK_TIMEOUT_MS);
    expect(row?.timeoutMs).toBeGreaterThan(MAX_CYCLE_MS);
  });

  it("reclaims a `running` job only after an attempt can no longer be running", () => {
    expect(INTERRUPTED_AFTER_MS).toBeGreaterThan(ATTEMPT_TIMEOUT_MS);
    expect(INTERRUPTED_AFTER_MS).toBe(10 * 60_000);
  });
});

describe("runMirrorCycleLocked", () => {
  it("does no work when another runner holds the mirror lock", async () => {
    addJob();
    jest.mocked(withJobLock).mockResolvedValue({ ran: false });

    await expect(runMirrorCycleLocked()).resolves.toBeNull();

    expect(revisionJob).not.toHaveBeenCalled();
    expect(withJobLock).toHaveBeenCalledWith(
      expect.anything(),
      "wiki-mirror",
      expect.any(Function),
      { timeoutMs: 600_000 }
    );
  });
});

// Plan 407 (mirror-alerts.test.ts): the dead-job warning is at most one Discord message in 30 minutes, and a webhook that
// did not take one is not tried again for 5.
describe("the dead-job warning holds back", () => {
  const at = (minutes: number) => new Date(Date.now() + minutes * 60_000);

  it("for 30 minutes after the last one, without even looking for jobs", async () => {
    addJob({ state: "dead", lastError: "MediaWiki 503" });
    await alertDeadJobs(at(0));
    addJob({ state: "dead", title: "Bar", lastError: "MediaWiki 503", updatedAt: at(10) });
    await alertDeadJobs(at(29));
    expect(warn).toHaveBeenCalledTimes(1);
    await alertDeadJobs(at(31));
    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenLastCalledWith("WikiOS mirror job dead", "revision Bar: MediaWiki 503");
  });

  it("stamps a failed attempt of several jobs the same way", async () => {
    warn.mockResolvedValue(false);
    for (const title of ["A", "B", "C"])
      addJob({ state: "dead", title, lastError: "MediaWiki 503" });

    const now = at(0);
    await alertDeadJobs(now);

    expect(warn).toHaveBeenCalledWith(
      "WikiOS mirror jobs dead",
      expect.stringContaining("3 mirror jobs")
    );
    expect(config.has(DEAD_ALERT_KEY)).toBe(false);
    expect(config.get(ATTEMPT_KEY)).toBe(now.toISOString());
  });

  it("for 5 minutes after Discord did not take one, so a dead webhook is not tried in every cycle", async () => {
    warn.mockResolvedValue(false);
    addJob({ state: "dead", lastError: "MediaWiki 503" });
    await alertDeadJobs(at(0));
    await alertDeadJobs(at(4));
    expect(warn).toHaveBeenCalledTimes(1);
    await alertDeadJobs(at(5));
    expect(warn).toHaveBeenCalledTimes(2);
  });
});

// Plan 2026-10-24 Task 11 (A4): dead jobs leave the window but keep holding their titles, a full window is reported,
// and an administrator requeues or discards the dead jobs in bulk. Every case runs in both WikiOS modes.
describe.each(WIKIOS_MODES)("the queue's health [%s]", (mode) => {
  let restoreMode: () => void = () => undefined;
  beforeEach(async () => {
    jest.mocked(discordWebhook.isEnabled).mockReturnValue(true);
    warn.mockResolvedValue(true);
    restoreMode = await seedWikiosMode(db, mode);
  });
  afterEach(() => restoreMode());

  /** `count` dead jobs, each of its own title, older than anything added after them. */
  const addDeadJobs = (count: number) =>
    Array.from({ length: count }, (_, i) =>
      addJob(
        { title: `Dead ${i}`, state: "dead", attempts: 8, lastError: "MediaWiki down" },
        1e9 - i
      )
    );
  const saturationWarnings = () =>
    warn.mock.calls.filter(([title]) => title === "WikiOS mirror queue full");

  describe("in production with no internal URL (B3)", () => {
    const saved = {
      internal: process.env.WIKIOS_MEDIAWIKI_INTERNAL_URL,
      api: process.env.WIKIOS_MEDIAWIKI_API,
    };
    let nodeEnv: { restore(): void } | undefined;
    beforeEach(() => {
      nodeEnv = jest.replaceProperty(process.env, "NODE_ENV", "production");
      delete process.env.WIKIOS_MEDIAWIKI_INTERNAL_URL;
      delete process.env.WIKIOS_MEDIAWIKI_API;
    });
    afterEach(() => {
      nodeEnv?.restore();
      for (const [name, value] of [
        ["WIKIOS_MEDIAWIKI_INTERNAL_URL", saved.internal],
        ["WIKIOS_MEDIAWIKI_API", saved.api],
      ] as const) {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      }
    });

    it("with no WIKIOS_MEDIAWIKI_API the mirror skips and touches no job: they stay pending, no attempt spent", async () => {
      const waiting = addJob({ title: "Foo" });
      const stuck = addJob({ title: "Bar", state: "running", updatedAt: new Date(0) });
      const before = rows.map((row) => ({ ...row }));

      await expect(runMirrorCycle()).resolves.toEqual({
        skipped: true,
        done: 0,
        failed: 0,
        dead: 0,
      });

      expect(rows).toEqual(before);
      expect(byId(waiting.id)).toMatchObject({ state: "pending", attempts: 0, lastError: null });
      expect(byId(stuck.id).state).toBe("running");
      expect(revisionJob).not.toHaveBeenCalled();
      expect(warn).not.toHaveBeenCalled();
    });

    it("runs the jobs it kept once the internal URL is set", async () => {
      const waiting = addJob({ title: "Foo" });
      await runMirrorCycle();
      process.env.WIKIOS_MEDIAWIKI_INTERNAL_URL = "http://127.0.0.1:8081/api.php";

      await expect(runMirrorCycle()).resolves.toMatchObject({ skipped: false, done: 1 });

      expect(byId(waiting.id).state).toBe("done");
    });

    it("with WIKIOS_MEDIAWIKI_API set it runs", async () => {
      process.env.WIKIOS_MEDIAWIKI_API = "http://127.0.0.1:8089/api.php";
      const job = addJob({ title: "Foo" });

      await expect(runMirrorCycle()).resolves.toMatchObject({ skipped: false, done: 1 });

      expect(byId(job.id).state).toBe("done");
    });
  });

  it("a dead job is not in the window but still holds its title: a younger job of that title waits, another title runs", async () => {
    // a full window's worth of dead jobs, one on Foo and a move to Target among them
    const dead = addDeadJobs(WINDOW_SIZE - 2);
    addJob({ title: "Foo", state: "dead", attempts: 8 }, 1e9 - WINDOW_SIZE);
    addJob(
      {
        kind: "move",
        title: "Old",
        payload: { to: "Target", reason: "", leaveRedirect: true },
        revisionId: null,
        state: "dead",
        attempts: 8,
      },
      1e9 - WINDOW_SIZE - 1
    );
    const sameTitle = addJob({ title: "Foo" });
    const toTarget = addJob({ title: "Target" });
    const other = addJob({ title: "Bar" });

    const result = await runMirrorCycle();

    expect(result).toMatchObject({ done: 1, failed: 0 });
    expect(byId(other.id).state).toBe("done");
    expect(byId(sameTitle.id)).toMatchObject({ state: "pending", attempts: 0 });
    expect(byId(toTarget.id)).toMatchObject({ state: "pending", attempts: 0 });
    expect(dead.every((job) => byId(job.id).state === "dead")).toBe(true);
  });

  it("reads the dead jobs' holds before the window: a job requeued between the two reads still runs before the younger ones", async () => {
    const x = addJob({ title: "T", state: "dead", attempts: 8, lastError: "MediaWiki down" });
    const y = addJob({ title: "T" });
    // an administrator requeues X just after the worker read the window (X was dead then, so not in it)
    afterWindowRead = () =>
      Object.assign(byId(x.id), { state: "pending", attempts: 0, lastError: null });
    const order: string[] = [];
    revisionJob.mockImplementation(async (job) => {
      order.push(job.id);
      return 600;
    });

    await runMirrorCycle();
    await runMirrorCycle(); // the cycle that read X as dead ran nothing of T; this one runs X first

    expect(order).toEqual([x.id, y.id]);
  });

  it("requeuing the oldest dead job of a batch runs it alone; the younger dead ones still hold, and R6 does not join the batch", async () => {
    const batch = [1, 2, 3, 4, 5].map(() =>
      addJob({ title: "Foo", state: "dead", attempts: 8, lastError: "MediaWiki down" })
    );
    const r6 = addJob({ title: "Foo" });
    const r7 = addJob({ title: "Foo" });

    await requeueMirrorJob(batch[0]!.id);
    await runMirrorCycle();

    expect(planBatch).toHaveBeenCalledTimes(1);
    expect(planBatch.mock.calls[0]?.[0].map((job) => job.id)).toEqual([batch[0]!.id]);
    expect(byId(batch[0]!.id).state).toBe("done");
    for (const job of batch.slice(1)) expect(byId(job.id).state).toBe("dead");
    for (const job of [r6, r7])
      expect(byId(job.id)).toMatchObject({ state: "pending", attempts: 0 });
  });

  it("requeues and discards by title the dead moves into that title too", async () => {
    const intoFoo = addJob({
      kind: "move",
      title: "Old",
      payload: { to: "Foo", reason: "", leaveRedirect: true },
      revisionId: null,
      state: "dead",
      attempts: 8,
    });
    const elsewhere = addJob({
      kind: "move",
      title: "Other",
      payload: { to: "Bar", reason: "", leaveRedirect: true },
      revisionId: null,
      state: "dead",
      attempts: 8,
    });
    const behind = addJob({ title: "Foo" });

    await expect(requeueDeadJobs({ title: "Foo" })).resolves.toBe(1);
    expect(byId(intoFoo.id)).toMatchObject({ state: "pending", attempts: 0 });
    expect(byId(elsewhere.id).state).toBe("dead");

    byId(intoFoo.id).state = "dead";
    await expect(discardDeadJobs({ title: "Foo" })).resolves.toBe(1);
    expect(byId(intoFoo.id).state).toBe("discarded");
    expect(byId(elsewhere.id).state).toBe("dead");
    await runMirrorCycle();
    expect(byId(behind.id).state).toBe("done");
  });

  it("1000 dead jobs no longer starve the window: a pending job behind them runs", async () => {
    addDeadJobs(WINDOW_SIZE);
    const behind = addJob({ title: "Behind" });

    await expect(runMirrorCycle()).resolves.toMatchObject({ done: 1 });

    expect(byId(behind.id)).toMatchObject({ state: "done", attempts: 1 });
    expect(saturationWarnings()).toHaveLength(0); // dead jobs do not fill the window
  });

  it("warns once in 30 minutes when the window is full and stamps only a delivered warning", async () => {
    // a full window of jobs all waiting out a backoff: nothing runs, nothing drains
    for (let i = 0; i < WINDOW_SIZE; i++) {
      addJob({ title: `Page ${i}`, attempts: 1, nextAttemptAt: new Date(Date.now() + 3_600_000) });
    }
    warn.mockResolvedValue(false); // Discord does not take it

    await runMirrorCycle();
    expect(saturationWarnings()).toHaveLength(1);
    expect(saturationWarnings()[0]?.[1]).toContain(`${WINDOW_SIZE} mirror jobs`);
    expect(config.has(SATURATION_ALERT_KEY)).toBe(false);

    // a failed delivery is stamped on its own: not tried again for 5 minutes
    expect(config.get(SATURATION_ATTEMPT_KEY)).toBeDefined();
    warn.mockResolvedValue(true);
    await runMirrorCycle();
    expect(saturationWarnings()).toHaveLength(1);
    config.set(SATURATION_ATTEMPT_KEY, new Date(Date.now() - 5 * 60_000 - 1).toISOString());
    await runMirrorCycle(); // after the backoff: tried again, and delivered
    expect(saturationWarnings()).toHaveLength(2);
    const stamped = config.get(SATURATION_ALERT_KEY);
    expect(stamped).toBeDefined();

    await runMirrorCycle(); // held back
    expect(saturationWarnings()).toHaveLength(2);
    config.set(SATURATION_ALERT_KEY, new Date(Date.now() - 31 * 60_000).toISOString());
    await runMirrorCycle();
    expect(saturationWarnings()).toHaveLength(3);
    // one below full is not full
    rows.pop();
    config.delete(SATURATION_ALERT_KEY);
    await runMirrorCycle();
    expect(saturationWarnings()).toHaveLength(3);
  });

  it("looks up nothing and sends nothing about a full window when no Discord webhook is configured", async () => {
    jest.mocked(discordWebhook.isEnabled).mockReturnValue(false);
    for (let i = 0; i < WINDOW_SIZE; i++) {
      addJob({ title: `Page ${i}`, attempts: 1, nextAttemptAt: new Date(Date.now() + 3_600_000) });
    }

    await runMirrorCycle();

    expect(warn).not.toHaveBeenCalled();
    expect(config.has(SATURATION_ALERT_KEY)).toBe(false);
  });

  // Restored from f5bf69fa9^ (plan 407): the dead-job warning names only the jobs that died since the last one.
  it("holds the next warning back for 30 minutes, and then names the jobs that died meanwhile, only those", async () => {
    const first = addJob({ title: "First", attempts: 7 });
    revisionJob.mockRejectedValue(new Error("MediaWiki down"));
    await runMirrorCycle();
    expect(warn).toHaveBeenCalledTimes(1);

    addJob({ title: "Second", attempts: 7 });
    await runMirrorCycle();
    await runMirrorCycle();
    expect(warn).toHaveBeenCalledTimes(1); // held back

    // 31 minutes later: the first warning, and the death of the first job, are that far back
    config.set(DEAD_ALERT_KEY, new Date(Date.now() - 31 * 60_000).toISOString());
    byId(first.id).updatedAt = new Date(Date.now() - 32 * 60_000);
    await runMirrorCycle();

    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenLastCalledWith(
      "WikiOS mirror job dead",
      "revision Second: MediaWiki down"
    );
    await runMirrorCycle();
    expect(warn).toHaveBeenCalledTimes(2); // nothing new
  });

  // Restored from f5bf69fa9^ (plan 407).
  it("forgets the jobs that finished long ago, discarded ones too", async () => {
    const month = 31 * 24 * 60 * 60_000;
    addJob({ state: "done" }).updatedAt = new Date(Date.now() - month);
    addJob({ state: "discarded" }).updatedAt = new Date(Date.now() - month);
    const dead = addJob({ state: "dead", title: "Other" });
    dead.updatedAt = new Date(Date.now() - month);
    const recent = addJob({ state: "done" });

    await runMirrorCycle();

    // only finished jobs go; a dead one stays, however old
    expect(rows.map((row) => row.id)).toEqual([dead.id, recent.id]);
  });

  it("requeues every dead job of a title, and only dead ones", async () => {
    const deadFoo = [
      addJob({ title: "Foo", state: "dead", attempts: 8, lastError: "MediaWiki down" }),
      // due later by this process's clock (another process failed it): a requeued job is due now
      addJob({
        title: "Foo",
        state: "dead",
        attempts: 8,
        lastError: "MediaWiki down",
        nextAttemptAt: new Date(Date.now() + 3_600_000),
      }),
    ];
    const deadBar = addJob({ title: "Bar", state: "dead", attempts: 8, lastError: "gone" });
    const discarded = addJob({
      title: "Foo",
      state: "discarded",
      attempts: 8,
      lastError: "gave up",
    });
    const pending = addJob({ title: "Foo", attempts: 2, lastError: "MediaWiki 503" });

    await expect(requeueDeadJobs({ title: "Foo" })).resolves.toBe(2);

    for (const job of deadFoo) {
      expect(byId(job.id)).toMatchObject({ state: "pending", attempts: 0, lastError: null });
      expect(byId(job.id).nextAttemptAt.getTime()).toBeLessThanOrEqual(Date.now());
    }
    expect(byId(deadBar.id)).toMatchObject({ state: "dead", attempts: 8, lastError: "gone" });
    expect(byId(discarded.id)).toMatchObject({ state: "discarded", lastError: "gave up" });
    expect(byId(pending.id)).toMatchObject({
      state: "pending",
      attempts: 2,
      lastError: "MediaWiki 503",
    });
    // they run again, oldest first, through the conflict rule as any job does
    await runMirrorCycle();
    expect(judgeBatch).toHaveBeenCalled();
    expect(planBatch.mock.calls[0]?.[0].map((job) => job.id)).toEqual([
      deadFoo[0]!.id,
      deadFoo[1]!.id,
      pending.id,
    ]);
    expect(byId(deadBar.id).state).toBe("dead");
    // with no title, every dead job
    await expect(requeueDeadJobs({})).resolves.toBe(1);
    expect(byId(deadBar.id)).toMatchObject({ state: "pending", attempts: 0, lastError: null });
  });

  it("discards every dead job, and the title's younger jobs run next", async () => {
    const deadFoo = addJob({
      title: "Foo",
      state: "dead",
      attempts: 8,
      lastError: "MediaWiki down",
    });
    const deadMove = addJob({
      kind: "move",
      title: "Old",
      payload: { to: "Bar", reason: "", leaveRedirect: true },
      revisionId: null,
      state: "dead",
      attempts: 8,
      lastError: "MediaWiki down",
    });
    const behindFoo = addJob({ title: "Foo" });
    const behindBar = addJob({ title: "Bar" });

    await runMirrorCycle();
    expect(revisionJob).not.toHaveBeenCalled();

    await expect(discardDeadJobs({ title: "Foo" })).resolves.toBe(1);
    expect(byId(deadMove.id).state).toBe("dead");
    await runMirrorCycle();
    expect(byId(behindFoo.id).state).toBe("done");
    expect(byId(behindBar.id).state).toBe("pending");

    await expect(discardDeadJobs({})).resolves.toBe(1);
    await runMirrorCycle();
    expect(byId(behindBar.id).state).toBe("done");
    // discarded, not done: the error that killed them stays on the row
    for (const job of [deadFoo, deadMove]) {
      expect(byId(job.id)).toMatchObject({ state: "discarded", lastError: "MediaWiki down" });
    }
    await expect(discardDeadJobs({})).resolves.toBe(0);
  });
});
