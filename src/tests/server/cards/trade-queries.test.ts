/** @jest-environment node */
/** A trade for one of its two parties: both sides' faces, inscriptions and values, and what each credit leg would pay. */
jest.mock("~/lib/cards/hub/market-faces", () => ({ copyFaces: jest.fn() }));
jest.mock("~/lib/cards/copy-value", () => ({ loadCopyValues: jest.fn() }));

import { copyFaces } from "~/lib/cards/hub/market-faces";
import { loadCopyValues } from "~/lib/cards/copy-value";
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
const face = (cardId: string) => ({ cardId, title: cardId, uncollected: false });

function makeDb(row: object | null) {
  return {
    systemConfig: { findMany: jest.fn().mockResolvedValue([]) },
    tradeOffer: {
      findUnique: jest.fn().mockResolvedValue(row),
      count: jest.fn().mockResolvedValue(1),
    },
    cardOwnership: {
      findMany: jest.fn().mockResolvedValue([{ id: "a1", inscription: "gg" }]),
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
  it("previews the fee on each side's credits, and nothing at or under the threshold", async () => {
    const details = await getTradeDetails(
      makeDb(trade({ initiatorCredits: 100, recipientCredits: 1_000 })) as never,
      "alice",
      "t1"
    );
    expect(details.feePreview).toEqual({ initiator: 0, recipient: 100 });
    expect(details).toMatchObject({ initiatorValue: 220, recipientValue: 1_000 });
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
