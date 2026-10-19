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
import { pendingOffersNaming } from "~/lib/cards/trade/offered-copies";
import { craftOfferFor, type CraftOffer } from "~/server/modules/cards/workshop/craft";
import {
  fusionGroups,
  getSheetEconomy,
  type FusibleCopy,
} from "~/server/modules/cards/sheet-economy";

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

const offer: CraftOffer = {
  cardId: "c1",
  realmId: "r1",
  verdict: { ok: true },
  quote: { dust: 400, credits: 25 },
  dust: 120,
};

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

  it("is not wishlisted without a wishlist row, and carries the viewer's craft offer", async () => {
    jest.mocked(craftOfferFor).mockResolvedValue(offer);
    const db = fakeDb([copyRow("a")]);
    db.cardWatchlist.findUnique.mockResolvedValue(null);
    const economy = await getSheetEconomy(db as never, "u1", "c1", named("@ixnay"));
    expect(economy).toMatchObject({ wishlisted: false, craft: offer });
    expect(craftOfferFor).toHaveBeenCalledWith(db, "u1", "c1");
  });

  it("names the viewer by the injected rule, and says so when they have no name to sign with", async () => {
    const nameOf = named(null);
    const economy = await getSheetEconomy(fakeDb([copyRow("a")]) as never, "u1", "c1", nameOf);
    expect(nameOf).toHaveBeenCalledWith("u1");
    expect(economy.signerName).toBeNull();
  });

  it("never offers signing a copy that was signed and then cleared, or a locked one", async () => {
    const db = fakeDb([
      copyRow("cleared", { inscription: null, inscribedAt: new Date() }),
      copyRow("locked", { isLocked: true }),
    ]);
    const economy = await getSheetEconomy(db as never, "u1", "c1", named("@ixnay"));
    expect(economy.copies.map((c) => c.canSign)).toEqual([false, false]);
    // A cleared copy has no inscription any more, so it may be broken down.
    expect(economy.copies.map((c) => c.breakdownBlocker)).toEqual([
      null,
      "A copy that is listed or in a trade can't be broken down.",
    ]);
  });

  it("refuses to break down a bound card's copies and offers no fusion for them", async () => {
    const db = fakeDb([copyRow("a"), copyRow("b"), copyRow("c")], {
      id: "c1",
      rarity: "RARE",
      isBound: true,
    });
    const economy = await getSheetEconomy(db as never, "u1", "c1", named("@ixnay"));
    expect(economy.isBound).toBe(true);
    expect(economy.copies.map((c) => c.breakdownBlocker)).toEqual([
      "Bound cards can't be broken down.",
      "Bound cards can't be broken down.",
      "Bound cards can't be broken down.",
    ]);
    expect(economy.fusionGroups).toEqual([]);
  });

  it("prices an imported copy's dust at its share, and a Serialised copy at none", async () => {
    const db = fakeDb([
      copyRow("imported", { importDiscounted: true }),
      copyRow("foil", { finish: "FOIL" }),
      copyRow("serial", { finish: "SERIALISED" }),
    ]);
    const economy = await getSheetEconomy(db as never, "u1", "c1", named("@ixnay"));
    expect(economy.copies.map((c) => [c.dust, c.breakdownBlocker])).toEqual([
      [12, null],
      [150, null],
      [0, "Serialised copies can't be broken down."],
    ]);
  });

  it("offers the ready fusion group from the copies in serial order", async () => {
    const db = fakeDb([copyRow("a"), copyRow("b"), copyRow("c"), copyRow("d")]);
    const economy = await getSheetEconomy(db as never, "u1", "c1", named("@ixnay"));
    expect(economy.fusionGroups).toEqual([
      { finish: "STANDARD", next: "FOIL", ownershipIds: ["a", "b", "c"] },
    ]);
  });

  it("leaves signed and locked copies out of fusion, but not one whose signature staff cleared", async () => {
    const db = fakeDb([
      copyRow("signed", { inscription: "gg", inscribedAt: new Date() }),
      copyRow("locked", { isLocked: true }),
      copyRow("cleared", { inscription: null, inscribedAt: new Date() }),
      copyRow("b"),
      copyRow("c"),
    ]);
    const economy = await getSheetEconomy(db as never, "u1", "c1", named("@ixnay"));
    expect(economy.fusionGroups).toEqual([
      { finish: "STANDARD", next: "FOIL", ownershipIds: ["cleared", "b", "c"] },
    ]);
  });

  it("treats a copy a pending trade offer names as locked: no break down, and fusion takes the next ready copies", async () => {
    const db = fakeDb([copyRow("asked"), copyRow("a"), copyRow("b"), copyRow("c")], undefined, [
      { initiatorCardIds: ["theirs"], recipientCardIds: ["asked"] },
    ]);
    const economy = await getSheetEconomy(db as never, "u1", "c1", named("@ixnay"));
    expect(economy.copies.map((c) => [c.ownershipId, c.breakdownBlocker, c.canSign])).toEqual([
      // Signing is never blocked by an offer (Task 17: an accept refuses a copy signed since), only by a lock.
      ["asked", "A copy that is listed or in a trade can't be broken down.", true],
      ["a", null, true],
      ["b", null, true],
      ["c", null, true],
    ]);
    expect(economy.fusionGroups).toEqual([
      { finish: "STANDARD", next: "FOIL", ownershipIds: ["a", "b", "c"] },
    ]);
    expect(db.tradeOffer.findMany).toHaveBeenCalledTimes(1);
    expect(db.tradeOffer.findMany.mock.calls[0]![0].where).toEqual(
      pendingOffersNaming(["asked", "a", "b", "c"])
    );
  });

  it("is NOT_FOUND for an unknown card", async () => {
    const db = fakeDb([], null);
    await expect(getSheetEconomy(db as never, "u1", "nope", named(null))).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(db.cardOwnership.findMany).not.toHaveBeenCalled();
  });
});

