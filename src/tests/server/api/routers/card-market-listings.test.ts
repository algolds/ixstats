/** @jest-environment node */
/**
 * cardMarket listing procedures: the signed-in player lists, cancels and buys as themselves, a bulk listing reports
 * each copy on its own, the cached balances of everyone paid or charged are dropped, and Browse takes bounded input.
 */
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/lib/cache", () => ({
  __esModule: true,
  ...jest.requireActual("~/lib/cache"),
  rateLimiter: { isEnabled: () => true, check: jest.fn() },
}));
jest.mock("~/lib/vault/vault-cache", () => ({ clearVaultCachesFor: jest.fn() }));
jest.mock("~/server/modules/cards/market/listings", () => ({
  buyListing: jest.fn(),
  cancelListing: jest.fn(),
  createListing: jest.fn(),
  listMyListings: jest.fn(),
}));
jest.mock("~/server/modules/cards/market/browse", () => ({
  ...jest.requireActual("~/server/modules/cards/market/browse"),
  browseMarket: jest.fn(),
}));

import { TRPCError } from "@trpc/server";
import { rateLimiter } from "~/lib/cache";
import { clearVaultCachesFor } from "~/lib/vault/vault-cache";
import { createCallerFactory } from "~/server/api/trpc";
import { cardMarketRouter } from "~/server/api/routers/card-market";
import { cardMarketListingsRouter } from "~/server/api/routers/card-market/listings";
import { browseMarket } from "~/server/modules/cards/market/browse";
import {
  buyListing,
  cancelListing,
  createListing,
  listMyListings,
} from "~/server/modules/cards/market/listings";
import { createMockPrisma } from "~/tests/helpers/mock-db";
import { createMockRouterContext } from "~/tests/helpers/router-context";

const createCaller = createCallerFactory(cardMarketListingsRouter);
const check = jest.mocked(rateLimiter.check);
const db = createMockPrisma();
const caller = createCaller(
  createMockRouterContext({
    db,
    user: { id: "u1", clerkUserId: "user_1" },
    rateLimitIdentifier: "user:u1",
  }) as never
);
const listed = (id: string) => ({ id }) as Awaited<ReturnType<typeof createListing>>;

beforeEach(() => {
  jest.clearAllMocks();
  check.mockResolvedValue({ success: true, remaining: 59, resetAt: new Date() });
});

