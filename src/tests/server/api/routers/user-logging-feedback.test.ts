/** @jest-environment node */
/**
 * userLogging router: feedback needs a signed-in user and acts only as ctx.user. Feedback is
 * stored, sent to admins and delivered to each admin (other than the sender) as a ThinkShare
 * message.
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
import { userLoggingRouter } from "~/server/api/routers/user-logging";
import { FeedbackLogger } from "~/lib/logging";
import { notificationAPI } from "~/lib/notifications/api";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockPrisma, type MockPrismaProxy } from "~/tests/helpers/mock-db";

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
