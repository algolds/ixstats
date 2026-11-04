/**
 * Exchange phase 3 contracts: government tenders funded from a nation's treasury or from the
 * owner's wallet, the realm faucet's weekly cap, realm-scoped bids, cross-border tariffs and
 * free-trade agreements, and the expiry job for lapsed OPEN contracts. Spec:
 * docs/specs/2026-11-01-exchange-phase-3-design.md
 */
jest.mock("~/lib/exchange/notify", () => ({
  notifyExchange: jest.fn(),
  sendExchangeNotices: jest.fn(),
}));

import { depositToCompany, foundCompany } from "~/lib/exchange/companies";
import {
  DAY_MS,
  FAUCET_WINDOW_DAYS,
  awardContract,
  cancelContract,
  completeContract,
  createContract,
  createFaucetTender,
  createGovernmentContract,
  placeBid,
  type TenderFunding,
} from "~/lib/exchange/contracts";
import { AWARD_GRACE_DAYS, expireLapsedContracts } from "~/lib/exchange/expiry";
import { notifyExchange } from "~/lib/exchange/notify";
import { invalidateExchangeConfigCache } from "~/lib/vault/exchange-config";
import { invalidateVaultConfigCache } from "~/lib/vault/vault-perks";
import { createFakeExchangeDb, type FakeDb } from "~/tests/helpers/fake-exchange-db";

let fake: FakeDb;
let seq = 0;
const rid = () => `request-${++seq}`;
const days = (d: number) => d * DAY_MS;

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
    country: [{ id: "ruritania", name: "Ruritania", ownerUserId: "alice", realmId: "default" }],
    nationTreasury: [{ id: "t_ruritania", countryId: "ruritania", realmId: "default", balance: 0 }],
    systemConfig: Object.entries({ exchange_charter_fee: "100", ...config }).map(
      ([key, value]) => ({ key, value })
    ),
  });
}

const sov = (userId: string) =>
  fake.tables.exchangeWallet!.find((w) => w.userId === userId)!.sovereigns as number;
const company = (id: string) => fake.tables.company!.find((c) => c.id === id)!;
const contract = (id: string) => fake.tables.contract!.find((c) => c.id === id)!;
const treasuryBalance = (countryId = "ruritania") =>
  fake.tables.nationTreasury?.find((t) => t.countryId === countryId)?.balance ?? 0;
const setTreasury = (balance: number, countryId = "ruritania") => {
  const row = fake.tables.nationTreasury!.find((t) => t.countryId === countryId);
  if (row) row.balance = balance;
  else
    fake.tables.nationTreasury!.push({
      id: `t_${countryId}`,
      countryId,
      realmId: "default",
      balance,
    });
};
const totalMoney = () =>
  fake.tables.exchangeWallet!.reduce((s, w) => s + w.sovereigns, 0) +
  (fake.tables.company ?? []).reduce((s, c) => s + c.capital, 0) +
  (fake.tables.contract ?? []).reduce((s, c) => s + c.escrow, 0) +
  (fake.tables.nationTreasury ?? []).reduce((s, t) => s + t.balance, 0);

async function found(
  userId: string,
  name: string,
  options: { hqCountryId?: string; realmId?: string } = {}
) {
  const { company: c } = await foundCompany(fake.client, {
    userId,
    name,
    sectorKey: "industry",
    requestId: rid(),
    ...options,
  });
  return c.id as string;
}

async function tender(value = 400, userId = "alice", fundedBy: TenderFunding = "WALLET") {
  const { contract: k } = await createGovernmentContract(fake.client, {
    userId,
    countryId: "ruritania",
    title: "Build a harbour",
    sectorKey: "industry",
    value,
    biddingDays: 7,
    requestId: rid(),
    fundedBy,
  });
  return k.id as string;
}

