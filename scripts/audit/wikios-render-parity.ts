/**
 * scripts/audit/wikios-render-parity.ts — does WikiOS render a page like MediaWiki does?
 *
 * For every page it fetches MediaWiki's parse output and WikiOS's
 * `wikios.getArticleHtml` (notices + infobox + content HTML), reduces both to text, headings, links, images,
 * tables, infobox and references (see `normalizeHtml`) and scores the pair 0-100 (see `similarity`).
 * It reports per-page scores with the first differences in each direction, the aggregate (mean score and the
 * share of pages >= 98, >= 90 and < 70) and the templates that appear most often on the lowest-scoring
 * pages, which is where render fidelity breaks.
 *
 * A WikiOS view that is a locally compiled fallback (`renderQuality: "fallback"`) or a stale bundle
 * (`stale: true`) is not MediaWiki's render yet, so it is fetched again after `--settle-ms` (default 10000), at
 * most `--settle-tries` times (default 4): the window outlasts WikiOS's render-failure cool-down (see
 * `DEFAULT_SETTLE_TRIES`), so a page whose first render failed once is rendered again before it is scored. A scored page keeps the last view's `renderQuality` and `stale`; the
 * aggregate counts the scored pages still unsettled as `fallbackRenders`. A page that could not be scored has
 * an `error` and `failedOn` ("mediawiki" or "wikios"), the side that failed.
 *
 * With `--revisions <file>` (`{ "<title>": <rev id> }`, the MediaWiki revision WikiOS holds; the proof CLI writes it)
 * MediaWiki renders that revision (`action=parse&oldid=`), not the current page, so an edit on classic since WikiOS's
 * copy is not scored as a render difference. A revision MediaWiki refuses (deleted, or its text hidden) is corpus
 * drift: its error carries `nosuchrevid`. Before scoring, one batched `prop=revisions` request per 50 pages reads
 * each revision's content model, and a page whose revision is not wikitext (a `sanitized-css` page in the main
 * namespace, say) is left out of the sample: it is not an article. Without the file, the current page is parsed
 * (`action=parse&page=…&redirects=1`) and every page is scored.
 *
 * Usage:
 *   bun scripts/audit/wikios-render-parity.ts --mw-api <MediaWiki api.php URL> [--wikios http://localhost:3000] \
 *     [--pages scripts/bench/pages.default.json] [--sample N] [--out .bench-out/parity.json] [--interval-ms 1000] \
 *     [--settle-ms 10000] [--settle-tries 4] [--revisions corpus-revisions.json]
 *
 * `--mw-api` is required (there is no production default). Requests are throttled (>= 1 s per host,
 * IxStats-Builder User-Agent for ixwiki.com). The exit code is 0 unless the arguments or the page list are
 * invalid; the caller reads the numbers. Percentages are given over every requested page (a page that could
 * not be scored counts as < 70) and over the scored pages only.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { z } from "zod";
import {
  DEFAULT_SETTLE_MS,
  DEFAULT_SETTLE_TRIES,
  chunked,
  ensureParentDir,
  exitWithError,
  fetchUntilSettled,
  loadPageList,
  mean,
  mediaWikiParseError,
  mediaWikiParseQuery,
  missingFrom,
  needsSettling,
  normalizeHtml,
  parseHttpUrl,
  parseRevisionMap,
  parseTrpcData,
  revisionContentModels,
  samplePages,
  similarity,
  throttledFetch,
  trpcQueryUrl,
  type NormalizedDoc,
  type Parsed,
  type SimilarityScores,
} from "../lib/wikios-harness";

interface Config {
  mwApi: string;
  wikios: string;
  pages: string;
  sample: number | null;
  out: string;
  intervalMs: number;
  settleMs: number;
  settleTries: number;
  revisions: string | null;
}

interface Differences {
  linksMissingInWikios: string[];
  linksMissingInMediaWiki: string[];
  imagesMissingInWikios: string[];
  imagesMissingInMediaWiki: string[];
  headingsMissingInWikios: string[];
  headingsMissingInMediaWiki: string[];
}

type RenderQuality = "rendered" | "fallback";

interface PageResult {
  title: string;
  error?: string;
  /** The side that failed, set with `error`. */
  failedOn?: "mediawiki" | "wikios";
  /** The last WikiOS view's render state (scored pages). */
  renderQuality?: RenderQuality;
  stale?: boolean;
  scores?: SimilarityScores;
  templates: string[];
  differences?: Differences;
}

