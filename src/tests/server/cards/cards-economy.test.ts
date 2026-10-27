/** @jest-environment node */
/** The Economy tab's numbers are SystemConfig-backed, checked at the server, saved per section and audited. */
jest.mock("~/lib/cards/valuation", () => ({
  getValuationConfig: jest.fn().mockResolvedValue({ floorCommon: 10 }),
  readValuationConfig: jest.fn().mockResolvedValue({
    floorCommon: 10,
    floorUncommon: 30,
    floorRare: 100,
    floorUltraRare: 300,
    floorEpic: 1000,
    floorLegendary: 3000,
    nsPremium: 1.5,
    multSpecial: 2,
    multNation: 1.5,
  }),
  setValuationConfig: jest.fn(),
  clearValuationCache: jest.fn(),
}));
jest.mock("~/server/modules/cards/market-values", () => ({
  recomputeMarketValues: jest.fn().mockResolvedValue({ prices: 0, updated: 42 }),
}));
jest.mock("~/lib/cards/general-settings", () => ({
  ...jest.requireActual<typeof import("~/lib/cards/general-settings")>(
    "~/lib/cards/general-settings"
  ),
  clearGeneralCardSettingsCache: jest.fn(),
}));
jest.mock("~/lib/vault/vault-bonus", () => ({
  ...jest.requireActual<typeof import("~/lib/vault/vault-bonus")>("~/lib/vault/vault-bonus"),
  clearBonusConfigCache: jest.fn(),
}));
jest.mock("~/lib/cards/economy-config", () => {
  const actual = jest.requireActual<typeof import("~/lib/cards/economy-config")>(
    "~/lib/cards/economy-config"
  );
  return {
    ...actual,
    getEconomyConfig: jest.fn().mockResolvedValue({ listingFee: 5 }),
    readEconomyConfig: jest.fn().mockResolvedValue(actual.CARD_ECONOMY_DEFAULTS),
    setEconomyConfig: jest.fn(),
    clearEconomyConfigCache: jest.fn(),
  };
});

import {
  CARD_ECONOMY_DEFAULTS,
  readEconomyConfig,
  setEconomyConfig,
} from "~/lib/cards/economy-config";
import { setValuationConfig } from "~/lib/cards/valuation";
import {
  saveCardValues,
  saveEconomy,
  saveLorewardPayouts,
  saveMarket
} from "~/server/modules/cards/cards.economy";
import { recomputeMarketValues } from "~/server/modules/cards/market-values";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const actor = { dbId: "db_admin", clerkId: "clerk_admin" };
const upserts = (db: ReturnType<typeof createMockPrisma>) =>
  db.systemConfig.upsert.mock.calls.map(([args]) => [args.where.key, args.update.value]);

beforeEach(() => jest.clearAllMocks());

describe("card values", () => {
  it("saves the sent fields in one transaction with the audit row, then revalues every card", async () => {
    const db = createMockPrisma();
    expect(await saveCardValues(db as never, actor, { floorRare: 120, multNation: 2 })).toEqual({
      prices: 0,
      updated: 42,
    });
    expect(
      jest.mocked(setValuationConfig).mock.calls.map(([, field, value]) => [field, value])
    ).toEqual([
      ["floorRare", 120],
      ["multNation", 2],
    ]);
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "CARD_ECONOMY_SAVE",
        userId: "clerk_admin",
        details: "Card values: floorRare 120, multNation 2",
      }),
    });
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(recomputeMarketValues).toHaveBeenCalledWith(db);
    expect(jest.mocked(recomputeMarketValues).mock.invocationCallOrder[0]).toBeGreaterThan(
      db.auditLog.create.mock.invocationCallOrder[0]!
    );
  });

  it("refuses a negative value with a sentence naming the field, and writes nothing", async () => {
    const db = createMockPrisma();
    await expect(saveCardValues(db as never, actor, { floorRare: -1 })).rejects.toThrow(
      "Rare floor: enter a number from 0 to 1,000,000."
    );
    await expect(saveCardValues(db as never, actor, { floorRare: 1_000_001 })).rejects.toThrow(
      "Rare floor: enter a number from 0 to 1,000,000."
    );
    await expect(saveCardValues(db as never, actor, { multNation: 101 })).rejects.toThrow(
      "Nation card multiplier: enter a number from 0 to 100."
    );
    expect(setValuationConfig).not.toHaveBeenCalled();
    expect(db.auditLog.create).not.toHaveBeenCalled();
    expect(recomputeMarketValues).not.toHaveBeenCalled();
  });

  it("refuses floors that do not rise with rarity, read against the stored floors", async () => {
    const db = createMockPrisma();
    await expect(saveCardValues(db as never, actor, { floorEpic: 10 })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Each rarity needs a floor at least as high as the one below it",
    });
    expect(setValuationConfig).not.toHaveBeenCalled();
    expect(db.auditLog.create).not.toHaveBeenCalled();
    expect(recomputeMarketValues).not.toHaveBeenCalled();
    await saveCardValues(db as never, actor, { floorEpic: 300, floorLegendary: 300 });
    expect(setValuationConfig).toHaveBeenCalledTimes(2);
  });

  it("keeps the saved values when the revalue after them fails, and says so with a null count", async () => {
    const db = createMockPrisma();
    jest.mocked(recomputeMarketValues).mockRejectedValueOnce(new Error("statement timeout"));
    const error = jest.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await saveCardValues(db as never, actor, { floorRare: 120 })).toEqual({
      prices: null,
      updated: null,
    });
    expect(setValuationConfig).toHaveBeenCalledTimes(1);
    expect(db.auditLog.create).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});
