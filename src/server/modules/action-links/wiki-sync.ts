/**
 * Writes an approved story chain to its wiki page as a new section, authored under the chain's country name
 * (resolveWikiUsername's country fallback). The owner's edit right was checked at submit. Failures leave
 * `wikiSyncedAt` null; `syncPendingChainWikis` (cron "story-chain-wiki-sync") retries them.
 */
import type { PrismaClient } from "@prisma/client";
import { chainWikiSection, postPermalinkPath, type PostSource } from "~/lib/action-links";
import { IxTime } from "~/lib/ixtime";
import { createAbsoluteUrl } from "~/lib/utils/url-utils";
import { ArticleRepository } from "~/lib/wiki-os/core";
import { getHeadRevisionRefs } from "~/lib/wiki-os/core/edit-conflict";
import { mediaWikiOrigin } from "~/lib/wiki-os/config";
import { commitWikitextSave } from "~/lib/wiki-os/services/edit-service";

export type WikiSyncDb = Pick<PrismaClient, "storyline">;

const PENDING = { kind: "chain", status: "approved", wikiSyncedAt: null, wikiPageTitle: { not: null } } as const;

function postUrl(source: PostSource, postRef: string): string {
  const path = postPermalinkPath(source, postRef);
  return path.startsWith("http") ? path : `${mediaWikiOrigin()}${createAbsoluteUrl(path)}`;
}

export async function appendChainToWiki(db: WikiSyncDb, storylineId: string): Promise<boolean> {
  const chain = await db.storyline.findFirst({
    where: { id: storylineId, ...PENDING },
    include: {
      country: { select: { name: true } },
      actionLinks: {
        orderBy: { chainOrder: "asc" },
        include: { activity: { select: { title: true, type: true, createdAt: true } } },
      },
    },
  });
  if (!chain?.wikiPageTitle) return false;

  const marker = `<!-- story-chain:${chain.id} -->`;
  const section = `${marker}\n${chainWikiSection({
    title: chain.title,
    approvedIxTime: IxTime.convertToIxTime((chain.reviewedAt ?? new Date()).getTime()),
    entries: chain.actionLinks.map((l) => ({
      title: l.activity.title,
      type: l.activity.type,
      ixTime: IxTime.convertToIxTime(l.activity.createdAt.getTime()),
      url: postUrl(l.postSource as PostSource, l.postRef),
    })),
  })}`;
  // Head first, then text: findBySlug swallows read errors as null, so a page that exists but cannot be read
  // must abort rather than be overwritten by the section alone. The head ref also makes a concurrent edit conflict.
  const head = await getHeadRevisionRefs(chain.wikiPageTitle);
  const existing = await ArticleRepository.findBySlug(chain.wikiPageTitle);
  if (head && !existing?.wikitext) {
    throw new Error(`could not read the current text of ${chain.wikiPageTitle}`);
  }
  if (!existing?.wikitext?.includes(marker)) {
    await commitWikitextSave(
      { user: { country: { name: chain.country.name } } },
      {
        title: chain.wikiPageTitle,
        wikitext: existing?.wikitext ? `${existing.wikitext}\n\n${section}` : section,
        summary: `Story chain: ${chain.title}`,
        minor: false,
        expectedHeadRef: head?.revisionRef ?? null,
      }
    );
  }
  await db.storyline.update({ where: { id: chain.id }, data: { wikiSyncedAt: new Date() } });
  return true;
}

/** Cron entry: retry every approved chain whose wiki section is not written yet. */
export async function syncPendingChainWikis(): Promise<{ synced: number; failed: number }> {
  const { db } = await import("~/server/db");
  const pending = await db.storyline.findMany({
    where: PENDING,
    select: { id: true },
    orderBy: { reviewedAt: "asc" },
    take: 50,
  });
  let synced = 0;
  let failed = 0;
  for (const { id } of pending) {
    try {
      if (await appendChainToWiki(db, id)) synced++;
    } catch (error) {
      failed++;
      console.warn(`[story-chain-wiki-sync] chain ${id}:`, error);
    }
  }
  return { synced, failed };
}
