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
 *   bun scripts/audit/wikios-roundtrip.ts [--source db|mw] [--mw-api <MediaWiki api.php URL>]
 *     [--pages file.json | --limit N] [--out .bench-out/roundtrip.json] [--interval-ms 1000]
 *
 * `--mw-api` is required with `--source mw` (there is no production default). `--limit N` (default 50) takes
 * N pages spread evenly over the source. Pages that cannot be measured (not found, empty, fetch failed) are
 * counted as skipped with their reason. Exit code is 0 unless the arguments or the source are invalid; the
 * caller reads the numbers.
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
  ensureParentDir,
  exitWithError,
  isLocalDatabaseUrl,
  lineDiff,
  loadPageList,
  parseHttpUrl,
  samplePages,
  throttledFetch,
  type Construct,
  type DiffLine,
} from "../lib/wikios-harness";

interface CommonConfig {
  pages: string | null;
  limit: number;
  out: string;
  intervalMs: number;
}

type DbConfig = CommonConfig & { source: "db" };
type MwConfig = CommonConfig & { source: "mw"; mwApi: string };
type Config = DbConfig | MwConfig;

interface PageInput {
  title: string;
  wikitext: string;
}

interface Skipped {
  title: string;
  reason: string;
}

interface Loaded {
  pages: PageInput[];
  skipped: Skipped[];
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
  /** True when the diff hit the LCS cap, so its changed-line counts are an upper bound. */
  diffTruncated: boolean;
  constructs: Partial<Record<Construct, ConstructCount>>;
  diffPreview: string[];
  error?: string;
}

const DEFAULT_OUT = ".bench-out/roundtrip.json";
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
  "Usage: bun scripts/audit/wikios-roundtrip.ts [--source db|mw] [--mw-api url (required for mw)] [--pages file | --limit n] [--out file] [--interval-ms n]";

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
  const common = { pages: values.pages ?? null, limit, out: values.out ?? DEFAULT_OUT, intervalMs };
  if (source === "db") return { ...common, source };
  return { ...common, source, mwApi: parseHttpUrl(values["mw-api"], "--mw-api") };
}

// ---------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------

const sameTitle = (title: string): string => title.replace(/_/g, " ").trim();

/** Reads wikitext from the local database only. Never writes. */
async function loadFromDb(config: DbConfig): Promise<Loaded> {
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
      const pages = await prisma.wikiArticle.findMany({
        where: { source: "ixwiki", title: { in: variants } },
        select: { title: true, wikitext: true },
        orderBy: { title: "asc" },
      });
      const found = new Set(pages.map((page) => sameTitle(page.title)));
      const skipped = titles
        .filter((title) => !found.has(sameTitle(title)))
        .map((title) => ({ title, reason: "not found in the database" }));
      return { pages, skipped };
    }
    const all = await prisma.wikiArticle.findMany({
      where: { source: "ixwiki", namespace: 0 },
      select: { id: true },
      orderBy: { title: "asc" },
    });
    const pages = await prisma.wikiArticle.findMany({
      where: { id: { in: samplePages(all.map((row) => row.id), config.limit) } },
      select: { title: true, wikitext: true },
      orderBy: { title: "asc" },
    });
    return { pages, skipped: [] };
  } finally {
    await prisma.$disconnect();
  }
}

type MwFetch = { ok: true; page: PageInput } | { ok: false; reason: string };

async function fetchMwWikitext(title: string, config: MwConfig): Promise<MwFetch> {
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
  if (result.status !== 200) return { ok: false, reason: `fetch failed: HTTP ${result.status} ${result.error ?? ""}`.trim() };
  let payload: unknown;
  try {
    payload = JSON.parse(result.body);
  } catch {
    return { ok: false, reason: "fetch failed: response is not JSON" };
  }
  const parsed = mwContentSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, reason: "fetch failed: unexpected response shape" };
  const page = parsed.data.query.pages[0];
  const content = page?.revisions?.[0]?.slots.main.content;
  if (content === undefined) return { ok: false, reason: page?.missing ? "page does not exist on MediaWiki" : "no wikitext returned" };
  return { ok: true, page: { title, wikitext: content } };
}

