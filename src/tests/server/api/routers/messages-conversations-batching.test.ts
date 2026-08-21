import { messagesRouter } from "../../../../server/api/routers/messages";
import { createCallerFactory } from "../../../../server/api/trpc";
import { createMockRouterContext } from "../../../helpers/router-context";

describe("Plan 159: Messages Conversations Unread Query Batching", () => {
  const createCaller = createCallerFactory(messagesRouter);

  it("batches unread message counts into a single findMany call with 0 count calls", async () => {
    const findManyMessagesMock = jest.fn().mockResolvedValue([
      { conversationId: "conv-1" },
      { conversationId: "conv-1" },
      { conversationId: "conv-2" },
    ]);
    const countMessagesMock = jest.fn();

    const mockDb = {
      thinkshareConversation: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "conv-1",
            name: "Discussion 1",
            source: "thinkshare",
            lastActivity: new Date("2026-01-02"),
            participants: [
              { id: "p1", userId: "user-me", lastReadAt: new Date("2026-01-01"), isActive: true },
              { id: "p2", userId: "user-other-1", lastReadAt: new Date("2026-01-01"), isActive: true },
            ],
            messages: [{ id: "m1", userId: "user-other-1", content: "hi" }],
          },
          {
            id: "conv-2",
            name: "Discussion 2",
            source: "thinkshare",
            lastActivity: new Date("2026-01-02"),
            participants: [
              { id: "p3", userId: "user-me", lastReadAt: new Date("2026-01-01"), isActive: true },
              { id: "p4", userId: "user-other-2", lastReadAt: new Date("2026-01-01"), isActive: true },
            ],
            messages: [{ id: "m2", userId: "user-other-2", content: "hey" }],
          },
          {
            id: "conv-3",
            name: "Discussion 3",
            source: "thinkshare",
            lastActivity: new Date("2026-01-02"),
            participants: [
              { id: "p5", userId: "user-me", lastReadAt: new Date("2026-01-01"), isActive: true },
              { id: "p6", userId: "user-other-3", lastReadAt: new Date("2026-01-01"), isActive: true },
            ],
            messages: [{ id: "m3", userId: "user-other-3", content: "yo" }],
          },
        ]),
        count: jest.fn().mockResolvedValue(3),
      },
      user: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      country: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      thinkshareMessage: {
        findMany: findManyMessagesMock,
        count: countMessagesMock,
      },
    };

    const ctx = createMockRouterContext({
      db: mockDb,
      auth: { userId: "user-me" },
    });
    const caller = createCaller(ctx as any);

    const result = await (caller as any).getConversationsByFolder({ folder: "INBOX" });

    // Assert query batching
    expect(findManyMessagesMock).toHaveBeenCalledTimes(1);
    expect(countMessagesMock).toHaveBeenCalledTimes(0);

    // Assert unread counts mapped correctly
    expect(result.conversations).toHaveLength(3);
    expect(result.conversations[0].unreadCount).toBe(2);
    expect(result.conversations[1].unreadCount).toBe(1);
    expect(result.conversations[2].unreadCount).toBe(0);
  });
});
