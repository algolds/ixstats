/** @jest-environment node */
// Plan 415 re-review: the exact-oracle gate for the TemplateStyles scoper. Seeded generators (scripts/lib/
// template-styles-fuzz.ts) make 20,000 hostile sheets each, aimed at the places the scoper's lexer and a browser
// can disagree (comments, parens and quotes in url(), escapes, hosts, sibling combinators). Whatever the scoper
// keeps is parsed by lightningcss, a spec CSS parser: a selector that can match outside `.mw-parser-output`, an
// at-rule but @media, a url() to another host, a script hook or an attr() is a violation, and an output that
// scoping again changes is non-idempotent. Both must be 0. For a deep run: `bun run audit:template-styles`.
import { GENERATORS, runGenerator } from "../../../scripts/lib/template-styles-fuzz";

const ITERATIONS = 20_000;
/** A generator whose sheets all came out empty would pass for nothing: at least this many must survive to be judged. */
const MIN_JUDGED = 200;

describe.each(Object.keys(GENERATORS))("generator %s", (name) => {
  it(`${ITERATIONS} sheets: 0 violations, 0 non-idempotent outputs`, () => {
    const report = runGenerator(name, ITERATIONS);

    expect(report.samples).toEqual([]);
    expect(report.violationCount).toBe(0);
    expect(report.nonIdempotentCount).toBe(0);
    expect(report.ran).toBe(ITERATIONS);
    expect(report.nonEmpty).toBeGreaterThanOrEqual(MIN_JUDGED);
  });
});
