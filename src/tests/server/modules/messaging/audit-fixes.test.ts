/** @jest-environment node */
/**
 * The messages audit fixes, end to end on the memory database:
 * - reactions live in the message's own JSON column: per user, idempotent, counted for the viewer;
 * - lists page by the last row kept, so no row is skipped even when timestamps tie;
 * - a user cannot start a conversation in a server channel, an official one, or a classified one without a nation;
 * - a pending recipient accepts before taking part; only a group's creator or admins add people, and a person added
 *   reads from the day they joined; a read-only conversation takes no sends, edits or reactions;
 * - markMessagesAsRead cannot name another conversation's messages; leaving ends a member's edits;
 * - realtime events carry the recipients (the sender included), also for edits and deletes;
 * - a read of someone else's conversation answers null and creates nothing;
 * - mute and archive are kept on the participant row.
 */
jest.mock("~/lib/notifications/api", () => ({
  notificationAPI: { create: jest.fn().mockResolvedValue("n") },
}));

import { createMessagingService, reactionsForViewer } from "~/server/modules/messaging";
import { createMemoryPrisma, type MemoryPrisma } from "~/tests/helpers/memory-prisma";
import { answerMessagingSql } from "~/tests/helpers/messaging-sql";
import { addNation, addRealm } from "~/tests/helpers/forum-world";

const clerk = (id: string) => `${id}-clerk`;
const ANA = clerk("ana");
const BEN = clerk("ben");
const CY = clerk("cy");
const DEE = clerk("dee");
const STRANGER = clerk("zed");

let db: MemoryPrisma;
let websocket: { broadcastMessage: jest.Mock; evictFromRoom: jest.Mock };

function service() {
  websocket = { broadcastMessage: jest.fn(), evictFromRoom: jest.fn() };
  return createMessagingService({
    db: db as never,
    notifications: { create: jest.fn().mockResolvedValue("n") } as never,
    websocket: websocket as never,
  });
}

type Service = ReturnType<typeof service>;

beforeEach(async () => {
  jest.spyOn(console, "log").mockImplementation(() => undefined);
  db = answerMessagingSql(createMemoryPrisma());
  for (const id of ["ana", "ben", "cy", "dee", "zed"]) {
    await db.user.create({ data: { id, clerkUserId: clerk(id), lastSeenAt: new Date() } });
  }
});
afterEach(() => jest.restoreAllMocks());

/** Ana's group with Ben and Cy (Ana created it, so she manages it). */
const group = (svc: Service) => svc.createConversation(ANA, { participantIds: [BEN, CY] } as never);

/** Rewinds everyone's last read so a message sent in the same millisecond still counts as unread. */
const unreadAll = () =>
  db.conversationParticipant.updateMany({ data: { lastReadAt: new Date(0) } });

const reactionsOf = async (messageId: string) =>
  reactionsForViewer((await db.thinkshareMessage.findUniqueOrThrow({ where: { id: messageId } })).reactions, ANA);

