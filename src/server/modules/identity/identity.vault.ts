/**
 * Vault summary for a passport: collector level, credits, deck value, category focus and the
 * collection highlight (the holder's display: their pinned public showcase, else their most valuable live cards).
 * (Moved from routers/ixnayid/passport-vault.ts, now typed.)
 */
import { db } from "~/server/db";
import { getVaultConfig, VAULT_CONFIG_DEFAULTS } from "~/lib/vault/vault-perks";
import { BROWSABLE_CATEGORIES } from "~/lib/cards/category-enums";
import { deckValue } from "~/lib/cards/copy-value";
import type { CardFaceData } from "~/lib/cards/face/types";
import { displayedCopies } from "~/lib/cards/hub/displayed";
import { toCardFace } from "~/lib/cards/hub/faces";

/** Lore card categories a collection can span. */
const LORE_CATEGORY_COUNT = BROWSABLE_CATEGORIES.length;

/** How many cards the collection highlight shows. */
const COLLECTION_HIGHLIGHT_SIZE = 6;

export interface PassportVaultFocus {
  /** Distinct lore categories across the live collection (NationStates imports excluded). */
  categoryCount: number;
  /** Of `LORE_CATEGORY_COUNT`. */
  categoryTotal: number;
  /** The category holding the most cards, or null for an NS-only or empty collection. */
  topCategory: string | null;
}

export interface PassportVaultSummary {
  totalCards: number;
  deckValue: number;
  collectorLevel: number;
  /** Total XP; level = floor(collectorXp / xpPerLevel) + 1. */
  collectorXp: number;
  /** The vault's configured XP per collector level (`vault_xpPerLevel`). */
  xpPerLevel: number;
  credits: number;
  /** Collection breadth; null when the owner hides it. */
  focus: PassportVaultFocus | null;
  /**
   * Collection highlight: the holder's display (`displayedCopies`), their pinned public showcase, else their most
   * valuable live cards. A player's display is shown off, so the faces show their art.
   */
  topCards: CardFaceData[];
}

/** Category breadth of a collection. Pure. */
export function toVaultFocus(
  categories: ReadonlyArray<string | null | undefined>
): PassportVaultFocus {
  const counts = new Map<string, number>();
  for (const category of categories) {
    if (!category) continue;
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }
  let topCategory: string | null = null;
  let topCount = 0;
  for (const [category, count] of counts) {
    if (count > topCount) {
      topCategory = category;
      topCount = count;
    }
  }
  return { categoryCount: counts.size, categoryTotal: LORE_CATEGORY_COUNT, topCategory };
}

export async function resolvePassportVault(
  userId: string | null | undefined
): Promise<PassportVaultSummary> {
  const summary: PassportVaultSummary = {
    totalCards: 0,
    deckValue: 0,
    collectorLevel: 1,
    collectorXp: 0,
    xpPerLevel: VAULT_CONFIG_DEFAULTS.xpPerLevel,
    credits: 0,
    focus: toVaultFocus([]),
    topCards: [],
  };
  if (!userId) return summary;
  summary.xpPerLevel = (await getVaultConfig(db)).xpPerLevel;

  const live = { ownerId: userId, cards: { isRetired: false } };
  try {
    const [vault, liveOwnerships, displayed] = await Promise.all([
      db.myVault.findUnique({
        where: { userId },
        select: { credits: true, vaultLevel: true, vaultXp: true },
      }),
      db.cardOwnership.findMany({
        where: live,
        select: { cards: { select: { marketValue: true, category: true } } },
      }),
      displayedCopies(db, userId, COLLECTION_HIGHLIGHT_SIZE),
    ]);

    if (vault) {
      summary.credits = Math.floor(vault.credits);
      summary.collectorLevel = vault.vaultLevel;
      summary.collectorXp = vault.vaultXp;
    }
    summary.totalCards = liveOwnerships.length;
    summary.deckValue = deckValue(liveOwnerships);
    summary.focus = toVaultFocus(liveOwnerships.map((o) => o.cards.category));
    summary.topCards = displayed.copies.map(({ card, copy }) =>
      toCardFace(card, { revealArt: true, copy })
    );
  } catch (err) {
    console.warn("[PassportVault] Failed to resolve vault summary for user", userId, err);
  }
  return summary;
}
