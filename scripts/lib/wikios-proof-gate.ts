/**
 * scripts/lib/wikios-proof-gate.ts — the WikiOS proof gate (used by scripts/audit/wikios-proof.ts, unit-tested in
 * src/tests/scripts/wikios-proof-gate.test.ts).
 *
 * It checks the three harness reports (editor round trip, render parity, bench) against
 * scripts/audit/wikios-proof-thresholds.json, keys a proof to the WikiOS source it measured, and decides whether a
 * committed proof covers the code about to ship. Everything here is pure: the CLI reads the files and runs git.
 *
 * Rules:
 * - An empty or wrong corpus never passes: each report has a page floor.
 * - Parity counts a page MediaWiki says is missing only as corpus drift; any other MediaWiki failure leaves the
 *   page unanswered, so it does not count toward the floor. A WikiOS failure always fails.
 * - A fallback or stale render that survived the settle retries fails: it is not MediaWiki's render.
 * - The bench is reference only on a dev server (local profile); server profiles pool every phase and run.
 * - The tree key hashes `git ls-tree -r HEAD` over WIKIOS_PROOF_PATHS, the product code (no tests, no harness).
 */

import { createHash } from "node:crypto";
import { z } from "zod";
import {
  METRIC_ORDER,
  formatValue,
  withDerivedSamples,
  type MetricSample,
  type System,
} from "./wikios-bench-summary";
import { mean, needsSettling, percentile } from "./wikios-harness";

export type ProofProfile = "local" | "launch" | "recurring";

const PROOF_PROFILES = ["local", "launch", "recurring"] as const;
/** Profiles whose summary can stand as the committed proof of a release. */
const PROVING_PROFILES: ReadonlySet<ProofProfile> = new Set(["local", "launch"]);

const README = "docs/audits/wikios-proof/README.md";
const LOCAL_BENCH_SKIP = "dev server: reference only";

// ---------------------------------------------------------------------------
// Report schemas: strict on the fields the gate reads, silent on the rest, and the fields added after the first
// reports (namespaces, failedOn, renderQuality, stale, the aggregate) are optional.
// ---------------------------------------------------------------------------

export const roundTripReportSchema = z.object({
  meta: z.object({
    namespaces: z.union([z.array(z.number().int()), z.literal("all"), z.null()]).optional(),
  }),
  skipped: z.array(z.object({ title: z.string(), reason: z.string() })),
  pages: z.array(
    z.object({
      title: z.string(),
      identical: z.boolean(),
      complete: z.boolean(),
      error: z.string().optional(),
    })
  ),
});
export type RoundTripReport = z.infer<typeof roundTripReportSchema>;

export const parityReportSchema = z.object({
  meta: z.object({ titles: z.array(z.string()) }),
  pages: z.array(
    z.object({
      title: z.string(),
      error: z.string().optional(),
      failedOn: z.enum(["mediawiki", "wikios"]).optional(),
      renderQuality: z.enum(["rendered", "fallback"]).optional(),
      stale: z.boolean().optional(),
      scores: z.object({ overall: z.number() }).optional(),
      templates: z.array(z.string()),
      differences: z.record(z.string(), z.array(z.string())).optional(),
    })
  ),
  aggregate: z
    .object({
      templatesOnLowestPages: z
        .array(z.object({ template: z.string(), lowPages: z.number(), allPages: z.number() }))
        .optional(),
    })
    .optional(),
});
export type ParityReport = z.infer<typeof parityReportSchema>;
type ParityPage = ParityReport["pages"][number];
type ScoredParityPage = ParityPage & { scores: { overall: number } };

const SYSTEMS = ["mediawiki", "wikios"] as const;
const REQUEST_KINDS = ["page", "data", "search", "history"] as const;

