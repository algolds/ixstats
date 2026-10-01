/**
 * scripts/audit/fuzz-template-styles.ts: a deep run of the exact-oracle fuzzer for the TemplateStyles scoper (plan 415).
 *
 * The Jest gate (`src/tests/security/scope-template-styles-oracle.test.ts`) runs ~20k sheets per generator with fixed
 * seeds. This is the same code with the counts up, for a manual pass after any change to
 * `src/lib/utils/scope-template-styles.ts` or when a CSS bypass is reported. Lightningcss (a spec CSS parser) parses
 * what the scoper emits; a selector that can match outside `.mw-parser-output`, an at-rule other than `@media`, a
 * `url()` to a host other than the wiki's, a script hook or an `attr()` is a violation; an output that scoping again
 * changes is non-idempotent. Both must be 0. Exit code 1 otherwise.
 *
 * Usage:
 *   bun scripts/audit/fuzz-template-styles.ts                         # 300000 per generator, the generators' own seeds
 *   bun scripts/audit/fuzz-template-styles.ts --iterations=1000000    # more
 *   bun scripts/audit/fuzz-template-styles.ts --only=host,sibling --seed=99
 */
import { GENERATORS, runGenerator } from "../lib/template-styles-fuzz";

function option(name: string): string | undefined {
  return process.argv.find((argument) => argument.startsWith(`--${name}=`))?.slice(name.length + 3);
}

const iterations = Number(option("iterations") ?? 300_000);
const seedOption = option("seed");
const only = option("only")?.split(",");
const names = Object.keys(GENERATORS).filter((name) => !only || only.includes(name));
if (names.length === 0 || !Number.isInteger(iterations) || iterations < 1) {
  console.error(`usage: fuzz-template-styles.ts [--iterations=N] [--seed=N] [--only=${Object.keys(GENERATORS).join(",")}]`);
  process.exit(2);
}

let failed = false;
for (const name of names) {
  const started = Date.now();
  const report = runGenerator(name, iterations, seedOption === undefined ? undefined : Number(seedOption));
  for (const sample of report.samples) console.log(sample);
  console.log(
    `${name.padEnd(12)} ran=${report.ran} nonEmpty=${report.nonEmpty} violations=${report.violationCount} ` +
      `nonIdempotent=${report.nonIdempotentCount} (${((Date.now() - started) / 1000).toFixed(1)} s)`
  );
  failed ||= report.violationCount > 0 || report.nonIdempotentCount > 0;
}
process.exit(failed ? 1 : 0);
