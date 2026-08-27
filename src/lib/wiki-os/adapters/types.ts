/**
 * src/lib/wiki-os/adapters/types.ts — Wiki Provider Adapter Interface
 *
 * Defines the unified multi-realm contract for wiki data providers, supporting
 * both native PostgreSQL persistence and external federated wiki providers.
 */

import type {
  WikiArticleEntity,
  WikiRevisionSummary,
  SaveArticleInput,
} from "../core/domain-types";

export interface WikiAuthorInfo {
  userId?: string | null;
  username: string;
  countryId?: string | null;
  ipAddress?: string | null;
}

export interface SaveArticleResult {
  article: WikiArticleEntity;
  revisionId: string;
  isNew: boolean;
  byteDelta: number;
}

export interface WikiUserContribution {
  id: string;
  articleSlug: string;
  articleTitle: string;
  timestamp: Date;
  summary: string | null;
  byteDelta: number;
  minor: boolean;
  reverted: boolean;
}

export interface WikiRecentChange {
  id: string;
  type: "edit" | "new" | "log" | "categorize";
  title: string;
  slug: string;
  namespace: number;
  timestamp: Date;
  user: string;
  userId?: string | null;
  comment: string | null;
  oldLen: number;
  newLen: number;
  byteDelta: number;
  minor: boolean;
  bot: boolean;
}

export interface WikiBacklink {
  sourceSlug: string;
  sourceTitle: string;
  isRedirect: boolean;
  namespace: number;
}

/**
 * Unified interface for multi-realm wiki providers.
 */
export interface WikiProviderAdapter {
  readonly realm: string;
  fetchArticle(titleOrSlug: string): Promise<WikiArticleEntity | null>;
  fetchHistory(titleOrSlug: string, limit?: number): Promise<WikiRevisionSummary[]>;
  fetchUserContribs(username: string, limit?: number): Promise<WikiUserContribution[]>;
  fetchRecentChanges(limit?: number): Promise<WikiRecentChange[]>;
  fetchBacklinks(titleOrSlug: string, limit?: number): Promise<WikiBacklink[]>;
  saveArticle(input: SaveArticleInput, author: WikiAuthorInfo): Promise<SaveArticleResult>;
  revertRevision(
    titleOrSlug: string,
    revId: string,
    summary: string,
    author: WikiAuthorInfo
  ): Promise<boolean>;
}