export const benchReportSchema = z.object({
  samples: z.array(
    z.object({
      system: z.enum(SYSTEMS),
      metric: z.string(),
      phase: z.enum(["cold", "warm"]),
      page: z.string(),
      run: z.number().int(),
      value: z.number(),
    })
  ),
  failures: z.array(
    z.object({
      system: z.enum(SYSTEMS),
      kind: z.enum([...REQUEST_KINDS, "asset"]),
      page: z.string(),
      run: z.number().int(),
      url: z.string().optional(),
      status: z.number().optional(),
      error: z.string().optional(),
    })
  ),
});
export type BenchReport = z.infer<typeof benchReportSchema>;

export interface ProofReports {
  roundTrip: RoundTripReport | null;
  parity: ParityReport | null;
  bench: BenchReport | null;
}

// ---------------------------------------------------------------------------
// Thresholds
// ---------------------------------------------------------------------------

const TIME_METRICS = METRIC_ORDER.filter((metric) => metric.endsWith("Ms"));
const timeMetric = z.enum(TIME_METRICS);
const count = z.number().int().min(0);
const percent = z.number().min(0).max(100);

const thresholdsSchema = z.strictObject({
  roundTrip: z.strictObject({
    minPages: z.number().int().positive(),
    maxNonIdentical: count,
    maxIncomplete: count,
    maxErrors: count,
  }),
  parity: z.strictObject({
    minPages: z.number().int().positive(),
    maxWikiosFailures: count,
    maxFallbackRenders: count,
    maxMediaWikiMissingPercent: percent,
    minAtLeast98Percent: percent,
    minMeanScore: percent,
    maxBelow70Pages: count,
    knownLowPages: z.array(z.strictObject({ title: z.string().min(1), reason: z.string().min(1) })),
  }),
  bench: z.strictObject({
    maxFailurePercent: percent,
    p95Ms: z.partialRecord(timeMetric, z.number().positive()),
    maxP95RatioToMediaWiki: z.partialRecord(timeMetric, z.number().positive()),
  }),
});
export type ProofThresholds = z.infer<typeof thresholdsSchema>;

/** Parses wikios-proof-thresholds.json: an unknown key, a missing section or a page floor of 0 throws. */
export function parseThresholds(json: string): ProofThresholds {
  return thresholdsSchema.parse(JSON.parse(json));
}

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

export interface Check {
  name: string;
  passed: boolean;
  /** Why the check does not count (it still shows what was measured), or null. */
  skipped: string | null;
  measured: string;
  threshold: string;
}

const atMost = (name: string, value: number, max: number, measured = String(value)): Check => ({
  name,
  passed: value <= max,
  skipped: null,
  measured,
  threshold: `<= ${max}`,
});

const atLeast = (name: string, value: number, min: number, measured = String(value)): Check => ({
  name,
  passed: value >= min,
  skipped: null,
  measured,
  threshold: `>= ${min}`,
});

const percentOf = (part: number, whole: number): number =>
  whole === 0 ? Number.NaN : (part / whole) * 100;
const fixedPercent = (value: number, digits = 1): string => `${value.toFixed(digits)}%`;

export function evaluateRoundTrip(report: RoundTripReport, t: ProofThresholds): Check[] {
  const { pages } = report;
  return [
    atLeast("roundTrip.pages", pages.length, t.roundTrip.minPages),
    atMost(
      "roundTrip.nonIdentical",
      pages.filter((page) => !page.identical).length,
      t.roundTrip.maxNonIdentical
    ),
    atMost(
      "roundTrip.incomplete",
      pages.filter((page) => !page.complete).length,
      t.roundTrip.maxIncomplete
    ),
    atMost(
      "roundTrip.errors",
      pages.filter((page) => page.error !== undefined).length,
      t.roundTrip.maxErrors
    ),
  ];
}

