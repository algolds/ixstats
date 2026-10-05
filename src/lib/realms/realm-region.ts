/**
 * Realm region pages (docs/specs/2026-10-05-realm-regions-design.md): directory tags, officer powers and board
 * restrictions. Client-safe.
 */

/** The fixed tag list founders choose from; the directory filters by them. */
export const REALM_TAGS = [
  "Roleplay",
  "Modern",
  "Historical",
  "Alternate history",
  "Fantasy",
  "Sci-fi",
  "Diplomacy",
  "Economy",
  "Military",
  "Lore-heavy",
  "Casual",
  "New players welcome",
] as const;

export type RealmTag = (typeof REALM_TAGS)[number];

export const MAX_REALM_TAGS = 5;

/**
 * What an officer may be given. The founder (and site admins) hold all of them, and alone review claims and
 * appoint officers.
 */
export const REALM_POWERS = ["appearance", "board", "diplomacy"] as const;

export type RealmPower = (typeof REALM_POWERS)[number];

export const REALM_POWER_LABELS: Record<RealmPower, string> = {
  appearance: "Factbook and header",
  board: "Board moderation",
  diplomacy: "Embassies and polls",
};

/** Board restrictions: a mute stops board posts; a ban takes the nation off the board (posts and chat). */
export const BOARD_RESTRICTIONS = ["mute", "ban"] as const;

export type BoardRestriction = (typeof BOARD_RESTRICTIONS)[number];

/** A board post flagged for embassies carries this pseudo-hashtag, naming the realm it was posted in. */
export const embassyPostTag = (realmId: string) => `embassy:${realmId}`;

/** One embassy per pair of realms, whichever proposed it. */
export const embassyPairKey = (a: string, b: string) => [a, b].sort().join(":");

/** `Realm.ownerId` of a realm no player founds yet: staff administer it. */
export const STAFF_FOUNDER_ID = "system";

export const MAX_OFFICERS = 12;
