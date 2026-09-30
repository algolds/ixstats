/**
 * scripts/audit/wikios-roundtrip.ts — is the visual editor's wikitext round trip lossless?
 *
 * Runs the pipeline the visual editor really uses (PlateWikiEditor.tsx loads with
 * `wikitextToAst` -> `astToPlateNodes`; WikiVisualEditor.tsx saves with `serializePlateToWikitext`) over
 * each page's wikitext WITHOUT any edit and compares the output with the input. Pages that are not
 * byte-identical get a line diff (first 30 changed lines) and every changed line is classified by construct
 * (template, file, link, table, list, heading, bold/italic, ref, html, blank, other).
 *
 * Only the pure converter functions are used; Plate's runtime plugins and Slate normalisation are not
 * applied, so the numbers are the converters' own loss.
 *
 * Sources:
 *   --source db   (default) `wiki_articles.wikitext` of the local Postgres, read-only, and only when
 *                 DATABASE_URL points at localhost.
 *   --source mw   `action=query&prop=revisions&rvprop=content&rvslots=main` from --mw-api, throttled.
 *
 * Usage:
 *   bun scripts/audit/wikios-roundtrip.ts [--source db|mw] [--mw-api https://ixwiki.com/api.php]
 *     [--pages file.json | --limit N] [--out roundtrip.json] [--interval-ms 1000]
 *
 * `--limit N` (default 50) takes N pages spread evenly over the source. Exit code is 0 unless the arguments
 * or the source are invalid; the caller reads the numbers.
 */

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import dotenv from "dotenv";
import { z } from "zod";
import { serializePlateToWikitext } from "../../src/components/wiki-os/editor/plate/wiki-wikitext";
import { astToPlateNodes, wikitextToAst } from "../../src/lib/wiki-os/transformers/wiki-ast-converter";
import {
  CONSTRUCTS,
  classifyLine,
  isLocalDatabaseUrl,
  lineDiff,
  loadPageList,
  samplePages,
  throttledFetch,
  type Construct,
  type DiffLine,
} from "../lib/wikios-harness";

type Source = "db" | "mw";

interface Config {
  source: Source;
  mwApi: string;
  pages: string | null;
  limit: number;
  out: string;
  intervalMs: number;
}

interface PageInput {
  title: string;
  wikitext: string;
}

interface ConstructCount {
  removed: number;
  added: number;
}

interface PageReport {
  title: string;
  inputBytes: number;
  outputBytes: number;
  identical: boolean;
  /** Identical once leading and trailing whitespace is ignored (the serializer trims its output). */
  identicalTrimmed: boolean;
  parseConfidence: "full" | "partial";
  /** `complete` flag of the serializer: false when a block had no canonical wikitext. */
  complete: boolean;
  changedLines: number;
  constructs: Partial<Record<Construct, ConstructCount>>;
  diffPreview: string[];
  error?: string;
}

const DEFAULT_PAGES = fileURLToPath(new URL("../bench/pages.default.json", import.meta.url));
const DIFF_PREVIEW_LINES = 30;
const DIFF_LINE_WIDTH = 140;

const mwContentSchema = z.object({
  query: z.object({
    pages: z.array(
      z.object({
        title: z.string(),
        missing: z.boolean().optional(),
        revisions: z.array(z.object({ slots: z.object({ main: z.object({ content: z.string() }) }) })).optional(),
      })
    ),
  }),
});

const USAGE =
  "Usage: bun scripts/audit/wikios-roundtrip.ts [--source db|mw] [--mw-api url] [--pages file | --limit n] [--out file] [--interval-ms n]";

function parseConfig(argv: string[]): Config {
  const { values } = parseArgs({
    args: argv,
    options: {
      source: { type: "string" },
      "mw-api": { type: "string" },
      pages: { type: "string" },
      limit: { type: "string" },
      out: { type: "string" },
      "interval-ms": { type: "string" },
    },
  });
  const source = values.source ?? "db";
  const limit = Number.parseInt(values.limit ?? "50", 10);
  const intervalMs = Number.parseInt(values["interval-ms"] ?? "1000", 10);
  if (source !== "db" && source !== "mw") throw new Error("--source must be db or mw");
  if (!(limit >= 1) || !(intervalMs >= 0)) throw new Error("--limit must be >= 1 and --interval-ms >= 0");
  return {
    source,
    mwApi: values["mw-api"] ?? "https://ixwiki.com/api.php",
    pages: values.pages ?? null,
    limit,
    out: values.out ?? "roundtrip.json",
    intervalMs,
  };
}

