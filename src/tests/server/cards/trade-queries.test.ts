/** @jest-environment node */
/** A trade for one of its two parties: both sides' faces, inscriptions and values, and what each credit leg would pay. */
jest.mock("~/lib/cards/hub/market-faces", () => ({ copyFaces: jest.fn() }));
jest.mock("~/lib/cards/copy-value", () => ({ loadCopyValues: jest.fn() }));

import { copyFaces } from "~/lib/cards/hub/market-faces";
import { loadCopyValues } from "~/lib/cards/copy-value";
import { contextRevealsArt } from "~/lib/cards/hub/art-visibility";
import { clearEconomyConfigCache } from "~/lib/cards/economy-config";
import { clearGeneralCardSettingsCache } from "~/lib/cards/general-settings";
import { getTradeDetails } from "~/server/modules/cards/trading/trade-queries";

const HOUR = 3_600_000;
const trade = (over: object = {}) => ({
  id: "t1",
  initiatorId: "alice",
  recipientId: "bob",
  proposerId: "alice",
  status: "PENDING",
  revision: 0,
  initiatorCardIds: ["a1"],
  recipientCardIds: ["b1"],
  initiatorCredits: 500,
  recipientCredits: 0,
  expiresAt: new Date(Date.now() + HOUR),
  initiator: { id: "alice", clerkUserId: "user_alice" },
  recipient: { id: "bob", clerkUserId: "user_bob" },
  ...over,
});
const face = (cardId: string) => ({ cardId, title: cardId, silhouette: false });

