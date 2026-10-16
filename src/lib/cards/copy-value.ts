/**
 * What one copy is worth: the one per-copy value function the dividend, the wallet, the Passport and the
 * achievements share (cards refresh §3, "Data"). Phase 1: the card's value. Phase 4 adds the finish, the level and
 * the market median here, and only here.
 */
export function copyValue(copy: { cards: { marketValue: number } }): number {
  return copy.cards.marketValue;
}

/** A set of copies' value. */
export function deckValue(copies: ReadonlyArray<{ cards: { marketValue: number } }>): number {
  return copies.reduce((sum, copy) => sum + copyValue(copy), 0);
}

/** `copyValue` as SQL over `"CardOwnership" o JOIN cards c`, for sums done in the database. */
export const COPY_VALUE_SQL = 'c."marketValue"';
