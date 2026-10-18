/** @jest-environment node */
import { auctionEndNotices, type AuctionEnd } from "~/lib/economy/auction-notices";

const base: AuctionEnd = {
  auctionId: "a1",
  cardId: "card_1",
  cardTitle: "Aurelia",
  sellerId: "s",
  winnerId: "w",
  price: 500,
  sellerNet: 450,
  refund: 0,
  bidderIds: ["p", "q", "w"],
  byBuyout: false,
};

describe("auction end notices", () => {
  it("tells the winner, the seller and every other bidder", () => {
    const notices = auctionEndNotices(base);
    expect(notices.map((n) => [n.userId, n.title])).toEqual([
      ["w", "You won an auction"],
      ["s", "Your auction sold"],
      ["p", "An auction you bid on ended"],
      ["q", "An auction you bid on ended"],
    ]);
    expect(notices.every((n) => n.cardId === "card_1")).toBe(true);
    expect(notices.every((n) => n.metadata?.auctionId === "a1")).toBe(true);
    expect(notices[0]).toMatchObject({
      message: "Aurelia is yours for 500 IxC.",
      type: "success",
      priority: "high",
    });
    expect(notices[1]).toMatchObject({
      message: "Aurelia sold for 500 IxC. You received 450 IxC after the market fee.",
      type: "success",
      priority: "high",
    });
    expect(notices[2]!.message).toBe("Aurelia went for 500 IxC. Your bid was refunded.");
  });

  it("tells each other bidder once, and never tells the winner or the seller they lost", () => {
    const notices = auctionEndNotices({ ...base, bidderIds: ["p", "w", "p", "s", "w"] });
    expect(notices.map((n) => n.userId)).toEqual(["w", "s", "p"]);
  });

  it("tells the seller of an auction with no bids about the refund", () => {
    const notices = auctionEndNotices({
      ...base,
      winnerId: null,
      bidderIds: [],
      refund: 2.5,
      price: 0,
      sellerNet: 0,
    });
    expect(notices).toEqual([
      {
        userId: "s",
        cardId: "card_1",
        metadata: { auctionId: "a1" },
        title: "Your auction ended with no bids",
        message: "Aurelia is back in your collection. We refunded 2.5 IxC of the listing fee.",
        priority: "low",
      },
    ]);
  });

  it("names no refund when the listing was free or its refund is off", () => {
    const notices = auctionEndNotices({ ...base, winnerId: null, bidderIds: [], refund: 0 });
    expect(notices.map((n) => n.message)).toEqual(["Aurelia is back in your collection."]);
  });

  it("names no market fee when the sale paid none", () => {
    const notices = auctionEndNotices({ ...base, price: 90, sellerNet: 90 });
    expect(notices[1]!.message).toBe("Aurelia sold for 90 IxC. You received 90 IxC.");
  });

  it("names a buyout", () => {
    expect(auctionEndNotices({ ...base, byBuyout: true })[1]!.title).toBe(
      "Your auction was bought out"
    );
  });
});
