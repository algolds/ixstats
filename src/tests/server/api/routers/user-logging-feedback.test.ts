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
});
