/**
 * scripts/audit/wikios-render-parity.ts — does WikiOS render a page like MediaWiki does?
 *
 * For every page it fetches MediaWiki's parse output (`action=parse&page=`) and WikiOS's
 * `wikios.getArticleHtml` (notices + infobox + content HTML), reduces both to text, headings, links, images,
 * tables, infobox and references (see `normalizeHtml`) and scores the pair 0-100 (see `similarity`).
 * It reports per-page scores with the first differences in each direction, the aggregate (mean score and the
 * share of pages >= 98, >= 90 and < 70) and the templates that appear most often on the lowest-scoring
 * pages, which is where render fidelity breaks.
 *
 * Usage:
 *   bun scripts/audit/wikios-render-parity.ts --mw-api <MediaWiki api.php URL> [--wikios http://localhost:3000] \
 *     [--pages scripts/bench/pages.default.json] [--sample N] [--out .bench-out/parity.json] [--interval-ms 1000]
 *
 * `--mw-api` is required (there is no production default). Requests are throttled (>= 1 s per host,
 * IxStats-Builder User-Agent for ixwiki.com). The exit code is 0 unless the arguments or the page list are
 * invalid; the caller reads the numbers. Percentages are given over every requested page (a page that could
 * not be scored counts as < 70) and over the scored pages only.
 */

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { z } from "zod";
import {
  ensureParentDir,
  exitWithError,
  loadPageList,
  mean,
  missingFrom,
  normalizeHtml,
  parseHttpUrl,
  parseTrpcData,
  samplePages,
  similarity,
  throttledFetch,
  trpcQueryUrl,
  type NormalizedDoc,
  type SimilarityScores,
} from "../lib/wikios-harness";

interface Config {
  mwApi: string;
  wikios: string;
  pages: string;
  sample: number | null;
  out: string;
  intervalMs: number;
}

interface Differences {
  linksMissingInWikios: string[];
  linksMissingInMediaWiki: string[];
  imagesMissingInWikios: string[];
  imagesMissingInMediaWiki: string[];
  headingsMissingInWikios: string[];
  headingsMissingInMediaWiki: string[];
}

interface PageResult {
  title: string;
  error?: string;
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
const mwErrorSchema = z.object({ error: z.object({ info: z.string() }) });
const articleSchema = z.object({
  contentHtml: z.string(),
  infoboxHtml: z.string().nullish(),
  noticesHtml: z.string().nullish(),
});

const USAGE =
  "Usage: bun scripts/audit/wikios-render-parity.ts --mw-api <api.php url> [--wikios <url>] [--pages file] [--sample n] [--out file] [--interval-ms n]";

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

/** MediaWiki's rendering of a page. `redirects=1` follows redirect pages, as WikiOS does when it resolves a title. */
async function fetchMediaWiki(title: string, config: Config): Promise<Fetched<RenderedPage>> {
  const params = new URLSearchParams({
    action: "parse",
    page: title,
    prop: "text|categories|templates|images|displaytitle",
    formatversion: "2",
    format: "json",
    disableeditsection: "1",
    redirects: "1",
  });
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
  return { ok: false, error: `MediaWiki: ${failure.success ? failure.data.error.info : "unexpected parse response"}` };
}

/** WikiOS's rendering: notices, infobox and content HTML from `wikios.getArticleHtml`, in page order. */
async function fetchWikiOs(title: string, config: Config): Promise<Fetched<string>> {
  const result = await throttledFetch(
    trpcQueryUrl(config.wikios, "wikios.getArticleHtml", { title }),
    { headers: { accept: "application/json" } },
    { minIntervalMs: config.intervalMs }
  );
  if (result.status === 0) return { ok: false, error: `WikiOS unreachable: ${result.error ?? ""}`.trim() };
  const parsed = parseTrpcData(result.body, articleSchema);
  if (!parsed.ok) return { ok: false, error: `WikiOS HTTP ${result.status}: ${parsed.error}` };
  const { noticesHtml, infoboxHtml, contentHtml } = parsed.data;
  return { ok: true, value: [noticesHtml, infoboxHtml, contentHtml].filter(Boolean).join("\n") };
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

async function scorePage(title: string, config: Config): Promise<PageResult> {
  const mediawiki = await fetchMediaWiki(title, config);
  if (!mediawiki.ok) return { title, error: mediawiki.error, templates: [] };
  const wikios = await fetchWikiOs(title, config);
  if (!wikios.ok) return { title, error: wikios.error, templates: mediawiki.value.templates };
  const mw = normalizeHtml(mediawiki.value.html);
  const os = normalizeHtml(wikios.value);
  return {
    title,
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
    header,
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
  for (const page of results.filter((result) => !isScored(result))) lines.push(`  n/a  ${page.title}  (${page.error})`);
  lines.push("", "## Aggregate", "");
  lines.push(`Requested pages: ${total.requested}; scored: ${total.scored}; failed: ${total.failed}`);
  lines.push(renderShares("Over all requested pages (failed count as < 70)", total.overRequested));
  if (total.scoredOnly !== null) lines.push(renderShares("Scored pages only", total.scoredOnly));
  lines.push(`Mean score (scored pages): ${fixed(total.meanScore)}`);
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
  const titles = config.sample === null ? all : samplePages(all, config.sample);
  const results: PageResult[] = [];
  for (const [index, title] of titles.entries()) {
    console.error(`[${index + 1}/${titles.length}] ${title}`);
    results.push(await scorePage(title, config));
  }
  ensureParentDir(config.out);
  writeFileSync(
    config.out,
    JSON.stringify(
      { meta: { ...config, titles, generatedAt: new Date().toISOString() }, pages: results, aggregate: aggregate(results) },
      null,
      2
    )
  );
  console.log(renderReport(results, config));
  console.log(`\nFull results written to ${config.out}`);
}

main().catch(exitWithError);
