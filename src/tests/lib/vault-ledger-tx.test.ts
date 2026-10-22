/** @jest-environment node */
/**
 * The vault ledger (`src/lib/vault/vault-ledger.ts`) on the in-memory Prisma: its *Tx variants run on an interactive
 * transaction's client (which has no `$transaction`) and fail as a LedgerError, so the caller's transaction rolls
 * back; a spend never takes a balance below zero; the active daily cap is checked under the vault row's lock; a refund
 * is never capped. Code audit VT-23: the earning switch stops every earning type (bonuses and card sales included),
 * and only refunds still pay while it is off.
 *
 * Folds vault-concurrency and earning-kill-switch.
 */
import type { VaultTransactionType } from "@prisma/client";
import {
  earnCredits,
  earnCreditsTx,
  LedgerError,
  spendCredits,
  spendCreditsTx,
} from "~/lib/vault/vault-ledger";
import { VAULT_CONFIG_DEFAULTS } from "~/lib/vault/vault-perks";
import { createMemoryPrisma, type MemoryPrisma } from "~/tests/helpers/memory-prisma";
import {
  addPlayer,
  clearEconomyCaches,
  creditsOf,
  ledgerOf,
  type Player,
} from "~/tests/helpers/money-world";

let db: MemoryPrisma;
let mo: Player;

const spend = (amount: number) =>
  db.$transaction((tx) =>
    spendCreditsTx(tx, { userId: mo.id, amount, type: "SPEND_MARKET", source: "test_spend" })
  );
const earn = (amount: number, type: VaultTransactionType) =>
  db.$transaction((tx) => earnCreditsTx(tx, { userId: mo.id, amount, type, source: "test_earn" }));
const balance = async () => (await creditsOf(db as never, [mo.id]))[mo.id];

/** Today's EARN_ACTIVE row that uses up the whole active cap. */
async function saturateActiveCap() {
  const vault = await db.myVault.findUniqueOrThrow({ where: { userId: mo.id } });
  await db.vaultTransaction.create({
    data: {
      vaultId: vault.id,
      credits: VAULT_CONFIG_DEFAULTS.activeDailyCap,
      balanceAfter: vault.credits,
      type: "EARN_ACTIVE",
      source: "earlier_today",
    },
  });
}

beforeEach(async () => {
  clearEconomyCaches();
  db = createMemoryPrisma();
  mo = await addPlayer(db as never, "mo", 100);
  jest.spyOn(console, "log").mockImplementation(() => undefined);
  jest.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

describe("spending", () => {
  it("spends inside the caller's transaction, writing one ledger row with the balance after", async () => {
    await expect(spend(40)).resolves.toEqual({ newBalance: 60, amount: 40 });
    expect(await ledgerOf(db as never, mo.id)).toEqual([
      { credits: -40, balanceAfter: 60, type: "SPEND_MARKET", source: "test_spend" },
    ]);
  });

  it("refuses a spend the balance does not cover, naming the balance and writing nothing", async () => {
    const refused = await spend(140).catch((error: unknown) => error);
    expect(refused).toBeInstanceOf(LedgerError);
    expect(refused).toMatchObject({ code: "INSUFFICIENT_CREDITS", balance: 100 });
    expect(await balance()).toBe(100);
    expect(await ledgerOf(db as never, mo.id)).toEqual([]);
  });

  it("never lets concurrent spends take a balance below zero", async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, () => spendCredits(mo.id, 50, "SPEND_MARKET", "race", db))
    );
    expect(results.filter((r) => r.success)).toHaveLength(2);
    expect(await balance()).toBe(0);
    expect(await ledgerOf(db as never, mo.id)).toHaveLength(2);
  });
});

describe("earning", () => {
  it("caps active earnings at the daily cap under the vault row's lock, and the wrapper answers why", async () => {
    await saturateActiveCap();
    await expect(earn(50, "EARN_ACTIVE")).rejects.toMatchObject({
      code: "DAILY_CAP_REACHED",
      message: expect.stringContaining("Daily earning cap reached"),
    });
    expect(db.store.log.some((e) => e.kind === "vaults" && e.userIds[0] === mo.id)).toBe(true);
    expect(await earnCredits(mo.id, 10, "EARN_ACTIVE", "test_earn", db)).toEqual({
      success: false,
      newBalance: 0,
      message: expect.stringContaining("Daily earning cap reached"),
    });
    expect(await balance()).toBe(100);
  });

  it("never caps a refund", async () => {
    await saturateActiveCap();
    await expect(earn(50, "REFUND")).resolves.toEqual({ newBalance: 150, amount: 50 });
  });

  describe("while earning is switched off (VT-23)", () => {
    beforeEach(async () => {
      await db.systemConfig.create({ data: { key: "vault_isEarningEnabled", value: "false" } });
      clearEconomyCaches();
    });

    it.each(["EARN_ACTIVE", "EARN_SOCIAL", "EARN_PASSIVE", "EARN_BONUS", "EARN_CARDS"] as const)(
      "refuses %s, writing nothing",
      async (type) => {
        await expect(earn(25, type)).rejects.toMatchObject({ code: "EARNING_DISABLED" });
        expect(await balance()).toBe(100);
        expect(await ledgerOf(db as never, mo.id)).toEqual([]);
      }
    );

    it("still pays a refund", async () => {
      await expect(earn(25, "REFUND")).resolves.toEqual({ newBalance: 125, amount: 25 });
    });
  });
});
