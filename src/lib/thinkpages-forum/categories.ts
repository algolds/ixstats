/** The sitewide ThinkPages forum section (Concept B spec, "Structure at launch"). Seeded by the phase 1 migration. */
export type ForumVisibility = "public" | "staff" | "reporter_staff";

/** M8: public to all; reporter_staff to signed-in members (thread-level rule in access.ts); staff to site admins. */
export function visibleForumVisibilities(viewer: {
  signedIn: boolean;
  siteAdmin: boolean;
}): readonly ForumVisibility[] {
  if (viewer.siteAdmin) return ["public", "reporter_staff", "staff"];
  return viewer.signedIn ? ["public", "reporter_staff"] : ["public"];
}

/** The Prisma where fragment for the same rule, for callers outside the forum module (realms.forum-preview.ts). */
export function categoryVisibilityWhere(viewer: { signedIn: boolean; siteAdmin: boolean }): {
  visibility: { in: ForumVisibility[] };
} {
  return { visibility: { in: [...visibleForumVisibilities(viewer)] } };
}

export interface SiteCategorySeed {
  key: string;
  name: string;
  description: string;
  order: number;
  visibility: ForumVisibility;
  postRole: "any" | "staff";
  icAllowed: boolean;
}

export const SITE_CATEGORIES: readonly SiteCategorySeed[] = [
  { key: "rules", name: "Rules", description: "How the community works.", order: 10, visibility: "public", postRole: "staff", icAllowed: false },
  { key: "announcements", name: "Announcements", description: "News from the team.", order: 20, visibility: "public", postRole: "staff", icAllowed: false },
  { key: "reports", name: "Reports", description: "Report a problem to the team.", order: 30, visibility: "reporter_staff", postRole: "any", icAllowed: false },
  { key: "staff", name: "Staff", description: "Team discussion.", order: 40, visibility: "staff", postRole: "any", icAllowed: false },
  { key: "find-a-realm", name: "Find a Realm", description: "Advertise your realm or find one to join.", order: 50, visibility: "public", postRole: "any", icAllowed: false },
  { key: "general", name: "General", description: "Out-of-character talk about anything.", order: 60, visibility: "public", postRole: "any", icAllowed: false },
  { key: "side-games", name: "Side Games", description: "Play-by-post games and other things to play.", order: 70, visibility: "public", postRole: "any", icAllowed: true },
];

/** The three categories every realm section (and IxWorld's) has. Seeded by the phase 2 migration and on realm creation. */
export const REALM_HUB_KEY = "hub";

export interface RealmCategorySeed {
  key: string;
  name: string;
  description: string;
  order: number;
  icAllowed: boolean;
}

export const REALM_CATEGORIES: readonly RealmCategorySeed[] = [
  { key: "hub", name: "Hub", description: "Out-of-character talk for the realm.", order: 10, icAllowed: false },
  { key: "character-threads", name: "Character Threads", description: "In-character stories and correspondence.", order: 20, icAllowed: true },
  { key: "current-events", name: "Current Events", description: "In-character news from the realm's nations.", order: 30, icAllowed: true },
];

/**
 * The realm board: a hidden category (style "board") holding exactly one thread whose posts are the realm's live
 * message board. Seeded by `seedRealmCategories` and the realm-board migration. It is not one of the realm's listed
 * boards (`REALM_CATEGORIES`) and must never show in a forum list, count, stat, Trending, activity feed, passport or
 * search: every such read leaves it out with `isBoardCategory` or `notBoardCategory`.
 */
export const REALM_BOARD_KEY = "board";
export const BOARD_STYLE = "board";

/** Whether this is a realm's board category: style "board", or the realm key "board" (a category not yet restyled). */
export function isBoardCategory(category: { key: string; style?: string | null }): boolean {
  return category.style === BOARD_STYLE || category.key === REALM_BOARD_KEY;
}

/** The Prisma where fragment for "not a board category", for a `ForumCategory` where (or a relation filter onto one). */
export function notBoardCategory(): { style: { not: typeof BOARD_STYLE } } {
  return { style: { not: BOARD_STYLE } };
}

/** Imported threads from a XenForo forum node with no mapped category live in an archive category `xf-<nodeId>`. */
export function isArchiveCategory(key: string): boolean {
  return /^xf-\d+$/.test(key);
}
