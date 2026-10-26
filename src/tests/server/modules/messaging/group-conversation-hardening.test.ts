/** @jest-environment node */
/**
 * Group conversations, hardened:
 * - adding someone runs createConversation's checks (blocks, the direct-message audience), a member who left
 *   comes back only as a message request, one who declined is not asked again, and a group holds at most
 *   MAX_GROUP_PARTICIPANTS;
 * - a reply quotes a live message of the same conversation;
 * - a member who declined is never notified of the group's messages;
 * - a sender's flood prunes only their own messages, never the rest of the group's history;
 * - message bodies are bounded and unsafe HTML is refused, and a new group's size is capped at the router.
 */
jest.mock("~/lib/notifications/api", () => ({
  notificationAPI: { create: jest.fn().mockResolvedValue("n") },
}));

import { createCallerFactory } from "~/server/api/trpc";
import { messagesConversationsRouter } from "~/server/api/routers/messages/conversations";
import { messagesMessagingRouter } from "~/server/api/routers/messages/messaging";
import {
  createMessagingService,
  MAX_GROUP_PARTICIPANTS,
  MAX_MESSAGE_LENGTH,
} from "~/server/modules/messaging";
import { createMemoryPrisma, type MemoryPrisma } from "~/tests/helpers/memory-prisma";
import { createMockPrisma } from "~/tests/helpers/mock-db";
import { privacyConfigRow } from "~/tests/helpers/privacy-config-fake";
import { createMockCallerContext } from "~/tests/helpers/router-context";

const PEOPLE = ["ana", "ben", "cy", "dee", "eve"] as const;
const clerk = (id: string) => `${id}-clerk`;
const ANA = clerk("ana");
const BEN = clerk("ben");
const CY = clerk("cy");
const DEE = clerk("dee");
const EVE = clerk("eve");

let db: MemoryPrisma;
let notifications: { create: jest.Mock };

function service() {
  notifications = { create: jest.fn().mockResolvedValue("n") };
  return createMessagingService({
    db: db as never,
    notifications: notifications as never,
    websocket: { broadcastToUsers: jest.fn() } as never,
  });
}

/** Lets the fire-and-forget prune after a send finish. */
async function settle() {
  for (let i = 0; i < 20; i++) await new Promise((resolve) => setImmediate(resolve));
}

beforeEach(async () => {
  jest.spyOn(console, "log").mockImplementation(() => undefined);
  db = createMemoryPrisma();
  for (const id of PEOPLE) {
    await db.user.create({ data: { id, clerkUserId: clerk(id), lastSeenAt: new Date() } });
  }
});
afterEach(() => jest.restoreAllMocks());

/** Ana's group with Ben and Cy. */
async function group(svc: ReturnType<typeof service>) {
  return svc.createConversation(ANA, { participantIds: [BEN, CY] } as never);
}

const row = (conversationId: string, userId: string) =>
  db.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
  });

describe("messages.addParticipant", () => {
  it("refuses someone who blocked the adder", async () => {
    const svc = service();
    const { id } = await group(svc);
    await db.userConnection.create({
      data: { userId: DEE, targetUserId: "ana", connectionType: "blocked" },
    });
    await expect(
      svc.addParticipant(ANA, { conversationId: id, targetUserId: DEE })
    ).rejects.toMatchObject({ name: "MessagingBlockedError" });
    expect(await row(id, DEE)).toBeNull();
  });

  it("refuses someone who takes direct messages from nobody, and asks one who filters requests", async () => {
    const svc = service();
    const { id } = await group(svc);
    await db.userConnection.create({ data: privacyConfigRow(DEE, { directMessages: "nobody" }) });
    await db.userConnection.create({
      data: privacyConfigRow(EVE, { directMessages: "followers" }),
    });

    await expect(
      svc.addParticipant(ANA, { conversationId: id, targetUserId: DEE })
    ).rejects.toMatchObject({ name: "MessagingBlockedError" });
    await expect(
      svc.addParticipant(ANA, { conversationId: id, targetUserId: EVE })
    ).resolves.toEqual({ success: true, pending: true });
    expect(await row(id, EVE)).toMatchObject({ isActive: true, requestStatus: "pending" });

    await svc.sendMessage(ANA, { conversationId: id, content: "Welcome" } as never);
    const told = notifications.create.mock.calls.map(([n]) => n.userId).sort();
    expect(told).toEqual([BEN, CY]);
  });

  it("brings back a member who left only as a request, and never one who declined", async () => {
    const svc = service();
    const { id } = await group(svc);
    await svc.leaveConversation(CY, { conversationId: id });
    await expect(
      svc.addParticipant(BEN, { conversationId: id, targetUserId: CY })
    ).resolves.toEqual({ success: true, pending: true });
    expect(await row(id, CY)).toMatchObject({ isActive: true, requestStatus: "pending" });

    await svc.respondToRequest(CY, { conversationId: id, accept: false });
    await expect(
      svc.addParticipant(ANA, { conversationId: id, targetUserId: CY })
    ).rejects.toMatchObject({ name: "MessagingBlockedError" });
    expect(await row(id, CY)).toMatchObject({ isActive: false, requestStatus: "declined" });
  });

  it("adds someone open to messages as a plain member", async () => {
    const svc = service();
    const { id } = await group(svc);
    await expect(
      svc.addParticipant(ANA, { conversationId: id, targetUserId: DEE })
    ).resolves.toEqual({ success: true, pending: false });
    expect(await row(id, DEE)).toMatchObject({ isActive: true, requestStatus: "none" });
  });

  it("keeps a group within MAX_GROUP_PARTICIPANTS", async () => {
    const svc = service();
    const { id } = await group(svc);
    await db.conversationParticipant.createMany({
      data: Array.from({ length: MAX_GROUP_PARTICIPANTS - 3 }, (_, i) => ({
        conversationId: id,
        userId: `filler-${i}`,
      })),
    });
    await expect(
      svc.addParticipant(ANA, { conversationId: id, targetUserId: DEE })
    ).rejects.toMatchObject({ name: "MessagingValidationError" });
    await expect(
      svc.createConversation(ANA, {
        participantIds: Array.from({ length: MAX_GROUP_PARTICIPANTS }, (_, i) => `p-${i}`),
      } as never)
    ).rejects.toMatchObject({ name: "MessagingValidationError" });
  });
});

