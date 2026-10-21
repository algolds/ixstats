/**
 * Code audit VT-4 / VT-5 / VT-23: pack purchases used to write `myVault` directly, skipping the
 * ledger (lifetimeSpent, kill switches, maintenance mode) and using non-enum transaction types.
 * These run the real ledger against an in-memory vault to prove the route now goes through it.
 */

import { DEFAULT_PACK_ODDS } from "~/lib/cards/pack-odds";
import { purchasePack } from "~/lib/cards/pack-service";
import { invalidateVaultConfigCache } from "~/lib/vault/vault-perks";

const USER = "user_db_id_1";

interface State {
  credits: number;
  lifetimeSpent: number;
  maintenance: boolean;
  packsEnabled: boolean;
  rows: any[];
  /** The pack pool's cards of each rarity. */
  tiers: Record<string, number>;
  /** Columns written over the pack's. */
  pack: Record<string, unknown>;
}

function makeDb(over: Partial<State> = {}) {
  const state: State = {
    credits: 1000,
    lifetimeSpent: 0,
    maintenance: false,
    packsEnabled: true,
    rows: [],
    tiers: { COMMON: 9, UNCOMMON: 9, RARE: 9, ULTRA_RARE: 9, EPIC: 9, LEGENDARY: 9 },
    pack: {},
    ...over,
  };
  const vaultRow = () => ({
    id: "v1",
    userId: USER,
    credits: state.credits,
    lastDailyReset: new Date(),
    todayEarned: 0,
  });
  const db: any = {
    systemConfig: {
      findMany: jest.fn().mockImplementation(async () => [
        { key: "vault_isMaintenanceMode", value: String(state.maintenance) },
        { key: "vault_isPacksEnabled", value: String(state.packsEnabled) },
      ]),
    },
    user: { findFirst: jest.fn().mockResolvedValue({ id: USER }) },
    myVault: {
      upsert: jest.fn().mockImplementation(async () => vaultRow()),
      updateMany: jest.fn().mockImplementation(async ({ where, data }: any) => {
        if (where.credits?.gte !== undefined && state.credits < where.credits.gte) {
          return { count: 0 };
        }
        state.credits -= data.credits.decrement;
        state.lifetimeSpent += data.lifetimeSpent.increment;
        return { count: 1 };
      }),
      findUniqueOrThrow: jest.fn().mockImplementation(async () => vaultRow()),
    },
    vaultTransaction: {
      create: jest.fn().mockImplementation(async ({ data }: any) => {
        state.rows.push(data);
        return { id: "t" };
      }),
    },
    cardPack: {
      findUnique: jest.fn().mockResolvedValue({
        id: "pack_1",
        name: "Test Pack",
        isActive: true,
        expiresAt: null,
        purchaseLimit: null,
        limitedQuantity: null,
        priceCredits: 150,
        ...DEFAULT_PACK_ODDS,
        guaranteedRarity: null,
        cardType: null,
        season: null,
        themeFilter: null,
        ...state.pack,
      }),
    },
    card: {
      findMany: jest.fn().mockResolvedValue([]),
      groupBy: jest.fn(async () =>
        Object.entries(state.tiers).map(([rarity, all]) => ({ rarity, _count: { _all: all } }))
      ),
    },
    userPack: {
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockResolvedValue({ id: "up_1" }),
    },
  };
  db.$transaction = jest.fn((cb: (tx: any) => Promise<unknown>) => cb(db));
  return { db, state };
}

beforeEach(() => {
  invalidateVaultConfigCache();
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe("purchasePack goes through the ledger", () => {
  it("charges via SPEND_PACKS and bumps lifetimeSpent", async () => {
    const { db, state } = makeDb();

    await purchasePack(db, USER, "pack_1");

    expect(state.credits).toBe(850);
    expect(state.lifetimeSpent).toBe(150);
    expect(state.rows).toHaveLength(1);
    expect(state.rows[0]).toMatchObject({
      type: "SPEND_PACKS",
      source: "PACK_PURCHASE",
      credits: -150,
    });
    expect(db.userPack.create).toHaveBeenCalled();
  });

  it("is blocked by maintenance mode and the packs kill switch, with no pack granted", async () => {
    const maint = makeDb({ maintenance: true });
    await expect(purchasePack(maint.db, USER, "pack_1")).rejects.toMatchObject({
      code: "MAINTENANCE",
    });
    expect(maint.db.userPack.create).not.toHaveBeenCalled();

    invalidateVaultConfigCache();
    const off = makeDb({ packsEnabled: false });
    await expect(purchasePack(off.db, USER, "pack_1")).rejects.toMatchObject({
      code: "PACKS_DISABLED",
    });
    expect(off.state.credits).toBe(1000);
  });

  it("refuses to sell a pack it can't deliver, charging nothing", async () => {
    const { db, state } = makeDb({ tiers: { COMMON: 9, UNCOMMON: 9, RARE: 9, ULTRA_RARE: 9 } });
    await expect(purchasePack(db, USER, "pack_1")).rejects.toMatchObject({
      name: "PackError",
      code: "PRECONDITION_FAILED",
      message: "This pack is not on sale right now: it has no Epic and Legendary cards to give.",
    });
    expect(state.credits).toBe(1000);
    expect(state.rows).toHaveLength(0);
    expect(db.userPack.create).not.toHaveBeenCalled();
  });

  it("refuses to sell a pack whose guaranteed rarity has no cards, though its odds give none", async () => {
    const { db, state } = makeDb({
      tiers: { COMMON: 9, UNCOMMON: 9, RARE: 9, ULTRA_RARE: 9, EPIC: 9 },
      pack: { commonOdds: 65.1, legendaryOdds: 0, guaranteedRarity: "LEGENDARY" },
    });
    await expect(purchasePack(db, USER, "pack_1")).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: "This pack is not on sale right now: it has no Legendary cards to give.",
    });
    expect(state.credits).toBe(1000);
  });

  it("refuses when the balance is short", async () => {
    const { db, state } = makeDb({ credits: 100 });
    await expect(purchasePack(db, USER, "pack_1")).rejects.toThrow(/Insufficient credits/);
    expect(state.credits).toBe(100);
    expect(db.userPack.create).not.toHaveBeenCalled();
  });
});
