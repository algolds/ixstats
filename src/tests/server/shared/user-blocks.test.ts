/** @jest-environment node */
/**
 * SL-4: block and mute are enforced on the server. Blocked and muted accounts' posts leave the
 * viewer's ThinkPages feed, a user who blocked someone cannot be messaged by them, and in group
 * conversations the blocker no longer sees (or is notified of) the blocked account's messages.
 */
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/lib/cache", () => ({
  ...jest.requireActual("~/lib/cache"),
  globalCache: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
  },
}));

import { createCallerFactory } from "~/server/api/trpc";
import { thinkpagesFeedRouter } from "~/server/api/routers/thinkpages/feed";
import { globalCache } from "~/lib/cache";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockPrisma } from "~/tests/helpers/mock-db";
import {
  blockedUserClerkIds,
  hiddenThinkpagesAccountIds,
  recipientsBlockingSender,
} from "~/server/shared/user-blocks";
import { createMessagingService } from "~/server/modules/messaging";

describe("hiddenThinkpagesAccountIds", () => {
  it("is empty for anonymous viewers without touching the database", async () => {
    const db = createMockPrisma();
    expect(await hiddenThinkpagesAccountIds(db as never, null)).toEqual([]);
    expect(db.userConnection.findMany).not.toHaveBeenCalled();
  });

  it("resolves blocked and muted users and blocked nations to their ThinkPages accounts", async () => {
    const db = createMockPrisma();
    db.userConnection.findMany.mockResolvedValue([
      { targetUserId: "db_muted", targetCountryId: null },
      { targetUserId: "db_blocked", targetCountryId: "country_x" },
    ]);
    db.user.findMany.mockResolvedValue([
      { clerkUserId: "clerk_muted" },
      { clerkUserId: "clerk_b" },
    ]);
    db.thinkpagesAccount.findMany.mockResolvedValue([{ id: "acc1" }, { id: "acc2" }]);

    expect(await hiddenThinkpagesAccountIds(db as never, "viewer")).toEqual(["acc1", "acc2"]);
    expect(db.userConnection.findMany.mock.calls[0]![0].where).toEqual({
      userId: "viewer",
      connectionType: { in: ["blocked", "muted"] },
    });
    expect(db.thinkpagesAccount.findMany.mock.calls[0]![0].where).toEqual({
      OR: [
        { clerkUserId: { in: ["clerk_muted", "clerk_b"] } },
        { countryId: { in: ["country_x"] } },
      ],
      NOT: { clerkUserId: "viewer" },
    });
  });
});

describe("thinkpages.getFeed honours the viewer's block and mute lists", () => {
  const createCaller = createCallerFactory(thinkpagesFeedRouter);

  it("excludes hidden accounts and caches per viewer", async () => {
    const db = createMockPrisma();
    // Block/mute rows only; the muted-word lookup (connectionType "keyword") finds none.
    db.userConnection.findMany.mockImplementation(async (args: any) =>
      args.where.connectionType === "keyword"
        ? []
        : [{ targetUserId: "db_x", targetCountryId: null }]
    );
    db.user.findMany.mockResolvedValue([{ clerkUserId: "clerk_x" }]);
    db.thinkpagesAccount.findMany.mockResolvedValue([{ id: "acc_x" }]);
    const ctx = createMockRouterContext({ db, auth: { userId: "viewer" }, user: null });

    await createCaller(ctx as never).getFeed({});
    expect(db.thinkpagesPost.findMany.mock.calls[0]![0].where).toEqual({
      visibility: "public",
      accountId: { notIn: ["acc_x"] },
    });
    const key = (globalCache.set as jest.Mock).mock.calls.at(-1)![0] as string;
    expect(key).toContain(":viewer:viewer");
  });

  it("leaves out posts with the viewer's muted words (SL-4)", async () => {
    const db = createMockPrisma();
    db.userConnection.findMany.mockImplementation(async (args: any) =>
      args.where.connectionType === "keyword"
        ? [{ targetUserId: "election", status: "Election" }]
        : []
    );
    const ctx = createMockRouterContext({ db, auth: { userId: "viewer" }, user: null });

    await createCaller(ctx as never).getFeed({});
    expect(db.thinkpagesPost.findMany.mock.calls[0]![0].where).toEqual({
      visibility: "public",
      AND: [{ NOT: { content: { contains: "election", mode: "insensitive" } } }],
    });
    const key = (globalCache.set as jest.Mock).mock.calls.at(-1)![0] as string;
    expect(key).toContain(":viewer:viewer");
  });

  it("leaves the shared feed alone for viewers with empty lists", async () => {
    const db = createMockPrisma();
    const ctx = createMockRouterContext({ db, auth: { userId: "viewer" }, user: null });
    await createCaller(ctx as never).getFeed({});
    expect(db.thinkpagesPost.findMany.mock.calls[0]![0].where).toEqual({ visibility: "public" });
  });
});

