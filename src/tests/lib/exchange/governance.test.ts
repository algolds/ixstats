/**
 * Exchange shareholder governance: proposals, weighted ballots, the pass and reject thresholds,
 * sole-owner fast path, expiry and idempotent opening. Spec: docs/specs/2026-11-01-exchange-phase-3-design.md
 */
jest.mock("~/lib/exchange/notify", () => ({
  notifyExchange: jest.fn(),
  sendExchangeNotices: jest.fn(),
}));
import { castVote, finalizeProposalsTx, openProposal, outcomeOf } from "~/lib/exchange/governance";
import { DAY_MS } from "~/lib/exchange/contracts";
import type { Db } from "~/lib/exchange/guards";
import { invalidateExchangeConfigCache } from "~/lib/vault/exchange-config";
import { invalidateVaultConfigCache } from "~/lib/vault/vault-perks";
import { createFakeExchangeDb, type FakeDb } from "~/tests/helpers/fake-exchange-db";

let fake: FakeDb;
let seq = 0;
const rid = () => `request-${++seq}`;
const cents = (n: number) => Math.round(n * 100);

/** Alice founded the company and holds 400 of 1,000 shares; bob 350 and carol 250. */
function setup() {
  invalidateExchangeConfigCache();
  invalidateVaultConfigCache();
  fake = createFakeExchangeDb({
    user: ["alice", "bob", "carol", "dave"].map((id) => ({ id, clerkUserId: `c_${id}` })),
    exchangeWallet: ["alice", "bob", "carol", "dave"].map((userId) => ({
      id: `w_${userId}`,
      userId,
      sovereigns: 5000,
      lifetimeEarned: 5000,
      lifetimeSpent: 0,
    })),
    company: [
      {
        id: "co",
        realmId: "default",
        founderId: "alice",
        name: "Alice Works",
        sectorKey: "industry",
        capital: 20_000,
        standing: 0,
        contractsWonValue: 0,
        decisionValue: 0,
        sharesIssued: 1000,
        sharesOutstanding: 1000,
        tradingOpen: true,
        status: "ACTIVE",
      },
    ],
    shareholding: [
      { companyId: "co", ownerUserId: "alice", shares: 400, avgCost: 1 },
      { companyId: "co", ownerUserId: "bob", shares: 350, avgCost: 1 },
      { companyId: "co", ownerUserId: "carol", shares: 250, avgCost: 1 },
    ],
    systemConfig: [],
  });
}

const sov = (userId: string) =>
  fake.tables.exchangeWallet!.find((w) => w.userId === userId)!.sovereigns as number;
const company = () => fake.tables.company!.find((c) => c.id === "co")!;
const proposals = () => fake.tables.companyProposal ?? [];
const soleOwner = () => {
  fake.tables.shareholding = [{ companyId: "co", ownerUserId: "alice", shares: 1000, avgCost: 1 }];
};

beforeEach(setup);

describe("the vote thresholds", () => {
  it("passes above half the outstanding shares and rejects at half or more", () => {
    expect(outcomeOf({ sharesFor: 500, sharesAgainst: 0 }, 1000)).toBeNull();
    expect(outcomeOf({ sharesFor: 501, sharesAgainst: 0 }, 1000)).toBe("PASSED");
    expect(outcomeOf({ sharesFor: 0, sharesAgainst: 499 }, 1000)).toBeNull();
    expect(outcomeOf({ sharesFor: 0, sharesAgainst: 500 }, 1000)).toBe("REJECTED");
  });
});

