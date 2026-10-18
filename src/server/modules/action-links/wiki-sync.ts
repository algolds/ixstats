/**
 * Writes an approved story chain to its wiki page as a new section, authored under the chain's country name
 * (resolveWikiUsername's country fallback). The owner's edit right was checked at submit. Failures leave
 * `wikiSyncedAt` null; `syncPendingChainWikis` (cron "story-chain-wiki-sync") retries them.
 */
import type { PrismaClient } from "@prisma/client";
import { chainWikiSection } from "~/lib/action-links";
import { IxTime } from "~/lib/ixtime";
import { postHref } from "~/lib/thinkpages-forum/links";
import { createAbsoluteUrl } from "~/lib/utils/url-utils";
import { ArticleRepository } from "~/lib/wiki-os/core";
import { getHeadRevisionRefs } from "~/lib/wiki-os/core/edit-conflict";
import { mediaWikiOrigin } from "~/lib/wiki-os/config";
import { commitWikitextSave } from "~/lib/wiki-os/services/edit-service";

export type WikiSyncDb = Pick<PrismaClient, "storyline">;

const PENDING = { kind: "chain", status: "approved", wikiSyncedAt: null, wikiPageTitle: { not: null } } as const;

/** A native post's permalink (`/thinkpages/post/<id>`) as an absolute IxStates URL. */
function postUrl(postId: string): string {
  return `${mediaWikiOrigin()}${createAbsoluteUrl(postHref(postId))}`;
}

export async function appendChainToWiki(db: WikiSyncDb, storylineId: string): Promise<boolean> {
  const chain = await db.storyline.findFirst({
    where: { id: storylineId, ...PENDING },
    include: {
      country: { select: { name: true } },
      actionLinks: {
        orderBy: { chainOrder: "asc" },
        include: {
          activity: { select: { title: true, type: true, createdAt: true, visibility: true } },
        },
      },
    },
  });
  if (!chain?.wikiPageTitle) return false;

  // An activity withdrawn since it was linked (an abandoned directive) is no longer public; its text stays off the wiki.
  // A link still on a XenForo post (one the import has not remapped) has no page to point at, so it stays off too.
  const entries = chain.actionLinks
    .filter((l) => l.postSource === "native" && l.activity.visibility === "public")
    .map((l) => ({
      title: l.activity.title,
      type: l.activity.type,
      ixTime: IxTime.convertToIxTime(l.activity.createdAt.getTime()),
      url: postUrl(l.postRef),
    }));
  if (entries.length === 0) {
    // Nothing public to publish: write no section, and mark the chain done so the cron does not retry it forever.
    await db.storyline.update({ where: { id: chain.id }, data: { wikiSyncedAt: new Date() } });
    return true;
  }

  const marker = `<!-- story-chain:${chain.id} -->`;
  const section = `${marker}\n${chainWikiSection({
    title: chain.title,
    approvedIxTime: IxTime.convertToIxTime((chain.reviewedAt ?? new Date()).getTime()),
    entries,
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
