/**
 * Nation treasuries (Exchange Phase 3): stipends capped per nation, taxes and LOBBY moved from
 * a payer rather than minted, short payers rolled back whole, and retried moves applied once.
 */
jest.mock("~/lib/exchange/notify", () => ({
  notifyExchange: jest.fn(),
  sendExchangeNotices: jest.fn(),
}));
import type { Db } from "~/lib/exchange/guards";
import {
  creditTreasuryTx,
  debitTreasuryTx,
  getOrCreateTreasury,
  mintStipendTx,
  stipendFor,
  transferToTreasuryTx,
  treasurySummary,
} from "~/lib/exchange/treasury";
import { invalidateExchangeConfigCache } from "~/lib/vault/exchange-config";
import { ExchangeError } from "~/lib/vault/exchange-service";
import { createFakeExchangeDb, type FakeDb } from "~/tests/helpers/fake-exchange-db";

const REALM = "default";
const NATION = "nation_a";
const CAP = 1000;

let fake: FakeDb;

function setup(companyCapital = 500, walletSovereigns = 5000) {
  invalidateExchangeConfigCache();
  fake = createFakeExchangeDb({
    user: [{ id: "alice", clerkUserId: "c_alice" }],
    exchangeWallet: [
      {
        id: "w_alice",
        userId: "alice",
        sovereigns: walletSovereigns,
        lifetimeEarned: walletSovereigns,
        lifetimeSpent: 0,
      },
    ],
    company: [
      {
        id: "co1",
        name: "Acme",
        founderId: "alice",
        realmId: REALM,
        sectorKey: "industry",
        capital: companyCapital,
        status: "ACTIVE",
      },
    ],
  });
}

const inTx = <T>(fn: (tx: Db) => Promise<T>): Promise<T> => fake.client.$transaction(fn);

const treasury = () => fake.tables.nationTreasury?.find((t) => t.countryId === NATION);
const balance = () => treasury()?.balance ?? 0;
const entries = () => fake.tables.nationTreasuryEntry ?? [];
const company = () => fake.tables.company!.find((c) => c.id === "co1")!;
const walletSov = () => fake.tables.exchangeWallet!.find((w) => w.userId === "alice")!.sovereigns;

const mint = (amount: number, key: string, ixTime = 1000) =>
  inTx((tx) =>
    mintStipendTx(tx, { countryId: NATION, realmId: REALM, ixTime, cap: CAP, amount, key })
  );

const companyTax = (amount: number, key: string) =>
  inTx((tx) =>
    transferToTreasuryTx(tx, {
      from: { kind: "COMPANY", companyId: "co1" },
      countryId: NATION,
      realmId: REALM,
      amount,
      type: "TAX",
      source: "CORPORATE_TAX:co1",
      key,
    })
  );

describe("stipendFor", () => {
  it.each([
    ["Impoverished", 125],
    ["Developing", 187.5],
    ["Developed", 250],
    ["Healthy", 312.5],
    ["Strong", 375],
    ["Very Strong", 437.5],
    ["Extravagant", 500],
  ])("scales a 250 base for %s to %d", (tier, expected) => {
    expect(stipendFor(tier, 250)).toBe(expected);
  });

  it("gives an unknown or prototype-named tier the 1x base", () => {
    expect(stipendFor("Mystery", 250)).toBe(250);
    expect(stipendFor("constructor", 250)).toBe(250);
  });

  it("rounds to two decimals", () => {
    expect(stipendFor("Developing", 62.5)).toBe(46.88);
  });
});

describe("getOrCreateTreasury", () => {
  beforeEach(() => setup());

  it("creates the treasury once with zero balances and is idempotent", async () => {
    await inTx((tx) => getOrCreateTreasury(tx, NATION, REALM));
    const again = await inTx((tx) => getOrCreateTreasury(tx, NATION, REALM));
    expect(fake.tables.nationTreasury).toHaveLength(1);
    expect(again).toMatchObject({ countryId: NATION, realmId: REALM, balance: 0 });
  });
});

