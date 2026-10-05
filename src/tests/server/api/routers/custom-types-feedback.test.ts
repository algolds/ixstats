/** @jest-environment node */
/**
 * customTypes and userLogging routers: both need a signed-in user and act only as ctx.user.
 * Custom government types and field values are per user; feedback is stored, sent to admins and
 * delivered to each admin (other than the sender) as a ThinkShare message.
 *
 * `jest` is the ambient global (not imported from "@jest/globals") because the hoisted
 * jest.mock() factory below calls jest.fn() inline; see trpc-impersonation.test.ts.
 */
jest.mock("~/lib/notifications/api", () => ({
  __esModule: true,
  notificationAPI: { create: jest.fn().mockResolvedValue(undefined) },
}));

import { describe, it, expect, beforeEach, afterAll } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { customTypesRouter } from "~/server/api/routers/customTypes";
import { userLoggingRouter } from "~/server/api/routers/user-logging";
import { FeedbackLogger } from "~/lib/logging";
import { notificationAPI } from "~/lib/notifications/api";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockPrisma, type MockPrismaProxy } from "~/tests/helpers/mock-db";

const customTypes = createCallerFactory(customTypesRouter);
const userLogging = createCallerFactory(userLoggingRouter);

const feedbackLogSpy = jest.spyOn(FeedbackLogger, "logFeedback").mockImplementation(() => {});
afterAll(() => feedbackLogSpy.mockRestore());

function ctx(db: MockPrismaProxy, id: string | null) {
  return createMockRouterContext({
    db,
    auth: id ? { userId: `clerk_${id}` } : null,
    user: id ? { id, clerkUserId: `clerk_${id}`, countryId: "c1" } : null,
    rateLimitIdentifier: `${id}_${Math.random()}`,
  }) as never;
}

let db: MockPrismaProxy;

beforeEach(() => {
  jest.clearAllMocks();
  db = createMockPrisma();
});

describe("customTypes", () => {
  it("rejects signed-out callers", async () => {
    await expect(customTypes(ctx(db, null)).getUserCustomGovernmentTypes()).rejects.toThrow(
      /Authentication required/
    );
  });

  it("lists only the caller's own custom government types", async () => {
    await customTypes(ctx(db, "u1")).getUserCustomGovernmentTypes();
    expect(db.customGovernmentType.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "u1" } })
    );
  });

  it("creates a new type for the caller, or bumps the usage of an existing one", async () => {
    const caller = customTypes(ctx(db, "u1"));

    db.customGovernmentType.findUnique.mockResolvedValue(null);
    await caller.upsertCustomGovernmentType({ customTypeName: "Merchant Republic" });
    expect(db.customGovernmentType.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "u1",
        customTypeName: "Merchant Republic",
        usageCount: 1,
      }),
    });

    db.customGovernmentType.findUnique.mockResolvedValue({ id: "t1" });
    await caller.upsertCustomGovernmentType({ customTypeName: "Merchant Republic" });
    expect(db.customGovernmentType.update).toHaveBeenCalledWith({
      where: { id: "t1" },
      data: expect.objectContaining({ usageCount: { increment: 1 } }),
    });
    expect(db.customGovernmentType.findUnique).toHaveBeenCalledWith({
      where: { userId_customTypeName: { userId: "u1", customTypeName: "Merchant Republic" } },
    });
  });

  it("validates names", async () => {
    await expect(
      customTypes(ctx(db, "u1")).upsertCustomGovernmentType({ customTypeName: "" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      customTypes(ctx(db, "u1")).upsertFieldValue({ fieldName: "x", value: "v".repeat(501) })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("splits suggestions between global values and the caller's own", async () => {
    await customTypes(ctx(db, "u1")).getFieldSuggestions({
      fieldName: "capital",
      limit: 5,
      searchQuery: "port",
    });

    expect(db.customFieldValue.findMany).toHaveBeenNthCalledWith(1, {
      where: {
        fieldName: "capital",
        value: { contains: "port", mode: "insensitive" },
        isGlobal: true,
      },
      orderBy: { usageCount: "desc" },
      take: 2,
    });
    expect(db.customFieldValue.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({ fieldName: "capital", userId: "u1" }),
        take: 3,
      })
    );
  });

  it("saves field values under the caller", async () => {
    db.customFieldValue.findUnique.mockResolvedValue(null);
    await customTypes(ctx(db, "u1")).upsertFieldValue({ fieldName: "capital", value: "Venceia" });
    expect(db.customFieldValue.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ fieldName: "capital", value: "Venceia", userId: "u1" }),
    });
  });
});

describe("userLogging.submitFeedback", () => {
  const feedback = {
    feedbackType: "bug",
    message: "The map is blank",
    url: "/maps",
    userAgent: "test-agent",
    logs: [{ type: "error", message: "boom", timestamp: "2026-10-05T00:00:00Z" }],
  };

  it("rejects signed-out callers", async () => {
    await expect(userLogging(ctx(db, null)).submitFeedback(feedback)).rejects.toThrow(
      /Authentication required/
    );
    expect(feedbackLogSpy).not.toHaveBeenCalled();
  });

  it("stores the feedback, alerts admins and messages each admin but the sender", async () => {
    db.user.findMany.mockResolvedValue([
      { id: "admin1", clerkUserId: "clerk_admin1" },
      { id: "u1", clerkUserId: "clerk_u1" },
    ]);
    db.thinkshareConversation.findFirst.mockResolvedValue(null);
    db.thinkshareConversation.create.mockResolvedValue({ id: "conv1" });

    const result = await userLogging(ctx(db, "u1")).submitFeedback(feedback);

    expect(result.success).toBe(true);
    expect(feedbackLogSpy).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u1", feedbackType: "bug", logsCount: 1 })
    );
    expect(db.systemLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ category: "USER_FEEDBACK", userId: "u1" }),
    });
    expect(notificationAPI.create).toHaveBeenCalledTimes(2);
    expect(db.thinkshareConversation.create).toHaveBeenCalledTimes(1);
    expect(db.thinkshareMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ conversationId: "conv1", userId: "u1", isSystem: true }),
    });
  });

  it("reports a storage failure as a generic error", async () => {
    db.systemLog.create.mockRejectedValue(new Error("disk full"));
    await expect(userLogging(ctx(db, "u1")).submitFeedback(feedback)).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to submit feedback",
    });
  });
});
