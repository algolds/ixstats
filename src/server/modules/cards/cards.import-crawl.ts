/**
 * The Imports tab's service: find pages to import (a category's articles, a Commons category's files, a whole wiki
 * or a pasted list), each marked when it already has a card, and queue a manual import. Only titles are read here;
 * the import job reads each page. The wiki's list is read paced and within a time budget, and a wiki that refuses
 * or fails is reported by name, never read as "no pages".
 */
import type { PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { titleKey } from "~/lib/wiki-os/core/title";
import {
  createDiscoveryClient,
  DISCOVERY_DELAY_MS,
  DiscoveryStopped,
} from "~/lib/realms/sources/wiki-discovery-client";
import { isCardImageFile } from "~/lib/cards/art-licence";
import {
  canonicalCardTitle,
  cardSourceLabel,
  categoryName,
  parseCardArticleSource,
  sourceCount,
  type CardWikiSource,
} from "~/lib/cards/card-sources";
import { loreCardDiscovery, type TitleList } from "~/lib/cards/lore-card-discovery";
import { stoppedWikiMessage } from "~/lib/cards/lore-card-mediawiki";
import type { CardAdminActor } from "~/server/shared/admin-actor";
import { recordCardAudit } from "./cards.audit";
import { cardedTitleKeys } from "./cards.importer";
import { MAX_IMPORT_TITLES, createImportJob, kickImportRunner } from "./cards.import-jobs";

/** The most pages one crawl answers: one import job's worth. */
export const MAX_CRAWL = MAX_IMPORT_TITLES;
/** The most titles a crawl reads, so a category or wiki bigger than one job still offers the pages left to import. */
export const MAX_SCAN = 10_000;
/** How long a crawl reads the wiki's list; past it, the crawl answers what it read, truncated. */
export const CRAWL_BUDGET_MS = 60_000;

export const CRAWL_MODES = ["category", "all", "titles"] as const;
export type CrawlMode = (typeof CRAWL_MODES)[number];

export interface CrawlInput {
  source: CardWikiSource;
  mode: CrawlMode;
  category?: string;
  titles?: string[];
  limit: number;
}

export interface CrawlResult {
  entries: Array<{ title: string; carded: boolean }>;
  /** The wiki may have more: the crawl answered its limit, or its read of the wiki's list was cut. */
  truncated: boolean;
}

const NOTHING: TitleList = { titles: [], truncated: false };

/** The titles to look at: the pasted list, or the wiki's, read paced and within the budget. */
async function wikiTitles(input: CrawlInput): Promise<TitleList> {
  if (input.mode === "titles") return { titles: input.titles ?? [], truncated: false };
  // The budget, not the cap, ends a long read: each request waits its turn, so the cap is never reached first.
  const client = createDiscoveryClient(input.source, {
    maxRequests: Math.ceil(CRAWL_BUDGET_MS / DISCOVERY_DELAY_MS),
  });
  const reach = { limit: MAX_SCAN, deadline: Date.now() + CRAWL_BUDGET_MS, pace: client.pace };
  if (input.mode === "all") {
    const wiki = parseCardArticleSource(input.source);
    return wiki ? loreCardDiscovery.fetchAllMainNamespacePages(wiki, reach) : NOTHING;
  }
  const category = categoryName(input.category ?? "");
  return category ? loreCardDiscovery.fetchCategoryMembers(category, input.source, reach) : NOTHING;
}

/** The wiki's titles, or a BAD_GATEWAY naming the wiki (the raw reason goes to the server log only). */
async function readTitles(input: CrawlInput): Promise<TitleList> {
  try {
    return await wikiTitles(input);
  } catch (error) {
    const label = cardSourceLabel(input.source);
    console.error(`[Card imports] Could not list ${label} pages:`, error);
    throw new TRPCError({
      code: "BAD_GATEWAY",
      message:
        error instanceof DiscoveryStopped
          ? stoppedWikiMessage(input.source, error.stop)
          : `Could not read ${label}. Try again later.`,
      cause: error,
    });
  }
}

/** The titles as cards store them, once each; for Commons, only the files that can be card art. */
function storedTitles(source: CardWikiSource, raw: readonly string[]): string[] {
  const titles = raw.flatMap((title) => canonicalCardTitle(source, title) ?? []);
  return [...new Set(source === "commons" ? titles.filter(isCardImageFile) : titles)];
}

export async function crawlImportTitles(db: PrismaClient, input: CrawlInput): Promise<CrawlResult> {
  const limit = Math.min(input.limit, MAX_CRAWL);
  const read = await readTitles(input);
  const titles = storedTitles(input.source, read.titles);
  const carded = await cardedTitleKeys(db, input.source, titles);
  const isCarded = (title: string) => carded.has(titleKey(title, input.source));
  // The pages with no card come first, so a crawl bigger than its limit keeps offering the ones left to import.
  const ordered = [
    ...titles.filter((title) => !isCarded(title)),
    ...titles.filter((title) => isCarded(title)),
  ];
  return {
    entries: ordered.slice(0, limit).map((title) => ({ title, carded: isCarded(title) })),
    truncated: read.truncated || ordered.length > limit,
  };
}

export interface StartImportInput {
  source: CardWikiSource;
  label: string;
  titles: string[];
}

/** Queue an admin's import, record it, and start working it now (the cron picks it up too). */
export async function startManualImport(
  db: PrismaClient,
  actor: CardAdminActor,
  input: StartImportInput
): Promise<{ jobId: string; queued: number }> {
  const created = await createImportJob(db, {
    source: input.source,
    kind: "MANUAL",
    label: input.label,
    titles: input.titles,
    requestedBy: actor.dbId,
  });
  await recordCardAudit(db, {
    action: "CARD_IMPORT",
    actor: actor.clerkId,
    target: created.jobId,
    details: `Queued ${sourceCount(input.source, created.queued)} from ${cardSourceLabel(input.source)}: ${input.label}`,
  });
  kickImportRunner(db);
  return created;
}