// ---------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------

/** Reads wikitext from the local database only. Never writes. */
async function loadFromDb(config: Config): Promise<PageInput[]> {
  dotenv.config({ path: ".env.local.dev" });
  dotenv.config({ path: ".env.local" });
  dotenv.config({ path: ".env" });
  const databaseUrl = process.env.DATABASE_URL ?? "";
  if (!isLocalDatabaseUrl(databaseUrl)) {
    throw new Error("DATABASE_URL does not point at localhost; refusing to read it. Use --source mw instead.");
  }
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  try {
    if (config.pages !== null) {
      const titles = loadPageList(config.pages);
      const variants = [...new Set(titles.flatMap((title) => [title, title.replace(/ /g, "_")]))];
      return await prisma.wikiArticle.findMany({
        where: { source: "ixwiki", title: { in: variants } },
        select: { title: true, wikitext: true },
        orderBy: { title: "asc" },
      });
    }
    const all = await prisma.wikiArticle.findMany({
      where: { source: "ixwiki", namespace: 0 },
      select: { id: true },
      orderBy: { title: "asc" },
    });
    return await prisma.wikiArticle.findMany({
      where: { id: { in: samplePages(all.map((row) => row.id), config.limit) } },
      select: { title: true, wikitext: true },
      orderBy: { title: "asc" },
    });
  } finally {
    await prisma.$disconnect();
  }
}

async function fetchMwWikitext(title: string, config: Config): Promise<PageInput | null> {
  const params = new URLSearchParams({
    action: "query",
    prop: "revisions",
    rvprop: "content",
    rvslots: "main",
    titles: title,
    formatversion: "2",
    format: "json",
  });
  const result = await throttledFetch(
    `${config.mwApi}?${params.toString()}`,
    { headers: { accept: "application/json" } },
    { minIntervalMs: config.intervalMs }
  );
  if (result.status !== 200) {
    console.error(`  ${title}: HTTP ${result.status} ${result.error ?? ""}`.trimEnd());
    return null;
  }
  let payload: unknown;
  try {
    payload = JSON.parse(result.body);
  } catch {
    console.error(`  ${title}: response is not JSON`);
    return null;
  }
  const parsed = mwContentSchema.safeParse(payload);
  const content = parsed.success ? parsed.data.query.pages[0]?.revisions?.[0]?.slots.main.content : undefined;
  if (content === undefined) {
    console.error(`  ${title}: no wikitext returned`);
    return null;
  }
  return { title, wikitext: content };
}

async function loadFromMw(config: Config): Promise<PageInput[]> {
  const listed = loadPageList(config.pages ?? DEFAULT_PAGES);
  const titles = config.pages === null ? samplePages(listed, config.limit) : listed;
  const pages: PageInput[] = [];
  for (const title of titles) {
    console.error(`fetching ${title}`);
    const page = await fetchMwWikitext(title, config);
    if (page !== null) pages.push(page);
  }
  return pages;
}

// ---------------------------------------------------------------------------
// Round trip
// ---------------------------------------------------------------------------

function formatDiffLine(change: DiffLine): string {
  return `${change.kind} ${String(change.lineNo).padStart(5)}: ${change.line.slice(0, DIFF_LINE_WIDTH)}`;
}

function countConstructs(changes: DiffLine[]): Partial<Record<Construct, ConstructCount>> {
  const counts: Partial<Record<Construct, ConstructCount>> = {};
  for (const change of changes) {
    const construct = classifyLine(change.line);
    const entry = counts[construct] ?? { removed: 0, added: 0 };
    if (change.kind === "-") entry.removed += 1;
    else entry.added += 1;
    counts[construct] = entry;
  }
  return counts;
}

/** The visual editor's load and save, with no edit in between. */
function roundTrip(wikitext: string): { output: string; complete: boolean; parseConfidence: "full" | "partial" } {
  const ast = wikitextToAst(wikitext);
  const serialized = serializePlateToWikitext(astToPlateNodes(ast));
  return { output: serialized.wikitext, complete: serialized.complete, parseConfidence: ast.parseConfidence };
}