describe("reactions", () => {
  it("adds once per user, removes idempotently, and counts per emoji for the viewer", async () => {
    const svc = service();
    const { id } = await group(svc);
    const msg = await svc.sendMessage(ANA, { conversationId: id, content: "hello" } as never);

    await svc.addReaction(ANA, { messageId: msg.id, emoji: "👍" });
    await svc.addReaction(ANA, { messageId: msg.id, emoji: "👍" });
    await svc.addReaction(BEN, { messageId: msg.id, emoji: "👍" });
    await svc.addReaction(BEN, { messageId: msg.id, emoji: "🔥" });
    expect(await reactionsOf(msg.id)).toEqual({
      reactions: { "👍": 2, "🔥": 1 },
      myReactions: ["👍"],
    });

    await svc.removeReaction(ANA, { messageId: msg.id, emoji: "👍" });
    await svc.removeReaction(ANA, { messageId: msg.id, emoji: "👍" });
    await svc.removeReaction(ANA, { messageId: msg.id, emoji: "🎉" });
    expect(await reactionsOf(msg.id)).toEqual({
      reactions: { "👍": 1, "🔥": 1 },
      myReactions: [],
    });

    await svc.removeReaction(BEN, { messageId: msg.id, emoji: "👍" });
    await svc.removeReaction(BEN, { messageId: msg.id, emoji: "🔥" });
    const stored = await db.thinkshareMessage.findUniqueOrThrow({ where: { id: msg.id } });
    expect(stored.reactions).toBeNull();
  });

  it("keeps both reactions when two people react at the same moment", async () => {
    const svc = service();
    const { id } = await group(svc);
    const msg = await svc.sendMessage(ANA, { conversationId: id, content: "hello" } as never);
    await Promise.all([
      svc.addReaction(ANA, { messageId: msg.id, emoji: "👍" }),
      svc.addReaction(BEN, { messageId: msg.id, emoji: "👍" }),
      svc.addReaction(CY, { messageId: msg.id, emoji: "👍" }),
    ]);
    expect((await reactionsOf(msg.id)).reactions).toEqual({ "👍": 3 });
  });

  it("refuses an outsider, a pending recipient, a deleted message and a read-only conversation", async () => {
    const svc = service();
    const { id } = await group(svc);
    const msg = await svc.sendMessage(ANA, { conversationId: id, content: "hello" } as never);

    await expect(
      svc.addReaction(STRANGER, { messageId: msg.id, emoji: "👍" })
    ).rejects.toMatchObject({ name: "MessagingForbiddenError" });

    await db.conversationParticipant.updateMany({
      where: { conversationId: id, userId: CY },
      data: { requestStatus: "pending" },
    });
    await expect(svc.addReaction(CY, { messageId: msg.id, emoji: "👍" })).rejects.toMatchObject({
      name: "MessagingBlockedError",
    });

    await svc.deleteMessage(ANA, { messageId: msg.id });
    await expect(svc.addReaction(BEN, { messageId: msg.id, emoji: "👍" })).rejects.toMatchObject({
      name: "MessagingForbiddenError",
    });

    const desk = await db.thinkshareConversation.create({
      data: { type: "system", source: "sports", participants: { create: [{ userId: ANA }] } },
    });
    const note = await db.thinkshareMessage.create({
      data: { conversationId: desk.id, userId: "system:sportsnews", content: "result" },
    });
    await expect(svc.addReaction(ANA, { messageId: note.id, emoji: "👍" })).rejects.toMatchObject({
      name: "MessagingBlockedError",
    });
  });
});

describe("pagination cursors", () => {
  it("pages through every message exactly once, even when timestamps tie", async () => {
    const svc = service();
    const { id } = await group(svc);
    // After everyone joined: a member reads only from the day they joined.
    const base = Date.now() + 60_000;
    for (let i = 0; i < 25; i++) {
      await db.thinkshareMessage.create({
        data: {
          id: `m${String(i).padStart(2, "0")}`,
          conversationId: id,
          userId: ANA,
          content: `message ${i}`,
          // Messages 10-14 share one instant: a timestamp-only cursor would drop some of them.
          ixTimeTimestamp: new Date(base + (i >= 10 && i < 15 ? 10 : i) * 1000),
        },
      });
    }

    const seen: string[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < 10; page++) {
      const result = await svc.getConversationMessages(ANA, {
        conversationId: id,
        limit: 10,
        cursor,
      });
      seen.push(...result.messages.map((m: { id: string }) => m.id));
      if (!result.nextCursor) break;
      cursor = result.nextCursor;
    }
    expect(seen).toHaveLength(25);
    expect(new Set(seen).size).toBe(25);
  });

  it("pages the conversation list the same way, without dropping the look-ahead row", async () => {
    const svc = service();
    const base = new Date("2026-01-01T00:00:00Z").getTime();
    const ids: string[] = [];
    for (let i = 0; i < 7; i++) {
      const c = await db.thinkshareConversation.create({
        data: {
          type: "group",
          source: "thinkshare",
          lastActivity: new Date(base + i * 1000),
          participants: { create: [{ userId: ANA }, { userId: BEN }, { userId: CY }] },
        },
      });
      ids.push(c.id);
    }

    const seen: string[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < 10; page++) {
      const result = await svc.getConversationsByFolder(ANA, {
        folder: "inbox",
        limit: 3,
        cursor,
      });
      seen.push(...result.conversations.map((c: { id: string }) => c.id));
      if (!result.nextCursor) break;
      cursor = result.nextCursor;
    }
    expect(seen.sort()).toEqual([...ids].sort());
  });
});

