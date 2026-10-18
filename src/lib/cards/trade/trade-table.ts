/**
 * The two-column trade table (client-safe, spec §2.3 Trade builder): cards and credits on each side, validation, gifts,
 * the viewer's You give / You get, and the cross-realm rule (spec §2.2).
 */

export const MAX_TRADE_CARDS_PER_SIDE = 20;
export const MAX_TRADE_CREDITS = 1_000_000;

export interface TradeTable {
  initiatorCardIds: string[];
  recipientCardIds: string[];
  initiatorCredits: number;
  recipientCredits: number;
}

export type TradeRole = "initiator" | "recipient";

export interface TradeSide {
  cardIds: string[];
  credits: number;
}

const validCredits = (n: number) => Number.isInteger(n) && n >= 0 && n <= MAX_TRADE_CREDITS;

/** Why the table can't be offered, or null. Credits alone never move: a trade holds at least one card. */
export function validateTradeTable(t: TradeTable): string | null {
  const all = [...t.initiatorCardIds, ...t.recipientCardIds];
  if (all.length === 0) return "Add at least one card. Credits alone can't be traded.";
  if (
    t.initiatorCardIds.length > MAX_TRADE_CARDS_PER_SIDE ||
    t.recipientCardIds.length > MAX_TRADE_CARDS_PER_SIDE
  ) {
    return `Each side holds at most ${MAX_TRADE_CARDS_PER_SIDE} cards.`;
  }
  if (new Set(all).size !== all.length) return "A card can only be in the trade once.";
  if (!validCredits(t.initiatorCredits) || !validCredits(t.recipientCredits)) {
    return "Credits must be a whole number from 0 to 1,000,000.";
  }
  return null;
}

const gives = (side: TradeSide) => side.cardIds.length > 0 || side.credits > 0;

/** One side gives nothing at all. */
export function isGift(t: TradeTable): boolean {
  const { give, get } = sidesFor(t, "initiator");
  return gives(give) !== gives(get);
}

export function sidesFor(t: TradeTable, viewer: TradeRole): { give: TradeSide; get: TradeSide } {
  const initiator = { cardIds: t.initiatorCardIds, credits: t.initiatorCredits };
  const recipient = { cardIds: t.recipientCardIds, credits: t.recipientCredits };
  return viewer === "initiator"
    ? { give: initiator, get: recipient }
    : { give: recipient, get: initiator };
}

export function tableFrom(viewer: TradeRole, give: TradeSide, get: TradeSide): TradeTable {
  const [initiator, recipient] = viewer === "initiator" ? [give, get] : [get, give];
  return {
    initiatorCardIds: initiator.cardIds,
    recipientCardIds: recipient.cardIds,
    initiatorCredits: initiator.credits,
    recipientCredits: recipient.credits,
  };
}

/** Each side gives a card, and a home realm on one side is missing from the other. */
export function isCrossRealmTrade(aRealms: string[], bRealms: string[]): boolean {
  if (aRealms.length === 0 || bRealms.length === 0) return false;
  const a = new Set(aRealms);
  const b = new Set(bRealms);
  return aRealms.some((r) => !b.has(r)) || bRealms.some((r) => !a.has(r));
}

function describeSide(side: TradeSide): string {
  const n = side.cardIds.length;
  const parts = [
    n > 0 ? `${n} card${n === 1 ? "" : "s"}` : "",
    side.credits > 0 ? `${side.credits.toLocaleString("en-US")} IxC` : "",
  ];
  return parts.filter(Boolean).join(" and ");
}

/** "2 cards and 500 IxC for 1 card", from the proposer's side. */
export function describeOffer(t: TradeTable, proposer: TradeRole): string {
  const { give, get } = sidesFor(t, proposer);
  const given = describeSide(give);
  const asked = describeSide(get);
  if (!asked) return `${given} as a gift`;
  if (!given) return `a request for ${asked} as a gift`;
  return `${given} for ${asked}`;
}
