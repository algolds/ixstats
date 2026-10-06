/** @jest-environment node */
/**
 * SL-4: message request filtering, read receipts and online status in messaging.
 *
 * - A direct message from outside the recipient's audience goes to their Requests folder when
 *   they filter message requests (the default), and is refused when they don't or chose "nobody".
 * - "Seen" shows only in direct conversations where both people allow read receipts.
 * - Online status shows only for participants with a recent heartbeat who allow it.
 */
jest.mock("~/server/db", () => ({ db: {} }));

import { createMessagingService } from "~/server/modules/messaging";
import { formatMessagesConversation } from "~/server/modules/messaging/formatters";
import { createMockPrisma } from "~/tests/helpers/mock-db";
import { recordHeartbeat, resetPresenceForTests } from "~/server/shared/presence";

type Configs = Record<string, Record<string, unknown>>;

function dbWith(configs: Configs) {
  const db = createMockPrisma();
  db.userConnection.findMany.mockImplementation(async (args: any) =>
    args.where.connectionType === "privacy_config"
      ? Object.entries(configs)
          .filter(([userId]) => !args.where.userId?.in || args.where.userId.in.includes(userId))
          .map(([userId, cfg]) => ({ userId, status: JSON.stringify(cfg) }))
      : []
  );
  db.thinkshareConversation.create.mockImplementation(async (args: any) => ({
    id: "conv_new",
    ...args.data,
  }));
  return db;
}

function service(db: ReturnType<typeof createMockPrisma>) {
  const notifications = { create: jest.fn().mockResolvedValue("n") };
  const websocket = { broadcastToUsers: jest.fn() };
  return {
    svc: createMessagingService({
      db: db as never,
      notifications: notifications as never,
      websocket: websocket as never,
    }),
    notifications,
    websocket,
  };
}

const outsideAudience = { directMessages: "followers" };

describe("createConversation with message requests", () => {
  it("adds a recipient outside the audience as a pending request (filtering on by default)", async () => {
    const db = dbWith({ r1: outsideAudience });
    await service(db).svc.createConversation("sender", { participantIds: ["r1"] } as never);
    const created = db.thinkshareConversation.create.mock.calls[0]![0].data.participants.create;
    expect(created).toEqual([
      { userId: "sender", role: "participant" },
      { userId: "r1", role: "participant", requestStatus: "pending" },
    ]);
  });

  it("refuses when the recipient turned message requests off", async () => {
    const db = dbWith({ r1: { ...outsideAudience, messageRequestFiltering: false } });
    await expect(
      service(db).svc.createConversation("sender", { participantIds: ["r1"] } as never)
    ).rejects.toMatchObject({ name: "MessagingBlockedError" });
    expect(db.thinkshareConversation.create).not.toHaveBeenCalled();
  });

  it("refuses an audience of nobody even with filtering on", async () => {
    const db = dbWith({ r1: { directMessages: "nobody", messageRequestFiltering: true } });
    await expect(
      service(db).svc.createConversation("sender", { participantIds: ["r1"] } as never)
    ).rejects.toMatchObject({ name: "MessagingBlockedError" });
  });

  it("adds a recipient inside the audience normally", async () => {
    const db = dbWith({});
    await service(db).svc.createConversation("sender", { participantIds: ["r1"] } as never);
    const created = db.thinkshareConversation.create.mock.calls[0]![0].data.participants.create;
    expect(created[1]).toEqual({ userId: "r1", role: "participant" });
  });
});

