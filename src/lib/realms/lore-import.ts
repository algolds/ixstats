/**
 * One-time realm lore import (decision 7, rulings E-a..E-e): crawl a wiki category tree into a page index and
 * detect nation pages. Pure over an injected `query` so it is testable and proxy-agnostic.
 */
import { z } from "zod";

export type WikiQuery = <T>(params: Record<string, string>, schema: z.ZodType<T>) => Promise<T>;

export interface CrawlOptions {
  rootCategory: string; // "Category:Eurth"
  keyword: string; // "Eurth" — only subcategories containing it are followed
  maxDepth?: number; // default 5
  maxPages?: number; // default 5000
}

export interface CrawlResult {
  pages: string[];
  categoriesVisited: string[];
  /** True when the page cap or the depth cap stopped the crawl before the tree was exhausted. */
  truncated: boolean;
}

const NS_MAIN = 0;
const NS_CATEGORY = 14;
const SKIP_SUBCATEGORY = /\b(redirects|templates|users|stubs)\b/i;

/** MediaWiki continuation: every value is passed back verbatim on the next request. */
const ContinueSchema = z.record(z.string(), z.string()).optional();

/** Runs a query, following MediaWiki continuation until the wiki stops returning a `continue` object. */
async function queryAll<T extends { continue?: Record<string, string> }>(
  query: WikiQuery,
  params: Record<string, string>,
  schema: z.ZodType<T>
): Promise<T[]> {
  const responses: T[] = [];
  let next: Record<string, string> | undefined = {};
  while (next) {
    const data: T = await query({ ...params, ...next }, schema);
    responses.push(data);
    next = data.continue;
  }
  return responses;
}

const MembersSchema = z.object({
  query: z.object({ categorymembers: z.array(z.object({ ns: z.number(), title: z.string() })) }),
  continue: ContinueSchema,
});
type Member = z.infer<typeof MembersSchema>["query"]["categorymembers"][number];

async function members(query: WikiQuery, category: string): Promise<Member[]> {
  const responses = await queryAll(
    query,
    { list: "categorymembers", cmtitle: category, cmlimit: "500", cmtype: "page|subcat" },
    MembersSchema
  );
  return responses.flatMap((r) => r.query.categorymembers);
}

interface CrawlState {
  keyword: string;
  maxPages: number;
  /** Categories already queued or read — the root is in it from the start, so self-cycles end here. */
  seen: Set<string>;
  crawled: string[];
  pages: Set<string>;
  truncated: boolean;
}

function followable(state: CrawlState, title: string): boolean {
  return title.includes(state.keyword) && !SKIP_SUBCATEGORY.test(title) && !state.seen.has(title);
}

/** Adds one category's pages to the index and queues its followable subcategories onto `next`. */
function absorb(state: CrawlState, list: Member[], next: string[]): void {
  for (const m of list) {
    if (m.ns === NS_CATEGORY && followable(state, m.title)) {
      state.seen.add(m.title);
      next.push(m.title);
    } else if (m.ns === NS_MAIN && !state.pages.has(m.title)) {
      if (state.pages.size >= state.maxPages) {
        state.truncated = true;
        return;
      }
      state.pages.add(m.title);
    }
  }
}

/** Reads every category of one depth level; returns the next level's categories. */
async function crawlLevel(query: WikiQuery, state: CrawlState, frontier: string[]): Promise<string[]> {
  const next: string[] = [];
  for (const category of frontier) {
    if (state.truncated) break;
    state.crawled.push(category);
    absorb(state, await members(query, category), next);
  }
  return next;
}

export async function crawlRealmCategory(query: WikiQuery, opts: CrawlOptions): Promise<CrawlResult> {
  const maxDepth = opts.maxDepth ?? 5;
  const state: CrawlState = {
    keyword: opts.keyword,
    maxPages: opts.maxPages ?? 5000,
    seen: new Set([opts.rootCategory]),
    crawled: [],
    pages: new Set(),
    truncated: false,
  };
  let frontier = [opts.rootCategory];
  for (let depth = 0; depth <= maxDepth && frontier.length > 0 && !state.truncated; depth++) {
    frontier = await crawlLevel(query, state, frontier);
  }
  return {
    pages: [...state.pages].sort(),
    categoriesVisited: state.crawled,
    truncated: state.truncated || frontier.length > 0,
  };
}

const ContentSchema = z.object({
  query: z.object({
    pages: z.array(
      z.object({
        title: z.string(),
        revisions: z.array(z.object({ slots: z.object({ main: z.object({ content: z.string().optional() }) }) })).optional(),
      })
    ),
  }),
  continue: ContinueSchema,
});

const CONTENT_BATCH = 50;
const NATION_INFOBOX = /\{\{\s*infobox\s+(former\s+)?country\b/i;
const FIRST_HEADING = /^==/m;

/** The lead section is the text before the first heading. */
function isNationLead(content: string): boolean {
  const heading = content.search(FIRST_HEADING);
  return NATION_INFOBOX.test(heading === -1 ? content : content.slice(0, heading));
}

/** Titles whose lead section uses Infobox country / former country (content fetched in batches of 50). */
export async function detectNationTitles(query: WikiQuery, titles: string[]): Promise<Set<string>> {
  const nations = new Set<string>();
  for (let i = 0; i < titles.length; i += CONTENT_BATCH) {
    const batch = titles.slice(i, i + CONTENT_BATCH);
    // A batch too large for one response comes back in parts via rvcontinue; pages without content yet are skipped.
    const responses = await queryAll(
      query,
      { prop: "revisions", rvprop: "content", rvslots: "main", titles: batch.join("|") },
      ContentSchema
    );
    for (const page of responses.flatMap((r) => r.query.pages)) {
      if (isNationLead(page.revisions?.[0]?.slots.main.content ?? "")) nations.add(page.title);
    }
  }
  return nations;
}
