/** @jest-environment node */
// Plan 415 re-review: the exact-oracle gate for the TemplateStyles scoper. Seeded generators (scripts/lib/
// template-styles-fuzz.ts) make 20,000 hostile sheets each, aimed at the places the scoper's lexer and a browser
// can disagree (comments, parens and quotes in url(), url( inside strings, escapes, hosts, sibling combinators).
// Whatever the scoper keeps is read by two independent judges, lightningcss (a spec CSS parser) and the @csstools
// tokenizer: a selector that can match outside `.mw-parser-output`, an at-rule but @media, a url() to another host,
// a script hook, an attr() or a `<` is a violation, and an output that scoping again changes is non-idempotent. All
// must be 0. For a deep run: `bun run audit:template-styles`.
import { GENERATORS, runGenerator } from "../../../scripts/lib/template-styles-fuzz";
import { violations } from "../../../scripts/lib/template-styles-oracle";
import { tokenViolations } from "../../../scripts/lib/template-styles-oracle-tokens";

const ITERATIONS = 20_000;
/** A generator whose sheets all came out empty would pass for nothing: at least this many must survive to be judged. */
const MIN_JUDGED = 200;

describe.each(Object.keys(GENERATORS))("generator %s", (name) => {
  it(`${ITERATIONS} sheets: 0 violations in either oracle, 0 non-idempotent outputs`, () => {
    const report = runGenerator(name, ITERATIONS);

    expect(report.samples).toEqual([]);
    expect(report.violationCount).toBe(0);
    expect(report.tokenViolationCount).toBe(0);
    expect(report.nonIdempotentCount).toBe(0);
    expect(report.ran).toBe(ITERATIONS);
    expect(report.nonEmpty).toBeGreaterThanOrEqual(MIN_JUDGED);
  });
});

// A gate that cannot fail is no gate: each oracle must flag the shapes it exists to catch, and pass a clean sheet.
describe.each([
  ["lightningcss", violations],
  ["token", tokenViolations],
] as const)("the %s oracle", (_name, judge) => {
  it.each([
    [".mw-parser-output .a{color:red}"],
    [".mw-parser-output:hover > p, .mw-parser-output .b{color:red}"],
    ["@media screen{.mw-parser-output .a{color:red}}"],
    [".mw-parser-output .a{background:url(https://ixwiki.com/x)}"],
    [".mw-parser-output .a{background:url(/x.png);content:'url(' \"url(a)\"}"],
  ])("passes %s", (css) => {
    expect(judge(css)).toEqual([]);
  });

  it.each([
    ["a sibling of the root", ".mw-parser-output ~ x{color:red}"],
    ["a sibling after whitespace", ".mw-parser-output + x{color:red}"],
    ["an unscoped rule", "body{display:none}"],
    ["an unscoped rule behind a bad url", '.mw-parser-output .a{background:url(x"y);}body{display:none}'],
    ["an escaped root followed by a sibling combinator", ".mw-parser-output\\ ~ x{color:red}"],
    ["@font-face", "@font-face{src:url(a)}"],
    ["an unscoped rule inside @media", "@media screen{body{color:red}}"],
    ["a foreign quoted url", '.mw-parser-output .a{background:url("https://evil.example/x")}'],
    ["a foreign bare url", ".mw-parser-output .a{background:url(https://evil.example/x)}"],
    ["a protocol-relative url", ".mw-parser-output .a{background:url(//evil.example/x)}"],
    ["attr()", ".mw-parser-output .a{content:attr(data-src url)}"],
    ["image-set()", '.mw-parser-output .a{background:image-set("a.png" 1x)}'],
    ["a `<`", '.mw-parser-output .a{content:"</style>"}'],
  ])("flags %s", (_what, css) => {
    expect(judge(css)).not.toEqual([]);
  });
});
