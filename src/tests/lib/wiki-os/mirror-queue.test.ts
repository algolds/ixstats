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
  pickRunnable,
  purgeDoneJobs,
  reclaimInterruptedJobs,
} from "~/lib/wiki-os/services/mirror-queue";

const mockFindMany = jest.fn();
const mockUpdate = jest.fn();
const mockUpdateMany = jest.fn();
const mockDeleteMany = jest.fn();

jest.mock("~/server/db", () => ({
  db: {
    wikiMirrorJob: {
      findMany: (...a: unknown[]) => mockFindMany(...a),
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

  it("claims a job: running, one more attempt", async () => {
    await claimJob("job1");

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "job1" },
      data: { state: "running", attempts: { increment: 1 } },
    });
  });

  it("completes a job with the MediaWiki revision it made, and clears the last error", async () => {
    await completeJob("job1", 555);
    await completeJob("job2", null);

    expect(mockUpdate.mock.calls[0]?.[0]).toEqual({
      where: { id: "job1" },
      data: { state: "done", lastError: null, mwRevId: 555 },
    });
    expect(mockUpdate.mock.calls[1]?.[0].data).toEqual({ state: "done", lastError: null });
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