describe("mintStipendTx", () => {
  beforeEach(() => setup());

  it("cuts a stipend to the room left under the cap", async () => {
    expect(await mint(600, "stipend:1")).toBe(600);
    expect(await mint(600, "stipend:2")).toBe(400);
    expect(await mint(50, "stipend:3", 2000)).toBe(0);
    expect(balance()).toBe(CAP);
    expect(treasury()).toMatchObject({ lifetimeStipend: CAP, lastStipendIxTime: 1000 });
    expect(entries()).toHaveLength(2);
  });

  it("records a STIPEND ledger row with the balance after and the key", async () => {
    await mint(62.5, "stipend:nation_a:1", 42);
    expect(entries()[0]).toMatchObject({
      countryId: NATION,
      type: "STIPEND",
      amount: 62.5,
      balanceAfter: 62.5,
      ixTime: 42,
      idempotencyKey: "stipend:nation_a:1",
    });
  });

  it("applies a retried tick with the same key once", async () => {
    expect(await mint(62.5, "stipend:nation_a:7")).toBe(62.5);
    expect(await mint(62.5, "stipend:nation_a:7")).toBe(0);
    expect(balance()).toBe(62.5);
    expect(entries()).toHaveLength(1);
  });

  it("writes nothing for a zero or negative stipend", async () => {
    expect(await mint(0, "stipend:zero")).toBe(0);
    expect(await mint(-5, "stipend:neg")).toBe(0);
    expect(entries()).toHaveLength(0);
  });
});

describe("transferToTreasuryTx", () => {
  beforeEach(() => setup(500));

  it("moves a company's tax out of capital into the treasury by the same amount", async () => {
    expect(await companyTax(120, "tax:co1:1")).toBe(120);
    expect(company().capital).toBe(380);
    expect(balance()).toBe(120);
    expect(treasury()).toMatchObject({ lifetimeTaxEarned: 120 });
    expect(entries()[0]).toMatchObject({
      type: "TAX",
      amount: 120,
      balanceAfter: 120,
      idempotencyKey: "tax:co1:1:treasury",
    });
  });

  it("refreshes the company's fair value after the capital move", async () => {
    await companyTax(120, "tax:co1:2");
    const history = fake.tables.companyValueHistory ?? [];
    expect(history.length).toBeGreaterThan(0);
    expect(company().fairValue).toBe(history[history.length - 1]!.fairValue);
  });

  it("applies a retried company payment once", async () => {
    expect(await companyTax(120, "tax:co1:3")).toBe(120);
    expect(await companyTax(120, "tax:co1:3")).toBe(0);
    expect(company().capital).toBe(380);
    expect(balance()).toBe(120);
  });

  it("leaves both sides unchanged when the company is short", async () => {
    setup(50);
    await expect(companyTax(80, "tax:co1:4")).rejects.toBeInstanceOf(ExchangeError);
    await expect(companyTax(80, "tax:co1:4")).rejects.toMatchObject({
      code: "INSUFFICIENT_SOVEREIGNS",
    });
    expect(company().capital).toBe(50);
    expect(balance()).toBe(0);
    expect(entries()).toHaveLength(0);
  });

  it("pays a wallet's LOBBY money through the wallet ledger", async () => {
    const pay = () =>
      inTx((tx) =>
        transferToTreasuryTx(tx, {
          from: { kind: "WALLET", userId: "alice" },
          countryId: NATION,
          realmId: REALM,
          amount: 300,
          type: "LOBBY",
          source: "LOBBY:co1",
          key: "lobby:1",
        })
      );
    expect(await pay()).toBe(300);
    expect(await pay()).toBe(0);
    expect(walletSov()).toBe(4700);
    expect(balance()).toBe(300);
    expect(fake.tables.exchangeTransaction).toEqual([
      expect.objectContaining({
        sovereigns: -300,
        balanceAfter: 4700,
        type: "TREASURY_PAYMENT",
        idempotencyKey: "lobby:1",
      }),
    ]);
    expect(entries()[0]).toMatchObject({ type: "LOBBY", idempotencyKey: "lobby:1:treasury" });
  });

  it("rejects a wallet that cannot cover the payment without moving ₷", async () => {
    setup(500, 100);
    await expect(
      inTx((tx) =>
        transferToTreasuryTx(tx, {
          from: { kind: "WALLET", userId: "alice" },
          countryId: NATION,
          realmId: REALM,
          amount: 300,
          type: "LOBBY",
          source: "LOBBY:co1",
          key: "lobby:2",
        })
      )
    ).rejects.toMatchObject({ code: "INSUFFICIENT_SOVEREIGNS" });
    expect(walletSov()).toBe(100);
    expect(entries()).toHaveLength(0);
  });

  it("does not cap taxes: they can take a treasury past the stipend cap", async () => {
    setup(800);
    await mint(CAP, "stipend:full");
    await companyTax(500, "tax:co1:5");
    expect(balance()).toBe(CAP + 500);
  });
});

