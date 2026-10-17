/** @jest-environment node */
/** The Economy tab's numbers are SystemConfig-backed, checked at the server, saved per section and audited. */
jest.mock("~/lib/cards/valuation", () => ({
  getValuationConfig: jest.fn().mockResolvedValue({ floorCommon: 10 }),
  setValuationConfig: jest.fn(),
  recomputeAllCardValues: jest.fn().mockResolvedValue({ updated: 42 }),
}));

import { recomputeAllCardValues, setValuationConfig } from "~/lib/cards/valuation";
import {
  economySettings,
  recomputeValues,
  saveBonuses,
  saveCardValues,
  saveDailyImport,
  saveLorewardPayouts,
  saveMarket,
  saveRarityThresholds,
} from "~/server/modules/cards/cards.economy";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const actor = { dbId: "db_admin", clerkId: "clerk_admin" };
const rising = { UNCOMMON: 5, RARE: 25, ULTRA_RARE: 45, EPIC: 65, LEGENDARY: 85 };

const upserts = (db: ReturnType<typeof createMockPrisma>) =>
  db.systemConfig.upsert.mock.calls.map(([args]) => [args.where.key, args.update.value]);

beforeEach(() => jest.clearAllMocks());

describe("card values", () => {
  it("saves the sent fields in one transaction with the audit row, then revalues every card", async () => {
    const db = createMockPrisma();
    expect(await saveCardValues(db as never, actor, { floorRare: 120, multNation: 2 })).toEqual({
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
    expect(recomputeAllCardValues).toHaveBeenCalledWith(db);
    expect(jest.mocked(recomputeAllCardValues).mock.invocationCallOrder[0]).toBeGreaterThan(
      db.auditLog.create.mock.invocationCallOrder[0]!
    );
  });

  it("refuses a negative value with a sentence naming the field, and writes nothing", async () => {
    const db = createMockPrisma();
    await expect(saveCardValues(db as never, actor, { floorRare: -1 })).rejects.toThrow(
      "Rare floor: enter a number of 0 or more."
    );
    expect(setValuationConfig).not.toHaveBeenCalled();
    expect(db.auditLog.create).not.toHaveBeenCalled();
    expect(recomputeAllCardValues).not.toHaveBeenCalled();
  });

  it("keeps the saved values when the revalue after them fails, and says so with a null count", async () => {
    const db = createMockPrisma();
    jest.mocked(recomputeAllCardValues).mockRejectedValueOnce(new Error("statement timeout"));
    const error = jest.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await saveCardValues(db as never, actor, { floorRare: 120 })).toEqual({
      updated: null,
    });
    expect(setValuationConfig).toHaveBeenCalledTimes(1);
    expect(db.auditLog.create).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it("writes, audits and revalues nothing when no field was sent", async () => {
    const db = createMockPrisma();
    expect(await saveCardValues(db as never, actor, {})).toEqual({ updated: 0 });
    expect(db.auditLog.create).not.toHaveBeenCalled();
    expect(recomputeAllCardValues).not.toHaveBeenCalled();
  });

  it("revalues every card on request and audits the count", async () => {
    const db = createMockPrisma();
    expect(await recomputeValues(db as never, actor)).toEqual({ updated: 42 });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "CARD_ECONOMY_SAVE",
        details: "Revalued 42 cards",
      }),
    });
  });
});

