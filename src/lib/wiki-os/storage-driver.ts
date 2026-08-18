// src/lib/wiki-os/storage-driver.ts
// Pluggable Storage Driver Seam for WikiOS Core (Workstream C Final).
// Enables WikiOS to run on Postgres, SQLite, or In-Memory without changing feature code.

import type { WikiSource } from "~/lib/wiki-os/config";

export interface StoredArticle {
  readonly id?: string;
  readonly source: WikiSource;
  readonly title: string;
  readonly wikitext: string;
  readonly revisionId?: number | null;
  readonly revTimestamp?: string | null;
  readonly htmlContent?: string | null;
  readonly htmlSyncedAt?: Date | null;
  readonly syncedAt: Date;
  readonly updatedAt?: Date;
}

export interface StoredRevision {
  readonly id?: string;
  readonly articleId: string;
  readonly source: WikiSource;
  readonly mwRevId?: number | null;
  readonly wikitext: string;
  readonly author?: string | null;
  readonly summary?: string | null;
  readonly minor: boolean;
  readonly createdAt: Date;
}

export interface WikiStorageDriver {
  /** Unique driver identifier (e.g. 'postgres', 'sqlite', 'memory') */
  readonly name: string;

  /** Initialize tables/storage schema if necessary */
  init?(): Promise<void>;

  /** Fetch an article shadow row by source and normalized title */
  getArticle(source: WikiSource, title: string): Promise<StoredArticle | null>;

  /** Upsert an article shadow row */
  putArticle(article: StoredArticle): Promise<void>;

  /** Delete or invalidate an article shadow row */
  deleteArticle(source: WikiSource, title: string): Promise<void>;

  /** Fetch a specific revision by MediaWiki revision ID */
  getRevision(mwRevId: number, source?: WikiSource): Promise<StoredRevision | null>;

  /** List revision history for an article */
  listRevisions(
    source: WikiSource,
    title: string,
    limit?: number
  ): Promise<{ revisions: StoredRevision[]; hasMore: boolean }>;

  /** Append a new revision row */
  recordRevision(revision: Omit<StoredRevision, "id" | "createdAt">): Promise<void>;
}

// Global active driver registry
let activeDriver: WikiStorageDriver | null = null;

export function setStorageDriver(driver: WikiStorageDriver): void {
  activeDriver = driver;
}

export function getStorageDriver(): WikiStorageDriver | null {
  return activeDriver;
}
