/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals": the hoisted jest.mock() factories rely on the ambient global.
//
// Plan 407: getMirrorStatus, requeueMirrorJob and discardMirrorJob are for administrators only; the status never carries
// the bot's password, a requeued job starts again from its first attempt, a discarded one keeps its error.
jest.mock("~/lib/wiki-os/config", () =>
  jest
    .requireActual("~/tests/helpers/live-wikios-config")
    .withLiveEnvironment(jest.requireActual("~/lib/wiki-os/config"))
);
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: {
    wikiMirrorJob: {
      groupBy: jest.fn().mockResolvedValue([{ state: "dead", _count: { _all: 1 } }]),
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
    },
  },
  isDatabaseReadOnly: true,
}));
jest.mock("~/lib/auth", () => ({
  __esModule: true,
  isSystemOwner: (id: string) => id === "user_owner",
  SYSTEM_OWNER_IDS: ["user_owner"],
  UserManagementService: jest.fn(),
}));
jest.mock("~/lib/auth/system-owner-constants", () => ({
  __esModule: true,
  isSystemOwner: (id: string) => id === "user_owner",
}));
jest.mock("~/lib/wiki-os/services/mirror-outbox", () => ({
  __esModule: true,
  ...jest.requireActual("~/lib/wiki-os/services/mirror-outbox"),
  scheduleMirrorKick: jest.fn(),
}));
jest.mock("~/lib/wiki-os/services/auto-sync-service", () => ({
  __esModule: true,
  getInboundSyncStatus: jest.fn(),
}));

import { describe, it, expect, beforeEach } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { wikiosUtilitiesRouter } from "~/server/api/routers/wikios/utilities";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { db } from "~/server/db";
import { scheduleMirrorKick } from "~/lib/wiki-os/services/mirror-outbox";

const createCaller = createCallerFactory(wikiosUtilitiesRouter);
const caller = (role: string, level: number, clerk = "user_x") =>
  createCaller(
    createMockRouterContext({
      auth: { userId: clerk },
      user: { id: "db1", clerkUserId: clerk, role: { name: role, level } },
    }) as never
  );
const admin = () => caller("admin", 10);
const member = () => caller("user", 100);
const signedOut = () => createCaller(createMockRouterContext({ auth: null, user: null }) as never);

const updateMany = jest.mocked(db.wikiMirrorJob.updateMany);

beforeEach(() => {
  jest.clearAllMocks();
  updateMany.mockResolvedValue({ count: 1 });
});

describe("getMirrorStatus", () => {
  it("shows the outbox to an administrator", async () => {
    await expect(admin().getMirrorStatus()).resolves.toMatchObject({
      counts: { dead: 1, pending: 0 },
      dead: [],
      windowSaturated: false,
    });
  });

  it("says the window is saturated when a full window of jobs waits that is not finished and not dead", async () => {
    const groupBy = jest.mocked(db.wikiMirrorJob.groupBy) as jest.Mock;
    groupBy.mockResolvedValueOnce([
      { state: "pending", _count: { _all: 990 } },
      { state: "running", _count: { _all: 10 } },
      { state: "dead", _count: { _all: 5_000 } },
    ]);
    await expect(admin().getMirrorStatus()).resolves.toMatchObject({ windowSaturated: true });

    groupBy.mockResolvedValueOnce([
      { state: "pending", _count: { _all: 999 } },
      { state: "dead", _count: { _all: 5_000 } },
    ]);
    await expect(admin().getMirrorStatus()).resolves.toMatchObject({ windowSaturated: false });
  });

  it("never carries the bot's password", async () => {
    process.env.WIKIOS_MEDIAWIKI_BOT_USER = "WikiOSMirror@wikios";
    process.env.WIKIOS_MEDIAWIKI_BOT_TOKEN = "secret-bot-password";
    try {
      const status = await admin().getMirrorStatus();
      expect(status).toMatchObject({ botConfigured: true });
      expect(JSON.stringify(status)).not.toContain("secret-bot-password");
    } finally {
      delete process.env.WIKIOS_MEDIAWIKI_BOT_USER;
      delete process.env.WIKIOS_MEDIAWIKI_BOT_TOKEN;
    }
  });

  it("refuses a member and a visitor", async () => {
    await expect(member().getMirrorStatus()).rejects.toThrow(/Admin privileges required/);
    await expect(signedOut().getMirrorStatus()).rejects.toThrow(/Authentication required/);
  });
});

describe.each([
  [
    "requeueMirrorJob",
    {
      where: { id: "j1", source: "ixwiki", state: "dead" },
      data: { state: "pending", attempts: 0, lastError: null, nextAttemptAt: expect.any(Date) },
    },
  ],
  [
    "discardMirrorJob",
    { where: { id: "j1", source: "ixwiki", state: "dead" }, data: { state: "discarded" } },
  ],
] as const)("%s", (name, expected) => {
  it("acts on a dead job for an administrator", async () => {
    await expect(admin()[name]({ id: "j1" })).resolves.toEqual({ success: true });

    expect(updateMany.mock.calls[0]?.[0]).toMatchObject(expected);
  });

  it("answers NOT_FOUND for a job that is not dead", async () => {
    updateMany.mockResolvedValue({ count: 0 });

    await expect(admin()[name]({ id: "j1" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("refuses a member and a visitor, and touches nothing", async () => {
    await expect(member()[name]({ id: "j1" })).rejects.toThrow(/Admin privileges required/);
    await expect(signedOut()[name]({ id: "j1" })).rejects.toThrow(/Authentication required/);

    expect(updateMany).not.toHaveBeenCalled();
  });

  it("refuses an empty or oversized id", async () => {
    await expect(admin()[name]({ id: "" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(admin()[name]({ id: "x".repeat(65) })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });
});

describe.each([
  [
    "requeueDeadMirrorJobs",
    { state: "pending", attempts: 0, lastError: null, nextAttemptAt: expect.any(Date) },
  ],
  ["discardDeadMirrorJobs", { state: "discarded" }],
] as const)("%s", (name, data) => {
  it("acts on the dead jobs of a title, or on every dead job, and answers how many", async () => {
    updateMany.mockResolvedValue({ count: 3 });

    await expect(admin()[name]({ title: "Foo" })).resolves.toEqual({ count: 3 });
    expect(updateMany.mock.calls[0]?.[0]).toEqual({
      where: { source: "ixwiki", state: "dead", title: "Foo" },
      data,
    });

    await expect(admin()[name]({})).resolves.toEqual({ count: 3 });
    expect(updateMany.mock.calls[1]?.[0]).toEqual({
      where: { source: "ixwiki", state: "dead" },
      data,
    });
  });

  it("kicks the worker only when a job changed", async () => {
    updateMany.mockResolvedValue({ count: 0 });
    await expect(admin()[name]({})).resolves.toEqual({ count: 0 });
    expect(scheduleMirrorKick).not.toHaveBeenCalled();

    updateMany.mockResolvedValue({ count: 2 });
    await admin()[name]({});
    expect(scheduleMirrorKick).toHaveBeenCalledTimes(1);
  });

  it("refuses a member and a visitor, and touches nothing", async () => {
    await expect(member()[name]({})).rejects.toThrow(/Admin privileges required/);
    await expect(signedOut()[name]({ title: "Foo" })).rejects.toThrow(/Authentication required/);

    expect(updateMany).not.toHaveBeenCalled();
  });

  it("refuses an empty or oversized title", async () => {
    await expect(admin()[name]({ title: "" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(admin()[name]({ title: "x".repeat(256) })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(updateMany).not.toHaveBeenCalled();
  });
});
