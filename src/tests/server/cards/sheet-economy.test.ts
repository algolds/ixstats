/** @jest-environment node */
/**
 * The card sheet's economy half for one viewer: each copy's value (from the one loader, so a retired card's copies are
 * worth 0), the dust it breaks down for, which copy actions it allows, the fusion groups ready now, the craft offer,
 * the wishlist state and the name a signature would freeze (read by the router, which injects it).
 */
jest.mock("~/lib/cards/copy-value", () => ({ loadCopyValues: jest.fn() }));
jest.mock("~/server/modules/cards/workshop/craft", () => ({ craftOfferFor: jest.fn() }));

import { loadCopyValues } from "~/lib/cards/copy-value";
import { clearEconomyConfigCache } from "~/lib/cards/economy-config";
import { craftOfferFor } from "~/server/modules/cards/workshop/craft";
import { getSheetEconomy } from "~/server/modules/cards/sheet-economy";

const copyRow = (id: string, over: object = {}) => ({
  id,
  finish: "STANDARD",
  isLocked: false,
  inscription: null,
  inscribedAt: null,
  importDiscounted: false,
  listings: [],
  CardAuction: [],
  ...over,
});

function fakeDb(
  rows: object[],
  card: object | null = { id: "c1", rarity: "RARE", isBound: false },
  offers: Array<{ initiatorCardIds: string[]; recipientCardIds: string[] }> = []
) {
  return {
    systemConfig: { findMany: jest.fn().mockResolvedValue([]) },
    tradeOffer: { findMany: jest.fn().mockResolvedValue(offers) },
    card: { findUnique: jest.fn().mockResolvedValue(card) },
    cardOwnership: { findMany: jest.fn().mockResolvedValue(rows) },
    cardWatchlist: { findUnique: jest.fn().mockResolvedValue({ id: "w" }) },
  };
}

const named = (name: string | null) => jest.fn().mockResolvedValue(name);

beforeEach(() => {
  jest.clearAllMocks();
  clearEconomyConfigCache();
  jest.mocked(loadCopyValues).mockResolvedValue([]);
  jest.mocked(craftOfferFor).mockResolvedValue(null);
});

describe("getSheetEconomy", () => {
  it("gives each of the viewer's copies its value, dust and actions, and the wishlist state", async () => {
    jest.mocked(loadCopyValues).mockResolvedValue([
      {
        ownershipId: "a",
        ownerId: "u1",
        cardId: "c1",
        cardType: "LORE",
        finish: "STANDARD",
        value: 100,
      },
    ]);
    const db = fakeDb([
      copyRow("a"),
      copyRow("b", { inscription: "gg", inscribedAt: new Date() }),
      copyRow("c", { isLocked: true, listings: [{ id: "l1" }] }),
      copyRow("d", { isLocked: true, CardAuction: [{ id: "x1" }] }),
    ]);
    const economy = await getSheetEconomy(db as never, "u1", "c1", named("@ixnay"));
    expect(economy).toMatchObject({
      cardId: "c1",
      isBound: false,
      wishlisted: true,
      craft: null,
      signerName: "@ixnay",
    });
    expect(
      economy.copies.map((c) => [
        c.ownershipId,
        c.value,
        c.dust,
        c.breakdownBlocker,
        c.canSign,
        c.listingId,
        c.auctionId,
      ])
    ).toEqual([
      ["a", 100, 50, null, true, null, null],
      ["b", 0, 50, "Signed copies can't be broken down.", false, null, null],
      ["c", 0, 50, "A copy that is listed or in a trade can't be broken down.", false, "l1", null],
      ["d", 0, 50, "A copy that is listed or in a trade can't be broken down.", false, null, "x1"],
    ]);
    expect(db.cardOwnership.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { ownerId: "u1", cardId: "c1" },
        orderBy: { serialNumber: "asc" },
      })
    );
    // Only live sales name a copy's listing or auction.
    const select = jest.mocked(db.cardOwnership.findMany).mock.calls[0]![0].select;
    expect(select.listings.where).toEqual({ status: "ACTIVE" });
    expect(select.CardAuction.where).toEqual({ status: "ACTIVE" });
    expect(db.cardWatchlist.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId_cardId: { userId: "u1", cardId: "c1" } } })
    );
  });

  it("values only the viewer's copies, with the loader's default that leaves a retired card's copies out", async () => {
    const db = fakeDb([copyRow("a"), copyRow("b")]);
    await getSheetEconomy(db as never, "u1", "c1", named(null));
    expect(loadCopyValues).toHaveBeenCalledWith(db, { ownershipIds: ["a", "b"] });
  });
  it("names the viewer by the injected rule, and says so when they have no name to sign with", async () => {
    const nameOf = named(null);
    const economy = await getSheetEconomy(fakeDb([copyRow("a")]) as never, "u1", "c1", nameOf);
    expect(nameOf).toHaveBeenCalledWith("u1");
    expect(economy.signerName).toBeNull();
  });
  it("is NOT_FOUND for an unknown card", async () => {
    const db = fakeDb([], null);
    await expect(getSheetEconomy(db as never, "u1", "nope", named(null))).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(db.cardOwnership.findMany).not.toHaveBeenCalled();
  });
});