it("writes a section's numbers and its audit row through the transaction's client", async () => {
  const tx = createMockPrisma();
  const db = createMockPrisma({
    $transaction: jest.fn((write: (client: typeof tx) => Promise<void>) => write(tx)),
  });
  await saveMarket(db as never, actor, { maxInventoryCards: 200 });
  expect(tx.systemConfig.upsert).toHaveBeenCalledTimes(1);
  expect(tx.auditLog.create).toHaveBeenCalledTimes(1);
  expect(db.systemConfig.upsert).not.toHaveBeenCalled();
  expect(db.auditLog.create).not.toHaveBeenCalled();
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

  it("refuses a fee over 50% and a fractional or tiny capacity", async () => {
    const db = createMockPrisma();
    await expect(saveMarket(db as never, actor, { auctionHouseRakePct: 51 })).rejects.toThrow(
      "Market fee (%): enter a number from 0 to 50."
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

  it("stores bonuses, the pay switch included, and refuses a fractional amount", async () => {
    const db = createMockPrisma();
    await saveBonuses(db as never, actor, { nsPerCard: 60, enabled: 0 });
    expect(upserts(db)).toEqual([
      ["vault_bonus_enabled", "0"],
      ["vault_bonus_ns_per_card", "60"],
    ]);
    await expect(saveBonuses(db as never, actor, { newPlayer: 2.5 })).rejects.toThrow(
      "New player: enter a whole number of 0 or more."
    );
    await expect(saveBonuses(db as never, actor, { enabled: 2 })).rejects.toThrow(
      "Pay bonuses: enter a whole number from 0 to 1."
    );
    expect(db.auditLog.create).toHaveBeenCalledTimes(1);
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

  it("refuses a fractional payout or a cell sent twice, and writes nothing", async () => {
    const db = createMockPrisma();
    await expect(
      saveLorewardPayouts(db as never, actor, [{ type: "weekly", place: "winner", credits: 1.5 }])
    ).rejects.toThrow("Weekly winner: enter a whole number from 0 to 100,000.");
    await expect(
      saveLorewardPayouts(db as never, actor, [
        { type: "daily", place: "winner", credits: 1 },
        { type: "daily", place: "winner", credits: 2 },
      ])
    ).rejects.toThrow("Daily winner is listed twice.");
    expect(db.systemConfig.upsert).not.toHaveBeenCalled();
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });
});

describe("rarity tables and daily imports", () => {
  it("stores a rising table under its source's key and audits it", async () => {
    const db = createMockPrisma();
    await saveRarityThresholds(db as never, actor, { source: "althistory", thresholds: rising });
    expect(upserts(db)).toEqual([["card_rarity_thresholds_althistory", JSON.stringify(rising)]]);
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        details:
          "Rarity table: althistory UNCOMMON 5, RARE 25, ULTRA_RARE 45, EPIC 65, LEGENDARY 85",
      }),
    });
    expect(db.$transaction).toHaveBeenCalledTimes(1);
  });

  it("refuses a table that does not rise, or a score over 100, with the schema's sentence", async () => {
    const db = createMockPrisma();
    await expect(
      saveRarityThresholds(db as never, actor, {
        source: "iiwiki",
        thresholds: { ...rising, RARE: 5 },
      })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Each rarity needs a higher minimum score than the one below it",
    });
    await expect(
      saveRarityThresholds(db as never, actor, {
        source: "iiwiki",
        thresholds: { ...rising, LEGENDARY: 101 },
      })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Each minimum score must be a number from 0 to 100",
    });
    expect(db.systemConfig.upsert).not.toHaveBeenCalled();
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });

  it("stores a wiki's daily import and audits it", async () => {
    const db = createMockPrisma();
    await saveDailyImport(db as never, actor, {
      source: "althistory",
      setting: { enabled: true, count: 5 },
    });
    expect(upserts(db)).toEqual([
      ["card_daily_import_althistory", JSON.stringify({ enabled: true, count: 5 })],
    ]);
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ details: "Daily import: althistory on, 5 a day" }),
    });
    await saveDailyImport(db as never, actor, {
      source: "iiwiki",
      setting: { enabled: false, count: 20 },
    });
    expect(db.auditLog.create).toHaveBeenLastCalledWith({
      data: expect.objectContaining({ details: "Daily import: iiwiki off" }),
    });
  });

  it("refuses a daily count over the cap with a sentence naming the wiki", async () => {
    const db = createMockPrisma();
    await expect(
      saveDailyImport(db as never, actor, {
        source: "althistory",
        setting: { enabled: true, count: 101 },
      })
    ).rejects.toThrow("AltHistory Wiki cards a day: enter a whole number from 0 to 100.");
    expect(db.systemConfig.upsert).not.toHaveBeenCalled();
  });
});

it("reads every section the tab shows", async () => {
  const db = createMockPrisma();
  const settings = await economySettings(db as never);
  expect(Object.keys(settings)).toEqual([
    "values",
    "market",
    "bonuses",
    "lorewardPayouts",
    "rarityThresholds",
    "dailyImports",
  ]);
  expect(settings.values).toEqual({ floorCommon: 10 });
  expect(settings.lorewardPayouts.daily.winner).toBe(500);
  expect(settings.dailyImports.althistory).toEqual({ enabled: false, count: 0 });
});
