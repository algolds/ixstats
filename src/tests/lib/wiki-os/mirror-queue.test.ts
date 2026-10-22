/** @jest-environment node */
/**
 * Plan 407: the mirror queue's rules and the outbox that fills it. Per-title FIFO (a dead job blocks its title), a
 * move holding both of its titles, claims only while pending, the dead letter after 8 attempts, the error column's
 * limit; the outbox never writes for the MediaWiki: namespace, fails the caller's transaction with its insert, and
 * kicks the worker once.
 */
const mockFindMany = jest.fn();
const mockUpdate = jest.fn();
const mockUpdateMany = jest.fn();
const mockDeleteMany = jest.fn();
const mockFindUnique = jest.fn();
const mockRunLocked = jest.fn();
jest.mock("~/server/db", () => ({
  db: {
    wikiMirrorJob: {
      findMany: (...a: unknown[]) => mockFindMany(...a),
      findUnique: (...a: unknown[]) => mockFindUnique(...a),
      update: (...a: unknown[]) => mockUpdate(...a),
      updateMany: (...a: unknown[]) => mockUpdateMany(...a),
      deleteMany: (...a: unknown[]) => mockDeleteMany(...a),
    },
  },
}));
jest.mock("~/lib/wiki-os/services/mirror-worker", () => ({
  __esModule: true,
  runMirrorCycleLocked: (...a: unknown[]) => mockRunLocked(...a),
}));

import type { WikiMirrorJob } from "@prisma/client";
import { claimJob, failJob, MAX_ATTEMPTS, MAX_BATCH_JOBS, pickBatch, pickRunnable, purgeDoneJobs, reclaimInterruptedJobs } from "~/lib/wiki-os/services/mirror-queue";
import { enqueueDeleteJob, enqueueMoveJob, enqueueProtectJob, enqueueRevisionJob, scheduleMirrorKick } from "~/lib/wiki-os/services/mirror-outbox";

const NOW = new Date("2026-10-01T12:00:00Z");
let counter = 0;

const job = (over: Partial<WikiMirrorJob> = {}): WikiMirrorJob => {
  counter += 1;
  return {
    id: `job${counter}`,
    source: "ixwiki",
    kind: "revision",
    title: "Foo",
    articleId: "a1",
    revisionId: `r${counter}`,
    logId: null,
    payload: null,
    state: "pending",
    attempts: 0,
    nextAttemptAt: new Date(NOW.getTime() - 1_000),
    lastError: null,
    mwRevId: null,
    createdAt: new Date(NOW.getTime() - 60_000 + counter),
    updatedAt: NOW,
    ...over,
  };
};

const move = (from: string, to: string, over: Partial<WikiMirrorJob> = {}) =>
  job({
    kind: "move",
    title: from,
    revisionId: null,
    payload: { to, reason: "", leaveRedirect: true },
    ...over,
  });

beforeEach(() => {
  jest.clearAllMocks();
  counter = 0;
});
describe("pickRunnable", () => {
  it("runs the jobs of one title in the order they were written: the younger waits for the older", () => {
    const older = job({ title: "Foo" });
    const younger = job({ title: "Foo" });

    expect(pickRunnable([older, younger], NOW)).toBe(older);
    // once the older one is done it is no longer in the window
    expect(pickRunnable([younger], NOW)).toBe(younger);
  });

  it("lets other titles overtake a title that is waiting out a backoff", () => {
    const backingOff = job({
      title: "Foo",
      nextAttemptAt: new Date(NOW.getTime() + 60_000),
      attempts: 1,
    });
    const sameTitle = job({ title: "Foo" });
    const other = job({ title: "Bar" });

    expect(pickRunnable([backingOff, sameTitle, other], NOW)).toBe(other);
  });
  it("lets a dead job block its title, and only its title, until it is requeued or discarded", () => {
    const dead = job({ title: "Foo", state: "dead", attempts: MAX_ATTEMPTS });
    const sameTitle = job({ title: "Foo" });
    const other = job({ title: "Bar" });

    expect(pickRunnable([dead, sameTitle], NOW)).toBeNull();
    expect(pickRunnable([dead, sameTitle, other], NOW)).toBe(other);
    // requeued: it is pending again and runs first
    expect(pickRunnable([{ ...dead, state: "pending" }, sameTitle], NOW)).toMatchObject({
      id: dead.id,
    });
    // discarded: it is done, so it is not in the window any more
    expect(pickRunnable([sameTitle], NOW)).toBe(sameTitle);
  });
  it("holds both titles of a move: the edits before it come first, the edits to the new title after it", () => {
    const editOld = job({ title: "Old" });
    const moving = move("Old", "New");
    const editNew = job({ title: "New" });
    const editOther = job({ title: "Other" });

    expect(pickRunnable([editOld, moving, editNew], NOW)).toBe(editOld);
    expect(pickRunnable([moving, editNew], NOW)).toBe(moving);
    expect(pickRunnable([{ ...moving, state: "dead" }, editNew], NOW)).toBeNull();
    expect(pickRunnable([{ ...moving, state: "dead" }, editNew, editOther], NOW)).toBe(editOther);
  });

  it("holds the destination of a move against another move to the same title", () => {
    const first = move("A", "Target");
    const second = move("B", "Target");

    expect(pickRunnable([first, second], NOW)).toBe(first);
    expect(pickRunnable([{ ...first, state: "dead" }, second], NOW)).toBeNull();
  });

  it("orders a move whose payload is unreadable by its own title", () => {
    const broken = job({ kind: "move", title: "Old", payload: { nonsense: true } });
    const other = job({ title: "New" });

    expect(pickRunnable([broken, other], NOW)).toBe(broken);
  });
});

