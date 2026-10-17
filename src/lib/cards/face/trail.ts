// src/lib/cards/face/trail.ts
import type { MintSource } from "~/lib/cards/mint";

/** One move in a copy's ownership trail, with handles (never internal ids). */
export interface TrailEvent {
  id: string;
  action: string;
  fromHandle: string | null;
  toHandle: string | null;
  price: number | null;
  at: Date;
}

/**
 * Every action a live copy's trail can hold: its mint source (`MINT_SOURCES`), a reissue, or a move. GIFT is kept for
 * older rows. REVOKE and VOID never show: their rows lose the copy when it goes.
 */
type TrailAction =
  MintSource | "REISSUE" | "TRADE" | "GIFT" | "AUCTION_BUYOUT" | "AUCTION_END" | "REASSIGN";

const TRAIL_LABEL: Readonly<Record<TrailAction, string>> = {
  PACK_OPEN: "Pulled from a pack",
  DAILY_CLAIM: "Daily reward",
  NS_DECK_IMPORT: "Imported from NationStates",
  ACHIEVEMENT: "Achievement reward",
  TROPHY: "Loreward trophy",
  SPORTS: "Sports trophy",
  ADMIN: "Granted by staff",
  REISSUE: "Granted again",
  TRADE: "Traded",
  GIFT: "Gifted",
  AUCTION_BUYOUT: "Bought at auction",
  AUCTION_END: "Won at auction",
  REASSIGN: "Reassigned by staff",
};

const isTrailAction = (action: string): action is TrailAction => Object.hasOwn(TRAIL_LABEL, action);

/** A move's name; actions added later read "Moved" until they get one. */
export function trailLabel(action: string): string {
  return isTrailAction(action) ? TRAIL_LABEL[action] : "Moved";
}

/** "@a to @b", "to @b", "from @a", or null when neither side is a player. */
export function trailParties(event: Pick<TrailEvent, "fromHandle" | "toHandle">): string | null {
  const from = event.fromHandle ? `@${event.fromHandle}` : null;
  const to = event.toHandle ? `@${event.toHandle}` : null;
  if (from && to) return `${from} to ${to}`;
  if (to) return `to ${to}`;
  return from ? `from ${from}` : null;
}
