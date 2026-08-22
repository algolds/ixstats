import { forumBridge as activeForumBridge } from "../../../server/modules/forum";
import { forumBridge as moduleForumBridge } from "../../../server/modules/forum/services/forum-bridge";

// Mock XenForo client calls
jest.mock("~/lib/xenforo/client", () => ({
  xfFetchAsUser: jest.fn(),
  xfPostAsUser: jest.fn(),
  xfFetch: jest.fn(),
}));

jest.mock("~/server/modules/forum/services/xenforo-service", () => ({
  xfFetchAsUser: jest.fn(),
  xfPostAsUser: jest.fn(),
  xfFetch: jest.fn(),
}));

describe("forum-bridge characterization contract", () => {
  const userId = "user_clerk_forum_123";

  describe("active forum bridge (src/server/bridges/forum-bridge.ts)", () => {
    it("returns zero counts and skips sync when user has no linked forum account", async () => {
      const mockDb = {
        user: {
          findFirst: jest.fn().mockResolvedValue({
            clerkUserId: userId,
            forumUserId: null,
          }),
        },
      };

      const result = await activeForumBridge.syncInbound(userId, mockDb as any);

      expect(result).toEqual({
        conversationsCreated: 0,
        conversationsUpdated: 0,
        messagesCreated: 0,
      });
    });

    it("attributes unresolved external authors to forum:username key in active bridge", async () => {
      const { xfFetchAsUser } = require("~/lib/xenforo/client");

      const mockDb = {
        user: {
          findFirst: jest.fn().mockImplementation(async ({ where }: any) => {
            if (where?.clerkUserId === userId) {
              return { clerkUserId: userId, forumUserId: 101 };
            }
            return null; // Unresolved external author
          }),
        },
        thinkshareConversation: {
          findFirst: jest.fn().mockResolvedValue({ id: "conv_existing_1" }),
          update: jest.fn().mockResolvedValue({}),
        },
        conversationParticipant: {
          create: jest.fn().mockResolvedValue({}),
          upsert: jest.fn().mockResolvedValue({}),
        },
        thinkshareMessage: {
          findFirst: jest.fn().mockResolvedValue(null), // New message
          create: jest.fn().mockResolvedValue({ id: "msg_created_1" }),
        },
      };

      xfFetchAsUser.mockImplementation(async (endpoint: string) => {
        if (endpoint === "/conversations") {
          return {
            conversations: [
              {
                conversation_id: 501,
                title: "Active Bridge Test",
                recipients: [{ user_id: 999, username: "external_forum_user" }],
              },
            ],
          };
        }
        if (endpoint.includes("/messages")) {
          return {
            messages: [
              {
                message_id: 7001,
                user_id: 999,
                username: "external_forum_user",
                message: "Hello from XenForo",
                message_date: 1700000000,
              },
            ],
          };
        }
        return null;
      });

      const result = await activeForumBridge.syncInbound(userId, mockDb as any);

      expect(result.messagesCreated).toBe(1);
      expect(mockDb.thinkshareMessage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: "forum:external_forum_user",
            source: "forum",
            sourceMessageId: "7001",
          }),
        })
      );
    });

    it("skips duplicate messages by sourceMessageId", async () => {
      const { xfFetchAsUser } = require("~/lib/xenforo/client");

      const mockDb = {
        user: {
          findFirst: jest.fn().mockResolvedValue({
            clerkUserId: userId,
            forumUserId: 101,
          }),
        },
        thinkshareConversation: {
          findFirst: jest.fn().mockResolvedValue({ id: "conv_existing_1" }),
          update: jest.fn().mockResolvedValue({}),
        },
        conversationParticipant: {
          create: jest.fn().mockResolvedValue({}),
          upsert: jest.fn().mockResolvedValue({}),
        },
        thinkshareMessage: {
          findFirst: jest.fn().mockResolvedValue({ id: "already_synced_msg" }),
          create: jest.fn(),
        },
      };

      xfFetchAsUser.mockImplementation(async (endpoint: string) => {
        if (endpoint === "/conversations") {
          return { conversations: [{ conversation_id: 501, title: "Test" }] };
        }
        if (endpoint.includes("/messages")) {
          return {
            messages: [
              {
                message_id: 7001,
                user_id: 101,
                username: "me",
                message: "Already synced",
                message_date: 1700000000,
              },
            ],
          };
        }
        return null;
      });

      const result = await activeForumBridge.syncInbound(userId, mockDb as any);

      expect(result.messagesCreated).toBe(0);
      expect(mockDb.thinkshareMessage.create).not.toHaveBeenCalled();
    });
  });

  describe("module-local forum bridge (src/server/modules/forum/services/forum-bridge.ts)", () => {
    it("defaults unresolved external authors to syncing local user in module-local bridge", async () => {
      const { xfFetchAsUser } = require("~/server/modules/forum/services/xenforo-service");

      const mockDb = {
        user: {
          findFirst: jest.fn().mockImplementation(async ({ where }: any) => {
            if (where?.clerkUserId === userId) {
              return { clerkUserId: userId, forumUserId: 101 };
            }
            return null; // Unresolved external author
          }),
        },
        thinkshareConversation: {
          findFirst: jest.fn().mockResolvedValue({ id: "conv_existing_mod_1" }),
          update: jest.fn().mockResolvedValue({}),
        },
        conversationParticipant: {
          create: jest.fn().mockResolvedValue({}),
          upsert: jest.fn().mockResolvedValue({}),
        },
        thinkshareMessage: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({ id: "msg_created_mod_1" }),
        },
      };

      xfFetchAsUser.mockImplementation(async (endpoint: string) => {
        if (endpoint === "/conversations") {
          return {
            conversations: [
              {
                conversation_id: 601,
                title: "Module Bridge Test",
                recipients: [{ user_id: 888, username: "another_user" }],
              },
            ],
          };
        }
        if (endpoint.includes("/messages")) {
          return {
            messages: [
              {
                message_id: 8001,
                user_id: 888,
                username: "another_user",
                message: "Module message",
                message_date: 1700000000,
              },
            ],
          };
        }
        return null;
      });

      const result = await moduleForumBridge.syncInbound(userId, mockDb as any);

      expect(result.messagesCreated).toBe(1);
      // Module bridge fallback attributes to syncing userId
      expect(mockDb.thinkshareMessage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: userId,
            source: "forum",
            sourceMessageId: "8001",
          }),
        })
      );
    });
  });
});
