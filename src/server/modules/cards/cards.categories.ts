/**
 * The one write path for a person's category edit: an admin in the Library or the review queue, a realm owner on
 * their realm's cards, or a player's suggestion an admin took. It validates the subcategory, closes the card's open
 * suggestions and writes the audit row. The importer and the backfill write classifier output only.
 *
 * No advisory lock: a category edit moves no money and no copies.
 */
import type { CardCategorySuggestionStatus, Prisma, PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import {
  categoryLine,
  isSubcategoryOf,
  sameCategoryChoice,
  type CategoryChoice,
} from "~/lib/cards/category-taxonomy";
import { recordCardAudit } from "./cards.audit";

export type CategoryEditSource = "ADMIN" | "REALM_OWNER" | "SUGGESTION";

/** Who made the edit (`CardAdminActor` satisfies it). */
export interface CategoryEditor {
  dbId: string;
  clerkId: string;
}

export interface SetCategoryInput {
  cardId: string;
  choice: CategoryChoice;
  source: CategoryEditSource;
  editor: CategoryEditor;
  /** A realm owner's edit: the card must be homed in this realm. */
  realmId?: string;
  /** The suggestion this edit answers, and how. */
  answering?: { suggestionId: string; status: "ACCEPTED" | "CHANGED" };
}

const WHO: Record<CategoryEditSource, string> = {
  ADMIN: "admin",
  REALM_OWNER: "realm owner",
  SUGGESTION: "a player's suggestion",
};

async function editableCard(tx: Prisma.TransactionClient, input: SetCategoryInput) {
  const card = await tx.card.findUnique({
    where: { id: input.cardId },
    select: {
      id: true,
      title: true,
      cardType: true,
      realmId: true,
      category: true,
      subcategory: true,
    },
  });
  // Another realm's card reads as missing, so a realm owner learns nothing of it.
  if (!card || (input.realmId !== undefined && card.realmId !== input.realmId)) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Card not found" });
  }
  if (card.cardType !== "LORE") {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Only lore cards have a category" });
  }
  return card;
}

/**
 * Closes every open suggestion of the card: the answered one as asked, any other that proposed exactly this choice as
 * accepted, the rest as changed. Split in code, since SQL's NULL comparison would leave a null subcategory in neither.
 */
async function closeSuggestions(
  tx: Prisma.TransactionClient,
  input: SetCategoryInput,
  now: Date
): Promise<void> {
  const open = await tx.cardCategorySuggestion.findMany({
    where: { cardId: input.cardId, status: "PENDING" },
    select: { id: true, category: true, subcategory: true },
  });
  const answered = input.answering?.suggestionId;
  const others = open.filter((s) => s.id !== answered);
  const groups: Array<[CardCategorySuggestionStatus, string[]]> = [
    [input.answering?.status ?? "ACCEPTED", open.filter((s) => s.id === answered).map((s) => s.id)],
    ["ACCEPTED", others.filter((s) => sameCategoryChoice(s, input.choice)).map((s) => s.id)],
    ["CHANGED", others.filter((s) => !sameCategoryChoice(s, input.choice)).map((s) => s.id)],
  ];
  for (const [status, ids] of groups) {
    if (ids.length === 0) continue;
    await tx.cardCategorySuggestion.updateMany({
      where: { id: { in: ids }, status: "PENDING" },
      data: { status, reviewedBy: input.editor.dbId, reviewedAt: now },
    });
  }
}

/**
 * Writes the choice even when it is unchanged: a person confirming a guess protects it from the backfill.
 * `changed` says whether the category or subcategory differs from what the card had.
 */
export async function setCardCategoryTx(
  tx: Prisma.TransactionClient,
  input: SetCategoryInput,
  now = new Date()
): Promise<{ changed: boolean }> {
  const { choice } = input;
  if (!isSubcategoryOf(choice.category, choice.subcategory)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "That subcategory is not in that category",
    });
  }
  const card = await editableCard(tx, input);
  await tx.card.update({
    where: { id: card.id },
    data: {
      category: choice.category,
      subcategory: choice.subcategory,
      categorySource: input.source,
      categoryConfidence: null,
      categoryNeedsReview: false,
      categoryReviewedAt: now,
      categoryReviewedBy: input.editor.dbId,
    },
  });
  await closeSuggestions(tx, input, now);
  const from = categoryLine(card.category, card.subcategory);
  const to = categoryLine(choice.category, choice.subcategory);
  await recordCardAudit(tx, {
    action: "CARD_CATEGORY",
    actor: input.editor.clerkId,
    target: card.id,
    details: `${card.title}: ${from} → ${to} (${WHO[input.source]})`,
  });
  return { changed: !sameCategoryChoice(card, choice) };
}

export function setCardCategory(
  db: PrismaClient,
  input: SetCategoryInput
): Promise<{ changed: boolean }> {
  return db.$transaction((tx) => setCardCategoryTx(tx, input));
}