describe("starting a conversation", () => {
  it.each(["system", "wiki", "forum", "sports", "lorebot", "thinktank"])(
    "refuses a user starting one in the %s channel",
    async (source) => {
      await expect(
        service().createConversation(ANA, { participantIds: [BEN], source } as never)
      ).rejects.toMatchObject({ name: "MessagingForbiddenError" });
      expect(await db.thinkshareConversation.count({})).toBe(0);
    }
  );

  it("lets only an administrator start an official conversation", async () => {
    const svc = service();
    await expect(
      svc.createConversation(ANA, { participantIds: [BEN], conversationType: "official" } as never)
    ).rejects.toMatchObject({ name: "MessagingForbiddenError" });
    const made = await svc.createConversation(ANA, {
      participantIds: [BEN],
      conversationType: "official",
      actorIsAdmin: true,
    } as never);
    expect(made.conversationType).toBe("official");
  });

  it("classifies a conversation above PUBLIC only for a nation's owner", async () => {
    const svc = service();
    const input = {
      participantIds: [BEN],
      source: "diplomatic",
      conversationType: "diplomatic",
      diplomaticClassification: "TOP_SECRET",
    } as never;
    await expect(svc.createConversation(ANA, input)).rejects.toMatchObject({
      name: "MessagingForbiddenError",
    });

    await addRealm(db, { id: "realm", name: "Realm", ownerClerkId: BEN });
    await addNation(db, "ruritania", "realm", "ana");
    const made = await svc.createConversation(ANA, input);
    expect(made.diplomaticClassification).toBe("TOP_SECRET");
  });

  it("reopens the one direct conversation of two people, and never re-asks one who declined", async () => {
    const svc = service();
    const first = await svc.createConversation(ANA, { participantIds: [BEN] } as never);
    const again = await svc.createConversation(ANA, { participantIds: [BEN] } as never);
    const fromBen = await svc.createConversation(BEN, { participantIds: [ANA] } as never);
    expect(again.id).toBe(first.id);
    expect(fromBen.id).toBe(first.id);
    expect(await db.thinkshareConversation.count({})).toBe(1);

    await db.conversationParticipant.updateMany({
      where: { conversationId: first.id, userId: BEN },
      data: { requestStatus: "declined", isActive: false },
    });
    await expect(
      svc.createConversation(ANA, { participantIds: [BEN] } as never)
    ).rejects.toMatchObject({ name: "MessagingBlockedError" });
  });

  it("brings a person who left back into their own direct conversation", async () => {
    const svc = service();
    const first = await svc.createConversation(ANA, { participantIds: [BEN] } as never);
    await svc.leaveConversation(ANA, { conversationId: first.id });
    const again = await svc.createConversation(ANA, { participantIds: [BEN] } as never);
    expect(again.id).toBe(first.id);
    expect(
      await db.conversationParticipant.findFirst({
        where: { conversationId: first.id, userId: ANA },
      })
    ).toMatchObject({ isActive: true });
  });
});

