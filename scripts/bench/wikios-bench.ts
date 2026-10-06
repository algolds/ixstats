/**
 * scripts/bench/wikios-bench.ts — user-facing speed of WikiOS against MediaWiki.
 *
 * For every page in the list it times, per run: the MediaWiki article page, the WikiOS article page, the
 * WikiOS data call (`wikios.getArticleHtml`), title-prefix search on both systems and revision history on
 * both systems. For the two article pages it also counts script/stylesheet/image references and sums the size
 * of every referenced same-origin JS/CSS asset (each asset is fetched once and cached across pages).
 *
 * Run 1 is labelled "cold" and later runs "warm"; the script cannot purge either system's caches, so the
 * label only says which pass a sample came from. The comparison rules (derived `page+data.*` rows, tolerance,
 * reference-only rows) live in scripts/lib/wikios-bench-summary.ts and are printed as caveats with the table.
 *
 * Usage:
 *   bun scripts/bench/wikios-bench.ts --mw <MediaWiki base URL> [--wikios http://localhost:3000] \
 *     [--pages scripts/bench/pages.default.json] [--runs 3] [--out .bench-out/bench-results.json] [--interval-ms 1000]
 *
 * `--mw` is required (there is no production default). Every request goes through `throttledFetch`: at least
 * one second between requests to the same host (enforced for ixwiki.com regardless of `--interval-ms`) and
 * the allowlisted IxStats-Builder User-Agent. Exit code is 0 unless the arguments or the page list are
 * invalid; the caller reads the numbers.
 */

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { CAVEATS, renderTable, summarize, type MetricSample, type System } from "../lib/wikios-bench-summary";
import {
  encodeWikiTitle,
  ensureParentDir,
  exitWithError,
  extractAssetRefs,
  loadPageList,
  parseHttpUrl,
  throttledFetch,
  trpcQueryUrl,
  type FetchResult,
} from "../lib/wikios-harness";

type Kind = "page" | "data" | "search" | "history";

interface Config {
  mw: string;
  wikios: string;
  pages: string;
  runs: number;
  out: string;
  intervalMs: number;
}

interface RequestSpec {
  system: System;
  kind: Kind;
  url: string;
}

interface Failure {
  system: System;
  kind: Kind | "asset";
  page: string;
  run: number;
  url: string;
  status: number;
  error?: string;
}

interface Collector {
  samples: MetricSample[];
  failures: Failure[];
}

const DEFAULT_PAGES = fileURLToPath(new URL("./pages.default.json", import.meta.url));
const DEFAULT_OUT = ".bench-out/bench-results.json";
const SEARCH_PREFIX_LENGTH = 4;
const SEARCH_LIMIT = 10;
const HISTORY_LIMIT = 50;

// ---------------------------------------------------------------------------
// Arguments
// ---------------------------------------------------------------------------

const USAGE =
  "Usage: bun scripts/bench/wikios-bench.ts --mw <url> [--wikios <url>] [--pages file] [--runs n] [--out file] [--interval-ms n]";

function parseConfig(argv: string[]): Config {
  const { values } = parseArgs({
    args: argv,
    options: {
      mw: { type: "string" },
      wikios: { type: "string" },
      pages: { type: "string" },
      runs: { type: "string" },
      out: { type: "string" },
      "interval-ms": { type: "string" },
    },
  });
  const runs = Number.parseInt(values.runs ?? "3", 10);
  const intervalMs = Number.parseInt(values["interval-ms"] ?? "1000", 10);
  if (!(runs >= 1) || !(intervalMs >= 0)) throw new Error("--runs must be >= 1 and --interval-ms >= 0");
  return {
    mw: parseHttpUrl(values.mw, "--mw"),
    wikios: parseHttpUrl(values.wikios ?? "http://localhost:3000", "--wikios"),
    pages: values.pages ?? DEFAULT_PAGES,
    runs,
    out: values.out ?? DEFAULT_OUT,
    intervalMs,
  };
}

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

function mwApiUrl(config: Config, params: Record<string, string>): string {
  return `${config.mw}/api.php?${new URLSearchParams({ ...params, format: "json" }).toString()}`;
}

/** The seven requests made per page and run, alternating between the two systems. */
function requestSpecs(title: string, config: Config): RequestSpec[] {
  const prefix = Array.from(title).slice(0, SEARCH_PREFIX_LENGTH).join("");
  const wikiosTitle = { title };
  return [
    { system: "mediawiki", kind: "page", url: `${config.mw}/wiki/${encodeWikiTitle(title)}` },
    { system: "wikios", kind: "page", url: `${config.wikios}/wiki/${encodeWikiTitle(title)}` },
    {
      system: "wikios",
      kind: "data",
      url: trpcQueryUrl(config.wikios, "wikios.getArticleHtml", wikiosTitle),
    },
    {
      system: "mediawiki",
      kind: "search",
      url: mwApiUrl(config, {
        action: "opensearch",
        search: prefix,
        limit: String(SEARCH_LIMIT),
      }),
    },
    {
      system: "wikios",
      kind: "search",
      url: trpcQueryUrl(config.wikios, "wikios.search", { query: prefix, limit: SEARCH_LIMIT }),
    },
    {
      system: "mediawiki",
      kind: "history",
      url: mwApiUrl(config, {
        action: "query",
        prop: "revisions",
        titles: title,
        rvlimit: String(HISTORY_LIMIT),
        rvprop: "ids|timestamp|user|comment|size",
      }),
    },
    {
      system: "wikios",
      kind: "history",
      url: trpcQueryUrl(config.wikios, "wikios.getHistory", { title, limit: HISTORY_LIMIT }),
    },
  ];
}

