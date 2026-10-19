/** @jest-environment node */
/**
 * The trade builder's procedures: signed in, bounded, rate-limited on the read bucket, and wired to the partners module
 * with identity injected (resolve any passport handle, name by the identity rule, honour the Vault cards switch).
 */
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/lib/cache", () => ({
  __esModule: true,
  ...jest.requireActual("~/lib/cache"),
  rateLimiter: { isEnabled: () => true, check: jest.fn() },
}));
jest.mock("~/server/modules/cards/trading/partners", () => ({
  findTradePartner: jest.fn(),
  searchTradePartners: jest.fn(),
  getTradeables: jest.fn(),
  getPartnerWishlist: jest.fn(),
}));
jest.mock("~/server/modules/identity/identity.resolve", () => ({ resolveHandleUser: jest.fn() }));
jest.mock("~/server/modules/identity/identity.player-names", () => ({
  loadPlayerNames: jest.fn(),
}));
jest.mock("~/server/modules/identity/identity.privacy", () => ({
  loadVaultCardsShown: jest.fn(),
}));

import { rateLimiter } from "~/lib/cache";
import { createCallerFactory } from "~/server/api/trpc";
import { tradingRouter } from "~/server/api/routers/trading";
import { tradingBuilderRouter } from "~/server/api/routers/trading/builder";
import {
  findTradePartner,
  getPartnerWishlist,
  getTradeables,
  searchTradePartners,
  type PartnerRules,
} from "~/server/modules/cards/trading/partners";
import { loadPlayerNames } from "~/server/modules/identity/identity.player-names";
import { loadVaultCardsShown } from "~/server/modules/identity/identity.privacy";
import { resolveHandleUser } from "~/server/modules/identity/identity.resolve";
import { createMockPrisma } from "~/tests/helpers/mock-db";
import { createMockRouterContext } from "~/tests/helpers/router-context";

const createCaller = createCallerFactory(tradingBuilderRouter);
const check = jest.mocked(rateLimiter.check);
const VIEWER = { id: "u1", clerkUserId: "user_1" };
const signedIn = (db = createMockPrisma()) =>
  createCaller(
    createMockRouterContext({ db, user: VIEWER, rateLimitIdentifier: "user:u1" }) as never
  );

beforeEach(() => {
  jest.clearAllMocks();
  check.mockResolvedValue({ success: true, remaining: 100, resetAt: new Date() });
  jest.mocked(findTradePartner).mockResolvedValue(null);
  jest.mocked(searchTradePartners).mockResolvedValue([]);
  jest.mocked(getTradeables).mockResolvedValue({ items: [], nextCursor: null });
  jest.mocked(getPartnerWishlist).mockResolvedValue([]);
});

