/**
 * Vault store purchase rules shared by the store router (server) and the store UI.
 *
 * Client-safe: no Prisma or server imports. The server is the authority — the UI
 * uses these only to decide what to show.
 */

/** Store items that can only be bought after owning N of another item. */
const STORE_ITEM_PREREQUISITES: Record<string, { itemId: string; count: number }> = {
  upgrade_card_capacity_mega: { itemId: "upgrade_card_capacity", count: 5 },
};

/** Upgrades stack (each purchase adds its effect again); cosmetics are owned once. */
export function isRepeatableStoreItem(category: string): boolean {
  return category === "upgrades";
}

/** Whether the prerequisite for `itemId`, if any, is met by `purchaseCounts`. */
export function storePrerequisiteMet(
  itemId: string,
  purchaseCounts: Record<string, number> | undefined
): boolean {
  const prerequisite = STORE_ITEM_PREREQUISITES[itemId];
  if (!prerequisite) return true;
  return (purchaseCounts?.[prerequisite.itemId] ?? 0) >= prerequisite.count;
}

/**
 * Count store purchases per item from SPEND_COSMETIC / SPEND_BOOST transaction
 * metadata. Metadata is stored as a JSON string or an object; rows without an
 * `itemId` are ignored.
 */
export function countStorePurchases(rows: { metadata: unknown }[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    let meta = row.metadata;
    if (typeof meta === "string") {
      try {
        meta = JSON.parse(meta);
      } catch {
        continue;
      }
    }
    const itemId =
      meta && typeof meta === "object" ? (meta as Record<string, unknown>).itemId : undefined;
    if (typeof itemId === "string" && itemId) {
      counts[itemId] = (counts[itemId] ?? 0) + 1;
    }
  }
  return counts;
}
