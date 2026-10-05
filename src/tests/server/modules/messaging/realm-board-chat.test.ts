/**
 * A realm board mute or ban covers the board's chat: a restricted nation owner can't send messages to the
 * board's ThinkShare conversation. Other conversations are not checked (no realm-board lookups at all).
 */
import { createMessagingService } from "~/server/modules/messaging";

jest.mock("~/lib/notifications/api", () => ({
  notificationAPI: { create: jest.fn().mockResolvedValue({ success: true }) },
}));

const BOARD_CONV = { id: "conv_board", type: "group", source: "thinktank", sourceId: "board1" };

function makeDb(conv: Record<string, unknown>, restriction: Record<string, unknown> | null) {
  const db: any = {
    $transaction: jest.fn().mockImplementation((cb: any) => cb(db)),
    thinkshareConversation: {
      findFirst: jest.fn().mockResolvedValue(conv),
      findUnique: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({}),
    },
    conversationParticipant: {
      findFirst: jest.fn().mockResolvedValue({ id: "p1", conversation: conv }),
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    thinkshareMessage: {
      create: jest.fn().mockResolvedValue({ id: "m1" }),
      count: jest.fn().mockResolvedValue(0),
    },
    thinktankGroup: { findFirst: jest.fn().mockResolvedValue(null) },
    realmBoard: {
      findUnique: jest
        .fn()
        .mockImplementation(async ({ where }: any) =>
          where.groupId === "board1" ? { realmId: "eurth" } : null
        ),
    },
    realm: { findUnique: jest.fn().mockResolvedValue({ ownerId: "clerk_founder" }) },
    user: {
      findUnique: jest.fn().mockResolvedValue({ id: "u1", clerkUserId: "clerk_u1", role: null }),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    country: { findMany: jest.fn().mockResolvedValue([{ id: "c1" }]) },
    realmOfficer: { findMany: jest.fn().mockResolvedValue([]) },
    realmBoardBan: {
      findMany: jest
        .fn()
        .mockResolvedValue(restriction ? [{ countryId: "c1", until: null, ...restriction }] : []),
    },
    userConnection: { findMany: jest.fn().mockResolvedValue([]) },
  };
  return db;
}

describe("realm board chat follows board restrictions", () => {
  it.each([
    ["mute", /muted on this board/],
    ["ban", /banned from this board/],
  ])("refuses a %sd nation owner's message, with the reason", async (kind, message) => {
    const db = makeDb(BOARD_CONV, { kind, reason: "Spam" });
    const service = createMessagingService({ db });
    await expect(
      service.sendMessage("clerk_u1", { conversationId: "conv_board", content: "hi" })
    ).rejects.toThrow(message);
    expect(db.thinkshareMessage.create).not.toHaveBeenCalled();
  });

  it("lets an unrestricted member chat", async () => {
    const db = makeDb(BOARD_CONV, null);
    const service = createMessagingService({ db });
    await service.sendMessage("clerk_u1", { conversationId: "conv_board", content: "hi" });
    expect(db.thinkshareMessage.create).toHaveBeenCalled();
  });

  it("does not look up realm boards for other conversations", async () => {
    const db = makeDb({ id: "conv_dm", type: "group", source: "thinkshare" }, { kind: "mute" });
    const service = createMessagingService({ db });
    await service.sendMessage("clerk_u1", { conversationId: "conv_dm", content: "hi" });
    expect(db.realmBoard.findUnique).not.toHaveBeenCalled();
    expect(db.thinkshareMessage.create).toHaveBeenCalled();
  });

  it("an ordinary ThinkTank chat costs one board lookup and is not restricted", async () => {
    const conv = { id: "conv_tt", type: "group", source: "thinktank", sourceId: "group9" };
    const db = makeDb(conv, { kind: "ban" });
    const service = createMessagingService({ db });
    await service.sendMessage("clerk_u1", { conversationId: "conv_tt", content: "hi" });
    expect(db.realmBoard.findUnique).toHaveBeenCalledTimes(1);
    expect(db.realmBoardBan.findMany).not.toHaveBeenCalled();
    expect(db.thinkshareMessage.create).toHaveBeenCalled();
  });
});