function reportPage(page: PageInput): PageReport {
  const inputBytes = Buffer.byteLength(page.wikitext);
  try {
    const { output, complete, parseConfidence } = roundTrip(page.wikitext);
    const identical = output === page.wikitext;
    const changes = identical ? [] : lineDiff(page.wikitext, output);
    return {
      title: page.title,
      inputBytes,
      outputBytes: Buffer.byteLength(output),
      identical,
      identicalTrimmed: output.trim() === page.wikitext.trim(),
      parseConfidence,
      complete,
      changedLines: changes.length,
      constructs: countConstructs(changes),
      diffPreview: changes.slice(0, DIFF_PREVIEW_LINES).map(formatDiffLine),
    };
  } catch (error) {
    return {
      title: page.title,
      inputBytes,
      outputBytes: 0,
      identical: false,
      identicalTrimmed: false,
      parseConfidence: "partial",
      complete: false,
      changedLines: 0,
      constructs: {},
      diffPreview: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

const percent = (part: number, whole: number): string => (whole === 0 ? "n/a" : `${((part / whole) * 100).toFixed(1)}%`);

function renderPage(report: PageReport): string {
  if (report.error !== undefined) return `ERROR ${report.title}: ${report.error}`;
  if (report.identical) return `OK    ${report.title}`;
  const flags = [
    report.identicalTrimmed ? "whitespace-only at the ends" : null,
    report.parseConfidence === "partial" ? "parse partial" : null,
    report.complete ? null : "serializer incomplete",
  ].filter((flag): flag is string => flag !== null);
  const header = `DIFF  ${report.title}  (${report.inputBytes} -> ${report.outputBytes} bytes, ${report.changedLines} changed lines${flags.length > 0 ? `; ${flags.join(", ")}` : ""})`;
  return [header, ...report.diffPreview.map((line) => `      ${line}`)].join("\n");
}

function renderAggregate(reports: PageReport[]): string {
  const measured = reports.filter((report) => report.error === undefined);
  const count = (predicate: (report: PageReport) => boolean): number => measured.filter(predicate).length;
  const removed = (c: Construct): number => measured.reduce((sum, report) => sum + (report.constructs[c]?.removed ?? 0), 0);
  const added = (c: Construct): number => measured.reduce((sum, report) => sum + (report.constructs[c]?.added ?? 0), 0);
  const lines = [
    "## Aggregate",
    "",
    `Pages: ${reports.length} (pipeline errors: ${reports.length - measured.length})`,
    `Byte-identical: ${count((r) => r.identical)}/${measured.length} (${percent(count((r) => r.identical), measured.length)})`,
    `Identical ignoring leading/trailing whitespace: ${count((r) => r.identicalTrimmed)}/${measured.length} (${percent(count((r) => r.identicalTrimmed), measured.length)})`,
    `Parse confidence partial: ${count((r) => r.parseConfidence === "partial")} pages`,
    `Serializer incomplete: ${count((r) => !r.complete)} pages`,
    `Changed lines: ${measured.reduce((sum, r) => sum + r.changedLines, 0)}`,
    "Changed lines by construct (removed from input / added in output, pages affected):",
  ];
  for (const construct of CONSTRUCTS) {
    const pages = count((r) => r.constructs[construct] !== undefined);
    if (pages > 0) lines.push(`  ${construct.padEnd(12)} -${removed(construct)} / +${added(construct)}  on ${pages} pages`);
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
  let pages: PageInput[];
  try {
    pages = config.source === "db" ? await loadFromDb(config) : await loadFromMw(config);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
  const reports = pages.filter((page) => page.wikitext.trim() !== "").map(reportPage);
  console.log(`# WikiOS wikitext round trip — ${reports.length} pages from ${config.source}\n`);
  for (const report of reports) console.log(renderPage(report));
  console.log(`\n${renderAggregate(reports)}`);
  writeFileSync(config.out, JSON.stringify({ meta: { ...config, generatedAt: new Date().toISOString() }, pages: reports }, null, 2));
  console.log(`\nFull results written to ${config.out}`);
}

void main();
