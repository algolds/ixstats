/** @jest-environment node */
/**
 * Plan 407: the outbox's inserts (one row per WikiOS write, in the caller's transaction) and the debounced
 * in-process kick that runs the worker shortly after a write.
 */
import {
  enqueueDeleteJob,
  enqueueMoveJob,
  enqueueProtectJob,
  enqueueRevisionJob,
  scheduleMirrorKick,
} from "~/lib/wiki-os/services/mirror-outbox";

const mockRunLocked = jest.fn();
jest.mock("~/lib/wiki-os/services/mirror-worker", () => ({
  __esModule: true,
  runMirrorCycleLocked: (...a: unknown[]) => mockRunLocked(...a),
}));

const create = jest.fn();
const tx = { wikiMirrorJob: { create } } as never;

beforeEach(() => {
  jest.clearAllMocks();
  create.mockResolvedValue({});
  delete process.env.SKIP_MEDIAWIKI_SYNC;
});

describe("the inserts", () => {
  it("writes a revision job with the revision it names, and no payload", async () => {
    await enqueueRevisionJob(tx, { title: "Foo", articleId: "a1", revisionId: "r1" });

    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith({
      data: { source: "ixwiki", kind: "revision", title: "Foo", articleId: "a1", revisionId: "r1" },
    });
  });

  it("writes a restore as a revision job whose payload says so, with the summary", async () => {
    await enqueueRevisionJob(tx, {
      title: "Foo",
      articleId: "a1",
      revisionId: "r1",
      restore: { summary: "Restoring WikiOS revision 9" },
    });

    expect(create.mock.calls[0]?.[0].data).toMatchObject({
      kind: "revision",
      payload: { restore: true, summary: "Restoring WikiOS revision 9" },
    });
  });

  it("writes a move from the old title with the target, reason and redirect, tied to its log row", async () => {
    await enqueueMoveJob(tx, {
      title: "Old",
      articleId: "a1",
      logId: "log1",
      to: "New",
      reason: "tidy",
      leaveRedirect: false,
    });

    expect(create).toHaveBeenCalledWith({
      data: {
        source: "ixwiki",
        kind: "move",
        title: "Old",
        articleId: "a1",
        logId: "log1",
        payload: { to: "New", reason: "tidy", leaveRedirect: false },
      },
    });
  });

  it("writes delete and undelete jobs with the reason", async () => {
    const job = { title: "Foo", articleId: "a1", logId: "log1", reason: "spam" };
    await enqueueDeleteJob(tx, "delete", job);
    await enqueueDeleteJob(tx, "undelete", job);

    expect(create.mock.calls.map(([args]) => [args.data.kind, args.data.payload])).toEqual([
      ["delete", { reason: "spam" }],
      ["undelete", { reason: "spam" }],
    ]);
  });

  it("writes a protect job with its restrictions, for a page that may not exist (no article id)", async () => {
    await enqueueProtectJob(tx, {
      title: "Salted",
      articleId: null,
      logId: "log1",
      reason: "",
      restrictions: [{ action: "create", level: "sysop", expiresAt: null }],
    });

    expect(create.mock.calls[0]?.[0].data).toMatchObject({
      kind: "protect",
      title: "Salted",
      articleId: null,
      payload: {
        reason: "",
        restrictions: [{ action: "create", level: "sysop", expiresAt: null }],
      },
    });
  });

  it("writes nothing for a realm that has no MediaWiki to mirror to", async () => {
    await enqueueRevisionJob(tx, {
      title: "Foo",
      articleId: "a1",
      revisionId: "r1",
      source: "iiwiki",
    });
    await enqueueMoveJob(tx, {
      title: "Old",
      articleId: "a1",
      logId: "l",
      to: "New",
      reason: "",
      leaveRedirect: true,
      source: "althistory",
    });
    await enqueueDeleteJob(tx, "delete", {
      title: "Foo",
      articleId: "a1",
      logId: "l",
      reason: "",
      source: "iiwiki",
    });
    await enqueueProtectJob(tx, {
      title: "Foo",
      articleId: null,
      logId: "l",
      reason: "",
      restrictions: [],
      source: "iiwiki",
    });

    expect(create).not.toHaveBeenCalled();
  });

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

  it("kicks again for a write after the run", async () => {
    scheduleMirrorKick();
    await jest.advanceTimersByTimeAsync(2_000);
    scheduleMirrorKick();
    await jest.advanceTimersByTimeAsync(2_000);

    expect(mockRunLocked).toHaveBeenCalledTimes(2);
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