describe("sendMessage in a direct conversation", () => {
  function directDb(configs: Configs, recipient: Record<string, unknown>) {
    const db = dbWith(configs);
    db.thinkshareConversation.findFirst.mockResolvedValue({ id: "c1", type: "direct" });
    db.conversationParticipant.findFirst.mockResolvedValue({ id: "p_s", conversation: {} });
    db.conversationParticipant.findMany.mockResolvedValue([
      { userId: "r1", isActive: true, ...recipient },
    ]);
    db.thinkshareMessage.create.mockResolvedValue({ id: "m1" });
    db.thinkshareMessage.count.mockResolvedValue(0);
    return db;
  }

  it("moves a normal conversation to the recipient's requests and does not notify them", async () => {
    const db = directDb({ r1: outsideAudience }, { requestStatus: "none" });
    const { svc, notifications, websocket } = service(db);
    await svc.sendMessage("sender", { conversationId: "c1", content: "hi" } as never);
    expect(db.conversationParticipant.updateMany).toHaveBeenCalledWith({
      where: { conversationId: "c1", userId: { in: ["r1"] } },
      data: { requestStatus: "pending" },
    });
    expect(db.thinkshareMessage.create).toHaveBeenCalled();
    expect(notifications.create).not.toHaveBeenCalled();
    expect(websocket.broadcastToUsers).toHaveBeenCalledWith([], "message:new", expect.anything());
  });

  it("keeps adding to a pending request without notifying", async () => {
    const db = directDb({ r1: outsideAudience }, { requestStatus: "pending" });
    const { svc, notifications } = service(db);
    await svc.sendMessage("sender", { conversationId: "c1", content: "again" } as never);
    expect(db.conversationParticipant.updateMany).not.toHaveBeenCalled();
    expect(notifications.create).not.toHaveBeenCalled();
  });

  it("lets the sender message a recipient who accepted, outside their audience", async () => {
    const db = directDb({ r1: outsideAudience }, { requestStatus: "accepted" });
    const { svc, notifications } = service(db);
    await svc.sendMessage("sender", { conversationId: "c1", content: "thanks" } as never);
    expect(notifications.create).toHaveBeenCalledWith(expect.objectContaining({ userId: "r1" }));
  });

  it("refuses once the recipient declined", async () => {
    const db = directDb({}, { requestStatus: "declined", isActive: false });
    await expect(
      service(db).svc.sendMessage("sender", { conversationId: "c1", content: "?" } as never)
    ).rejects.toMatchObject({ name: "MessagingBlockedError" });
    expect(db.thinkshareMessage.create).not.toHaveBeenCalled();
  });

  it("still refuses when filtering is off", async () => {
    const db = directDb(
      { r1: { ...outsideAudience, messageRequestFiltering: false } },
      { requestStatus: "none" }
    );
    await expect(
      service(db).svc.sendMessage("sender", { conversationId: "c1", content: "hi" } as never)
    ).rejects.toMatchObject({ name: "MessagingBlockedError" });
  });
});

describe("respondToRequest", () => {
  it("accepts a pending request", async () => {
    const db = dbWith({});
    db.conversationParticipant.findFirst.mockResolvedValue({ id: "p1" });
    const result = await service(db).svc.respondToRequest("me", {
      conversationId: "c1",
      accept: true,
    });
    expect(result).toEqual({ success: true, accepted: true });
    expect(db.conversationParticipant.findFirst.mock.calls[0]![0].where).toMatchObject({
      userId: "me",
      requestStatus: "pending",
    });
    expect(db.conversationParticipant.update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: { requestStatus: "accepted" },
    });
  });

  it("declining leaves the conversation", async () => {
    const db = dbWith({});
    db.conversationParticipant.findFirst.mockResolvedValue({ id: "p1" });
    await service(db).svc.respondToRequest("me", { conversationId: "c1", accept: false });
    expect(db.conversationParticipant.update.mock.calls[0]![0].data).toMatchObject({
      requestStatus: "declined",
      isActive: false,
    });
  });

  it("is not found without a pending request", async () => {
    const db = dbWith({});
    await expect(
      service(db).svc.respondToRequest("me", { conversationId: "c1", accept: true })
    ).rejects.toMatchObject({ name: "MessagingNotFoundError" });
  });
});