describe("taking part in a conversation", () => {
  it("makes a recipient accept a message request before sending, reacting or adding people", async () => {
    const svc = service();
    const { id } = await group(svc);
    await db.conversationParticipant.updateMany({
      where: { conversationId: id, userId: CY },
      data: { requestStatus: "pending" },
    });
    await expect(
      svc.sendMessage(CY, { conversationId: id, content: "hi" } as never)
    ).rejects.toMatchObject({ name: "MessagingBlockedError" });
    await expect(
      svc.addParticipant(CY, { conversationId: id, targetUserId: DEE })
    ).rejects.toMatchObject({ name: "MessagingBlockedError" });

    await svc.respondToRequest(CY, { conversationId: id, accept: true });
    await expect(
      svc.sendMessage(CY, { conversationId: id, content: "hi" } as never)
    ).resolves.toMatchObject({ userId: CY });
  });

  it("lets only the creator or an admin add people, and a newcomer reads from the day they joined", async () => {
    const svc = service();
    const { id } = await group(svc);
    await svc.sendMessage(ANA, { conversationId: id, content: "before dee" } as never);

    await expect(
      svc.addParticipant(BEN, { conversationId: id, targetUserId: DEE })
    ).rejects.toMatchObject({ name: "MessagingForbiddenError" });
    await svc.addParticipant(ANA, { conversationId: id, targetUserId: DEE });

    // Dee joined after "before dee" was sent
    await db.conversationParticipant.updateMany({
      where: { conversationId: id, userId: DEE },
      data: { joinedAt: new Date(Date.now() + 1000) },
    });
    const seen = await svc.getConversationMessages(DEE, { conversationId: id });
    expect(seen.messages).toEqual([]);
    const ana = await svc.getConversationMessages(ANA, { conversationId: id });
    expect(ana.messages).toHaveLength(1);
  });

  it("refuses sends, edits and deletes in a read-only conversation", async () => {
    const svc = service();
    for (const source of ["system", "wiki", "sports", "lorebot", "forum"]) {
      const conv = await db.thinkshareConversation.create({
        data: { type: "direct", source, participants: { create: [{ userId: ANA }] } },
      });
      const msg = await db.thinkshareMessage.create({
        data: { conversationId: conv.id, userId: ANA, content: "old", source },
      });
      await expect(
        svc.sendMessage(ANA, { conversationId: conv.id, content: "new" } as never)
      ).rejects.toMatchObject({ name: "MessagingBlockedError" });
      await expect(
        svc.editMessage(ANA, { messageId: msg.id, content: "new" })
      ).rejects.toMatchObject({ name: "MessagingBlockedError" });
      await expect(svc.deleteMessage(ANA, { messageId: msg.id })).rejects.toMatchObject({
        name: "MessagingBlockedError",
      });
    }
  });

  it("stops a member who left from editing or deleting what they sent", async () => {
    const svc = service();
    const { id } = await group(svc);
    const msg = await svc.sendMessage(BEN, { conversationId: id, content: "mine" } as never);
    await svc.leaveConversation(BEN, { conversationId: id });
    await expect(svc.editMessage(BEN, { messageId: msg.id, content: "x" })).rejects.toMatchObject({
      name: "MessagingForbiddenError",
    });
    await expect(svc.deleteMessage(BEN, { messageId: msg.id })).rejects.toMatchObject({
      name: "MessagingForbiddenError",
    });
  });

  it("keeps the message type, mentions (members only) and, in a diplomatic thread, classification and priority", async () => {
    const svc = service();
    const { id } = await group(svc);
    const plain = await svc.sendMessage(ANA, {
      conversationId: id,
      content: "hi",
      messageType: "image",
      mentions: [BEN, STRANGER, ANA],
      classification: "TOP_SECRET",
      priority: "URGENT",
    } as never);
    expect(plain.messageType).toBe("image");
    expect(JSON.parse(plain.mentions ?? "[]")).toEqual([BEN]);
    expect(plain.classification).toBeNull();
    expect(plain.priority).toBeNull();

    const diplomatic = await db.thinkshareConversation.create({
      data: {
        type: "group",
        source: "diplomatic",
        conversationType: "diplomatic",
        participants: { create: [{ userId: ANA }, { userId: BEN }] },
      },
    });
    const sent = await svc.sendMessage(ANA, {
      conversationId: diplomatic.id,
      content: "note",
      classification: "SECRET",
      priority: "HIGH",
    } as never);
    expect(sent).toMatchObject({ classification: "SECRET", priority: "HIGH" });
  });

  it("returns a reply with its quoted message so the sender can be named", async () => {
    const svc = service();
    const { id } = await group(svc);
    const first = await svc.sendMessage(ANA, { conversationId: id, content: "first" } as never);
    await svc.sendMessage(BEN, {
      conversationId: id,
      content: "second",
      replyToId: first.id,
    } as never);
    const { messages, accountMap } = await svc.getConversationMessages(ANA, { conversationId: id });
    const reply = messages.find((m: { content: string }) => m.content === "second");
    expect(reply?.replyTo?.userId).toBe(ANA);
    expect(accountMap.has(ANA)).toBe(true);
  });
});