describe("cardMarket listing procedures", () => {
  it("are on the card market router", () => {
    const procedures = cardMarketRouter._def.procedures;
    for (const name of [
      "createListing",
      "createListings",
      "cancelListing",
      "buyListing",
      "getMyListings",
      "browse",
    ]) {
      expect(name in procedures).toBe(true);
    }
  });

  it("list a copy as the signed-in player, featured only when asked, and drop their cached balance", async () => {
    jest.mocked(createListing).mockResolvedValue(listed("l1"));
    expect(await caller.createListing({ ownershipId: "own_1", price: 500 })).toEqual({ id: "l1" });
    expect(createListing).toHaveBeenCalledWith(db, {
      sellerId: "u1",
      ownershipId: "own_1",
      price: 500,
      isFeatured: false,
      now: expect.any(Date),
    });
    expect(clearVaultCachesFor).toHaveBeenCalledWith(db, ["u1"]);
  });

  it("take whole prices from 1 to 1,000,000 IxC", async () => {
    for (const price of [0, 2.5, 1_000_001]) {
      await expect(caller.createListing({ ownershipId: "own_1", price })).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
    }
    expect(createListing).not.toHaveBeenCalled();
  });

  it("list several copies, each on its own, and say which failed and why", async () => {
    jest
      .mocked(createListing)
      .mockResolvedValueOnce(listed("l1"))
      .mockRejectedValueOnce(
        new TRPCError({ code: "CONFLICT", message: "This copy is already listed or in a trade." })
      )
      .mockRejectedValueOnce(new Error("connection reset: host db-1"));
    const errorLog = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const results = await caller.createListings({
      items: [
        { ownershipId: "a", price: 10 },
        { ownershipId: "b", price: 20 },
        { ownershipId: "c", price: 30 },
      ],
      isFeatured: true,
    });
    errorLog.mockRestore();
    expect(results).toEqual([
      { ownershipId: "a", listingId: "l1", error: null },
      { ownershipId: "b", listingId: null, error: "This copy is already listed or in a trade." },
      // Anything but the market's own refusal stays on the server
      { ownershipId: "c", listingId: null, error: "Could not list this copy." },
    ]);
    expect(createListing).toHaveBeenCalledTimes(3);
    expect(createListing).toHaveBeenLastCalledWith(db, {
      sellerId: "u1",
      ownershipId: "c",
      price: 30,
      isFeatured: true,
      now: expect.any(Date),
    });
    expect(clearVaultCachesFor).toHaveBeenCalledTimes(1);
    expect(clearVaultCachesFor).toHaveBeenCalledWith(db, ["u1"]);
  });

  it("list at most 20 copies at once", async () => {
    const items = Array.from({ length: 21 }, (_, i) => ({ ownershipId: `o${i}`, price: 10 }));
    await expect(caller.createListings({ items })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.createListings({ items: [] })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(createListing).not.toHaveBeenCalled();
  });

  it("cancel the player's own listing and drop their cached balance", async () => {
    jest.mocked(cancelListing).mockResolvedValue({ refund: 2.5 });
    expect(await caller.cancelListing({ listingId: "l1" })).toEqual({ refund: 2.5 });
    expect(cancelListing).toHaveBeenCalledWith(db, {
      sellerId: "u1",
      listingId: "l1",
      now: expect.any(Date),
    });
    expect(clearVaultCachesFor).toHaveBeenCalledWith(db, ["u1"]);
  });

  it("buy as the signed-in player, drop both sides' cached balances and return no settlement", async () => {
    jest.mocked(buyListing).mockResolvedValue({
      listingId: "l1",
      ownershipId: "own_1",
      cardId: "card_1",
      sellerId: "seller",
      price: 500,
      settlement: { fee: 50, sellerNet: 450, royalties: [] },
    });
    expect(await caller.buyListing({ listingId: "l1" })).toEqual({
      ownershipId: "own_1",
      cardId: "card_1",
      price: 500,
    });
    expect(buyListing).toHaveBeenCalledWith(db, {
      buyerId: "u1",
      listingId: "l1",
      now: expect.any(Date),
    });
    expect(clearVaultCachesFor).toHaveBeenCalledWith(db, ["u1", "seller"]);
  });

  it("read the player's own listings", async () => {
    jest.mocked(listMyListings).mockResolvedValue([]);
    expect(await caller.getMyListings()).toEqual([]);
    expect(listMyListings).toHaveBeenCalledWith(db, "u1");
  });

  it("browse with defaults, and refuse an unbounded page", async () => {
    jest.mocked(browseMarket).mockResolvedValue({ items: [], hasMore: false });
    expect(await caller.browse({})).toEqual({ items: [], hasMore: false });
    expect(browseMarket).toHaveBeenCalledWith(db, "u1", {
      kind: "all",
      sort: "ending_soon",
      filters: {},
      limit: 24,
      offset: 0,
    });
    await caller.browse({ filters: { search: "  aurelia  ", finish: "FOIL" }, sort: "price_low" });
    expect(jest.mocked(browseMarket).mock.calls[1]![2]).toMatchObject({
      sort: "price_low",
      filters: { search: "aurelia", finish: "FOIL" },
    });
    for (const bad of [{ limit: 101 }, { offset: 501 }, { filters: { search: "x".repeat(81) } }]) {
      await expect(caller.browse(bad)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    }
  });

  it("refuse a signed-out caller", async () => {
    const signedOut = createCaller(createMockRouterContext({ auth: null, user: null }) as never);
    // The auth middleware throws the app's UnauthorizedError; a server caller wraps it as the cause.
    const unauthorized = { cause: { code: "UNAUTHORIZED" } };
    await expect(signedOut.browse({})).rejects.toMatchObject(unauthorized);
    await expect(signedOut.getMyListings()).rejects.toMatchObject(unauthorized);
    await expect(signedOut.buyListing({ listingId: "l1" })).rejects.toMatchObject(unauthorized);
    await expect(signedOut.createListing({ ownershipId: "own_1", price: 5 })).rejects.toMatchObject(
      unauthorized
    );
    expect(buyListing).not.toHaveBeenCalled();
    expect(createListing).not.toHaveBeenCalled();
  });
});
