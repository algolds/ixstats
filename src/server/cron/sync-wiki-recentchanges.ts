/**
 * Recentchanges sync — capture edits made directly on MediaWiki (Stage 2b).
 *
 * WikiOS-originated saves write through to the local revision store already
 * (saveToMediaWiki → recordArticleRevision). This job catches edits made
 * *outside* WikiOS by polling MediaWiki's recentchanges feed and recording any
 * page whose current revision isn't already in WikiRevision.
 *
 * Idempotent + bounded: deduped on (source, mwRevId) via hasRevision, limited
 * per run. Best-effort — every step swallows errors so it can never crash the
 * server cron loop.
 */
import {
  getRecentChanges,
  getArticleWikitext,
  getCurrentRevMeta,
} from "~/lib/wiki-os/adapters/mediawiki/bridge";
import { recordArticleRevision, hasRevision } from "~/lib/wiki-os/adapters/mediawiki/article-store";

export interface RecentChangesSyncResult {
  changesSeen: number;
  recorded: number;
  skipped: number;
}

export async function syncWikiRecentChanges(limit = 50): Promise<RecentChangesSyncResult> {
  const result: RecentChangesSyncResult = { changesSeen: 0, recorded: 0, skipped: 0 };

  const changes = await getRecentChanges(limit);
  result.changesSeen = changes.length;

  // Dedupe to the latest change per page in this batch.
  const titles = [...new Set(changes.map((c) => c.title))];

  for (const title of titles) {
    try {
      const meta = await getCurrentRevMeta(title);
      if (!meta) continue;

      // Already captured (e.g. WikiOS-originated, or a previous run).
      if (await hasRevision(meta.revid, "ixwiki")) {
        result.skipped++;
        continue;
      }

      const article = await getArticleWikitext(title, "ixwiki");
      if (!article) continue;

      const change = changes.find((c) => c.title === title);
      const ok = await recordArticleRevision({
        title,
        wikitext: article.wikitext,
        mwRevId: meta.revid,
        author: change?.user ?? null,
        summary: change?.comment ?? null,
        source: "ixwiki",
      });
      if (ok) result.recorded++;
    } catch (err) {
      console.error(`[WikiRecentChangesSync] Failed to sync "${title}":`, (err as Error).message);
    }
  }

  return result;
}