describe("recipientsBlockingSender", () => {
  it("matches blocks of the sender's ids or nation", async () => {
    const db = createMockPrisma();
    db.user.findUnique.mockResolvedValue({ id: "db_sender", countryId: "c_sender" });
    db.userConnection.findMany.mockResolvedValue([{ userId: "r1" }]);

    expect(await recipientsBlockingSender(db as never, "sender", ["sender", "r1", "r2"])).toEqual([
      "r1",
    ]);
    expect(db.userConnection.findMany.mock.calls[0]![0].where).toEqual({
      userId: { in: ["r1", "r2"] },
      connectionType: "blocked",
      OR: [{ targetUserId: { in: ["sender", "db_sender"] } }, { targetCountryId: "c_sender" }],
    });
  });
});

describe("messaging refuses senders the recipient blocked", () => {
  function service(db: ReturnType<typeof createMockPrisma>) {
    return createMessagingService({
      db: db as never,
      notifications: { createNotification: jest.fn() } as never,
      websocket: { broadcastToUsers: jest.fn() } as never,
    });
  }

  it("createConversation throws MessagingBlockedError", async () => {
    const db = createMockPrisma();
    db.userConnection.findMany.mockResolvedValue([{ userId: "r1" }]);
    await expect(
      service(db).createConversation("sender", { participantIds: ["r1"] } as never)
    ).rejects.toMatchObject({ name: "MessagingBlockedError" });
    expect(db.thinkshareConversation.create).not.toHaveBeenCalled();
  });

  it("sendMessage in a direct conversation throws MessagingBlockedError", async () => {
    const db = createMockPrisma();
    db.thinkshareConversation.findFirst.mockResolvedValue({ id: "c1", type: "direct" });
    db.conversationParticipant.findFirst.mockResolvedValue({ id: "p1", conversation: {} });
    db.conversationParticipant.findMany.mockResolvedValue([{ userId: "r1" }]);
    db.userConnection.findMany.mockResolvedValue([{ userId: "r1" }]);
    await expect(
      service(db).sendMessage("sender", { conversationId: "c1", content: "hi" } as never)
    ).rejects.toMatchObject({ name: "MessagingBlockedError" });
    expect(db.thinkshareMessage.create).not.toHaveBeenCalled();
  });

  it("sendMessage still goes through when nobody blocked the sender", async () => {
    const db = createMockPrisma();
    db.thinkshareConversation.findFirst.mockResolvedValue({ id: "c1", type: "direct" });
    db.conversationParticipant.findFirst.mockResolvedValue({ id: "p1", conversation: {} });
    db.thinkshareMessage.create.mockResolvedValue({ id: "m1" });
    await service(db).sendMessage("sender", { conversationId: "c1", content: "hi" } as never);
    expect(db.thinkshareMessage.create).toHaveBeenCalled();
  });
});

