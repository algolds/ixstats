/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals" for the mocks: the hoisted jest.mock() factories rely on the
// ambient global.
/**
 * The principal a router acts for is `ctx.auth.userId`, never an id in the input. Messaging (Plan 148): reads,
 * sends, edits, deletes, reactions and read receipts are the caller's own, and a non-participant is refused. Vault
 * and notification reads take the caller from the context (an anonymous caller's spoofed userId reads nothing).
 * `achievements.unlock` is admin-only, for anyone including oneself. `users.getUserWithRole` returns a role level
 * only, never the user row or a name.
 *
 * Folds achievements-unlock-admin-auth, self-scoped-queries-auth and user-role-level.
 */
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
jest.mock("~/lib/notifications/api", () => ({
  notificationAPI: { create: jest.fn().mockResolvedValue({ success: true }) },
}));
jest.mock("~/lib/achievements/service", () => ({
  __esModule: true,
  achievementService: {
    unlockSpecific: jest.fn().mockResolvedValue(true),
    checkAndUnlock: jest.fn().mockResolvedValue([]),
  },
}));
jest.mock("~/lib/vault/vault-service", () => ({
  __esModule: true,
  vaultService: {
    getBalance: jest.fn().mockResolvedValue({
      credits: 100,
      lifetimeEarned: 100,
      lifetimeSpent: 0,
      vaultLevel: 1,
      vaultXp: 0,
    }),
  },
}));
jest.mock("~/lib/cache/advanced-cache-system", () => ({
  __esModule: true,
  globalCache: { get: jest.fn().mockResolvedValue(null), set: jest.fn(), delete: jest.fn() },
}));