describe("fusionGroups", () => {
  const ready = (id: string, finish: FusibleCopy["finish"] = "STANDARD"): FusibleCopy => ({
    ownershipId: id,
    finish,
    isLocked: false,
    signed: false,
  });

  it("offers the lowest-serial ready copies once there are enough of one finish", () => {
    expect(fusionGroups([ready("a"), ready("b"), ready("c"), ready("d")], false, 3)).toEqual([
      { finish: "STANDARD", next: "FOIL", ownershipIds: ["a", "b", "c"] },
    ]);
  });

  it("groups each fusible finish on its own", () => {
    const copies = [ready("a"), ready("f1", "FOIL"), ready("b"), ready("f2", "FOIL")];
    expect(fusionGroups(copies, false, 2)).toEqual([
      { finish: "STANDARD", next: "FOIL", ownershipIds: ["a", "b"] },
      { finish: "FOIL", next: "HOLO", ownershipIds: ["f1", "f2"] },
    ]);
  });

  it("offers nothing short of the group size, at the top finish, for a bound card, or past a signed or locked copy", () => {
    expect(fusionGroups([ready("a"), ready("b"), ready("c", "FOIL")], false, 3)).toEqual([]);
    expect(
      fusionGroups([ready("a", "HOLO"), ready("b", "HOLO"), ready("c", "HOLO")], false, 3)
    ).toEqual([]);
    expect(
      fusionGroups(
        [ready("a", "SERIALISED"), ready("b", "SERIALISED"), ready("c", "SERIALISED")],
        false,
        3
      )
    ).toEqual([]);
    expect(fusionGroups([ready("a"), ready("b"), ready("c")], true, 3)).toEqual([]);
    expect(
      fusionGroups([ready("a"), { ...ready("b"), signed: true }, ready("c")], false, 3)
    ).toEqual([]);
    expect(
      fusionGroups([ready("a"), { ...ready("b"), isLocked: true }, ready("c")], false, 3)
    ).toEqual([]);
  });

  it("skips a signed or locked copy for the next ready one", () => {
    const copies = [ready("a"), { ...ready("b"), signed: true }, ready("c"), ready("d")];
    expect(fusionGroups(copies, false, 3)).toEqual([
      { finish: "STANDARD", next: "FOIL", ownershipIds: ["a", "c", "d"] },
    ]);
  });
});
