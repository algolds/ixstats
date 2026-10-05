/**
 * Collision-safe CardOwnership ids. The old `co_${Date.now()}_${userId}_${cardId}` shape
 * collided when one pack (or craft) granted the same card twice in the same millisecond.
 * Same shape as achievement grants (`card-service.ts`).
 */
export function newCardOwnershipId(): string {
  return `card_own_${Date.now()}_${crypto.randomUUID()}`;
}
