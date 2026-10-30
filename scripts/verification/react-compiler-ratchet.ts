/**
 * React Compiler skip ratchet. Runs babel-plugin-react-compiler over every non-test .ts/.tsx file
 * in src/ and counts the functions it silently skips (CompileError + PipelineError events) per
 * file. A file may not skip more than its baseline; drops must be locked in with --update.
 *
 *   bun run check:compiler            # exit 1 when a count grew or fell
 *   bun run check:compiler --update   # rewrite the baseline (keys sorted)
 */
import { transformSync } from "@babel/core";
import reactCompiler, { type LoggerEvent } from "babel-plugin-react-compiler";
import fs from "node:fs";
import path from "node:path";
import { compareToBaseline } from "../../src/lib/verification/compiler-ratchet";

const ROOT = path.resolve(__dirname, "../..");
const BASELINE = path.join(__dirname, "react-compiler-ratchet.baseline.json");
const SKIPPED_DIRS = /^(node_modules|__tests__|\.next)$/;
const TEST_OR_TYPES = /\.(test|spec|d)\.tsx?$/;
const COMPILABLE = /use[A-Z]|<[A-Za-z]/;
const REASON_MAX = 110;

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return SKIPPED_DIRS.test(entry.name) ? [] : walk(full);
    return /\.tsx?$/.test(entry.name) && !TEST_OR_TYPES.test(entry.name) ? [full] : [];
  });
}

function firstReasonLine(event: LoggerEvent): string {
  if (event.kind === "PipelineError") return event.data.split("\n")[0].slice(0, REASON_MAX);
  if (event.kind === "CompileError") return event.detail.reason.split("\n")[0].slice(0, REASON_MAX);
  return "";
}

interface FileScan {
  count: number;
  reason: string;
}

function scanFile(file: string): FileScan {
  const scan: FileScan = { count: 0, reason: "" };
  const code = fs.readFileSync(file, "utf8");
  if (!COMPILABLE.test(code)) return scan;
  const logEvent = (_name: string | null, event: LoggerEvent): void => {
    if (event.kind !== "CompileError" && event.kind !== "PipelineError") return;
    scan.count += 1;
    if (scan.reason === "") scan.reason = firstReasonLine(event);
  };
  try {
    transformSync(code, {
      filename: file,
      babelrc: false,
      configFile: false,
      code: false,
      ast: false,
      parserOpts: { plugins: ["typescript", "jsx"] },
      plugins: [[reactCompiler, { panicThreshold: "none", logger: { logEvent } }]],
    });
  } catch (error) {
    scan.count += 1;
    if (scan.reason === "") scan.reason = `threw: ${String(error).split("\n")[0].slice(0, REASON_MAX)}`;
  }
  return scan;
}

function scanSrc(): { counts: Record<string, number>; reasons: Record<string, string> } {
  const counts: Record<string, number> = {};
  const reasons: Record<string, string> = {};
  for (const file of walk(path.join(ROOT, "src"))) {
    const scan = scanFile(file);
    if (scan.count === 0) continue;
    const rel = path.relative(ROOT, file);
    counts[rel] = scan.count;
    reasons[rel] = scan.reason;
  }
  return { counts, reasons };
}

function sortKeys(counts: Record<string, number>): Record<string, number> {
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

function report(lines: string[], reasons: Record<string, string>): void {
  for (const line of lines) {
    const file = line.slice(0, line.indexOf(":"));
    console.error(reasons[file] ? `  ${line}  (${reasons[file]})` : `  ${line}`);
  }
}

function main(): number {
  const { counts, reasons } = scanSrc();
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
  console.log(`[compiler] ${total} skipped functions in ${Object.keys(counts).length} files`);

  if (process.argv.includes("--update")) {
    fs.writeFileSync(BASELINE, `${JSON.stringify(sortKeys(counts), null, 2)}\n`);
    console.log(`[compiler] baseline written to ${path.relative(ROOT, BASELINE)}`);
    return 0;
  }

  const baseline = JSON.parse(fs.readFileSync(BASELINE, "utf8")) as Record<string, number>;
  const { grew, fell } = compareToBaseline(counts, baseline);
  if (grew.length > 0) {
    console.error("[compiler] the React Compiler skips more functions than the baseline allows:");
    report(grew, reasons);
  }
  if (fell.length > 0) {
    console.error("[compiler] fewer skips than the baseline:");
    report(fell, reasons);
    console.error("lock it in: bun run check:compiler --update");
  }
  return grew.length > 0 || fell.length > 0 ? 1 : 0;
}

process.exit(main());
