/**
 * src/lib/wiki-os/types/canonical.ts — Universal Canonical Type System for WikiOS
 *
 * Single source of truth for all WikiOS domain models, feed items, category trees,
 * article previews, and user profile data across Dashboard, WikiOS Reader,
 * Identity/Passport, Category Portals, and Halo Workspace.
 */

export type WikiSource = "ixwiki" | "iiwiki" | "althistory";

/**
 * Universal canonical article representation for cards, grids, and previews.
 */
export interface WikiArticleCardData {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  thumbnail: string | null;
  author: string;
  timestamp: string;
  categories: string[];
  namespace: number;
  wordCount: number;
  readingTime: number;
  source: WikiSource;
}

/**
 * Universal canonical wiki feed activity representation for Dashboard and timelines.
 */
export interface WikiFeedCardData {
  id: string;
  pageTitle: string;
  wikiUrl: string;
  excerpt: string;
  thumbnail: string | null;
  author: {
    id: string;
    name: string;
    avatarUrl?: string | null;
  };
  timestamp: Date | string;
  diff: {
    oldLen: number;
    newLen: number;
    delta: number;
  };
  comment: string;
  type: "new" | "edit" | "log";
  source: WikiSource;
}

/**
 * Universal canonical category portal representation.
 */
export interface WikiCategoryPortalData {
  slug: string;
  name: string;
  description: string | null;
  totalArticles: number;
  totalSubcats: number;
  articles: WikiArticleCardData[];
  subcategories: Array<{
    id?: string;
    slug: string;
    name: string;
    memberCount: number;
  }>;
  parent?: {
    id?: string;
    slug: string;
    name: string;
  } | null;
}

/**
 * Universal canonical user wiki identity representation for Passports and profiles.
 */
export interface WikiUserProfileData {
  userId?: number | null;
  username: string;
  exists: boolean;
  editCount: number;
  registrationDate: string | null;
  groups: string[];
  recentEdits: WikiFeedCardData[];
  lorewardScore: number;
  loreRank?: number | null;
}

/**
 * Universal canonical article authorship and edit lineage representation.
 */
export interface ArticleAuthorInfo {
  creator?: { username: string; timestamp?: string; avatar?: string | null } | string | null;
  author?: string | null;
  creatorAvatar?: string | null;
  createdAt?: string | null;
  createdTimestamp?: string | null;
  lastEditor?: { username: string; timestamp?: string; avatar?: string | null } | string | null;
  lastEditorAvatar?: string | null;
  lastEditedAt?: string | null;
  lastModifiedTimestamp?: string | null;
  topContributors?: Array<{ username: string; editCount?: number; lastContributedAt?: string }>;
  contributors?: Array<{ username: string; editCount?: number; lastContributedAt?: string }>;
  totalContributors?: number;
}