describe("trading builder procedures", () => {
  it("are on the trading router, and the old partner search is gone", () => {
    const procedures = tradingRouter._def.procedures;
    for (const name of ["findPartner", "searchPartners", "getTradeables", "getPartnerWishlist"]) {
      expect(name in procedures).toBe(true);
    }
    expect("searchTradingPartners" in procedures).toBe(false);
  });

  it("pass the signed-in viewer, the input and the identity rules to the partners module", async () => {
    const db = createMockPrisma();
    const caller = signedIn(db);
    await caller.findPartner({ handle: "@bob" });
    await caller.searchPartners({ query: "bo" });
    await caller.getTradeables({ partnerId: "u2", side: "theirs" });
    await caller.getPartnerWishlist({ partnerId: "u2" });
    expect(findTradePartner).toHaveBeenCalledWith(db, expect.any(Object), VIEWER, "@bob");
    expect(searchTradePartners).toHaveBeenCalledWith(db, expect.any(Object), VIEWER, "bo");
    expect(getTradeables).toHaveBeenCalledWith(db, expect.any(Object), VIEWER, {
      partnerId: "u2",
      side: "theirs",
      filters: {},
      limit: 30,
    });
    expect(getPartnerWishlist).toHaveBeenCalledWith(db, expect.any(Object), VIEWER, "u2");

    const rules: PartnerRules = jest.mocked(findTradePartner).mock.calls[0]![1];
    for (const fn of [searchTradePartners, getTradeables, getPartnerWishlist] as const) {
      expect(jest.mocked(fn).mock.calls[0]![1]).toBe(rules);
    }
    expect(rules.namesOf).toBe(loadPlayerNames);
    expect(rules.cardsShown).toBe(loadVaultCardsShown);
    jest.mocked(resolveHandleUser).mockResolvedValueOnce({
      id: "u2",
      clerkUserId: "user_2",
      handle: null,
      forumUsername: "Bob",
    });
    expect(await rules.userOfHandle("Bob")).toBe("u2");
    expect(resolveHandleUser).toHaveBeenCalledWith("Bob");
    jest.mocked(resolveHandleUser).mockResolvedValueOnce(null);
    expect(await rules.userOfHandle("nobody")).toBeNull();
  });

  it("refuse a signed-out caller", async () => {
    const signedOut = createCaller(createMockRouterContext({ auth: null, user: null }) as never);
    const unauthorized = { cause: { code: "UNAUTHORIZED" } };
    await expect(signedOut.findPartner({ handle: "bob" })).rejects.toMatchObject(unauthorized);
    await expect(signedOut.searchPartners({ query: "bo" })).rejects.toMatchObject(unauthorized);
    await expect(signedOut.getTradeables({ partnerId: "u2", side: "mine" })).rejects.toMatchObject(
      unauthorized
    );
    await expect(signedOut.getPartnerWishlist({ partnerId: "u2" })).rejects.toMatchObject(
      unauthorized
    );
    expect(findTradePartner).not.toHaveBeenCalled();
    expect(searchTradePartners).not.toHaveBeenCalled();
    expect(getTradeables).not.toHaveBeenCalled();
    expect(getPartnerWishlist).not.toHaveBeenCalled();
  });

  it("bound every input", async () => {
    const caller = signedIn();
    const bad = { code: "BAD_REQUEST" };
    const page = { partnerId: "u2", side: "theirs" } as const;
    await expect(caller.findPartner({ handle: "h".repeat(81) })).rejects.toMatchObject(bad);
    await expect(caller.searchPartners({ query: "q".repeat(65) })).rejects.toMatchObject(bad);
    for (const partnerId of ["", "p".repeat(65)]) {
      await expect(caller.getTradeables({ ...page, partnerId })).rejects.toMatchObject(bad);
      await expect(caller.getPartnerWishlist({ partnerId })).rejects.toMatchObject(bad);
    }
    const tooMuch = [
      { ...page, side: "both" as never },
      { ...page, cursor: "c".repeat(65) },
      { ...page, limit: 0 },
      { ...page, limit: 61 },
      { ...page, limit: 1.5 },
      { ...page, filters: { realmId: "r".repeat(65) } },
      { ...page, filters: { rarity: "MYTHIC" as never } },
      { ...page, filters: { finish: "GOLD" as never } },
      { ...page, filters: { cardType: "MEME" as never } },
      { ...page, filters: { search: "s".repeat(81) } },
    ];
    for (const input of tooMuch) {
      await expect(caller.getTradeables(input)).rejects.toMatchObject(bad);
    }
    expect(findTradePartner).not.toHaveBeenCalled();
    expect(searchTradePartners).not.toHaveBeenCalled();
    expect(getTradeables).not.toHaveBeenCalled();
    expect(getPartnerWishlist).not.toHaveBeenCalled();

    await caller.findPartner({ handle: "h".repeat(80) });
    await caller.searchPartners({ query: "q".repeat(64) });
    await caller.getPartnerWishlist({ partnerId: "p".repeat(64) });
    await caller.getTradeables({
      partnerId: "p".repeat(64),
      side: "mine",
      cursor: "c".repeat(64),
      limit: 60,
      filters: {
        realmId: "r".repeat(64),
        rarity: "RARE",
        finish: "FOIL",
        cardType: "NS",
        search: `  ${"s".repeat(80)}  `,
      },
    });
    expect(jest.mocked(getTradeables).mock.calls[0]![3]).toEqual({
      partnerId: "p".repeat(64),
      side: "mine",
      cursor: "c".repeat(64),
      limit: 60,
      filters: {
        realmId: "r".repeat(64),
        rarity: "RARE",
        finish: "FOIL",
        cardType: "NS",
        search: "s".repeat(80),
      },
    });
  });

  it("rate-limit every read on the read bucket, and refuse a player over the limit", async () => {
    const caller = signedIn();
    await caller.findPartner({ handle: "bob" });
    await caller.searchPartners({ query: "bo" });
    await caller.getTradeables({ partnerId: "u2", side: "mine" });
    await caller.getPartnerWishlist({ partnerId: "u2" });
    expect(check).toHaveBeenCalledTimes(4);
    for (const call of check.mock.calls) {
      expect(call).toEqual(["user:u1", "queries", { maxRequests: 120, windowMs: 60_000 }]);
    }
    jest.clearAllMocks();

    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      check.mockResolvedValue({ success: false, remaining: 0, resetAt: new Date() });
      const limited = /Too many requests/;
      await expect(caller.findPartner({ handle: "bob" })).rejects.toThrow(limited);
      await expect(caller.searchPartners({ query: "bo" })).rejects.toThrow(limited);
      await expect(caller.getTradeables({ partnerId: "u2", side: "mine" })).rejects.toThrow(
        limited
      );
      await expect(caller.getPartnerWishlist({ partnerId: "u2" })).rejects.toThrow(limited);
      expect(findTradePartner).not.toHaveBeenCalled();
      expect(searchTradePartners).not.toHaveBeenCalled();
      expect(getTradeables).not.toHaveBeenCalled();
      expect(getPartnerWishlist).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });
});
