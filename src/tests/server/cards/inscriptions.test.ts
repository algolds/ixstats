/** @jest-environment node */
/**
 * Inscriptions (spec §2.2): an owner signs a copy once with their name frozen, anyone who sees it may report it, and an
 * admin clears it (the copy stays unsignable) or dismisses the report.
 */
import { Prisma } from "@prisma/client";
import {
  inscribeCopy,
  listInscriptionReports,
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

  it("files the inscription as it reads now, with the reason trimmed", async () => {
    const db = signedCopy();
    await expect(report(db)).resolves.toEqual({ reportId: "r1" });
    expect(db.cardOwnership.findUnique).toHaveBeenCalledWith({
      where: { id: "own_1" },
      select: { inscription: true },
    });
    expect(db.cardInscriptionReport.create).toHaveBeenCalledWith({
      data: { ownershipId: "own_1", reporterId: "u2", text: "gg", reason: "a slur" },
      select: { id: true },
    });
  });

  it("takes a reason of 3 to 500 characters, counted once trimmed", async () => {
    await expect(report(signedCopy(), " abc ")).resolves.toEqual({ reportId: "r1" });
    await expect(report(signedCopy(), `${"\u{1F600}".repeat(500)}  `)).resolves.toEqual({
      reportId: "r1",
    });
  });

  it.each([
    ["under 3 characters once trimmed", "  ab  ", "Say what is wrong with it."],
    ["past 500 characters", "r".repeat(501), "Keep it to 500 characters."],
  ])("refuses a reason %s, before any read", async (_, reason, message) => {
    const db = signedCopy();
    await expect(report(db, reason)).rejects.toMatchObject({ code: "BAD_REQUEST", message });
    expect(db.cardOwnership.findUnique).not.toHaveBeenCalled();
  });

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

  it("refuses a copy with no inscription, or none at all", async () => {
    const unsigned = signedCopy();
    unsigned.cardOwnership.findUnique.mockResolvedValue({ inscription: null });
    await expect(report(unsigned)).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "This copy has no inscription.",
    });
    const gone = signedCopy();
    gone.cardOwnership.findUnique.mockResolvedValue(null);
    await expect(report(gone)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(gone.cardInscriptionReport.create).not.toHaveBeenCalled();
  });

  it("files one report per player and copy: a second, or a race to it, is refused", async () => {
    const db = signedCopy();
    db.cardInscriptionReport.create.mockRejectedValue(prismaError("P2002"));
    await expect(report(db)).rejects.toMatchObject({
      code: "CONFLICT",
      message: "You already reported this inscription.",
    });
  });

  it("refuses a copy removed between the read and the report", async () => {
    const db = signedCopy();
    db.cardInscriptionReport.create.mockRejectedValue(prismaError("P2003"));
    await expect(report(db)).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "This copy has no inscription.",
    });
  });

  it("passes any other failure on", async () => {
    const db = signedCopy();
    const failure = new Error("connection lost");
    db.cardInscriptionReport.create.mockRejectedValue(failure);
    await expect(report(db)).rejects.toBe(failure);
  });
});

describe("listInscriptionReports", () => {
  const row = (id: string, over: { reporterId?: string; ownership?: object } = {}) => ({
    id,
    ownershipId: `own_${id}`,
    text: "gg",
    reason: "a slur",
    reporterId: over.reporterId ?? "u_rep",
    createdAt: NOW,
    ownership: {
      cardId: "card_1",
      inscribedById: "u_sig",
      inscribedName: "@sig",
      cards: { title: "Elm" },
      ...over.ownership,
    },
  });

  it("lists the open reports, oldest first, with the frozen signer and the reporter named for staff", async () => {
    const db = createMockPrisma();
    db.cardInscriptionReport.findMany.mockResolvedValue([
      // A frozen name: its signer is not read
      row("r1", { ownership: { inscribedById: "u_signed" } }),
      // An older signature with no frozen name: the signer's name now
      row("r2", { reporterId: "u_gone", ownership: { inscribedName: null } }),
      row("r3", { ownership: { inscribedName: null, inscribedById: null } }),
    ]);
    const namesOf = jest.fn(
      async (_ids: readonly string[]) =>
        new Map([
          ["u_rep", "@rep"],
          ["u_sig", "@sig_now"],
        ])
    );

    const rows = await listInscriptionReports(db as never, namesOf);

    expect(db.cardInscriptionReport.findMany).toHaveBeenCalledWith({
      where: { status: "open" },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: 100,
      select: {
        id: true,
        ownershipId: true,
        text: true,
        reason: true,
        reporterId: true,
        createdAt: true,
        ownership: {
          select: {
            cardId: true,
            inscribedById: true,
            inscribedName: true,
            cards: { select: { title: true } },
          },
        },
      },
    });
    // One read for everyone named: the reporters, and the signers with no frozen name
    expect(namesOf).toHaveBeenCalledTimes(1);
    expect(namesOf).toHaveBeenCalledWith(["u_rep", "u_gone", "u_sig"]);
    expect(rows).toEqual([
      {
        id: "r1",
        ownershipId: "own_r1",
        cardId: "card_1",
        cardTitle: "Elm",
        text: "gg",
        signerName: "@sig",
        reporterName: "@rep",
        reason: "a slur",
        createdAt: NOW,
      },
      expect.objectContaining({ id: "r2", signerName: "@sig_now", reporterName: null }),
      expect.objectContaining({ id: "r3", signerName: null, reporterName: "@rep" }),
    ]);
    for (const r of rows) expect(r).not.toHaveProperty("reporterId");
  });

  it("names nobody when there is no report", async () => {
    const db = createMockPrisma();
    const namesOf = jest.fn(async () => new Map<string, string>());
    await expect(listInscriptionReports(db as never, namesOf)).resolves.toEqual([]);
    expect(namesOf).toHaveBeenCalledWith([]);
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

  it("closes a report on a copy cleared already, with no second audit row", async () => {
    const { db, tx } = openReport();
    tx.cardOwnership.updateMany.mockResolvedValue({ count: 0 });
    await expect(resolve(db, "clear")).resolves.toEqual({ status: "cleared" });
    expect(tx.cardInscriptionReport.updateMany).toHaveBeenNthCalledWith(2, {
      where: { ownershipId: "own_1", status: "open" },
      data: { status: "cleared", ...HANDLED },
    });
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

  it("dismissing closes only that report, if it is still open", async () => {
    const { db, tx } = openReport();
    await expect(resolve(db, "dismiss")).resolves.toEqual({ status: "dismissed" });
    expect(db.cardInscriptionReport.updateMany).toHaveBeenCalledTimes(1);
    expect(db.cardInscriptionReport.updateMany).toHaveBeenCalledWith({
      where: { id: "r1", status: "open" },
      data: { status: "dismissed", ...HANDLED },
    });
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(tx.cardOwnership.updateMany).not.toHaveBeenCalled();
    expect(db.cardOwnership.updateMany).not.toHaveBeenCalled();
    expect(db.auditLog.create).not.toHaveBeenCalled();

    db.cardInscriptionReport.updateMany.mockResolvedValue({ count: 0 });
    await expect(resolve(db, "dismiss")).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "This report is already handled.",
    });
  });
});
