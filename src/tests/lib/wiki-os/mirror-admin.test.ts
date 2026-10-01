/** @jest-environment node */
/**
 * Plan 407: the administrator's view of the outbox, and requeue / discard of dead jobs (only dead ones).
 */
// The mirror's api.php and bot login come from `wikiosConfig`; this test sets their variables as it runs.
jest.mock("~/lib/wiki-os/config", () =>
  jest
    .requireActual("~/tests/helpers/live-wikios-config")
    .withLiveEnvironment(jest.requireActual("~/lib/wiki-os/config"))
);

import {
  discardMirrorJob,
  getMirrorStatus,
  requeueMirrorJob,
} from "~/lib/wiki-os/services/mirror-admin";
import { PageOperationError } from "~/lib/wiki-os/core/page-management-service";
import { scheduleMirrorKick } from "~/lib/wiki-os/services/mirror-outbox";

const mockGroupBy = jest.fn();
const mockFindFirst = jest.fn();
const mockFindMany = jest.fn();
const mockUpdateMany = jest.fn();
const mockCount = jest.fn();

jest.mock("~/server/db", () => ({
  db: {
    wikiMirrorJob: {
      groupBy: (...a: unknown[]) => mockGroupBy(...a),
      findFirst: (...a: unknown[]) => mockFindFirst(...a),
      findMany: (...a: unknown[]) => mockFindMany(...a),
      updateMany: (...a: unknown[]) => mockUpdateMany(...a),
      count: (...a: unknown[]) => mockCount(...a),
    },
  },
}));
jest.mock("~/lib/wiki-os/core/page-management-service", () => ({
  PageOperationError: class PageOperationError extends Error {
    constructor(
      readonly code: string,
      message: string
    ) {
      super(message);
    }
  },
}));
jest.mock("~/lib/wiki-os/services/mirror-outbox", () => ({
  MIRROR_SOURCE: "ixwiki",
  scheduleMirrorKick: jest.fn(),
}));

const NOW = new Date("2026-10-01T12:00:00Z");

beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.SKIP_MEDIAWIKI_SYNC;
  process.env.WIKIOS_MEDIAWIKI_BOT_USER = "WikiOSMirror@wikios";
  process.env.WIKIOS_MEDIAWIKI_BOT_TOKEN = "secret";
  mockGroupBy.mockResolvedValue([]);
  mockFindFirst.mockResolvedValue(null);
  mockFindMany.mockResolvedValue([]);
  mockCount.mockResolvedValue(0);
});

describe("getMirrorStatus", () => {
  it("counts the jobs by state, with zero for a state with none", async () => {
    mockGroupBy.mockResolvedValue([
      { state: "pending", _count: { _all: 3 } },
      { state: "dead", _count: { _all: 1 } },
      { state: "done", _count: { _all: 40 } },
      { state: "discarded", _count: { _all: 2 } },
    ]);

    const status = await getMirrorStatus(NOW);

    expect(status.counts).toEqual({ pending: 3, running: 0, done: 40, dead: 1, discarded: 2 });
    expect(mockGroupBy).toHaveBeenCalledWith({
      by: ["state"],
      where: { source: "ixwiki" },
      _count: { _all: true },
    });
  });

  it("counts the uploads MediaWiki does not hold yet (dead ones too: only WikiOS has their bytes)", async () => {
    mockCount.mockResolvedValue(4);

    const status = await getMirrorStatus(NOW);

    expect(status.uploadsWaiting).toBe(4);
    expect(mockCount).toHaveBeenCalledWith({
      where: { source: "ixwiki", kind: "upload", state: { in: ["pending", "running", "dead"] } },
    });
  });

  it("reports how long the oldest unfinished job has waited, and null when nothing waits", async () => {
    mockFindFirst.mockResolvedValue({ createdAt: new Date(NOW.getTime() - 125_000) });
    expect((await getMirrorStatus(NOW)).oldestPendingSeconds).toBe(125);
    expect(mockFindFirst).toHaveBeenCalledWith({
      where: { source: "ixwiki", state: { in: ["pending", "running"] } },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    });

    mockFindFirst.mockResolvedValue(null);
    expect((await getMirrorStatus(NOW)).oldestPendingSeconds).toBeNull();
  });

  it("lists the last 20 dead jobs, newest first, with what went wrong", async () => {
    const createdAt = new Date("2026-10-01T10:00:00Z");
    const updatedAt = new Date("2026-10-01T11:00:00Z");
    mockFindMany.mockResolvedValue([
      {
        id: "j1",
        kind: "move",
        title: "Old",
        attempts: 8,
        lastError: "MediaWiki cantmove",
        createdAt,
        updatedAt,
      },
    ]);

    const status = await getMirrorStatus(NOW);

    expect(status.dead).toEqual([
      {
        id: "j1",
        kind: "move",
        title: "Old",
        attempts: 8,
        lastError: "MediaWiki cantmove",
        createdAt,
        diedAt: updatedAt,
      },
    ]);
    expect(mockFindMany.mock.calls[0]?.[0]).toMatchObject({
      where: { source: "ixwiki", state: "dead" },
      orderBy: { updatedAt: "desc" },
      take: 20,
    });
  });

  it("says when the worker is stopped or has no bot account", async () => {
    expect(await getMirrorStatus(NOW)).toMatchObject({ paused: false, botConfigured: true });

    process.env.SKIP_MEDIAWIKI_SYNC = "true";
    delete process.env.WIKIOS_MEDIAWIKI_BOT_TOKEN;
    expect(await getMirrorStatus(NOW)).toMatchObject({ paused: true, botConfigured: false });

    delete process.env.WIKIOS_MEDIAWIKI_BOT_USER;
    process.env.WIKIOS_MEDIAWIKI_BOT_TOKEN = "secret";
    expect((await getMirrorStatus(NOW)).botConfigured).toBe(false);
  });

  it("never carries the bot's password", async () => {
    expect(JSON.stringify(await getMirrorStatus(NOW))).not.toContain("secret");
  });
});

describe("requeueMirrorJob", () => {
  it("makes a dead job pending again, due now, from its first attempt, and kicks the worker", async () => {
    mockUpdateMany.mockResolvedValue({ count: 1 });

    await requeueMirrorJob("j1");

    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { id: "j1", source: "ixwiki", state: "dead" },
      data: { state: "pending", attempts: 0, nextAttemptAt: expect.any(Date) },
    });
    expect(scheduleMirrorKick).toHaveBeenCalledTimes(1);
  });

  it("refuses a job that is not dead or does not exist", async () => {
    mockUpdateMany.mockResolvedValue({ count: 0 });

    const failure = await requeueMirrorJob("j1").catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(PageOperationError);
    expect(failure).toMatchObject({ code: "NOT_FOUND" });
    expect(scheduleMirrorKick).not.toHaveBeenCalled();
  });
});

describe("discardMirrorJob", () => {
  it("makes a dead job `discarded`, not `done`, keeping its last error, so the jobs behind it can run", async () => {
    mockUpdateMany.mockResolvedValue({ count: 1 });

    await discardMirrorJob("j1");

    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { id: "j1", source: "ixwiki", state: "dead" },
      data: { state: "discarded" },
    });
    expect(scheduleMirrorKick).toHaveBeenCalledTimes(1);
  });

  it("refuses a job that is not dead or does not exist", async () => {
    mockUpdateMany.mockResolvedValue({ count: 0 });

    await expect(discardMirrorJob("j1")).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(scheduleMirrorKick).not.toHaveBeenCalled();
  });
});
