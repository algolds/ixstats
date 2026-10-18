/** @jest-environment node */
/**
 * The crafting router (the card workshop): the public numbers, the signed-in player's dust, breaking down and fusing
 * their own copies, and crafting a card, with the workshop's refusals mapped for the player and their cached balance
 * dropped after a burn or a craft. Inputs are bounded.
 */
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/lib/cache", () => ({
  __esModule: true,
  ...jest.requireActual("~/lib/cache"),
  rateLimiter: { isEnabled: () => true, check: jest.fn() },
}));
jest.mock("~/lib/vault/vault-cache", () => ({ clearVaultCachesFor: jest.fn() }));
jest.mock("~/server/modules/cards/workshop/breakdown", () => ({ breakDownCopies: jest.fn() }));
jest.mock("~/server/modules/cards/workshop/craft", () => ({ craftCard: jest.fn() }));
jest.mock("~/server/modules/cards/workshop/fusion", () => ({ fuseCopies: jest.fn() }));
jest.mock("~/server/modules/cards/workshop/dust-ledger", () => ({ getDustBalances: jest.fn() }));
jest.mock("~/server/modules/cards/workshop/numbers", () => ({
  getPublicEconomyNumbers: jest.fn(),
}));

import { TRPCError } from "@trpc/server";
import { rateLimiter } from "~/lib/cache";
import { CARD_ECONOMY_DEFAULTS } from "~/lib/cards/economy-config";
import { CARD_VALUATION_DEFAULTS } from "~/lib/cards/valuation";
import { clearVaultCachesFor } from "~/lib/vault/vault-cache";
import { craftingRouter } from "~/server/api/routers/crafting";
import { createCallerFactory } from "~/server/api/trpc";
import { breakDownCopies } from "~/server/modules/cards/workshop/breakdown";
import { craftCard } from "~/server/modules/cards/workshop/craft";
import { getDustBalances } from "~/server/modules/cards/workshop/dust-ledger";
import { DustError } from "~/server/modules/cards/workshop/errors";
import { fuseCopies } from "~/server/modules/cards/workshop/fusion";
import { getPublicEconomyNumbers } from "~/server/modules/cards/workshop/numbers";
import { createMockPrisma } from "~/tests/helpers/mock-db";
import { createMockRouterContext } from "~/tests/helpers/router-context";

const createCaller = createCallerFactory(craftingRouter);
const check = jest.mocked(rateLimiter.check);
const db = createMockPrisma();
const signedIn = createCaller(
  createMockRouterContext({
    db,
    user: { id: "u1", clerkUserId: "user_1" },
    rateLimitIdentifier: "user:u1",
  }) as never
);
const signedOut = createCaller(
  createMockRouterContext({
    db,
    auth: null,
    user: null,
    rateLimitIdentifier: "ip:203.0.113.7",
  }) as never
);

beforeEach(() => {
  jest.clearAllMocks();
  check.mockResolvedValue({ success: true, remaining: 59, resetAt: new Date() });
});

