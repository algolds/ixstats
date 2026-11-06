/**
 * Exchange companies and contracts (D5, docs/specs/2026-10-06-exchange-economy-design.md
 * §3-4): owner checks, the company cap, capital that never goes negative, and the
 * contract state machine with escrow paid out exactly once.
 */
jest.mock("~/lib/exchange/notify", () => ({
  notifyExchange: jest.fn(),
  sendExchangeNotices: jest.fn(),
}));
import {
  depositToCompany,
  dissolveCompany,
  dissolveCompanyTx,
  foundCompany,
  withdrawFromCompany,
} from "~/lib/exchange/companies";
import {
  awardContract,
  cancelContract,
  completeContract,
  createContract,
  disputeContract,
  placeBid,
  resolveDispute
} from "~/lib/exchange/contracts";
import type { Db } from "~/lib/exchange/guards";
import { ensureSectorIndices } from "~/lib/exchange/sectors";
import { invalidateExchangeConfigCache } from "~/lib/vault/exchange-config";
import { invalidateVaultConfigCache } from "~/lib/vault/vault-perks";
import { createFakeExchangeDb, type FakeDb } from "~/tests/helpers/fake-exchange-db";

let fake: FakeDb;
let seq = 0;
const rid = () => `request-${++seq}`;

function wallet(userId: string) {
  return {
    id: `w_${userId}`,
    userId,
    sovereigns: 5000,
    lifetimeEarned: 5000,
    lifetimeSpent: 0,
  };
}

function setup(config: Record<string, string> = {}) {
  invalidateExchangeConfigCache();
  invalidateVaultConfigCache();
  fake = createFakeExchangeDb({
    user: [
      { id: "alice", clerkUserId: "c_alice" },
      { id: "bob", clerkUserId: "c_bob" },
    ],
    exchangeWallet: [wallet("alice"), wallet("bob")],
    systemConfig: Object.entries({ exchange_charter_fee: "100", ...config }).map(
      ([key, value]) => ({ key, value })
    ),
  });
}

const sov = (userId: string) =>
  fake.tables.exchangeWallet!.find((w) => w.userId === userId)!.sovereigns as number;
const company = (id: string) => fake.tables.company!.find((c) => c.id === id)!;
const contract = (id: string) => fake.tables.contract!.find((c) => c.id === id)!;

/** All ₷ in wallets, company capital and contract escrow. Fees aside, moves conserve it. */
function totalMoney() {
  const wallets = fake.tables.exchangeWallet!.reduce((s, w) => s + w.sovereigns, 0);
  const capital = (fake.tables.company ?? []).reduce((s, c) => s + c.capital, 0);
  const escrow = (fake.tables.contract ?? []).reduce((s, c) => s + c.escrow, 0);
  return wallets + capital + escrow;
}

async function found(userId: string, name: string) {
  const { company: c } = await foundCompany(fake.client, {
    userId,
    name,
    sectorKey: "industry",
    requestId: rid(),
  });
  return c.id;
}

/** Alice's company with 1,000 capital posts a 400 contract; Bob's company bids 300. */
async function openContractWithBid() {
  const aliceCo = await found("alice", "Alice Works");
  const bobCo = await found("bob", "Bob Builders");
  await depositToCompany(fake.client, {
    userId: "alice",
    companyId: aliceCo,
    amount: 1000,
    requestId: rid(),
  });
  const { contract: k } = await createContract(fake.client, {
    userId: "alice",
    issuerCompanyId: aliceCo,
    title: "Build a bridge",
    sectorKey: "industry",
    value: 400,
    biddingDays: 7,
    requestId: rid(),
  });
  const bid = await placeBid(fake.client, {
    userId: "bob",
    contractId: k.id,
    companyId: bobCo,
    amount: 300,
  });
  return { aliceCo, bobCo, contractId: k.id, bidId: bid.id };
}

beforeEach(() => setup());

