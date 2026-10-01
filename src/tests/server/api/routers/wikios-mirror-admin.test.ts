/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals": the hoisted jest.mock() factories rely on the ambient global.
//
// Plan 407: getMirrorStatus, requeueMirrorJob and discardMirrorJob are for administrators only.
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: {
    wikiMirrorJob: {
      groupBy: jest.fn().mockResolvedValue([{ state: "dead", _count: { _all: 1 } }]),
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn(),
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
    });
  });

  it("refuses a member and a visitor", async () => {
    await expect(member().getMirrorStatus()).rejects.toThrow(/Admin privileges required/);
    await expect(signedOut().getMirrorStatus()).rejects.toThrow(/Authentication required/);
  });
});

describe.each([
  [
    "requeueMirrorJob",
    { where: { id: "j1", source: "ixwiki", state: "dead" }, data: { state: "pending" } },
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
