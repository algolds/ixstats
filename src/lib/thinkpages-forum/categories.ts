/** The sitewide ThinkPages forum section (Concept B spec, "Structure at launch"). Seeded by the phase 1 migration. */
export type ForumVisibility = "public" | "staff" | "reporter_staff";

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
