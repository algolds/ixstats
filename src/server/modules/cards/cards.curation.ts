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
import { EXCLUDE_RESTRICTED_ART, RESTRICTED_ART } from "~/lib/cards/art-licence";
import { cardCount } from "~/lib/cards/curation-limits";
import type { CardAdminActor } from "~/server/shared/admin-actor";
import { recordCardAudit } from "./cards.audit";
import { assertBulkRead, assertBulkRecountTx } from "./cards.bulk";
import { stageForAdmin } from "./cards.importer";

export interface QueueFilter {
  /** "admin": the system realms and Ixnay; "all": every realm; else one realm's id. */
  realm: string;
  source?: CardWikiSource;
  cardType?: CardType;
}

const ADMIN_REALMS: Prisma.RealmWhereInput = { OR: [{ isSystem: true }, { id: DEFAULT_REALM_ID }] };

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

/**
 * The queue as of one moment, `asOf`: cards imported later are left out of the page and the total alike. A filter
 * review sends `asOf` and the total back, so approve all acts on exactly the cards the admin was shown.
 */
export async function listReviewQueue(
  db: PrismaClient,
  input: QueueFilter & { cursor?: string; limit: number }
) {
  const asOf = new Date();
  const where: Prisma.CardWhereInput = { ...queueWhere(input), createdAt: { lte: asOf } };
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
  return { cards, total, nextCursor, asOf };
}

export interface ReviewInput {
  decision: "APPROVE" | "REJECT";
  cardIds?: string[];
  filter?: QueueFilter;
  /** With a filter: when the admin's queue was read (`listReviewQueue`'s `asOf`), and the total it showed. */
  asOf?: Date;
  expected?: number;
  note?: string;
}

interface ReviewChoice {
  where: Prisma.CardWhereInput;
  /** A filter review's count as the admin saw it; chosen cards have none. */
  expected?: number;
  /** What the audit row says the filter was. */
  scope: string;
}

/** The filter as the audit row names it ("matching realm eurth, type NS"). */
function filterScope(filter: QueueFilter): string {
  const parts = [
    `realm ${filter.realm}`,
    filter.source ? `source ${filter.source}` : null,
    filter.cardType ? `type ${filter.cardType}` : null,
  ];
  return ` matching ${parts.filter(Boolean).join(", ")}`;
}

/**
 * The cards a review acts on. Chosen cards: pending ones, and for an approval also rejected ones (a rejection can be
 * undone). A filter acts on the queue exactly as the admin saw it: pending cards imported by `asOf`, at most
 * MAX_FILTER_REVIEW of them.
 */
function reviewChoice(input: ReviewInput, approve: boolean): ReviewChoice {
  if (input.cardIds?.length) {
    return {
      where: {
        id: { in: input.cardIds },
        reviewState: approve ? { in: ["PENDING", "REJECTED"] } : "PENDING",
      },
      scope: "",
    };
  }
  if (!input.filter) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Choose at least one card" });
  }
  if (!input.asOf || input.expected === undefined) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Reload the queue and try again." });
  }
  assertBulkRead(
    { asOf: input.asOf, expected: input.expected },
    { list: "The queue's", verb: "Review" }
  );
  return {
    where: { ...queueWhere(input.filter), createdAt: { lte: input.asOf } },
    expected: input.expected,
    scope: filterScope(input.filter),
  };
}

/** Refuses a filter review whose cards changed since the admin's queue was read. */
async function assertQueueUnchanged(tx: Prisma.TransactionClient, choice: ReviewChoice) {
  const seen = choice.expected;
  if (seen === undefined) return;
  await assertBulkRecountTx(tx, choice.where, seen, (matching) =>
    matching > seen
      ? "New cards arrived since you loaded the queue. Reload and try again."
      : "Some cards were reviewed since you loaded the queue. Reload and try again."
  );
}

export async function reviewCards(
  db: PrismaClient,
  actor: CardAdminActor,
  input: ReviewInput
): Promise<{ updated: number; skippedRestricted: number }> {
  const approve = input.decision === "APPROVE";
  const choice = reviewChoice(input, approve);
  return db.$transaction(async (tx) => {
    await assertQueueUnchanged(tx, choice);
    const skippedRestricted = approve
      ? await tx.card.count({ where: { ...choice.where, ...RESTRICTED_ART } })
      : 0;
    const result = await tx.card.updateMany({
      where: approve ? { ...choice.where, ...EXCLUDE_RESTRICTED_ART } : choice.where,
      data: {
        reviewState: approve ? "APPROVED" : "REJECTED",
        reviewedAt: new Date(),
        reviewedBy: actor.dbId,
      },
    });
    await recordCardAudit(tx, {
      action: "CARD_REVIEW",
      actor: actor.clerkId,
      target: input.cardIds?.length === 1 ? input.cardIds[0] : null,
      details: `${approve ? "Approved" : "Rejected"} ${cardCount(result.count)}${choice.scope}${input.note ? `: ${input.note}` : ""}`,
    });
    return { updated: result.count, skippedRestricted };
  });
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
  await db.$transaction(async (tx) => {
    // The card exists now, so the suggestion is made, even over a decline that landed while it was being made.
    await tx.loreCardRequest.update({
      where: { id: requestId },
      data: {
        status: "GENERATED",
        cardId,
        rejectionReason: null,
        reviewedAt: now,
        reviewedBy: actor.dbId,
        generatedAt: now,
      },
    });
    await recordCardAudit(tx, {
      action: "CARD_SUGGESTION",
      actor: actor.clerkId,
      target: cardId,
      details: `Made the suggestion "${request.articleTitle}" into a card`,
    });
  });
  return { cardId };
}

export async function declineSuggestion(
  db: PrismaClient,
  actor: CardAdminActor,
  input: { requestId: string; reason: string }
): Promise<void> {
  await db.$transaction(async (tx) => {
    const declined = await tx.loreCardRequest.updateMany({
      where: { id: input.requestId, status: "PENDING" },
      data: {
        status: "REJECTED",
        rejectionReason: input.reason,
        reviewedAt: new Date(),
        reviewedBy: actor.dbId,
      },
    });
    if (declined.count !== 1) throw new TRPCError({ code: "CONFLICT", message: ANSWERED });
    await recordCardAudit(tx, {
      action: "CARD_SUGGESTION",
      actor: actor.clerkId,
      target: input.requestId,
      details: `Declined a suggestion: ${input.reason}`,
    });
  });
}
