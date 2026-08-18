// src/lib/wiki-os/drivers/memory-driver.ts
// In-memory storage driver for WikiOS unit testing and ephemeral sandboxes.

import type { WikiSource } from "../config";
import type {
  WikiStorageDriver,
  StoredArticle,
  StoredRevision,
} from "../storage-driver";

export class MemoryStorageDriver implements WikiStorageDriver {
  readonly name = "memory";
  private articles = new Map<string, StoredArticle>();
  private revisions: StoredRevision[] = [];

  private key(source: WikiSource, title: string): string {
    return `${source}:${title.replace(/ /g, "_")}`;
  }

  async getArticle(source: WikiSource, title: string): Promise<StoredArticle | null> {
    return this.articles.get(this.key(source, title)) ?? null;
  }

  async putArticle(article: StoredArticle): Promise<void> {
    const k = this.key(article.source, article.title);
    this.articles.set(k, {
      ...article,
      id: article.id ?? k,
      syncedAt: new Date(),
    });
  }

  async deleteArticle(source: WikiSource, title: string): Promise<void> {
    this.articles.delete(this.key(source, title));
  }

  async getRevision(mwRevId: number, source: WikiSource = "ixwiki"): Promise<StoredRevision | null> {
    const found = this.revisions.find((r) => r.source === source && r.mwRevId === mwRevId);
    return found ?? null;
  }

  async listRevisions(
    source: WikiSource,
    title: string,
    limit = 50
  ): Promise<{ revisions: StoredRevision[]; hasMore: boolean }> {
    const k = this.key(source, title);
    const article = this.articles.get(k);
    const targetId = article?.id ?? k;

    const matching = this.revisions
      .filter((r) => r.articleId === targetId && r.source === source)
      .sort((a, b) => {
        const timeDiff = b.createdAt.getTime() - a.createdAt.getTime();
        if (timeDiff !== 0) return timeDiff;
        return (b.mwRevId ?? 0) - (a.mwRevId ?? 0);
      });

    const hasMore = matching.length > limit;
    const slice = hasMore ? matching.slice(0, limit) : matching;

    return { revisions: slice, hasMore };
  }

  async recordRevision(revision: Omit<StoredRevision, "id" | "createdAt">): Promise<void> {
    this.revisions.push({
      ...revision,
      id: `mem_rev_${this.revisions.length + 1}`,
      createdAt: new Date(),
    });
  }

  clear(): void {
    this.articles.clear();
    this.revisions = [];
  }
}
