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
import { join } from "node:path";
import { parseArgs } from "node:util";
import { z } from "zod";
import {
  METRIC_ORDER,
  formatValue,
  withDerivedSamples,
  type MetricSample,
  type System,
} from "./wikios-bench-summary";
import {
  isIxwikiHost,
  isLocalDatabaseUrl,
  mean,
  needsSettling,
  parseHttpUrl,
  percentile,
  samplePages,
  stripTrailingSlashes,
} from "./wikios-harness";

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
  /** `settleMs` is absent from reports written before the settle retries, which recorded no render state. */
  meta: z.object({ titles: z.array(z.string()), settleMs: z.number().optional() }),
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

/** The checks as a Markdown table (the summary's, and what the CLI prints). */
export function renderChecks(checks: readonly Check[]): string[] {
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

// ---------------------------------------------------------------------------
// CLI (scripts/audit/wikios-proof.ts): profiles, environment, harness commands, arguments
// ---------------------------------------------------------------------------

/** The environment a profile reads; `process.env` fits. */
export type ProofEnv = Readonly<Record<string, string | undefined>>;

export type PageCount = number | "all";

export interface ProfileConfig {
  outDir: string;
  corpusFile: string;
  benchPagesFile: string;
  /** The api.php parity compares against. */
  mwApi: string;
  /** IxStates as the parity script reads it (`wikios.getArticleHtml`). */
  wikios: string;
  /** MediaWiki's public origin: the bench's MediaWiki side. */
  mw: string;
  /** IxStates' public URL: the bench's WikiOS side, so both sides come through the same front door. */
  wikiosPublic: string;
  paritySample: PageCount;
  parityIntervalMs: number;
  /** "defaults" is scripts/bench/pages.default.json alone. */
  benchPages: PageCount | "defaults";
  benchRuns: number;
  benchIntervalMs: number;
}

export type ProfileDefaults = Omit<ProfileConfig, "outDir" | "corpusFile" | "benchPagesFile">;

export type RunOverrides = Partial<
  Pick<
    ProfileConfig,
    "mwApi" | "wikios" | "mw" | "wikiosPublic" | "paritySample" | "parityIntervalMs" | "benchRuns"
  > & { benchPages: PageCount }
>;

const FALLBACK_MEDIAWIKI = "https://ixwiki.com";
const LOCAL_WIKIOS = "http://localhost:3200";
/** Classic's public api.php is asked at most once every 2 s from this machine (plan Global Constraints). */
const LOCAL_MIN_INTERVAL_MS = 2000;
const SERVER_BENCH_INTERVAL_MS = 1000;

const SERVER_SAMPLING = {
  launch: { paritySample: "all", parityIntervalMs: 200, benchPages: 200, benchRuns: 2 },
  recurring: { paritySample: 200, parityIntervalMs: 500, benchPages: 50, benchRuns: 1 },
} as const;

/** The trimmed value, or undefined when it is unset or blank. */
const filled = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

const parsedUrl = (value: string | undefined): URL | null =>
  value !== undefined && URL.canParse(value) ? new URL(value) : null;

const mediaWikiBase = (env: ProofEnv): string =>
  stripTrailingSlashes(filled(env.NEXT_PUBLIC_MEDIAWIKI_URL) ?? FALLBACK_MEDIAWIKI);

function localDefaults(env: ProofEnv): ProfileDefaults {
  const base = mediaWikiBase(env);
  return {
    mwApi: `${base}/api.php`,
    wikios: LOCAL_WIKIOS,
    mw: new URL(base).origin,
    wikiosPublic: LOCAL_WIKIOS,
    paritySample: 500,
    parityIntervalMs: LOCAL_MIN_INTERVAL_MS,
    benchPages: "defaults",
    benchRuns: 2,
    benchIntervalMs: LOCAL_MIN_INTERVAL_MS,
  };
}

/** IxStates' public URL: the origin of APP_URL (else NEXT_PUBLIC_APP_URL) plus the base path. */
function appPublicUrl(env: ProofEnv, basePath: string): string {
  const url = parsedUrl(filled(env.APP_URL) ?? filled(env.NEXT_PUBLIC_APP_URL));
  if (!url) {
    throw new Error(
      "APP_URL or NEXT_PUBLIC_APP_URL must be IxStates' public URL: the bench measures WikiOS through it"
    );
  }
  return `${url.origin}${basePath}`;
}

function serverDefaults(profile: "launch" | "recurring", env: ProofEnv): ProfileDefaults {
  const basePath = stripTrailingSlashes(env.BASE_PATH ?? "");
  const internal = filled(env.WIKIOS_MEDIAWIKI_INTERNAL_URL);
  if (!internal)
    throw new Error(`the ${profile} proof needs WIKIOS_MEDIAWIKI_INTERNAL_URL (runbook step 4)`);
  return {
    mwApi: internal,
    wikios: `http://127.0.0.1:${filled(env.PORT) ?? "3550"}${basePath}`,
    mw: new URL(mediaWikiBase(env)).origin,
    wikiosPublic: appPublicUrl(env, basePath),
    ...SERVER_SAMPLING[profile],
    benchIntervalMs: SERVER_BENCH_INTERVAL_MS,
  };
}

/** What a profile measures, and against which URLs. */
export function profileDefaults(profile: ProofProfile, env: ProofEnv): ProfileDefaults {
  return profile === "local" ? localDefaults(env) : serverDefaults(profile, env);
}

const LOCAL_HOSTS: ReadonlySet<string> = new Set(["localhost", "127.0.0.1"]);

/** host:port/database, never the credentials. */
const databaseLabel = (url: URL | null): string =>
  url ? `${url.hostname}:${url.port || "(no port)"}${url.pathname}` : "nothing usable";

function assertLocalEnvironment(env: ProofEnv): void {
  const url = parsedUrl(env.DATABASE_URL);
  const proofClone =
    url !== null &&
    LOCAL_HOSTS.has(url.hostname) &&
    url.port === "5433" &&
    url.pathname === "/ixstats_proof";
  if (!proofClone) {
    throw new Error(
      `the local proof reads only the ixstats_proof clone on localhost:5433; DATABASE_URL names ${databaseLabel(url)}`
    );
  }
}

function assertServerEnvironment(profile: ProofProfile, env: ProofEnv): void {
  if (env.NODE_ENV !== "production") {
    throw new Error(
      `the ${profile} proof runs on the production server: NODE_ENV must be production`
    );
  }
  const internal = parsedUrl(filled(env.WIKIOS_MEDIAWIKI_INTERNAL_URL));
  if (!internal || isIxwikiHost(internal.hostname)) {
    throw new Error(
      "WIKIOS_MEDIAWIKI_INTERNAL_URL must name the loopback renderer's api.php (runbook step 4), not the public wiki"
    );
  }
  if (!isLocalDatabaseUrl(env.DATABASE_URL ?? "")) {
    throw new Error(
      "DATABASE_URL must be the server's own database (localhost, not the 15433 tunnel)"
    );
  }
}

/**
 * Refuses a profile in the wrong place: the local proof reads only the ixstats_proof clone (never the dev copy, the
 * e2e clone or the 15433 tunnel to production); the server proofs need production and the loopback renderer.
 */
export function assertProfileEnvironment(profile: ProofProfile, env: ProofEnv): void {
  if (profile === "local") assertLocalEnvironment(env);
  else assertServerEnvironment(profile, env);
}

export type HarnessName = "roundtrip" | "parity" | "bench";

/** `argv` starts with the script, relative to the repository root; spawn it with `process.execPath`. */
export interface HarnessCommand {
  name: HarnessName;
  argv: string[];
  out: string;
}

export const HARNESS_SCRIPTS: Readonly<Record<HarnessName, string>> = {
  roundtrip: "scripts/audit/wikios-roundtrip.ts",
  parity: "scripts/audit/wikios-render-parity.ts",
  bench: "scripts/bench/wikios-bench.ts",
};

/** The full round trip: the database, every namespace, no sampling. */
export function roundTripCommand(out: string): HarnessCommand {
  return {
    name: "roundtrip",
    out,
    argv: [
      HARNESS_SCRIPTS.roundtrip,
      "--source",
      "db",
      "--namespaces",
      "all",
      "--limit",
      "1000000",
      "--out",
      out,
    ],
  };
}

export function profileCommands(cfg: ProfileConfig): HarnessCommand[] {
  const parityOut = join(cfg.outDir, "parity.json");
  const benchOut = join(cfg.outDir, "bench.json");
  const sample = cfg.paritySample === "all" ? [] : ["--sample", String(cfg.paritySample)];
  return [
    roundTripCommand(join(cfg.outDir, "roundtrip.json")),
    {
      name: "parity",
      out: parityOut,
      argv: [
        HARNESS_SCRIPTS.parity,
        "--mw-api",
        cfg.mwApi,
        "--wikios",
        cfg.wikios,
        "--pages",
        cfg.corpusFile,
        ...sample,
        "--interval-ms",
        String(cfg.parityIntervalMs),
        "--out",
        parityOut,
      ],
    },
    {
      name: "bench",
      out: benchOut,
      argv: [
        HARNESS_SCRIPTS.bench,
        "--mw",
        cfg.mw,
        "--wikios",
        cfg.wikiosPublic,
        "--pages",
        cfg.benchPagesFile,
        "--runs",
        String(cfg.benchRuns),
        "--interval-ms",
        String(cfg.benchIntervalMs),
        "--out",
        benchOut,
      ],
    },
  ];
}

/** The profile's defaults under the flags, every URL checked, and the run's files in `outDir`. */
export function resolveRunConfig(
  profile: ProofProfile,
  overrides: RunOverrides,
  env: ProofEnv,
  outDir: string
): ProfileConfig {
  const merged: ProfileDefaults = { ...profileDefaults(profile, env), ...overrides };
  if (profile === "local" && merged.parityIntervalMs < LOCAL_MIN_INTERVAL_MS) {
    throw new Error(
      `the local profile asks classic MediaWiki at most once every ${LOCAL_MIN_INTERVAL_MS} ms: --parity-interval-ms must be >= ${LOCAL_MIN_INTERVAL_MS}`
    );
  }
  return {
    ...merged,
    mwApi: parseHttpUrl(merged.mwApi, "--mw-api"),
    wikios: parseHttpUrl(merged.wikios, "--wikios"),
    mw: parseHttpUrl(merged.mw, "--mw"),
    wikiosPublic: parseHttpUrl(merged.wikiosPublic, "--wikios-public"),
    outDir,
    corpusFile: join(outDir, "corpus-titles.json"),
    benchPagesFile: join(outDir, "bench-pages.json"),
  };
}

/** The bench's pages: the defaults first, then an even sample of the rest of the corpus, up to `pages`. */
export function benchPageList(
  defaults: readonly string[],
  corpus: readonly string[],
  pages: ProfileConfig["benchPages"]
): string[] {
  if (pages === "defaults") return [...defaults];
  const known = new Set(defaults);
  const rest = corpus.filter((title) => !known.has(title));
  if (pages === "all") return [...defaults, ...rest];
  return [...defaults.slice(0, pages), ...samplePages(rest, Math.max(0, pages - defaults.length))];
}

/** `yyyymmdd-HHMM` in UTC: the run directory's stamp. */
export function proofStamp(date: Date): string {
  const iso = date.toISOString();
  return `${iso.slice(0, 4)}${iso.slice(5, 7)}${iso.slice(8, 10)}-${iso.slice(11, 13)}${iso.slice(14, 16)}`;
}

const SERVER_RUN = /^\d{8}-\d{4}-(?:launch|recurring)$/;

/** The server run directories to delete, oldest first, keeping the newest `keep`; local runs and predeploy files never. */
export function runsToPrune(dirNames: readonly string[], keep: number): string[] {
  const runs = dirNames.filter((name) => SERVER_RUN.test(name)).sort();
  return runs.slice(0, Math.max(0, runs.length - keep));
}

export interface GitOutput {
  /** Exit status; null when git could not run. */
  status: number | null;
  stdout: string;
}

export interface TreeState {
  commit: string;
  treeKey: string;
  dirty: boolean;
}

/**
 * The commit, tree key and dirty flag from `git ls-tree -r HEAD`, `git status --porcelain` (both over
 * WIKIOS_PROOF_PATHS) and `git rev-parse HEAD`. Outside a git checkout: key "no-git" and dirty.
 */
export function treeState(lsTree: GitOutput, status: GitOutput, head: GitOutput): TreeState {
  if ([lsTree, status, head].some((output) => output.status !== 0)) {
    return { commit: "no-git", treeKey: "no-git", dirty: true };
  }
  return {
    commit: head.stdout.trim(),
    treeKey: wikiosTreeKey(lsTree.stdout),
    dirty: isTreeDirty(status.stdout),
  };
}

export type CliCommand =
  | { command: "help" }
  | {
      command: "run";
      profile: ProofProfile;
      overrides: RunOverrides;
      outDir: string | null;
      keep: number;
    }
  | {
      command: "gate";
      profile: ProofProfile;
      roundtrip: string;
      parity: string;
      bench: string | null;
      outDir: string | null;
    }
  | { command: "predeploy" };

const RUN_FLAGS = [
  "profile",
  "out-dir",
  "mw-api",
  "wikios",
  "mw",
  "wikios-public",
  "parity-sample",
  "parity-interval-ms",
  "bench-pages",
  "bench-runs",
  "keep",
] as const;
const GATE_FLAGS = ["profile", "roundtrip", "parity", "bench", "out-dir"] as const;
const COMMAND_FLAGS: Readonly<Record<"run" | "gate" | "predeploy", readonly string[]>> = {
  run: RUN_FLAGS,
  gate: GATE_FLAGS,
  predeploy: [],
};
const DEFAULT_KEEP = 12;

type Flags = Partial<Record<string, string>>;

/** The command's flags (another command's flag, a positional or a repeated value throws), or null for --help. */
function readFlags(args: string[], names: readonly string[]): Flags | null {
  const options: Record<string, { type: "string" | "boolean" }> = { help: { type: "boolean" } };
  for (const name of names) options[name] = { type: "string" };
  const { values } = parseArgs({ args, options, strict: true, allowPositionals: false });
  if (values.help === true) return null;
  const flags: Flags = {};
  for (const name of names) {
    const value = values[name];
    if (typeof value === "string") flags[name] = value;
  }
  return flags;
}

function parseProfile(value: string | undefined): ProofProfile {
  const profile = PROOF_PROFILES.find((name) => name === value);
  if (!profile) throw new Error("--profile must be local, launch or recurring");
  return profile;
}

function wholeNumber(value: string, flag: string, min: number): number {
  const parsed = /^\d+$/.test(value) ? Number(value) : Number.NaN;
  if (!(parsed >= min)) throw new Error(`${flag} must be a whole number >= ${min}`);
  return parsed;
}

const pageCount = (value: string, flag: string): PageCount =>
  value === "all" ? "all" : wholeNumber(value, flag, 1);

const optional = <T>(value: string | undefined, read: (raw: string) => T): T | undefined =>
  value === undefined ? undefined : read(value);

function runOverrides(flags: Flags): RunOverrides {
  const all: RunOverrides = {
    mwApi: flags["mw-api"],
    wikios: flags.wikios,
    mw: flags.mw,
    wikiosPublic: flags["wikios-public"],
    paritySample: optional(flags["parity-sample"], (raw) => pageCount(raw, "--parity-sample")),
    parityIntervalMs: optional(flags["parity-interval-ms"], (raw) =>
      wholeNumber(raw, "--parity-interval-ms", 0)
    ),
    benchPages: optional(flags["bench-pages"], (raw) => pageCount(raw, "--bench-pages")),
    benchRuns: optional(flags["bench-runs"], (raw) => wholeNumber(raw, "--bench-runs", 1)),
  };
  // Only the flags given: an undefined value would hide the profile's default when spread over it.
  const given: RunOverrides = {};
  for (const [key, value] of Object.entries(all)) {
    if (value !== undefined) Object.assign(given, { [key]: value });
  }
  return given;
}

function requiredFlag(flags: Flags, name: string): string {
  const value = flags[name];
  if (!value) throw new Error(`gate needs --${name} <report.json>`);
  return value;
}

/** Reads the CLI's arguments: `run`, `gate`, `predeploy`, or help. Throws a message for the usage line. */
export function parseCli(argv: readonly string[]): CliCommand {
  const [command, ...rest] = argv;
  if (command === undefined || command === "help" || command === "--help")
    return { command: "help" };
  if (command !== "run" && command !== "gate" && command !== "predeploy") {
    throw new Error(`unknown command "${command}": use run, gate or predeploy`);
  }
  const flags = readFlags(rest, COMMAND_FLAGS[command]);
  if (flags === null) return { command: "help" };
  if (command === "predeploy") return { command };
  const profile = parseProfile(flags.profile);
  const outDir = flags["out-dir"] ?? null;
  if (command === "run") {
    const keep = flags.keep === undefined ? DEFAULT_KEEP : wholeNumber(flags.keep, "--keep", 1);
    return { command, profile, overrides: runOverrides(flags), outDir, keep };
  }
  const roundtrip = requiredFlag(flags, "roundtrip");
  const parity = requiredFlag(flags, "parity");
  return { command, profile, roundtrip, parity, bench: flags.bench ?? null, outDir };
}

// ---------------------------------------------------------------------------
// CLI: the checks around the gate
// ---------------------------------------------------------------------------

export interface HarnessExit {
  name: HarnessName;
  /** Exit code; null when the child was killed by a signal. */
  code: number | null;
}

/** A harness that exited non-zero is a failed check of its own (its report may be partial or missing). */
function harnessChecks(exits: readonly HarnessExit[]): Check[] {
  return exits
    .filter((exit) => exit.code !== 0)
    .map((exit) => ({
      name: `harness.${exit.name}`,
      passed: false,
      skipped: null,
      measured: exit.code === null ? "killed" : `exit ${exit.code}`,
      threshold: "exit 0",
    }));
}

const missingReport = (name: "roundTrip" | "parity"): Check => ({
  name: `${name}.report`,
  passed: false,
  skipped: null,
  measured: "no readable report",
  threshold: "a report",
});

/** A proof covers every namespace: a namespace-0 run must not pass once the page floor is set. */
function namespacesCheck(report: RoundTripReport): Check {
  const { namespaces } = report.meta;
  return {
    name: "roundTrip.namespaces",
    passed: namespaces === "all",
    skipped: null,
    measured: namespaces === undefined || namespaces === null ? "not recorded" : String(namespaces),
    threshold: "all",
  };
}

/** A parity report from before the settle retries recorded no render state, so its fallback count means nothing. */
function settleCheck(report: ParityReport): Check {
  const { settleMs } = report.meta;
  return {
    name: "parity.settleMs",
    passed: settleMs !== undefined,
    skipped: null,
    measured:
      settleMs === undefined
        ? "not recorded (a report from before the settle retries has no render state)"
        : `${settleMs} ms`,
    threshold: "recorded",
  };
}

function roundTripChecks(
  report: RoundTripReport | null,
  t: ProofThresholds,
  everyNamespace: boolean
): Check[] {
  if (!report) return [missingReport("roundTrip")];
  return [...(everyNamespace ? [namespacesCheck(report)] : []), ...evaluateRoundTrip(report, t)];
}

/** Every check of a `run` or `gate`: harness exits, then round trip, parity and bench. */
export function evaluateProof(
  profile: ProofProfile,
  reports: ProofReports,
  t: ProofThresholds,
  exits: readonly HarnessExit[]
): Check[] {
  const parity = reports.parity;
  return [
    ...harnessChecks(exits),
    ...roundTripChecks(reports.roundTrip, t, PROVING_PROFILES.has(profile)),
    ...(parity ? [settleCheck(parity), ...evaluateParity(parity, t)] : [missingReport("parity")]),
    ...evaluateBench(reports.bench, t, profile),
  ];
}

/** The pre-deploy checks: the committed proof covers this tree, and the full round trip is lossless. */
export function evaluatePredeploy(
  committed: CommittedProofResult,
  report: RoundTripReport | null,
  t: ProofThresholds,
  exit: HarnessExit
): Check[] {
  const proof: Check = {
    name: "proof.committed",
    passed: committed.ok,
    skipped: null,
    measured: committed.ok ? "covers this commit's WikiOS tree" : committed.reason,
    threshold: "a clean, passing local or launch proof of this WikiOS tree",
  };
  return [proof, ...harnessChecks([exit]), ...roundTripChecks(report, t, true)];
}

const PREDEPLOY_FIX = `run the local proof, ${README}`;

/** One line per check; exit 1 on any failure unless overridden, which marks each failure line instead. A skipped check does not count. */
export function predeployReport(
  checks: readonly Check[],
  override: boolean
): { lines: string[]; exitCode: 0 | 1 } {
  const lines = checks.map((check) => {
    if (check.skipped !== null) return `skip ${check.name}: ${check.measured} (${check.skipped})`;
    if (check.passed) return `ok   ${check.name}: ${check.measured}`;
    const line = `FAIL ${check.name}: ${check.measured} (needs ${check.threshold}). Fix: ${PREDEPLOY_FIX}`;
    return override ? `WIKIOS PROOF OVERRIDDEN: ${line}` : line;
  });
  // A skipped check does not count, as in buildSummary.
  const failed = checks.some((check) => !check.passed && check.skipped === null);
  return { lines, exitCode: failed && !override ? 1 : 0 };
}
