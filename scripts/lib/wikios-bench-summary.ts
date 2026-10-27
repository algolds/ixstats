/**
 * scripts/lib/wikios-bench-summary.ts — turns the benchmark's raw samples into the WikiOS-vs-MediaWiki
 * comparison table (used by scripts/bench/wikios-bench.ts, unit-tested in
 * src/tests/scripts/wikios-harness.test.ts).
 *
 * Rules:
 * - Only (page, run) pairs that produced a sample on both systems are compared.
 * - `page+data.*` rows are derived: the WikiOS HTML shell alone is not the article, so they compare
 *   MediaWiki's page with the WikiOS shell plus `wikios.getArticleHtml` (time until content is available).
 * - Page counts and weights (scripts, stylesheets, images, bytes, asset bytes) get no verdict.
 * - Verdict: a percentile is a tie within max(5 ms, 5%) (payload bytes 2%); WINS/LOSES need a clear gap on
 *   p50 or p75 and none the other way, MIXED means one of each.
 */

import { percentile } from "./wikios-harness";

export type System = "mediawiki" | "wikios";
export type Phase = "cold" | "warm";
export type Verdict = "WINS" | "LOSES" | "TIE" | "MIXED" | "n/a";

export interface MetricSample {
  system: System;
  metric: string;
  phase: Phase;
  page: string;
  run: number;
  value: number;
}

export interface Stats {
  n: number;
  p50: number;
  p75: number;
}

export interface SummaryRow {
  metric: string;
  phase: Phase;
  mediawiki: Stats | null;
  wikios: Stats | null;
  result: Verdict;
}

export const METRIC_ORDER = [
  "page.ttfbMs",
  "page.totalMs",
  "page+data.ttfbMs",
  "page+data.totalMs",
  "data.ttfbMs",
  "data.totalMs",
  "data.bytes",
  "search.ttfbMs",
  "search.totalMs",
  "search.bytes",
  "history.ttfbMs",
  "history.totalMs",
  "history.bytes",
  "page.bytes",
  "page.scripts",
  "page.stylesheets",
  "page.images",
  "page.assetBytes",
  "page.weightBytes",
] as const;

export const CAVEATS = [
  "page.* times the WikiOS HTML shell only; the article itself arrives with wikios.getArticleHtml. The content-availability comparison is page+data.* (MediaWiki column: its page; WikiOS column: shell + data call, sequential).",
  "page.bytes, scripts, stylesheets, images, assetBytes and weightBytes are reference only (no verdict): MediaWiki loads most of its JS through the ResourceLoader startup module, so static <script src>/asset references undercount it.",
  "TIE means p50 and p75 are both within max(5 ms, 5%) of MediaWiki's (payload bytes: 2%); WINS/LOSES need a clear gap on p50 or p75 and none the other way. Only (page, run) pairs that succeeded on both systems are compared.",
] as const;

/** Metrics with no verdict: static page structure and weight, where counting references is not comparable. */
const REFERENCE_METRICS: ReadonlySet<string> = new Set([
  "page.bytes",
  "page.scripts",
  "page.stylesheets",
  "page.images",
  "page.assetBytes",
  "page.weightBytes",
]);

const TIME_TOLERANCE_MS = 5;
const TIME_TOLERANCE_RATIO = 0.05;
const PAYLOAD_TOLERANCE_RATIO = 0.02;

const isTimeMetric = (metric: string): boolean => metric.endsWith("Ms");

function tolerance(metric: string, a: number, b: number): number {
  const larger = Math.max(a, b);
  return isTimeMetric(metric) ? Math.max(TIME_TOLERANCE_MS, larger * TIME_TOLERANCE_RATIO) : larger * PAYLOAD_TOLERANCE_RATIO;
}

type Outcome = "win" | "lose" | "tie";

/** Lower is better: a win means WikiOS is below MediaWiki by more than the tolerance. */
function outcome(metric: string, mediawiki: number, wikios: number): Outcome {
  const allowed = tolerance(metric, mediawiki, wikios);
  if (mediawiki - wikios > allowed) return "win";
  if (wikios - mediawiki > allowed) return "lose";
  return "tie";
}

export function verdict(metric: string, mediawiki: Stats | null, wikios: Stats | null): Verdict {
  if (!mediawiki || !wikios || REFERENCE_METRICS.has(metric)) return "n/a";
  const outcomes = [outcome(metric, mediawiki.p50, wikios.p50), outcome(metric, mediawiki.p75, wikios.p75)];
  const wins = outcomes.filter((o) => o === "win").length;
  const losses = outcomes.filter((o) => o === "lose").length;
  if (wins > 0 && losses > 0) return "MIXED";
  if (wins > 0) return "WINS";
  if (losses > 0) return "LOSES";
  return "TIE";
}

