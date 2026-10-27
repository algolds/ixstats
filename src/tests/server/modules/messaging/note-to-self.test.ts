/** @jest-environment node */
/**
 * "Message myself": a conversation whose only participant is the creator. It is created once and
 * reopened after that, shows in the inbox under its own name, takes messages, and notifies nobody.
 */
jest.mock("~/lib/notifications/api", () => ({
  notificationAPI: { create: jest.fn().mockResolvedValue("n") },
}));

import { createMessagingService } from "~/server/modules/messaging";
import { createMemoryPrisma, type MemoryPrisma } from "~/tests/helpers/memory-prisma";

const ANA = "ana-clerk";
const BEN = "ben-clerk";

let db: MemoryPrisma;
let notifications: { create: jest.Mock };
let websocket: { broadcastToUsers: jest.Mock; evictFromRoom: jest.Mock };

function service() {
  notifications = { create: jest.fn().mockResolvedValue("n") };
  websocket = { broadcastToUsers: jest.fn(), evictFromRoom: jest.fn() };
  return createMessagingService({
    db: db as never,
    notifications: notifications as never,
    websocket: websocket as never,
  });
}

beforeEach(async () => {
  jest.spyOn(console, "log").mockImplementation(() => undefined);
  db = createMemoryPrisma();
  for (const id of ["ana", "ben"]) {
    await db.user.create({ data: { id, clerkUserId: `${id}-clerk`, lastSeenAt: new Date() } });
  }
});
afterEach(() => jest.restoreAllMocks());

describe("message myself", () => {
  it("creates a conversation with only the creator, and reopens it next time", async () => {
    const svc = service();
    const first = await svc.createConversation(ANA, { participantIds: [ANA] } as never);
    expect(first.type).toBe("direct");
    expect(first.name).toBe("Notes to self");
    expect(first.participants.map((p: { userId: string }) => p.userId)).toEqual([ANA]);

    const again = await svc.createConversation(ANA, { participantIds: [ANA] } as never);
    expect(again.id).toBe(first.id);
  });

  it("is not confused with a direct conversation with someone else", async () => {
    const svc = service();
    const withBen = await svc.createConversation(ANA, { participantIds: [BEN] } as never);
    const notes = await svc.createConversation(ANA, { participantIds: [ANA] } as never);
    expect(notes.id).not.toBe(withBen.id);
  });

  it("lists in the inbox, takes messages and notifies nobody", async () => {
    const svc = service();
    const { id } = await svc.createConversation(ANA, { participantIds: [ANA] } as never);
    await svc.sendMessage(ANA, { conversationId: id, content: "Remember the budget" } as never);

    const { conversations } = await svc.getConversationsByFolder(ANA, { folder: "inbox" } as never);
    const notes = conversations.find((c: { id: string }) => c.id === id);
    expect(notes?.name).toBe("Notes to self");
    expect(notes?.otherParticipants).toEqual([]);
    expect(notes?.lastMessage?.content).toBe("Remember the budget");
    expect(notifications.create).not.toHaveBeenCalled();
  });
});
