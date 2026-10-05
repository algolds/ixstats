import { TRPCError } from "@trpc/server";
import { createMessagingService, MessagingForbiddenError } from "~/server/modules/messaging";
import { messagesConversationsRouter } from "~/server/api/routers/messages/conversations";
import { messagesParticipantsRouter } from "~/server/api/routers/messages/participants";
import { createMockRouterContext } from "~/tests/helpers/router-context";

jest.mock("~/lib/notifications/api", () => ({
  notificationAPI: { create: jest.fn().mockResolvedValue({ success: true }) },
}));

function makeDb(conv: any) {
  const db: any = {
    $transaction: jest.fn().mockImplementation((cb: any) => cb(db)),
    thinkshareConversation: {
      findFirst: jest.fn().mockResolvedValue(conv),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(async ({ data }: any) => ({ id: "new_conv", ...data })),
      update: jest.fn().mockResolvedValue({}),
    },
    conversationParticipant: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([{ userId: "other" }]),
      upsert: jest.fn().mockResolvedValue({ id: "p_new", conversation: conv }),
      create: jest.fn().mockResolvedValue({ id: "p_new" }),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    thinkshareMessage: {
      create: jest.fn().mockResolvedValue({ id: "m_1" }),
      count: jest.fn().mockResolvedValue(0),
    },
    thinktankGroup: { findFirst: jest.fn().mockResolvedValue(null) },
    user: {
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn().mockResolvedValue(null),
    },
    userConnection: { findMany: jest.fn().mockResolvedValue([]) },
  };
  return db;
}

describe("sendMessage authorization (N1) and notification target (N15)", () => {
  const notifications = { createNotification: jest.fn().mockResolvedValue({}) };
  const websocket = { broadcastToUsers: jest.fn() };

  beforeEach(() => jest.clearAllMocks());

  it.each([
    ["group DM", { id: "conv_g", type: "group", source: "thinkshare" }],
    ["thinktank chat", { id: "conv_t", type: "group", source: "thinktank" }],
  ])("does not auto-join a non-participant into a %s", async (_label, conv) => {
    const db = makeDb(conv);
    const service = createMessagingService({ db, notifications, websocket });

    await expect(
      service.sendMessage("intruder", { conversationId: conv.id, content: "hi" })
    ).rejects.toThrow(MessagingForbiddenError);

    expect(db.conversationParticipant.create).not.toHaveBeenCalled();
    expect(db.conversationParticipant.upsert).not.toHaveBeenCalled();
    expect(db.thinkshareMessage.create).not.toHaveBeenCalled();
  });

  it("does not let a non-member write into a ThinkTank chat by ThinkTank group id", async () => {
    const conv = { id: "conv_t", type: "group", source: "thinktank" };
    const db = makeDb(conv);
    const service = createMessagingService({ db, notifications, websocket });

    await expect(
      service.sendMessage("intruder", { conversationId: "group_id_1", content: "hi" })
    ).rejects.toThrow(MessagingForbiddenError);
    expect(db.thinkshareMessage.create).not.toHaveBeenCalled();
  });

  it("joins an active ThinktankGroup member to the linked conversation", async () => {
    const conv = { id: "conv_t", type: "group", source: "thinktank" };
    const db = makeDb(conv);
    db.thinktankGroup.findFirst.mockResolvedValue({ id: "group_1" });
    const service = createMessagingService({ db, notifications, websocket });

    await service.sendMessage("member", { conversationId: "conv_t", content: "hi" });

    expect(db.thinktankGroup.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          conversationId: "conv_t",
          members: { some: { userId: "member", isActive: true } },
        }),
      })
    );
    expect(db.conversationParticipant.upsert).toHaveBeenCalled();
    expect(db.thinkshareMessage.create).toHaveBeenCalled();
  });

  it("notifies and broadcasts using the resolved conversation id, not the input id", async () => {
    const conv = { id: "conv_real", type: "group", source: "thinktank" };
    const db = makeDb(conv);
    db.conversationParticipant.findFirst.mockResolvedValue({ id: "p_1", conversation: conv });
    const service = createMessagingService({ db, notifications, websocket });

    await service.sendMessage("sender", { conversationId: "group_id_1", content: "hello" });

    expect(db.conversationParticipant.findMany).toHaveBeenCalledWith({
      where: { conversationId: "conv_real", userId: { not: "sender" }, isActive: true },
    });
    expect(notifications.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ href: "/messages?id=conv_real" })
    );
    expect(websocket.broadcastToUsers).toHaveBeenCalledWith(
      ["other"],
      "message:new",
      expect.objectContaining({ conversationId: "conv_real" })
    );
  });
});

describe("sendAdminMessage (N9)", () => {
  it("does not write a nonexistent `subject` column on ThinkshareConversation", async () => {
    const db = makeDb(null);
    db.thinkshareConversation.findFirst.mockResolvedValue(null);
    db.thinkshareMessage.create.mockResolvedValue({ id: "m_a", ixTimeTimestamp: new Date() });
    const service = createMessagingService({ db, websocket: { broadcastToUsers: jest.fn() } });

    await service.sendAdminMessage("admin", {
      targetUserId: "target",
      content: "Notice",
      subject: "Hello",
    } as any);

    const data = db.thinkshareConversation.create.mock.calls[0][0].data;
    expect(data).not.toHaveProperty("subject");
    // Subject still lives on the message, where the column exists.
    expect(db.thinkshareMessage.create.mock.calls[0][0].data.subject).toBe("Hello");
  });
});

describe("messages router (N4, N10)", () => {
  function callers(auth: string | null, db: any) {
    const ctx = createMockRouterContext({
      auth: auth ? { userId: auth } : null,
      user: auth ? { id: `db-${auth}`, clerkUserId: auth, role: { name: "user" } } : null,
      db,
    }) as any;
    return {
      participants: messagesParticipantsRouter.createCaller(ctx),
      conversations: messagesConversationsRouter.createCaller(ctx),
    };
  }

  it("searchUsers requires sign-in and selects only the fields the UI needs", async () => {
    const db = makeDb(null);
    db.user.findMany = jest.fn().mockResolvedValue([]);
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    await expect(callers(null, db).participants.searchUsers({ query: "abc" })).rejects.toThrow(
      TRPCError
    );

    warnSpy.mockRestore();

    await callers("u1", db).participants.searchUsers({ query: "abc" });
    const args = db.user.findMany.mock.calls[0][0];
    expect(args.include).toBeUndefined();
    expect(args.select).toEqual({
      id: true,
      clerkUserId: true,
      country: { select: { name: true, slug: true, flag: true } },
    });
  });

  it("createConversation persists diplomatic type, classification and priority", async () => {
    const db = makeDb(null);
    await callers("u1", db).conversations.createConversation({
      participantIds: ["u1", "u2"],
      source: "diplomatic",
      conversationType: "diplomatic",
      diplomaticClassification: "SECRET",
      priority: "HIGH",
      channelType: "BILATERAL",
    });

    const data = db.thinkshareConversation.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      source: "diplomatic",
      conversationType: "diplomatic",
      diplomaticClassification: "SECRET",
      priority: "HIGH",
      channelType: "BILATERAL",
    });
  });
});
