/**
 * Signing a copy (once, 60 characters, the signer's name frozen), reporting an inscription, and the admin queue that
 * clears or dismisses reports (spec §2.2). A cleared copy stays unsignable: clearing keeps `inscribedAt`. Players are
 * named by the router, which reads identity (card modules may not): it passes the signer's name in, and the queue's
 * names for staff.
 */
import type { PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { INSCRIPTION_QUEUE_SIZE, sanitizeInscription } from "~/lib/cards/inscription";
import { isMissingRecord, isUniqueViolation } from "~/lib/prisma-error";
import type { CardAdminActor } from "~/server/shared/admin-actor";
import { recordCardAudit } from "./cards.audit";

const REASON_MIN = 3;
const REASON_MAX = 500;
/** Open reports one player may have waiting (as for takedown requests). */
const WAITING_CAP = 5;
const NO_INSCRIPTION = "This copy has no inscription.";
const HANDLED = "This report is already handled.";

/**
 * Signs the copy for its owner, with `signerName` (the name other players read, `PlayerName.displayName`) frozen beside
 * it. A player with no such name cannot sign; nor can anyone sign a copy that is signed, was cleared, or is locked: on
 * sale, at auction, or offered by its holder in a trade (a copy only asked for in an offer stays unlocked).
 */
export async function inscribeCopy(
  db: PrismaClient,
  input: { userId: string; ownershipId: string; text: string; now: Date; signerName: string | null }
): Promise<{ inscription: string; name: string }> {
  const { signerName } = input;
  if (!signerName) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Claim an IxnayID handle or a nation before signing a card.",
    });
  }
  const check = sanitizeInscription(input.text);
  if (!check.ok) throw new TRPCError({ code: "BAD_REQUEST", message: check.reason });
  const signed = await db.cardOwnership.updateMany({
    where: { id: input.ownershipId, ownerId: input.userId, inscribedAt: null, isLocked: false },
    data: {
      inscription: check.text,
      inscribedById: input.userId,
      inscribedName: signerName,
      inscribedAt: input.now,
    },
  });
  if (signed.count !== 1) {
    throw new TRPCError({
      code: "CONFLICT",
      message:
        "This copy is already signed, is on sale or at auction, is in a trade you offered, or is no longer yours.",
    });
  }
  return { inscription: check.text, name: signerName };
}

/** One report per player and copy, and at most 5 waiting per player, keeping the text as it read when reported. */
export async function reportInscription(
  db: PrismaClient,
  input: { reporterId: string; ownershipId: string; reason: string }
): Promise<{ reportId: string }> {
  const reason = input.reason.trim();
  const length = [...reason].length;
  if (length < REASON_MIN) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Say what is wrong with it." });
  }
  if (length > REASON_MAX) {
    throw new TRPCError({ code: "BAD_REQUEST", message: `Keep it to ${REASON_MAX} characters.` });
  }
  const copy = await db.cardOwnership.findUnique({
    where: { id: input.ownershipId },
    select: { inscription: true },
  });
  if (!copy?.inscription) throw new TRPCError({ code: "NOT_FOUND", message: NO_INSCRIPTION });
  const waiting = await db.cardInscriptionReport.count({
    where: { reporterId: input.reporterId, status: "open" },
  });
  if (waiting >= WAITING_CAP) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: `You have ${WAITING_CAP} reports waiting. Staff will answer those first.`,
    });
  }
  try {
    const report = await db.cardInscriptionReport.create({
      data: {
        ownershipId: input.ownershipId,
        reporterId: input.reporterId,
        text: copy.inscription,
        reason,
      },
      select: { id: true },
    });
    return { reportId: report.id };
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new TRPCError({ code: "CONFLICT", message: "You already reported this inscription." });
    }
    // The copy went (burned or revoked) between the read and the report
    if (isMissingRecord(error)) throw new TRPCError({ code: "NOT_FOUND", message: NO_INSCRIPTION });
    throw error;
  }
}

