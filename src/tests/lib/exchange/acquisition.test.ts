/**
 * Exchange acquisitions: an ACQUIRE decision that the target's shareholders approve buys the company
 * out. The offer is escrowed until the vote settles, the credit line is repaid to the HQ nation, the
 * holders are paid cent-exact, and a refused or expired offer returns to the buyer's capital.
 * Spec: docs/specs/2026-11-01-exchange-phase-3-design.md
 */
jest.mock("~/lib/exchange/notify", () => ({
  notifyExchange: jest.fn(),
  sendExchangeNotices: jest.fn(),
}));
import { castVote, finalizeProposalsTx, PROPOSAL_DAYS } from "~/lib/exchange/governance";
import { DAY_MS } from "~/lib/exchange/contracts";
import type { Db } from "~/lib/exchange/guards";
import { resolveDueDecisions, submitDecision } from "~/lib/exchange/decisions";
import { invalidateExchangeConfigCache } from "~/lib/vault/exchange-config";
import { invalidateVaultConfigCache } from "~/lib/vault/vault-perks";
import { createFakeExchangeDb, type FakeDb } from "~/tests/helpers/fake-exchange-db";

let fake: FakeDb;
let seq = 0;
const rid = () => `request-${++seq}`;
const cents = (n: number) => Math.round(n * 100);

/**
 * Carol runs the buyer. Alice founded the target and holds 333 of its 1,000 shares; bob holds 667.
 */
function setup() {
  invalidateExchangeConfigCache();
  invalidateVaultConfigCache();
  fake = createFakeExchangeDb({
    user: ["alice", "bob", "carol"].map((id) => ({ id, clerkUserId: `c_${id}` })),
    exchangeWallet: ["alice", "bob", "carol"].map((userId) => ({
      id: `w_${userId}`,
      userId,
      sovereigns: 5000_00n,
      lifetimeEarned: 5000_00n,
      lifetimeSpent: 0n,
    })),
    company: [
      {
        id: "buyer",
        realmId: "default",
        founderId: "carol",
        name: "Buyer Co",
        sectorKey: "services",
        capital: 50_000_00n,
        creditDrawn: 0n,
        sharesIssued: 1000,
        sharesOutstanding: 1000,
        status: "ACTIVE",
      },
      {
        id: "co",
        realmId: "default",
        founderId: "alice",
        name: "Alice Works",
        sectorKey: "industry",
        capital: 20_000_00n,
        creditDrawn: 0n,
        standing: 4,
        contractsWonValue: 0n,
        decisionValue: 100_00n,
        sharesIssued: 1000,
        sharesOutstanding: 1000,
        status: "ACTIVE",
      },
    ],
    shareholding: [
      { companyId: "co", ownerUserId: "alice", shares: 333, avgCost: 1 },
      { companyId: "co", ownerUserId: "bob", shares: 667, avgCost: 1 },
    ],
    systemConfig: [],
  });
}

const sov = (userId: string) =>
  Number(fake.tables.exchangeWallet!.find((w) => w.userId === userId)!.sovereigns) / 100;
const row = (id: string) => fake.tables.company!.find((c) => c.id === id)!;
const proposals = () => fake.tables.companyProposal ?? [];
const later = () => Date.now() + 2 * DAY_MS;

/** Submit the offer and let its day pass, so the decision opens the acquisition proposal. */
async function offerAndResolve(offerAmount: number, requestId = rid()) {
  await submitDecision(fake.client, {
    userId: "carol",
    companyId: "buyer",
    type: "ACQUIRE",
    offerAmount,
    targetCompanyId: "co",
    requestId,
  });
  await resolveDueDecisions(fake.client, later());
  return proposals()[0]!;
}

beforeEach(setup);