type ScoredPage = PageResult & { scores: SimilarityScores; differences: Differences };

interface TemplateRow {
  template: string;
  lowPages: number;
  allPages: number;
}

/** Percentages of pages by overall score. */
interface Shares {
  atLeast98: number;
  atLeast90: number;
  below70: number;
}

interface Aggregate {
  requested: number;
  scored: number;
  failed: number;
  /** Mean overall score of the scored pages, null when none was scored. */
  meanScore: number | null;
  /** Scored pages whose last WikiOS view still needed settling (a fallback or stale render). */
  fallbackRenders: number;
  /** Over every requested page: a page that could not be scored counts as < 70. */
  overRequested: Shares;
  scoredOnly: Shares | null;
  templatesOnLowestPages: TemplateRow[];
}

const DEFAULT_PAGES = fileURLToPath(new URL("../bench/pages.default.json", import.meta.url));
const DEFAULT_OUT = ".bench-out/parity.json";
const DIFF_LIMIT = 5;
const LOW_SCORE = 90;
const MIN_LOW_PAGES = 3;
const TEMPLATE_ROWS = 15;

const mwParseSchema = z.object({
  parse: z.object({
    text: z.string(),
    templates: z.array(z.object({ title: z.string() })).default([]),
  }),
});
const mwErrorSchema = z.object({ error: z.object({ code: z.string(), info: z.string() }) });
const articleSchema = z.object({
  contentHtml: z.string(),
  infoboxHtml: z.string().nullish(),
  noticesHtml: z.string().nullish(),
  renderQuality: z.enum(["rendered", "fallback"]).optional(),
  stale: z.boolean().optional(),
});

const USAGE =
  "Usage: bun scripts/audit/wikios-render-parity.ts --mw-api <api.php url> [--wikios <url>] [--pages file] [--sample n] [--out file] [--interval-ms n] [--settle-ms n] [--settle-tries n] [--revisions file]";

/** A non-negative integer option, or its default when it is absent. */
function nonNegativeInt(value: string | undefined, fallback: number, flag: string): number {
  const parsed = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) throw new Error(`${flag} must be a whole number >= 0`);
  return parsed;
}

function parseConfig(argv: string[]): Config {
  const { values } = parseArgs({
    args: argv,
    options: {
      "mw-api": { type: "string" },
      wikios: { type: "string" },
      pages: { type: "string" },
      sample: { type: "string" },
      out: { type: "string" },
      "interval-ms": { type: "string" },
      "settle-ms": { type: "string" },
      "settle-tries": { type: "string" },
      revisions: { type: "string" },
    },
  });
  const sample = values.sample === undefined ? null : Number.parseInt(values.sample, 10);
  const intervalMs = Number.parseInt(values["interval-ms"] ?? "1000", 10);
  if ((sample !== null && !(sample >= 1)) || !(intervalMs >= 0)) {
    throw new Error("--sample must be >= 1 and --interval-ms >= 0");
  }
  return {
    mwApi: parseHttpUrl(values["mw-api"], "--mw-api"),
    wikios: parseHttpUrl(values.wikios ?? "http://localhost:3000", "--wikios"),
    pages: values.pages ?? DEFAULT_PAGES,
    sample,
    out: values.out ?? DEFAULT_OUT,
    intervalMs,
    settleMs: nonNegativeInt(values["settle-ms"], DEFAULT_SETTLE_MS, "--settle-ms"),
    settleTries: nonNegativeInt(values["settle-tries"], DEFAULT_SETTLE_TRIES, "--settle-tries"),
    revisions: values.revisions ?? null,
  };
}

// ---------------------------------------------------------------------------
// Fetching
// ---------------------------------------------------------------------------

interface RenderedPage {
  html: string;
  templates: string[];
}

type Fetched<T> = { ok: true; value: T } | { ok: false; error: string };

interface WikiOsView {
  html: string;
  renderQuality?: RenderQuality;
  stale?: boolean;
}

