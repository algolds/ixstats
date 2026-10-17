/** @jest-environment node */
import { mergeMarketHistory } from "~/components/vault/cards/market/market-history";

const party = (clerkUserId: string, handle: string | null) => ({ clerkUserId, handle });

describe("mergeMarketHistory", () => {
  it("puts trades and auctions in one list, newest first, from the viewer's side", () => {
    const entries = mergeMarketHistory(
      [
        {
          id: "t1",
          status: "ACCEPTED",
          updatedAt: new Date("2026-10-03T00:00:00Z"),
          initiatorCardIds: ["o1", "o2"],
          recipientCardIds: ["o3"],
          initiator: party("clerk_me", "max"),
          recipient: party("clerk_ann", "ann"),
        },
      ],
      [
        {
          id: "a1",
          updatedAt: new Date("2026-10-05T00:00:00Z"),
          participation: "won",
          finalPrice: 140,
          currentBid: 140,
          face: null,
        },
        {
          id: "a2",
          updatedAt: new Date("2026-10-01T00:00:00Z"),
          participation: "cancelled",
          finalPrice: null,
          currentBid: 50,
          face: null,
        },
      ],
      "clerk_me"
    );
    expect(entries.map((e) => e.id)).toEqual(["a1", "t1", "a2"]);
    expect(entries[1]).toMatchObject({
      kind: "trade",
      partnerHandle: "ann",
      gave: 2,
      got: 1,
      label: "Completed",
    });
    expect(entries[0]).toMatchObject({ kind: "auction", label: "Won", price: 140 });
    expect(entries[2]).toMatchObject({ label: "Cancelled", price: null });
  });

  it("reads the other side when the viewer received the offer", () => {
    const [entry] = mergeMarketHistory(
      [
        {
          id: "t2",
          status: "REJECTED",
          updatedAt: new Date(),
          initiatorCardIds: ["o1"],
          recipientCardIds: [],
          initiator: party("clerk_ann", "ann"),
          recipient: party("clerk_me", "max"),
        },
      ],
      [],
      "clerk_me"
    );
    expect(entry).toMatchObject({ partnerHandle: "ann", gave: 0, got: 1, label: "Declined" });
  });

  it("names every finished status, and every part in an auction", () => {
    const at = new Date("2026-10-01T00:00:00Z");
    const trade = (id: string, status: string) => ({
      id,
      status,
      updatedAt: at,
      initiatorCardIds: null,
      recipientCardIds: { not: "a list" },
      initiator: party("clerk_me", null),
      recipient: null,
    });
    const auction = (id: string, participation: "sold" | "bid") => ({
      id,
      updatedAt: at,
      participation,
      finalPrice: null,
      currentBid: 75,
      face: null,
    });
    const entries = mergeMarketHistory(
      [trade("t1", "CANCELLED"), trade("t2", "EXPIRED"), trade("t3", "COUNTERED")],
      [auction("a1", "sold"), auction("a2", "bid")],
      "clerk_me"
    );
    expect(entries.map((e) => e.label)).toEqual([
      "Cancelled",
      "Expired",
      "Ended",
      "Sold",
      "Outbid",
    ]);
    expect(entries[0]).toMatchObject({ partnerHandle: null, gave: 0, got: 0 });
    // Without a final price, an auction stands at its last bid.
    expect(entries[3]).toMatchObject({ price: 75 });
  });
});
