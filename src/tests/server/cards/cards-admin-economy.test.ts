/** @jest-environment node */
/** The Economy tab's saves: admin only, and every number reaches the module, none dropped as an unknown key. */
jest.mock("~/server/modules/cards/cards.economy", () => ({
  economySettings: jest.fn(),
  recomputeValues: jest.fn(),
  saveBonuses: jest.fn(),
  saveCardValues: jest.fn().mockResolvedValue({ prices: 0, updated: 0 }),
  saveDailyImport: jest.fn(),
  saveEconomy: jest.fn(),
  saveLorewardPayouts: jest.fn(),
  saveMarket: jest.fn(),
  saveRarityThresholds: jest.fn(),
}));

import { createCallerFactory } from "~/server/api/trpc";
import { cardsAdminEconomyRouter } from "~/server/api/routers/cards/admin/economy";
import { CARD_ECONOMY_DEFAULTS } from "~/lib/cards/economy-config";
import { CARD_VALUATION_DEFAULTS } from "~/lib/cards/valuation";
import { saveCardValues, saveEconomy } from "~/server/modules/cards/cards.economy";
import { createMockPrisma } from "~/tests/helpers/mock-db";
import { createMockRouterContext } from "~/tests/helpers/router-context";

const callerAs = (db: ReturnType<typeof createMockPrisma>, role: "admin" | "user") =>
  createCallerFactory(cardsAdminEconomyRouter)(
    createMockRouterContext({
      db,
      auth: { userId: "clerk_x" },
      user: {
        id: "db_x",
        clerkUserId: "clerk_x",
        role: role === "admin" ? { name: "admin", level: 10 } : { name: "user", level: 100 },
      },
    }) as never
  );

beforeEach(() => jest.clearAllMocks());

describe("cards.admin.economy", () => {
  it("refuses a player", async () => {
    await expect(
      callerAs(createMockPrisma(), "user").saveEconomy({ listingFee: 7 })
    ).rejects.toThrow(/Admin privileges required/);
    expect(saveEconomy).not.toHaveBeenCalled();
  });

  it("passes every card economy number on as the signed-in admin", async () => {
    const db = createMockPrisma();
    await callerAs(db, "admin").saveEconomy(CARD_ECONOMY_DEFAULTS);
    expect(saveEconomy).toHaveBeenCalledWith(
      db,
      { dbId: "db_x", clerkId: "clerk_x" },
      CARD_ECONOMY_DEFAULTS
    );
  });

  it("passes every card value on, the finish, level and median numbers included", async () => {
    const db = createMockPrisma();
    await callerAs(db, "admin").saveValues(CARD_VALUATION_DEFAULTS);
    expect(saveCardValues).toHaveBeenCalledWith(
      db,
      { dbId: "db_x", clerkId: "clerk_x" },
      CARD_VALUATION_DEFAULTS
    );
  });

  it("checks only the shape, leaving the bounds to the module's sentences", async () => {
    const db = createMockPrisma();
    await callerAs(db, "admin").saveEconomy({ listingDays: 999 });
    expect(saveEconomy).toHaveBeenCalledWith(db, expect.anything(), { listingDays: 999 });
    await expect(
      callerAs(db, "admin").saveEconomy({ listingDays: "14" as never })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
