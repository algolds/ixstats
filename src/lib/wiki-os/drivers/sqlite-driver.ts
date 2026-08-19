// src/lib/wiki-os/drivers/sqlite-driver.ts
// Standalone SQLite storage driver for zero-dependency WikiOS embed deployments.

import type { WikiSource } from "../config";
import type {
  WikiStorageDriver,
  StoredArticle,
  StoredRevision,
} from "../storage-driver";

export interface SqliteDbConnection {
  run(sql: string, params?: unknown[]): void | Promise<void>;
  get<T = unknown>(sql: string, params?: unknown[]): T | undefined | Promise<T | undefined>;
  all<T = unknown>(sql: string, params?: unknown[]): T[] | Promise<T[]>;
}

export class SqliteStorageDriver implements WikiStorageDriver {
  readonly name = "sqlite";
  private db: SqliteDbConnection | null;

  constructor(db?: SqliteDbConnection) {
    this.db = db ?? null;
  }

  async init(): Promise<void> {
    if (!this.db) return;
    await this.db.run(`
      CREATE TABLE IF NOT EXISTS wiki_articles (
        id TEXT PRIMARY KEY,
        source TEXT NOT NULL,
        title TEXT NOT NULL,
        wikitext TEXT NOT NULL,
        revision_id INTEGER,
        rev_timestamp TEXT,
        html_content TEXT,
        html_synced_at TEXT,
        synced_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(source, title)
      );
    `);
    await this.db.run(`
      CREATE TABLE IF NOT EXISTS wiki_revisions (
        id TEXT PRIMARY KEY,
        article_id TEXT NOT NULL,
        source TEXT NOT NULL,
        mw_rev_id INTEGER,
        wikitext TEXT NOT NULL,
        author TEXT,
        summary TEXT,
        minor INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        FOREIGN KEY(article_id) REFERENCES wiki_articles(id) ON DELETE CASCADE
      );
    `);
  }

  async getArticle(source: WikiSource, title: string): Promise<StoredArticle | null> {
    if (!this.db) return null;
    const row = await this.db.get<{
      id: string;
      source: string;
      title: string;
      wikitext: string;
      revision_id: number | null;
      rev_timestamp: string | null;
      html_content: string | null;
      html_synced_at: string | null;
      synced_at: string;
      updated_at: string;
    }>(
      `SELECT * FROM wiki_articles WHERE source = ? AND title = ? LIMIT 1`,
      [source, title.replace(/ /g, "_")]
    );

    if (!row) return null;
    return {
      id: row.id,
      source: row.source as WikiSource,
      title: row.title,
      wikitext: row.wikitext,
      revisionId: row.revision_id,
      revTimestamp: row.rev_timestamp,
      htmlContent: row.html_content,
      htmlSyncedAt: row.html_synced_at ? new Date(row.html_synced_at) : null,
      syncedAt: new Date(row.synced_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  async putArticle(article: StoredArticle): Promise<void> {
    if (!this.db) return;
    const now = new Date().toISOString();
    const id = article.id ?? `${article.source}:${article.title.replace(/ /g, "_")}`;
    await this.db.run(
      `INSERT INTO wiki_articles (id, source, title, wikitext, revision_id, rev_timestamp, synced_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(source, title) DO UPDATE SET
         wikitext = excluded.wikitext,
         revision_id = excluded.revision_id,
         rev_timestamp = excluded.rev_timestamp,
         synced_at = excluded.synced_at,
         updated_at = excluded.updated_at`,
      [
        id,
        article.source,
        article.title.replace(/ /g, "_"),
        article.wikitext,
        article.revisionId ?? null,
        article.revTimestamp ?? null,
        now,
        now,
      ]
    );
  }

  async deleteArticle(source: WikiSource, title: string): Promise<void> {
    if (!this.db) return;
    await this.db.run(`DELETE FROM wiki_articles WHERE source = ? AND title = ?`, [
      source,
      title.replace(/ /g, "_"),
    ]);
  }

  async getRevision(mwRevId: number, source: WikiSource = "ixwiki"): Promise<StoredRevision | null> {
    if (!this.db) return null;
    const row = await this.db.get<{
      id: string;
      article_id: string;
      source: string;
      mw_rev_id: number | null;
      wikitext: string;
      author: string | null;
      summary: string | null;
      minor: number;
      created_at: string;
    }>(
      `SELECT * FROM wiki_revisions WHERE source = ? AND mw_rev_id = ? LIMIT 1`,
      [source, mwRevId]
    );

    if (!row) return null;
    return {
      id: row.id,
      articleId: row.article_id,
      source: row.source as WikiSource,
      mwRevId: row.mw_rev_id,
      wikitext: row.wikitext,
      author: row.author,
      summary: row.summary,
      minor: Boolean(row.minor),
      createdAt: new Date(row.created_at),
    };
  }

  async listRevisions(
    source: WikiSource,
    title: string,
    limit = 50
  ): Promise<{ revisions: StoredRevision[]; hasMore: boolean }> {
    if (!this.db) return { revisions: [], hasMore: false };
    const rows = await this.db.all<{
      id: string;
      article_id: string;
      source: string;
      mw_rev_id: number | null;
      wikitext: string;
      author: string | null;
      summary: string | null;
      minor: number;
      created_at: string;
    }>(
      `SELECT r.* FROM wiki_revisions r
       JOIN wiki_articles a ON a.id = r.article_id
       WHERE a.source = ? AND a.title = ?
       ORDER BY r.created_at DESC LIMIT ?`,
      [source, title.replace(/ /g, "_"), limit + 1]
    );

    const hasMore = rows.length > limit;
    const slice = hasMore ? rows.slice(0, limit) : rows;

    return {
      revisions: slice.map((r) => ({
        id: r.id,
        articleId: r.article_id,
        source: r.source as WikiSource,
        mwRevId: r.mw_rev_id,
        wikitext: r.wikitext,
        author: r.author,
        summary: r.summary,
        minor: Boolean(r.minor),
        createdAt: new Date(r.created_at),
      })),
      hasMore,
    };
  }

  async recordRevision(revision: Omit<StoredRevision, "id" | "createdAt">): Promise<void> {
    if (!this.db) return;
    const id = `rev_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();
    await this.db.run(
      `INSERT INTO wiki_revisions (id, article_id, source, mw_rev_id, wikitext, author, summary, minor, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        revision.articleId,
        revision.source,
        revision.mwRevId ?? null,
        revision.wikitext,
        revision.author ?? null,
        revision.summary ?? null,
        revision.minor ? 1 : 0,
        now,
      ]
    );
  }
}
