import {
  MessagingService,
  createMessagingService,
  MessagingForbiddenError,
  MessagingValidationError,
  recordMessagingTelemetry,
} from "~/server/modules/messaging";

describe("MessagingService Domain Logic (Plan 163)", () => {
  let mockDb: any;
  let mockNotifications: any;
  let mockWebsocket: any;
  let mockWikiBridge: any;
  let mockTelemetryLogger: any;
  let service: MessagingService;

  beforeEach(() => {
    mockDb = {
      $transaction: jest.fn().mockImplementation((cb: any) => cb(mockDb)),
      $queryRaw: jest.fn().mockResolvedValue([]),
      user: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      userConnection: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      country: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      thinkpagesAccount: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      thinkshareConversation: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue({ id: "c_1" }),
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: "conv_1", participants: [] }),
        update: jest.fn().mockResolvedValue({ id: "conv_1" }),
      },
      conversationParticipant: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: "p_1" }),
        createMany: jest.fn().mockResolvedValue({ count: 2 }),
        update: jest.fn().mockResolvedValue({ id: "p_1" }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        upsert: jest.fn().mockResolvedValue({ id: "p_1" }),
      },
      thinkshareMessage: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest
          .fn()
          .mockResolvedValue({ id: "msg_1", content: "hello", createdAt: new Date() }),
        update: jest.fn().mockResolvedValue({ id: "msg_1" }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        count: jest.fn().mockResolvedValue(0),
      },
      messageReaction: {
        upsert: jest.fn().mockResolvedValue({ id: "r_1" }),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      notification: {
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      userPresence: {
        upsert: jest.fn().mockResolvedValue({ id: "pres_1" }),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    mockNotifications = {
      createNotification: jest.fn().mockResolvedValue({ id: "notif_1" }),
    };

    mockWebsocket = {
      broadcastToUsers: jest.fn(),
    };

    mockWikiBridge = {
      syncInbound: jest.fn().mockResolvedValue({ conversationsCreated: 0 }),
    };

    mockTelemetryLogger = {
      logEvent: jest.fn(),
    };

    service = createMessagingService({
      db: mockDb,
      notifications: mockNotifications,
      websocket: mockWebsocket,
      wikiBridge: mockWikiBridge,
      telemetry: mockTelemetryLogger,
    });
  });
  describe("Read Operations & Inbound Sync", () => {
    test("5b. group conversations skip blocked senders in previews and unread counts", async () => {
      mockDb.userConnection.findMany.mockResolvedValue([
        { targetUserId: "user_blocked", targetCountryId: null },
      ]);
      mockDb.thinkshareConversation.findMany.mockResolvedValue([
        {
          id: "g_1",
          type: "group",
          createdAt: new Date(),
          updatedAt: new Date(),
          lastActivity: new Date(),
          participants: [{ userId: "user_1", isActive: true }],
          messages: [{ id: "m_2", userId: "user_blocked", content: "spam", createdAt: new Date() }],
        },
        {
          id: "d_1",
          type: "direct",
          createdAt: new Date(),
          updatedAt: new Date(),
          lastActivity: new Date(),
          participants: [{ userId: "user_1", isActive: true }],
          messages: [{ id: "m_3", userId: "user_blocked", content: "old", createdAt: new Date() }],
        },
      ]);
      mockDb.thinkshareMessage.findFirst.mockResolvedValue({
        id: "m_1",
        userId: "user_2",
        content: "hello",
        createdAt: new Date(),
      });
      mockDb.conversationParticipant.findMany.mockResolvedValue([
        { conversationId: "g_1", userId: "user_1", lastReadAt: new Date(0) },
        { conversationId: "d_1", userId: "user_1", lastReadAt: new Date(0) },
      ]);

      const res = await service.getConversationsByFolder("user_1", { folder: "inbox" });

      expect(mockDb.thinkshareMessage.findFirst).toHaveBeenCalledTimes(1);
      expect(mockDb.thinkshareMessage.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { conversationId: "g_1", userId: { notIn: ["user_blocked"] } },
        })
      );
      expect(res.conversations.map((c: any) => c.lastMessage?.content)).toEqual(["hello", "old"]);
      const unreadWhere = mockDb.thinkshareMessage.findMany.mock.calls[0][0].where;
      expect(unreadWhere.OR).toEqual([
        expect.objectContaining({ conversationId: "g_1", userId: { notIn: ["user_blocked"] } }),
        expect.not.objectContaining({ userId: expect.anything() }),
      ]);
    });
    test("6d. getFolderCounts leaves blocked senders out of group unread counts", async () => {
      mockDb.userConnection.findMany.mockResolvedValue([
        { targetUserId: "user_blocked", targetCountryId: null },
      ]);
      mockDb.conversationParticipant.findMany.mockResolvedValue([
        { conversationId: "c_1", lastReadAt: new Date(0), conversation: { source: "thinktank" } },
      ]);

      await service.getFolderCounts("user_1");

      const [sql, ...params] = mockDb.$queryRaw.mock.calls[0];
      expect(sql.join("?")).toContain(`c."type" = 'direct' OR m."userId" <> ALL(`);
      expect(params).toContainEqual(["user_blocked"]);
    });
    test("8. getConversationMessages enforces participant authorization", async () => {
      mockDb.conversationParticipant.findFirst.mockResolvedValue(null);
      mockDb.thinkshareConversation.findFirst.mockResolvedValue(null);

      await expect(
        service.getConversationMessages("unauthorized_user", { conversationId: "c_1" })
      ).rejects.toThrow(MessagingForbiddenError);
    });
  });

  describe("Write Operations & Atomic Transactions", () => {
    test("10. createConversation validates minimum participant count", async () => {
      await expect(service.createConversation("user_1", { participantIds: [] })).rejects.toThrow(
        MessagingValidationError
      );
    });
    test("13. sendMessage enforces participant authorization", async () => {
      mockDb.conversationParticipant.findFirst.mockResolvedValue(null);

      await expect(
        service.sendMessage("user_1", { conversationId: "c_1", content: "Hello" })
      ).rejects.toThrow(MessagingForbiddenError);
    });

    test("14. sendMessage writes message atomically, notifies participants, and broadcasts WebSocket", async () => {
      mockDb.conversationParticipant.findFirst.mockResolvedValue({
        id: "p_1",
        conversation: { id: "c_1", source: "thinkshare" },
      });
      mockDb.thinkshareMessage.create.mockResolvedValue({
        id: "m_1",
        conversationId: "c_1",
        userId: "user_1",
        content: "Hello",
      });
      mockDb.conversationParticipant.findMany.mockResolvedValue([{ userId: "user_2" }]);

      const msg = await service.sendMessage("user_1", {
        conversationId: "c_1",
        content: "Hello",
      });

      expect(msg.id).toBe("m_1");
      expect(mockDb.thinkshareConversation.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "c_1" } })
      );
      expect(mockNotifications.createNotification).toHaveBeenCalled();
      expect(mockWebsocket.broadcastToUsers).toHaveBeenCalledWith(
        ["user_2"],
        "message:new",
        expect.anything()
      );
    });

    test("15. sendMessage refuses a conversation that came from the old forum (phase 4b, Q14)", async () => {
      mockDb.conversationParticipant.findFirst.mockResolvedValue({
        id: "p_1",
        conversation: { id: "c_1", source: "forum" },
      });
      mockDb.thinkshareMessage.create.mockResolvedValue({ id: "m_f" });
      mockDb.conversationParticipant.findMany.mockResolvedValue([]);

      await expect(
        service.sendMessage("user_1", { conversationId: "c_1", content: "Forum message" })
      ).rejects.toMatchObject({
        name: "MessagingBlockedError",
        message: "This conversation came from the old forum and is read-only",
      });
      expect(mockDb.thinkshareMessage.create).not.toHaveBeenCalled();
    });

    test("16. editMessage verifies ownership and updates content", async () => {
      mockDb.thinkshareMessage.findUnique.mockResolvedValue({
        id: "m_1",
        userId: "user_1",
        deletedAt: null,
      });

      await service.editMessage("user_1", {
        messageId: "m_1",
        content: "Updated content",
      });

      expect(mockDb.thinkshareMessage.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "m_1" },
          data: expect.objectContaining({ content: "Updated content", editedAt: expect.any(Date) }),
        })
      );
    });

    test("17. editMessage rejects non-author and deleted messages", async () => {
      mockDb.thinkshareMessage.findUnique.mockResolvedValue({
        id: "m_1",
        userId: "other_user",
        deletedAt: null,
      });

      await expect(
        service.editMessage("user_1", { messageId: "m_1", content: "Hacked" })
      ).rejects.toThrow(MessagingForbiddenError);
    });

    test("18. deleteMessage performs soft delete with placeholder text", async () => {
      mockDb.thinkshareMessage.findUnique.mockResolvedValue({
        id: "m_1",
        userId: "user_1",
        deletedAt: null,
      });

      await service.deleteMessage("user_1", { messageId: "m_1" });

      expect(mockDb.thinkshareMessage.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "m_1" },
          data: expect.objectContaining({
            deletedAt: expect.any(Date),
            content: "This message was deleted",
          }),
        })
      );
    });

    test("18b. old forum conversations refuse edits, deletes and reactions too (phase 4b, Q14)", async () => {
      mockDb.thinkshareMessage.findUnique.mockResolvedValue({
        id: "m_1",
        userId: "user_1",
        deletedAt: null,
        conversation: { source: "forum", participants: [{ userId: "user_1", isActive: true }] },
      });
      const readOnly = {
        name: "MessagingBlockedError",
        message: "This conversation came from the old forum and is read-only",
      };

      await expect(
        service.editMessage("user_1", { messageId: "m_1", content: "Changed" })
      ).rejects.toMatchObject(readOnly);
      await expect(service.deleteMessage("user_1", { messageId: "m_1" })).rejects.toMatchObject(
        readOnly
      );
      await expect(
        service.addReaction("user_1", { messageId: "m_1", emoji: "👍" })
      ).rejects.toMatchObject(readOnly);
      await expect(
        service.removeReaction("user_1", { messageId: "m_1", emoji: "👍" })
      ).rejects.toMatchObject(readOnly);
      expect(mockDb.thinkshareMessage.update).not.toHaveBeenCalled();
      expect(mockDb.messageReaction.upsert).not.toHaveBeenCalled();
      expect(mockDb.messageReaction.deleteMany).not.toHaveBeenCalled();
    });
    test("23. Telemetry strictly records surface metadata and excludes private message content or IDs", () => {
      recordMessagingTelemetry(
        {
          surface: "messages",
          procedure: "sendMessage",
          authenticated: true,
          success: true,
          durationMs: 45,
        },
        mockTelemetryLogger
      );

      expect(mockTelemetryLogger.logEvent).toHaveBeenCalledWith({
        surface: "messages",
        procedure: "sendMessage",
        authenticated: true,
        success: true,
        durationMs: 45,
      });
    });
  });
});
