/**
 * Exchange phase 2: government tenders funded from the nation owner's wallet, the expiry
 * job for lapsed OPEN contracts, contract notifications and the relaxed out allowance
 * (docs/specs/2026-10-06-exchange-economy-design.md §8).
 */
jest.mock("~/lib/exchange/notify", () => ({
  notifyExchange: jest.fn(),
  sendExchangeNotices: jest.fn(),
}));

import { foundCompany, depositToCompany } from "~/lib/exchange/companies";
import {
  DAY_MS,
  awardContract,
  cancelContract,
  completeContract,
  createContract,
  createGovernmentContract,
  disputeContract,
  placeBid,
  resolveDispute,
} from "~/lib/exchange/contracts";
import { convertOutAllowance } from "~/lib/exchange/conversion";
import { AWARD_GRACE_DAYS, expireLapsedContracts } from "~/lib/exchange/expiry";
import { notifyExchange } from "~/lib/exchange/notify";
import { IxTime } from "~/lib/ixtime";
import { invalidateExchangeConfigCache } from "~/lib/vault/exchange-config";
import { invalidateVaultConfigCache } from "~/lib/vault/vault-perks";
import { createFakeExchangeDb, type FakeDb } from "~/tests/helpers/fake-exchange-db";

let fake: FakeDb;
let seq = 0;
const rid = () => `request-${++seq}`;
const ixDays = (d: number) => d * DAY_MS * IxTime.getTimeMultiplier();

function setup(config: Record<string, string> = {}) {
  invalidateExchangeConfigCache();
  invalidateVaultConfigCache();
  fake = createFakeExchangeDb({
    user: [
      { id: "alice", clerkUserId: "c_alice", countryId: null },
      { id: "bob", clerkUserId: "c_bob", countryId: null },
      { id: "carol", clerkUserId: "c_carol", countryId: "ruritania" },
    ],
    exchangeWallet: ["alice", "bob", "carol"].map((userId) => ({
      id: `w_${userId}`,
      userId,
      sovereigns: 5000,
      lifetimeEarned: 5000,
      lifetimeSpent: 0,
    })),
    country: [{ id: "ruritania", name: "Ruritania", ownerUserId: "alice" }],
    systemConfig: Object.entries({ exchange_charter_fee: "100", ...config }).map(
      ([key, value]) => ({ key, value })
    ),
  });
}

const sov = (userId: string) =>
  fake.tables.exchangeWallet!.find((w) => w.userId === userId)!.sovereigns as number;
const company = (id: string) => fake.tables.company!.find((c) => c.id === id)!;
const contract = (id: string) => fake.tables.contract!.find((c) => c.id === id)!;
const totalMoney = () =>
  fake.tables.exchangeWallet!.reduce((s, w) => s + w.sovereigns, 0) +
  (fake.tables.company ?? []).reduce((s, c) => s + c.capital, 0) +
  (fake.tables.contract ?? []).reduce((s, c) => s + c.escrow, 0);

async function found(userId: string, name: string, sectorKey = "industry" as const) {
  const { company: c } = await foundCompany(fake.client, {
    userId,
    name,
    sectorKey,
    requestId: rid(),
  });
  return c.id as string;
}

async function tender(value = 400, userId = "alice") {
  const { contract: k } = await createGovernmentContract(fake.client, {
    userId,
    countryId: "ruritania",
    title: "Build a harbour",
    sectorKey: "industry",
    value,
    biddingDays: 7,
    requestId: rid(),
  });
  return k.id as string;
}

beforeEach(() => {
  setup();
  jest.mocked(notifyExchange).mockClear();
});

