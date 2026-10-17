/**
 * Free article suggestions: anyone signed in may suggest a wiki article that has no card, up to 3 in any 24 hours.
 * A suggestion waits in the cards admin's Curation tab. Nothing is charged.
 */
import type { PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import {
  canonicalCardTitle,
  isArticleTitle,
  type CardArticleSource,
} from "~/lib/cards/card-sources";
import { cardedTitleKeys, resolveImportRealm } from "./cards.importer";

export const SUGGESTIONS_PER_DAY = 3;
const DAY_MS = 24 * 60 * 60 * 1000;
/** Arbitrary constant; identifies the per-player suggestion locks in pg_locks. */
const SUGGESTION_LOCK_NAMESPACE = 7333;

const articles = (count: number) => `${count} ${count === 1 ? "article" : "articles"}`;

/** The title as cards store it, refusing what the importer would never make a card of. */
function suggestedTitle(source: CardArticleSource, raw: string): string {
  const title = canonicalCardTitle(source, raw);
  if (!title) throw new TRPCError({ code: "BAD_REQUEST", message: "That is not a page title" });
  if (!isArticleTitle(source, title)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Only wiki articles become lore cards" });
  }
  return title;
}

export async function suggestCard(
  db: PrismaClient,
  userId: string,
  input: { source: CardArticleSource; title: string },
  now = new Date()
): Promise<{ id: string }> {
  const title = suggestedTitle(input.source, input.title);
  if ((await cardedTitleKeys(db, input.source, [title])).size > 0) {
    throw new TRPCError({ code: "CONFLICT", message: "This article already has a card" });
  }
  const home = await resolveImportRealm(db, input.source, title);
  if (home.nationPage) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "A realm's nation page does not become a lore card",
    });
  }

  // The player's lock holds their count and insert together, so parallel requests cannot pass the daily cap.
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${SUGGESTION_LOCK_NAMESPACE}::int, hashtext(${userId}))`;
    const recent = await tx.loreCardRequest.count({
      where: { userId, requestedAt: { gte: new Date(now.getTime() - DAY_MS) } },
    });
    if (recent >= SUGGESTIONS_PER_DAY) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: `You can suggest ${articles(SUGGESTIONS_PER_DAY)} a day. Try again tomorrow.`,
      });
    }
    const open = await tx.loreCardRequest.findFirst({
      where: {
        wikiSource: input.source,
        articleTitle: { equals: title, mode: "insensitive" },
        status: "PENDING",
      },
      select: { id: true },
    });
    if (open) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "Someone has already suggested this article",
      });
    }
    const created = await tx.loreCardRequest.create({
      data: {
        userId,
        wikiSource: input.source,
        articleTitle: title,
        realmId: home.realmId,
        status: "PENDING",
      },
    });
    return { id: created.id };
  });
}

export function mySuggestions(db: PrismaClient, userId: string) {
  return db.loreCardRequest.findMany({
    where: { userId },
    orderBy: { requestedAt: "desc" },
    take: 20,
    select: {
      id: true,
      articleTitle: true,
      wikiSource: true,
      status: true,
      requestedAt: true,
      rejectionReason: true,
    },
  });
}
