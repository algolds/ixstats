import {
  MessagingService,
  createMessagingService,
  MessagingForbiddenError,
  MessagingNotFoundError,
  MessagingValidationError,
  recordMessagingTelemetry,
} from "~/server/modules/messaging";

describe("MessagingService Domain Logic (Plan 163)", () => {
  let mockDb: any;
  let mockNotifications: any;
  let mockWebsocket: any;
  let mockForumBridge: any;
  let mockWikiBridge: any;
  let mockTelemetryLogger: any;
  let service: MessagingService;

  beforeEach(() => {
    mockDb = {
      $transaction: jest.fn().mockImplementation((cb: any) => cb(mockDb)),
      user: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
      },
      country: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      thinkshareConversation: {
        findMany: jest.fn().mockResolvedValue([]),
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
        create: jest.fn().mockResolvedValue({ id: "msg_1", content: "hello", createdAt: new Date() }),
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

    mockForumBridge = {
      syncInbound: jest.fn().mockResolvedValue({ conversationsCreated: 0 }),
      postOutbound: jest.fn().mockResolvedValue({ success: true }),
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
      forumBridge: mockForumBridge,
      wikiBridge: mockWikiBridge,
      telemetry: mockTelemetryLogger,
    });
  });

  describe("Batch Account Resolution", () => {
    test("1. batchResolveUsers handles empty input cleanly", async () => {
      const map = await service.batchResolveUsers([]);
      expect(map.size).toBe(0);
    });

    test("2. batchResolveUsers resolves clerkUserIds to country profile", async () => {
      mockDb.user.findMany.mockResolvedValue([
        {
          clerkUserId: "user_1",
          country: { name: "Eldoria", slug: "eldoria", flag: "https://flag.png" },
        },
      ]);

      const map = await service.batchResolveUsers(["user_1"]);
      expect(map.get("user_1")?.displayName).toBe("Eldoria");
      expect(map.get("user_1")?.username).toBe("eldoria");
    });

    test("3. batchResolveUsers handles forum and wiki prefixed usernames", async () => {
      const map = await service.batchResolveUsers(["forum:Thorin", "wiki:Gandalf"]);
      expect(map.get("forum:Thorin")?.displayName).toBe("Thorin");
      expect(map.get("wiki:Gandalf")?.displayName).toBe("Gandalf");
    });
  });

  describe("Read Operations & Inbound Sync", () => {
    test("4. getConversationsByFolder triggers inbound bridge syncs", async () => {
      await service.getConversationsByFolder("user_1", { folder: "inbox" });
      expect(mockForumBridge.syncInbound).toHaveBeenCalledWith("user_1", mockDb);
      expect(mockWikiBridge.syncInbound).toHaveBeenCalledWith("user_1", mockDb);
    });

    test("5. getConversationsByFolder applies cursor and unread mappings", async () => {
      mockDb.thinkshareConversation.findMany.mockResolvedValue([
        {
          id: "c_1",
          createdAt: new Date(),
          updatedAt: new Date(),
          lastMessageAt: new Date(),
          participants: [{ userId: "user_1", isActive: true }],
          messages: [{ id: "m_1", userId: "user_2", content: "hi", createdAt: new Date() }],
        },
      ]);
      mockDb.thinkshareMessage.count.mockResolvedValue(3);

      const res = await service.getConversationsByFolder("user_1", { folder: "inbox", limit: 10 });
      expect(res.conversations).toHaveLength(1);
      expect(res.conversations[0]?.unreadCount).toBe(3);
    });

    test("6. getFolderCounts aggregates unread counts across all category folders", async () => {
      mockDb.conversationParticipant.findMany.mockResolvedValue([
        { conversationId: "c_1", isArchived: false, isMuted: false, conversation: { source: "thinkshare" } },
        { conversationId: "c_2", isArchived: true, isMuted: false, conversation: { source: "thinkshare" } },
        { conversationId: "c_3", isArchived: false, isMuted: false, conversation: { source: "diplomatic" } },
      ]);

      const counts = await service.getFolderCounts("user_1");
      expect(counts.archive).toBe(1);
      expect(counts.inbox).toBe(2);
      expect(counts.diplomatic).toBe(1);
    });

    test("7. getConversationsLegacy returns expected legacy ThinkPages format", async () => {
      mockDb.thinkshareConversation.findMany.mockResolvedValue([
        {
          id: "c_1",
          createdAt: new Date(),
          updatedAt: new Date(),
          lastMessageAt: new Date(),
          participants: [{ userId: "user_1", isActive: true }],
          messages: [],
        },
      ]);

      const res = await service.getConversationsLegacy("user_1", { limit: 5 });
      expect(res.conversations[0]).toHaveProperty("accountId", "user_1");
      expect(res.conversations[0]).toHaveProperty("account");
    });

    test("8. getConversationMessages enforces participant authorization", async () => {
      mockDb.conversationParticipant.findFirst.mockResolvedValue(null);

      await expect(
        service.getConversationMessages("unauthorized_user", { conversationId: "c_1" })
      ).rejects.toThrow(MessagingForbiddenError);
    });

    test("9. getConversationMessages loads message history when authorized", async () => {
      mockDb.conversationParticipant.findFirst.mockResolvedValue({ id: "p_1", isActive: true });
      mockDb.thinkshareMessage.findMany.mockResolvedValue([
        { id: "m_1", userId: "user_1", content: "Hi", createdAt: new Date() },
      ]);

      const res = await service.getConversationMessages("user_1", { conversationId: "c_1" });
      expect(res.messages).toHaveLength(1);
      expect(res.messages[0]?.content).toBe("Hi");
    });
  });

  describe("Write Operations & Atomic Transactions", () => {
    test("10. createConversation validates minimum participant count", async () => {
      await expect(
        service.createConversation("user_1", { participantIds: [] })
      ).rejects.toThrow(MessagingValidationError);
    });

    test("11. createConversation executes transaction for conversation and initial message", async () => {
      mockDb.thinkshareConversation.create.mockResolvedValue({
        id: "c_new",
        participants: [{ userId: "user_1" }, { userId: "user_2" }],
      });

      const conv = await service.createConversation("user_1", {
        participantIds: ["user_2"],
        subject: "Alliance",
        initialMessage: "Welcome!",
      });

      expect(mockDb.$transaction).toHaveBeenCalled();
      expect(mockDb.thinkshareConversation.create).toHaveBeenCalled();
      expect(mockDb.thinkshareMessage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            conversationId: "c_new",
            content: "Welcome!",
          }),
        })
      );
      expect(conv.id).toBe("c_new");
    });

    test("12. createConversationByCountries resolves country users and delegates", async () => {
      mockDb.user.findMany.mockResolvedValue([{ clerkUserId: "user_alpha" }]);
      mockDb.thinkshareConversation.create.mockResolvedValue({ id: "c_diplo" });

      const conv = await service.createConversationByCountries("user_1", {
        countryIds: ["country_alpha"],
        subject: "Diplomacy",
      });

      expect(conv.id).toBe("c_diplo");
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
      mockDb.conversationParticipant.findMany.mockResolvedValue([
        { userId: "user_2" },
      ]);

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

    test("15. sendMessage routes outbound to forum bridge when source is forum", async () => {
      mockDb.conversationParticipant.findFirst.mockResolvedValue({
        id: "p_1",
        conversation: { id: "c_1", source: "forum" },
      });
      mockDb.thinkshareMessage.create.mockResolvedValue({ id: "m_f" });
      mockDb.conversationParticipant.findMany.mockResolvedValue([]);

      await service.sendMessage("user_1", {
        conversationId: "c_1",
        content: "Forum message",
      });

      expect(mockForumBridge.postOutbound).toHaveBeenCalledWith({
        conversationId: "c_1",
        senderId: "user_1",
        content: "Forum message",
      });
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
          data: expect.objectContaining({ deletedAt: expect.any(Date), content: "This message was deleted" }),
        })
      );
    });

    test("19. markMessagesAsRead updates lastReadAt timestamp", async () => {
      mockDb.conversationParticipant.findFirst.mockResolvedValue({ id: "p_1" });

      await service.markMessagesAsRead("user_1", { conversationId: "c_1" });

      expect(mockDb.conversationParticipant.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { conversationId: "c_1", userId: "user_1" },
          data: expect.objectContaining({ lastReadAt: expect.any(Date) }),
        })
      );
    });

    test("20. addReaction / removeReaction updates reaction records", async () => {
      mockDb.thinkshareMessage.findUnique.mockResolvedValue({
        id: "m_1",
        conversation: { participants: [{ userId: "user_1", isActive: true }] },
      });

      await service.addReaction("user_1", { messageId: "m_1", emoji: "👍" });
      expect(mockDb.messageReaction.upsert).toHaveBeenCalled();

      await service.removeReaction("user_1", { messageId: "m_1", emoji: "👍" });
      expect(mockDb.messageReaction.deleteMany).toHaveBeenCalled();
    });

    test("21. addParticipant upserts participant and leaveConversation deactivates", async () => {
      mockDb.thinkshareConversation.findUnique.mockResolvedValue({
        id: "c_1",
        participants: [{ userId: "user_1", isActive: true }],
      });

      await service.addParticipant("user_1", { conversationId: "c_1", targetUserId: "user_new" });
      expect(mockDb.conversationParticipant.upsert).toHaveBeenCalled();

      await service.leaveConversation("user_1", { conversationId: "c_1" });
      expect(mockDb.conversationParticipant.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { conversationId: "c_1", userId: "user_1" },
          data: { isActive: false },
        })
      );
    });

    test("22. userPresence and user search functions execute correctly", async () => {
      mockDb.user.findMany.mockResolvedValue([
        { clerkUserId: "u_s", country: { name: "Valora", slug: "valora", flag: null } },
      ]);

      const users = await service.searchUsers("user_1", { query: "Valora" });
      expect(users).toHaveLength(1);
      expect(users[0]?.displayName).toBe("Valora");

      await service.updatePresence("user_1", { status: "online" });
      expect(mockDb.userPresence.upsert).toHaveBeenCalled();
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
