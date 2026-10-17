/** @jest-environment node */
/** Curation: approve imports into packs; make free suggestions into cards. */
jest.mock("~/server/modules/cards/cards.importer", () => ({ stageForAdmin: jest.fn() }));

import { TRPCError } from "@trpc/server";
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
  it("pages the queue by id and hands back the next cursor only for a full page", async () => {
    const db = createMockPrisma();
    db.card.findMany.mockResolvedValue([{ id: "a" }, { id: "b" }]);
    db.card.count.mockResolvedValue(5);
    expect(await listReviewQueue(db as never, { realm: "all", limit: 2, cursor: "x" })).toEqual({
      cards: [{ id: "a" }, { id: "b" }],
      total: 5,
      nextCursor: "b",
    });
    expect(db.card.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { reviewState: "PENDING" },
        orderBy: { id: "asc" },
        take: 2,
        cursor: { id: "x" },
        skip: 1,
      })
    );

    db.card.findMany.mockResolvedValue([{ id: "c" }]);
    expect((await listReviewQueue(db as never, { realm: "all", limit: 2 })).nextCursor).toBeNull();
  });
});

describe("reviewCards", () => {
  it("approves the chosen cards, never one whose art licence is restricted, and audits it", async () => {
    const db = createMockPrisma();
    db.card.count.mockResolvedValue(1);
    db.card.updateMany.mockResolvedValue({ count: 2 });
    const result = await reviewCards(db as never, actor, {
      decision: "APPROVE",
      cardIds: ["a", "b", "c"],
    });
    expect(result).toEqual({ updated: 2, skippedRestricted: 1 });
    expect(db.card.count).toHaveBeenCalledWith({
      where: {
        id: { in: ["a", "b", "c"] },
        reviewState: { in: ["PENDING", "REJECTED"] },
        ...RESTRICTED,
      },
    });
    expect(db.card.updateMany).toHaveBeenCalledWith({
      where: {
        id: { in: ["a", "b", "c"] },
        reviewState: { in: ["PENDING", "REJECTED"] },
        NOT: RESTRICTED,
      },
      data: expect.objectContaining({ reviewState: "APPROVED", reviewedBy: "db_admin" }),
    });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "CARD_REVIEW",
        userId: "clerk_admin",
        target: null,
        details: "Approved 2 card(s)",
      }),
    });
  });

  it("rejects only cards still pending, here every card matching a filter", async () => {
    const db = createMockPrisma();
    db.card.updateMany.mockResolvedValue({ count: 40 });
    const result = await reviewCards(db as never, actor, {
      decision: "REJECT",
      filter: { realm: "all", cardType: "NS" },
      note: "wrong region",
    });
    expect(result).toEqual({ updated: 40, skippedRestricted: 0 });
    expect(db.card.count).not.toHaveBeenCalled();
    expect(db.card.updateMany).toHaveBeenCalledWith({
      where: { reviewState: "PENDING", cardType: "NS" },
      data: expect.objectContaining({ reviewState: "REJECTED", reviewedBy: "db_admin" }),
    });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ details: "Rejected 40 card(s): wrong region" }),
    });
  });

  it("approves by filter only what the queue shows: pending cards, never rejected ones", async () => {
    const db = createMockPrisma();
    db.card.count.mockResolvedValue(0);
    db.card.updateMany.mockResolvedValue({ count: 7 });
    await reviewCards(db as never, actor, { decision: "APPROVE", filter: { realm: "eurth" } });
    expect(db.card.updateMany).toHaveBeenCalledWith({
      where: { reviewState: "PENDING", realmId: "eurth", NOT: RESTRICTED },
      data: expect.objectContaining({ reviewState: "APPROVED" }),
    });
  });

  it("rejects chosen cards only while they are pending, and names a single card in the audit", async () => {
    const db = createMockPrisma();
    db.card.updateMany.mockResolvedValue({ count: 1 });
    await reviewCards(db as never, actor, { decision: "REJECT", cardIds: ["a"] });
    expect(db.card.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["a"] }, reviewState: "PENDING" },
      data: expect.objectContaining({ reviewState: "REJECTED" }),
    });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ target: "a" }),
    });
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
    const db = createMockPrisma();
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
    expect(db.loreCardRequest.update).toHaveBeenCalledWith({
      where: { id: "req" },
      data: expect.objectContaining({
        status: "GENERATED",
        cardId: "card_elm",
        reviewedBy: "db_admin",
      }),
    });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "CARD_SUGGESTION", target: "card_elm" }),
    });
  });

  it("keeps the suggestion waiting and says why when the page cannot become a card", async () => {
    const db = createMockPrisma();
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
    expect(db.loreCardRequest.update).not.toHaveBeenCalled();
    expect(db.auditLog.create).not.toHaveBeenCalled();
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

  it("declines a waiting suggestion with a reason", async () => {
    const db = createMockPrisma();
    db.loreCardRequest.updateMany.mockResolvedValue({ count: 1 });
    await declineSuggestion(db as never, actor, { requestId: "req", reason: "Not a lore article" });
    expect(db.loreCardRequest.updateMany).toHaveBeenCalledWith({
      where: { id: "req", status: "PENDING" },
      data: expect.objectContaining({
        status: "REJECTED",
        rejectionReason: "Not a lore article",
        reviewedBy: "db_admin",
      }),
    });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "CARD_SUGGESTION", target: "req" }),
    });
  });

  it("refuses to decline a suggestion someone already answered", async () => {
    const db = createMockPrisma();
    db.loreCardRequest.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      declineSuggestion(db as never, actor, { requestId: "req", reason: "Not a lore article" })
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });
});