export interface InscriptionReportRow {
  id: string;
  ownershipId: string;
  cardId: string;
  cardTitle: string;
  /** The copy's serial, so reports on two copies of one card read apart. */
  serialNumber: number;
  /** The inscription as it read when reported. */
  text: string;
  /** The name frozen at signing (an older signature's: the signer's name now); null reads "a player". */
  signerName: string | null;
  /** Who reported it, named for staff; null for a player who no longer exists. */
  reporterName: string | null;
  reason: string;
  createdAt: Date;
}

/** Players' names for staff, by DB id, in one read; an id that names no player is left out. */
export type StaffNames = (userIds: readonly string[]) => Promise<ReadonlyMap<string, string>>;

/** The open reports, oldest first. */
export async function listInscriptionReports(
  db: PrismaClient,
  namesOf: StaffNames
): Promise<InscriptionReportRow[]> {
  const reports = await db.cardInscriptionReport.findMany({
    where: { status: "open" },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: INSCRIPTION_QUEUE_SIZE,
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
          serialNumber: true,
          inscribedById: true,
          inscribedName: true,
          cards: { select: { title: true } },
        },
      },
    },
  });
  // A signer is read only for an older signature, which froze no name
  const unfrozen = reports.flatMap(({ ownership }) =>
    ownership.inscribedName === null && ownership.inscribedById ? [ownership.inscribedById] : []
  );
  const names = await namesOf([...new Set([...reports.map((r) => r.reporterId), ...unfrozen])]);
  const nameOf = (id: string | null) => (id ? (names.get(id) ?? null) : null);
  return reports.map(({ ownership, reporterId, ...report }) => ({
    id: report.id,
    ownershipId: report.ownershipId,
    cardId: ownership.cardId,
    cardTitle: ownership.cards.title,
    serialNumber: ownership.serialNumber,
    text: report.text,
    signerName: ownership.inscribedName ?? nameOf(ownership.inscribedById),
    reporterName: nameOf(reporterId),
    reason: report.reason,
    createdAt: report.createdAt,
  }));
}

/** Closes the report if it is still open; refuses one another admin has handled. */
async function claimReport(
  db: Pick<PrismaClient, "cardInscriptionReport">,
  reportId: string,
  data: { status: "cleared" | "dismissed"; handledBy: string; handledAt: Date }
): Promise<void> {
  const claimed = await db.cardInscriptionReport.updateMany({
    where: { id: reportId, status: "open" },
    data,
  });
  if (claimed.count !== 1) throw new TRPCError({ code: "NOT_FOUND", message: HANDLED });
}

/**
 * Dismissing closes that report. Clearing removes the text and the signer, closes every open report on the copy, and
 * writes a `CARD_INSCRIPTION_CLEAR` audit row, in one transaction. A copy another admin cleared first (through another
 * report on it) is cleared once: the report closes, and no second audit row is written.
 */
export async function resolveInscriptionReport(
  db: PrismaClient,
  input: { actor: CardAdminActor; reportId: string; action: "clear" | "dismiss"; now: Date }
): Promise<{ status: "cleared" | "dismissed" }> {
  const handled = { handledBy: input.actor.dbId, handledAt: input.now };
  if (input.action === "dismiss") {
    await claimReport(db, input.reportId, { status: "dismissed", ...handled });
    return { status: "dismissed" };
  }
  await db.$transaction(async (tx) => {
    await claimReport(tx, input.reportId, { status: "cleared", ...handled });
    const report = await tx.cardInscriptionReport.findUniqueOrThrow({
      where: { id: input.reportId },
      select: {
        id: true,
        ownershipId: true,
        text: true,
        ownership: { select: { cardId: true, serialNumber: true } },
      },
    });
    const cleared = await tx.cardOwnership.updateMany({
      where: { id: report.ownershipId, inscription: { not: null } },
      data: { inscription: null, inscribedById: null, inscribedName: null },
    });
    await tx.cardInscriptionReport.updateMany({
      where: { ownershipId: report.ownershipId, status: "open" },
      data: { status: "cleared", ...handled },
    });
    if (cleared.count !== 1) return;
    await recordCardAudit(tx, {
      action: "CARD_INSCRIPTION_CLEAR",
      actor: input.actor.clerkId,
      target: report.ownership.cardId,
      details: `Cleared the inscription "${report.text}" from #${report.ownership.serialNumber} (report ${report.id})`,
    });
  });
  return { status: "cleared" };
}