describe("blockedUserClerkIds", () => {
  it("is empty for anonymous viewers without touching the database", async () => {
    const db = createMockPrisma();
    expect(await blockedUserClerkIds(db as never, null)).toEqual([]);
    expect(db.userConnection.findMany).not.toHaveBeenCalled();
  });

  it("resolves blocked accounts and nations (not muted ones) to Clerk ids", async () => {
    const db = createMockPrisma();
    db.userConnection.findMany.mockResolvedValue([
      { targetUserId: "db_b", targetCountryId: null },
      { targetUserId: null, targetCountryId: "country_x" },
    ]);
    db.user.findMany.mockResolvedValue([
      { clerkUserId: "clerk_b" },
      { clerkUserId: "clerk_x" },
      { clerkUserId: "viewer" },
    ]);

    expect(await blockedUserClerkIds(db as never, "viewer")).toEqual([
      "db_b",
      "clerk_b",
      "clerk_x",
    ]);
    expect(db.userConnection.findMany.mock.calls[0]![0].where).toEqual({
      userId: "viewer",
      connectionType: "blocked",
    });
    expect(db.user.findMany.mock.calls[0]![0].where).toEqual({
      OR: [
        { id: { in: ["db_b"] } },
        { clerkUserId: { in: ["db_b"] } },
        { countryId: { in: ["country_x"] } },
      ],
    });
  });
});

describe("group conversations hide blocked accounts from the viewer", () => {
  function service(db: ReturnType<typeof createMockPrisma>) {
    const notifications = { create: jest.fn().mockResolvedValue("n1") };
    const websocket = { broadcastToUsers: jest.fn() };
    const svc = createMessagingService({
      db: db as never,
      notifications: notifications as never,
      websocket: websocket as never,
    });
    return { svc, notifications, websocket };
  }

  function readDb(type: string) {
    const db = createMockPrisma();
    db.thinkshareConversation.findFirst.mockResolvedValue({ id: "c1", type, source: "thinkshare" });
    db.conversationParticipant.findFirst.mockResolvedValue({ id: "p1" });
    db.userConnection.findMany.mockResolvedValue([
      { targetUserId: "clerk_b", targetCountryId: null },
    ]);
    db.user.findMany.mockResolvedValue([{ clerkUserId: "clerk_b" }]);
    db.thinkshareMessage.findMany.mockResolvedValue([]);
    return db;
  }

  it("leaves blocked senders' messages out of a group conversation read", async () => {
    const db = readDb("group");
    await service(db).svc.getConversationMessages("viewer", { conversationId: "c1" } as never);
    expect(db.thinkshareMessage.findMany.mock.calls[0]![0].where).toEqual({
      conversationId: "c1",
      userId: { notIn: ["clerk_b"] },
    });
  });

  it("does not filter a direct conversation read", async () => {
    const db = readDb("direct");
    await service(db).svc.getConversationMessages("viewer", { conversationId: "c1" } as never);
    expect(db.thinkshareMessage.findMany.mock.calls[0]![0].where).toEqual({
      conversationId: "c1",
    });
    expect(db.userConnection.findMany).not.toHaveBeenCalled();
  });

  it("lets a blocked member post to the group but does not notify or push to the blocker", async () => {
    const db = createMockPrisma();
    db.thinkshareConversation.findFirst.mockResolvedValue({ id: "c1", type: "group" });
    db.conversationParticipant.findFirst.mockResolvedValue({ id: "p1", conversation: {} });
    db.conversationParticipant.findMany.mockResolvedValue([{ userId: "r1" }, { userId: "r2" }]);
    db.userConnection.findMany.mockResolvedValue([{ userId: "r1" }]);
    db.thinkshareMessage.create.mockResolvedValue({ id: "m1" });
    const { svc, notifications, websocket } = service(db);

    await svc.sendMessage("sender", { conversationId: "c1", content: "hi" } as never);

    expect(db.thinkshareMessage.create).toHaveBeenCalled();
    expect(notifications.create.mock.calls.map((c: any[]) => c[0].userId)).toEqual(["r2"]);
    expect(websocket.broadcastToUsers.mock.calls[0]![0]).toEqual(["r2"]);
  });
});
