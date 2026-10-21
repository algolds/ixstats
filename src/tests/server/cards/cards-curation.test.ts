/** @jest-environment node */
/** Curation: approve imports into packs; make free suggestions into cards. */
jest.mock("~/server/modules/cards/cards.importer", () => ({ stageForAdmin: jest.fn() }));
import { MAX_FILTER_REVIEW } from "~/lib/cards/curation-limits";
import { stageForAdmin } from "~/server/modules/cards/cards.importer";
import {
  acceptSuggestion,
  declineSuggestion,
  reviewCards,
} from "~/server/modules/cards/cards.curation";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const actor = { dbId: "db_admin", clerkId: "clerk_admin" };
const stage = jest.mocked(stageForAdmin);
const RESTRICTED = { artLicence: { is: { status: "RESTRICTED" } } };
const EXCLUDE_RESTRICTED = { artLicence: { isNot: { status: "RESTRICTED" } } };
const AS_OF = new Date("2026-10-01T12:00:00Z");

/** A database whose `$transaction` hands its callback a separate client, so a test sees which writes it holds. */
function withTx() {
  const db = createMockPrisma();
  const tx = createMockPrisma();
  db.$transaction.mockImplementation((run: (client: typeof tx) => Promise<unknown>) => run(tx));
  return { db, tx };
}