describe("opening a proposal", () => {
  it("executes a sole owner's dissolve at once and pays the founder the capital", async () => {
    soleOwner();
    const { proposal } = await openProposal(fake.client, {
      userId: "alice",
      companyId: "co",
      type: "DISSOLVE",
      requestId: rid(),
    });
    expect(proposal).toMatchObject({ status: "PASSED", sharesFor: 1000, sharesAgainst: 0 });
    expect(company()).toMatchObject({ status: "DELISTED", capital: 0 });
    expect(sov("alice")).toBe(25_000);
  });

  it("opens a diluted founder's dissolve as an OPEN proposal, with the founder's FOR vote", async () => {
    const { proposal } = await openProposal(fake.client, {
      userId: "alice",
      companyId: "co",
      type: "DISSOLVE",
      requestId: rid(),
    });
    expect(proposal).toMatchObject({ status: "OPEN", sharesFor: 400, totalEligibleShares: 1000 });
    expect(company()).toMatchObject({ status: "ACTIVE", capital: 20_000 });
    expect(fake.tables.companyVote).toEqual([
      expect.objectContaining({ voterUserId: "alice", support: true, shares: 400 }),
    ]);
  });

  it("refuses to open a proposal for someone who doesn't found the company", async () => {
    await expect(
      openProposal(fake.client, { userId: "bob", companyId: "co", type: "DISSOLVE", requestId: rid() })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(proposals()).toHaveLength(0);
  });

  it("refuses a second open proposal of the same kind while one is open", async () => {
    await openProposal(fake.client, { userId: "alice", companyId: "co", type: "DISSOLVE", requestId: rid() });
    await expect(
      openProposal(fake.client, { userId: "alice", companyId: "co", type: "DISSOLVE", requestId: rid() })
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(proposals()).toHaveLength(1);
  });

  it("applies a retried request once, returning the proposal it first opened", async () => {
    const requestId = rid();
    const first = await openProposal(fake.client, {
      userId: "alice",
      companyId: "co",
      type: "DISSOLVE",
      requestId,
    });
    const again = await openProposal(fake.client, {
      userId: "alice",
      companyId: "co",
      type: "DISSOLVE",
      requestId,
    });
    expect(again).toMatchObject({ alreadyApplied: true, proposal: { id: first.proposal.id } });
    expect(proposals()).toHaveLength(1);
  });

  it("an approved share issue creates a primary listing once it passes", async () => {
    const { proposal } = await openProposal(fake.client, {
      userId: "alice",
      companyId: "co",
      type: "ISSUE_SHARES",
      shares: 100,
      requestId: rid(),
    });
    expect(proposal.status).toBe("OPEN");
    await castVote(fake.client, { userId: "bob", proposalId: proposal.id, support: true });
    expect(company()).toMatchObject({ sharesIssued: 1100 });
    expect(fake.tables.shareListing).toEqual([
      expect.objectContaining({ companyId: "co", sellerUserId: null, shares: 100, status: "OPEN" }),
    ]);
  });
});

describe("voting", () => {
  async function openDissolve() {
    const { proposal } = await openProposal(fake.client, {
      userId: "alice",
      companyId: "co",
      type: "DISSOLVE",
      requestId: rid(),
    });
    return proposal.id;
  }

  it("lets a vote be changed while open, and executes once it crosses half", async () => {
    const proposalId = await openDissolve();
    await castVote(fake.client, { userId: "bob", proposalId, support: false });
    expect(proposals()[0]).toMatchObject({ status: "OPEN", sharesAgainst: 350 });

    const { proposal } = await castVote(fake.client, { userId: "bob", proposalId, support: true });
    expect(proposal).toMatchObject({ status: "PASSED", sharesFor: 750, sharesAgainst: 0 });
    expect(company()).toMatchObject({ status: "DELISTED", capital: 0 });
    // The founder takes 40%, bob 35% and carol 25%, each cent exact.
    expect(sov("alice")).toBe(5000 + 8000);
    expect(sov("bob")).toBe(5000 + 7000);
    expect(sov("carol")).toBe(5000 + 5000);
  });

  it("refuses a vote on a proposal that has already executed", async () => {
    const proposalId = await openDissolve();
    await castVote(fake.client, { userId: "bob", proposalId, support: true });
    await expect(
      castVote(fake.client, { userId: "carol", proposalId, support: true })
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(sov("alice")).toBe(5000 + 8000);
  });

  it("rejects once AGAINST votes reach half, and leaves the company as it was", async () => {
    const proposalId = await openDissolve();
    await castVote(fake.client, { userId: "bob", proposalId, support: false });
    const { proposal } = await castVote(fake.client, {
      userId: "carol",
      proposalId,
      support: false,
    });
    expect(proposal).toMatchObject({ status: "REJECTED", sharesAgainst: 600 });
    expect(company()).toMatchObject({ status: "ACTIVE", capital: 20_000 });
  });

  it("refuses a vote from someone who holds no shares", async () => {
    const proposalId = await openDissolve();
    await expect(
      castVote(fake.client, { userId: "dave", proposalId, support: true })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(proposals()[0]).toMatchObject({ sharesFor: 400, sharesAgainst: 0 });
  });

  it("re-weights ballots by current holdings so transferred shares cannot vote twice", async () => {
    const proposalId = await openDissolve();
    // Alice holds 400 shares (40%) and automatically voted FOR on opening.
    // Suppose Alice transfers 200 shares to Dave and Dave votes FOR: total support must stay 400 (40%), not 600.
    const aliceHolding = fake.tables.shareholding!.find(
      (s) => s.companyId === "co" && s.ownerUserId === "alice"
    )!;
    aliceHolding.shares = 200;
    fake.tables.shareholding!.push({
      companyId: "co",
      ownerUserId: "dave",
      shares: 200,
      avgCost: 1,
    });

    const { proposal } = await castVote(fake.client, {
      userId: "dave",
      proposalId,
      support: true,
    });
    expect(proposal).toMatchObject({ status: "OPEN", sharesFor: 400, sharesAgainst: 0 });
    expect(company().status).toBe("ACTIVE");
  });
});

describe("expiry", () => {
  it("expires a proposal that stays under half once its window closes, and does nothing else", async () => {
    const { proposal } = await openProposal(fake.client, {
      userId: "alice",
      companyId: "co",
      type: "DISSOLVE",
      requestId: rid(),
    });
    await castVote(fake.client, { userId: "carol", proposalId: proposal.id, support: false });

    const later = Date.now() + 4 * DAY_MS;
    const first = await fake.client.$transaction((tx: Db) => finalizeProposalsTx(tx, "co", later));
    expect(first.expired).toBe(1);
    expect(proposals()[0]).toMatchObject({ status: "EXPIRED" });
    expect(company()).toMatchObject({ status: "ACTIVE", capital: 20_000 });

    const second = await fake.client.$transaction((tx: Db) => finalizeProposalsTx(tx, "co", later));
    expect(second.expired).toBe(0);
    await expect(
      castVote(fake.client, { userId: "bob", proposalId: proposal.id, support: true })
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
});
