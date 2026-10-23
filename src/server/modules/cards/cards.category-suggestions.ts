/**
 * "Suggest a category": a signed-in player proposes a lore card's category from the card sheet, up to 10 in any 24
 * hours and one open suggestion per card. It waits in the admin's category review queue; nothing changes until staff
 * take it there (through `setCardCategoryTx`).
 *
 * The per-player lock (7340) is taken alone, outside the money and copy lock order.
 */
import type { PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { CategoryChoiceSchema, isSubcategoryOf } from "~/lib/cards/category-taxonomy";

export const CATEGORY_SUGGESTIONS_PER_DAY = 10;
/** Arbitrary constant; identifies the per-player category suggestion locks in pg_locks. */
export const CATEGORY_SUGGESTION_LOCK_NAMESPACE = 7340;
const DAY_MS = 24 * 60 * 60 * 1000;

export const SuggestCategoryInputSchema = z.object({
  cardId: z.string().min(1).max(64),
  choice: CategoryChoiceSchema,
  note: z.string().trim().max(500).nullable(),
});
export type SuggestCategoryInput = z.infer<typeof SuggestCategoryInputSchema>;

const refuse = (message: string) => new TRPCError({ code: "BAD_REQUEST", message });

/** The choice as it will be stored; the module may be called unparsed, so it checks what the schema would. */
function suggestedChoice({ choice }: SuggestCategoryInput) {
  const { category, subcategory } = choice;
  if (category === null) throw refuse("Pick a category");
  if (!isSubcategoryOf(category, subcategory)) {
    throw refuse("That subcategory is not in that category");
  }
  return { category, subcategory };
}

export async function suggestCategory(
  db: PrismaClient,
  userId: string,
  input: SuggestCategoryInput,
  now = new Date()
): Promise<{ status: "sent" | "already" }> {
  const choice = suggestedChoice(input);
  const card = await db.card.findUnique({
    where: { id: input.cardId },
    select: { cardType: true, isRetired: true, category: true, subcategory: true },
  });
  if (!card || card.cardType !== "LORE" || card.isRetired) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Card not found" });
  }
  if (card.category === choice.category && card.subcategory === choice.subcategory) {
    throw refuse("That is already its category");
  }
  const note = input.note?.trim() || null;

  // The player's lock holds their open check, count and insert together, so parallel requests pass neither rule.
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${CATEGORY_SUGGESTION_LOCK_NAMESPACE}::int, hashtext(${userId}))`;
    const open = await tx.cardCategorySuggestion.findFirst({
      where: { cardId: input.cardId, userId, status: "PENDING" },
      select: { id: true },
    });
    if (open) return { status: "already" as const };
    const recent = await tx.cardCategorySuggestion.count({
      where: { userId, createdAt: { gte: new Date(now.getTime() - DAY_MS) } },
    });
    if (recent >= CATEGORY_SUGGESTIONS_PER_DAY) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: `You can suggest ${CATEGORY_SUGGESTIONS_PER_DAY} categories a day. Try again tomorrow.`,
      });
    }
    await tx.cardCategorySuggestion.create({
      data: { cardId: input.cardId, userId, ...choice, note },
    });
    return { status: "sent" as const };
  });
}
