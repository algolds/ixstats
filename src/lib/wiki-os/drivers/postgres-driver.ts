// src/lib/wiki-os/drivers/postgres-driver.ts
// PostgreSQL storage driver for WikiOS powered by Prisma ORM.

import { db } from "~/server/db";
import type { WikiSource } from "../config";
import type {
  WikiStorageDriver,
  StoredArticle,
  StoredRevision,
} from "../storage-driver";

export class PostgresStorageDriver implements WikiStorageDriver {
  readonly name = "postgres";

  async getArticle(source: WikiSource, title: string): Promise<StoredArticle | null> {
    try {
      const row = await db.wikiArticle.findUnique({
        where: { source_title: { source, title: title.replace(/ /g, "_") } },
      });
      if (!row) return null;
      return {
        id: row.id,
        source: row.source as WikiSource,
        title: row.title,
        wikitext: row.wikitext,
        revisionId: row.revisionId,
        revTimestamp: row.revTimestamp,
        syncedAt: row.syncedAt,
        updatedAt: row.updatedAt,
      };
    } catch {
      return null;
    }
  }

  async putArticle(article: StoredArticle): Promise<void> {
    const title = article.title.replace(/ /g, "_");
    try {
      await db.wikiArticle.upsert({
        where: { source_title: { source: article.source, title } },
        create: {
          source: article.source,
          title,
          wikitext: article.wikitext,
          revisionId: article.revisionId ?? null,
          revTimestamp: article.revTimestamp ?? null,
        },
        update: {
          wikitext: article.wikitext,
          revisionId: article.revisionId ?? null,
          revTimestamp: article.revTimestamp ?? null,
          syncedAt: new Date(),
        },
      });
    } catch {
      /* best-effort */
    }
  }

  async deleteArticle(source: WikiSource, title: string): Promise<void> {
    try {
      await db.wikiArticle.deleteMany({
        where: { source, title: title.replace(/ /g, "_") },
      });
    } catch {
      /* best-effort */
    }
  }

  async getRevision(mwRevId: number, source: WikiSource = "ixwiki"): Promise<StoredRevision | null> {
    try {
      const rev = await db.wikiRevision.findFirst({
        where: { source, mwRevId },
      });
      if (!rev) return null;
      return {
        id: rev.id,
        articleId: rev.articleId,
        source: rev.source as WikiSource,
        mwRevId: rev.mwRevId,
        wikitext: rev.wikitext,
        author: rev.author,
        summary: rev.summary,
        minor: rev.minor,
        createdAt: rev.createdAt,
      };
    } catch {
      return null;
    }
  }

  async listRevisions(
    source: WikiSource,
    title: string,
    limit = 50
  ): Promise<{ revisions: StoredRevision[]; hasMore: boolean }> {
    try {
      const article = await db.wikiArticle.findUnique({
        where: { source_title: { source, title: title.replace(/ /g, "_") } },
        select: { id: true },
      });
      if (!article) return { revisions: [], hasMore: false };

      const rows = await db.wikiRevision.findMany({
        where: { articleId: article.id },
        orderBy: { createdAt: "desc" },
        take: limit + 1,
      });

      const hasMore = rows.length > limit;
      const slice = hasMore ? rows.slice(0, limit) : rows;

      return {
        revisions: slice.map((r) => ({
          id: r.id,
          articleId: r.articleId,
          source: r.source as WikiSource,
          mwRevId: r.mwRevId,
          wikitext: r.wikitext,
          author: r.author,
          summary: r.summary,
          minor: r.minor,
          createdAt: r.createdAt,
        })),
        hasMore,
      };
    } catch {
      return { revisions: [], hasMore: false };
    }
  }

  async recordRevision(revision: Omit<StoredRevision, "id" | "createdAt">): Promise<void> {
    try {
      await db.wikiRevision.create({
        data: {
          articleId: revision.articleId,
          source: revision.source,
          mwRevId: revision.mwRevId ?? null,
          wikitext: revision.wikitext,
          author: revision.author ?? null,
          summary: revision.summary ?? null,
          minor: revision.minor,
        },
      });
    } catch {
      /* best-effort */
    }
  }
}
