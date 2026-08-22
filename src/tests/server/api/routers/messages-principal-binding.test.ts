import { TRPCError } from "@trpc/server";
import { messagesConversationsRouter } from "../../../../server/api/routers/messages/conversations";
import { messagesMessagingRouter } from "../../../../server/api/routers/messages/messaging";
import { messagesParticipantsRouter } from "../../../../server/api/routers/messages/participants";
import { createInnerTRPCContext } from "../../../../server/api/trpc";
import { createMockDb } from "../../../helpers/transactional-mock-db";
import { wikiTalkBridge } from "../../../../server/bridges/wiki-talk-bridge";
import { forumBridge } from "../../../../server/modules/forum";

jest.mock("~/server/bridges/wiki-talk-bridge", () => ({
  wikiTalkBridge: {
    syncInbound: jest.fn().mockResolvedValue({
      conversationsCreated: 1,
      conversationsUpdated: 0,
      messagesCreated: 2,
    }),
    sendOutbound: jest.fn().mockResolvedValue({ success: true }),
  },
}));

jest.mock("~/server/modules/forum", () => ({
  forumBridge: {
    syncInbound: jest.fn().mockResolvedValue({
      conversationsCreated: 0,
      conversationsUpdated: 1,
      messagesCreated: 1,
    }),
    sendOutbound: jest.fn().mockResolvedValue({ success: true }),
  },
}));


jest.mock("~/lib/notifications/api", () => ({
  notificationAPI: {
    create: jest.fn().mockResolvedValue({ success: true }),
  },
}));

