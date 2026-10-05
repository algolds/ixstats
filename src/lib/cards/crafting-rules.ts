/**
 * Crafting rules shared by the crafting routers.
 */

/**
 * `Card.metadata` marker set on cards minted by crafting. Pack opening excludes crafted
 * cards (`pack-service.ts`), as it does SPECIAL achievement and event cards.
 */
export const CRAFTED_CARD_MARKER = { crafted: true } as const;

/**
 * A recipe's success chance as 0.0-1.0, the unit the schema documents. Older rows and the
 * admin defaults stored a percentage (e.g. 95), so any value above 1 is read as a percent.
 */
export function normalizeSuccessRate(rate: number | null | undefined): number {
  if (typeof rate !== "number" || !Number.isFinite(rate)) return 0;
  const fraction = rate > 1 ? rate / 100 : rate;
  return Math.min(1, Math.max(0, fraction));
}

/** One material requirement of a criteria recipe (`CraftingRecipe.requiredCardIds` entries). */
export interface MaterialCriterion {
  cardId?: string;
  rarity?: string;
  type?: string;
  quantity?: number;
}

interface MaterialCard {
  cardId: string;
  cards: { rarity: string; cardType: string };
}

function matchesCriterion(material: MaterialCard, criterion: MaterialCriterion): boolean {
  if (criterion.cardId && material.cardId !== criterion.cardId) return false;
  if (criterion.rarity && material.cards.rarity !== criterion.rarity) return false;
  if (criterion.type && material.cards.cardType !== criterion.type) return false;
  return true;
}

function describeCriterion(criterion: MaterialCriterion): string {
  const parts = [criterion.rarity, criterion.type, criterion.cardId && `card ${criterion.cardId}`];
  return parts.filter(Boolean).join(" ") || "any";
}

/**
 * Checks the chosen materials satisfy every criterion exactly: each criterion claims
 * `quantity` (default 1) matching cards, no card counts twice, and no card is left over
 * (a stray card would otherwise be consumed for nothing). Returns an error message, or
 * null when the materials fit.
 */
export function validateMaterialCriteria(
  materials: MaterialCard[],
  criteria: MaterialCriterion[]
): string | null {
  const specificity = (c: MaterialCriterion) =>
    (c.cardId ? 4 : 0) + (c.rarity ? 2 : 0) + (c.type ? 1 : 0);
  // Fill the narrowest requirements first so a broad one can't take the only card that fits
  const ordered = [...criteria].sort((a, b) => specificity(b) - specificity(a));
  const unused = [...materials];

  for (const criterion of ordered) {
    const needed = Math.max(1, Math.floor(criterion.quantity ?? 1));
    for (let i = 0; i < needed; i++) {
      const idx = unused.findIndex((m) => matchesCriterion(m, criterion));
      if (idx === -1) {
        return `Need ${needed} ${describeCriterion(criterion)} card(s) for this recipe`;
      }
      unused.splice(idx, 1);
    }
  }

  if (unused.length > 0) {
    return `This recipe takes ${materials.length - unused.length} material(s); remove the extra cards`;
  }
  return null;
}