describe("pickBatch", () => {
  const ids = (jobs: readonly WikiMirrorJob[]) => jobs.map((candidate) => candidate.id);
  it("stops at a restore, a move away from the title and a move to it", () => {
    for (const blocker of [
      job({ title: "Foo", payload: { restore: true, summary: "Restoring" } }),
      move("Foo", "Bar"),
      move("Other", "Foo"),
    ]) {
      const first = job({ title: "Foo" });
      const after = job({ title: "Foo" });

      expect(ids(pickBatch([first, blocker, after], first, NOW))).toEqual([first.id]);
    }
  });
  it("takes at most 50 jobs, or the cap it is given", () => {
    const jobs = Array.from({ length: 60 }, () => job({ title: "Foo" }));

    expect(MAX_BATCH_JOBS).toBe(50);
    expect(pickBatch(jobs, jobs[0]!, NOW)).toHaveLength(50);
    expect(ids(pickBatch(jobs, jobs[0]!, NOW))).toEqual(ids(jobs.slice(0, 50)));
    expect(pickBatch(jobs, jobs[0]!, NOW, 3)).toHaveLength(3);
    expect(pickBatch(jobs, jobs[0]!, NOW, 1)).toEqual([jobs[0]]);
  });
});

describe("the queue's writes", () => {
  it("claims a job only while it is pending: running, one more attempt, and the row as it is now", async () => {
    mockUpdateMany.mockResolvedValue({ count: 1 });
    mockFindUnique.mockResolvedValue(job({ id: "job1", state: "running", attempts: 1 }));

    await expect(claimJob("job1")).resolves.toMatchObject({ id: "job1", state: "running" });

    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { id: "job1", state: "pending" },
      data: { state: "running", attempts: { increment: 1 } },
    });
    expect(mockFindUnique).toHaveBeenCalledWith({ where: { id: "job1" } });
  });

  it("does not claim a job another runner already took, and reads nothing back", async () => {
    mockUpdateMany.mockResolvedValue({ count: 0 });

    await expect(claimJob("job1")).resolves.toBeNull();

    expect(mockFindUnique).not.toHaveBeenCalled();
  });
  it("makes a job dead on its 8th failed attempt, with no further attempt scheduled", async () => {
    await failJob(job({ attempts: MAX_ATTEMPTS - 1 }), "x", NOW);
    await failJob(job({ attempts: MAX_ATTEMPTS }), "bot login failed", NOW);

    expect(mockUpdate.mock.calls[0]?.[0].data.state).toBe("pending");
    expect(mockUpdate.mock.calls[1]?.[0].data).toEqual({
      state: "dead",
      lastError: "bot login failed",
    });
  });

  it("keeps the last error within its VarChar(2000) column", async () => {
    await failJob(job({ attempts: 1 }), "x".repeat(5_000), NOW);

    expect(mockUpdate.mock.calls[0]?.[0].data.lastError).toHaveLength(2_000);
  });

  it("puts a job back to pending only when it has been running longer than an attempt can", async () => {
    mockUpdateMany.mockResolvedValue({ count: 2 });

    await expect(reclaimInterruptedJobs(NOW)).resolves.toBe(2);

    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: {
        source: "ixwiki",
        state: "running",
        updatedAt: { lt: new Date(NOW.getTime() - 10 * 60_000) },
      },
      data: { state: "pending" },
    });
  });

  it("forgets only finished jobs (done or discarded), a month after they finished", async () => {
    mockDeleteMany.mockResolvedValue({ count: 4 });

    await expect(purgeDoneJobs(NOW)).resolves.toBe(4);

    expect(mockDeleteMany).toHaveBeenCalledWith({
      where: {
        source: "ixwiki",
        state: { in: ["done", "discarded"] },
        updatedAt: { lt: new Date(NOW.getTime() - 30 * 24 * 60 * 60_000) },
      },
    });
  });
});

