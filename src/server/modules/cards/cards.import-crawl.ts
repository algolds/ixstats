/**
 * The Imports tab's service: find pages to import (a category's pages, a Commons category's files, a whole wiki or a
 * pasted list), each marked when it already has a card, and queue a manual import. Only titles are read here; the
 * import job reads each page. A wiki that refuses or fails is reported by name, never read as "no pages".
 */
import type { PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { fetchCommonsCategoryMembers } from "~/lib/wiki-os/adapters/mediawiki/bridge";
import { titleKey } from "~/lib/wiki-os/core/title";
import { DiscoveryStopped } from "~/lib/realms/sources/wiki-discovery-client";
import { canonicalCardTitle, cardSourceLabel, type CardWikiSource } from "~/lib/cards/card-sources";
import { loreCardDiscovery } from "~/lib/cards/lore-card-discovery";
import { stoppedWikiMessage } from "~/lib/cards/lore-card-mediawiki";
import { recordCardAudit, type CardAdminActor } from "./cards.audit";
import { cardedTitleKeys } from "./cards.importer";
import { MAX_IMPORT_TITLES, createImportJob, kickImportRunner } from "./cards.import-jobs";

/** The most pages one crawl answers: one import job's worth. */
export const MAX_CRAWL = MAX_IMPORT_TITLES;
/** The most titles a crawl reads, so a category or wiki bigger than one job still offers the pages left to import. */
export const MAX_SCAN = 10_000;
/** Commons answers at most 500 category members a request. */
const COMMONS_MAX = 500;

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
  /** The wiki may have more: the crawl answered its limit, or read as many titles as it reads. */
  truncated: boolean;
}

/** The titles to look at, and how many the wiki was asked for (null for a pasted list, which is all there is). */
async function wikiTitles(input: CrawlInput): Promise<{ titles: string[]; asked: number | null }> {
  if (input.mode === "titles") return { titles: input.titles ?? [], asked: null };
  const category = input.category?.replace(/^\s*category\s*:\s*/i, "").trim();
  if (input.source === "commons") {
    if (input.mode !== "category" || !category) return { titles: [], asked: null };
    const files = await fetchCommonsCategoryMembers(category, COMMONS_MAX);
    return { titles: files.map((file) => file.title), asked: COMMONS_MAX };
  }
  if (input.mode === "all") {
    return {
      titles: await loreCardDiscovery.fetchAllMainNamespacePages(input.source, MAX_SCAN),
      asked: MAX_SCAN,
    };
  }
  if (!category) return { titles: [], asked: null };
  return {
    titles: await loreCardDiscovery.fetchCategoryMembers(category, input.source, MAX_SCAN, "page"),
    asked: MAX_SCAN,
  };
}

/** The wiki's titles, or a BAD_GATEWAY naming the wiki (the raw reason goes to the server log only). */
async function readTitles(input: CrawlInput) {
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

export async function crawlImportTitles(db: PrismaClient, input: CrawlInput): Promise<CrawlResult> {
  const limit = Math.min(input.limit, MAX_CRAWL);
  const read = await readTitles(input);
  const titles = [
    ...new Set(
      read.titles.flatMap((raw) => {
        const title = canonicalCardTitle(input.source, raw);
        return title ? [title] : [];
      })
    ),
  ];
  const carded = await cardedTitleKeys(db, input.source, titles);
  const isCarded = (title: string) => carded.has(titleKey(title, input.source));
  // The pages with no card come first, so a crawl bigger than its limit keeps offering the ones left to import.
  const ordered = [
    ...titles.filter((title) => !isCarded(title)),
    ...titles.filter((title) => isCarded(title)),
  ];
  return {
    entries: ordered.slice(0, limit).map((title) => ({ title, carded: isCarded(title) })),
    truncated: ordered.length > limit || (read.asked !== null && read.titles.length >= read.asked),
  };
}

export interface StartImportInput {
  source: CardWikiSource;
  label: string;
  titles: string[];
}

const countOf = (source: CardWikiSource, count: number) =>
  `${count} ${source === "commons" ? "file" : "page"}${count === 1 ? "" : "s"}`;

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
    details: `Queued ${countOf(input.source, created.queued)} from ${cardSourceLabel(input.source)}: ${input.label}`,
  });
  kickImportRunner(db);
  return created;
}
