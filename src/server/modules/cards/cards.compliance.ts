/**
 * Compliance: one takedown queue for every card source. A request is answered within 14 days: hide the art or decline
 * with the reason. Hiding is reversible: the art is kept on the takedown and restore puts it back. A takedown never
 * changes a card's review state. One request is active (OPEN or HIDDEN) per card. Licence review lists art whose
 * licence is unknown or restricted, and restricted art is hidden. NationStates flag owners keep their self-service
 * takedown, which files and hides in one step; a player asks for any other card to come down with a request.
 */
import type { CardLicenceStatus, CardTakedownOrigin, Prisma, PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { fileNameFromArtworkUrl } from "~/lib/cards/art-licence";
import { parseCardWikiSource } from "~/lib/cards/card-sources";
import { isJsonObject, nsFactsOf } from "~/lib/cards/ns-facts";
import { takedownDueAt } from "~/lib/cards/takedown-deadline";
import type { CardAdminActor } from "~/server/shared/admin-actor";
import { recordCardAudit } from "./cards.audit";

type Tx = Prisma.TransactionClient;

/** Arbitrary constant; identifies the per-card takedown locks in pg_locks. */
const TAKEDOWN_LOCK_NAMESPACE = 7335;

const ANSWERED = "This takedown has been answered";
const ALREADY_ACTIVE = "This card already has an open takedown";
const ORIGIN_NAMES: Record<CardTakedownOrigin, string> = {
  NS_SELF_SERVICE: "flag owner",
  AUTHOR_REQUEST: "author",
  LICENCE_REVIEW: "licence review",
  ADMIN: "admin",
  PLAYER_REQUEST: "player",
};
const NOT_HIDDEN = "Only hidden art can be restored";

/**
 * Takes the card's takedown lock for the rest of the transaction: filing, hiding, self-service, restore, the licence
 * review and the Library and Designer edits serialise on it, so a check (no active request, the licence, a hold) and
 * the write that follows cannot interleave with another. `$executeRaw`: Prisma cannot deserialize the `void` the lock
 * returns.
 */
export async function lockCardTakedownsTx(tx: Tx, cardId: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${TAKEDOWN_LOCK_NAMESPACE}::int, hashtext(${cardId}))`;
}

/** Takes the lock of the card a takedown is for; refuses a takedown that does not exist. */
async function lockTakedownCardTx(tx: Tx, takedownId: string): Promise<void> {
  const ref = await tx.cardTakedown.findUnique({
    where: { id: takedownId },
    select: { cardId: true },
  });
  if (!ref) throw new TRPCError({ code: "NOT_FOUND", message: "Takedown not found" });
  await lockCardTakedownsTx(tx, ref.cardId);
}

/** A card's takedowns that hide its art, for a `_count` select a hold check reads. */
export const HIDDEN_TAKEDOWNS = { where: { status: "HIDDEN" } } as const;

/** What a hold check reads: the card's hiding takedowns (`HIDDEN_TAKEDOWNS`) and its licence. */
export interface HoldCheckedCard {
  artLicence: { status: CardLicenceStatus } | null;
  _count: { takedowns: number };
}

/**
 * Refuses a change to art Compliance holds: art a takedown hid, or whose licence is restricted, is changed and shown
 * again only from Compliance. The caller holds the card's takedown lock.
 */
export function assertArtNotHeld(card: HoldCheckedCard): void {
  if (card._count.takedowns > 0 || card.artLicence?.status === "RESTRICTED") {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        "A takedown or a restricted licence hides this card's art. Change it from Compliance.",
    });
  }
}

/**
 * The licence row describes the card's art file, so it follows an art change made in the Library or the Designer:
 * new art waits in Licence review as unknown, named by its file when it is on the card's own wiki, and a card with no
 * art has no row. The caller holds the card's takedown lock and has checked no hold stands.
 */
export async function artLicenceFollowsTx(
  tx: Tx,
  card: { id: string; wikiSource: string | null },
  artwork: string | null,
  changedIn: "Library" | "Designer"
): Promise<void> {
  if (artwork === null) {
    await tx.cardArtLicence.deleteMany({ where: { cardId: card.id } });
    return;
  }
  const wiki = parseCardWikiSource(card.wikiSource) ?? "ixwiki";
  const licence = {
    wiki,
    status: "UNKNOWN" as const,
    fileUrl: artwork,
    fileTitle: fileNameFromArtworkUrl(artwork, wiki),
    descriptionUrl: null,
    licence: null,
    licenceUrl: null,
    artist: null,
    attribution: null,
    reviewedBy: null,
    reviewedAt: null,
    note: `Art changed in the ${changedIn}`,
  };
  await tx.cardArtLicence.upsert({
    where: { cardId: card.id },
    create: { cardId: card.id, ...licence },
    update: licence,
  });
}

/** The card's active request. The caller holds the card's takedown lock. */
function activeTakedown(tx: Tx, cardId: string) {
  return tx.cardTakedown.findFirst({
    where: { cardId, status: { in: ["OPEN", "HIDDEN"] } },
    select: { id: true, status: true },
  });
}

/** An old takedown's marker: the card was hidden (and retired) before the queue, and has no request for it yet. */
const hasLegacyMarker = (metadata: Prisma.JsonValue): boolean =>
  isJsonObject(metadata) && isJsonObject(metadata.nsTakedown);

/**
 * Hide the art for an open request: the art moves onto the takedown, and the card is retired (out of packs and
 * Explore; owned copies stay, with the placeholder face). The status claim makes a second answer fail, and the card
 * write matches the art and retirement it read, so art written in between is never dropped unsaved. A card an old
 * takedown hid counts as retired by this one, so restore brings it back.
 */
async function hideArt(tx: Tx, takedownId: string, resolvedBy: string | null): Promise<string> {
  const takedown = await tx.cardTakedown.findUnique({
    where: { id: takedownId },
    select: {
      card: { select: { id: true, artwork: true, isRetired: true, metadata: true } },
    },
  });
  if (!takedown) throw new TRPCError({ code: "NOT_FOUND", message: "Takedown not found" });
  const { card } = takedown;
  const now = new Date();
  const claimed = await tx.cardTakedown.updateMany({
    where: { id: takedownId, status: "OPEN" },
    data: {
      status: "HIDDEN",
      savedArtwork: card.artwork,
      retiredByTakedown: !card.isRetired || hasLegacyMarker(card.metadata),
      resolvedAt: now,
      resolvedBy,
    },
  });
  if (claimed.count !== 1) throw new TRPCError({ code: "CONFLICT", message: ANSWERED });
  const hidden = await tx.card.updateMany({
    where: { id: card.id, artwork: card.artwork, isRetired: card.isRetired },
    data: { artwork: null, isRetired: true, ...(card.isRetired ? {} : { retiredAt: now }) },
  });
  if (hidden.count !== 1) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "The card changed while its art was being hidden. Try again.",
    });
  }
  return card.id;
}

export interface FileTakedownInput {
  cardId: string;
  origin: CardTakedownOrigin;
  reason: string;
  contact?: string;
  /** The DB user who asked, when it is not the filing admin (a player's request). Only admins read it. */
  requestedBy?: string;
  /** When the request arrived; one still to come counts as now, so its deadline is never pushed out. */
  receivedAt?: Date;
  hideNow?: boolean;
}

/** File a request for a card the caller has checked has none active, hiding its art at once when asked. */
async function createTakedownTx(
  tx: Tx,
  actor: CardAdminActor | null,
  input: FileTakedownInput
): Promise<string> {
  const now = new Date();
  const receivedAt = input.receivedAt && input.receivedAt < now ? input.receivedAt : now;
  const takedown = await tx.cardTakedown.create({
    data: {
      cardId: input.cardId,
      origin: input.origin,
      reason: input.reason,
      contact: input.contact || null,
      requestedBy: input.requestedBy ?? actor?.dbId ?? null,
      receivedAt,
      dueAt: takedownDueAt(receivedAt),
    },
  });
  if (input.hideNow) await hideArt(tx, takedown.id, actor?.dbId ?? null);
  await recordCardAudit(tx, {
    action: "CARD_TAKEDOWN",
    actor: actor?.clerkId ?? null,
    target: input.cardId,
    details: `Filed a takedown (${ORIGIN_NAMES[input.origin]})${input.hideNow ? " and hid the art" : ""}: ${input.reason}`,
  });
  return takedown.id;
}

async function cardOrThrow(db: PrismaClient, cardId: string) {
  const card = await db.card.findUnique({
    where: { id: cardId },
    select: { id: true, wikiSource: true },
  });
  if (!card) throw new TRPCError({ code: "NOT_FOUND", message: "Card not found" });
  return card;
}

/** File a takedown request. Refused while the card has one active, so one request is active per card. */
export async function fileTakedown(
  db: PrismaClient,
  actor: CardAdminActor | null,
  input: FileTakedownInput
): Promise<{ takedownId: string }> {
  await cardOrThrow(db, input.cardId);
  const takedownId = await db.$transaction(async (tx) => {
    await lockCardTakedownsTx(tx, input.cardId);
    if (await activeTakedown(tx, input.cardId)) {
      throw new TRPCError({ code: "CONFLICT", message: ALREADY_ACTIVE });
    }
    return createTakedownTx(tx, actor, input);
  });
  return { takedownId };
}

/** Waiting player requests one player may have (a soft cap against spam; staff answer within 14 days). */
const PLAYER_REQUEST_CAP = 5;

/**
 * A player's takedown request for a card that is not from NationStates (those keep the verified self-service
 * takedown): one active request per card, so a card already in the queue answers "already" and files nothing.
 */
export async function requestTakedown(
  db: PrismaClient,
  input: { cardId: string; requesterId: string; reason: string; contact?: string }
): Promise<{ status: "filed" | "already" }> {
  const card = await db.card.findUnique({
    where: { id: input.cardId },
    select: { id: true, cardType: true },
  });
  if (!card) throw new TRPCError({ code: "NOT_FOUND", message: "Card not found" });
  if (card.cardType === "NS") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "NationStates cards use Verify & request takedown.",
    });
  }
  return db.$transaction(async (tx) => {
    await lockCardTakedownsTx(tx, card.id);
    if (await activeTakedown(tx, card.id)) return { status: "already" as const };
    const waiting = await tx.cardTakedown.count({
      where: { requestedBy: input.requesterId, origin: "PLAYER_REQUEST", status: "OPEN" },
    });
    if (waiting >= PLAYER_REQUEST_CAP) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: `You have ${PLAYER_REQUEST_CAP} requests waiting. Staff will answer those first.`,
      });
    }
    await createTakedownTx(tx, null, {
      cardId: card.id,
      origin: "PLAYER_REQUEST",
      reason: input.reason,
      contact: input.contact,
      requestedBy: input.requesterId,
    });
    return { status: "filed" as const };
  });
}

export interface LicenceTakedownReport {
  filed: number;
  /** Cards that already had an active request. */
  skipped: number;
  /** Cards whose filing failed; each was rolled back and stays restricted with its art showing. */
  failed: Array<{ cardId: string; reason: string }>;
}

/**
 * File a licence-review request and hide the art for each card a licence check found restricted (the compliance
 * backfill). A card that already has an active request is skipped; one card's failure is counted and never stops the
 * rest.
 */
export async function fileLicenceTakedowns(
  db: PrismaClient,
  cards: ReadonlyArray<{ cardId: string; licence: string | null }>
): Promise<LicenceTakedownReport> {
  const report: LicenceTakedownReport = { filed: 0, skipped: 0, failed: [] };
  for (const card of cards) {
    try {
      await fileTakedown(db, null, {
        cardId: card.cardId,
        origin: "LICENCE_REVIEW",
        reason: restrictedReason(card.licence),
        hideNow: true,
      });
      report.filed += 1;
    } catch (error) {
      if (error instanceof TRPCError && error.message === ALREADY_ACTIVE) report.skipped += 1;
      else {
        const reason = error instanceof Error ? error.message : String(error);
        report.failed.push({ cardId: card.cardId, reason });
      }
    }
  }
  return report;
}

export async function hideTakedownArt(
  db: PrismaClient,
  actor: CardAdminActor,
  takedownId: string
): Promise<void> {
  await db.$transaction(async (tx) => {
    // Under the card's lock, so a Library or Designer edit cannot write art over the hide
    await lockTakedownCardTx(tx, takedownId);
    const cardId = await hideArt(tx, takedownId, actor.dbId);
    await recordCardAudit(tx, {
      action: "CARD_TAKEDOWN",
      actor: actor.clerkId,
      target: cardId,
      details: "Hid the art",
    });
  });
}

export async function declineTakedown(
  db: PrismaClient,
  actor: CardAdminActor,
  input: { takedownId: string; note: string }
): Promise<void> {
  await db.$transaction(async (tx) => {
    const takedown = await tx.cardTakedown.findUnique({
      where: { id: input.takedownId },
      select: { cardId: true },
    });
    if (!takedown) throw new TRPCError({ code: "NOT_FOUND", message: "Takedown not found" });
    const declined = await tx.cardTakedown.updateMany({
      where: { id: input.takedownId, status: "OPEN" },
      data: {
        status: "DECLINED",
        resolutionNote: input.note,
        resolvedAt: new Date(),
        resolvedBy: actor.dbId,
      },
    });
    if (declined.count !== 1) throw new TRPCError({ code: "CONFLICT", message: ANSWERED });
    await recordCardAudit(tx, {
      action: "CARD_TAKEDOWN",
      actor: actor.clerkId,
      target: takedown.cardId,
      details: `Declined a takedown: ${input.note}`,
    });
  });
}

/**
 * What restoring puts back on the card: the saved art (or the NationStates flag, for an old takedown that purged the
 * art), unless an admin has set art since; the retirement only if the takedown made it; and the old takedown marker
 * cleared.
 */
function restoredCard(takedown: {
  savedArtwork: string | null;
  retiredByTakedown: boolean;
  card: { artwork: string | null; metadata: Prisma.JsonValue };
}): Prisma.CardUpdateInput {
  const { card } = takedown;
  const art = takedown.savedArtwork ?? nsFactsOf(card.metadata).flag ?? null;
  const meta = isJsonObject(card.metadata) ? card.metadata : {};
  return {
    ...(art && !card.artwork ? { artwork: art } : {}),
    ...(takedown.retiredByTakedown ? { isRetired: false, retiredAt: null } : {}),
    ...("nsTakedown" in meta ? { metadata: { ...meta, nsTakedown: null } } : {}),
  };
}

/** Restore hidden art. Refused while the art's licence is restricted, so restricted art never shows. */
export async function restoreTakedown(
  db: PrismaClient,
  actor: CardAdminActor,
  takedownId: string
): Promise<void> {
  await db.$transaction(async (tx) => {
    // Under the card's lock, so a restricted mark landing now is seen before the art comes back
    await lockTakedownCardTx(tx, takedownId);
    const takedown = await tx.cardTakedown.findUnique({
      where: { id: takedownId },
      select: {
        status: true,
        savedArtwork: true,
        retiredByTakedown: true,
        card: {
          select: {
            id: true,
            artwork: true,
            metadata: true,
            artLicence: { select: { status: true } },
          },
        },
      },
    });
    if (takedown?.status !== "HIDDEN") {
      throw new TRPCError({ code: "CONFLICT", message: NOT_HIDDEN });
    }
    if (takedown.card.artLicence?.status === "RESTRICTED") {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message:
          "This art's licence is restricted. Mark it open in Licence review before restoring it.",
      });
    }
    const claimed = await tx.cardTakedown.updateMany({
      where: { id: takedownId, status: "HIDDEN" },
      data: { status: "RESTORED", resolvedAt: new Date(), resolvedBy: actor.dbId },
    });
    if (claimed.count !== 1) throw new TRPCError({ code: "CONFLICT", message: NOT_HIDDEN });
    await tx.card.update({ where: { id: takedown.card.id }, data: restoredCard(takedown) });
    await recordCardAudit(tx, {
      action: "CARD_TAKEDOWN",
      actor: actor.clerkId,
      target: takedown.card.id,
      details: "Restored the art",
    });
  });
}

/** Waiting requests by deadline; hidden and answered ones (declined or restored) newest first. */
export function listTakedowns(
  db: PrismaClient,
  input: { status: "OPEN" | "HIDDEN" | "ANSWERED"; limit: number }
) {
  return db.cardTakedown.findMany({
    where: {
      status: input.status === "ANSWERED" ? { in: ["DECLINED", "RESTORED"] } : input.status,
    },
    orderBy: input.status === "OPEN" ? { dueAt: "asc" } : { resolvedAt: "desc" },
    take: input.limit,
    select: {
      id: true,
      origin: true,
      status: true,
      reason: true,
      contact: true,
      // Admin-only: the router names a player's request by it and never returns the id
      requestedBy: true,
      receivedAt: true,
      dueAt: true,
      resolvedAt: true,
      resolutionNote: true,
      card: { select: { id: true, title: true, cardType: true, wikiSource: true } },
    },
  });
}

/**
 * A verified NationStates flag owner's takedown: files a request and hides the art in one step, or hides through the
 * request already waiting. Nothing changes when the art is already hidden.
 */
export async function selfServiceTakedown(
  db: PrismaClient,
  input: { cardId: string; verifiedNation: string; reason?: string; requestedBy: string | null }
): Promise<{ alreadyHidden: boolean }> {
  return db.$transaction(async (tx) => {
    await lockCardTakedownsTx(tx, input.cardId);
    const active = await activeTakedown(tx, input.cardId);
    if (active?.status === "HIDDEN") return { alreadyHidden: true };
    const reason = input.reason?.trim() || "Flag owner takedown";
    const now = new Date();
    const takedownId =
      active?.id ??
      (
        await tx.cardTakedown.create({
          data: {
            cardId: input.cardId,
            origin: "NS_SELF_SERVICE",
            reason,
            contact: `NationStates: ${input.verifiedNation}`,
            requestedBy: input.requestedBy,
            receivedAt: now,
            dueAt: takedownDueAt(now),
          },
        })
      ).id;
    await hideArt(tx, takedownId, input.requestedBy);
    await recordCardAudit(tx, {
      action: "CARD_TAKEDOWN",
      actor: null,
      target: input.cardId,
      details: `The flag owner (${input.verifiedNation}) hid the art: ${reason}`,
    });
    return { alreadyHidden: false };
  });
}

/** Licence records at one status, oldest first, with their total. A card whose `artwork` is null has its art hidden. */
export async function listLicenceReview(
  db: PrismaClient,
  input: { status: "UNKNOWN" | "RESTRICTED"; limit: number }
) {
  const where = { status: input.status };
  const [rows, total] = await Promise.all([
    db.cardArtLicence.findMany({
      where,
      orderBy: { createdAt: "asc" },
      take: input.limit,
      select: {
        cardId: true,
        wiki: true,
        fileTitle: true,
        descriptionUrl: true,
        licence: true,
        note: true,
        card: { select: { title: true, artwork: true } },
      },
    }),
    db.cardArtLicence.count({ where }),
  ]);
  return { rows, total };
}

function restrictedReason(licence: string | null): string {
  return licence
    ? `Licensed ${licence}, which does not allow commercial use or changes`
    : "Its licence does not allow commercial use or changes";
}

/**
 * Hide restricted art: through the card's active request if one is waiting, else a new licence-review request. The
 * caller holds the card's takedown lock.
 */
async function hideRestrictedArtTx(tx: Tx, actor: CardAdminActor, cardId: string, licence: string) {
  const active = await activeTakedown(tx, cardId);
  if (active?.status === "HIDDEN") return;
  if (!active) {
    await createTakedownTx(tx, actor, {
      cardId,
      origin: "LICENCE_REVIEW",
      reason: restrictedReason(licence),
      hideNow: true,
    });
    return;
  }
  await hideArt(tx, active.id, actor.dbId);
  await recordCardAudit(tx, {
    action: "CARD_TAKEDOWN",
    actor: actor.clerkId,
    target: cardId,
    details: `Hid the art: licensed ${licence}`,
  });
}

/** Record an admin's licence check. A restricted licence hides the art at once; an open one restores nothing. */
export async function setCardLicence(
  db: PrismaClient,
  actor: CardAdminActor,
  input: { cardId: string; status: "OPEN" | "RESTRICTED"; licence: string; note?: string }
): Promise<void> {
  const card = await cardOrThrow(db, input.cardId);
  const review = {
    status: input.status,
    licence: input.licence,
    note: input.note || null,
    reviewedBy: actor.dbId,
    reviewedAt: new Date(),
  };
  await db.$transaction(async (tx) => {
    await lockCardTakedownsTx(tx, card.id);
    await tx.cardArtLicence.upsert({
      where: { cardId: card.id },
      update: review,
      create: { cardId: card.id, wiki: card.wikiSource ?? "ixwiki", ...review },
    });
    await recordCardAudit(tx, {
      action: "CARD_LICENCE",
      actor: actor.clerkId,
      target: card.id,
      details: `Licence ${input.status.toLowerCase()}: ${input.licence}`,
    });
    if (input.status === "RESTRICTED") await hideRestrictedArtTx(tx, actor, card.id, input.licence);
  });
}
