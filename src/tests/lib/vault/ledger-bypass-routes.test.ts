/**
 * Code audit VT-4 / VT-5 / VT-23: pack purchases used to write `myVault` directly, skipping the
 * ledger (lifetimeSpent, kill switches, maintenance mode) and using non-enum transaction types.
 * These run the real ledger against an in-memory vault to prove the route now goes through it.
 */

import { purchasePack } from "~/lib/cards/pack-service";
import { invalidateVaultConfigCache } from "~/lib/vault/vault-perks";

const USER = "user_db_id_1";

interface State {
  credits: number;
  lifetimeSpent: number;
  maintenance: boolean;
  packsEnabled: boolean;
  rows: any[];
}

function makeDb(over: Partial<State> = {}) {
  const state: State = {
    credits: 1000,
    lifetimeSpent: 0,
    maintenance: false,
    packsEnabled: true,
    rows: [],
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
      }),
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

  it("refuses when the balance is short", async () => {
    const { db, state } = makeDb({ credits: 100 });
    await expect(purchasePack(db, USER, "pack_1")).rejects.toThrow(/Insufficient credits/);
    expect(state.credits).toBe(100);
    expect(db.userPack.create).not.toHaveBeenCalled();
  });
});
