/**
 * Code audit VT-16: the Sovereign (₷) wallet. `spend` used to read the balance, compare
 * and then decrement, so two concurrent spends could both pass and overdraw the wallet.
 * It is now a conditional decrement, and moves with an idempotency key apply once.
 */
import { centsOf, dbCents, fromCents, toCents } from "~/lib/exchange/amounts";
import {
  exchangeService,
  getOrCreateWallet,
  spendSovereignsTx,
} from "~/lib/vault/exchange-service";
import { invalidateExchangeConfigCache } from "~/lib/vault/exchange-config";
import { createFakeExchangeDb, type FakeDb } from "~/tests/helpers/fake-exchange-db";

let fake: FakeDb;

function balanceCents(): bigint {
  return fake.tables.exchangeWallet![0]!.sovereigns as bigint;
}

function balance(): number {
  return fromCents(centsOf(balanceCents()));
}

function ledgerSumCents(): bigint {
  return (fake.tables.exchangeTransaction ?? []).reduce(
    (s: bigint, r) => s + (r.sovereigns as bigint),
    0n
  );
}

function ledgerSum(): number {
  return fromCents(centsOf(ledgerSumCents()));
}

beforeEach(() => {
  invalidateExchangeConfigCache();
  fake = createFakeExchangeDb({ user: [{ id: "u1", clerkUserId: "clerk_1" }] });
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe("wallet creation", () => {
  it("seeds 1,000 ₷ once, even when first visits race", async () => {
    await Promise.all(
      Array.from({ length: 5 }, () => exchangeService.getBalance("u1", fake.client))
    );
    expect(fake.tables.exchangeWallet).toHaveLength(1);
    expect(balance()).toBe(1000);
    const seeds = fake.tables.exchangeTransaction!.filter((r) => r.source === "WALLET_SEED");
    expect(seeds).toHaveLength(1);
  });
});

describe("spend", () => {
  it("never overdraws under concurrent spends", async () => {
    await getOrCreateWallet("u1", fake.client);
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        exchangeService.spend("u1", 300, "STADIUM_UPGRADE", `T:${i}`, fake.client)
      )
    );
    expect(results.filter((r) => r.success)).toHaveLength(3);
    expect(balance()).toBe(100);
    expect(balance()).toBeGreaterThanOrEqual(0);
    // The ledger explains the balance exactly: seed + every move
    expect(ledgerSum()).toBe(balance());
    const failed = results.find((r) => !r.success);
    expect(failed?.message).toMatch(/Insufficient Sovereigns/);
  });

  it("refuses a spend larger than the balance and writes nothing", async () => {
    await getOrCreateWallet("u1", fake.client);
    const r = await exchangeService.spend("u1", 5000, "CHARTER_FEE", "X", fake.client);
    expect(r).toMatchObject({ success: false, newBalance: 1000 });
    expect(fake.tables.exchangeTransaction).toHaveLength(1); // the seed only
  });

  it("rejects zero, negative and non-finite amounts", async () => {
    for (const amount of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const r = await exchangeService.spend("u1", amount, "CHARTER_FEE", "X", fake.client);
      expect(r.success).toBe(false);
    }
  });

  it("works inside the caller's transaction (MyClub predictions) and throws to roll it back", async () => {
    await getOrCreateWallet("u1", fake.client);
    await expect(
      fake.client.$transaction(async (tx: any) => {
        await spendSovereignsTx(tx, {
          userId: "u1",
          amount: 400,
          type: "PREDICTION_STAKE",
          source: "A",
        });
        await spendSovereignsTx(tx, {
          userId: "u1",
          amount: 700,
          type: "PREDICTION_STAKE",
          source: "B",
        });
      })
    ).rejects.toMatchObject({ code: "INSUFFICIENT_SOVEREIGNS" });
    // The first debit was rolled back with the transaction
    expect(balance()).toBe(1000);
  });
});

describe("idempotency", () => {
  it("applies concurrent duplicates once", async () => {
    await getOrCreateWallet("u1", fake.client);
    const opts = { idempotencyKey: "exchange:test:u1:req-2" };
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        exchangeService.spend("u1", 300, "CHARTER_FEE", "X", fake.client, undefined, opts)
      )
    );
    expect(results.every((r) => r.success)).toBe(true);
    expect(results.filter((r) => !r.alreadyApplied)).toHaveLength(1);
    expect(balance()).toBe(700);
    expect(ledgerSum()).toBe(700);
  });

  it("applies a retried earn once", async () => {
    const opts = { idempotencyKey: "exchange:test:u1:earn-1" };
    await exchangeService.earn("u1", 50, "CONTRACT_PAYOUT", "X", fake.client, undefined, opts);
    await exchangeService.earn("u1", 50, "CONTRACT_PAYOUT", "X", fake.client, undefined, opts);
    expect(balance()).toBe(1050);
    expect(balanceCents()).toBe(1050_00n);
  });
});

describe("integer cents boundary helpers & drift prevention", () => {
  it("converts between bigint cents, number cents and Sovereigns and rejects unsafe integers", () => {
    expect(toCents(12.34)).toBe(1234);
    expect(fromCents(1234)).toBe(12.34);
    expect(dbCents(1234)).toBe(1234n);
    expect(centsOf(1234n)).toBe(1234);
    expect(centsOf(-500n)).toBe(-500);
    expect(() => dbCents(1.5)).toThrow(RangeError);
    expect(() => dbCents(Number.NaN)).toThrow(RangeError);
    expect(() => centsOf(BigInt(Number.MAX_SAFE_INTEGER) + 1n)).toThrow(RangeError);
  });

  it("stores exact BigInt cents across 1,000 alternating ₷0.10 / ₷0.20 moves without float drift", async () => {
    await getOrCreateWallet("u1", fake.client);
    for (let i = 0; i < 500; i++) {
      await exchangeService.spend("u1", 0.1, "CHARTER_FEE", `S1:${i}`, fake.client);
      await exchangeService.spend("u1", 0.2, "CHARTER_FEE", `S2:${i}`, fake.client);
      await exchangeService.earn("u1", 0.1, "CONTRACT_PAYOUT", `E1:${i}`, fake.client);
      await exchangeService.earn("u1", 0.2, "CONTRACT_PAYOUT", `E2:${i}`, fake.client);
    }
    expect(balanceCents()).toBe(1000_00n);
    expect(ledgerSumCents()).toBe(1000_00n);
    // Spend the exact remaining balance down to 0
    const all = await exchangeService.spend("u1", 1000, "CHARTER_FEE", "ALL", fake.client);
    expect(all).toMatchObject({ success: true, newBalance: 0 });
    expect(balanceCents()).toBe(0n);
  });
});