describe("companies", () => {
  it("charters a company: burns the fee and gives the founder every share", async () => {
    const id = await found("alice", "Alice Works");
    expect(sov("alice")).toBe(4900);
    expect(company(id)).toMatchObject({ founderId: "alice", sharesIssued: 1000, status: "ACTIVE" });
    expect(fake.tables.shareholding).toEqual([
      expect.objectContaining({ companyId: id, ownerUserId: "alice", shares: 1000 }),
    ]);
    expect(fake.tables.shareIssuance).toHaveLength(1);
  });

  it("applies a retried charter once", async () => {
    const input = {
      userId: "alice",
      name: "Alice Works",
      sectorKey: "industry" as const,
      requestId: "same",
    };
    await foundCompany(fake.client, input);
    const retry = await foundCompany(fake.client, input);
    expect(retry.alreadyApplied).toBe(true);
    expect(fake.tables.company).toHaveLength(1);
    expect(sov("alice")).toBe(4900);
  });

  it("holds the active-company cap against concurrent charters", async () => {
    setup({ exchange_active_company_cap: "1" });
    const results = await Promise.allSettled(
      ["A", "B", "C"].map((n) =>
        foundCompany(fake.client, {
          userId: "alice",
          name: `Co ${n}`,
          sectorKey: "services",
          requestId: rid(),
        })
      )
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(sov("alice")).toBe(4900);
  });
  it("only the founder moves capital", async () => {
    const id = await found("alice", "Alice Works");
    await expect(
      depositToCompany(fake.client, { userId: "bob", companyId: id, amount: 10, requestId: rid() })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      withdrawFromCompany(fake.client, {
        userId: "bob",
        companyId: id,
        amount: 10,
        requestId: rid(),
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      dissolveCompany(fake.client, { userId: "bob", companyId: id })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("never withdraws more capital than the company holds, even concurrently", async () => {
    const id = await found("alice", "Alice Works");
    await depositToCompany(fake.client, {
      userId: "alice",
      companyId: id,
      amount: 500,
      requestId: rid(),
    });
    const before = totalMoney();
    const results = await Promise.allSettled(
      [1, 2, 3].map(() =>
        withdrawFromCompany(fake.client, {
          userId: "alice",
          companyId: id,
          amount: 200,
          requestId: rid(),
        })
      )
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(2);
    expect(company(id).capital).toBe(100);
    expect(totalMoney()).toBe(before);
  });

  it("applies a retried withdrawal once", async () => {
    const id = await found("alice", "Alice Works");
    await depositToCompany(fake.client, {
      userId: "alice",
      companyId: id,
      amount: 500,
      requestId: rid(),
    });
    const input = { userId: "alice", companyId: id, amount: 200, requestId: "w-same" };
    await Promise.all([
      withdrawFromCompany(fake.client, input),
      withdrawFromCompany(fake.client, input),
    ]);
    expect(company(id).capital).toBe(300);
  });

  it("won't dissolve with a live contract, then returns capital once settled", async () => {
    const { aliceCo, contractId } = await openContractWithBid();
    await expect(
      dissolveCompany(fake.client, { userId: "alice", companyId: aliceCo })
    ).rejects.toMatchObject({
      code: "CONFLICT",
    });
    await cancelContract(fake.client, { userId: "alice", contractId });
    const before = sov("alice");
    const r = await dissolveCompany(fake.client, { userId: "alice", companyId: aliceCo });
    expect(r.returned).toBe(1000);
    expect(sov("alice")).toBe(before + 1000);
    expect(company(aliceCo)).toMatchObject({ status: "DELISTED", capital: 0 });
  });

  it("keeps a company's name unique within its realm only", async () => {
    fake.tables.realm = [{ id: "alpha", status: "active" }];
    await found("alice", "Alice Works");
    const { company: other } = await foundCompany(fake.client, {
      userId: "alice",
      name: "Alice Works",
      sectorKey: "services",
      realmId: "alpha",
      requestId: rid(),
    });
    expect(other).toMatchObject({ realmId: "alpha", name: "Alice Works" });
    await expect(
      foundCompany(fake.client, {
        userId: "bob",
        name: "alice WORKS",
        sectorKey: "services",
        realmId: "alpha",
        requestId: rid(),
      })
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("refuses a charter in a realm that is not open", async () => {
    fake.tables.realm = [{ id: "draft-realm", status: "draft" }];
    for (const realmId of ["draft-realm", "nationstates"]) {
      await expect(
        foundCompany(fake.client, {
          userId: "alice",
          name: "Closed Co",
          sectorKey: "industry",
          realmId,
          requestId: rid(),
        })
      ).rejects.toMatchObject({ code: "CONFLICT" });
    }
    expect(fake.tables.company ?? []).toHaveLength(0);
  });

  it("applies the active-company cap per founder per realm", async () => {
    setup({ exchange_active_company_cap: "1" });
    fake.tables.realm = [{ id: "alpha", status: "active" }];
    await found("alice", "Alice Works");
    await foundCompany(fake.client, {
      userId: "alice",
      name: "Alpha Works",
      sectorKey: "industry",
      realmId: "alpha",
      requestId: rid(),
    });
    await expect(found("alice", "Second Works")).rejects.toMatchObject({ code: "LIMIT_REACHED" });
  });

  it("takes an HQ nation only from the company's own realm", async () => {
    fake.tables.realm = [{ id: "alpha", status: "active" }];
    fake.tables.country = [
      { id: "c_alpha", realmId: "alpha" },
      { id: "c_home", realmId: "default" },
    ];
    await expect(
      foundCompany(fake.client, {
        userId: "alice",
        name: "Hq Co",
        sectorKey: "industry",
        hqCountryId: "c_alpha",
        requestId: rid(),
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    const { company: c } = await foundCompany(fake.client, {
      userId: "alice",
      name: "Hq Co",
      sectorKey: "industry",
      hqCountryId: "c_home",
      requestId: rid(),
    });
    expect(c.hqCountryId).toBe("c_home");
  });

  it("defaults to the sector's first sub-industry and rejects one from another sector", async () => {
    const { company: c } = await foundCompany(fake.client, {
      userId: "alice",
      name: "Sub Default",
      sectorKey: "industry",
      requestId: rid(),
    });
    expect(c.subIndustryKey).toBe("energy_mining");
    await expect(
      foundCompany(fake.client, {
        userId: "bob",
        name: "Sub Wrong",
        sectorKey: "industry",
        subIndustryKey: "logistics",
        requestId: rid(),
      })
    ).rejects.toMatchObject({ code: "INVALID_AMOUNT" });
  });

  it("prices a company off its own realm's sector index", async () => {
    fake.tables.realm = [{ id: "alpha", status: "active" }];
    const { company: alpha } = await foundCompany(fake.client, {
      userId: "alice",
      name: "Alpha Works",
      sectorKey: "industry",
      realmId: "alpha",
      requestId: rid(),
    });
    const { company: home } = await foundCompany(fake.client, {
      userId: "bob",
      name: "Home Works",
      sectorKey: "industry",
      requestId: rid(),
    });
    await ensureSectorIndices(fake.client, "alpha");
    fake.tables.sectorIndex!.find((i) => i.realmId === "alpha" && i.sectorKey === "industry")!
      .value = 1500;
    await depositToCompany(fake.client, {
      userId: "alice",
      companyId: alpha.id,
      amount: 1000,
      requestId: rid(),
    });
    await depositToCompany(fake.client, {
      userId: "bob",
      companyId: home.id,
      amount: 1000,
      requestId: rid(),
    });
    expect(company(alpha.id).fairValue).toBe(1500);
    expect(company(home.id).fairValue).toBe(1000);
  });

  it("refuses to withdraw or dissolve while a credit line is drawn", async () => {
    const id = await found("alice", "Alice Works");
    await depositToCompany(fake.client, {
      userId: "alice",
      companyId: id,
      amount: 500,
      requestId: rid(),
    });
    company(id).creditDrawn = 200;
    await expect(
      withdrawFromCompany(fake.client, {
        userId: "alice",
        companyId: id,
        amount: 100,
        requestId: rid(),
      })
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      dissolveCompany(fake.client, { userId: "alice", companyId: id })
    ).rejects.toMatchObject({ code: "CONFLICT" });

    company(id).creditDrawn = 0;
    await expect(dissolveCompany(fake.client, { userId: "alice", companyId: id })).resolves.toMatchObject(
      { returned: 500 }
    );
  });

  it("dissolveCompanyTx runs inside the caller's transaction and returns its notices", async () => {
    const id = await found("alice", "Alice Works");
    const r = await fake.client.$transaction((tx: Db) =>
      dissolveCompanyTx(tx, { userId: "alice", companyId: id })
    );
    expect(r).toEqual({ returned: 0, notices: [] });
    expect(company(id).status).toBe("DELISTED");
  });
});

describe("contract state machine", () => {
  it("escrows the value from the issuer's capital", async () => {
    const { aliceCo, contractId } = await openContractWithBid();
    expect(contract(contractId)).toMatchObject({ status: "OPEN", escrow: 400 });
    expect(company(aliceCo).capital).toBe(600);
  });
  it("won't let the issuer bid on its own contract", async () => {
    const { aliceCo, contractId } = await openContractWithBid();
    await expect(
      placeBid(fake.client, { userId: "alice", contractId, companyId: aliceCo, amount: 100 })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("award → complete pays the contractor exactly once and conserves money", async () => {
    const { aliceCo, bobCo, contractId, bidId } = await openContractWithBid();
    const before = totalMoney();

    await expect(
      awardContract(fake.client, { userId: "bob", contractId, bidId })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    await awardContract(fake.client, { userId: "alice", contractId, bidId });
    expect(contract(contractId)).toMatchObject({
      status: "AWARDED",
      escrow: 300,
      winnerCompanyId: bobCo,
    });
    expect(company(aliceCo).capital).toBe(700); // 100 refunded on award
    await expect(
      awardContract(fake.client, { userId: "alice", contractId, bidId })
    ).rejects.toMatchObject({ code: "CONFLICT" });

    await expect(
      completeContract(fake.client, { userId: "bob", contractId })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    const results = await Promise.allSettled(
      [1, 2, 3].map(() => completeContract(fake.client, { userId: "alice", contractId }))
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(company(bobCo)).toMatchObject({ capital: 300, contractsWonValue: 300, standing: 1 });
    expect(contract(contractId)).toMatchObject({ status: "COMPLETED", escrow: 0 });
    expect(totalMoney()).toBe(before);
  });

  it("cancel refunds escrow; a cancelled contract can't be awarded", async () => {
    const { aliceCo, contractId, bidId } = await openContractWithBid();
    await cancelContract(fake.client, { userId: "alice", contractId });
    expect(company(aliceCo).capital).toBe(1000);
    await expect(
      awardContract(fake.client, { userId: "alice", contractId, bidId })
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
  it("a dispute freezes escrow until an admin decides, once", async () => {
    const { aliceCo, bobCo, contractId, bidId } = await openContractWithBid();
    await awardContract(fake.client, { userId: "alice", contractId, bidId });
    await disputeContract(fake.client, {
      userId: "bob",
      contractId,
      reason: "Never confirmed delivery",
    });
    await expect(
      completeContract(fake.client, { userId: "alice", contractId })
    ).rejects.toMatchObject({
      code: "CONFLICT",
    });

    const r = await resolveDispute(fake.client, {
      contractId,
      outcome: "REFUND_ISSUER",
      note: "No delivery shown",
    });
    expect(r).toMatchObject({ status: "CANCELLED", amount: 300 });
    expect(company(aliceCo).capital).toBe(1000);
    expect(company(bobCo).standing).toBe(-1);
    await expect(
      resolveDispute(fake.client, { contractId, outcome: "PAY_CONTRACTOR", note: "again" })
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("a stranger can't dispute", async () => {
    setup();
    fake.tables.user!.push({ id: "carol", clerkUserId: "c_carol" });
    const { contractId, bidId } = await openContractWithBid();
    await awardContract(fake.client, { userId: "alice", contractId, bidId });
    await expect(
      disputeContract(fake.client, { userId: "carol", contractId, reason: "I just don't like it" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("everything stops while the Exchange is switched off", async () => {
    setup({ vault_isExchangeEnabled: "false" });
    await expect(found("alice", "Alice Works")).rejects.toMatchObject({ code: "DISABLED" });
  });

  it("allows depositing capital into a DISTRESSED company and cures it when credit is within limit", async () => {
    const id = await found("alice", "Alice Works");
    company(id).status = "DISTRESSED";
    company(id).distressedSinceIxTime = Date.now() - 1000;
    company(id).creditDrawn = 0;

    await depositToCompany(fake.client, {
      userId: "alice",
      companyId: id,
      amount: 500,
      requestId: rid(),
    });
    expect(company(id)).toMatchObject({
      status: "ACTIVE",
      capital: 500,
      distressedSinceIxTime: null,
    });
  });

  it("refunds contract escrow to founder wallet if issuer went BANKRUPT, and blocks paying a BANKRUPT contractor", async () => {
    const { aliceCo, bobCo, contractId, bidId } = await openContractWithBid();
    await awardContract(fake.client, { userId: "alice", contractId, bidId });

    // If contractor goes BANKRUPT before completion, completing the contract is blocked with CONFLICT.
    company(bobCo).status = "BANKRUPT";
    await expect(
      completeContract(fake.client, { userId: "alice", contractId })
    ).rejects.toMatchObject({ code: "CONFLICT" });

    // If issuer also went BANKRUPT and a dispute refunds the issuer, refund lands in alice's wallet.
    await disputeContract(fake.client, {
      userId: "alice",
      contractId,
      reason: "Contractor went bankrupt",
    });
    company(aliceCo).status = "BANKRUPT";
    company(aliceCo).capital = 0;
    const aliceWalletBefore = sov("alice");
    await resolveDispute(fake.client, {
      contractId,
      outcome: "REFUND_ISSUER",
      note: "Refund to founder wallet",
    });
    expect(sov("alice")).toBe(aliceWalletBefore + 300);
    expect(company(aliceCo).capital).toBe(0);
  });
});
