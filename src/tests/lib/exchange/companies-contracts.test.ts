/**
 * Exchange companies and contracts (D5, docs/specs/2026-10-06-exchange-economy-design.md
 * §3-4): owner checks, the company cap, capital that never goes negative, and the
 * contract state machine with escrow paid out exactly once.
 */
import {
  depositToCompany,
  dissolveCompany,
  foundCompany,
  withdrawFromCompany,
} from "~/lib/exchange/companies";
import {
  CONTRACT_TRANSITIONS,
  awardContract,
  canTransition,
  cancelContract,
  completeContract,
  createContract,
  disputeContract,
  placeBid,
  releaseContract,
  resolveDispute,
  withdrawBid,
} from "~/lib/exchange/contracts";
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

  it("refuses a taken name, case-insensitively", async () => {
    await found("alice", "Alice Works");
    await expect(found("bob", "alice works")).rejects.toMatchObject({ code: "CONFLICT" });
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
});

describe("contract state machine", () => {
  it("allows only the documented transitions", () => {
    expect(CONTRACT_TRANSITIONS.COMPLETED).toEqual([]);
    expect(CONTRACT_TRANSITIONS.CANCELLED).toEqual([]);
    expect(canTransition("OPEN", "AWARDED")).toBe(true);
    expect(canTransition("OPEN", "COMPLETED")).toBe(false);
    expect(canTransition("AWARDED", "OPEN" as never)).toBe(false);
    expect(canTransition("DISPUTED", "COMPLETED")).toBe(true);
    expect(canTransition("COMPLETED", "CANCELLED")).toBe(false);
  });

  it("escrows the value from the issuer's capital", async () => {
    const { aliceCo, contractId } = await openContractWithBid();
    expect(contract(contractId)).toMatchObject({ status: "OPEN", escrow: 400 });
    expect(company(aliceCo).capital).toBe(600);
  });

  it("refuses a contract the company's capital can't cover", async () => {
    const id = await found("alice", "Alice Works");
    await expect(
      createContract(fake.client, {
        userId: "alice",
        issuerCompanyId: id,
        title: "Too big",
        sectorKey: "industry",
        value: 50,
        biddingDays: 3,
        requestId: rid(),
      })
    ).rejects.toMatchObject({ code: "INSUFFICIENT_SOVEREIGNS" });
  });

  it("won't let the issuer bid on its own contract", async () => {
    const { aliceCo, contractId } = await openContractWithBid();
    await expect(
      placeBid(fake.client, { userId: "alice", contractId, companyId: aliceCo, amount: 100 })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("caps a bid at the contract value", async () => {
    const { bobCo, contractId } = await openContractWithBid();
    await expect(
      placeBid(fake.client, { userId: "bob", contractId, companyId: bobCo, amount: 401 })
    ).rejects.toMatchObject({ code: "INVALID_AMOUNT" });
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

  it("a contractor can withdraw a bid while open", async () => {
    const { contractId, bidId } = await openContractWithBid();
    await expect(withdrawBid(fake.client, { userId: "alice", bidId })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await withdrawBid(fake.client, { userId: "bob", bidId });
    expect(fake.tables.contractBid!.filter((b) => b.contractId === contractId)).toHaveLength(0);
  });

  it("release refunds the issuer and costs the contractor standing", async () => {
    const { aliceCo, bobCo, contractId, bidId } = await openContractWithBid();
    await awardContract(fake.client, { userId: "alice", contractId, bidId });
    await expect(
      releaseContract(fake.client, { userId: "alice", contractId })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await releaseContract(fake.client, { userId: "bob", contractId });
    expect(contract(contractId)).toMatchObject({ status: "CANCELLED", escrow: 0 });
    expect(company(aliceCo).capital).toBe(1000);
    expect(company(bobCo).standing).toBe(-1);
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
});