const isOk = (result: FetchResult): boolean => result.status >= 200 && result.status < 300;

function record(
  collector: Collector,
  spec: { system: System; page: string; run: number },
  metric: string,
  value: number
): void {
  collector.samples.push({
    system: spec.system,
    metric,
    phase: spec.run === 1 ? "cold" : "warm",
    page: spec.page,
    run: spec.run,
    value,
  });
}

function recordFailure(
  collector: Collector,
  spec: { system: System; kind: Kind | "asset"; page: string; run: number },
  result: FetchResult
): void {
  collector.failures.push({
    system: spec.system,
    kind: spec.kind,
    page: spec.page,
    run: spec.run,
    url: result.url,
    status: result.status,
    error: result.error,
  });
}

function recordTimings(
  collector: Collector,
  spec: RequestSpec,
  page: string,
  run: number,
  result: FetchResult
): void {
  if (!isOk(result)) {
    recordFailure(collector, { ...spec, page, run }, result);
    return;
  }
  const target = { system: spec.system, page, run };
  record(collector, target, `${spec.kind}.ttfbMs`, result.ttfbMs);
  record(collector, target, `${spec.kind}.totalMs`, result.totalMs);
  record(collector, target, `${spec.kind}.bytes`, result.bytes);
}

// ---------------------------------------------------------------------------
// Page weight
// ---------------------------------------------------------------------------

/** Decoded size of one same-origin asset; fetched once per unique URL. */
async function assetSize(
  url: string,
  config: Config,
  cache: Map<string, number>,
  onFailure: (result: FetchResult) => void
): Promise<number> {
  const cached = cache.get(url);
  if (cached !== undefined) return cached;
  const result = await throttledFetch(url, {}, { minIntervalMs: config.intervalMs });
  if (!isOk(result)) onFailure(result);
  const size = isOk(result) ? result.bytes : 0;
  cache.set(url, size);
  return size;
}

async function recordPageWeight(
  collector: Collector,
  spec: RequestSpec,
  page: string,
  run: number,
  result: FetchResult,
  context: { config: Config; assets: Map<string, number> }
): Promise<void> {
  const refs = extractAssetRefs(result.body, spec.url);
  const origin = new URL(spec.url).origin;
  const sameOrigin = [...new Set([...refs.scripts, ...refs.stylesheets])].filter((url) => {
    try {
      return new URL(url).origin === origin;
    } catch {
      return false;
    }
  });
  let assetBytes = 0;
  for (const url of sameOrigin) {
    assetBytes += await assetSize(url, context.config, context.assets, (failed) =>
      recordFailure(collector, { system: spec.system, kind: "asset", page, run }, failed)
    );
  }
  const target = { system: spec.system, page, run };
  record(collector, target, "page.scripts", refs.scripts.length);
  record(collector, target, "page.stylesheets", refs.stylesheets.length);
  record(collector, target, "page.images", refs.images);
  record(collector, target, "page.assetBytes", assetBytes);
  record(collector, target, "page.weightBytes", result.bytes + assetBytes);
}

async function benchPage(
  title: string,
  run: number,
  context: { config: Config; collector: Collector; assets: Map<string, number> }
): Promise<void> {
  const { config, collector } = context;
  const pages: Array<{ spec: RequestSpec; result: FetchResult }> = [];
  for (const spec of requestSpecs(title, config)) {
    const result = await throttledFetch(
      spec.url,
      { headers: { accept: spec.kind === "page" ? "text/html" : "application/json" } },
      { minIntervalMs: config.intervalMs }
    );
    recordTimings(collector, spec, title, run, result);
    if (spec.kind === "page" && isOk(result)) pages.push({ spec, result });
  }
  for (const { spec, result } of pages) {
    await recordPageWeight(collector, spec, title, run, result, context);
  }
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

function renderFailures(failures: Failure[]): string {
  if (failures.length === 0) return "No failed requests.";
  const counts = new Map<string, number>();
  for (const failure of failures) {
    const key = `${failure.system} ${failure.kind} (HTTP ${failure.status})`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const lines = [...counts].map(([key, count]) => `- ${key}: ${count}`);
  return `Failed requests (excluded from the statistics above):\n${lines.join("\n")}`;
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
  const titles = loadPageList(config.pages);
  const collector: Collector = { samples: [], failures: [] };
  const context = { config, collector, assets: new Map<string, number>() };
  const startedAt = new Date().toISOString();

  for (let run = 1; run <= config.runs; run++) {
    for (const [index, title] of titles.entries()) {
      console.error(`[run ${run}/${config.runs}] ${index + 1}/${titles.length} ${title}`);
      await benchPage(title, run, context);
    }
  }

  const summary = summarize(collector.samples);
  ensureParentDir(config.out);
  writeFileSync(
    config.out,
    JSON.stringify(
      {
        meta: { ...config, startedAt, finishedAt: new Date().toISOString(), titles },
        caveats: CAVEATS,
        samples: collector.samples,
        failures: collector.failures,
        summary,
      },
      null,
      2
    )
  );
  console.log(`# WikiOS vs MediaWiki — ${titles.length} pages x ${config.runs} runs\n`);
  console.log(`MediaWiki: ${config.mw}   WikiOS: ${config.wikios}`);
  console.log("Cold = run 1, warm = later runs (labels only; caches are not purged). Lower is better.\n");
  console.log(renderTable(summary));
  console.log(`\n${CAVEATS.map((caveat) => `- ${caveat}`).join("\n")}`);
  console.log(`\n${renderFailures(collector.failures)}`);
  console.log(`\nRaw samples written to ${config.out}`);
}

main().catch(exitWithError);