describe("Plan 148: Secure Messaging Principal Binding", () => {
  const callerUser = "caller-user-id";
  const victimUser = "victim-user-id";

  function createCaller(authUserId: string | null = callerUser, customDb: any = null) {
    const db = customDb ?? createMockDb();
    const ctx = {
      ...createInnerTRPCContext({
        auth: authUserId ? { userId: authUserId } : null,
        user: authUserId
          ? {
              id: `db-${authUserId}`,
              clerkUserId: authUserId,
              name: `User ${authUserId}`,
              role: { name: "user" },
            }
          : null,
      }),
      db,
    };

    return {
      conversations: messagesConversationsRouter.createCaller(ctx as any),
      messaging: messagesMessagingRouter.createCaller(ctx as any),
      participants: messagesParticipantsRouter.createCaller(ctx as any),
      db,
    };
  }

  describe("Authentication & Read Isolation", () => {
    it("rejects unauthenticated callers for getConversationsByFolder, getFolderCounts, and getConversationMessages", async () => {
      const unauth = createCaller(null);

      await expect(
        unauth.conversations.getConversationsByFolder({ folder: "inbox" })
      ).rejects.toThrow(TRPCError);

      await expect(
        unauth.conversations.getFolderCounts({})
      ).rejects.toThrow(TRPCError);

      await expect(
        unauth.messaging.getConversationMessages({
          conversationId: "conv-1",
          userId: victimUser,
        })
      ).rejects.toThrow(TRPCError);
    });

    it("enforces ctx.auth.userId when querying conversations and ignores spoofed input.userId", async () => {
      const mockDb = createMockDb();
      mockDb.thinkshareConversation.findMany = jest.fn().mockResolvedValue([]);
      mockDb.user.findMany = jest.fn().mockResolvedValue([]);

      const caller = createCaller(callerUser, mockDb);

      await caller.conversations.getConversationsByFolder({
        userId: victimUser, // Malicious spoof attempt
        folder: "personal",
      });

      expect(mockDb.thinkshareConversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            participants: {
              some: { userId: callerUser, isActive: true },
            },
          }),
        })
      );
    });

    it("enforces ctx.auth.userId for getFolderCounts and ignores spoofed input.userId", async () => {
      const mockDb = createMockDb();
      mockDb.conversationParticipant.findMany = jest.fn().mockResolvedValue([]);

      const caller = createCaller(callerUser, mockDb);

      await caller.conversations.getFolderCounts({ userId: victimUser });

      expect(mockDb.conversationParticipant.findMany).toHaveBeenCalledWith({
        where: { userId: callerUser, isActive: true },
        select: { conversationId: true, lastReadAt: true },
      });
    });

    it("throws FORBIDDEN when caller is not an active participant in getConversationMessages", async () => {
      const mockDb = createMockDb();
      mockDb.conversationParticipant.findFirst = jest.fn().mockResolvedValue(null);

      const caller = createCaller(callerUser, mockDb);

      await expect(
        caller.messaging.getConversationMessages({
          conversationId: "conv-secret",
          userId: victimUser,
        })
      ).rejects.toMatchObject({
        code: "FORBIDDEN",
      });

      expect(mockDb.conversationParticipant.findFirst).toHaveBeenCalledWith({
        where: {
          conversationId: "conv-secret",
          userId: callerUser,
          isActive: true,
        },
      });
    });
  });

  describe("Send Isolation & Spoofing Prevention", () => {
    it("persists message with callerUser ID even if victimUser is supplied in input", async () => {
      const mockDb = createMockDb();
      mockDb.conversationParticipant.findFirst = jest.fn().mockResolvedValue({
        id: "part-1",
        conversationId: "conv-1",
        userId: callerUser,
        isActive: true,
      });
      mockDb.thinkshareConversation.findUnique = jest.fn().mockResolvedValue({
        id: "conv-1",
        source: "thinkshare",
      });
      mockDb.thinkshareMessage.create = jest.fn().mockImplementation(({ data }) =>
        Promise.resolve({ id: "msg-123", ...data })
      );
      mockDb.thinkshareConversation.update = jest.fn().mockResolvedValue({});
      mockDb.conversationParticipant.findMany = jest.fn().mockResolvedValue([]);

      const caller = createCaller(callerUser, mockDb);

      const result = await caller.messaging.sendMessage({
        conversationId: "conv-1",
        userId: victimUser, // Spoof attempt
        content: "Hello secure world",
      });

      expect(result.userId).toBe(callerUser);
      expect(mockDb.thinkshareMessage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: callerUser,
            content: "Hello secure world",
          }),
        })
      );
    });

    it("routes external outbound bridges with callerUser identity", async () => {
      const mockDb = createMockDb();
      mockDb.conversationParticipant.findFirst = jest.fn().mockResolvedValue({
        id: "part-1",
        conversationId: "conv-wiki",
        userId: callerUser,
        isActive: true,
      });
      mockDb.thinkshareConversation.findUnique = jest.fn().mockResolvedValue({
        id: "conv-wiki",
        source: "wiki",
        sourceId: "Wiki_Talk_Page",
      });
      mockDb.thinkshareMessage.create = jest.fn().mockResolvedValue({ id: "msg-w1" });
      mockDb.thinkshareConversation.update = jest.fn().mockResolvedValue({});
      mockDb.conversationParticipant.findMany = jest.fn().mockResolvedValue([]);

      const caller = createCaller(callerUser, mockDb);

      await caller.messaging.sendMessage({
        conversationId: "conv-wiki",
        userId: victimUser,
        content: "Wiki update note",
      });

      expect(wikiTalkBridge.sendOutbound).toHaveBeenCalledWith(
        "Wiki_Talk_Page",
        "Wiki update note",
        callerUser,
        expect.anything()
      );
    });
  });

  describe("Object Ownership: Edit, Delete & Reactions", () => {
    it("allows author to edit message, forbids non-author", async () => {
      const mockDb = createMockDb();
      mockDb.thinkshareMessage.findUnique = jest
        .fn()
        .mockResolvedValueOnce({ id: "msg-1", userId: victimUser }) // non-author
        .mockResolvedValueOnce({ id: "msg-1", userId: callerUser }); // author
      mockDb.thinkshareMessage.update = jest.fn().mockResolvedValue({});

      const caller = createCaller(callerUser, mockDb);

      // Victim's message cannot be edited by caller
      await expect(
        caller.messaging.editMessage({ messageId: "msg-1", content: "Hacked content" })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });

      // Own message can be edited
      const res = await caller.messaging.editMessage({
        messageId: "msg-1",
        content: "Fixed typo",
      });
      expect(res).toEqual({ success: true });
    });

    it("allows author to delete message, forbids non-author", async () => {
      const mockDb = createMockDb();
      mockDb.thinkshareMessage.findUnique = jest
        .fn()
        .mockResolvedValueOnce({ id: "msg-2", userId: victimUser })
        .mockResolvedValueOnce({ id: "msg-2", userId: callerUser });
      mockDb.thinkshareMessage.update = jest.fn().mockResolvedValue({});

      const caller = createCaller(callerUser, mockDb);

      await expect(
        caller.messaging.deleteMessage({ messageId: "msg-2" })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });

      const res = await caller.messaging.deleteMessage({ messageId: "msg-2" });
      expect(res).toEqual({ success: true });
    });

    it("forbids non-participants from adding or removing reactions", async () => {
      const mockDb = createMockDb();
      mockDb.thinkshareMessage.findUnique = jest.fn().mockResolvedValue({
        id: "msg-3",
        conversationId: "conv-private",
        reactions: "{}",
      });
      mockDb.conversationParticipant.findFirst = jest.fn().mockResolvedValue(null);

      const caller = createCaller(callerUser, mockDb);

      await expect(
        caller.messaging.addReaction({
          messageId: "msg-3",
          userId: victimUser,
          reaction: "👍",
        })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });

      await expect(
        caller.messaging.removeReaction({
          messageId: "msg-3",
          userId: victimUser,
          reaction: "👍",
        })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
  });

  describe("Read State & Receipts Binding", () => {
    it("forbids non-participant from marking messages as read", async () => {
      const mockDb = createMockDb();
      mockDb.conversationParticipant.findFirst = jest.fn().mockResolvedValue(null);

      const caller = createCaller(callerUser, mockDb);

      await expect(
        caller.participants.markMessagesAsRead({
          conversationId: "conv-1",
          userId: victimUser,
        })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("updates read state and creates receipts strictly for callerUser", async () => {
      const mockDb = createMockDb();
      mockDb.conversationParticipant.findFirst = jest.fn().mockResolvedValue({
        id: "part-1",
        conversationId: "conv-1",
        userId: callerUser,
        isActive: true,
      });
      mockDb.conversationParticipant.updateMany = jest.fn().mockResolvedValue({ count: 1 });
      mockDb.messageReadReceipt.findMany = jest.fn().mockResolvedValue([]);
      mockDb.messageReadReceipt.createMany = jest.fn().mockResolvedValue({ count: 1 });

      const caller = createCaller(callerUser, mockDb);

      const res = await caller.participants.markMessagesAsRead({
        conversationId: "conv-1",
        userId: victimUser, // Spoofed input
        messageIds: ["msg-99"],
      });

      expect(res).toEqual({ success: true });
      expect(mockDb.conversationParticipant.updateMany).toHaveBeenCalledWith({
        where: { conversationId: "conv-1", userId: callerUser },
        data: expect.objectContaining({ lastReadAt: expect.any(Date) }),
      });
      expect(mockDb.messageReadReceipt.createMany).toHaveBeenCalledWith({
        data: [
          {
            thinkshareMessageId: "msg-99",
            userId: callerUser,
            messageType: "thinkshare",
          },
        ],
      });
    });
  });

  describe("Conversation Creation & Leaving", () => {
    it("normalizes participantIds to always include callerUser", async () => {
      const mockDb = createMockDb();
      mockDb.thinkshareConversation.findMany = jest.fn().mockResolvedValue([]);
      mockDb.thinkshareConversation.create = jest.fn().mockResolvedValue({
        id: "conv-new",
        participants: [{ userId: callerUser }, { userId: victimUser }],
      });

      const caller = createCaller(callerUser, mockDb);

      await caller.conversations.createConversation({
        participantIds: [victimUser], // Only provided other user
        source: "thinkshare",
      });

      expect(mockDb.thinkshareConversation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            participants: {
              create: [
                { userId: callerUser, role: "participant" },
                { userId: victimUser, role: "participant" },
              ],
            },
          }),
        })
      );
    });

    it("forbids leaving conversation on behalf of another user", async () => {
      const caller = createCaller(callerUser);

      await expect(
        caller.participants.leaveConversation({
          conversationId: "conv-1",
          userId: victimUser,
        })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
  });
});