describe("crafting router", () => {
  it("shows the economy's numbers to anyone, signed in or not, on the read limit", async () => {
    const numbers = {
      economy: CARD_ECONOMY_DEFAULTS,
      valuation: CARD_VALUATION_DEFAULTS,
      feeRatePct: 10,
    };
    jest.mocked(getPublicEconomyNumbers).mockResolvedValue(numbers);
    expect(await signedOut.getNumbers()).toEqual(numbers);
    expect(getPublicEconomyNumbers).toHaveBeenCalledWith(db);
    expect(check).toHaveBeenCalledWith("ip:203.0.113.7", "queries", {
      maxRequests: 120,
      windowMs: 60_000,
    });
  });

  it("shows the signed-in player their own dust", async () => {
    const dust = [{ realmId: "default", realmName: "Ixnay", realmSlug: "ixnay", balance: 50 }];
    jest.mocked(getDustBalances).mockResolvedValue(dust);
    expect(await signedIn.getDust()).toEqual(dust);
    expect(getDustBalances).toHaveBeenCalledWith(db, "u1");
  });

  it("breaks down the player's own copies and drops their cached balance", async () => {
    const result = { broken: 2, dust: [{ realmId: "default", amount: 100 }] };
    jest.mocked(breakDownCopies).mockResolvedValue(result);
    expect(await signedIn.breakDown({ ownershipIds: ["a", "b"] })).toEqual(result);
    expect(breakDownCopies).toHaveBeenCalledWith(db, { userId: "u1", ownershipIds: ["a", "b"] });
    expect(clearVaultCachesFor).toHaveBeenCalledWith(db, ["u1"]);
  });

  it("fuses the player's own copies and drops their cached balance", async () => {
    const result = { ownershipId: "a", finish: "FOIL" as const, serialNumber: 3 };
    jest.mocked(fuseCopies).mockResolvedValue(result);
    expect(await signedIn.fuse({ ownershipIds: ["a", "b", "c"] })).toEqual(result);
    expect(fuseCopies).toHaveBeenCalledWith(db, { userId: "u1", ownershipIds: ["a", "b", "c"] });
    expect(clearVaultCachesFor).toHaveBeenCalledWith(db, ["u1"]);
  });

  it("crafts a card for the player and drops their cached balance", async () => {
    const result = { ownershipId: "own_new", dust: 4000, credits: 1000 };
    jest.mocked(craftCard).mockResolvedValue(result);
    expect(await signedIn.craft({ cardId: "c1" })).toEqual(result);
    expect(craftCard).toHaveBeenCalledWith(db, { userId: "u1", cardId: "c1" });
    expect(clearVaultCachesFor).toHaveBeenCalledWith(db, ["u1"]);
  });

  it("keeps the cached balance when a craft is refused", async () => {
    jest
      .mocked(craftCard)
      .mockRejectedValue(new TRPCError({ code: "PRECONDITION_FAILED", message: "No." }));
    await expect(signedIn.craft({ cardId: "c1" })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
    expect(clearVaultCachesFor).not.toHaveBeenCalled();
  });

  it.each([
    ["an empty card id", ""],
    ["a card id past 64 characters", "x".repeat(65)],
  ])("refuses to craft %s", async (_label, cardId) => {
    await expect(signedIn.craft({ cardId })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(craftCard).not.toHaveBeenCalled();
  });

  it("crafts a 64-character card id on its own mutation limit", async () => {
    jest.mocked(craftCard).mockResolvedValue({ ownershipId: "o", dust: 40, credits: 10 });
    await signedIn.craft({ cardId: "x".repeat(64) });
    expect(craftCard).toHaveBeenCalledWith(db, { userId: "u1", cardId: "x".repeat(64) });
    expect(check).toHaveBeenCalledWith("user:u1", "mutation:craft", {
      maxRequests: 60,
      windowMs: 60_000,
    });
  });

  it("turns a dust refusal into one the player reads, and keeps the cache when nothing burned", async () => {
    jest
      .mocked(breakDownCopies)
      .mockRejectedValue(new DustError("Your dust in this realm can't go past 2,147,483,647."));
    await expect(signedIn.breakDown({ ownershipIds: ["a"] })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: "Your dust in this realm can't go past 2,147,483,647.",
    });
    jest.mocked(fuseCopies).mockRejectedValue(new DustError("No."));
    await expect(signedIn.fuse({ ownershipIds: ["a", "b", "c"] })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
    expect(clearVaultCachesFor).not.toHaveBeenCalled();
  });

  it.each([
    ["no copies", []],
    ["more than 100 copies", Array.from({ length: 101 }, (_, i) => `o${i}`)],
    ["an empty id", [""]],
    ["an id past 64 characters", ["x".repeat(65)]],
  ])("refuses %s", async (_label, ownershipIds) => {
    await expect(signedIn.breakDown({ ownershipIds })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await expect(signedIn.fuse({ ownershipIds })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(breakDownCopies).not.toHaveBeenCalled();
    expect(fuseCopies).not.toHaveBeenCalled();
  });

  it("takes 100 copies of 64-character ids", async () => {
    jest.mocked(breakDownCopies).mockResolvedValue({ broken: 100, dust: [] });
    const ownershipIds = Array.from({ length: 100 }, (_, i) => `${i}`.padStart(64, "o"));
    await signedIn.breakDown({ ownershipIds });
    expect(breakDownCopies).toHaveBeenCalledWith(db, { userId: "u1", ownershipIds });
  });

  it("refuses a signed-out caller everything but the numbers", async () => {
    // The auth middleware throws the app's UnauthorizedError; a server caller wraps it as the cause
    const unauthorized = { code: "INTERNAL_SERVER_ERROR", cause: { code: "UNAUTHORIZED" } };
    await expect(signedOut.getDust()).rejects.toMatchObject(unauthorized);
    await expect(signedOut.breakDown({ ownershipIds: ["a"] })).rejects.toMatchObject(unauthorized);
    await expect(signedOut.fuse({ ownershipIds: ["a", "b", "c"] })).rejects.toMatchObject(
      unauthorized
    );
    await expect(signedOut.craft({ cardId: "c1" })).rejects.toMatchObject(unauthorized);
    expect(craftCard).not.toHaveBeenCalled();
    expect(getDustBalances).not.toHaveBeenCalled();
    expect(breakDownCopies).not.toHaveBeenCalled();
    expect(fuseCopies).not.toHaveBeenCalled();
  });
});
