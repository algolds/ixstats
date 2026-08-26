/**
 * sync-worker.ts — WikiOS Asynchronous MediaWiki Export Mirror Worker
 *
 * Dispatches non-blocking edits to legacy MediaWiki Action API in the background.
 * User saves commit to PostgreSQL in <10ms; MediaWiki sync failures never block users.
 * Automatically attributes revision actors in MariaDB to the calling user.
 */

import { executeMediaWikiWrite, updateRevisionActor } from "./write-service";
import { db } from "~/server/db";

export interface MediaWikiSyncJob {
  slug: string;
  title: string;
  wikitext: string;
  summary?: string;
  minor?: boolean;
  authorWikiUsername?: string;
  attempts: number;
}

export class MediaWikiExportWorker {
  private static queue: MediaWikiSyncJob[] = [];
  private static isProcessing = false;

  /**
   * Enqueue a background sync task
   */
  static enqueue(job: Omit<MediaWikiSyncJob, "attempts">): void {
    if (process.env.SKIP_MEDIAWIKI_SYNC === "true") return;

    this.queue.push({ ...job, attempts: 0 });
    void this.processNext();
  }

  /**
   * Process queue sequentially in the background
   */
  private static async processNext(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) return;

    this.isProcessing = true;
    const job = this.queue.shift();

    if (!job) {
      this.isProcessing = false;
      return;
    }

    try {
      const res = await executeMediaWikiWrite(
        {
          action: "edit",
          title: job.title || job.slug.replace(/_/g, " "),
          text: job.wikitext,
          summary: job.summary || "WikiOS Native Edit",
          minor: job.minor ? 1 : 0,
          bot: 0,
        },
        job.authorWikiUsername ? { user: { wikiUsername: job.authorWikiUsername } } : "ixwiki"
      );

      if (res.revisionId) {
        // Record mwLatestRevId on PostgreSQL article to prevent inbound CDC echo loops
        await db.wikiArticle.updateMany({
          where: {
            source: "ixwiki",
            OR: [
              { title: job.title },
              { title: job.title.replace(/_/g, " ") },
              { slug: job.slug },
            ],
          },
          data: {
            mwLatestRevId: res.revisionId,
            lastMwSyncAt: new Date(),
          },
        }).catch(() => null);

        if (job.authorWikiUsername) {
          await updateRevisionActor(res.revisionId, job.authorWikiUsername);
        }
      }
    } catch (err) {
      if (job.attempts < 3) {
        job.attempts++;
        const delayMs = Math.pow(2, job.attempts) * 1000;
        setTimeout(() => {
          this.queue.push(job);
          void this.processNext();
        }, delayMs);
      } else {
        console.warn(
          `[MediaWikiExportWorker] Best-effort sync for ${job.slug} dropped after 3 attempts. PostgreSQL remains authoritative.`
        );
      }
    } finally {
      this.isProcessing = false;
      if (this.queue.length > 0) {
        void this.processNext();
      }
    }
  }
}