describe("marking messages read", () => {
  it("refuses ids from another conversation and marks nothing read", async () => {
    const svc = service();
    const { id } = await group(svc);
    const other = await svc.createConversation(DEE, { participantIds: [STRANGER] } as never);
    const foreign = await svc.sendMessage(DEE, { conversationId: other.id, content: "x" } as never);
    const before = await db.conversationParticipant.findFirstOrThrow({
      where: { conversationId: id, userId: ANA },
    });

    await expect(
      svc.markMessagesAsRead(ANA, { conversationId: id, messageIds: [foreign.id] })
    ).rejects.toMatchObject({ name: "MessagingValidationError" });
    const after = await db.conversationParticipant.findFirstOrThrow({
      where: { conversationId: id, userId: ANA },
    });
    expect(after.lastReadAt).toEqual(before.lastReadAt);
    expect(await db.messageReadReceipt.count({})).toBe(0);
  });

  it("refuses a list over the cap", async () => {
    const svc = service();
    const { id } = await group(svc);
    await expect(
      svc.markMessagesAsRead(ANA, {
        conversationId: id,
        messageIds: Array.from({ length: 201 }, (_, i) => `m${i}`),
      })
    ).rejects.toMatchObject({ name: "MessagingValidationError" });
  });

  it("marks the caller's own messages of the conversation read and writes no receipt rows", async () => {
    const svc = service();
    const { id } = await group(svc);
    const msg = await svc.sendMessage(BEN, { conversationId: id, content: "x" } as never);
    await expect(
      svc.markMessagesAsRead(ANA, { conversationId: id, messageIds: [msg.id] })
    ).resolves.toEqual({ success: true });
    expect(await db.messageReadReceipt.count({})).toBe(0);
  });
});

describe("realtime events", () => {
  it("name the recipients, the sender included, for a send, an edit and a delete", async () => {
    const svc = service();
    const { id } = await group(svc);
    await db.conversationParticipant.updateMany({
      where: { conversationId: id, userId: CY },
      data: { requestStatus: "pending" },
    });

    const msg = await svc.sendMessage(ANA, { conversationId: id, content: "hi" } as never);
    await svc.editMessage(ANA, { messageId: msg.id, content: "hi again" });
    await svc.deleteMessage(ANA, { messageId: msg.id });

    const events = websocket.broadcastMessage.mock.calls.map(([event]) => event);
    expect(events.map((e) => e.type)).toEqual(["message:new", "message:updated", "message:deleted"]);
    for (const event of events) {
      expect(event).toMatchObject({ conversationId: id, messageId: msg.id, accountId: ANA });
      // Cy holds the group as a request, so no event reaches them
      expect([...event.recipientIds].sort()).toEqual([ANA, BEN]);
    }
    expect(events[1].content).toBe("hi again");
  });

  it("go to the recipient and the sender for an administrator's message", async () => {
    const svc = service();
    await svc.sendAdminMessage(ANA, { targetUserId: "ben", content: "Notice" } as never);
    const [event] = websocket.broadcastMessage.mock.calls[0]!;
    expect(event).toMatchObject({ type: "message:new", accountId: ANA });
    expect([...event.recipientIds].sort()).toEqual([ANA, BEN]);
  });
});

describe("administrator messages", () => {
  it("does not reuse a conversation holding only one of the two people", async () => {
    const svc = service();
    const solo = await db.thinkshareConversation.create({
      data: { type: "direct", source: "system", participants: { create: [{ userId: ANA }] } },
    });
    const sent = await svc.sendAdminMessage(ANA, { targetUserId: BEN, content: "Notice" } as never);
    expect(sent.conversationId).not.toBe(solo.id);

    const again = await svc.sendAdminMessage(ANA, { targetUserId: BEN, content: "Again" } as never);
    expect(again.conversationId).toBe(sent.conversationId);
  });
});

describe("reading a conversation", () => {
  it("answers null for a stranger, a missing id and a wiki source id alike, writing nothing", async () => {
    const svc = service();
    const { id } = await group(svc);
    await db.thinkshareConversation.create({
      data: {
        type: "direct",
        source: "wiki",
        sourceId: "wiki-talk:Ana",
        participants: { create: [{ userId: ANA }] },
      },
    });
    const conversations = await db.thinkshareConversation.count({});

    await expect(svc.getConversation(STRANGER, id)).resolves.toBeNull();
    await expect(svc.getConversation(STRANGER, "wiki-talk:Ana")).resolves.toBeNull();
    await expect(svc.getConversation(STRANGER, "no-such-id")).resolves.toBeNull();
    expect(await db.thinkshareConversation.count({})).toBe(conversations);
  });

  it("does not build a ThinkTank's chat for someone outside the group", async () => {
    const svc = service();
    await db.thinktankGroup.create({
      data: { id: "tank", name: "Tank", type: "group", createdBy: ANA },
    });
    await expect(svc.getConversation(STRANGER, "tank")).resolves.toBeNull();
    expect(await db.thinkshareConversation.count({})).toBe(0);
  });

  it("counts the unread since the caller last read", async () => {
    const svc = service();
    const { id } = await group(svc);
    await unreadAll();
    await svc.sendMessage(BEN, { conversationId: id, content: "1" } as never);
    expect((await svc.getConversation(ANA, id))?.unreadCount).toBe(1);
    await svc.markMessagesAsRead(ANA, { conversationId: id });
    expect((await svc.getConversation(ANA, id))?.unreadCount).toBe(0);
  });
});

