/** @jest-environment node */
/** The daily card claim hands back the real face of the copy it minted; the second claim path is gone. */
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/lib/vault/vault-service", () => ({
  vaultService: {
    claimCombinedDailyClaim: jest.fn(async () => ({
      success: true,
      rewardType: "card",
      cardAwarded: { id: "c1", ownershipId: "o1", title: "Caphiria", rarity: "EPIC", artwork: "" },
      streak: 3,
    })),
  },
}));
jest.mock("~/lib/cards/hub/faces", () => ({ ownedFaces: jest.fn(async () => [{ cardId: "c1" }]) }));
jest.mock("~/lib/notifications/api", () => ({ notificationAPI: { create: jest.fn() } }));
jest.mock("~/lib/cache", () => ({
  ...jest.requireActual("~/lib/cache"),
  globalCache: { delete: jest.fn() },
}));

import { createCallerFactory } from "~/server/api/trpc";
import { vaultDailyClaimsRouter } from "~/server/api/routers/vault/daily-claims";
import { ownedFaces } from "~/lib/cards/hub/faces";
import { vaultService } from "~/lib/vault/vault-service";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const callerFor = (db: ReturnType<typeof createMockPrisma>) =>
  createCallerFactory(vaultDailyClaimsRouter)(
    createMockRouterContext({ db, rateLimitIdentifier: `me_${Math.random()}` }) as never
  );

describe("vault daily claims", () => {
  beforeEach(() => jest.mocked(ownedFaces).mockClear());

  it("returns the face of the copy the daily card minted", async () => {
    const db = createMockPrisma();
    const result = await callerFor(db).claimCombinedDailyClaim({ choice: "CARD" });
    expect(ownedFaces).toHaveBeenCalledWith(db, ["o1"]);
    expect(result.cardFace).toEqual({ cardId: "c1" });
  });

  it("returns no face for a credits claim", async () => {
    jest.mocked(vaultService.claimCombinedDailyClaim).mockResolvedValueOnce({
      success: true,
      rewardType: "credits",
      creditsAwarded: 40,
      streak: 3,
    });
    const result = await callerFor(createMockPrisma()).claimCombinedDailyClaim({
      choice: "CREDITS",
    });
    expect(ownedFaces).not.toHaveBeenCalled();
    expect(result.cardFace).toBeNull();
  });

  it("still reports the committed claim when the face read fails", async () => {
    const quiet = jest.spyOn(console, "error").mockImplementation(() => {});
    jest.mocked(ownedFaces).mockRejectedValueOnce(new Error("connection reset"));
    try {
      const result = await callerFor(createMockPrisma()).claimCombinedDailyClaim({
        choice: "CARD",
      });
      expect(result).toMatchObject({ success: true, cardAwarded: { ownershipId: "o1" } });
      expect(result.cardFace).toBeNull();
    } finally {
      quiet.mockRestore();
    }
  });

  it("has no second daily claim", () => {
    expect("claimDailyBonus" in vaultDailyClaimsRouter._def.procedures).toBe(false);
  });
});
