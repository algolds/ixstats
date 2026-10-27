/**
 * Syntax-checks the process entrypoints with `node --check` (plan 326). No import resolution,
 * no execution. Entrypoints listed under `entrypoints` in test-quarantine.json are known-broken:
 * they are reported as warnings while broken and as errors once they parse again.
 *
 *   bun scripts/verification/check-entrypoints.ts
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { loadQuarantine, QUARANTINE_PATH } from "./run-jest-with-quarantine";

export const ENTRYPOINTS = ["server.mjs", "cron-runner.mjs", "ws-backend.mjs"];

export interface EntrypointResult {
  file: string;
  ok: boolean;
  output: string;
}

export interface Evaluation {
  errors: string[];
  warnings: string[];
}

export function checkEntrypoint(
  file: string,
  rootDir: string = process.cwd()
): { ok: boolean; output: string } {
  const result = spawnSync("node", ["--check", file], { cwd: rootDir, encoding: "utf-8" });
  if (result.error) throw result.error;
  return { ok: result.status === 0, output: `${result.stdout}${result.stderr}`.trim() };
}

/** `knownBroken` maps a quarantined entrypoint path to its owner. */
export function evaluate(
  results: EntrypointResult[],
  knownBroken: Map<string, string>
): Evaluation {
  const evaluation: Evaluation = { errors: [], warnings: [] };
  for (const result of results) {
    const owner = knownBroken.get(result.file);
    if (!result.ok && owner === undefined) {
      evaluation.errors.push(`${result.file} fails node --check:\n${result.output}`);
    } else if (!result.ok) {
      evaluation.warnings.push(`${result.file} still broken (owner: ${owner})`);
    } else if (owner !== undefined) {
      evaluation.errors.push(
        `${result.file} now parses — remove it from test-quarantine.json entrypoints`
      );
    }
  }
  return evaluation;
}

export function main(rootDir: string = process.cwd()): number {
  const quarantine = loadQuarantine(path.join(rootDir, QUARANTINE_PATH));
  const knownBroken = new Map(quarantine.entrypoints.map((entry) => [entry.path, entry.owner]));
  const results = ENTRYPOINTS.map((file) => ({ file, ...checkEntrypoint(file, rootDir) }));
  const { errors, warnings } = evaluate(results, knownBroken);
  for (const warning of warnings) console.warn(`[entrypoints] warning: ${warning}`);
  for (const error of errors) console.error(`[entrypoints] error: ${error}`);
  console.log(
    `[entrypoints] checked ${results.length}: ${errors.length} error(s), ${warnings.length} known-broken`
  );
  return errors.length > 0 ? 1 : 0;
}

if (import.meta.main || process.argv[1]?.endsWith("check-entrypoints.ts")) {
  process.exit(main());
}