import { describe, it, expect, beforeEach } from "@jest/globals";
import { TRPCError } from "@trpc/server";
import { createCallerFactory } from "~/server/api/trpc";
import { achievementsManagementRouter } from "~/server/api/routers/achievements/management";
import { messagesConversationsRouter } from "~/server/api/routers/messages/conversations";
import { messagesMessagingRouter } from "~/server/api/routers/messages/messaging";
import { messagesParticipantsRouter } from "~/server/api/routers/messages/participants";
import { notificationsUserRouter } from "~/server/api/routers/notifications/user";
import { usersProfileRouter } from "~/server/api/routers/users/profile";
import { vaultBalanceCreditsRouter } from "~/server/api/routers/vault/balance-credits";
import { achievementService } from "~/lib/achievements/service";
import { vaultService } from "~/lib/vault/vault-service";
import { wikiTalkBridge } from "~/server/bridges/wiki-talk-bridge";
import { createMockPrisma } from "~/tests/helpers/mock-db";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockDb } from "~/tests/helpers/transactional-mock-db";

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
    const ctx = createMockRouterContext({
      auth: authUserId ? { userId: authUserId } : null,
      user: authUserId
        ? {
            id: `db-${authUserId}`,
            clerkUserId: authUserId,
            name: `User ${authUserId}`,
            role: { name: "user" },
          }
        : null,
      db,
    }) as any;

    return {
      conversations: messagesConversationsRouter.createCaller(ctx as any),
      messaging: messagesMessagingRouter.createCaller(ctx as any),
      participants: messagesParticipantsRouter.createCaller(ctx as any),
      db,
    };
  }

  describe("Authentication & Read Isolation", () => {
    it("rejects unauthenticated callers for getConversationsByFolder, getFolderCounts, and getConversationMessages", async () => {
      const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
      const unauth = createCaller(null);

      await expect(
        unauth.conversations.getConversationsByFolder({ folder: "inbox" })
      ).rejects.toThrow(TRPCError);

      await expect(unauth.conversations.getFolderCounts({})).rejects.toThrow(TRPCError);

      await expect(
        unauth.messaging.getConversationMessages({
          conversationId: "conv-1",
          userId: victimUser,
        })
      ).rejects.toThrow(TRPCError);

      warnSpy.mockRestore();
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
              some: expect.objectContaining({ userId: callerUser, isActive: true }),
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

      expect(mockDb.conversationParticipant.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: callerUser, isActive: true },
        })
      );
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

    it("throws FORBIDDEN when caller is not an active participant in getConversation", async () => {
      const mockDb = createMockDb();
      mockDb.thinkshareConversation.findFirst = jest.fn().mockResolvedValue({
        id: "conv-secret",
        type: "group",
        source: "thinkshare",
        participants: [{ userId: victimUser }],
        messages: [{ userId: victimUser, content: "Between us" }],
      });

      await expect(
        createCaller(callerUser, mockDb).conversations.getConversation({
          conversationId: "conv-secret",
        })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(mockDb.conversationParticipant.upsert).not.toHaveBeenCalled();
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
      mockDb.thinkshareMessage.create = jest
        .fn()
        .mockImplementation(({ data }) => Promise.resolve({ id: "msg-123", ...data }));
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

      await expect(caller.messaging.deleteMessage({ messageId: "msg-2" })).rejects.toMatchObject({
        code: "FORBIDDEN",
      });

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

const createCaller = createCallerFactory(achievementsManagementRouter);

const unlockInput = {
  userId: "victim_clerk_id",
  achievementId: "first_steps",
  title: "First Steps",
};

describe("achievements.unlock is admin-only", () => {
  beforeEach(() => {
    (achievementService.unlockSpecific as jest.Mock).mockClear();
  });

  it("rejects an ordinary user granting an achievement to another user, and grants nothing", async () => {
    const db = createMockDb();
    const caller = createCaller(
      createMockRouterContext({
        auth: { userId: "user_1" },
        user: { id: "db1", clerkUserId: "user_1", role: { name: "user", level: 100 } },
        db,
      }) as never
    );

    await expect(caller.unlock(unlockInput)).rejects.toThrow(/Admin privileges required/);
    expect(achievementService.unlockSpecific).not.toHaveBeenCalled();
  });

  it("rejects an ordinary user granting an achievement to themselves", async () => {
    const db = createMockDb();
    const caller = createCaller(
      createMockRouterContext({
        auth: { userId: "user_1" },
        user: { id: "db1", clerkUserId: "user_1", role: { name: "user", level: 100 } },
        db,
      }) as never
    );

    await expect(caller.unlock({ ...unlockInput, userId: "user_1" })).rejects.toThrow(
      /Admin privileges required/
    );
    expect(achievementService.unlockSpecific).not.toHaveBeenCalled();
  });

  it("lets an admin grant an achievement", async () => {
    const db = createMockDb();
    const caller = createCaller(
      createMockRouterContext({
        auth: { userId: "admin_1" },
        user: { id: "db_admin", clerkUserId: "admin_1", role: { name: "admin", level: 10 } },
        db,
      }) as never
    );

    const result = await caller.unlock(unlockInput);

    expect(achievementService.unlockSpecific).toHaveBeenCalledWith(
      "victim_clerk_id",
      "first_steps",
      expect.anything()
    );
    // The grant runs against the request's own db client.
    expect(jest.mocked(achievementService.unlockSpecific).mock.calls[0]?.[2]).toBe(db);
    expect(result.creditsEarned).toBe(5);
  });
});

const createVaultCaller = createCallerFactory(vaultBalanceCreditsRouter);
const createNotificationsCaller = createCallerFactory(notificationsUserRouter);

describe("Self-scoped vault/notification queries (Finding 6)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("vault.getBalance takes identity from ctx.auth.userId, never from input", async () => {
    const db = createMockDb();
    const ctx = createMockRouterContext({
      auth: { userId: "user_self" },
      user: { id: "db_self", clerkUserId: "user_self", role: { name: "user", level: 100 } },
      db,
    });
    const caller = createVaultCaller(ctx as never);

    await caller.getBalance();

    expect(vaultService.getBalance).toHaveBeenCalledWith("user_self", expect.anything());
  });

  it("notifications.getUnreadCount ignores a spoofed input.userId and never queries the victim for an anonymous caller", async () => {
    const db = createMockDb();
    const ctx = createMockRouterContext({ auth: null, user: null, db });
    const caller = createNotificationsCaller(ctx as never);

    const result = await caller.getUnreadCount({ userId: "victim" } as never);

    expect(result).toEqual({ count: 0 });
    expect(db.user.findFirst).not.toHaveBeenCalled();
  });
});

const AUTHOR = "clerk_author";

function makeDb(author: { role: { level: number } | null } | null) {
  const db = createMockPrisma();
  db.user.findUnique.mockResolvedValue(
    author && {
      id: "db_author",
      clerkUserId: AUTHOR,
      wikiUsername: "Wiki Author",
      discordUsername: "authortag",
      ...author,
    }
  );
  return db;
}

async function lookUp(db: ReturnType<typeof makeDb>, viewer: string | null) {
  const ctx = createMockRouterContext({
    db,
    auth: viewer ? { userId: viewer } : null,
    user: viewer ? { id: `db_${viewer}`, clerkUserId: viewer } : null,
  });
  return createCallerFactory(usersProfileRouter)(ctx as never).getUserWithRole({
    clerkUserId: AUTHOR,
  });
}

describe("users.getUserWithRole returns the role level only", () => {
  it.each([
    ["another player", "clerk_viewer"],
    ["a signed-out visitor", null],
    ["the user themself", AUTHOR],
  ])("gives %s the level and nothing else", async (_who, viewer) => {
    const db = makeDb({ role: { level: 20 } });
    const result = await lookUp(db, viewer);
    expect(result).toEqual({ roleLevel: 20 });
    expect(JSON.stringify(result)).not.toMatch(/Wiki Author|authortag|db_author/);
  });
  it("is null for an unknown user, one without a role, or a read error", async () => {
    expect(await lookUp(makeDb(null), "clerk_viewer")).toEqual({ roleLevel: null });
    expect(await lookUp(makeDb({ role: null }), "clerk_viewer")).toEqual({ roleLevel: null });
    const failing = makeDb(null);
    failing.user.findUnique.mockRejectedValue(new Error("db down"));
    const error = jest.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await lookUp(failing, "clerk_viewer")).toEqual({ roleLevel: null });
    error.mockRestore();
  });
});
