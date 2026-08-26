/**
 * inbound-sync.ts — Inbound Real-Time Sync Daemon (Live MediaWiki Action API → PostgreSQL WikiOS)
 *
 * Continuously polls MediaWiki recentchanges over HTTP or processes incoming webhooks,
 * streaming new revisions, article updates, and link graph changes into PostgreSQL.
 * 100% decoupled from MariaDB socket pools.
 */

import { db } from "~/server/db";
import { DEFAULT_USER_AGENT } from "../../config";
import { LinkGraphService } from "../../core/link-graph-service";
import { toArticleSlug } from "../../core/domain-types";

export interface SyncStats {
  polled: number;
  synced: number;
  errors: number;
  latestRevId: number;
}

export class InboundMediaWikiSyncService {
  private static isRunning = false;

  private static sanitize(str: string | null | undefined): string {
    if (!str) return "";
    return str.replace(/\0/g, "").replace(/\u0000/g, "");
  }

  /**
   * Fetches latest revision wikitext from MediaWiki Action API
   */
  private static async fetchWikitext(
    title: string,
    apiEndpoint: string
  ): Promise<{ wikitext: string; revId: number } | null> {
    try {
      const params = new URLSearchParams({
        action: "query",
        prop: "revisions",
        rvprop: "content|ids",
        rvslots: "main",
        titles: title,
        format: "json",
      });

      const res = await fetch(`${apiEndpoint}?${params.toString()}`, {
        headers: { "User-Agent": DEFAULT_USER_AGENT },
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) return null;
      const data = (await res.json()) as any;
      const pages = data?.query?.pages || {};
      const pageId = Object.keys(pages)[0];
      if (!pageId || pageId === "-1") return null;

      const page = pages[pageId];
      const rev = page?.revisions?.[0];
      const wikitext = rev?.slots?.main?.["*"] ?? rev?.["*"] ?? "";
      const revId = rev?.revid ? Number(rev.revid) : 0;

      return { wikitext, revId };
    } catch {
      return null;
    }
  }

  /**
   * Poll MediaWiki recentchanges for revisions newer than max(mwLatestRevId) in PostgreSQL
   */
  static async pollRecentChanges(realm = "ixwiki", batchSize = 50): Promise<SyncStats> {
    if (this.isRunning) {
      return { polled: 0, synced: 0, errors: 0, latestRevId: 0 };
    }

    this.isRunning = true;
    let synced = 0;
    let errors = 0;
    let maxRev = 0;

    try {
      // 1. Get current max mwLatestRevId from PostgreSQL
      const latestArticle: any = await (db as any).wikiArticle.findFirst({
        where: { source: realm, mwLatestRevId: { not: null } },
        orderBy: { mwLatestRevId: "desc" },
        select: { mwLatestRevId: true },
      });

      const currentMaxRevId = latestArticle?.mwLatestRevId ? Number(latestArticle.mwLatestRevId) : 0;
      maxRev = currentMaxRevId;

      // 2. Query MediaWiki Action API for recent changes
      const wikiUrl = process.env.NEXT_PUBLIC_MEDIAWIKI_URL || "https://ixwiki.com";
      const apiEndpoint = `${wikiUrl.replace(/\/+$/, "")}/api.php`;
      const params = new URLSearchParams({
        action: "query",
        list: "recentchanges",
        rcprop: "title|user|timestamp|comment|sizes|flags|ids",
        rcnamespace: "0|1|2|4|10|14",
        rclimit: String(batchSize),
        rcdir: "older",
        format: "json",
      });

      const res = await fetch(`${apiEndpoint}?${params.toString()}`, {
        headers: { "User-Agent": DEFAULT_USER_AGENT },
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) {
        return { polled: 0, synced: 0, errors: 1, latestRevId: maxRev };
      }

      const data = (await res.json()) as any;
      const changes = data?.query?.recentchanges || [];

      for (const rc of changes) {
        try {
          const revId = Number(rc.revid || rc.rc_this_oldid || 0);
          if (revId <= currentMaxRevId && currentMaxRevId > 0) {
            continue;
          }

          const fullTitle = this.sanitize(String(rc.title || "").replace(/_/g, " "));
          const slug = toArticleSlug(fullTitle);
          const ns = Number(rc.ns ?? 0);
          const prefix = ns === 10 ? "Template" : ns === 14 ? "Category" : ns === 2 ? "User" : ns === 1 ? "Talk" : "";
          const byteDelta = Number(rc.newlen || 0) - Number(rc.oldlen || 0);

          // 3. Check existing article for echo prevention
          const existingArticle = await (db as any).wikiArticle.findFirst({
            where: { source: realm, title: fullTitle },
            select: { id: true, mwLatestRevId: true },
          });

          if (existingArticle && existingArticle.mwLatestRevId === revId && revId > 0) {
            if (revId > maxRev) maxRev = revId;
            continue;
          }

          // 4. Fetch full wikitext for this revision
          const fetched = await this.fetchWikitext(fullTitle, apiEndpoint);
          const wikitext = fetched?.wikitext ?? "";
          const words = wikitext.split(/\s+/).filter(Boolean).length;

          // 5. Upsert Article in PostgreSQL
          const article: any = await (db as any).wikiArticle.upsert({
            where: {
              source_title: { source: realm, title: fullTitle },
            },
            create: {
              slug,
              title: fullTitle,
              source: realm,
              namespace: ns,
              namespacePrefix: prefix || null,
              wikitext,
              status: "PUBLISHED",
              wordCount: words,
              readingTime: Math.max(1, Math.ceil(words / 200)),
              mwLatestRevId: revId || null,
              syncedAt: new Date(),
            },
            update: {
              slug,
              wikitext,
              wordCount: words,
              readingTime: Math.max(1, Math.ceil(words / 200)),
              mwLatestRevId: revId || null,
              syncedAt: new Date(),
            },
          });

          // 6. Create Revision record
          await (db as any).wikiRevision.create({
            data: {
              articleId: article.id,
              author: this.sanitize(String(rc.user || "MediaWiki Editor")),
              wikitext,
              summary: this.sanitize(String(rc.comment || "Inbound sync from MediaWiki")),
              minor: rc.minor !== undefined,
              byteSize: Number(rc.newlen || wikitext.length),
              byteDelta,
              format: "WIKITEXT",
              source: realm,
            },
          });

          // 7. Update Link Graph if wikitext is present
          if (wikitext) {
            void LinkGraphService.syncArticleLinks(article.id, wikitext, undefined, realm).catch(() => {});
          }

          synced++;
          if (revId > maxRev) maxRev = revId;
        } catch {
          errors++;
        }
      }

      return {
        polled: changes.length,
        synced,
        errors,
        latestRevId: maxRev,
      };
    } catch {
      return { polled: 0, synced, errors: errors + 1, latestRevId: maxRev };
    } finally {
      this.isRunning = false;
    }
  }
}
