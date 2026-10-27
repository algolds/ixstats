/**
 * Realm region pages (docs/specs/2026-10-05-realm-regions-design.md): directory tags and officer powers.
 * Client-safe.
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
export const REALM_POWERS = ["appearance", "board", "diplomacy", "claims", "map"] as const;

export type RealmPower = (typeof REALM_POWERS)[number];

export const REALM_POWER_LABELS: Record<RealmPower, string> = {
  appearance: "Factbook, header, rules and links",
  board: "Forum moderation",
  diplomacy: "Embassies and polls",
  claims: "Claims",
  map: "Map",
};

/** What each power lets an officer do, shown beside its checkbox in the Officers section. */
export const REALM_POWER_DESCRIPTIONS: Record<RealmPower, string> = {
  appearance: "Edit the factbook, banner, description and tags",
  board: "Moderate the realm's forum section: hide, lock, warn and ban",
  diplomacy: "Propose and answer embassies, and run the realm poll",
  claims: "Review players' claims on the realm's nations",
  map: "Edit the realm's map, borders and labels, and import maps",
};

/** The officer title a previous founder keeps when the realm is handed over and they stay on as an officer. */
export const FORMER_FOUNDER_TITLE = "Former founder";

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
 * Images the site serves itself, stored without the base path: an upload through `/api/upload/image` (type, 5MB
 * limit and SVG sanitizing checked there; served from `UPLOADS_URL_PREFIX`, `src/server/shared/upload-storage.ts`,
 * under a generated `uploaded_…` name), an outside image the repository picker copied in
 * (`/api/download/external-image`, `downloaded_…`), or a wiki file through the image-only MediaWiki media proxy.
 */
const SITE_IMAGES = [
  /^\/images\/(?:uploads\/uploaded|downloaded\/downloaded)_[A-Za-z0-9_.-]+$/,
  /^\/api\/mediawiki\/[a-z]+\/[^\s\\?#]+$/,
];

/**
 * A realm banner, thumbnail or emblem: an `https://` image address, or an image the site serves (an upload or an
 * image picked from the repository). Empty means "none".
 */
export function isRealmImageUrl(url: string): boolean {
  const value = url.trim();
  if (value === "") return true;
  if (SITE_IMAGES.some((pattern) => pattern.test(value))) return !value.includes("..");
  return /^https:\/\/[^\s]+$/i.test(value);
}

/** "12 nations · 4 open to claim", "1 nation"; null for a realm with no nations. */
export function realmCountsLine(nationCount: number, openCount: number): string | null {
  if (nationCount < 1) return null;
  const nations = `${nationCount} ${nationCount === 1 ? "nation" : "nations"}`;
  return openCount > 0 ? `${nations} · ${openCount} open to claim` : nations;
}
