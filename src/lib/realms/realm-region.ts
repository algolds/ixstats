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
 * What an officer may be given. The founder (and site admins) hold all of them, and alone appoint officers and
 * hand the realm over.
 */
export const REALM_POWERS = ["appearance", "board", "diplomacy", "claims"] as const;

export type RealmPower = (typeof REALM_POWERS)[number];

export const REALM_POWER_LABELS: Record<RealmPower, string> = {
  appearance: "Factbook, header, rules and links",
  board: "Board moderation",
  diplomacy: "Embassies and polls",
  claims: "Claims",
};

/** What each power lets an officer do, shown beside its checkbox in the Officers section. */
export const REALM_POWER_DESCRIPTIONS: Record<RealmPower, string> = {
  appearance: "Edit the factbook, banner, description and tags",
  board: "Mute or ban nations on the realm's board",
  diplomacy: "Propose and answer embassies, and run the realm poll",
  claims: "Review players' claims on the realm's nations",
};

/** The officer title a previous founder keeps when the realm is handed over and they stay on as an officer. */
export const FORMER_FOUNDER_TITLE = "Former founder";

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

/** What a realm's happenings are made of, each with the label its filter shows. */
export const HAPPENING_KINDS = ["nation", "claim", "embassy", "officer", "activity"] as const;

export type HappeningKind = (typeof HAPPENING_KINDS)[number];

export const HAPPENING_KIND_LABELS: Record<HappeningKind, string> = {
  nation: "New nations",
  claim: "Claims",
  embassy: "Embassies",
  officer: "Officers",
  activity: "Nation events",
};

/**
 * An image uploaded through `/api/upload/image` (which checks the type and the 5MB limit, and sanitizes SVG): it
 * is served from `UPLOADS_URL_PREFIX` (`src/server/shared/upload-storage.ts`) under a generated `uploaded_…` name.
 */
const UPLOADED_IMAGE = /^\/images\/uploads\/uploaded_[A-Za-z0-9_.-]+$/;

/**
 * A realm banner or thumbnail: an `https://` image address, or an image uploaded through the image upload route.
 * Empty means "none".
 */
export function isRealmImageUrl(url: string): boolean {
  const value = url.trim();
  if (value === "") return true;
  if (UPLOADED_IMAGE.test(value)) return !value.includes("..");
  return /^https:\/\/[^\s]+$/i.test(value);
}
