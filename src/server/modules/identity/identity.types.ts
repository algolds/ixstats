/**
 * Identity module contracts (plan 188): the public passport resolved from a handle.
 */
import type { IdentityCountry, IdentityUser } from "./identity.selects";

/** Minimal XenForo member shape the passport reads; the forum module's `XFUser` satisfies it. */
export interface IdentityForumMember {
  user_id: number;
  username: string;
  user_title: string;
  message_count: number;
  reaction_score: number;
  trophy_points: number;
  register_date: number;
  is_staff: boolean;
}

/** Forum access, injected by the API layer because modules may not import other modules. */
export interface IdentityForumGateway {
  lookupUser(name: string): Promise<{ userId: number; username: string } | null>;
  getMember(userId: number): Promise<IdentityForumMember | null>;
}

/** A handle resolved to its user, country and linked wiki/forum names. */
export interface ResolvedIdentity {
  /** Handle without the leading `@`. */
  handle: string;
  /** Handle with a trailing `_` removed (wiki/forum names sometimes carry one). */
  strippedHandle: string;
  user: IdentityUser | null;
  country: IdentityCountry | null;
  wikiName: string | null;
  forumUserId: number | null;
  forumUsername: string | null;
  isOwner: boolean;
}

export interface RealmMembership {
  id: string;
  name: string;
  slug: string;
  role: string;
  isFeatured: boolean;
  country: {
    id: string;
    name: string;
    slug: string;
    flagUrl: string | null;
    coatOfArmsUrl: string | null;
    currentPopulation: number;
    currentTotalGdp: number;
    currentGdpPerCapita: number;
    continent: string | null;
    region: string | null;
    governmentType: string | null;
    currentPublicApproval: number;
  };
}

export type WikiActivityType = "publish" | "revision" | "minor_edit" | "discussion" | "laurel";

export interface WikiActivityItem {
  id: string;
  type: WikiActivityType;
  title: string;
  articleSlug: string;
  summary: string | null;
  byteDiff: number | null;
  timestamp: string;
  url: string;
  /** A MediaWiki edit that did not go live (conflict): listed, never the page's live text. */
  parked?: boolean;
}

export interface AuthoredArticle {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AwardHistoryItem {
  id: string;
  date: string;
  type: string;
  role: "winner" | "runner-up";
  page: string | null;
  score: number | null;
}

/** Lorewards standing shown on the passport. */
export interface PassportLorewards {
  totalScore: number;
  totalBytes: number;
  rank: number | null;
  dailyWins: number;
  dailyRunnerUps: number;
  weeklyWins: number;
  monthlyWins: number;
  currentStreak: number;
  longestStreak: number;
}

/** Forum counters shown on the passport. */
export interface PassportForumStats {
  userTitle: string | null;
  messageCount: number;
  reactionScore: number;
  trophyPoints: number;
}

export type IdentitySystem =
  | "forum"
  | "wikios"
  | "vexel"
  | "onoma"
  | "myleague"
  | "thinkpages"
  | "atlas"
  | "vault"
  | "mycountry"
  | "realm";

export type IdentityEventType =
  | "forum.post"
  | "forum.thread"
  | "wikios.article_published"
  | "wikios.article_revised"
  | "vexel.flag_registered"
  | "onoma.language_created"
  | "myleague.club_founded"
  | "thinkpages.bulletin_posted"
  | "atlas.map_published"
  | "mycountry.directive_enacted"
  | "vault.card_acquired"
  | "realm.joined";

/** One entry of the cross-platform History stream (plan 188 §4). */
export interface IdentityEventPayload {
  id: string;
  identityId: string;
  realmId?: string;
  realmName?: string;
  countryId?: string;
  countryName?: string;
  system: IdentitySystem;
  type: IdentityEventType;
  title: string;
  description?: string;
  timestamp: Date;
  objectId?: string;
  objectUrl?: string;
}

export interface IdentityHistoryPage {
  items: IdentityEventPayload[];
  nextCursor: string | null;
}