/** MediaWiki's rendering of the revision WikiOS holds, else of the current page (see `mediaWikiParseQuery`). */
async function fetchMediaWiki(title: string, revid: number | undefined, config: Config): Promise<Fetched<RenderedPage>> {
  const params = new URLSearchParams(mediaWikiParseQuery(title, revid));
  const result = await throttledFetch(
    `${config.mwApi}?${params.toString()}`,
    { headers: { accept: "application/json" } },
    { minIntervalMs: config.intervalMs }
  );
  if (result.status !== 200) return { ok: false, error: `MediaWiki HTTP ${result.status} ${result.error ?? ""}`.trim() };
  let payload: unknown;
  try {
    payload = JSON.parse(result.body);
  } catch {
    return { ok: false, error: "MediaWiki response is not JSON" };
  }
  const parsed = mwParseSchema.safeParse(payload);
  if (parsed.success) {
    return { ok: true, value: { html: parsed.data.parse.text, templates: parsed.data.parse.templates.map((t) => t.title) } };
  }
  const failure = mwErrorSchema.safeParse(payload);
  if (!failure.success) return { ok: false, error: "MediaWiki: unexpected parse response" };
  // The code (e.g. "missingtitle") names a page missing on MediaWiki, whose info says "doesn't exist".
  const { code, info } = failure.data.error;
  return { ok: false, error: mediaWikiParseError(code, info, revid) };
}

/** Rev ids per `prop=revisions` request (the API's limit for a client without apihighlimits). */
const REVIDS_PER_REQUEST = 50;

/**
 * The titles whose held revision is not wikitext, with its content model. A batch MediaWiki does not answer leaves
 * its pages in (they are scored, and a revision it refuses shows up then as drift).
 */
async function nonWikitextPages(
  titles: readonly string[],
  revisions: ReadonlyMap<string, number>,
  config: Config
): Promise<Map<string, string>> {
  const byRevid = new Map(
    titles.flatMap((title) => {
      const revid = revisions.get(title);
      return revid === undefined ? [] : [[revid, title] as const];
    })
  );
  const leftOut = new Map<string, string>();
  for (const batch of chunked([...byRevid.keys()], REVIDS_PER_REQUEST)) {
    const params = new URLSearchParams({
      action: "query",
      prop: "revisions",
      revids: batch.join("|"),
      rvprop: "ids|contentmodel",
      rvslots: "main",
      formatversion: "2",
      format: "json",
    });
    const result = await throttledFetch(
      `${config.mwApi}?${params.toString()}`,
      { headers: { accept: "application/json" } },
      { minIntervalMs: config.intervalMs }
    );
    if (result.status !== 200) continue;
    for (const [revid, model] of revisionContentModels(result.body)) {
      const title = byRevid.get(revid);
      if (title !== undefined && model !== "wikitext") leftOut.set(title, model);
    }
  }
  return leftOut;
}

/** One `wikios.getArticleHtml` call: notices, infobox and content HTML in page order, with the render state. */
async function fetchWikiOsOnce(title: string, config: Config): Promise<Parsed<WikiOsView>> {
  const result = await throttledFetch(
    trpcQueryUrl(config.wikios, "wikios.getArticleHtml", { title }),
    { headers: { accept: "application/json" } },
    { minIntervalMs: config.intervalMs }
  );
  if (result.status === 0) return { ok: false, error: `WikiOS unreachable: ${result.error ?? ""}`.trim() };
  const parsed = parseTrpcData(result.body, articleSchema);
  if (!parsed.ok) return { ok: false, error: `WikiOS HTTP ${result.status}: ${parsed.error}` };
  const { noticesHtml, infoboxHtml, contentHtml, renderQuality, stale } = parsed.data;
  const html = [noticesHtml, infoboxHtml, contentHtml].filter(Boolean).join("\n");
  return { ok: true, data: { html, renderQuality, stale } };
}

