/**
 * scripts/perf/atlas-bench-report.ts - the acceptance table of `bun run perf:atlas` (atlas-bench.ts): one result per
 * target, how it prints, and the exit code. Pure, so it is unit-tested without a database
 * (src/tests/scripts/atlas-bench-report.test.ts).
 *
 * A value that was not measured (NaN, Infinity) fails its target: a broken measurement must not read as a pass.
 */

export interface TargetResult {
  /** What is measured, e.g. "layer route hit, event-loop block". */
  name: string;
  /** The measured value with its unit, as printed. */
  measured: string;
  /** The limit with its comparison, as printed. */
  target: string;
  pass: boolean;
  /** Supporting numbers (cold times, per-bucket values), printed under the line. */
  detail?: string;
}

/** Starts the line a child run of the benchmark prints its result on, among whatever else the process logs. */
export const RESULT_MARKER = "ATLAS_BENCH_RESULT ";

/** The text after the marker on the last line that has one, else null. */
export function markedPayload(stdout: string): string | null {
  const line = stdout
    .split("\n")
    .filter((text) => text.startsWith(RESULT_MARKER))
    .at(-1);
  return line === undefined ? null : line.slice(RESULT_MARKER.length);
}

/** The middle of `values` (the mean of the middle two for an even count); NaN for none. */
export function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length === 0) return Number.NaN;
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** 0.314 -> "0.31", 3.2 -> "3.2", 512.4 -> "512": two decimals under 100, whole numbers above. */
function formatNumber(value: number): string {
  return Number.isFinite(value)
    ? String(Number(value.toFixed(Math.abs(value) >= 100 ? 0 : 2)))
    : String(value);
}

const withUnit = (value: number, unit: string) => `${formatNumber(value)}${unit ? ` ${unit}` : ""}`;

/** The measurement must be at most `limit`. */
export function atMost(
  name: string,
  value: number,
  limit: number,
  unit: string,
  detail?: string
): TargetResult {
  return {
    name,
    measured: withUnit(value, unit),
    target: `<= ${withUnit(limit, unit)}`,
    pass: Number.isFinite(value) && value <= limit,
    detail,
  };
}

/** The measurement must be exactly `expected` (a count, an HTTP status). */
export function exactly(
  name: string,
  value: number,
  expected: number,
  unit: string,
  detail?: string
): TargetResult {
  return {
    name,
    measured: withUnit(value, unit),
    target: `= ${withUnit(expected, unit)}`,
    pass: Number.isFinite(value) && value === expected,
    detail,
  };
}

/** The measured text must be the expected text (a header). */
export function matches(
  name: string,
  measured: string,
  expected: string,
  detail?: string
): TargetResult {
  return { name, measured, target: expected, pass: measured === expected, detail };
}

/** 1 when any target fails, or when nothing was measured; else 0. */
export function exitCode(results: readonly TargetResult[]): 0 | 1 {
  return results.length > 0 && results.every((result) => result.pass) ? 0 : 1;
}

const widest = (texts: readonly string[]) => Math.max(0, ...texts.map((text) => text.length));

/** PASS/FAIL, name, measured value and target per line, the detail beneath it, and a count of passing targets. */
export function renderResults(results: readonly TargetResult[]): string {
  const nameWidth = widest(results.map((result) => result.name));
  const measuredWidth = widest(results.map((result) => result.measured));
  const lines = results.flatMap((result) => [
    `${result.pass ? "PASS" : "FAIL"}  ${result.name.padEnd(nameWidth)}  ${result.measured.padEnd(measuredWidth)}  ${result.target}`,
    ...(result.detail ? [`      ${result.detail}`] : []),
  ]);
  const passing = results.filter((result) => result.pass).length;
  return [...lines, `${passing} of ${results.length} targets pass`].join("\n");
}
