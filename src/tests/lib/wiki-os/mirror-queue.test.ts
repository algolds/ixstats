/** @jest-environment node */
/**
 * Plan 407: the mirror queue's rules. Per-title FIFO (a dead job blocks its title), a move holding both of its
 * titles, the backoff schedule, and the dead letter after 8 attempts.
 */
import type { WikiMirrorJob } from "@prisma/client";
import {
  backoffMs,
  claimJob,
  completeJob,
  failJob,
  loadWindow,
  MAX_ATTEMPTS,
  MAX_BATCH_JOBS,
  pickBatch,
  pickRunnable,
  purgeDoneJobs,
  reclaimInterruptedJobs,
  releaseJobs,
} from "~/lib/wiki-os/services/mirror-queue";

const mockFindMany = jest.fn();
const mockUpdate = jest.fn();
const mockUpdateMany = jest.fn();
const mockDeleteMany = jest.fn();
const mockFindUnique = jest.fn();

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

describe("backoffMs", () => {
  it("doubles from a minute and stops at an hour", () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8].map((attempts) => backoffMs(attempts) / 60_000)).toEqual([
      1, 2, 4, 8, 16, 32, 60, 60,
    ]);
  });
});

describe("pickRunnable", () => {
  it("is null when nothing is waiting", () => {
    expect(pickRunnable([], NOW)).toBeNull();
  });

  it("takes the oldest pending job that is due", () => {
    const first = job({ title: "A" });
    const second = job({ title: "B" });

    expect(pickRunnable([first, second], NOW)).toBe(first);
  });

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

  it("holds the title of a job that is running", () => {
    const running = job({ title: "Foo", state: "running", attempts: 1 });
    const sameTitle = job({ title: "Foo" });

    expect(pickRunnable([running, sameTitle], NOW)).toBeNull();
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

  it("does not run a job that is not due yet", () => {
    const later = job({ nextAttemptAt: new Date(NOW.getTime() + 1) });

    expect(pickRunnable([later], NOW)).toBeNull();
    expect(pickRunnable([later], new Date(NOW.getTime() + 1))).toBe(later);
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

  it("is the job alone when it is not a plain revision job", () => {
    const moving = move("Old", "New");
    const restore = job({ payload: { restore: true } });
    const deleting = job({ kind: "delete", payload: { reason: "" } });

    expect(pickBatch([moving, job({ title: "Old" })], moving, NOW)).toEqual([moving]);
    expect(pickBatch([restore, job()], restore, NOW)).toEqual([restore]);
    expect(pickBatch([deleting, job()], deleting, NOW)).toEqual([deleting]);
  });

  it("takes the plain revision jobs of the title that wait next, oldest first, and no other title's", () => {
    const first = job({ title: "Foo" });
    const other = job({ title: "Bar" });
    const second = job({ title: "Foo" });
    const third = job({ title: "Foo" });

    expect(ids(pickBatch([first, other, second, third], first, NOW))).toEqual([
      first.id,
      second.id,
      third.id,
    ]);
  });

  it("starts at the job it was given, never at an older one", () => {
    const older = job({ title: "Foo", state: "running" });
    const first = job({ title: "Foo" });
    const second = job({ title: "Foo" });

    expect(ids(pickBatch([older, first, second], first, NOW))).toEqual([first.id, second.id]);
  });

  it("stops at the first job of the title that is anything else", () => {
    const first = job({ title: "Foo" });
    const second = job({ title: "Foo" });
    const deleting = job({
      kind: "delete",
      title: "Foo",
      payload: { reason: "" },
      revisionId: null,
    });
    const after = job({ title: "Foo" });

    expect(ids(pickBatch([first, second, deleting, after], first, NOW))).toEqual([
      first.id,
      second.id,
    ]);
  });

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

  it("stops at a job that is running, dead or waiting out a backoff", () => {
    for (const blocker of [
      job({ title: "Foo", state: "running" }),
      job({ title: "Foo", state: "dead" }),
      job({ title: "Foo", attempts: 1, nextAttemptAt: new Date(NOW.getTime() + 1) }),
    ]) {
      const first = job({ title: "Foo" });
      const after = job({ title: "Foo" });

      expect(ids(pickBatch([first, blocker, after], first, NOW))).toEqual([first.id]);
    }
  });

  it("lets jobs of other titles, moves between other titles included, sit between the revisions", () => {
    const first = job({ title: "Foo" });
    const between = [
      job({ title: "Bar" }),
      move("A", "B"),
      job({ kind: "delete", title: "Baz", payload: { reason: "" } }),
    ];
    const second = job({ title: "Foo" });

    expect(ids(pickBatch([first, ...between, second], first, NOW))).toEqual([first.id, second.id]);
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
  it("reads the oldest not-done jobs of the realm, oldest first", async () => {
    mockFindMany.mockResolvedValue([]);

    await loadWindow();

    expect(mockFindMany).toHaveBeenCalledWith({
      where: { source: "ixwiki", state: { not: "done" } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: 1_000,
    });
  });

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

  it("completes a job with the MediaWiki revision it made, and clears the last error", async () => {
    await completeJob(job({ id: "job1" }), 555);
    await completeJob(job({ id: "job2" }), null);

    expect(mockUpdate.mock.calls[0]?.[0]).toEqual({
      where: { id: "job1" },
      data: { state: "done", lastError: null, mwRevId: 555 },
    });
    expect(mockUpdate.mock.calls[1]?.[0].data).toEqual({ state: "done", lastError: null });
  });

  it("keeps a note about how a job was finished in its payload, beside what the payload already says", async () => {
    await completeJob(job({ id: "job1" }), 7, "pushed as an edit");
    await completeJob(
      job({ id: "job2", payload: { restore: true, summary: "Restoring" } }),
      7,
      "pushed as an edit"
    );

    expect(mockUpdate.mock.calls[0]?.[0].data.payload).toEqual({
      restore: false,
      note: "pushed as an edit",
    });
    expect(mockUpdate.mock.calls[1]?.[0].data.payload).toEqual({
      restore: true,
      summary: "Restoring",
      note: "pushed as an edit",
    });
  });

  it("gives claimed jobs back: pending again, the attempt not counted", async () => {
    await releaseJobs(["job1", "job2"]);
    await releaseJobs([]);

    expect(mockUpdateMany).toHaveBeenCalledTimes(1);
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { id: { in: ["job1", "job2"] }, state: "running" },
      data: { state: "pending", attempts: { decrement: 1 } },
    });
  });

  it("sends a failed job back to pending after its backoff, keeping the error", async () => {
    await failJob(job({ attempts: 3 }), "MediaWiki 503", NOW);

    expect(mockUpdate.mock.calls[0]?.[0].data).toEqual({
      state: "pending",
      lastError: "MediaWiki 503",
      nextAttemptAt: new Date(NOW.getTime() + 4 * 60_000),
    });
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

  it("forgets only done jobs, a month after they finished", async () => {
    mockDeleteMany.mockResolvedValue({ count: 4 });

    await expect(purgeDoneJobs(NOW)).resolves.toBe(4);

    expect(mockDeleteMany).toHaveBeenCalledWith({
      where: {
        source: "ixwiki",
        state: "done",
        updatedAt: { lt: new Date(NOW.getTime() - 30 * 24 * 60 * 60_000) },
      },
    });
  });
});