beforeEach(() => stage.mockReset());
describe("reviewCards", () => {
  it("approves the chosen cards, never one whose art licence is restricted, and audits it in the same transaction", async () => {
    const { db, tx } = withTx();
    tx.card.count.mockResolvedValue(1);
    tx.card.updateMany.mockResolvedValue({ count: 2 });
    const result = await reviewCards(db as never, actor, {
      decision: "APPROVE",
      cardIds: ["a", "b", "c"],
    });
    expect(result).toEqual({ updated: 2, skippedRestricted: 1 });
    const chosen = { id: { in: ["a", "b", "c"] }, reviewState: { in: ["PENDING", "REJECTED"] } };
    expect(tx.card.count).toHaveBeenCalledWith({ where: { ...chosen, ...RESTRICTED } });
    expect(tx.card.updateMany).toHaveBeenCalledWith({
      where: { ...chosen, ...EXCLUDE_RESTRICTED },
      data: expect.objectContaining({ reviewState: "APPROVED", reviewedBy: "db_admin" }),
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "CARD_REVIEW",
        userId: "clerk_admin",
        target: null,
        details: "Approved 2 cards",
      }),
    });
    expect(db.card.updateMany).not.toHaveBeenCalled();
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });
  it("approves by filter exactly the pending cards the admin saw: none newer, never rejected ones", async () => {
    const { db, tx } = withTx();
    tx.card.count.mockResolvedValueOnce(7).mockResolvedValueOnce(1);
    tx.card.updateMany.mockResolvedValue({ count: 6 });
    const result = await reviewCards(db as never, actor, {
      decision: "APPROVE",
      filter: { realm: "eurth", source: "iiwiki" },
      asOf: AS_OF,
      expected: 7,
    });
    expect(result).toEqual({ updated: 6, skippedRestricted: 1 });
    const seen = {
      reviewState: "PENDING",
      realmId: "eurth",
      wikiSource: "iiwiki",
      createdAt: { lte: AS_OF },
    };
    expect(tx.card.count).toHaveBeenNthCalledWith(1, { where: seen });
    expect(tx.card.count).toHaveBeenNthCalledWith(2, { where: { ...seen, ...RESTRICTED } });
    expect(tx.card.updateMany).toHaveBeenCalledWith({
      where: { ...seen, ...EXCLUDE_RESTRICTED },
      data: expect.objectContaining({ reviewState: "APPROVED" }),
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        details: "Approved 6 cards matching realm eurth, source iiwiki",
      }),
    });
  });

  it("rejects by filter only the pending cards the admin saw", async () => {
    const { db, tx } = withTx();
    tx.card.count.mockResolvedValue(40);
    tx.card.updateMany.mockResolvedValue({ count: 40 });
    await reviewCards(db as never, actor, {
      decision: "REJECT",
      filter: { realm: "all", cardType: "NS" },
      asOf: AS_OF,
      expected: 40,
      note: "wrong region",
    });
    expect(tx.card.count).toHaveBeenCalledTimes(1);
    expect(tx.card.updateMany).toHaveBeenCalledWith({
      where: { reviewState: "PENDING", cardType: "NS", createdAt: { lte: AS_OF } },
      data: expect.objectContaining({ reviewState: "REJECTED", reviewedBy: "db_admin" }),
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        details: "Rejected 40 cards matching realm all, type NS: wrong region",
      }),
    });
  });

  it.each([
    [8, /New cards arrived since you loaded the queue/],
    [6, /reviewed since you loaded the queue/],
  ])("refuses a filter review when %i cards match instead of the 7 seen", async (now, message) => {
    const { db, tx } = withTx();
    tx.card.count.mockResolvedValue(now);
    const review = reviewCards(db as never, actor, {
      decision: "APPROVE",
      filter: { realm: "admin" },
      asOf: AS_OF,
      expected: 7,
    });
    await expect(review).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(review).rejects.toThrow(message);
    expect(tx.card.updateMany).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it("refuses a filter review above the cap, or without the queue it was read from, before reading anything", async () => {
    const { db, tx } = withTx();
    const filter = { realm: "all" };
    await expect(
      reviewCards(db as never, actor, {
        decision: "APPROVE",
        filter,
        asOf: AS_OF,
        expected: MAX_FILTER_REVIEW + 1,
      })
    ).rejects.toThrow(/at most 2,000 cards at once/);
    await expect(
      reviewCards(db as never, actor, { decision: "APPROVE", filter, expected: 3 })
    ).rejects.toThrow(/Reload the queue/);
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(tx.card.count).not.toHaveBeenCalled();
  });
  it("refuses a queue read dated after now, before reading anything", async () => {
    const { db, tx } = withTx();
    await expect(
      reviewCards(db as never, actor, {
        decision: "APPROVE",
        filter: { realm: "all" },
        asOf: new Date(Date.now() + 60_000),
        expected: 3,
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message: expect.stringMatching(/future/) });
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(tx.card.count).not.toHaveBeenCalled();
  });
});
describe("suggestions", () => {
  const waiting = { id: "req", status: "PENDING", wikiSource: "iiwiki", articleTitle: "Elm" };

  it("makes a suggestion into an approved card, skipping the length gate but never the licence gate", async () => {
    const { db, tx } = withTx();
    db.loreCardRequest.findUnique.mockResolvedValue(waiting);
    stage.mockResolvedValue({ cardId: "card_elm", rarity: "RARE" });
    expect(await acceptSuggestion(db as never, actor, "req")).toEqual({ cardId: "card_elm" });
    expect(stage).toHaveBeenCalledWith(db, "iiwiki", {
      title: "Elm",
      requestedBy: "db_admin",
      jobId: null,
      bypassLengthGate: true,
      reviewState: "APPROVED",
    });
    // A decline that landed while the card was made is overwritten whole: the card exists.
    expect(tx.loreCardRequest.update).toHaveBeenCalledWith({
      where: { id: "req" },
      data: expect.objectContaining({
        status: "GENERATED",
        cardId: "card_elm",
        rejectionReason: null,
        reviewedBy: "db_admin",
      }),
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "CARD_SUGGESTION", target: "card_elm" }),
    });
    expect(db.loreCardRequest.update).not.toHaveBeenCalled();
    expect(db.auditLog.create).not.toHaveBeenCalled();
    expect(stage.mock.invocationCallOrder[0]).toBeLessThan(
      db.$transaction.mock.invocationCallOrder[0]!
    );
  });
  it("refuses to decline a suggestion someone already answered", async () => {
    const { db, tx } = withTx();
    tx.loreCardRequest.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      declineSuggestion(db as never, actor, { requestId: "req", reason: "Not a lore article" })
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });
});