describe("sending to a group", () => {
  it("quotes only a live message of the same conversation", async () => {
    const svc = service();
    const { id } = await group(svc);
    const other = await svc.createConversation(ANA, { participantIds: [DEE] } as never);
    const elsewhere = await svc.sendMessage(DEE, {
      conversationId: other.id,
      content: "private to Ana and Dee",
    } as never);
    const here = await svc.sendMessage(BEN, { conversationId: id, content: "hi" } as never);

    await expect(
      svc.sendMessage(ANA, { conversationId: id, content: "re", replyToId: elsewhere.id } as never)
    ).rejects.toMatchObject({ name: "MessagingValidationError" });
    const reply = await svc.sendMessage(ANA, {
      conversationId: id,
      content: "re",
      replyToId: here.id,
    } as never);
    expect(reply.replyTo?.id).toBe(here.id);

    await svc.deleteMessage(BEN, { messageId: here.id });
    await expect(
      svc.sendMessage(ANA, { conversationId: id, content: "re", replyToId: here.id } as never)
    ).rejects.toMatchObject({ name: "MessagingValidationError" });
  });

  it("never notifies a member who declined", async () => {
    const svc = service();
    const { id } = await group(svc);
    await db.conversationParticipant.update({
      where: { conversationId_userId: { conversationId: id, userId: CY } },
      data: { requestStatus: "declined" },
    });
    await svc.sendMessage(ANA, { conversationId: id, content: "hello" } as never);
    expect(notifications.create.mock.calls.map(([n]) => n.userId)).toEqual([BEN]);
  });

  it("prunes a flooding sender's own messages, never the rest of the group's history", async () => {
    const svc = service();
    const { id } = await group(svc);
    const history = (userId: string, n: number, year: number) =>
      db.thinkshareMessage.createMany({
        data: Array.from({ length: n }, (_, i) => ({
          conversationId: id,
          userId,
          content: `${userId} ${i}`,
          ixTimeTimestamp: new Date(Date.UTC(year, 0, 1, 0, 0, i)),
        })),
      });
    // Ben's are the conversation's oldest: a per-conversation cap would evict them first.
    await history(BEN, 20, 2039);
    await history(ANA, 1000, 2040);

    await svc.sendMessage(ANA, { conversationId: id, content: "one more" } as never);
    await settle();

    expect(await db.thinkshareMessage.count({ where: { conversationId: id, userId: BEN } })).toBe(
      20
    );
    expect(await db.thinkshareMessage.count({ where: { conversationId: id, userId: ANA } })).toBe(
      1000
    );
  });
});

describe("the messages routers", () => {
  const ctx = () =>
    createMockCallerContext({
      db: createMockPrisma(),
      auth: { userId: ANA },
      user: { id: "ana", clerkUserId: ANA },
    });

  it.each([
    ["an over-long body", "x".repeat(MAX_MESSAGE_LENGTH + 1)],
    ["unsafe HTML", "<script>alert(1)</script>"],
  ])("refuse %s on send and edit", async (_case, content) => {
    const caller = createCallerFactory(messagesMessagingRouter)(ctx());
    await expect(caller.sendMessage({ conversationId: "c1", content })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await expect(caller.editMessage({ messageId: "m1", content })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("refuses a new group larger than MAX_GROUP_PARTICIPANTS", async () => {
    const caller = createCallerFactory(messagesConversationsRouter)(ctx());
    await expect(
      caller.createConversation({
        participantIds: Array.from({ length: MAX_GROUP_PARTICIPANTS }, (_, i) => `p-${i}`),
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