describe("folder counts", () => {
  it("leaves ThinkTank chats out of the inbox and gives one total with nothing counted twice", async () => {
    const svc = service();
    const { id } = await group(svc);
    await unreadAll();
    await svc.sendMessage(BEN, { conversationId: id, content: "1" } as never);
    const tank = await db.thinkshareConversation.create({
      data: {
        type: "group",
        source: "thinktank",
        participants: { create: [{ userId: ANA }, { userId: BEN }] },
      },
    });
    await unreadAll();
    await db.thinkshareMessage.create({
      data: {
        conversationId: tank.id,
        userId: BEN,
        content: "t1",
        ixTimeTimestamp: new Date(Date.now() + 5000),
      },
    });
    await db.thinkshareMessage.create({
      data: {
        conversationId: tank.id,
        userId: BEN,
        content: "t2",
        ixTimeTimestamp: new Date(Date.now() + 6000),
      },
    });

    expect(await svc.getFolderCounts(ANA)).toMatchObject({
      inbox: 1,
      thinktank: 2,
      requests: 0,
      total: 3,
    });
  });
});

describe("mute and archive", () => {
  it("keeps them per participant, merged with other notification settings", async () => {
    const svc = service();
    const { id } = await group(svc);
    await db.conversationParticipant.updateMany({
      where: { conversationId: id, userId: ANA },
      data: { notificationSettings: JSON.stringify({ sound: "chime" }) },
    });

    expect(await svc.getConversationPreferences(ANA)).toEqual({ muted: [], archived: [] });
    await svc.setConversationPreferences(ANA, { conversationId: id, muted: true });
    await svc.setConversationPreferences(ANA, { conversationId: id, archived: true });
    expect(await svc.getConversationPreferences(ANA)).toEqual({ muted: [id], archived: [id] });
    expect(await svc.getConversationPreferences(BEN)).toEqual({ muted: [], archived: [] });

    await svc.setConversationPreferences(ANA, { conversationId: id, muted: false });
    expect(await svc.getConversationPreferences(ANA)).toEqual({ muted: [], archived: [id] });
    const stored = await db.conversationParticipant.findFirstOrThrow({
      where: { conversationId: id, userId: ANA },
    });
    expect(JSON.parse(stored.notificationSettings ?? "{}")).toMatchObject({ sound: "chime" });

    await expect(
      svc.setConversationPreferences(STRANGER, { conversationId: id, muted: true })
    ).rejects.toMatchObject({ name: "MessagingForbiddenError" });
  });

  it("does not notify a member who muted the conversation", async () => {
    const notifications = { create: jest.fn().mockResolvedValue("n") };
    const svc = createMessagingService({
      db: db as never,
      notifications: notifications as never,
      websocket: null,
    });
    const { id } = await group(svc);
    await svc.setConversationPreferences(BEN, { conversationId: id, muted: true });
    await svc.sendMessage(ANA, { conversationId: id, content: "hi" } as never);
    expect(notifications.create.mock.calls.map(([n]) => n.userId)).toEqual([CY]);
    expect(notifications.create.mock.calls[0]![0].href).toBe(`/messages?conversation=${id}`);
  });
});

describe("clearing system notifications", () => {
  it("deletes the caller's system notices and nothing else", async () => {
    const svc = service();
    await db.notification.create({ data: { userId: ANA, title: "a", category: "system" } });
    await db.notification.create({ data: { userId: ANA, title: "b", category: "sports" } });
    await db.notification.create({ data: { userId: BEN, title: "c", category: "system" } });
    await svc.clearAllSystemNotifications(ANA);
    const left = await db.notification.findMany({ select: { title: true } as never });
    expect((left as { title: string }[]).map((n) => n.title).sort()).toEqual(["b", "c"]);
  });
});
