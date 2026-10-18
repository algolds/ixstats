/** @jest-environment node */
/** cardMarket wishlist procedures: the signed-in player's own wishlist, never another player's. */
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/lib/cache", () => ({
  __esModule: true,
  ...jest.requireActual("~/lib/cache"),
  rateLimiter: { isEnabled: () => true, check: jest.fn() },
}));
jest.mock("~/server/modules/cards/market/wishlist", () => ({
  addToWishlist: jest.fn(),
  listWishlist: jest.fn(),
  removeFromWishlist: jest.fn(),
}));

import { TRPCError } from "@trpc/server";
import { rateLimiter } from "~/lib/cache";
import { createCallerFactory } from "~/server/api/trpc";
import { cardMarketRouter } from "~/server/api/routers/card-market";
import { cardMarketWishlistRouter } from "~/server/api/routers/card-market/wishlist";
import {
  addToWishlist,
  listWishlist,
  removeFromWishlist,
} from "~/server/modules/cards/market/wishlist";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const createCaller = createCallerFactory(cardMarketWishlistRouter);
const check = jest.mocked(rateLimiter.check);
const signedIn = (db = createMockPrisma()) =>
  createCaller(
    createMockRouterContext({
      db,
      user: { id: "u1", clerkUserId: "user_1" },
      rateLimitIdentifier: "user:u1",
    }) as never
  );

beforeEach(() => {
  jest.clearAllMocks();
  check.mockResolvedValue({ success: true, remaining: 59, resetAt: new Date() });
});

describe("cardMarket wishlist procedures", () => {
  it("are on the card market router", () => {
    const procedures = cardMarketRouter._def.procedures;
    expect("getWishlist" in procedures).toBe(true);
    expect("addToWishlist" in procedures).toBe(true);
    expect("removeFromWishlist" in procedures).toBe(true);
  });

  it("read and change the signed-in player's own wishlist", async () => {
    jest.mocked(listWishlist).mockResolvedValue([]);
    jest.mocked(addToWishlist).mockResolvedValue(undefined);
    jest.mocked(removeFromWishlist).mockResolvedValue(undefined);
    const db = createMockPrisma();
    const caller = signedIn(db);
    expect(await caller.getWishlist()).toEqual([]);
    expect(listWishlist).toHaveBeenCalledWith(db, "u1");
    expect(await caller.addToWishlist({ cardId: "card_1" })).toEqual({
      cardId: "card_1",
      wished: true,
    });
    expect(addToWishlist).toHaveBeenCalledWith(db, "u1", "card_1");
    expect(await caller.removeFromWishlist({ cardId: "card_1" })).toEqual({
      cardId: "card_1",
      wished: false,
    });
    expect(removeFromWishlist).toHaveBeenCalledWith(db, "u1", "card_1");
  });

  it("refuse a signed-out caller", async () => {
    const signedOut = createCaller(createMockRouterContext({ auth: null, user: null }) as never);
    // The auth middleware throws the app's UnauthorizedError; a server caller wraps it as the cause.
    const unauthorized = { cause: { code: "UNAUTHORIZED" } };
    await expect(signedOut.getWishlist()).rejects.toMatchObject(unauthorized);
    await expect(signedOut.addToWishlist({ cardId: "card_1" })).rejects.toMatchObject(unauthorized);
    await expect(signedOut.removeFromWishlist({ cardId: "card_1" })).rejects.toMatchObject(
      unauthorized
    );
    expect(listWishlist).not.toHaveBeenCalled();
    expect(addToWishlist).not.toHaveBeenCalled();
    expect(removeFromWishlist).not.toHaveBeenCalled();
  });

  it("bound the card id", async () => {
    const caller = signedIn();
    for (const cardId of ["", "c".repeat(65)]) {
      await expect(caller.addToWishlist({ cardId })).rejects.toMatchObject({ code: "BAD_REQUEST" });
      await expect(caller.removeFromWishlist({ cardId })).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
    }
    expect(addToWishlist).not.toHaveBeenCalled();
    expect(removeFromWishlist).not.toHaveBeenCalled();
    jest.mocked(addToWishlist).mockResolvedValue(undefined);
    await expect(caller.addToWishlist({ cardId: "c".repeat(64) })).resolves.toMatchObject({
      wished: true,
    });
  });

  it("rate-limit each change on its own bucket, and refuse a player over the limit", async () => {
    jest.mocked(addToWishlist).mockResolvedValue(undefined);
    jest.mocked(removeFromWishlist).mockResolvedValue(undefined);
    const caller = signedIn();
    await caller.addToWishlist({ cardId: "card_1" });
    await caller.removeFromWishlist({ cardId: "card_1" });
    const limit = { maxRequests: 60, windowMs: 60_000 };
    expect(check).toHaveBeenCalledWith("user:u1", "mutation:addToWishlist", limit);
    expect(check).toHaveBeenCalledWith("user:u1", "mutation:removeFromWishlist", limit);
    jest.clearAllMocks();

    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    check.mockResolvedValue({ success: false, remaining: 0, resetAt: new Date() });
    await expect(caller.addToWishlist({ cardId: "card_1" })).rejects.toThrow(/Too many requests/);
    await expect(caller.removeFromWishlist({ cardId: "card_1" })).rejects.toThrow(
      /Too many requests/
    );
    expect(addToWishlist).not.toHaveBeenCalled();
    expect(removeFromWishlist).not.toHaveBeenCalled();
  });

  it("pass the wishlist's refusals through unchanged", async () => {
    jest.mocked(addToWishlist).mockRejectedValue(
      new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Your wishlist holds 200 cards. Remove one first.",
      })
    );
    await expect(signedIn().addToWishlist({ cardId: "card_1" })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: "Your wishlist holds 200 cards. Remove one first.",
    });
  });
});