/** MediaWiki's missing-page error: the `missingtitle` code, or its info text in older reports. */
const MISSING_ON_MEDIAWIKI = /\bmissingtitle\b|\bdoes(?:n't| not) exist\b/i;

/** The side a page failed on. Older reports carry only the error prefix; an unattributable error counts on WikiOS. */
function failedSide(page: ParityPage): "mediawiki" | "wikios" | null {
  if (page.error === undefined) return null;
  if (page.failedOn) return page.failedOn;
  return page.error.startsWith("MediaWiki") ? "mediawiki" : "wikios";
}

const isMissingOnMediaWiki = (page: ParityPage): boolean =>
  failedSide(page) === "mediawiki" && MISSING_ON_MEDIAWIKI.test(page.error ?? "");

/** The parity script sets scores only on a page both sides answered. */
const isScored = (page: ParityPage): page is ScoredParityPage => page.scores !== undefined;

function parityFloor(
  report: ParityReport,
  scored: number,
  missing: number,
  minPages: number
): Check {
  const requested = report.meta.titles.length;
  const answered = scored + missing;
  return {
    name: "parity.pages",
    passed: answered >= minPages && report.pages.length === requested,
    skipped: null,
    measured: `${answered} answered of ${requested} requested (${report.pages.length} in the report)`,
    threshold: `>= ${minPages} answered, every requested page reported`,
  };
}

function scoreChecks(scored: readonly ScoredParityPage[], t: ProofThresholds["parity"]): Check[] {
  const overall = scored.map((page) => page.scores.overall);
  const share = percentOf(overall.filter((score) => score >= 98).length, overall.length);
  const average = mean(overall);
  const none = "no scored page";
  const known = new Set(t.knownLowPages.map((page) => page.title));
  const unlisted = scored
    .filter((page) => page.scores.overall < 70 && !known.has(page.title))
    .map((page) => page.title);
  const named = unlisted.length === 0 ? "" : ` (${unlisted.slice(0, 5).join(", ")})`;
  return [
    {
      ...atLeast(
        "parity.atLeast98",
        share,
        t.minAtLeast98Percent,
        Number.isNaN(share) ? none : fixedPercent(share)
      ),
      threshold: `>= ${t.minAtLeast98Percent}% of scored pages`,
    },
    atLeast(
      "parity.meanScore",
      average,
      t.minMeanScore,
      Number.isNaN(average) ? none : average.toFixed(2)
    ),
    atMost("parity.below70", unlisted.length, t.maxBelow70Pages, `${unlisted.length}${named}`),
  ];
}

export function evaluateParity(report: ParityReport, t: ProofThresholds): Check[] {
  const p = t.parity;
  const scored = report.pages.filter(isScored);
  const missing = report.pages.filter(isMissingOnMediaWiki).length;
  const drift = percentOf(missing, report.meta.titles.length);
  return [
    parityFloor(report, scored.length, missing, p.minPages),
    atMost(
      "parity.wikiosFailures",
      report.pages.filter((page) => failedSide(page) === "wikios").length,
      p.maxWikiosFailures
    ),
    {
      ...atMost(
        "parity.mediawikiMissing",
        drift,
        p.maxMediaWikiMissingPercent,
        fixedPercent(Number.isNaN(drift) ? 0 : drift)
      ),
      threshold: `<= ${p.maxMediaWikiMissingPercent}% of requested pages`,
    },
    atMost("parity.fallbackRenders", scored.filter(needsSettling).length, p.maxFallbackRenders),
    ...scoreChecks(scored, p),
  ];
}

// ---------------------------------------------------------------------------
// Bench
// ---------------------------------------------------------------------------

const REQUEST_METRICS: ReadonlySet<string> = new Set(
  REQUEST_KINDS.map((kind) => `${kind}.totalMs`)
);

type TimeMetric = (typeof TIME_METRICS)[number];
const entries = (record: Partial<Record<TimeMetric, number>>): Array<[TimeMetric, number]> =>
  TIME_METRICS.flatMap((metric) => {
    const value = record[metric];
    return value === undefined ? [] : [[metric, value] as [TimeMetric, number]];
  });

/** Failed requests over requests made (timed successes plus failures); asset fetches are not bench requests. */
function failureCheck(report: BenchReport, system: System, max: number): Check {
  const failures = report.failures.filter(
    (failure) => failure.system === system && failure.kind !== "asset"
  ).length;
  const successes = report.samples.filter(
    (sample) => sample.system === system && REQUEST_METRICS.has(sample.metric)
  ).length;
  const requests = successes + failures;
  const share = percentOf(failures, requests);
  const measured =
    requests === 0 ? "no requests" : `${fixedPercent(share, 2)} (${failures} of ${requests})`;
  return { ...atMost(`bench.failures.${system}`, share, max, measured), threshold: `<= ${max}%` };
}

function p95Check(samples: readonly MetricSample[], metric: TimeMetric, cap: number): Check {
  const values = samples
    .filter((sample) => sample.system === "wikios" && sample.metric === metric)
    .map((s) => s.value);
  const p95 = percentile(values, 95);
  const measured = Number.isNaN(p95) ? "no samples" : formatValue(metric, p95);
  return { ...atMost(`bench.p95.${metric}`, p95, cap, measured), threshold: `<= ${cap} ms` };
}

function pairValues(
  samples: readonly MetricSample[],
  metric: string,
  system: System
): Map<string, number> {
  const values = new Map<string, number>();
  for (const sample of samples) {
    if (sample.metric === metric && sample.system === system)
      values.set(`${sample.page}|${sample.run}`, sample.value);
  }
  return values;
}

/** WikiOS p95 over MediaWiki p95, on the (page, run) pairs measured on both systems only. */
function ratioCheck(samples: readonly MetricSample[], metric: TimeMetric, max: number): Check {
  const mediawiki = pairValues(samples, metric, "mediawiki");
  const wikios = pairValues(samples, metric, "wikios");
  const shared = [...wikios.keys()].filter((key) => mediawiki.has(key));
  const p95 = (values: Map<string, number>): number =>
    percentile(
      shared.map((key) => values.get(key) ?? Number.NaN),
      95
    );
  const ratio = p95(wikios) / p95(mediawiki);
  const measured =
    shared.length === 0
      ? "no page measured on both systems"
      : `${ratio.toFixed(2)} (n=${shared.length})`;
  return {
    name: `bench.ratio.${metric}`,
    passed: ratio <= max,
    skipped: null,
    measured,
    threshold: `<= ${max}`,
  };
}

function benchChecks(report: BenchReport, t: ProofThresholds["bench"]): Check[] {
  const samples = withDerivedSamples(report.samples);
  return [
    ...SYSTEMS.map((system) => failureCheck(report, system, t.maxFailurePercent)),
    ...entries(t.p95Ms).map(([metric, cap]) => p95Check(samples, metric, cap)),
    ...entries(t.maxP95RatioToMediaWiki).map(([metric, max]) => ratioCheck(samples, metric, max)),
  ];
}

const EMPTY_BENCH: BenchReport = { samples: [], failures: [] };

export function evaluateBench(
  report: BenchReport | null,
  t: ProofThresholds,
  profile: ProofProfile
): Check[] {
  const checks = benchChecks(report ?? EMPTY_BENCH, t.bench).map((check) =>
    report ? check : { ...check, passed: false, measured: "no bench report" }
  );
  return profile === "local"
    ? checks.map((check) => ({ ...check, skipped: LOCAL_BENCH_SKIP }))
    : checks;
}

// ---------------------------------------------------------------------------
// Tree key
// ---------------------------------------------------------------------------

/** The WikiOS product code a proof covers. Tests and the harness scripts are left out on purpose. */
export const WIKIOS_PROOF_PATHS: readonly string[] = [
  "src/lib/wiki-os",
  "src/components/wiki-os",
  "src/server/api/routers/wikios",
  "src/app/(wiki-os)",
  "src/app/w",
  "src/app/api/wiki",
  "src/app/api/mediawiki",
  "src/lib/utils/sanitize-html.ts",
  "src/lib/utils/scope-template-styles.ts",
  "scripts/ops/mediawiki",
  "prisma/schema/wiki.prisma",
];

/** sha256 hex of `git ls-tree -r HEAD -- ...WIKIOS_PROOF_PATHS` (the committed tree). An empty listing throws. */
export function wikiosTreeKey(lsTreeOutput: string): string {
  if (lsTreeOutput.trim() === "") {
    throw new Error(
      "git ls-tree listed no WikiOS files: run it from the repository root on a commit that has them"
    );
  }
  return createHash("sha256").update(lsTreeOutput).digest("hex");
}

/** True when `git status --porcelain -- ...WIKIOS_PROOF_PATHS` lists anything: the run measured uncommitted code. */
export function isTreeDirty(statusPorcelain: string): boolean {
  return statusPorcelain.trim() !== "";
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

const checkSchema = z.object({
  name: z.string(),
  passed: z.boolean(),
  skipped: z.string().nullable(),
  measured: z.string(),
  threshold: z.string(),
});

const proofSummarySchema = z.object({
  profile: z.enum(PROOF_PROFILES),
  generatedAt: z.string(),
  commit: z.string(),
  treeKey: z.string(),
  dirty: z.boolean(),
  corpus: z.object({ roundTripPages: count, parityPages: count, benchPages: count }),
  checks: z.array(checkSchema),
  passed: z.boolean(),
});
export type ProofSummary = z.infer<typeof proofSummarySchema>;
export type ProofMeta = Omit<ProofSummary, "checks" | "passed">;

/** Parses a summary.json / latest.json; a malformed one throws. */
export function parseProofSummary(json: string): ProofSummary {
  return proofSummarySchema.parse(JSON.parse(json));
}

const allPassed = (checks: readonly Check[]): boolean =>
  checks.length > 0 && checks.every((check) => check.passed || check.skipped !== null);

export function buildSummary(meta: ProofMeta, checks: Check[]): ProofSummary {
  const { profile, generatedAt, commit, treeKey, dirty, corpus } = meta;
  return {
    profile,
    generatedAt,
    commit,
    treeKey,
    dirty,
    corpus,
    checks,
    passed: allPassed(checks),
  };
}

export function corpusCounts(reports: ProofReports): ProofSummary["corpus"] {
  return {
    roundTripPages: reports.roundTrip?.pages.length ?? 0,
    parityPages: reports.parity?.meta.titles.length ?? 0,
    benchPages: new Set(reports.bench?.samples.map((sample) => sample.page)).size,
  };
}

// ---------------------------------------------------------------------------
// Markdown
// ---------------------------------------------------------------------------

const LOWEST_PAGES = 20;

const checkResult = (check: Check): string => {
  if (check.skipped !== null) return `skipped (${check.skipped})`;
  return check.passed ? "pass" : "FAIL";
};

function renderHeader(summary: ProofSummary): string[] {
  const { corpus } = summary;
  return [
    `# WikiOS proof: ${summary.profile}`,
    "",
    `- Result: ${summary.passed ? "PASSED" : "FAILED"}`,
    `- Generated: ${summary.generatedAt}`,
    `- Commit: ${summary.commit}`,
    `- Tree key: ${summary.treeKey}`,
    `- Dirty: ${summary.dirty ? "yes (uncommitted WikiOS changes; this run cannot stand as a proof)" : "no"}`,
    `- Corpus: ${corpus.roundTripPages} round-trip pages, ${corpus.parityPages} parity pages, ${corpus.benchPages} bench pages`,
  ];
}

function renderChecks(checks: readonly Check[]): string[] {
  return [
    "## Checks",
    "",
    "| Check | Result | Measured | Threshold |",
    "| :--- | :--- | :--- | :--- |",
    ...checks.map(
      (check) =>
        `| ${check.name} | ${checkResult(check)} | ${check.measured} | ${check.threshold} |`
    ),
  ];
}

function renderLowestPages(parity: ParityReport): string[] {
  const lowest = parity.pages
    .filter(isScored)
    .sort((a, b) => a.scores.overall - b.scores.overall)
    .slice(0, LOWEST_PAGES);
  const lines = ["## Lowest parity pages", ""];
  for (const page of lowest) {
    lines.push(`- ${page.scores.overall.toFixed(1)} ${page.title}`);
    for (const [label, items] of Object.entries(page.differences ?? {})) {
      if (items.length > 0) lines.push(`  - ${label}: ${items.join("; ")}`);
    }
  }
  return lowest.length === 0 ? [...lines, "No scored page."] : lines;
}

function renderTemplates(parity: ParityReport): string[] {
  const rows = parity.aggregate?.templatesOnLowestPages ?? [];
  if (rows.length === 0) return ["## Templates on the lowest pages", "", "None recorded."];
  return [
    "## Templates on the lowest pages",
    "",
    "| Template | Lowest pages | All pages |",
    "| :--- | ---: | ---: |",
    ...rows.map((row) => `| ${row.template} | ${row.lowPages} | ${row.allPages} |`),
  ];
}

function renderBench(bench: BenchReport): string[] {
  const samples = withDerivedSamples(bench.samples);
  const lines = [
    "## Bench (all phases and runs pooled)",
    "",
    "| Metric | MediaWiki p50 | MediaWiki p95 | WikiOS p50 | WikiOS p95 |",
    "| :--- | ---: | ---: | ---: | ---: |",
  ];
  for (const metric of METRIC_ORDER) {
    const cells = SYSTEMS.flatMap((system) => {
      const values = samples
        .filter((s) => s.metric === metric && s.system === system)
        .map((s) => s.value);
      return [
        formatValue(metric, percentile(values, 50)),
        formatValue(metric, percentile(values, 95)),
      ];
    });
    if (cells.some((cell) => cell !== "-")) lines.push(`| ${metric} | ${cells.join(" | ")} |`);
  }
  return lines;
}

export function renderProofSummary(summary: ProofSummary, reports: ProofReports): string {
  const sections = [renderHeader(summary), renderChecks(summary.checks)];
  if (reports.parity)
    sections.push(renderLowestPages(reports.parity), renderTemplates(reports.parity));
  if (summary.profile !== "local" && reports.bench) sections.push(renderBench(reports.bench));
  return `${sections.map((lines) => lines.join("\n")).join("\n\n")}\n`;
}

// ---------------------------------------------------------------------------
// Committed proof
// ---------------------------------------------------------------------------

export type CommittedProofResult = { ok: true } | { ok: false; reason: string };

const refuse = (reason: string): CommittedProofResult => ({
  ok: false,
  reason: `${reason} (${README})`,
});

/**
 * Whether the committed summary (docs/audits/wikios-proof/latest.json) proves the WikiOS code with tree key
 * `currentKey`. `passed` is recomputed from the checks, so a hand-edited flag is not trusted.
 */
export function checkCommittedProof(
  summary: ProofSummary | null,
  currentKey: string
): CommittedProofResult {
  if (!summary)
    return refuse("No committed proof: run the local proof and commit its summary as latest.json");
  if (summary.dirty) {
    return refuse(
      "The committed proof measured uncommitted WikiOS changes: commit them and run the local proof again"
    );
  }
  if (!summary.passed || !allPassed(summary.checks)) {
    return refuse(
      "The committed proof did not pass: fix its failing checks and run the local proof again"
    );
  }
  if (!PROVING_PROFILES.has(summary.profile)) {
    return refuse(
      `The committed proof is a ${summary.profile} run, which cannot prove a release: commit a local or launch proof`
    );
  }
  if (!summary.checks.some((check) => check.name.startsWith("parity."))) {
    return refuse(
      "The committed proof has no parity check: run the full proof, not the round trip alone"
    );
  }
  if (summary.treeKey !== currentKey) {
    return refuse(
      "WikiOS code changed since the committed proof: run the local proof on this commit and commit its summary"
    );
  }
  return { ok: true };
}
