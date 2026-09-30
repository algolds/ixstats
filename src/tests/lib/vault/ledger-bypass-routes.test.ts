/**
 * Code audit VT-4 / VT-5 / VT-23: pack purchases, lore requests and lore refunds used to
 * write `myVault` directly, skipping the ledger (lifetimeSpent, kill switches, maintenance
 * mode) and using non-enum transaction types. These run the real ledger against an
 * in-memory vault to prove each route now goes through it.
 */

jest.mock("~/server/modules/forum", () => ({
  syncUserToForum: jest.fn().mockResolvedValue(true),
}));
jest.mock("~/lib/notifications/api", () => ({
  notificationAPI: { create: jest.fn().mockResolvedValue(undefined) },
}));
jest.mock("~/lib/wiki-os/adapters/ixstates/lore-card-generator", () => ({
  wikiLoreCardGenerator: {},
}));

import { purchasePack } from "~/lib/cards/pack-service";
import { vaultService } from "~/lib/vault/vault-service";
import { getLoreTokensBalance, invalidateVaultConfigCache } from "~/lib/vault/vault-perks";
import { createCallerFactory } from "~/server/api/trpc";
import { loreCardsUserRouter } from "~/server/api/routers/lore-cards/user";
import { loreCardsAdminRouter } from "~/server/api/routers/lore-cards/admin";
import { createMockRouterContext } from "~/tests/helpers/router-context";

const USER = "user_db_id_1";

interface State {
  credits: number;
  lifetimeSpent: number;
  lifetimeEarned: number;
  vaultXp: number;
  maintenance: boolean;
  packsEnabled: boolean;
  rows: any[];
  requests: any[];
}

function makeDb(over: Partial<State> = {}) {
  const state: State = {
    credits: 1000,
    lifetimeSpent: 0,
    lifetimeEarned: 0,
    vaultXp: 0,
    maintenance: false,
    packsEnabled: true,
    rows: [],
    requests: [],
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
      findUnique: jest.fn().mockImplementation(async () => vaultRow()),
      update: jest.fn().mockImplementation(async ({ data }: any) => {
        if (data.credits?.increment) state.credits += data.credits.increment;
        if (data.lifetimeEarned?.increment) state.lifetimeEarned += data.lifetimeEarned.increment;
        if (data.vaultXp?.increment) state.vaultXp += data.vaultXp.increment;
        return vaultRow();
      }),
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
      findMany: jest
        .fn()
        .mockImplementation(async ({ where }: any = {}) =>
          state.rows.filter((r) => !where?.source || r.source === where.source)
        ),
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
    loreCardRequest: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn().mockImplementation(async () => state.requests[0] ?? null),
      create: jest.fn().mockImplementation(async ({ data }: any) => {
        const r = { id: "ckabcdefghijklmnopqrstuv", ...data };
        state.requests.push(r);
        return r;
      }),
      updateMany: jest.fn().mockImplementation(async ({ where, data }: any) => {
        const r = state.requests.find((x) => x.id === where.id && x.status === where.status);
        if (!r) return { count: 0 };
        Object.assign(r, data);
        return { count: 1 };
      }),
    },
    card: { findFirst: jest.fn().mockResolvedValue(null) },
    $queryRaw: jest.fn().mockResolvedValue([]),
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

describe("lore requests and refunds", () => {
  const userCaller = (db: any) =>
    createCallerFactory(loreCardsUserRouter)(createMockRouterContext({ db }) as never);
  const adminCaller = (db: any) =>
    createCallerFactory(loreCardsAdminRouter)(
      createMockRouterContext({
        auth: { userId: "admin_1" },
        user: { id: "db_admin", clerkUserId: "admin_1", role: { name: "admin", level: 10 } },
        db,
      }) as never
    );
  const article = { articleTitle: "Caphiria", wikiSource: "ixwiki" as const };

  it("charges 50 IxC through the ledger with a valid type", async () => {
    const { db, state } = makeDb();
    jest.spyOn(vaultService, "getLoreTokensBalance").mockResolvedValue(0);

    await userCaller(db).requestLoreCard(article);

    expect(state.credits).toBe(950);
    expect(state.lifetimeSpent).toBe(50);
    expect(state.rows[0]).toMatchObject({
      type: "SPEND_MARKET",
      source: "LORE_CARD_REQUEST",
      credits: -50,
    });
    expect(state.requests).toHaveLength(1);
  });

  it("creates no request when the ledger refuses (maintenance)", async () => {
    const { db, state } = makeDb({ maintenance: true });
    jest.spyOn(vaultService, "getLoreTokensBalance").mockResolvedValue(0);

    await expect(userCaller(db).requestLoreCard(article)).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
    expect(state.credits).toBe(1000);
  });

  it("refunds what was actually paid, through the ledger, and only once", async () => {
    const { db, state } = makeDb();
    jest.spyOn(vaultService, "getLoreTokensBalance").mockResolvedValue(0);
    await userCaller(db).requestLoreCard(article);
    expect(state.credits).toBe(950);

    await adminCaller(db).rejectRequest({ requestId: "ckabcdefghijklmnopqrstuv" });

    expect(state.credits).toBe(1000);
    expect(state.rows[1]).toMatchObject({
      type: "REFUND",
      source: "LORE_CARD_REFUND",
      credits: 50,
    });

    // A second reject must not pay again (request is no longer PENDING)
    await expect(
      adminCaller(db).rejectRequest({ requestId: "ckabcdefghijklmnopqrstuv" })
    ).rejects.toThrow();
    expect(state.credits).toBe(1000);
  });

  it("refunds a token, not 50 IxC, when the request was paid with a token", async () => {
    const { db, state } = makeDb();
    jest.spyOn(vaultService, "getLoreTokensBalance").mockResolvedValue(1);
    await userCaller(db).requestLoreCard(article);
    expect(state.credits).toBe(1000);
    expect(state.rows[0]).toMatchObject({ credits: 0 });

    await adminCaller(db).rejectRequest({ requestId: "ckabcdefghijklmnopqrstuv" });

    expect(state.credits).toBe(1000);
    expect(state.lifetimeEarned).toBe(0);
    expect(state.rows[1]).toMatchObject({ type: "REFUND", credits: 0 });
    expect(JSON.stringify(state.rows[1].metadata)).toContain("tokenRefund");
  });
});

describe("getLoreTokensBalance", () => {
  it("gives a token back when its request was rejected", async () => {
    const db: any = {
      myVault: { findUnique: jest.fn().mockResolvedValue({ id: "v1" }) },
      vaultTransaction: {
        findMany: jest
          .fn()
          .mockImplementation(async ({ where }: any) =>
            where.source === "LORE_CARD_REQUEST"
              ? [
                  { metadata: JSON.stringify({ useToken: true, requestId: "r1" }) },
                  { metadata: JSON.stringify({ tokenRefund: true, requestId: "r1" }) },
                ]
              : [{ metadata: { itemId: "token_pack" } }]
          ),
      },
      vaultStoreItem: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: "token_pack", effects: { perks: { loreTokens: 1 } } }]),
      },
    };
    // 1 granted, 1 used, 1 given back => 1 available
    expect(await getLoreTokensBalance("perks_user_refund", db)).toBe(1);
  });
});
