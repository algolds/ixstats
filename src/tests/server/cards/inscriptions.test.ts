/** @jest-environment node */
/**
 * Inscriptions (spec §2.2): an owner signs a copy once with their name frozen, anyone who sees it may report it, and an
 * admin clears it (the copy stays unsignable) or dismisses the report.
 */
import { Prisma } from "@prisma/client";
import {
  inscribeCopy,
  reportInscription,
  resolveInscriptionReport,
} from "~/server/modules/cards/inscriptions";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const NOW = new Date("2026-11-02T12:00:00Z");
const ADMIN = { dbId: "admin", clerkId: "user_admin" };

const prismaError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError(code, { code, clientVersion: "6" });

/** A database whose transactions run on a client of their own, so a write made outside one shows. */
function mockDb() {
  const tx = createMockPrisma();
  const db = createMockPrisma();
  db.$transaction.mockImplementation(async (work: (client: typeof tx) => Promise<object>) =>
    work(tx)
  );
  return { db, tx };
}

describe("inscribeCopy", () => {
  const sign = (db: ReturnType<typeof createMockPrisma>, over: object = {}) =>
    inscribeCopy(db as never, {
      userId: "u1",
      ownershipId: "own_1",
      text: "  first   pull ",
      now: NOW,
      signerName: "@ixnay",
      ...over,
    });

  it("signs an unsigned, unlocked copy its owner holds, once, with the name frozen", async () => {
    const db = createMockPrisma();
    db.cardOwnership.updateMany.mockResolvedValue({ count: 1 });
    await expect(sign(db)).resolves.toEqual({ inscription: "first pull", name: "@ixnay" });
    expect(db.cardOwnership.updateMany).toHaveBeenCalledTimes(1);
    expect(db.cardOwnership.updateMany).toHaveBeenCalledWith({
      where: { id: "own_1", ownerId: "u1", inscribedAt: null, isLocked: false },
      data: {
        inscription: "first pull",
        inscribedById: "u1",
        inscribedName: "@ixnay",
        inscribedAt: NOW,
      },
    });
  });

  it("refuses a copy already signed (or cleared), locked, or not the signer's, saying what the lock covers", async () => {
    const db = createMockPrisma();
    db.cardOwnership.updateMany.mockResolvedValue({ count: 0 });
    await expect(sign(db)).rejects.toMatchObject({
      code: "CONFLICT",
      message:
        "This copy is already signed, is on sale or at auction, is in a trade you offered, or is no longer yours.",
    });
  });

  it("refuses a signer with no name to print, and writes nothing", async () => {
    const db = createMockPrisma();
    await expect(sign(db, { signerName: null })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: "Claim an IxnayID handle or a nation before signing a card.",
    });
    await expect(sign(db, { signerName: "" })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
    expect(db.cardOwnership.updateMany).not.toHaveBeenCalled();
  });

  it("refuses unsafe text with the rule's reason, and writes nothing", async () => {
    const db = createMockPrisma();
    await expect(sign(db, { text: "<script>" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "HTML tags aren't allowed.",
    });
    await expect(sign(db, { text: "\u200b" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.cardOwnership.updateMany).not.toHaveBeenCalled();
  });
});

describe("reportInscription", () => {
  const report = (db: ReturnType<typeof createMockPrisma>, reason = "  a slur ") =>
    reportInscription(db as never, { reporterId: "u2", ownershipId: "own_1", reason });

  function signedCopy() {
    const db = createMockPrisma();
    db.cardOwnership.findUnique.mockResolvedValue({ inscription: "gg" });
    db.cardInscriptionReport.create.mockResolvedValue({ id: "r1" });
    return db;
  }

  it("files up to 5 waiting reports per player, and refuses a sixth before filing", async () => {
    const fifth = signedCopy();
    fifth.cardInscriptionReport.count.mockResolvedValue(4);
    await expect(report(fifth)).resolves.toEqual({ reportId: "r1" });
    expect(fifth.cardInscriptionReport.count).toHaveBeenCalledWith({
      where: { reporterId: "u2", status: "open" },
    });

    const sixth = signedCopy();
    sixth.cardInscriptionReport.count.mockResolvedValue(5);
    await expect(report(sixth)).rejects.toMatchObject({
      code: "TOO_MANY_REQUESTS",
      message: "You have 5 reports waiting. Staff will answer those first.",
    });
    expect(sixth.cardInscriptionReport.create).not.toHaveBeenCalled();
  });
  it("files one report per player and copy: a second, or a race to it, is refused", async () => {
    const db = signedCopy();
    db.cardInscriptionReport.create.mockRejectedValue(prismaError("P2002"));
    await expect(report(db)).rejects.toMatchObject({
      code: "CONFLICT",
      message: "You already reported this inscription.",
    });
  });
});
describe("resolveInscriptionReport", () => {
  const resolve = (db: ReturnType<typeof createMockPrisma>, action: "clear" | "dismiss") =>
    resolveInscriptionReport(db as never, { actor: ADMIN, reportId: "r1", action, now: NOW });
  const HANDLED = { handledBy: "admin", handledAt: NOW };

  function openReport() {
    const { db, tx } = mockDb();
    db.cardInscriptionReport.updateMany.mockResolvedValue({ count: 1 });
    tx.cardInscriptionReport.updateMany.mockResolvedValue({ count: 1 });
    tx.cardInscriptionReport.findUniqueOrThrow.mockResolvedValue({
      id: "r1",
      ownershipId: "own_1",
      text: "gg",
      ownership: { cardId: "card_1", serialNumber: 3 },
    });
    tx.cardOwnership.updateMany.mockResolvedValue({ count: 1 });
    return { db, tx };
  }

  it("clearing claims the report, removes the text and the signer, closes every open report on the copy and audits it", async () => {
    const { db, tx } = openReport();
    await expect(resolve(db, "clear")).resolves.toEqual({ status: "cleared" });

    expect(tx.cardInscriptionReport.updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: "r1", status: "open" },
      data: { status: "cleared", ...HANDLED },
    });
    expect(tx.cardInscriptionReport.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { id: "r1" },
      select: {
        id: true,
        ownershipId: true,
        text: true,
        ownership: { select: { cardId: true, serialNumber: true } },
      },
    });
    // Only a copy that still has its text; inscribedAt stays, so the copy can never be signed again
    expect(tx.cardOwnership.updateMany).toHaveBeenCalledWith({
      where: { id: "own_1", inscription: { not: null } },
      data: { inscription: null, inscribedById: null, inscribedName: null },
    });
    expect(tx.cardInscriptionReport.updateMany).toHaveBeenNthCalledWith(2, {
      where: { ownershipId: "own_1", status: "open" },
      data: { status: "cleared", ...HANDLED },
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: "user_admin",
        action: "CARD_INSCRIPTION_CLEAR",
        entityType: "CARD",
        target: "card_1",
        details: 'Cleared the inscription "gg" from #3 (report r1)',
        success: true,
      },
    });
    // Every write is in the one transaction
    expect(db.cardOwnership.updateMany).not.toHaveBeenCalled();
    expect(db.cardInscriptionReport.updateMany).not.toHaveBeenCalled();
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });

  it("clears nothing when another admin handled the report first", async () => {
    const { db, tx } = openReport();
    tx.cardInscriptionReport.updateMany.mockResolvedValue({ count: 0 });
    await expect(resolve(db, "clear")).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "This report is already handled.",
    });
    expect(tx.cardInscriptionReport.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.cardOwnership.updateMany).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });
  it("audits once when two admins clear two reports on one copy at the same time", async () => {
    const db = createMockPrisma();
    db.cardInscriptionReport.updateMany.mockResolvedValue({ count: 1 });
    db.cardInscriptionReport.findUniqueOrThrow.mockImplementation(
      async ({ where }: { where: { id: string } }) => ({
        id: where.id,
        ownershipId: "own_1",
        text: "gg",
        ownership: { cardId: "card_1", serialNumber: 3 },
      })
    );
    // The copy's text, as the database holds it: the conditional write clears it once
    let inscription: string | null = "gg";
    db.cardOwnership.updateMany.mockImplementation(
      async ({ where }: { where: { inscription?: { not: null } } }) => {
        if (where.inscription && inscription === null) return { count: 0 };
        inscription = null;
        return { count: 1 };
      }
    );
    const clear = (reportId: string) =>
      resolveInscriptionReport(db as never, { actor: ADMIN, reportId, action: "clear", now: NOW });

    await expect(Promise.all([clear("r1"), clear("r2")])).resolves.toEqual([
      { status: "cleared" },
      { status: "cleared" },
    ]);
    expect(db.cardOwnership.updateMany).toHaveBeenCalledTimes(2);
    expect(db.auditLog.create).toHaveBeenCalledTimes(1);
  });
});