const faucet = (value: number, extra: { realmId?: string; permitted?: boolean } = {}) =>
  createFaucetTender(fake.client, {
    userId: "alice",
    realmId: "default",
    title: "Public works",
    sectorKey: "industry",
    value,
    biddingDays: 7,
    requestId: rid(),
    permitted: true,
    ...extra,
  });

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
    expect(notifyExchange).toHaveBeenLastCalledWith([
      expect.objectContaining({ userId: "bob", title: "Build a harbour completed" }),
      expect.objectContaining({ userId: "alice", title: "Build a harbour completed" }),
    ]);
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

  it("a live B2G lobbying buff adds a point of standing to a tender win", async () => {
    const id = await tender(400);
    const bobCo = await found("bob", "Bob Builders");
    fake.tables.company!.find((c) => c.id === bobCo)!.lobbyBuffType = "b2g";
    fake.tables.company!.find((c) => c.id === bobCo)!.lobbyBuffUntilIxTime = Date.now() + DAY_MS;
    const bid = await placeBid(fake.client, {
      userId: "bob",
      contractId: id,
      companyId: bobCo,
      amount: 300,
    });
    await awardContract(fake.client, { userId: "alice", contractId: id, bidId: bid.id });
    await completeContract(fake.client, { userId: "alice", contractId: id });
    expect(company(bobCo).standing).toBe(3);
  });

  it("an expired B2G lobbying buff adds nothing", async () => {
    const id = await tender(400);
    const bobCo = await found("bob", "Bob Builders");
    fake.tables.company!.find((c) => c.id === bobCo)!.lobbyBuffType = "b2g";
    fake.tables.company!.find((c) => c.id === bobCo)!.lobbyBuffUntilIxTime = Date.now() - 1;
    const bid = await placeBid(fake.client, {
      userId: "bob",
      contractId: id,
      companyId: bobCo,
      amount: 300,
    });
    await awardContract(fake.client, { userId: "alice", contractId: id, bidId: bid.id });
    await completeContract(fake.client, { userId: "alice", contractId: id });
    expect(company(bobCo).standing).toBe(2);
  });

  it("a tender keeps the directive and issue it was issued from, and takes its realm from its nation", async () => {
    fake.tables.country![0]!.realmId = "alpha";
    const { contract: k } = await createGovernmentContract(fake.client, {
      userId: "alice",
      countryId: "ruritania",
      title: "Build a harbour",
      sectorKey: "industry",
      value: 400,
      biddingDays: 7,
      requestId: rid(),
      fundedBy: "WALLET",
      linkedDirectiveId: "dir_1",
      linkedIssueId: "iss_9",
    });
    expect(k).toMatchObject({
      realmId: "alpha",
      linkedDirectiveId: "dir_1",
      linkedIssueId: "iss_9",
    });
  });
});

describe("treasury-funded tenders", () => {
  it("escrows from the nation's treasury by default and refuses one larger than the balance", async () => {
    setTreasury(1000);
    const { contract: k } = await createGovernmentContract(fake.client, {
      userId: "alice",
      countryId: "ruritania",
      title: "Build a harbour",
      sectorKey: "industry",
      value: 400,
      biddingDays: 7,
      requestId: rid(),
    });
    expect(k).toMatchObject({ fundedBy: "TREASURY", escrow: 400 });
    expect(treasuryBalance()).toBe(600);
    expect(fake.tables.nationTreasuryEntry).toEqual([
      expect.objectContaining({ type: "B2G_ESCROW", amount: -400 }),
    ]);

    await expect(tender(700, "alice", "TREASURY")).rejects.toMatchObject({
      code: "INSUFFICIENT_SOVEREIGNS",
    });
    expect(treasuryBalance()).toBe(600);
    expect(fake.tables.contract!.filter((c) => c.type === "B2G")).toHaveLength(1);
    expect(sov("alice")).toBe(5000);
  });

  it("an award and a cancellation return escrow to the treasury, and a completed award pays the winner", async () => {
    setTreasury(1000);
    const id = await tender(400, "alice", "TREASURY");
    const bobCo = await found("bob", "Bob Builders");
    const bid = await placeBid(fake.client, {
      userId: "bob",
      contractId: id,
      companyId: bobCo,
      amount: 300,
    });
    const before = totalMoney();

    await awardContract(fake.client, { userId: "alice", contractId: id, bidId: bid.id });
    expect(treasuryBalance()).toBe(700);
    await completeContract(fake.client, { userId: "alice", contractId: id });
    expect(company(bobCo).capital).toBe(300);
    expect(treasuryBalance()).toBe(700);
    expect(totalMoney()).toBe(before);
    expect(fake.tables.nationTreasuryEntry).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "B2G_REFUND", amount: 100 })])
    );

    const other = await tender(200, "alice", "TREASURY");
    expect(treasuryBalance()).toBe(500);
    await cancelContract(fake.client, { userId: "alice", contractId: other });
    expect(treasuryBalance()).toBe(700);
    expect(contract(other)).toMatchObject({ status: "CANCELLED", escrow: 0 });
  });

  it("a cancel of a treasury tender refunds the treasury once", async () => {
    setTreasury(1000);
    const id = await tender(400, "alice", "TREASURY");
    await Promise.allSettled(
      [1, 2].map(() => cancelContract(fake.client, { userId: "alice", contractId: id }))
    );
    expect(treasuryBalance()).toBe(1000);
  });
});

