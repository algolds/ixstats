/**
 * Runs Jest with a checked-in, shrink-only quarantine of known-failing test files (plan 326).
 *
 *   bun scripts/verification/run-jest-with-quarantine.ts                       # validate, then run Jest skipping quarantined files
 *   bun scripts/verification/run-jest-with-quarantine.ts --compare-base <ref>  # also reject quarantine growth vs <ref>
 *   bun scripts/verification/run-jest-with-quarantine.ts --verify-quarantine   # list quarantined files that now pass
 *
 * Any other argument is forwarded to Jest.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const QUARANTINE_PATH = "scripts/verification/test-quarantine.json";

export interface QuarantineEntry {
  path: string;
  reason: string;
  owner: string;
}

export interface QuarantineFile {
  ceiling: number;
  tests: QuarantineEntry[];
  entrypoints: QuarantineEntry[];
}

export interface CliOptions {
  compareBase: string | null;
  verify: boolean;
  jestArgs: string[];
}

export interface JestReport {
  testResults: { name: string; status: string }[];
}

interface RawEntry {
  path?: string;
  reason?: string;
  owner?: string;
}

interface RawQuarantine {
  ceiling?: number;
  tests?: (RawEntry | null)[];
  entrypoints?: (RawEntry | null)[];
}

function toEntry(raw: RawEntry | null, index: number, field: string): QuarantineEntry {
  if (
    typeof raw?.path !== "string" ||
    typeof raw.reason !== "string" ||
    typeof raw.owner !== "string"
  ) {
    throw new Error(`"${field}[${index}]" must have string path, reason and owner`);
  }
  return { path: raw.path, reason: raw.reason, owner: raw.owner };
}

function toEntries(raw: (RawEntry | null)[] | undefined, field: string): QuarantineEntry[] {
  if (!Array.isArray(raw)) {
    throw new Error(`"${field}" must be an array`);
  }
  return raw.map((entry, index) => toEntry(entry, index, field));
}

export function parseQuarantine(text: string, source: string): QuarantineFile {
  const raw: RawQuarantine | null = JSON.parse(text);
  if (typeof raw?.ceiling !== "number") {
    throw new Error(`${source}: "ceiling" must be a number`);
  }
  return {
    ceiling: raw.ceiling,
    tests: toEntries(raw.tests, "tests"),
    entrypoints: toEntries(raw.entrypoints, "entrypoints"),
  };
}

export function loadQuarantine(file: string): QuarantineFile {
  return parseQuarantine(fs.readFileSync(file, "utf-8"), file);
}

function isFile(file: string): boolean {
  return fs.existsSync(file) && fs.statSync(file).isFile();
}

function validateEntry(entry: QuarantineEntry, rootDir: string, seen: Set<string>): string[] {
  const errors: string[] = [];
  if (seen.has(entry.path)) errors.push(`duplicate path: ${entry.path}`);
  seen.add(entry.path);
  if (!isFile(path.join(rootDir, entry.path))) errors.push(`path does not exist: ${entry.path}`);
  if (!entry.reason.trim()) errors.push(`empty reason: ${entry.path}`);
  if (!entry.owner.trim()) errors.push(`empty owner: ${entry.path}`);
  return errors;
}

export function validateQuarantine(q: QuarantineFile, rootDir: string): string[] {
  const errors: string[] = [];
  if (q.ceiling !== q.tests.length) {
    errors.push(`ceiling is ${q.ceiling} but tests has ${q.tests.length} entries; they must match`);
  }
  const seen = new Set<string>();
  for (const entry of [...q.tests, ...q.entrypoints]) {
    errors.push(...validateEntry(entry, rootDir, seen));
  }
  return errors;
}

export function findGrowth(current: QuarantineFile, base: QuarantineFile): string[] {
  const basePaths = new Set([...base.tests, ...base.entrypoints].map((entry) => entry.path));
  return [...current.tests, ...current.entrypoints]
    .filter((entry) => !basePaths.has(entry.path))
    .map(
      (entry) =>
        `${entry.path} is not quarantined on the base branch; the quarantine may only shrink`
    );
}

export function toIgnorePattern(relPath: string): string {
  return `<rootDir>/${relPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`;
}

export function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = { compareBase: null, verify: false, jestArgs: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--compare-base") {
      options.compareBase = argv[++i] ?? null;
    } else if (arg === "--verify-quarantine") {
      options.verify = true;
    } else if (arg !== "--") {
      options.jestArgs.push(arg);
    }
  }
  return options;
}

export function findPassing(
  tests: QuarantineEntry[],
  report: JestReport,
  rootDir: string
): string[] {
  const passed = new Set(
    report.testResults
      .filter((result) => result.status === "passed")
      .map((result) => path.relative(rootDir, result.name))
  );
  return tests.map((entry) => entry.path).filter((testPath) => passed.has(testPath));
}

function readBaseQuarantine(ref: string, rootDir: string): QuarantineFile | null {
  const result = spawnSync("git", ["show", `${ref}:${QUARANTINE_PATH}`], {
    cwd: rootDir,
    encoding: "utf-8",
  });
  if (result.status !== 0) return null;
  return parseQuarantine(result.stdout, `${ref}:${QUARANTINE_PATH}`);
}

function growthErrors(ref: string | null, current: QuarantineFile, rootDir: string): string[] {
  if (ref === null) return [];
  const base = readBaseQuarantine(ref, rootDir);
  if (base === null) {
    console.log("[quarantine] no base to compare, skipping growth check");
    return [];
  }
  return findGrowth(current, base);
}

function runJest(args: string[], rootDir: string): number {
  const result = spawnSync("bunx", ["jest", "--ci", ...args], { cwd: rootDir, stdio: "inherit" });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

function verifyQuarantine(q: QuarantineFile, rootDir: string): number {
  if (q.tests.length === 0) return 0;
  const outFile = path.join(os.tmpdir(), `jest-quarantine-verify-${process.pid}.json`);
  try {
    runJest(
      ["--json", `--outputFile=${outFile}`, "--runTestsByPath", ...q.tests.map((t) => t.path)],
      rootDir
    );
    const report: JestReport = JSON.parse(fs.readFileSync(outFile, "utf-8"));
    const passing = findPassing(q.tests, report, rootDir);
    for (const testPath of passing) {
      console.log(`${testPath} passes — remove it from test-quarantine.json and lower ceiling`);
    }
    return passing.length > 0 ? 1 : 0;
  } finally {
    fs.rmSync(outFile, { force: true });
  }
}

export function main(argv: string[], rootDir: string = process.cwd()): number {
  const options = parseArgs(argv);
  const quarantine = loadQuarantine(path.join(rootDir, QUARANTINE_PATH));
  const errors = [
    ...validateQuarantine(quarantine, rootDir),
    ...growthErrors(options.compareBase, quarantine, rootDir),
  ];
  if (errors.length > 0) {
    for (const error of errors) console.error(`[quarantine] ${error}`);
    return 1;
  }
  if (options.verify) return verifyQuarantine(quarantine, rootDir);
  const ignoreArgs = [
    "<rootDir>/node_modules/",
    ...quarantine.tests.map((t) => toIgnorePattern(t.path)),
  ];
  console.log(`[quarantine] skipping ${quarantine.tests.length} quarantined test file(s)`);
  return runJest(
    [...ignoreArgs.map((pattern) => `--testPathIgnorePatterns=${pattern}`), ...options.jestArgs],
    rootDir
  );
}

if (import.meta.main || process.argv[1]?.endsWith("run-jest-with-quarantine.ts")) {
  process.exit(main(process.argv.slice(2)));
}