describe("market and bonuses", () => {
  it("stores the market fee and capacity under the keys the game reads", async () => {
    const db = createMockPrisma();
    await saveMarket(db as never, actor, { auctionHouseRakePct: 7.5, maxInventoryCards: 200 });
    expect(upserts(db)).toEqual([
      ["card_system_auction_rake_pct", "7.5"],
      ["card_system_max_inventory_cards", "200"],
    ]);
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        details: "Market: auctionHouseRakePct 7.5, maxInventoryCards 200",
      }),
    });
  });

  it("refuses a fee over 50% or finer than a hundredth, and a fractional or tiny capacity", async () => {
    const db = createMockPrisma();
    await expect(saveMarket(db as never, actor, { auctionHouseRakePct: 51 })).rejects.toThrow(
      "Market fee (%): enter a number from 0 to 50 with at most 2 decimal places."
    );
    // 7.555% would be charged as 7.55% in basis points, so it is refused rather than cut short
    await expect(saveMarket(db as never, actor, { auctionHouseRakePct: 7.555 })).rejects.toThrow(
      "Market fee (%): enter a number from 0 to 50 with at most 2 decimal places."
    );
    await expect(saveMarket(db as never, actor, { maxInventoryCards: 150.5 })).rejects.toThrow(
      "Base card capacity: enter a whole number from 10 to 100,000."
    );
    await expect(saveMarket(db as never, actor, { maxInventoryCards: 9 })).rejects.toThrow(
      /from 10 to 100,000/
    );
    expect(db.systemConfig.upsert).not.toHaveBeenCalled();
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });
});

describe("Loreward payouts", () => {
  it("writes the cells under the keys the payout table reads, with one audit row", async () => {
    const db = createMockPrisma();
    await saveLorewardPayouts(db as never, actor, [
      { type: "daily", place: "runner-up", credits: 200 },
      { type: "monthly", place: "winner", credits: 5000 },
    ]);
    expect(upserts(db)).toEqual([
      ["vault_bonus_loreward_daily_runner_up", "200"],
      ["vault_bonus_loreward_monthly_winner", "5000"],
    ]);
    expect(db.auditLog.create).toHaveBeenCalledTimes(1);
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        details: "Loreward payouts: daily runner-up 200, monthly winner 5000",
      }),
    });
  });
});
describe("card economy numbers", () => {
  const written = () =>
    jest.mocked(setEconomyConfig).mock.calls.map(([, field, value]) => [field, value]);
  /** A client whose `$executeRaw` (the save's lock) resolves, as Postgres's does. */
  const economyDb = () => createMockPrisma({ $executeRaw: jest.fn().mockResolvedValue(1) });
  it("serialises the saves on one lock, taken before the stored numbers are read", async () => {
    const tx = economyDb();
    const db = createMockPrisma({
      $transaction: jest.fn((write: (client: typeof tx) => Promise<void>) => write(tx)),
    });
    await saveEconomy(db as never, actor, { xpPack: 12 });
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    const [strings, namespace] = tx.$executeRaw.mock.calls[0]!;
    expect([(strings as string[]).join("?"), namespace]).toEqual([
      "SELECT pg_advisory_xact_lock(?::int, 0)",
      7339,
    ]);
    expect(tx.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
      jest.mocked(readEconomyConfig).mock.invocationCallOrder[0]!
    );
  });

  it("refuses a number out of bounds or finer than a hundredth with its sentence, and writes nothing", async () => {
    const db = createMockPrisma();
    await expect(saveEconomy(db as never, actor, { listingDays: 61 })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Listing length (days): enter a whole number from 1 to 60.",
    });
    await expect(saveEconomy(db as never, actor, { royaltyPct: 2.555 })).rejects.toThrow(
      "Nation royalty (%): enter a number from 0 to 50 with at most 2 decimal places."
    );
    await expect(
      saveEconomy(db as never, actor, { xpPack: 12, dustFoilMult: 2.5 })
    ).rejects.toThrow("Foil dust multiple: enter a whole number from 1 to 10.");
    expect(setEconomyConfig).not.toHaveBeenCalled();
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });

  it("refuses the section rules read against the stored numbers, before any write", async () => {
    const db = economyDb();
    await expect(saveEconomy(db as never, actor, { dailyRarePct: 8 })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "The daily odds add up to 101%. Make them 100%.",
    });
    await expect(saveEconomy(db as never, actor, { fusionCopies: 2 })).rejects.toThrow(
      "The Foil dust multiple can be at most the copies per fusion, 2, or fusing would make dust."
    );
    jest
      .mocked(readEconomyConfig)
      .mockResolvedValueOnce({ ...CARD_ECONOMY_DEFAULTS, finishHoloPct: 50 });
    await expect(saveEconomy(db as never, actor, { finishFoilPct: 51 })).rejects.toThrow(
      "Foil and Holo chances add up to 101%. Keep them at 100% or less."
    );
    expect(setEconomyConfig).not.toHaveBeenCalled();
    expect(db.auditLog.create).not.toHaveBeenCalled();

    await saveEconomy(db as never, actor, { finishFoilPct: 51 });
    await saveEconomy(db as never, actor, { dailyRarePct: 8, dailyCommonPct: 64 });
    expect(written()).toEqual([
      ["finishFoilPct", 51],
      ["dailyCommonPct", 64],
      ["dailyRarePct", 8],
    ]);
  });
});
