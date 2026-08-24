import { forumBridge } from "~/server/modules/forum";
import * as xenforoService from "~/server/modules/forum/services/xenforo-service";

jest.mock("~/server/modules/forum/services/xenforo-service");

describe("ForumBridge (Canonical Module)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("syncInbound", () => {
    test("returns empty result if user is not linked to forum", async () => {
      const mockDb: any = {
        user: {
          findFirst: jest.fn().mockResolvedValue(null),
        },
      };

      const result = await forumBridge.syncInbound("user_123", mockDb);
      expect(result).toEqual({
        conversationsCreated: 0,
        conversationsUpdated: 0,
        messagesCreated: 0,
      });
    });

    test("handles inbound fetch failure gracefully and logs error", async () => {
      const mockDb: any = {
        user: {
          findFirst: jest.fn().mockResolvedValue({ forumUserId: 42, forumUsername: "testuser" }),
        },
      };

      (xenforoService.xfFetchAsUser as jest.Mock).mockRejectedValue(new Error("Network failure"));
      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      const result = await forumBridge.syncInbound("user_123", mockDb);
      expect(result).toEqual({
        conversationsCreated: 0,
        conversationsUpdated: 0,
        messagesCreated: 0,
      });
      expect(consoleSpy).toHaveBeenCalledWith(
        "[Forum bridge] Failed to fetch conversations:",
        expect.any(Error)
      );
    });

    test("syncs conversations with object and array recipients, epoch lastReadAt, and unresolved author tag", async () => {
      const mockDb: any = {
        user: {
          findFirst: jest.fn().mockImplementation(({ where }: any) => {
            if (where.clerkUserId === "user_123") {
              return Promise.resolve({ forumUserId: 42, forumUsername: "testuser" });
            }
            if (where.forumUserId === 99) {
              return Promise.resolve({ clerkUserId: "user_99" });
            }
            if (where.forumUserId === 77) {
              return Promise.resolve(null); // Unlinked external forum user
            }
            return Promise.resolve(null);
          }),
        },
        thinkshareConversation: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({ id: "conv_1" }),
          update: jest.fn().mockResolvedValue({ id: "conv_1" }),
        },
        conversationParticipant: {
          create: jest.fn().mockResolvedValue({}),
          upsert: jest.fn().mockResolvedValue({}),
        },
        thinkshareMessage: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({ id: "msg_1" }),
        },
      };

      (xenforoService.xfFetchAsUser as jest.Mock).mockImplementation((endpoint: string) => {
        if (endpoint.includes("/conversations/?page=1")) {
          return Promise.resolve({
            conversations: [
              {
                conversation_id: 101,
                title: "Test Discussion",
                user_id: 42,
                username: "testuser",
                start_date: 1700000000,
                reply_count: 2,
                last_message_date: 1700000100,
                last_message_user_id: 77,
                last_message_username: "foreignuser",
                is_unread: true,
                recipient_count: 3,
                recipients: {
                  "42": { user_id: 42, username: "testuser" },
                  "99": { user_id: 99, username: "linkedfriend" },
                  "77": { user_id: 77, username: "foreignuser" },
                },
              },
            ],
          } as any);
        }
        if (endpoint.includes("/conversations/101/messages")) {
          return Promise.resolve({
            messages: [
              {
                message_id: 1001,
                conversation_id: 101,
                user_id: 42,
                username: "testuser",
                message_date: 1700000000,
                message: "Hello world",
              },
              {
                message_id: 1002,
                conversation_id: 101,
                user_id: 77,
                username: "foreignuser",
                message_date: 1700000100,
                message: "Reply from foreign forum user",
              },
            ],
          } as any);
        }
        return Promise.resolve(null);
      });

      const result = await forumBridge.syncInbound("user_123", mockDb);

      expect(result.conversationsCreated).toBe(1);
      expect(result.conversationsUpdated).toBe(1);
      expect(result.messagesCreated).toBe(2);

      // Verify conversation was created with type "group" (recipient_count > 2)
      expect(mockDb.thinkshareConversation.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: "group",
          name: "Test Discussion",
          source: "forum",
          sourceId: "101",
        }),
      });

      // Verify participant lastReadAt is epoch 0
      expect(mockDb.conversationParticipant.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          conversationId: "conv_1",
          userId: "user_123",
          lastReadAt: new Date(0),
        }),
      });

      // Verify messages: author 42 -> "user_123", author 77 -> "forum:foreignuser"
      expect(mockDb.thinkshareMessage.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          conversationId: "conv_1",
          userId: "user_123",
          content: "Hello world",
        }),
      });
      expect(mockDb.thinkshareMessage.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          conversationId: "conv_1",
          userId: "forum:foreignuser",
          content: "Reply from foreign forum user",
        }),
      });
    });
  });

  describe("sendOutbound", () => {
    test("returns error if user has no linked forum account", async () => {
      const mockDb: any = {
        user: {
          findFirst: jest.fn().mockResolvedValue(null),
        },
      };

      const result = await forumBridge.sendOutbound("101", "Hello", "user_123", mockDb);
      expect(result.success).toBe(false);
      expect(result.error).toContain("No linked forum account");
    });

    test("strips HTML tags and posts outbound message as user", async () => {
      const mockDb: any = {
        user: {
          findFirst: jest.fn().mockResolvedValue({ forumUserId: 42 }),
        },
      };

      (xenforoService.xfPostAsUser as jest.Mock).mockResolvedValue({ success: true } as any);

      const result = await forumBridge.sendOutbound(
        "101",
        "<p>Hello <strong>world</strong></p>",
        "user_123",
        mockDb
      );

      expect(result.success).toBe(true);
      expect(xenforoService.xfPostAsUser).toHaveBeenCalledWith(
        "/conversations/101/messages",
        { message_body: "Hello world" },
        42
      );
    });
  });
});