describe("folders", () => {
  it("lists requests apart and keeps them out of the inbox", async () => {
    const db = dbWith({});
    const { svc } = service(db);
    await svc.getConversationsByFolder("me", { folder: "requests" });
    await svc.getConversationsByFolder("me", { folder: "conversations" });
    const [requests, inbox] = db.thinkshareConversation.findMany.mock.calls.map(
      (c: any) => c[0].where
    );
    expect(requests.participants.some).toEqual({
      userId: "me",
      isActive: true,
      requestStatus: "pending",
    });
    expect(inbox.participants.some.requestStatus).toEqual({ not: "pending" });
  });

  it("counts pending requests and excludes them from unread", async () => {
    const db = dbWith({});
    db.conversationParticipant.findMany.mockResolvedValue([
      { conversationId: "a", requestStatus: "pending", conversation: { source: "thinkshare" } },
      { conversationId: "b", requestStatus: "none", conversation: { source: "thinkshare" } },
    ]);
    db.$queryRaw = jest.fn().mockResolvedValue([{ conversationId: "b", unread: 2 }]);
    const counts = await service(db).svc.getFolderCounts("me");
    expect(counts).toMatchObject({ inbox: 2, requests: 1 });
    expect(db.$queryRaw.mock.calls[0]![0].join("")).toContain(`"requestStatus" <> 'pending'`);
  });

  it("marks requests and awaiting acceptance on the formatted conversation", () => {
    const conv = {
      id: "c",
      type: "direct",
      participants: [
        { userId: "me", requestStatus: "pending" },
        { userId: "them", requestStatus: "none" },
      ],
    };
    const mine = formatMessagesConversation(conv, "me", new Map());
    expect(mine).toMatchObject({ isRequest: true, awaitingAcceptance: false });
    const theirs = formatMessagesConversation(conv, "them", new Map());
    expect(theirs).toMatchObject({ isRequest: false, awaitingAcceptance: true });
  });
});

describe("read receipts (getSeenState)", () => {
  const readAt = new Date("2026-10-06T10:00:00Z");
  function seenDb(configs: Configs, other: Record<string, unknown> = {}, type = "direct") {
    const db = dbWith(configs);
    db.thinkshareConversation.findUnique.mockResolvedValue({
      type,
      participants: [
        { userId: "me", lastReadAt: new Date(0), requestStatus: "none" },
        { userId: "them", lastReadAt: readAt, requestStatus: "none", ...other },
      ],
    });
    return db;
  }

  it("shows when the other person read it, when both allow receipts", async () => {
    const db = seenDb({});
    expect(await service(db).svc.getSeenState("me", "c")).toEqual({ seenAt: readAt });
  });

  it("hides it when either side turned receipts off", async () => {
    for (const who of ["me", "them"]) {
      const db = seenDb({ [who]: { dmReadReceipts: false } });
      expect(await service(db).svc.getSeenState("me", "c")).toEqual({ seenAt: null });
    }
  });

  it("hides it in group conversations and unanswered requests", async () => {
    expect(await service(seenDb({}, {}, "group")).svc.getSeenState("me", "c")).toEqual({
      seenAt: null,
    });
    expect(
      await service(seenDb({}, { requestStatus: "pending" })).svc.getSeenState("me", "c")
    ).toEqual({ seenAt: null });
  });

  it("refuses non-participants", async () => {
    const db = seenDb({});
    await expect(service(db).svc.getSeenState("stranger", "c")).rejects.toMatchObject({
      name: "MessagingForbiddenError",
    });
  });
});

describe("online status in conversation lists", () => {
  beforeEach(() => resetPresenceForTests());

  it("shows a direct participant online only with a recent heartbeat and the setting on", async () => {
    await recordHeartbeat("visible");
    await recordHeartbeat("hidden");
    const db = dbWith({ hidden: { showOnlineStatus: false } });
    db.thinkshareConversation.findMany.mockResolvedValue(
      ["visible", "hidden", "away"].map((other) => ({
        id: `c_${other}`,
        type: "direct",
        participants: [{ userId: "me" }, { userId: other }],
        messages: [],
      }))
    );
    const { conversations } = await service(db).svc.getConversationsByFolder("me", {
      folder: "conversations",
    });
    expect(
      conversations.map((c: any) => [
        c.otherParticipants[0].accountId,
        c.otherParticipants[0].isOnline,
      ])
    ).toEqual([
      ["visible", true],
      ["hidden", false],
      ["away", false],
    ]);
  });
});
