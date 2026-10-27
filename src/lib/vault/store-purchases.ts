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
 * The store item a SPEND_COSMETIC / SPEND_BOOST transaction bought. Metadata is stored as a
 * JSON string or an object; rows without an `itemId` yield null.
 */
export function purchasedItemId(metadata: unknown): string | null {
  const itemId = metadataObject(metadata).itemId;
  return typeof itemId === "string" && itemId ? itemId : null;
}

function metadataObject(metadata: unknown): Record<string, unknown> {
  let meta = metadata;
  if (typeof meta === "string") {
    try {
      meta = JSON.parse(meta);
    } catch {
      return {};
    }
  }
  return meta && typeof meta === "object" ? (meta as Record<string, unknown>) : {};
}

/**
 * Whether an admin revoked this purchase. The row stays in the ledger (its amount and
 * balanceAfter are history); its metadata gains `revokedAt`, and it no longer grants the item.
 */
export function isRevokedPurchase(metadata: unknown): boolean {
  return typeof metadataObject(metadata).revokedAt === "string";
}

/** The purchase's metadata marked revoked (stored as a JSON string, like ledger metadata). */
export function revokedPurchaseMetadata(metadata: unknown, revokedByUserId: string | null): string {
  return JSON.stringify({
    ...metadataObject(metadata),
    revokedAt: new Date().toISOString(),
    revokedByUserId,
  });
}

/**
 * Count store purchases per item from SPEND_COSMETIC / SPEND_BOOST transaction metadata.
 * Revoked purchases grant nothing and are not counted.
 */
export function countStorePurchases(rows: { metadata: unknown }[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    if (isRevokedPurchase(row.metadata)) continue;
    const itemId = purchasedItemId(row.metadata);
    if (itemId) counts[itemId] = (counts[itemId] ?? 0) + 1;
  }
  return counts;
}