const sampleKey = (sample: MetricSample): string => `${sample.system}|${sample.metric}|${sample.page}|${sample.run}`;

/**
 * Adds the `page+data.*` samples. MediaWiki's are its page timings (the page is the article); WikiOS's are
 * the shell's TTFB and shell total + `getArticleHtml` total, only for (page, run) pairs where both requests
 * succeeded.
 */
export function withDerivedSamples(samples: readonly MetricSample[]): MetricSample[] {
  const byKey = new Map(samples.map((sample) => [sampleKey(sample), sample.value]));
  const derived: MetricSample[] = [];
  for (const sample of samples) {
    const isTtfb = sample.metric === "page.ttfbMs";
    if (!isTtfb && sample.metric !== "page.totalMs") continue;
    const metric = isTtfb ? "page+data.ttfbMs" : "page+data.totalMs";
    if (sample.system === "mediawiki") {
      derived.push({ ...sample, metric });
      continue;
    }
    const dataTotal = byKey.get(`wikios|data.totalMs|${sample.page}|${sample.run}`);
    if (dataTotal === undefined) continue;
    derived.push({ ...sample, metric, value: isTtfb ? sample.value : sample.value + dataTotal });
  }
  return [...samples, ...derived];
}

function toStats(values: readonly number[]): Stats | null {
  return values.length === 0 ? null : { n: values.length, p50: percentile(values, 50), p75: percentile(values, 75) };
}

type PairKey = string;

function valuesBySystem(samples: readonly MetricSample[], metric: string, phase: Phase, system: System): Map<PairKey, number> {
  const values = new Map<PairKey, number>();
  for (const sample of samples) {
    if (sample.metric === metric && sample.phase === phase && sample.system === system) {
      values.set(`${sample.page}|${sample.run}`, sample.value);
    }
  }
  return values;
}

/** The values to compare: only (page, run) pairs present on both systems, or everything when one side has none. */
function comparableValues(mediawiki: Map<PairKey, number>, wikios: Map<PairKey, number>): { mediawiki: number[]; wikios: number[] } {
  if (mediawiki.size === 0 || wikios.size === 0) return { mediawiki: [...mediawiki.values()], wikios: [...wikios.values()] };
  const shared = [...mediawiki.keys()].filter((key) => wikios.has(key));
  return {
    mediawiki: shared.map((key) => mediawiki.get(key) ?? Number.NaN),
    wikios: shared.map((key) => wikios.get(key) ?? Number.NaN),
  };
}

/** One row per metric and phase (warm first), with p50/p75 and the verdict. Derived rows are added here. */
export function summarize(rawSamples: readonly MetricSample[]): SummaryRow[] {
  const samples = withDerivedSamples(rawSamples);
  const rows: SummaryRow[] = [];
  for (const metric of METRIC_ORDER) {
    for (const phase of ["warm", "cold"] as const) {
      const values = comparableValues(
        valuesBySystem(samples, metric, phase, "mediawiki"),
        valuesBySystem(samples, metric, phase, "wikios")
      );
      const mediawiki = toStats(values.mediawiki);
      const wikios = toStats(values.wikios);
      if (mediawiki || wikios) rows.push({ metric, phase, mediawiki, wikios, result: verdict(metric, mediawiki, wikios) });
    }
  }
  return rows;
}

export function formatValue(metric: string, value: number): string {
  if (Number.isNaN(value)) return "-";
  if (isTimeMetric(metric)) return `${value.toFixed(0)} ms`;
  if (metric.toLowerCase().endsWith("bytes")) return `${(value / 1024).toFixed(1)} kB`;
  return value.toFixed(0);
}

function cell(metric: string, stats: Stats | null, field: "p50" | "p75"): string {
  return stats ? formatValue(metric, stats[field]) : "-";
}

export function renderTable(rows: readonly SummaryRow[]): string {
  const lines = [
    "| Metric | Phase | n (MW/WikiOS) | MediaWiki p50 | MediaWiki p75 | WikiOS p50 | WikiOS p75 | Result |",
    "| :--- | :--- | :--- | ---: | ---: | ---: | ---: | :--- |",
  ];
  for (const row of rows) {
    const n = `${row.mediawiki?.n ?? "-"}/${row.wikios?.n ?? "-"}`;
    lines.push(
      `| ${row.metric} | ${row.phase} | ${n} | ${cell(row.metric, row.mediawiki, "p50")} | ${cell(row.metric, row.mediawiki, "p75")} | ${cell(row.metric, row.wikios, "p50")} | ${cell(row.metric, row.wikios, "p75")} | ${row.result} |`
    );
  }
  return lines.join("\n");
}
