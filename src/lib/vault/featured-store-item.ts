import { isRepeatableStoreItem, storePrerequisiteMet } from "./store-purchases";

interface FeaturableItem {
  id: string;
  price: number;
  quality: string;
  category: string;
}

const QUALITY_RANK: Record<string, number> = { LEGENDARY: 3, EPIC: 2, RARE: 1 };

const rank = (quality: string) => QUALITY_RANK[quality.toUpperCase()] ?? 0;

/**
 * The one store item the Wallet shows: among what the player can still buy (cosmetics once,
 * stackable upgrades whose prerequisite is met), the highest quality, then the cheapest.
 */
export function pickFeaturedStoreItem<T extends FeaturableItem>(
  items: readonly T[],
  purchaseCounts: Record<string, number>
): T | null {
  const available = items.filter(
    (item) =>
      storePrerequisiteMet(item.id, purchaseCounts) &&
      (isRepeatableStoreItem(item.category) || !purchaseCounts[item.id])
  );
  let best: T | null = null;
  for (const item of available) {
    if (!best || rank(item.quality) > rank(best.quality)) best = item;
    else if (rank(item.quality) === rank(best.quality) && item.price < best.price) best = item;
  }
  return best;
}
