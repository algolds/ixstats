import { messagesMessagingRouter } from "../../../../server/api/routers/messages/messaging";
import { thinkpagesMessagingMessagesRouter } from "../../../../server/api/routers/thinkpages/messaging/messages";
import { createMockRouterContext } from "../../../helpers/router-context";
import { TRPCError } from "@trpc/server";

describe("messages-characterization contract", () => {
  const conversationId = "conv_123";
  const userId = "user_clerk_123";

  describe("unified messaging router (messagesMessagingRouter)", () => {
    it("returns explicit enriched fields and undefined nextCursor when messages <= limit", async () => {
      const mockFindParticipant = jest.fn().mockResolvedValue({
        id: "part_1",
        conversationId,
        userId,
        isActive: true,
      });

      const mockFindManyMessages = jest.fn().mockResolvedValue([
        {
          id: "msg_1",
          conversationId,
          userId,
          content: "Hello unified",
          messageType: "text",
          ixTimeTimestamp: new Date("2026-08-20T12:00:00Z"),
          reactions: '{"👍": 1}',
          mentions: '["@user2"]',
          attachments: '[{"type":"image","url":"https://example.com/img.png"}]',
          replyTo: null,
          readReceipts: [{ id: "rr_1", userId: "user_clerk_456", readAt: new Date() }],
          isSystem: false,
          editedAt: null,
          deletedAt: null,
          source: "thinkshare",
        },
      ]);

      const mockFindManyUsers = jest.fn().mockResolvedValue([
        {
          clerkUserId: userId,
          country: {
            name: "Unified Country",
            slug: "unified-country",
            flag: "https://example.com/flag.png",
          },
        },
      ]);

      const ctx = createMockRouterContext({
        auth: { userId },
        user: { clerkUserId: userId },
        db: {
          conversationParticipant: { findFirst: mockFindParticipant },
          thinkshareMessage: { findMany: mockFindManyMessages },
          user: { findMany: mockFindManyUsers },
          country: { findMany: jest.fn().mockResolvedValue([]) },
        },
      });

      const caller = messagesMessagingRouter.createCaller(ctx);
      const result = await caller.getConversationMessages({
        conversationId,
        userId,
        limit: 10,
      });

      expect(result.messages).toHaveLength(1);
      const msg = result.messages[0];
      expect(msg.content).toBe("Hello unified");
      expect(msg.account.displayName).toBe("Unified Country");
      expect(msg.reactions).toEqual({ "👍": 1 });
      expect(msg.mentions).toEqual(["@user2"]);
      expect(msg.attachments).toEqual([{ type: "image", url: "https://example.com/img.png" }]);
      expect(result.nextCursor).toBeUndefined();
    });

    it("returns nextCursor as last message ID when messages > limit", async () => {
      const mockFindParticipant = jest.fn().mockResolvedValue({
        id: "part_1",
        conversationId,
        userId,
        isActive: true,
      });

      // 3 messages returned for limit 2
      const mockFindManyMessages = jest.fn().mockResolvedValue([
        {
          id: "msg_1",
          conversationId,
          userId,
          content: "Msg 1",
          messageType: "text",
          ixTimeTimestamp: new Date("2026-08-20T12:00:00Z"),
          reactions: null,
          mentions: null,
          attachments: null,
          replyTo: null,
          readReceipts: [],
          isSystem: false,
          editedAt: null,
          deletedAt: null,
          source: "thinkshare",
        },
        {
          id: "msg_2",
          conversationId,
          userId,
          content: "Msg 2",
          messageType: "text",
          ixTimeTimestamp: new Date("2026-08-20T11:00:00Z"),
          reactions: null,
          mentions: null,
          attachments: null,
          replyTo: null,
          readReceipts: [],
          isSystem: false,
          editedAt: null,
          deletedAt: null,
          source: "thinkshare",
        },
        {
          id: "msg_3",
          conversationId,
          userId,
          content: "Msg 3 (overflow)",
          messageType: "text",
          ixTimeTimestamp: new Date("2026-08-20T10:00:00Z"),
          reactions: null,
          mentions: null,
          attachments: null,
          replyTo: null,
          readReceipts: [],
          isSystem: false,
          editedAt: null,
          deletedAt: null,
          source: "thinkshare",
        },
      ]);

      const ctx = createMockRouterContext({
        auth: { userId },
        db: {
          conversationParticipant: { findFirst: mockFindParticipant },
          thinkshareMessage: { findMany: mockFindManyMessages },
          user: { findMany: jest.fn().mockResolvedValue([]) },
          country: { findMany: jest.fn().mockResolvedValue([]) },
        },
      });

      const caller = messagesMessagingRouter.createCaller(ctx);
      const result = await caller.getConversationMessages({
        conversationId,
        userId,
        limit: 2,
      });

      expect(result.messages).toHaveLength(2);
      expect(result.nextCursor).toBe("msg_2");
    });

    it("rejects non-participants with FORBIDDEN", async () => {
      const ctx = createMockRouterContext({
        auth: { userId },
        db: {
          conversationParticipant: { findFirst: jest.fn().mockResolvedValue(null) },
        },
      });

      const caller = messagesMessagingRouter.createCaller(ctx);
      await expect(
        caller.getConversationMessages({ conversationId, userId, limit: 10 })
      ).rejects.toThrow(TRPCError);
    });
  });

  describe("thinkpages messaging router (thinkpagesMessagingMessagesRouter)", () => {
    it("returns spread fields and null nextCursor when messages < limit", async () => {
      const mockFindParticipant = jest.fn().mockResolvedValue({
        id: "part_1",
        conversationId,
        userId,
        isActive: true,
      });

      const mockFindManyMessages = jest.fn().mockResolvedValue([
        {
          id: "tp_msg_1",
          conversationId,
          userId,
          content: "Hello Thinkpages",
          messageType: "text",
          reactions: '{"❤️": 2}',
          mentions: "[]",
          attachments: "[]",
          createdAt: new Date("2026-08-20T12:00:00Z"),
        },
      ]);

      const mockFindManyUsers = jest.fn().mockResolvedValue([
        {
          clerkUserId: userId,
          country: {
            name: "Thinkpages Country",
            slug: "thinkpages-country",
            flag: "https://example.com/flag.png",
          },
        },
      ]);

      const ctx = createMockRouterContext({
        auth: { userId },
        user: { clerkUserId: userId },
        db: {
          conversationParticipant: { findUnique: mockFindParticipant },
          thinkshareMessage: { findMany: mockFindManyMessages },
          user: { findMany: mockFindManyUsers },
          country: { findMany: jest.fn().mockResolvedValue([]) },
        },
      });

      const caller = thinkpagesMessagingMessagesRouter.createCaller(ctx);
      const result = await caller.getConversationMessages({
        conversationId,
        userId,
        limit: 10,
      });

      expect(result.messages).toHaveLength(1);
      const msg = result.messages[0];
      expect(msg.content).toBe("Hello Thinkpages");
      expect(msg.accountId).toBe(userId);
      expect(msg.account.displayName).toBe("Thinkpages Country");
      expect(msg.reactions).toEqual({ "❤️": 2 });
      expect(result.nextCursor).toBeNull();
    });

    it("returns nextCursor as last message ID when message count equals limit", async () => {
      const mockFindParticipant = jest.fn().mockResolvedValue({
        id: "part_1",
        conversationId,
        userId,
        isActive: true,
      });

      const mockFindManyMessages = jest.fn().mockResolvedValue([
        {
          id: "tp_msg_1",
          conversationId,
          userId,
          content: "Msg 1",
          reactions: null,
          mentions: null,
          attachments: null,
        },
        {
          id: "tp_msg_2",
          conversationId,
          userId,
          content: "Msg 2",
          reactions: null,
          mentions: null,
          attachments: null,
        },
      ]);

      const ctx = createMockRouterContext({
        auth: { userId },
        db: {
          conversationParticipant: { findUnique: mockFindParticipant },
          thinkshareMessage: { findMany: mockFindManyMessages },
          user: { findMany: jest.fn().mockResolvedValue([]) },
          country: { findMany: jest.fn().mockResolvedValue([]) },
        },
      });

      const caller = thinkpagesMessagingMessagesRouter.createCaller(ctx);
      const result = await caller.getConversationMessages({
        conversationId,
        userId,
        limit: 2,
      });

      expect(result.messages).toHaveLength(2);
      expect(result.nextCursor).toBe("tp_msg_2");
    });

    it("rejects non-participants with FORBIDDEN", async () => {
      const ctx = createMockRouterContext({
        auth: { userId },
        db: {
          conversationParticipant: { findUnique: jest.fn().mockResolvedValue(null) },
        },
      });

      const caller = thinkpagesMessagingMessagesRouter.createCaller(ctx);
      await expect(
        caller.getConversationMessages({ conversationId, userId, limit: 10 })
      ).rejects.toThrow(TRPCError);
    });
  });
});