describe("the outbox", () => {
  const create = jest.fn();
  const tx = { wikiMirrorJob: { create } } as never;

  beforeEach(() => {
    jest.clearAllMocks();
    create.mockResolvedValue({});
    delete process.env.SKIP_MEDIAWIKI_SYNC;
  });

  describe("the inserts", () => {
    it("writes nothing for the MediaWiki: namespace, which the mirror account may never write", async () => {
      await enqueueRevisionJob(tx, { title: "MediaWiki:Sidebar", articleId: "a1", revisionId: "r1" });
      await enqueueRevisionJob(tx, {
        title: "mediawiki:common.css",
        articleId: "a1",
        revisionId: "r1",
      });
      await enqueueDeleteJob(tx, "delete", {
        title: "MediaWiki:Sidebar",
        articleId: "a1",
        logId: "l",
        reason: "",
      });
      await enqueueProtectJob(tx, {
        title: "MediaWiki:Sidebar",
        articleId: "a1",
        logId: "l",
        reason: "",
        restrictions: [{ action: "edit", level: "sysop", expiresAt: null }],
      });
      // a move out of, or into, the namespace is as impossible
      await enqueueMoveJob(tx, {
        title: "MediaWiki:Sidebar",
        articleId: "a1",
        logId: "l",
        to: "Sidebar",
        reason: "",
        leaveRedirect: true,
      });
      await enqueueMoveJob(tx, {
        title: "Sidebar",
        articleId: "a1",
        logId: "l",
        to: "MediaWiki:Sidebar",
        reason: "",
        leaveRedirect: true,
      });

      expect(create).not.toHaveBeenCalled();
    });

    it("still mirrors the namespaces around it (Template:, Module:, MediaWiki talk:)", async () => {
      for (const title of ["Template:Box", "Module:Box", "MediaWiki talk:Sidebar", "Foo"]) {
        await enqueueRevisionJob(tx, { title, articleId: "a1", revisionId: "r1" });
      }

      expect(create).toHaveBeenCalledTimes(4);
    });

    it("lets a failed insert fail the caller's transaction", async () => {
      create.mockRejectedValue(new Error("outbox down"));

      await expect(
        enqueueRevisionJob(tx, { title: "Foo", articleId: "a1", revisionId: "r1" })
      ).rejects.toThrow("outbox down");
    });
  });

  describe("scheduleMirrorKick", () => {
    beforeEach(() => {
      jest.useFakeTimers();
      mockRunLocked.mockResolvedValue({ skipped: false, done: 1, failed: 0, dead: 0 });
    });
    afterEach(async () => {
      await jest.advanceTimersByTimeAsync(5_000); // let a pending kick finish before the next test
      jest.useRealTimers();
    });

    it("runs the worker once, two seconds after the first write, however many writes there were", async () => {
      scheduleMirrorKick();
      scheduleMirrorKick();
      await jest.advanceTimersByTimeAsync(1_999);
      scheduleMirrorKick();
      expect(mockRunLocked).not.toHaveBeenCalled();

      await jest.advanceTimersByTimeAsync(1);

      expect(mockRunLocked).toHaveBeenCalledTimes(1);
    });
    it("does nothing while SKIP_MEDIAWIKI_SYNC is true: the jobs wait in the outbox", async () => {
      process.env.SKIP_MEDIAWIKI_SYNC = "true";

      scheduleMirrorKick();
      await jest.advanceTimersByTimeAsync(10_000);

      expect(mockRunLocked).not.toHaveBeenCalled();
    });

    it("never lets a failed run escape: it is logged", async () => {
      const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
      mockRunLocked.mockRejectedValue(new Error("lock timeout"));

      scheduleMirrorKick();
      await jest.advanceTimersByTimeAsync(2_000);

      expect(warn).toHaveBeenCalledWith("[WikiMirror] The in-process run failed:", expect.any(Error));
      warn.mockRestore();
    });
  });
});