async function loadFromMw(config: MwConfig): Promise<Loaded> {
  const listed = loadPageList(config.pages ?? DEFAULT_PAGES);
  const titles = config.pages === null ? samplePages(listed, config.limit) : listed;
  const loaded: Loaded = { pages: [], skipped: [] };
  for (const title of titles) {
    console.error(`fetching ${title}`);
    const fetched = await fetchMwWikitext(title, config);
    if (fetched.ok) loaded.pages.push(fetched.page);
    else loaded.skipped.push({ title, reason: fetched.reason });
  }
  return loaded;
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
    const { changes, truncated } = identical ? { changes: [], truncated: false } : lineDiff(page.wikitext, output);
    return {
      title: page.title,
      inputBytes,
      outputBytes: Buffer.byteLength(output),
      identical,
      identicalTrimmed: output.trim() === page.wikitext.trim(),
      parseConfidence,
      complete,
      changedLines: changes.length,
      diffTruncated: truncated,
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
      diffTruncated: false,
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
    report.diffTruncated ? "diff truncated (LCS cap)" : null,
  ].filter((flag): flag is string => flag !== null);
  const header = `DIFF  ${report.title}  (${report.inputBytes} -> ${report.outputBytes} bytes, ${report.changedLines} changed lines${flags.length > 0 ? `; ${flags.join(", ")}` : ""})`;
  return [header, ...report.diffPreview.map((line) => `      ${line}`)].join("\n");
}

function renderSkipped(skipped: Skipped[]): string[] {
  const reasons = new Map<string, number>();
  for (const { reason } of skipped) reasons.set(reason, (reasons.get(reason) ?? 0) + 1);
  return [`Skipped (not measured): ${skipped.length}`, ...[...reasons].map(([reason, n]) => `  ${reason}: ${n}`)];
}

function renderAggregate(reports: PageReport[], skipped: Skipped[]): string {
  const measured = reports.filter((report) => report.error === undefined);
  const count = (predicate: (report: PageReport) => boolean): number => measured.filter(predicate).length;
  const removed = (c: Construct): number => measured.reduce((sum, report) => sum + (report.constructs[c]?.removed ?? 0), 0);
  const added = (c: Construct): number => measured.reduce((sum, report) => sum + (report.constructs[c]?.added ?? 0), 0);
  const lines = [
    "## Aggregate",
    "",
    `Pages: ${reports.length} (pipeline errors: ${reports.length - measured.length})`,
    ...renderSkipped(skipped),
    `Byte-identical: ${count((r) => r.identical)}/${measured.length} (${percent(count((r) => r.identical), measured.length)})`,
    `Identical ignoring leading/trailing whitespace: ${count((r) => r.identicalTrimmed)}/${measured.length} (${percent(count((r) => r.identicalTrimmed), measured.length)})`,
    `Parse confidence partial: ${count((r) => r.parseConfidence === "partial")} pages`,
    `Serializer incomplete: ${count((r) => !r.complete)} pages`,
    `Diff truncated (LCS cap hit, changed-line counts are upper bounds): ${count((r) => r.diffTruncated)} pages`,
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
  const loaded = config.source === "db" ? await loadFromDb(config) : await loadFromMw(config);
  const skipped = [...loaded.skipped];
  const reports: PageReport[] = [];
  for (const page of loaded.pages) {
    if (page.wikitext.trim() === "") skipped.push({ title: page.title, reason: "empty wikitext" });
    else reports.push(reportPage(page));
  }
  console.log(`# WikiOS wikitext round trip — ${reports.length} pages from ${config.source}\n`);
  for (const report of reports) console.log(renderPage(report));
  for (const { title, reason } of skipped) console.log(`SKIP  ${title}: ${reason}`);
  console.log(`\n${renderAggregate(reports, skipped)}`);
  ensureParentDir(config.out);
  writeFileSync(
    config.out,
    JSON.stringify({ meta: { ...config, generatedAt: new Date().toISOString() }, skipped, pages: reports }, null, 2)
  );
  console.log(`\nFull results written to ${config.out}`);
}

main().catch(exitWithError);
