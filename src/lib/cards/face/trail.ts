// src/lib/cards/face/trail.ts
import type { MintSource } from "~/lib/cards/mint";

/**
 * A player on one side of a move: their name as the server gives it ("@handle", or their nation), or null ("a player")
 * while their Passport hides Vault cards or they have neither.
 */
export interface TrailParty {
  name: string | null;
}

/**
 * One move in a copy's ownership trail, by name (never internal ids). A side with no player (a mint's sender, a copy
 * leaving every player) is null.
 */
export interface TrailEvent {
  id: string;
  action: string;
  from: TrailParty | null;
  to: TrailParty | null;
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

const partyName = (party: TrailParty | null) => (party ? (party.name ?? "a player") : null);

/** "@a to @b", "to @b", "from @a" (a player with no name is "a player"), or null when neither side is a player. */
export function trailParties(event: Pick<TrailEvent, "from" | "to">): string | null {
  const from = partyName(event.from);
  const to = partyName(event.to);
  if (from && to) return `${from} to ${to}`;
  if (to) return `to ${to}`;
  return from ? `from ${from}` : null;
}
