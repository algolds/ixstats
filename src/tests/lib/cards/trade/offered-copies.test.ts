/** @jest-environment node */
/**
 * The copies a pending trade offer names, on either side, read once: the workshop counts them as locked
 * (`judgedCopiesTx`), so the sheet and Mine gate break down and fuse on the same predicate.
 */
import { offeredCopyIds, pendingOffersNaming } from "~/lib/cards/trade/offered-copies";

type StoredIds = Array<string | number>;
const fakeDb = (offers: Array<{ initiatorCardIds: StoredIds; recipientCardIds: StoredIds }>) => ({
  tradeOffer: { findMany: jest.fn().mockResolvedValue(offers) },
});

describe("pendingOffersNaming", () => {
  it("matches a pending offer that names any of the copies, on either side", () => {
    expect(pendingOffersNaming(["a", "b"])).toEqual({
      status: "PENDING",
      OR: [
        { initiatorCardIds: { array_contains: ["a"] } },
        { recipientCardIds: { array_contains: ["a"] } },
        { initiatorCardIds: { array_contains: ["b"] } },
        { recipientCardIds: { array_contains: ["b"] } },
      ],
    });
  });
});

describe("offeredCopyIds", () => {
  it("reads the offers once and returns the asked-for copies they name, from either side", async () => {
    const db = fakeDb([
      { initiatorCardIds: ["a", "elsewhere"], recipientCardIds: [] },
      { initiatorCardIds: [], recipientCardIds: ["c", 7] },
    ]);
    const offered = await offeredCopyIds(db as never, ["a", "b", "c"]);
    expect([...offered].sort()).toEqual(["a", "c"]);
    expect(db.tradeOffer.findMany).toHaveBeenCalledTimes(1);
    expect(db.tradeOffer.findMany).toHaveBeenCalledWith({
      where: pendingOffersNaming(["a", "b", "c"]),
      select: { initiatorCardIds: true, recipientCardIds: true },
    });
  });

  it("names nothing, and reads nothing, for no copies", async () => {
    const db = fakeDb([]);
    expect((await offeredCopyIds(db as never, [])).size).toBe(0);
    expect(db.tradeOffer.findMany).not.toHaveBeenCalled();
  });
});