function makeDb(row: object | null, waitingOnViewer = 1) {
  return {
    systemConfig: { findMany: jest.fn().mockResolvedValue([]) },
    tradeOffer: {
      findUnique: jest.fn().mockResolvedValue(row),
      count: jest.fn().mockResolvedValue(waitingOnViewer),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    cardOwnership: {
      findMany: jest.fn().mockResolvedValue([{ id: "a1", inscription: "gg" }]),
      count: jest.fn().mockResolvedValue(0),
    },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  clearEconomyConfigCache();
  clearGeneralCardSettingsCache();
  jest.mocked(copyFaces).mockResolvedValue(
    new Map([
      ["a1", face("c1")],
      ["b1", face("c2")],
    ]) as never
  );
  jest.mocked(loadCopyValues).mockResolvedValue([
    {
      ownershipId: "a1",
      ownerId: "alice",
      cardId: "c1",
      cardType: "LORE",
      finish: "STANDARD",
      value: 120,
    },
  ]);
});

describe("getTradeDetails", () => {
  it("shows the art of an offer waiting on the viewer, with values, the fee, the inscription and the parsed ids", async () => {
    const db = makeDb(trade());
    const details = await getTradeDetails(db as never, "bob", "t1");

    expect(db.tradeOffer.findUnique).toHaveBeenCalledWith({
      where: { id: "t1" },
      include: {
        initiator: { select: { id: true, clerkUserId: true } },
        recipient: { select: { id: true, clerkUserId: true } },
      },
    });
    expect(copyFaces).toHaveBeenCalledWith(db, "bob", ["a1", "b1"], true);
    // The inscription travels with the copy; who signed it does not (only the sheet names a signer)
    expect(db.cardOwnership.findMany).toHaveBeenCalledWith({
      where: { id: { in: ["a1", "b1"] } },
      select: { id: true, inscription: true },
    });
    // Retired copies are left out of the values, so they are worth 0
    expect(loadCopyValues).toHaveBeenCalledWith(db, { ownershipIds: ["a1", "b1"] });
    expect(details).toMatchObject({
      id: "t1",
      revision: 0,
      myTurn: true,
      viewerRole: "recipient",
      initiatorCardIdList: ["a1"],
      recipientCardIdList: ["b1"],
      initiatorValue: 620,
      recipientValue: 0,
      feePreview: { initiator: 50, recipient: 0 },
      initiator: { id: "alice", clerkUserId: "user_alice" },
      recipient: { id: "bob", clerkUserId: "user_bob" },
    });
    expect(details.initiatorCopies).toEqual([
      { ownershipId: "a1", face: face("c1"), inscription: "gg", value: 120 },
    ]);
    expect(details.recipientCopies).toEqual([
      { ownershipId: "b1", face: face("c2"), inscription: null, value: 0 },
    ]);
  });

  it("asks the card sheet's own offer question, so a trade and a sheet opened from it agree", async () => {
    const db = makeDb(trade());
    await getTradeDetails(db as never, "bob", "t1");
    await contextRevealsArt(
      db as never,
      "bob",
      "c1",
      { kind: "offer", id: "t1" },
      { vaultVisible: jest.fn(), holderOf: jest.fn() }
    );
    const liveOffer = {
      id: "t1",
      status: "PENDING",
      expiresAt: { gt: expect.any(Date) },
      proposerId: { not: "bob" },
      OR: [{ initiatorId: "bob" }, { recipientId: "bob" }],
    };
    expect(db.tradeOffer.count.mock.calls[0]![0].where).toEqual(liveOffer);
    expect(db.tradeOffer.findFirst.mock.calls[0]![0].where).toEqual(liveOffer);
  });

  it("follows the silhouette rule for the proposer and for a finished or expired trade", async () => {
    const proposer = await getTradeDetails(makeDb(trade(), 0) as never, "alice", "t1");
    expect(jest.mocked(copyFaces).mock.calls.at(-1)?.[3]).toBe(false);
    expect(proposer).toMatchObject({ myTurn: false, viewerRole: "initiator" });

    const finished = await getTradeDetails(
      makeDb(trade({ status: "ACCEPTED" }), 0) as never,
      "bob",
      "t1"
    );
    expect(jest.mocked(copyFaces).mock.calls.at(-1)?.[3]).toBe(false);
    expect(finished.myTurn).toBe(false);

    // Expired: no longer the viewer's turn, whatever the stored status says
    const expired = await getTradeDetails(
      makeDb(trade({ expiresAt: new Date(Date.now() - 1) })) as never,
      "bob",
      "t1"
    );
    expect(expired.myTurn).toBe(false);
  });

  it("previews the fee on each side's credits, and nothing at or under the threshold", async () => {
    const details = await getTradeDetails(
      makeDb(trade({ initiatorCredits: 100, recipientCredits: 1_000 })) as never,
      "alice",
      "t1"
    );
    expect(details.feePreview).toEqual({ initiator: 0, recipient: 100 });
    expect(details).toMatchObject({ initiatorValue: 220, recipientValue: 1_000 });
  });

  it("keeps the offer's order and leaves out a copy that is gone", async () => {
    jest.mocked(copyFaces).mockResolvedValueOnce(
      new Map([
        ["a2", face("c3")],
        ["a1", face("c1")],
      ]) as never
    );
    const details = await getTradeDetails(
      makeDb(trade({ initiatorCardIds: ["a1", "gone", "a2", 7], recipientCardIds: "b1" })) as never,
      "bob",
      "t1"
    );
    expect(details.initiatorCopies.map((c) => c.ownershipId)).toEqual(["a1", "a2"]);
    expect(details.initiatorCardIdList).toEqual(["a1", "gone", "a2"]);
    expect(details.recipientCopies).toEqual([]);
    expect(details.recipientCardIdList).toEqual([]);
  });

  it("is NOT_FOUND for anyone who is not a party, and for no trade, reading nothing else", async () => {
    const db = makeDb(trade());
    await expect(getTradeDetails(db as never, "carol", "t1")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    db.tradeOffer.findUnique.mockResolvedValueOnce(null);
    await expect(getTradeDetails(db as never, "bob", "t1")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(db.tradeOffer.count).not.toHaveBeenCalled();
    expect(copyFaces).not.toHaveBeenCalled();
  });
});
