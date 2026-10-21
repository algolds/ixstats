/** @jest-environment node */
/** The trade procedures are thin: they bound the input, name players for the notices, and clear vault caches. */
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/server/modules/cards/trading/trade-service", () => ({
  createTradeOffer: jest.fn(),
  counterTradeOffer: jest.fn(),
  acceptTradeOffer: jest.fn(),
  rejectTradeOffer: jest.fn(),
  cancelTradeOffer: jest.fn(),
}));
jest.mock("~/server/modules/identity/identity.player-names", () => ({
  loadPlayerNames: jest.fn(),
}));
jest.mock("~/lib/vault/vault-cache", () => ({ clearVaultCachesFor: jest.fn() }));

import { createCallerFactory } from "~/server/api/trpc";
import { tradingOffersRouter } from "~/server/api/routers/trading/offers";
import {
  acceptTradeOffer,
  cancelTradeOffer,
  counterTradeOffer,
  createTradeOffer,
  rejectTradeOffer,
  type NameOf,
} from "~/server/modules/cards/trading/trade-service";
import { loadPlayerNames } from "~/server/modules/identity/identity.player-names";
import { clearVaultCachesFor } from "~/lib/vault/vault-cache";
import { createMockPrisma } from "~/tests/helpers/mock-db";
import { createMockRouterContext } from "~/tests/helpers/router-context";

const ME = { id: "me", clerkUserId: "clerk_me" };
const TRADE = { id: "t1", initiatorId: "me", recipientId: "them", proposerId: "me" };
const db = createMockPrisma();
const caller = (signedIn = true) =>
  createCallerFactory(tradingOffersRouter)(
    createMockRouterContext(
      signedIn ? { db, user: ME, auth: { userId: "clerk_me" } } : { db, user: null, auth: null }
    ) as never
  );
const table = { initiatorCardIds: ["a1"], recipientCardIds: ["b1"] };

beforeEach(() => {
  jest.clearAllMocks();
  for (const fn of [createTradeOffer, counterTradeOffer, rejectTradeOffer, cancelTradeOffer]) {
    jest.mocked(fn).mockResolvedValue(TRADE as never);
  }
  jest
    .mocked(acceptTradeOffer)
    .mockResolvedValue({ trade: TRADE, royaltyRecipientIds: ["owner"] } as never);
});

describe("the trade procedures", () => {
  it("open an offer for the signed-in player, with empty sides and credits defaulted", async () => {
    await expect(
      caller().createtradeOffer({ partnerId: "them", ...table, message: "  Swap?  " })
    ).resolves.toEqual(TRADE);
    expect(createTradeOffer).toHaveBeenCalledWith(db, {
      initiator: ME,
      partnerId: "them",
      table: { ...table, initiatorCredits: 0, recipientCredits: 0 },
      message: "Swap?",
      now: expect.any(Date),
      nameOf: expect.any(Function),
    });
    expect(clearVaultCachesFor).toHaveBeenCalledWith(db, ["me"]);
  });

  it("name players for notices by the identity rule", async () => {
    jest
      .mocked(loadPlayerNames)
      .mockResolvedValue(new Map([["me", { handle: "max", displayName: "@max" }]]));
    await caller().createtradeOffer({ partnerId: "them", ...table });
    const nameOf: NameOf = jest.mocked(createTradeOffer).mock.calls[0]![1].nameOf;
    await expect(nameOf("me")).resolves.toBe("@max");
    expect(loadPlayerNames).toHaveBeenCalledWith(["me"]);
    await expect(nameOf("nobody")).resolves.toBeNull();
  });

  it("bound each side to 20 cards and 1,000,000 whole IxC, and a revision to a whole number", async () => {
    const many = Array.from({ length: 21 }, (_, i) => `c${i}`);
    await expect(
      caller().createtradeOffer({ partnerId: "them", initiatorCardIds: many })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await expect(
      caller().createtradeOffer({ partnerId: "them", ...table, initiatorCredits: 1_000_001 })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      caller().counterTrade({ tradeId: "t1", revision: -1, ...table })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      caller().createtradeOffer({ partnerId: "them", ...table, message: "x".repeat(501) })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(createTradeOffer).not.toHaveBeenCalled();
    expect(counterTradeOffer).not.toHaveBeenCalled();
  });

  it("counter on the revision the player saw, clearing both parties' caches", async () => {
    await caller().counterTrade({ tradeId: "t1", revision: 2, ...table, recipientCredits: 40 });
    expect(counterTradeOffer).toHaveBeenCalledWith(db, {
      user: ME,
      tradeId: "t1",
      revision: 2,
      table: { ...table, initiatorCredits: 0, recipientCredits: 40 },
      message: undefined,
      now: expect.any(Date),
      nameOf: expect.any(Function),
    });
    expect(clearVaultCachesFor).toHaveBeenCalledWith(db, ["me", "them"]);
  });

  it("accept on the revision seen, clearing the nation owners paid a royalty too, or reject", async () => {
    await expect(
      caller().respondToTrade({ tradeId: "t1", action: "ACCEPT", revision: 1 })
    ).resolves.toEqual(TRADE);
    expect(acceptTradeOffer).toHaveBeenCalledWith(db, {
      user: ME,
      tradeId: "t1",
      revision: 1,
      now: expect.any(Date),
      nameOf: expect.any(Function),
    });
    expect(clearVaultCachesFor).toHaveBeenLastCalledWith(db, ["me", "them", "owner"]);

    await expect(
      caller().respondToTrade({ tradeId: "t1", action: "REJECT", revision: 1 })
    ).resolves.toEqual(TRADE);
    expect(rejectTradeOffer).toHaveBeenCalledWith(db, {
      user: ME,
      tradeId: "t1",
      now: expect.any(Date),
    });
    expect(clearVaultCachesFor).toHaveBeenLastCalledWith(db, ["me", "them"]);
    // There is no COUNTER action: a counter-offer is its own procedure
    await expect(
      caller().respondToTrade({ tradeId: "t1", action: "COUNTER" as never, revision: 1 })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("withdraw the player's own offer", async () => {
    await caller().cancelTrade({ tradeId: "t1" });
    expect(cancelTradeOffer).toHaveBeenCalledWith(db, {
      user: ME,
      tradeId: "t1",
      now: expect.any(Date),
    });
    expect(clearVaultCachesFor).toHaveBeenCalledWith(db, ["me", "them"]);
  });

  it("refuse a signed-out caller", async () => {
    await expect(caller(false).cancelTrade({ tradeId: "t1" })).rejects.toMatchObject({
      cause: { code: "UNAUTHORIZED" },
    });
    expect(cancelTradeOffer).not.toHaveBeenCalled();
  });
});