describe("making an offer", () => {
  it("escrows the offer from the buyer's capital and opens a proposal once the day passes", async () => {
    await submitDecision(fake.client, {
      userId: "carol",
      companyId: "buyer",
      type: "ACQUIRE",
      offerAmount: 10_000,
      targetCompanyId: "co",
      requestId: rid(),
    });
    expect(row("buyer").capital).toBe(40_000_00n);
    expect(proposals()).toHaveLength(0);

    await resolveDueDecisions(fake.client, later());
    expect(proposals()[0]).toMatchObject({
      companyId: "co",
      type: "ACQUIRE_OFFER",
      status: "OPEN",
      proposerUserId: "carol",
      payload: { buyerCompanyId: "buyer", offerAmount: 10_000 },
    });
    expect(row("co").status).toBe("ACTIVE");
  });

  it("refuses an offer for a company the buyer's founder already runs", async () => {
    fake.tables.company!.push({
      id: "own",
      realmId: "default",
      founderId: "alice",
      name: "Alice Two",
      sectorKey: "services",
      capital: 1000_00n,
      sharesIssued: 1000,
      sharesOutstanding: 1000,
      status: "ACTIVE",
    });
    await expect(
      submitDecision(fake.client, {
        userId: "alice",
        companyId: "own",
        type: "ACQUIRE",
        offerAmount: 500,
        targetCompanyId: "co",
        requestId: rid(),
      })
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(fake.tables.companyDecision ?? []).toHaveLength(0);
  });

  it("refuses an offer the target's credit line would outrun", async () => {
    row("co").creditDrawn = 50_000_00n;
    await expect(
      submitDecision(fake.client, {
        userId: "carol",
        companyId: "buyer",
        type: "ACQUIRE",
        offerAmount: 10_000,
        targetCompanyId: "co",
        requestId: rid(),
      })
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(row("buyer").capital).toBe(50_000_00n);
  });

  it("applies a retried offer once", async () => {
    const requestId = rid();
    await submitDecision(fake.client, {
      userId: "carol",
      companyId: "buyer",
      type: "ACQUIRE",
      offerAmount: 10_000,
      targetCompanyId: "co",
      requestId,
    });
    const again = await submitDecision(fake.client, {
      userId: "carol",
      companyId: "buyer",
      type: "ACQUIRE",
      offerAmount: 10_000,
      targetCompanyId: "co",
      requestId,
    });
    expect(again.alreadyApplied).toBe(true);
    expect(row("buyer").capital).toBe(40_000_00n);
    expect(fake.tables.companyDecision).toHaveLength(1);
  });
});

describe("an approved acquisition", () => {
  it("pays the holders cent-exact, then takes over the target's plant and standing", async () => {
    const offer = await offerAndResolve(10_001);
    const { proposal } = await castVote(fake.client, {
      userId: "bob",
      proposalId: offer.id,
      support: true,
    });
    expect(proposal.status).toBe("PASSED");

    // 30,001 ₷ split 333:667. Alice's share rounds down; bob takes the leftover cent.
    expect(cents(sov("alice")) - cents(5000)).toBe(999_033);
    expect(cents(sov("bob")) - cents(5000)).toBe(2_001_067);
    expect(cents(sov("alice")) + cents(sov("bob")) - cents(10_000)).toBe(cents(30_001));

    expect(row("co")).toMatchObject({ status: "DELISTED", capital: 0n, decisionValue: 0n });
    expect(row("buyer")).toMatchObject({ capital: 39_999_00n, decisionValue: 80_00n, standing: 2 });
    expect((fake.tables.exchangeNewsItem ?? []).filter((n) => n.kind === "acquisition")).toEqual([
      expect.objectContaining({ prominence: "HEADLINE", companyId: "co" }),
    ]);
  });

  it("absorbs the target into the buyer when the buyer's founder holds every share", async () => {
    fake.tables.shareholding = [
      { companyId: "co", ownerUserId: "carol", shares: 1000, avgCost: 1 },
    ];
    await offerAndResolve(10_000);
    expect(row("co")).toMatchObject({ status: "DELISTED", capital: 0n });
    expect(row("buyer").capital).toBe(70_000_00n);
    expect(sov("carol")).toBe(5000);
    expect(proposals()[0]).toMatchObject({ status: "PASSED" });
  });

  it("repays the target's credit line to its HQ nation before paying the holders", async () => {
    row("co").creditDrawn = 5_000_00n;
    row("co").hqCountryId = "nation_a";
    const offer = await offerAndResolve(10_000);
    await castVote(fake.client, { userId: "bob", proposalId: offer.id, support: true });

    expect(fake.tables.nationTreasury).toEqual([
      expect.objectContaining({ countryId: "nation_a", balance: 5000_00n }),
    ]);
    expect(fake.tables.nationTreasuryEntry).toEqual([
      expect.objectContaining({ type: "TAX", amount: 5000_00n }),
    ]);
    // 25,000 ₷ left for the holders: alice 8,325 and bob 16,675.
    expect(sov("alice")).toBe(5000 + 8325);
    expect(sov("bob")).toBe(5000 + 16_675);
    expect(row("co")).toMatchObject({ creditDrawn: 0n, capital: 0n });
  });

  it("executes once: a second vote on the settled proposal is refused", async () => {
    const offer = await offerAndResolve(10_000);
    await castVote(fake.client, { userId: "bob", proposalId: offer.id, support: true });
    const paidOut = sov("alice");
    await expect(
      castVote(fake.client, { userId: "alice", proposalId: offer.id, support: true })
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(sov("alice")).toBe(paidOut);
  });

  it("hands the offer back when shareholders vote it down", async () => {
    const offer = await offerAndResolve(10_000);
    await castVote(fake.client, { userId: "bob", proposalId: offer.id, support: false });
    expect(row("buyer").capital).toBe(50_000_00n);
    expect(row("co")).toMatchObject({ status: "ACTIVE", capital: 20_000_00n });
  });

  it("hands the offer back when the proposal expires", async () => {
    await offerAndResolve(10_000);
    const expired = await fake.client.$transaction((tx: Db) =>
      finalizeProposalsTx(tx, "co", later() + PROPOSAL_DAYS * DAY_MS)
    );
    expect(expired.expired).toBe(1);
    expect(proposals()[0]).toMatchObject({ status: "EXPIRED" });
    expect(row("buyer").capital).toBe(50_000_00n);
  });
});

describe("an offer the target can't take at resolution", () => {
  it("hands the offer back and records why, when the target has a decision pending", async () => {
    await submitDecision(fake.client, {
      userId: "carol",
      companyId: "buyer",
      type: "ACQUIRE",
      offerAmount: 10_000,
      targetCompanyId: "co",
      requestId: rid(),
    });
    fake.tables.companyDecision!.push({
      id: "target_pending",
      companyId: "co",
      type: "EXPAND",
      payload: { requestId: "t", cost: 100, amount: 100 },
      effect: null,
      submittedIxTime: Date.now() + 2 * DAY_MS,
      appliedIxTime: null,
    });
    await resolveDueDecisions(fake.client, later());
    expect(proposals()).toHaveLength(0);
    expect(row("buyer").capital).toBe(50_000_00n);
    const offer = fake.tables.companyDecision!.find((d) => d.type === "ACQUIRE")!;
    expect(offer.effect).toMatchObject({ refunded: 10_000 });
    expect(offer.effect).toHaveProperty("rejected");
  });

  it("allows acquiring a DISTRESSED target (distressed M&A buyout) and refuses a DELISTED target", async () => {
    row("co").status = "DISTRESSED";
    row("co").distressedSinceIxTime = Date.now() - DAY_MS;

    const offer = await offerAndResolve(10_000);
    const { proposal } = await castVote(fake.client, {
      userId: "bob",
      proposalId: offer.id,
      support: true,
    });
    expect(proposal.status).toBe("PASSED");
    expect(row("co")).toMatchObject({
      status: "DELISTED",
      distressedSinceIxTime: null,
      standing: 0,
      decisionValue: 0n,
    });
    expect(row("buyer")).toMatchObject({ decisionValue: 80_00n, standing: 2 });

    // A second ACQUIRE against the now-DELISTED company must be refused at submission.
    await expect(
      submitDecision(fake.client, {
        userId: "carol",
        companyId: "buyer",
        type: "ACQUIRE",
        offerAmount: 5_000,
        targetCompanyId: "co",
        requestId: rid(),
      })
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("expires competing OPEN proposals and refunds competing ACQUIRE_OFFER escrows when acquired", async () => {
    fake.tables.user!.push({ id: "dave", clerkUserId: "c_dave" });
    await fake.client.company.create({
      data: {
        id: "rival",
        realmId: "default",
        founderId: "dave",
        name: "Rival Co",
        sectorKey: "services",
        capital: 30_000_00n,
        creditDrawn: 0n,
        sharesIssued: 1000,
        sharesOutstanding: 1000,
        status: "ACTIVE",
      },
    });

    const carolOffer = await offerAndResolve(10_000);
    await submitDecision(fake.client, {
      userId: "dave",
      companyId: "rival",
      type: "ACQUIRE",
      offerAmount: 12_000,
      targetCompanyId: "co",
      requestId: rid(),
    });
    await resolveDueDecisions(fake.client, later() + 2 * DAY_MS);
    expect(row("rival").capital).toBe(18_000_00n);

    // Shareholders approve Carol's offer; Dave's competing offer is expired and refunded immediately.
    await castVote(fake.client, { userId: "bob", proposalId: carolOffer.id, support: true });
    const rivalProposal = proposals().find((p) => p.proposerUserId === "dave")!;
    expect(rivalProposal.status).toBe("EXPIRED");
    expect(row("rival").capital).toBe(30_000_00n);
  });
});