/** WikiOS's rendering, refetched while it is a fallback or stale view (see the header). */
async function fetchWikiOs(title: string, config: Config): Promise<Fetched<WikiOsView>> {
  const result = await fetchUntilSettled(() => fetchWikiOsOnce(title, config), config);
  return result.ok ? { ok: true, value: result.data } : result;
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

function differences(mediawiki: NormalizedDoc, wikios: NormalizedDoc): Differences {
  return {
    linksMissingInWikios: missingFrom(mediawiki.links, wikios.links, DIFF_LIMIT),
    linksMissingInMediaWiki: missingFrom(wikios.links, mediawiki.links, DIFF_LIMIT),
    imagesMissingInWikios: missingFrom(mediawiki.images, wikios.images, DIFF_LIMIT),
    imagesMissingInMediaWiki: missingFrom(wikios.images, mediawiki.images, DIFF_LIMIT),
    headingsMissingInWikios: missingFrom(mediawiki.headings, wikios.headings, DIFF_LIMIT),
    headingsMissingInMediaWiki: missingFrom(wikios.headings, mediawiki.headings, DIFF_LIMIT),
  };
}

async function scorePage(title: string, revid: number | undefined, config: Config): Promise<PageResult> {
  const mediawiki = await fetchMediaWiki(title, revid, config);
  if (!mediawiki.ok) return { title, error: mediawiki.error, failedOn: "mediawiki", templates: [] };
  const wikios = await fetchWikiOs(title, config);
  if (!wikios.ok) return { title, error: wikios.error, failedOn: "wikios", templates: mediawiki.value.templates };
  const mw = normalizeHtml(mediawiki.value.html);
  const os = normalizeHtml(wikios.value.html);
  return {
    title,
    renderQuality: wikios.value.renderQuality,
    stale: wikios.value.stale,
    scores: similarity(mw, os),
    templates: mediawiki.value.templates,
    differences: differences(mw, os),
  };
}

const isScored = (page: PageResult): page is ScoredPage => page.scores !== undefined && page.differences !== undefined;

const percentOf = (count: number, whole: number): number => (whole === 0 ? 0 : (count / whole) * 100);

/** Shares of `scored` pages over `denominator` pages; `unscored` pages are added to the "< 70" bucket. */
function shares(scored: ScoredPage[], denominator: number, unscored: number): Shares {
  const atLeast = (threshold: number): number =>
    percentOf(scored.filter((page) => page.scores.overall >= threshold).length, denominator);
  const below70 = scored.filter((page) => page.scores.overall < 70).length + unscored;
  return { atLeast98: atLeast(98), atLeast90: atLeast(90), below70: percentOf(below70, denominator) };
}

/** The pages to explain: everything under LOW_SCORE, or at least the MIN_LOW_PAGES lowest. */
function lowScoringPages(scored: ScoredPage[]): ScoredPage[] {
  const ascending = [...scored].sort((a, b) => a.scores.overall - b.scores.overall);
  const below = ascending.filter((page) => page.scores.overall < LOW_SCORE);
  return below.length >= MIN_LOW_PAGES ? below : ascending.slice(0, MIN_LOW_PAGES);
}

function countTemplates(pages: ScoredPage[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const page of pages) {
    for (const template of new Set(page.templates)) counts.set(template, (counts.get(template) ?? 0) + 1);
  }
  return counts;
}

function templateRows(scored: ScoredPage[]): TemplateRow[] {
  const low = countTemplates(lowScoringPages(scored));
  const all = countTemplates(scored);
  return [...low]
    .map(([template, lowPages]) => ({ template, lowPages, allPages: all.get(template) ?? 0 }))
    .sort((a, b) => b.lowPages - a.lowPages || a.allPages - b.allPages)
    .slice(0, TEMPLATE_ROWS);
}

function aggregate(results: PageResult[]): Aggregate {
  const scored = results.filter(isScored);
  const failed = results.length - scored.length;
  return {
    requested: results.length,
    scored: scored.length,
    failed,
    meanScore: scored.length === 0 ? null : mean(scored.map((page) => page.scores.overall)),
    fallbackRenders: scored.filter(needsSettling).length,
    overRequested: shares(scored, results.length, failed),
    scoredOnly: scored.length === 0 ? null : shares(scored, scored.length, 0),
    templatesOnLowestPages: scored.length === 0 ? [] : templateRows(scored),
  };
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

const fixed = (value: number | null): string => (value === null ? "n/a" : value.toFixed(1));

function listLine(label: string, items: string[]): string | null {
  return items.length === 0 ? null : `    ${label}: ${items.join("; ")}`;
}

function renderPage(page: ScoredPage): string {
  const { scores, differences: diff } = page;
  const header = `${fixed(scores.overall).padStart(5)}  ${page.title}  (text ${fixed(scores.text)}, links ${fixed(scores.links)}, images ${fixed(scores.images)}, headings ${fixed(scores.headings)}, structure ${fixed(scores.structure)}; n/a = empty on both sides, not compared)`;
  return [
    needsSettling(page) ? `${header}  [still a fallback or stale render after settling]` : header,
    listLine("links missing in WikiOS", diff.linksMissingInWikios),
    listLine("links only in WikiOS", diff.linksMissingInMediaWiki),
    listLine("images missing in WikiOS", diff.imagesMissingInWikios),
    listLine("images only in WikiOS", diff.imagesMissingInMediaWiki),
    listLine("headings missing in WikiOS", diff.headingsMissingInWikios),
    listLine("headings only in WikiOS", diff.headingsMissingInMediaWiki),
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

const renderShares = (label: string, value: Shares): string =>
  `${label}: >= 98 ${fixed(value.atLeast98)}%, >= 90 ${fixed(value.atLeast90)}%, < 70 ${fixed(value.below70)}%`;

function renderReport(results: PageResult[], config: Config): string {
  const scored = results.filter(isScored);
  const total = aggregate(results);
  const lines = [`# WikiOS render parity — ${results.length} pages`, "", `MediaWiki: ${config.mwApi}   WikiOS: ${config.wikios}`, ""];
  lines.push("## Pages (lowest first)", "");
  lines.push(...[...scored].sort((a, b) => a.scores.overall - b.scores.overall).map(renderPage));
  for (const page of results.filter((result) => !isScored(result))) {
    lines.push(`  n/a  ${page.title}  (failed on ${page.failedOn}: ${page.error})`);
  }
  lines.push("", "## Aggregate", "");
  lines.push(`Requested pages: ${total.requested}; scored: ${total.scored}; failed: ${total.failed}`);
  lines.push(renderShares("Over all requested pages (failed count as < 70)", total.overRequested));
  if (total.scoredOnly !== null) lines.push(renderShares("Scored pages only", total.scoredOnly));
  lines.push(`Mean score (scored pages): ${fixed(total.meanScore)}`);
  lines.push(`Fallback or stale renders after settling (scored pages): ${total.fallbackRenders}`);
  if (scored.length > 0) {
    lines.push("", "## Templates on the lowest-scoring pages", "");
    lines.push(...total.templatesOnLowestPages.map((row) => `${row.lowPages} low / ${row.allPages} all  ${row.template}`));
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  let config: Config;
  try {
    config = parseConfig(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error(USAGE);
    process.exit(1);
  }
  const all = loadPageList(config.pages);
  const sampled = config.sample === null ? all : samplePages(all, config.sample);
  const revisions =
    config.revisions === null ? new Map<string, number>() : parseRevisionMap(readFileSync(config.revisions, "utf8"));
  const leftOut = revisions.size > 0 ? await nonWikitextPages(sampled, revisions, config) : new Map<string, string>();
  const titles = sampled.filter((title) => !leftOut.has(title));
  const comparedByRevision = titles.filter((title) => revisions.has(title)).length;
  const results: PageResult[] = [];
  for (const [index, title] of titles.entries()) {
    console.error(`[${index + 1}/${titles.length}] ${title}`);
    results.push(await scorePage(title, revisions.get(title), config));
  }
  const notArticles = [...leftOut].map(([title, contentModel]) => ({ title, contentModel }));
  ensureParentDir(config.out);
  writeFileSync(
    config.out,
    JSON.stringify(
      {
        meta: { ...config, titles, comparedByRevision, leftOut: notArticles, generatedAt: new Date().toISOString() },
        pages: results,
        aggregate: aggregate(results),
      },
      null,
      2
    )
  );
  console.log(renderReport(results, config));
  console.log(`\nCompared by revision (the one WikiOS holds): ${comparedByRevision} of ${titles.length} pages`);
  const drift = results.filter((page) => page.error?.includes("nosuchrevid")).length;
  console.log(`Drift (the revision is gone or hidden on MediaWiki): ${drift}`);
  console.log(`Left out, not wikitext: ${notArticles.length}`);
  for (const page of notArticles) console.log(`  ${page.title} (${page.contentModel})`);
  console.log(`\nFull results written to ${config.out}`);
}

main().catch(exitWithError);
