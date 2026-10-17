/**
 * Curation. The review queue: imported cards wait PENDING until an admin approves them into packs or rejects them;
 * a card whose art licence is restricted is never approved. The suggestion queue: players' free suggestions, made
 * into cards (skipping the length gate, never the licence gate) or declined. Admins curate the system realms and
 * Ixnay, and may open any realm (realm owners curate theirs in Phase 5).
 */
import type { CardType, Prisma, PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { DEFAULT_REALM_ID } from "~/lib/realms/realm-ids";
import { parseCardArticleSource, type CardWikiSource } from "~/lib/cards/card-sources";
import { recordCardAudit, type CardAdminActor } from "./cards.audit";
import { stageForAdmin } from "./cards.importer";

export interface QueueFilter {
  /** "admin": the system realms and Ixnay; "all": every realm; else one realm's id. */
  realm: string;
  source?: CardWikiSource;
  cardType?: CardType;
}

const ADMIN_REALMS: Prisma.RealmWhereInput = { OR: [{ isSystem: true }, { id: DEFAULT_REALM_ID }] };
const RESTRICTED_ART: Prisma.CardWhereInput = { artLicence: { is: { status: "RESTRICTED" } } };

function realmWhere(realm: string): Prisma.CardWhereInput {
  if (realm === "all") return {};
  return realm === "admin" ? { realm: ADMIN_REALMS } : { realmId: realm };
}

export function queueWhere(filter: QueueFilter): Prisma.CardWhereInput {
  return {
    reviewState: "PENDING",
    ...realmWhere(filter.realm),
    ...(filter.source ? { wikiSource: filter.source } : {}),
    ...(filter.cardType ? { cardType: filter.cardType } : {}),
  };
}

export async function listReviewQueue(
  db: PrismaClient,
  input: QueueFilter & { cursor?: string; limit: number }
) {
  const where = queueWhere(input);
  const [cards, total] = await Promise.all([
    db.card.findMany({
      where,
      orderBy: { id: "asc" },
      take: input.limit,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      select: {
        id: true,
        title: true,
        cardType: true,
        rarity: true,
        wikiSource: true,
        wikiArticleTitle: true,
        wikiExcerpt: true,
        createdAt: true,
        realm: { select: { id: true, name: true } },
        artLicence: {
          select: { status: true, licence: true, attribution: true, descriptionUrl: true },
        },
      },
    }),
    db.card.count({ where }),
  ]);
  const nextCursor = cards.length === input.limit ? (cards[cards.length - 1]?.id ?? null) : null;
  return { cards, total, nextCursor };
}

export interface ReviewInput {
  decision: "APPROVE" | "REJECT";
  cardIds?: string[];
  filter?: QueueFilter;
  note?: string;
}

/**
 * The cards a review acts on. Chosen cards: pending ones, and for an approval also rejected ones (a rejection can be
 * undone). A filter acts on the queue as it shows, so it takes pending cards only.
 */
function reviewableWhere(input: ReviewInput, approve: boolean): Prisma.CardWhereInput {
  if (input.cardIds?.length) {
    return {
      id: { in: input.cardIds },
      reviewState: approve ? { in: ["PENDING", "REJECTED"] } : "PENDING",
    };
  }
  if (input.filter) return queueWhere(input.filter);
  throw new TRPCError({ code: "BAD_REQUEST", message: "Choose at least one card" });
}

export async function reviewCards(
  db: PrismaClient,
  actor: CardAdminActor,
  input: ReviewInput
): Promise<{ updated: number; skippedRestricted: number }> {
  const approve = input.decision === "APPROVE";
  const reviewable = reviewableWhere(input, approve);
  const skippedRestricted = approve
    ? await db.card.count({ where: { ...reviewable, ...RESTRICTED_ART } })
    : 0;
  const result = await db.card.updateMany({
    where: approve ? { ...reviewable, NOT: RESTRICTED_ART } : reviewable,
    data: {
      reviewState: approve ? "APPROVED" : "REJECTED",
      reviewedAt: new Date(),
      reviewedBy: actor.dbId,
    },
  });
  await recordCardAudit(db, {
    action: "CARD_REVIEW",
    actor: actor.clerkId,
    target: input.cardIds?.length === 1 ? input.cardIds[0] : null,
    details: `${approve ? "Approved" : "Rejected"} ${result.count} card(s)${input.note ? `: ${input.note}` : ""}`,
  });
  return { updated: result.count, skippedRestricted };
}

export async function listSuggestions(
  db: PrismaClient,
  input: { status: "PENDING" | "DONE"; limit: number }
) {
  const waiting = input.status === "PENDING";
  const requests = await db.loreCardRequest.findMany({
    where: { status: waiting ? "PENDING" : { in: ["GENERATED", "REJECTED"] } },
    orderBy: { requestedAt: waiting ? "asc" : "desc" },
    take: input.limit,
    select: {
      id: true,
      articleTitle: true,
      wikiSource: true,
      realmId: true,
      status: true,
      requestedAt: true,
      rejectionReason: true,
      cardId: true,
    },
  });
  const realmIds = [...new Set(requests.flatMap((request) => request.realmId ?? []))];
  const realms = await db.realm.findMany({
    where: { id: { in: realmIds } },
    select: { id: true, name: true },
  });
  const names = new Map(realms.map((realm) => [realm.id, realm.name]));
  return requests.map((request) => ({
    ...request,
    realmName: request.realmId ? (names.get(request.realmId) ?? null) : null,
  }));
}

const ANSWERED = "This suggestion has been answered";

export async function acceptSuggestion(
  db: PrismaClient,
  actor: CardAdminActor,
  requestId: string
): Promise<{ cardId: string }> {
  const request = await db.loreCardRequest.findUnique({ where: { id: requestId } });
  if (!request) throw new TRPCError({ code: "NOT_FOUND", message: "Suggestion not found" });
  if (request.status !== "PENDING") throw new TRPCError({ code: "BAD_REQUEST", message: ANSWERED });
  const source = parseCardArticleSource(request.wikiSource);
  if (!source) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Suggestions come from IxWiki, IIWiki or AltHistory",
    });
  }

  // A page that cannot become a card (blocked art, already a card, a failed read) throws, and the suggestion waits.
  const { cardId } = await stageForAdmin(db, source, {
    title: request.articleTitle,
    requestedBy: actor.dbId,
    jobId: null,
    bypassLengthGate: true,
    reviewState: "APPROVED",
  });

  const now = new Date();
  await db.loreCardRequest.update({
    where: { id: requestId },
    data: {
      status: "GENERATED",
      cardId,
      reviewedAt: now,
      reviewedBy: actor.dbId,
      generatedAt: now,
    },
  });
  await recordCardAudit(db, {
    action: "CARD_SUGGESTION",
    actor: actor.clerkId,
    target: cardId,
    details: `Made the suggestion "${request.articleTitle}" into a card`,
  });
  return { cardId };
}

export async function declineSuggestion(
  db: PrismaClient,
  actor: CardAdminActor,
  input: { requestId: string; reason: string }
): Promise<void> {
  const declined = await db.loreCardRequest.updateMany({
    where: { id: input.requestId, status: "PENDING" },
    data: {
      status: "REJECTED",
      rejectionReason: input.reason,
      reviewedAt: new Date(),
      reviewedBy: actor.dbId,
    },
  });
  if (declined.count !== 1) throw new TRPCError({ code: "CONFLICT", message: ANSWERED });
  await recordCardAudit(db, {
    action: "CARD_SUGGESTION",
    actor: actor.clerkId,
    target: input.requestId,
    details: `Declined a suggestion: ${input.reason}`,
  });
}