describe("government tenders", () => {
  it("only the nation's owner (or the player acting as it) can post one", async () => {
    await expect(tender(400, "bob")).rejects.toMatchObject({ code: "FORBIDDEN" });
    const id = await tender(400, "carol"); // plays as Ruritania
    expect(contract(id)).toMatchObject({ type: "B2G", fundedBy: "WALLET", issuerUserId: "carol" });
  });

  it("escrows from the owner's wallet and refunds the difference on award", async () => {
    const id = await tender(400);
    expect(sov("alice")).toBe(4600);
    expect(contract(id)).toMatchObject({
      escrow: 400,
      issuerCountryId: "ruritania",
      issuerCompanyId: null,
    });
    const bobCo = await found("bob", "Bob Builders");
    const bid = await placeBid(fake.client, {
      userId: "bob",
      contractId: id,
      companyId: bobCo,
      amount: 300,
    });
    expect(notifyExchange).toHaveBeenLastCalledWith([
      expect.objectContaining({ userId: "alice", title: "New bid on Build a harbour" }),
    ]);
    const before = totalMoney();

    await awardContract(fake.client, { userId: "alice", contractId: id, bidId: bid.id });
    expect(sov("alice")).toBe(4700);
    expect(notifyExchange).toHaveBeenLastCalledWith([
      expect.objectContaining({ userId: "bob", title: "You won Build a harbour" }),
    ]);
    await completeContract(fake.client, { userId: "alice", contractId: id });
    // Paid into capital; same-sector tender: standing +2.
    expect(company(bobCo)).toMatchObject({ capital: 300, standing: 2 });
    expect(totalMoney()).toBe(before);
  });

  it("a cancel refunds the wallet once", async () => {
    const id = await tender(400);
    await expect(
      cancelContract(fake.client, { userId: "bob", contractId: id })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await Promise.allSettled(
      [1, 2].map(() => cancelContract(fake.client, { userId: "alice", contractId: id }))
    );
    expect(sov("alice")).toBe(5000);
    expect(contract(id)).toMatchObject({ status: "CANCELLED", escrow: 0 });
  });

  it("an admin refund after a dispute goes back to the wallet and tells both parties", async () => {
    const id = await tender(400);
    const bobCo = await found("bob", "Bob Builders");
    const bid = await placeBid(fake.client, {
      userId: "bob",
      contractId: id,
      companyId: bobCo,
      amount: 400,
    });
    await awardContract(fake.client, { userId: "alice", contractId: id, bidId: bid.id });
    await disputeContract(fake.client, { userId: "bob", contractId: id, reason: "Never paid" });
    expect(notifyExchange).toHaveBeenLastCalledWith([
      expect.objectContaining({ userId: "alice", priority: "high" }),
    ]);
    await resolveDispute(fake.client, {
      contractId: id,
      outcome: "REFUND_ISSUER",
      note: "No delivery",
    });
    expect(sov("alice")).toBe(5000);
    expect(
      jest
        .mocked(notifyExchange)
        .mock.calls.at(-1)![0]
        .map((n) => n.userId)
        .sort()
    ).toEqual(["alice", "bob"]);
  });
});

describe("expireLapsedContracts", () => {
  async function b2b(value = 400) {
    const co = await found("alice", "Alice Works");
    await depositToCompany(fake.client, {
      userId: "alice",
      companyId: co,
      amount: 1000,
      requestId: rid(),
    });
    const { contract: k } = await createContract(fake.client, {
      userId: "alice",
      issuerCompanyId: co,
      title: "Supply steel",
      sectorKey: "industry",
      value,
      biddingDays: 1,
      requestId: rid(),
    });
    return { co, id: k.id as string };
  }

  it("leaves contracts inside the award grace alone", async () => {
    const id = await tender(400);
    const end = contract(id).endIxTime as number;
    const r = await expireLapsedContracts(fake.client, end + ixDays(AWARD_GRACE_DAYS) - 1);
    expect(r.expired).toBe(0);
    expect(contract(id).status).toBe("OPEN");
  });

  it("cancels lapsed OPEN contracts, refunds escrow once and is idempotent", async () => {
    const tenderId = await tender(400);
    const { co, id } = await b2b(300);
    const bobCo = await found("bob", "Bob Builders");
    await placeBid(fake.client, { userId: "bob", contractId: id, companyId: bobCo, amount: 250 });
    const before = totalMoney();
    const late = (contract(tenderId).endIxTime as number) + ixDays(AWARD_GRACE_DAYS + 30);

    const runs = await Promise.all([1, 2, 3].map(() => expireLapsedContracts(fake.client, late)));
    expect(runs.reduce((s, r) => s + r.expired, 0)).toBe(2);
    expect(sov("alice")).toBe(5000 - 100 - 1000 + 0); // tender refunded; charter and deposit stay
    expect(company(co).capital).toBe(1000);
    expect(contract(id)).toMatchObject({ status: "CANCELLED", escrow: 0 });
    expect(fake.tables.contractBid![0].outcome).toBe("LOST");
    expect(totalMoney()).toBe(before);

    const again = await expireLapsedContracts(fake.client, late);
    expect(again).toEqual({ expired: 0, skipped: 0, refunded: 0 });
    expect(sov("alice")).toBe(3900);
    const told = jest.mocked(notifyExchange).mock.calls.flatMap((c) => c[0].map((n) => n.userId));
    expect(told).toEqual(expect.arrayContaining(["alice", "bob"]));
  });

  it("never touches awarded contracts", async () => {
    const id = await tender(400);
    const bobCo = await found("bob", "Bob Builders");
    const bid = await placeBid(fake.client, {
      userId: "bob",
      contractId: id,
      companyId: bobCo,
      amount: 400,
    });
    await awardContract(fake.client, { userId: "alice", contractId: id, bidId: bid.id });
    await expireLapsedContracts(fake.client, (contract(id).endIxTime as number) + ixDays(365));
    expect(contract(id)).toMatchObject({ status: "AWARDED", escrow: 400 });
  });
});

describe("relaxed out allowance", () => {
  it("counts a share of contract revenue once it has aged past the hold", async () => {
    setup({ exchange_revenue_convertible_share: "0.5", exchange_revenue_hold_days: "7" });
    const id = await tender(400);
    const bobCo = await found("bob", "Bob Builders");
    const bid = await placeBid(fake.client, {
      userId: "bob",
      contractId: id,
      companyId: bobCo,
      amount: 300,
    });
    await awardContract(fake.client, { userId: "alice", contractId: id, bidId: bid.id });
    await completeContract(fake.client, { userId: "alice", contractId: id });
    expect(await convertOutAllowance(fake.client, "bob")).toBe(0); // too fresh

    contract(id).closedIxTime = IxTime.getCurrentIxTime() - ixDays(8);
    expect(await convertOutAllowance(fake.client, "bob")).toBe(150);
    expect(await convertOutAllowance(fake.client, "alice")).toBe(0); // the issuer earns nothing

    // An admin can turn it off.
    fake.tables.systemConfig!.find((r) => r.key === "exchange_revenue_convertible_share")!.value =
      "0";
    invalidateExchangeConfigCache();
    expect(await convertOutAllowance(fake.client, "bob")).toBe(0);
  });
});