describe("creditTreasuryTx", () => {
  beforeEach(() => setup());

  it("credits a refund once per key without a payer", async () => {
    const refund = () =>
      inTx((tx) =>
        creditTreasuryTx(tx, {
          countryId: NATION,
          realmId: REALM,
          amount: 40,
          type: "B2G_REFUND",
          source: "TENDER:t1",
          key: "refund:t1",
        })
      );
    expect(await refund()).toBe(40);
    expect(await refund()).toBe(0);
    expect(balance()).toBe(40);
    expect(entries()[0]).toMatchObject({ type: "B2G_REFUND", amount: 40 });
  });
});

describe("debitTreasuryTx", () => {
  beforeEach(() => setup());

  const debit = (amount: number, key: string) =>
    inTx((tx) =>
      debitTreasuryTx(tx, {
        countryId: NATION,
        amount,
        type: "B2G_ESCROW",
        source: "TENDER:t2",
        key,
      })
    );

  it("throws when the treasury is short and leaves the balance unchanged", async () => {
    await mint(100, "stipend:debit");
    await expect(debit(150, "escrow:1")).rejects.toMatchObject({
      code: "INSUFFICIENT_SOVEREIGNS",
    });
    expect(balance()).toBe(100);
    expect(entries()).toHaveLength(1);
  });

  it("throws when there is no treasury at all", async () => {
    await expect(debit(10, "escrow:none")).rejects.toBeInstanceOf(ExchangeError);
    expect(fake.tables.nationTreasuryEntry ?? []).toHaveLength(0);
  });

  it("debits and writes a negative ledger row counted as spending", async () => {
    await mint(100, "stipend:spend");
    expect(await debit(40, "escrow:2")).toBe(40);
    expect(balance()).toBe(60);
    expect(treasury()).toMatchObject({ lifetimeSpent: 40 });
    expect(entries()[1]).toMatchObject({ type: "B2G_ESCROW", amount: -40, balanceAfter: 60 });
  });
});

describe("treasurySummary", () => {
  beforeEach(() => setup());

  it("returns zeros for a nation with no treasury yet", async () => {
    const summary = await treasurySummary(fake.client, NATION, CAP);
    expect(summary).toEqual({
      balance: 0,
      cap: CAP,
      lifetimeStipend: 0,
      lifetimeTaxEarned: 0,
      lifetimeTariffEarned: 0,
      lifetimeInterestEarned: 0,
      lifetimeSpent: 0,
      lastStipendIxTime: null,
      recent: [],
    });
  });

  it("reports balances, lifetime counters, the cap and recent entries", async () => {
    await mint(250, "stipend:s1", 77);
    await companyTax(120, "tax:co1:s");
    const summary = await treasurySummary(fake.client, NATION, CAP);
    expect(summary).toMatchObject({
      balance: 370,
      cap: CAP,
      lifetimeStipend: 250,
      lifetimeTaxEarned: 120,
      lastStipendIxTime: 77,
    });
    expect(summary.recent).toHaveLength(2);
  });

  it("returns at most the last 20 entries", async () => {
    for (let i = 0; i < 25; i++) await mint(1, `stipend:many:${i}`, i);
    const summary = await treasurySummary(fake.client, NATION, CAP);
    expect(summary.recent).toHaveLength(20);
    expect(summary.balance).toBe(25);
  });
});
