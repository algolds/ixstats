/** @jest-environment node */
/**
 * Plan 407: the mirror worker over an in-memory outbox. Jobs run oldest first and per title in order, a failure
 * backs off, the 8th failed attempt makes a job dead (one Discord warning, and its title is blocked), a busy
 * lock means no work, and SKIP_MEDIAWIKI_SYNC stops the worker with the jobs left in the outbox.
 */
import type { WikiMirrorJob } from "@prisma/client";
import { runMirrorCycle, runMirrorCycleLocked } from "~/lib/wiki-os/services/mirror-worker";
import { runRevisionJob } from "~/lib/wiki-os/services/mirror-revision";
import { runPageJob } from "~/lib/wiki-os/services/mirror-page-ops";
import { invalidateTemplateDependents } from "~/lib/wiki-os/services/render-service";
import { discordWebhook } from "~/lib/discord/webhook";
import { withJobLock } from "~/lib/system/job-lock";

type Row = WikiMirrorJob;
let rows: Row[] = [];
let counter = 0;

const matches = (row: Row, where: Record<string, unknown>): boolean =>
  Object.entries(where).every(([key, condition]) => {
    const value = (row as unknown as Record<string, unknown>)[key];
    if (condition !== null && typeof condition === "object" && !(condition instanceof Date)) {
      const cond = condition as { not?: unknown; lt?: Date };
      if ("not" in cond) return value !== cond.not;
      if ("lt" in cond) return (value as Date) < (cond.lt as Date);
    }
    return value === condition;
  });

const apply = (row: Row, data: Record<string, unknown>) => {
  for (const [key, value] of Object.entries(data)) {
    const increment = (value as { increment?: number } | null)?.increment;
    (row as unknown as Record<string, unknown>)[key] =
      increment === undefined
        ? value
        : (row as unknown as Record<string, number>)[key]! + increment;
  }
  row.updatedAt = new Date();
};

jest.mock("~/server/db", () => ({
  db: {
    wikiMirrorJob: {
      findMany: async ({ where, take }: { where: Record<string, unknown>; take: number }) =>
        rows
          .filter((row) => matches(row, where))
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id))
          .slice(0, take)
          .map((row) => ({ ...row })),
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
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
jest.mock("~/lib/wiki-os/services/mirror-revision", () => ({ runRevisionJob: jest.fn() }));
jest.mock("~/lib/wiki-os/services/mirror-page-ops", () => ({ runPageJob: jest.fn() }));
jest.mock("~/lib/wiki-os/services/render-service", () => ({
  invalidateTemplateDependents: jest.fn().mockResolvedValue(0),
}));
jest.mock("~/lib/discord/webhook", () => ({
  discordWebhook: { sendWarning: jest.fn().mockResolvedValue(undefined) },
}));
jest.mock("~/lib/system/job-lock", () => ({ withJobLock: jest.fn() }));

const revisionJob = jest.mocked(runRevisionJob);
const pageJob = jest.mocked(runPageJob);
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
  delete process.env.SKIP_MEDIAWIKI_SYNC;
  revisionJob.mockResolvedValue(555);
  pageJob.mockResolvedValue(undefined);
  jest.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("runMirrorCycle", () => {
  it("runs the due jobs oldest first and marks them done, with the MediaWiki revision they made", async () => {
    const first = addJob({ title: "A" });
    const second = addJob({ title: "B" });
    const order: string[] = [];
    revisionJob.mockImplementation(async (job) => {
      order.push(job.id);
      return job.id === first.id ? 501 : 502;
    });

    const result = await runMirrorCycle();

    expect(result).toEqual({ skipped: false, done: 2, failed: 0, dead: 0 });
    expect(order).toEqual([first.id, second.id]);
    expect(byId(first.id)).toMatchObject({
      state: "done",
      mwRevId: 501,
      attempts: 1,
      lastError: null,
    });
    expect(byId(second.id)).toMatchObject({ state: "done", mwRevId: 502 });
  });

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
  });

  it("does not re-render anything for a revision job that failed", async () => {
    addJob({ title: "Template:Box" });
    revisionJob.mockRejectedValue(new Error("MediaWiki 503"));

    await runMirrorCycle();

    expect(invalidateTemplateDependents).not.toHaveBeenCalled();
  });

  it("keeps the order of one title after a failure: the younger job waits, other titles go on", async () => {
    const failing = addJob({ title: "A" });
    const waiting = addJob({ title: "A" });
    const other = addJob({ title: "B" });
    revisionJob.mockImplementation(async (job) => {
      if (job.id === failing.id) throw new Error("MediaWiki 503");
      return 600;
    });

    const result = await runMirrorCycle();

    expect(result).toMatchObject({ done: 1, failed: 1, dead: 0 });
    expect(byId(failing.id).state).toBe("pending");
    expect(byId(waiting.id)).toMatchObject({ state: "pending", attempts: 0 });
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
    const behind = addJob({ title: "Foo" });
    revisionJob.mockImplementation(async (job) => {
      if (job.id === failing.id) throw new Error("MediaWiki bot login failed: Failed");
      return 700;
    });

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
    expect(byId(behind.id)).toMatchObject({ state: "pending", attempts: 0 });
    expect(revisionJob).toHaveBeenCalledTimes(8);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("warns about the first few dead jobs of a run and counts the rest", async () => {
    for (let i = 0; i < 7; i++) addJob({ title: `Page ${i}`, attempts: 7 });
    revisionJob.mockRejectedValue(new Error("MediaWiki down"));

    const result = await runMirrorCycle();

    expect(result.dead).toBe(7);
    expect(warn).toHaveBeenCalledTimes(6);
    expect(warn).toHaveBeenLastCalledWith(
      "WikiOS mirror jobs dead",
      "2 more mirror jobs went dead in the same run."
    );
  });

  it("does nothing while SKIP_MEDIAWIKI_SYNC is true: the jobs stay in the outbox", async () => {
    const waiting = addJob();
    process.env.SKIP_MEDIAWIKI_SYNC = "true";

    const result = await runMirrorCycle();

    expect(result).toEqual({ skipped: true, done: 0, failed: 0, dead: 0 });
    expect(revisionJob).not.toHaveBeenCalled();
    expect(byId(waiting.id)).toMatchObject({ state: "pending", attempts: 0 });
  });

  it("stops after maxJobs attempts, leaving the rest for the next run", async () => {
    for (let i = 0; i < 5; i++) addJob({ title: `Page ${i}` });

    const result = await runMirrorCycle({ maxJobs: 3 });

    expect(result.done).toBe(3);
    expect(rows.filter((row) => row.state === "pending")).toHaveLength(2);
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

  it("forgets the jobs that finished long ago", async () => {
    const old = addJob({ state: "done" });
    old.updatedAt = new Date(Date.now() - 31 * 24 * 60 * 60_000);
    const recent = addJob({ state: "done" });

    await runMirrorCycle();

    expect(rows.map((row) => row.id)).toEqual([recent.id]);
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
      { timeoutMs: 180_000 }
    );
  });

  it("runs one cycle inside the lock and returns its result", async () => {
    const job = addJob();
    jest.mocked(withJobLock).mockImplementation(async (_db, _name, fn) => ({
      ran: true,
      result: await fn(),
    }));

    await expect(runMirrorCycleLocked()).resolves.toEqual({
      skipped: false,
      done: 1,
      failed: 0,
      dead: 0,
    });
    expect(byId(job.id).state).toBe("done");
  });
});
