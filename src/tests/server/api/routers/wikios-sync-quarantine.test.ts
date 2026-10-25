/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals": the hoisted jest.mock() factories rely on the ambient global.
//
// Plan 2026-10-24 Task 12 (A5): the inbound sync's quarantined steps are for administrators only. The list, a retry
// (its outcome) and a dismissal go to inbound-dead-letters.ts; a step that is not quarantined is NOT_FOUND and a retry
// while a sync holds the lock is CONFLICT.
jest.mock("~/lib/wiki-os/config", () =>
  jest
    .requireActual("~/tests/helpers/live-wikios-config")
    .withLiveEnvironment(jest.requireActual("~/lib/wiki-os/config"))
);
jest.mock("~/server/db", () => ({ __esModule: true, db: {}, isDatabaseReadOnly: true }));
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
jest.mock("~/lib/wiki-os/services/auto-sync-service", () => ({
  __esModule: true,
  getInboundSyncStatus: jest.fn(),
}));
jest.mock("~/lib/wiki-os/services/inbound-dead-letters", () => ({
  __esModule: true,
  listQuarantined: jest.fn(),
  retryQuarantined: jest.fn(),
  dismissQuarantined: jest.fn(),
}));

import { createCallerFactory } from "~/server/api/trpc";
import { wikiosUtilitiesRouter } from "~/server/api/routers/wikios/utilities";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { PageOperationError } from "~/lib/wiki-os/core/page-management-service";
import {
  dismissQuarantined,
  listQuarantined,
  retryQuarantined,
} from "~/lib/wiki-os/services/inbound-dead-letters";

const createCaller = createCallerFactory(wikiosUtilitiesRouter);
const caller = (role: string, level: number) =>
  createCaller(
    createMockRouterContext({
      auth: { userId: "user_x" },
      user: { id: "db1", clerkUserId: "user_x", role: { name: role, level } },
    }) as never
  );
const admin = () => caller("admin", 10);
const member = () => caller("user", 100);
const signedOut = () => createCaller(createMockRouterContext({ auth: null, user: null }) as never);

const list = jest.mocked(listQuarantined);
const retry = jest.mocked(retryQuarantined);
const dismiss = jest.mocked(dismissQuarantined);

const step = {
  id: "dl1",
  stepKey: "rc:5",
  stream: "edits",
  subject: "Caphiria",
  label: "Caphiria",
  attempts: 5,
  lastError: "HTTP 500",
  quarantinedAt: new Date("2026-10-24T10:00:00Z"),
};

beforeEach(() => {
  jest.clearAllMocks();
  list.mockResolvedValue([step]);
  retry.mockResolvedValue("applied");
  dismiss.mockResolvedValue(undefined);
});

describe("the quarantined sync steps", () => {
  it("lists them for an administrator, 50 unless asked for fewer", async () => {
    await expect(admin().getQuarantinedSyncSteps()).resolves.toEqual([step]);
    expect(list).toHaveBeenLastCalledWith(50);

    await admin().getQuarantinedSyncSteps({ limit: 10 });
    expect(list).toHaveBeenLastCalledWith(10);
  });

  it("retries one and says how it went", async () => {
    await expect(admin().retryQuarantinedSyncStep({ id: "dl1" })).resolves.toEqual({
      outcome: "applied",
    });
    expect(retry).toHaveBeenCalledWith("dl1");

    retry.mockResolvedValueOnce("failed");
    await expect(admin().retryQuarantinedSyncStep({ id: "dl1" })).resolves.toEqual({
      outcome: "failed",
    });
  });

  it("dismisses one", async () => {
    await expect(admin().dismissQuarantinedSyncStep({ id: "dl1" })).resolves.toEqual({
      success: true,
    });
    expect(dismiss).toHaveBeenCalledWith("dl1");
  });

  it("answers NOT_FOUND for a step that is not quarantined and CONFLICT while a sync runs", async () => {
    dismiss.mockRejectedValueOnce(new PageOperationError("NOT_FOUND", "No quarantined step."));
    await expect(admin().dismissQuarantinedSyncStep({ id: "x" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });

    retry.mockRejectedValueOnce(new PageOperationError("CONFLICT", "A sync is running."));
    await expect(admin().retryQuarantinedSyncStep({ id: "dl1" })).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  it("refuses a member and a visitor, touching nothing", async () => {
    await expect(member().getQuarantinedSyncSteps()).rejects.toThrow(/Admin privileges required/);
    await expect(member().retryQuarantinedSyncStep({ id: "dl1" })).rejects.toThrow(
      /Admin privileges required/
    );
    await expect(member().dismissQuarantinedSyncStep({ id: "dl1" })).rejects.toThrow(
      /Admin privileges required/
    );
    await expect(signedOut().getQuarantinedSyncSteps()).rejects.toThrow(/Authentication required/);
    expect(list).not.toHaveBeenCalled();
    expect(retry).not.toHaveBeenCalled();
    expect(dismiss).not.toHaveBeenCalled();
  });
});