describe("cross-realm bids", () => {
  it("a company can bid only on contracts in its own realm", async () => {
    fake.tables.realm = [{ id: "alpha", status: "active" }];
    const homeCo = await found("carol", "Home Works");
    const alphaCo = await found("bob", "Alpha Works", { realmId: "alpha" });
    const { contract: alphaTender } = await createFaucetTender(fake.client, {
      userId: "alice",
      realmId: "alpha",
      title: "Public works",
      sectorKey: "industry",
      value: 100,
      biddingDays: 7,
      requestId: rid(),
      permitted: true,
    });
    const homeTender = await tender(400);

    await expect(
      placeBid(fake.client, {
        userId: "carol",
        contractId: alphaTender.id,
        companyId: homeCo,
        amount: 50,
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      placeBid(fake.client, {
        userId: "bob",
        contractId: homeTender,
        companyId: alphaCo,
        amount: 50,
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await placeBid(fake.client, {
      userId: "bob",
      contractId: alphaTender.id,
      companyId: alphaCo,
      amount: 50,
    });
    expect(fake.tables.contractBid).toHaveLength(1);
  });

  it("a B2B contract takes its realm from the issuing company", async () => {
    fake.tables.realm = [{ id: "alpha", status: "active" }];
    const alphaCo = await found("alice", "Alice Alpha", { realmId: "alpha" });
    await depositToCompany(fake.client, {
      userId: "alice",
      companyId: alphaCo,
      amount: 1000,
      requestId: rid(),
    });
    const { contract: k } = await createContract(fake.client, {
      userId: "alice",
      issuerCompanyId: alphaCo,
      title: "Supply steel",
      sectorKey: "industry",
      value: 200,
      biddingDays: 1,
      requestId: rid(),
    });
    expect(k.realmId).toBe("alpha");
  });
});

describe("faucet tenders", () => {
  it("mints escrow up to the realm's weekly cap and refuses the rest", async () => {
    setup({ exchange_realm_weekly_faucet_cap: "1000" });
    await faucet(600);
    await expect(faucet(500)).rejects.toMatchObject({ code: "LIMIT_REACHED" });
    const { contract: k } = await faucet(400);
    expect(k).toMatchObject({ fundedBy: "FAUCET", escrow: 400, realmId: "default" });
    await expect(faucet(1)).rejects.toMatchObject({ code: "LIMIT_REACHED" });
  });

  it("each realm has its own cap", async () => {
    setup({ exchange_realm_weekly_faucet_cap: "1000" });
    await faucet(1000);
    await expect(faucet(1)).rejects.toMatchObject({ code: "LIMIT_REACHED" });
    await expect(faucet(1000, { realmId: "alpha" })).resolves.toMatchObject({
      contract: { realmId: "alpha", fundedBy: "FAUCET" },
    });
  });

  it("counts the last seven real days only", async () => {
    setup({ exchange_realm_weekly_faucet_cap: "1000" });
    const { contract: old } = await faucet(1000);
    const row = () => fake.tables.contract!.find((c) => c.id === old.id)!;

    row().createdIxTime = Date.now() - days(FAUCET_WINDOW_DAYS - 1);
    await expect(faucet(1)).rejects.toMatchObject({ code: "LIMIT_REACHED" });

    row().createdIxTime = Date.now() - days(FAUCET_WINDOW_DAYS + 1);
    await expect(faucet(1000)).resolves.toMatchObject({ contract: { fundedBy: "FAUCET" } });
  });

  it("needs the caller's permission", async () => {
    await expect(faucet(100, { permitted: false })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(fake.tables.contract ?? []).toHaveLength(0);
  });

  it("burns escrow returned to it, and a cancelled faucet tender still counts toward the cap", async () => {
    setup({ exchange_realm_weekly_faucet_cap: "1000" });
    const { contract: k } = await faucet(600);
    const before = totalMoney();

    await cancelContract(fake.client, { userId: "alice", contractId: k.id as string });
    expect(totalMoney()).toBe(before - 600);
    expect(sov("alice")).toBe(5000);
    expect(treasuryBalance()).toBe(0);
    await expect(faucet(500)).rejects.toMatchObject({ code: "LIMIT_REACHED" });
  });

  it("pays a won faucet tender to the winner, burning the part of escrow not awarded", async () => {
    setup({ exchange_realm_weekly_faucet_cap: "1000" });
    const { contract: k } = await faucet(600);
    const bobCo = await found("bob", "Bob Builders");
    const bid = await placeBid(fake.client, {
      userId: "bob",
      contractId: k.id as string,
      companyId: bobCo,
      amount: 300,
    });
    const before = totalMoney();
    await awardContract(fake.client, {
      userId: "alice",
      contractId: k.id as string,
      bidId: bid.id,
    });
    expect(totalMoney()).toBe(before - 300);
    await completeContract(fake.client, { userId: "alice", contractId: k.id as string });
    expect(company(bobCo).capital).toBe(300);
    expect(totalMoney()).toBe(before - 300);
  });
});

describe("cross-border tariffs and trade agreements", () => {
  const nation = (id: string, exciseTaxRates: Record<string, number>) => ({
    id,
    name: id,
    realmId: "default",
    ownerUserId: id === "ruritania" ? "alice" : null,
    fiscalSystem: { exciseTaxRates: JSON.stringify(exciseTaxRates) },
  });

  /** Ruritania levies the tariff; nation_b levies none. Alice's company is in Ruritania. */
  function setupTrade(ruritaniaRates: Record<string, number> = { tariffRate: 10 }) {
    fake.tables.country = [nation("ruritania", ruritaniaRates), nation("nation_b", {})];
  }

  async function awardedB2B(value = 400, bobHq = "nation_b") {
    const issuer = await found("alice", "Alice Works", { hqCountryId: "ruritania" });
    await depositToCompany(fake.client, {
      userId: "alice",
      companyId: issuer,
      amount: 1000,
      requestId: rid(),
    });
    const winner = await found("bob", "Bob Builders", { hqCountryId: bobHq });
    const { contract: k } = await createContract(fake.client, {
      userId: "alice",
      issuerCompanyId: issuer,
      title: "Supply steel",
      sectorKey: "industry",
      value,
      biddingDays: 1,
      requestId: rid(),
    });
    const bid = await placeBid(fake.client, {
      userId: "bob",
      contractId: k.id as string,
      companyId: winner,
      amount: value,
    });
    await awardContract(fake.client, {
      userId: "alice",
      contractId: k.id as string,
      bidId: bid.id,
    });
    return { winner, contractId: k.id as string };
  }

  it("a cross-border award pays the issuing nation's tariff out of the payout", async () => {
    setupTrade();
    const { winner, contractId } = await awardedB2B(400);
    const before = totalMoney();
    await completeContract(fake.client, { userId: "alice", contractId });
    expect(company(winner).capital).toBe(360);
    expect(treasuryBalance("ruritania")).toBe(40);
    expect(contract(contractId)).toMatchObject({ tariffRate: 0.1, tariffPaid: 40 });
    expect(totalMoney()).toBe(before);
    expect(fake.tables.nationTreasuryEntry).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "TARIFF", amount: 40 })])
    );
  });

  it("the tariff is capped at a quarter of the contract value", async () => {
    setupTrade({ tariffRate: 10, "sectorTariff:industry": 60 });
    const { winner, contractId } = await awardedB2B(400);
    await completeContract(fake.client, { userId: "alice", contractId });
    expect(treasuryBalance("ruritania")).toBe(100);
    expect(company(winner).capital).toBe(300);
    expect(contract(contractId)).toMatchObject({ tariffRate: 0.25, tariffPaid: 100 });
  });

  it("a contract won inside the issuing nation pays no tariff", async () => {
    setupTrade();
    const { winner, contractId } = await awardedB2B(400, "ruritania");
    await completeContract(fake.client, { userId: "alice", contractId });
    expect(company(winner).capital).toBe(400);
    expect(treasuryBalance("ruritania")).toBe(0);
    expect(contract(contractId)).toMatchObject({ tariffRate: 0, tariffPaid: 0 });
  });

  it("an enacted free-trade agreement between the two nations makes the tariff zero", async () => {
    setupTrade();
    fake.tables.foreignPolicyAction = [
      {
        id: "fp_1",
        initiatorId: "nation_b",
        targetId: "ruritania",
        actionType: "free_trade",
        status: "active",
      },
    ];
    const { winner, contractId } = await awardedB2B(400);
    await completeContract(fake.client, { userId: "alice", contractId });
    expect(company(winner).capital).toBe(400);
    expect(treasuryBalance("ruritania")).toBe(0);
    expect(contract(contractId)).toMatchObject({ tariffRate: 0, tariffPaid: 0 });
  });

  it("a lifted free-trade agreement no longer exempts the award", async () => {
    setupTrade();
    fake.tables.foreignPolicyAction = [
      {
        id: "fp_1",
        initiatorId: "ruritania",
        targetId: "nation_b",
        actionType: "free_trade",
        status: "lifted",
      },
    ];
    const { winner, contractId } = await awardedB2B(400);
    await completeContract(fake.client, { userId: "alice", contractId });
    expect(company(winner).capital).toBe(360);
    expect(contract(contractId)).toMatchObject({ tariffPaid: 40 });
  });

  it("a government tender won abroad pays the tender nation's tariff from the payout", async () => {
    setupTrade();
    setTreasury(1000, "ruritania");
    const id = await tender(300, "alice", "TREASURY");
    const bobCo = await found("bob", "Bob Builders", { hqCountryId: "nation_b" });
    const bid = await placeBid(fake.client, {
      userId: "bob",
      contractId: id,
      companyId: bobCo,
      amount: 300,
    });
    await awardContract(fake.client, { userId: "alice", contractId: id, bidId: bid.id });
    const before = totalMoney();
    await completeContract(fake.client, { userId: "alice", contractId: id });
    expect(company(bobCo).capital).toBe(270);
    expect(treasuryBalance("ruritania")).toBe(730);
    expect(contract(id)).toMatchObject({ tariffRate: 0.1, tariffPaid: 30 });
    expect(totalMoney()).toBe(before);
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

  it("cancels lapsed OPEN contracts, refunds escrow once and is idempotent", async () => {
    const tenderId = await tender(400);
    const { co, id } = await b2b(300);
    const bobCo = await found("bob", "Bob Builders");
    await placeBid(fake.client, { userId: "bob", contractId: id, companyId: bobCo, amount: 250 });
    const before = totalMoney();
    const late = (contract(tenderId).endIxTime as number) + days(AWARD_GRACE_DAYS + 30);

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

  it("returns an expired treasury tender to the treasury and burns an expired faucet tender", async () => {
    setup({ exchange_realm_weekly_faucet_cap: "1000" });
    setTreasury(1000);
    const treasuryId = await tender(400, "alice", "TREASURY");
    const { contract: f } = await faucet(300);
    const late = (contract(treasuryId).endIxTime as number) + days(AWARD_GRACE_DAYS + 1);
    const before = totalMoney();

    const result = await expireLapsedContracts(fake.client, late);
    expect(result.expired).toBe(2);
    expect(contract(treasuryId)).toMatchObject({ status: "CANCELLED", escrow: 0 });
    expect(contract(f.id as string)).toMatchObject({ status: "CANCELLED", escrow: 0 });
    expect(treasuryBalance()).toBe(1000);
    expect(totalMoney()).toBe(before - 300);
    expect(sov("alice")).toBe(5000);
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
    await expireLapsedContracts(fake.client, (contract(id).endIxTime as number) + days(365));
    expect(contract(id)).toMatchObject({ status: "AWARDED", escrow: 400 });
  });

  it("runs on real time: bidding closes after real days and expiry follows the real grace", async () => {
    const before = Date.now();
    const { id } = await b2b(300);
    const k = contract(id);
    const end = k.endIxTime as number;
    expect(end - (k.createdIxTime as number)).toBe(days(1));
    expect(end).toBeGreaterThanOrEqual(before + days(1));
    expect(end).toBeLessThanOrEqual(Date.now() + days(1));

    await expireLapsedContracts(fake.client, end + days(AWARD_GRACE_DAYS - 0.5));
    expect(contract(id).status).toBe("OPEN");
    await expireLapsedContracts(fake.client, end + days(AWARD_GRACE_DAYS + 0.5));
    expect(contract(id).status).toBe("CANCELLED");
  });
});
