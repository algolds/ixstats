/** @jest-environment node */
/**
 * VT-9: the card general settings the admin panel shows are the ones the game reads —
 * the house rake (marketplace fee) and base card capacity.
 */
import { describe, it, expect } from "@jest/globals";
import type { PrismaClient } from "@prisma/client";

type Mod = typeof import("~/lib/cards/general-settings");

function load(): Mod {
  let mod!: Mod;
  jest.isolateModules(() => {
    mod = require("~/lib/cards/general-settings");
  });
  return mod;
}

function dbWith(rows: Array<{ key: string; value: string }>): Pick<PrismaClient, "systemConfig"> {
  return { systemConfig: { findMany: jest.fn().mockResolvedValue(rows) } } as never;
}

describe("card general settings", () => {
  it("defaults match the previously hard-coded game values (10% rake, 150 cards)", async () => {
    const { getGeneralCardSettings } = load();
    const s = await getGeneralCardSettings(dbWith([]));
    expect(s.auctionHouseRakePct).toBe(10);
    expect(s.maxInventoryCards).toBe(150);
    expect(Object.keys(s).sort()).toEqual(["auctionHouseRakePct", "maxInventoryCards"]);
  });

  it("marketplaceFee uses the configured rake and spares sales of 100 IxC or less", async () => {
    const { marketplaceFee } = load();
    const db = dbWith([{ key: "card_system_auction_rake_pct", value: "5" }]);
    expect(await marketplaceFee(db, 100)).toBe(0);
    expect(await marketplaceFee(db, 1000)).toBe(50);
  });

  it("marketplaceFee falls back to 10% and clamps the rake to 50%", async () => {
    expect(await load().marketplaceFee(dbWith([]), 1000)).toBe(100);
    const db = dbWith([{ key: "card_system_auction_rake_pct", value: "90" }]);
    expect(await load().marketplaceFee(db, 1000)).toBe(500);
  });

  it("marketplaceFee spares amounts at or under the Economy tab's threshold", async () => {
    const db = dbWith([{ key: "card_economy_sale_fee_threshold", value: "500" }]);
    expect(await load().marketplaceFee(db, 500)).toBe(0);
    expect(await load().marketplaceFee(db, 1000)).toBe(100);
  });

  it("a setter in a transaction leaves the cache to its caller, which clears it after the commit", async () => {
    const { clearGeneralCardSettingsCache, getGeneralCardSettings, setGeneralCardSetting } = load();
    const read = dbWith([]);
    await getGeneralCardSettings(read);
    await setGeneralCardSetting(
      { systemConfig: { upsert: jest.fn() } } as never,
      "maxInventoryCards",
      200
    );
    await getGeneralCardSettings(read);
    expect(read.systemConfig.findMany).toHaveBeenCalledTimes(1);
    clearGeneralCardSettingsCache();
    await getGeneralCardSettings(read);
    expect(read.systemConfig.findMany).toHaveBeenCalledTimes(2);
    const app = { systemConfig: { upsert: jest.fn() }, $transaction: jest.fn() };
    await setGeneralCardSetting(app as never, "maxInventoryCards", 200);
    await getGeneralCardSettings(read);
    expect(read.systemConfig.findMany).toHaveBeenCalledTimes(3);
  });

  it("baseCardCapacity reads the admin capacity", async () => {
    const db = dbWith([{ key: "card_system_max_inventory_cards", value: "400" }]);
    expect(await load().baseCardCapacity(db)).toBe(400);
  });
});
