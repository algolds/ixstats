/** @jest-environment node */
/** Curation: approve imports into packs; make free suggestions into cards. */
jest.mock("~/server/modules/cards/cards.importer", () => ({ stageForAdmin: jest.fn() }));

import { TRPCError } from "@trpc/server";
import { MAX_FILTER_REVIEW, MAX_IMPORT_TITLES } from "~/lib/cards/curation-limits";
import { stageForAdmin } from "~/server/modules/cards/cards.importer";
import {
  acceptSuggestion,
  declineSuggestion,
  listReviewQueue,
  listSuggestions,
  queueWhere,
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

describe("queueWhere", () => {
  it("defaults to the realms admins curate: the system realms and Ixnay", () => {
    expect(queueWhere({ realm: "admin" })).toEqual({
      reviewState: "PENDING",
      realm: { OR: [{ isSystem: true }, { id: "default" }] },
    });
  });

  it("narrows by realm, source and type, or opens every realm", () => {
    expect(queueWhere({ realm: "eurth", source: "iiwiki", cardType: "LORE" })).toEqual({
      reviewState: "PENDING",
      realmId: "eurth",
      wikiSource: "iiwiki",
      cardType: "LORE",
    });
    expect(queueWhere({ realm: "all" })).toEqual({ reviewState: "PENDING" });
  });
});

describe("listReviewQueue", () => {
  it("reads the queue as of one moment, paged by id, with the next cursor only for a full page", async () => {
    const db = createMockPrisma();
    db.card.findMany.mockResolvedValue([{ id: "a" }, { id: "b" }]);
    db.card.count.mockResolvedValue(5);
    const page = await listReviewQueue(db as never, { realm: "all", limit: 2, cursor: "x" });
    expect(page).toEqual({
      cards: [{ id: "a" }, { id: "b" }],
      total: 5,
      nextCursor: "b",
      asOf: expect.any(Date),
    });
    const where = { reviewState: "PENDING", createdAt: { lte: page.asOf } };
    expect(db.card.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where,
        orderBy: { id: "asc" },
        take: 2,
        cursor: { id: "x" },
        skip: 1,
      })
    );
    expect(db.card.count).toHaveBeenCalledWith({ where });

    db.card.findMany.mockResolvedValue([{ id: "c" }]);
    expect((await listReviewQueue(db as never, { realm: "all", limit: 2 })).nextCursor).toBeNull();
  });
});

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

  it("rejects chosen cards only while they are pending, and names a single card in the audit", async () => {
    const { db, tx } = withTx();
    tx.card.updateMany.mockResolvedValue({ count: 1 });
    await reviewCards(db as never, actor, {
      decision: "REJECT",
      cardIds: ["a"],
      note: "Off topic",
    });
    expect(tx.card.count).not.toHaveBeenCalled();
    expect(tx.card.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["a"] }, reviewState: "PENDING" },
      data: expect.objectContaining({ reviewState: "REJECTED" }),
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ target: "a", details: "Rejected 1 card: Off topic" }),
    });
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

  it("caps a filter review at one import job, so a whole job can always be approved at once", () => {
    expect(MAX_FILTER_REVIEW).toBe(MAX_IMPORT_TITLES);
    expect(MAX_IMPORT_TITLES).toBe(2000);
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

  it("allows a filter review of exactly the cap", async () => {
    const { db, tx } = withTx();
    tx.card.count.mockResolvedValueOnce(MAX_FILTER_REVIEW).mockResolvedValueOnce(0);
    tx.card.updateMany.mockResolvedValue({ count: MAX_FILTER_REVIEW });
    await expect(
      reviewCards(db as never, actor, {
        decision: "APPROVE",
        filter: { realm: "all" },
        asOf: AS_OF,
        expected: MAX_FILTER_REVIEW,
      })
    ).resolves.toEqual({ updated: MAX_FILTER_REVIEW, skippedRestricted: 0 });
  });

  it("refuses an empty choice", async () => {
    await expect(
      reviewCards(createMockPrisma() as never, actor, { decision: "APPROVE", cardIds: [] })
    ).rejects.toThrow(/at least one card/);
  });
});

describe("listSuggestions", () => {
  it("lists waiting suggestions oldest first, with their realm's name", async () => {
    const db = createMockPrisma();
    db.loreCardRequest.findMany.mockResolvedValue([
      { id: "r1", realmId: "iiwiki", articleTitle: "Elm" },
      { id: "r2", realmId: null, articleTitle: "Oak" },
    ]);
    db.realm.findMany.mockResolvedValue([{ id: "iiwiki", name: "IIWiki" }]);
    const rows = await listSuggestions(db as never, { status: "PENDING", limit: 50 });
    expect(rows.map((row) => row.realmName)).toEqual(["IIWiki", null]);
    expect(db.loreCardRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: "PENDING" },
        orderBy: { requestedAt: "asc" },
        take: 50,
      })
    );
    expect(db.realm.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ["iiwiki"] } } })
    );
  });

  it("lists answered suggestions, made or declined, newest first", async () => {
    const db = createMockPrisma();
    await listSuggestions(db as never, { status: "DONE", limit: 10 });
    expect(db.loreCardRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: { in: ["GENERATED", "REJECTED"] } },
        orderBy: { requestedAt: "desc" },
      })
    );
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

  it("keeps the suggestion waiting and says why when the page cannot become a card", async () => {
    const { db, tx } = withTx();
    db.loreCardRequest.findUnique.mockResolvedValue(waiting);
    stage.mockRejectedValue(
      new TRPCError({
        code: "BAD_REQUEST",
        message: "Its art is licensed CC BY-NC 4.0, which does not allow commercial use or changes",
      })
    );
    await expect(acceptSuggestion(db as never, actor, "req")).rejects.toThrow(
      /does not allow commercial use/
    );
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(tx.loreCardRequest.update).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it("refuses a missing, answered or Commons suggestion before staging anything", async () => {
    const db = createMockPrisma();
    await expect(acceptSuggestion(db as never, actor, "req")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    db.loreCardRequest.findUnique.mockResolvedValue({ ...waiting, status: "GENERATED" });
    await expect(acceptSuggestion(db as never, actor, "req")).rejects.toThrow(/been answered/);
    db.loreCardRequest.findUnique.mockResolvedValue({ ...waiting, wikiSource: "commons" });
    await expect(acceptSuggestion(db as never, actor, "req")).rejects.toThrow(/IxWiki/);
    expect(stage).not.toHaveBeenCalled();
  });

  it("declines a waiting suggestion with a reason, audited in the same transaction", async () => {
    const { db, tx } = withTx();
    tx.loreCardRequest.updateMany.mockResolvedValue({ count: 1 });
    await declineSuggestion(db as never, actor, { requestId: "req", reason: "Not a lore article" });
    expect(tx.loreCardRequest.updateMany).toHaveBeenCalledWith({
      where: { id: "req", status: "PENDING" },
      data: expect.objectContaining({
        status: "REJECTED",
        rejectionReason: "Not a lore article",
        reviewedBy: "db_admin",
      }),
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "CARD_SUGGESTION", target: "req" }),
    });
    expect(db.loreCardRequest.updateMany).not.toHaveBeenCalled();
    expect(db.auditLog.create).not.toHaveBeenCalled();
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
