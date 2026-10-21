/** @jest-environment node */
/** Card notices: sent in the cards or packs category, dropped for a card the player muted, never failing the caller. */
jest.mock("~/lib/notifications/api", () => ({ notificationAPI: { create: jest.fn() } }));

import { notificationAPI } from "~/lib/notifications/api";
import { notifyCard, notifyCards } from "~/lib/cards/card-notify";

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
  it("drops a notice about a card the player muted", async () => {
    await notifyCard(makeDb(true) as never, {
      userId: "u1",
      cardId: "card_1",
      title: "Outbid",
      message: "x",
    });
    expect(create).not.toHaveBeenCalled();
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
