/**
 * The admin's category review queue: the classifier's low-confidence guesses (and cards it could not place), and
 * players' pending category suggestions. Every answer that changes a card goes through `setCardCategoryTx`.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import type { CategoryChoice } from "~/lib/cards/category-taxonomy";
import type { CardAdminActor } from "~/server/shared/admin-actor";
import { recordCardAudit } from "./cards.audit";
import { setCardCategoryTx } from "./cards.categories";

interface Page {
  offset: number;
  limit: number;
}

const WAITING_CLASSIFICATIONS = {
  cardType: "LORE",
  categoryNeedsReview: true,
  categorySource: "CLASSIFIER",
} satisfies Prisma.CardWhereInput;

/** Lore cards the classifier placed with low confidence or not at all, least confident first. */
export async function listCategoryClassifications(db: PrismaClient, page: Page) {
  const [rows, total] = await Promise.all([
    db.card.findMany({
      where: WAITING_CLASSIFICATIONS,
      orderBy: [{ categoryConfidence: { sort: "asc", nulls: "first" } }, { id: "asc" }],
      skip: page.offset,
      take: page.limit,
      select: {
        id: true,
        title: true,
        wikiSource: true,
        wikiArticleTitle: true,
        category: true,
        subcategory: true,
        categoryConfidence: true,
        realm: { select: { name: true } },
      },
    }),
    db.card.count({ where: WAITING_CLASSIFICATIONS }),
  ]);
  return { rows, total };
}

/** Players' suggestions waiting for an answer, oldest first. */
export async function listCategorySuggestions(db: PrismaClient, page: Page) {
  const where = { status: "PENDING" } satisfies Prisma.CardCategorySuggestionWhereInput;
  const [rows, total] = await Promise.all([
    db.cardCategorySuggestion.findMany({
      where,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      skip: page.offset,
      take: page.limit,
      select: {
        id: true,
        userId: true,
        category: true,
        subcategory: true,
        note: true,
        createdAt: true,
        card: {
          select: {
            id: true,
            title: true,
            category: true,
            subcategory: true,
            realm: { select: { name: true } },
          },
        },
      },
    }),
    db.cardCategorySuggestion.count({ where }),
  ]);
  return { rows, total };
}

export interface AnswerSuggestionInput {
  suggestionId: string;
  decision: "ACCEPT" | "CHANGE" | "REJECT";
  /** The admin's own choice, for CHANGE. */
  choice?: CategoryChoice;
}

const ANSWERED = "This suggestion was already answered";

async function pendingSuggestion(tx: Prisma.TransactionClient, suggestionId: string) {
  const suggestion = await tx.cardCategorySuggestion.findUnique({
    where: { id: suggestionId },
    select: {
      id: true,
      cardId: true,
      status: true,
      category: true,
      subcategory: true,
      card: { select: { title: true } },
    },
  });
  if (!suggestion) throw new TRPCError({ code: "NOT_FOUND", message: "Suggestion not found" });
  if (suggestion.status !== "PENDING") throw new TRPCError({ code: "CONFLICT", message: ANSWERED });
  return suggestion;
}

/**
 * Locks the still-pending row for this transaction, so of two admins answering at once the second finds it answered.
 * `setCardCategoryTx` skips a suggestion that is no longer pending without a word, so this is where that is said.
 */
async function claimPending(
  tx: Prisma.TransactionClient,
  suggestionId: string,
  data: Prisma.CardCategorySuggestionUpdateManyMutationInput
): Promise<void> {
  const claimed = await tx.cardCategorySuggestion.updateMany({
    where: { id: suggestionId, status: "PENDING" },
    data,
  });
  if (claimed.count !== 1) throw new TRPCError({ code: "CONFLICT", message: ANSWERED });
}

type PendingSuggestion = Awaited<ReturnType<typeof pendingSuggestion>>;

/** What an accept or a change writes: the player's proposal, or the admin's own choice. */
function writtenChoice(
  input: AnswerSuggestionInput,
  suggestion: PendingSuggestion
): CategoryChoice {
  if (input.decision === "ACCEPT") {
    return { category: suggestion.category, subcategory: suggestion.subcategory };
  }
  if (!input.choice) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Choose the category to change it to" });
  }
  return input.choice;
}

/**
 * Accept writes the player's proposal (source SUGGESTION), change writes the admin's choice (source ADMIN), reject
 * closes the suggestion and leaves the card as it is.
 */
export async function answerCategorySuggestion(
  db: PrismaClient,
  actor: CardAdminActor,
  input: AnswerSuggestionInput
): Promise<void> {
  await db.$transaction(async (tx) => {
    const suggestion = await pendingSuggestion(tx, input.suggestionId);
    if (input.decision === "REJECT") {
      await claimPending(tx, suggestion.id, {
        status: "REJECTED",
        reviewedBy: actor.dbId,
        reviewedAt: new Date(),
      });
      await recordCardAudit(tx, {
        action: "CARD_SUGGESTION",
        actor: actor.clerkId,
        target: suggestion.cardId,
        details: `Turned down a category suggestion for ${suggestion.card.title}`,
      });
      return;
    }
    const choice = writtenChoice(input, suggestion);
    // A no-op write: it only takes the row lock, and `setCardCategoryTx` closes the suggestion
    await claimPending(tx, suggestion.id, { status: "PENDING" });
    const accept = input.decision === "ACCEPT";
    await setCardCategoryTx(tx, {
      cardId: suggestion.cardId,
      choice,
      source: accept ? "SUGGESTION" : "ADMIN",
      editor: actor,
      answering: { suggestionId: suggestion.id, status: accept ? "ACCEPTED" : "CHANGED" },
    });
  });
}
