/** @jest-environment node */
/** Card notices: sent in the cards or packs category, dropped for a card the player muted, never failing the caller. */
jest.mock("~/lib/notifications/api", () => ({ notificationAPI: { create: jest.fn() } }));

import { notificationAPI } from "~/lib/notifications/api";
import { isCardMuted, notifyCard, notifyCards, setCardMute } from "~/lib/cards/card-notify";

const create = jest.mocked(notificationAPI.create);

function makeDb(muted: boolean) {
  return {
    cardNotificationMute: {
      findUnique: jest.fn().mockResolvedValue(muted ? { userId: "u1" } : null),
      upsert: jest.fn().mockResolvedValue({}),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
}

let warn: jest.SpyInstance;

beforeEach(() => {
  create.mockReset().mockResolvedValue("n1");
  warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => warn.mockRestore());

describe("card notices", () => {
  it("sends in the cards category with the card in the metadata", async () => {
    const db = makeDb(false);
    await notifyCard(db as never, {
      userId: "u1",
      cardId: "card_1",
      title: "Your listing sold",
      message: "Aurelia sold for 500 IxC.",
    });
    expect(db.cardNotificationMute.findUnique).toHaveBeenCalledWith({
      where: { userId_cardId: { userId: "u1", cardId: "card_1" } },
      select: { userId: true },
    });
    expect(create).toHaveBeenCalledWith({
      userId: "u1",
      title: "Your listing sold",
      message: "Aurelia sold for 500 IxC.",
      type: "info",
      priority: "medium",
      category: "cards",
      source: "cards",
      href: null,
      metadata: { cardId: "card_1" },
    });
  });

  it("passes the notice's own type, priority, link and metadata through", async () => {
    await notifyCard(makeDb(false) as never, {
      userId: "u1",
      cardId: "card_1",
      title: "Outbid",
      message: "x",
      type: "warning",
      priority: "high",
      href: "/vault/cards/market?tab=selling",
      metadata: { auctionId: "a1", cardId: "other" },
    });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "warning",
        priority: "high",
        href: "/vault/cards/market?tab=selling",
        metadata: { auctionId: "a1", cardId: "card_1" },
      })
    );
  });

  it("drops a notice about a card the player muted", async () => {
    await notifyCard(makeDb(true) as never, {
      userId: "u1",
      cardId: "card_1",
      title: "Outbid",
      message: "x",
    });
    expect(create).not.toHaveBeenCalled();
  });

  it("reads no mute for a notice about no card", async () => {
    const db = makeDb(true);
    await notifyCard(db as never, {
      userId: "u1",
      title: "Pack bought",
      message: "x",
      metadata: { packId: "p1" },
    });
    expect(db.cardNotificationMute.findUnique).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ metadata: { packId: "p1" } }));
  });

  it("sends pack notices in their own category and never throws", async () => {
    create.mockRejectedValueOnce(new Error("down"));
    await expect(
      notifyCard(makeDb(false) as never, {
        userId: "u1",
        title: "Pack bought",
        message: "x",
        category: "packs",
      })
    ).resolves.toBeUndefined();
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ category: "packs" }));
    expect(warn).toHaveBeenCalledWith(
      '[CardNotify] "Pack bought" for u1 failed:',
      expect.any(Error)
    );
  });

  it("never throws when the mute cannot be read, and sends nothing", async () => {
    const db = makeDb(false);
    db.cardNotificationMute.findUnique.mockRejectedValueOnce(new Error("db down"));
    await expect(
      notifyCard(db as never, { userId: "u1", cardId: "card_1", title: "Outbid", message: "x" })
    ).resolves.toBeUndefined();
    expect(create).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("sends each notice in turn, so one failure stops none of the rest", async () => {
    create.mockRejectedValueOnce(new Error("down"));
    await notifyCards(makeDb(false) as never, [
      { userId: "u1", title: "Your listing sold", message: "x" },
      { userId: "u2", title: "Royalty paid", message: "y" },
    ]);
    expect(create.mock.calls.map(([notice]) => notice.userId)).toEqual(["u1", "u2"]);
  });
});

describe("the per-card mute", () => {
  it("mutes and unmutes one card for one player", async () => {
    const db = makeDb(false);
    await setCardMute(db as never, "u1", "card_1", true);
    expect(db.cardNotificationMute.upsert).toHaveBeenCalledWith({
      where: { userId_cardId: { userId: "u1", cardId: "card_1" } },
      create: { userId: "u1", cardId: "card_1" },
      update: {},
    });
    expect(db.cardNotificationMute.deleteMany).not.toHaveBeenCalled();
    await setCardMute(db as never, "u1", "card_1", false);
    expect(db.cardNotificationMute.deleteMany).toHaveBeenCalledWith({
      where: { userId: "u1", cardId: "card_1" },
    });
    expect(db.cardNotificationMute.upsert).toHaveBeenCalledTimes(1);
  });

  it("reads whether the player muted the card", async () => {
    expect(await isCardMuted(makeDb(true) as never, "u1", "card_1")).toBe(true);
    expect(await isCardMuted(makeDb(false) as never, "u1", "card_1")).toBe(false);
  });
});
