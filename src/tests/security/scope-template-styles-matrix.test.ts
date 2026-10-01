/** @jest-environment node */
// Plan 415 re-review (B1b): a bad-url token or a comment inside an unquoted url() makes a browser and the scoper's
// lexer disagree about where a sheet's structure is. This matrix puts every spelling of `url(` against every body that
// could set them apart (quotes, parens, controls, escapes, comments) in every place a url can sit, with an unscoped
// `body{display:none}` after it. Whatever the scoper keeps, lightningcss (the oracle) must find nothing out of bounds.
import { violations, OWN_ORIGIN } from "../../../scripts/lib/template-styles-oracle";
import { scopeTemplateStyles } from "~/lib/utils/scope-template-styles";

/** Seven spellings of the function name `url(`. */
const NAMES = ["url(", "URL(", "UrL(", "\\75 rl(", "u\\72l(", "\\000075rl(", "\\75\\72\\6c("];

/** Twenty-nine arguments, each a way the url's text and its quoting can be read two ways. */
const BODIES = [
  `x"y`, `x'y`, `x(y`, `x y`, `x\ty`, `x\ny`, `x\fy`, `x\u0003y`, `x\u000by`, `x\u007fy`, `x\\\ny`, `x\\`,
  `a/*)*/"y`, `a/*)*/'y`, `a/*)*/ "y`, `a/*(*/ "y`, `/*)*/a "y`, `a/**/"y`, `/**/"y`, `a/*"*/b`, `a/*;}body{display:none}*/b`,
  `a\\29 "y`, `a\\)"y`, `a\\\\)"y`, `"y`, ` "y`, `\n"y`, `a)"y`, `a))"y`,
];

/** Eight places a url can sit, each followed by an unscoped rule a lexer fooled about the structure would keep. */
const CONTEXTS: ReadonlyArray<(fn: string) => string> = [
  (f) => `.a{background:${f};}body{display:none}.b{background:${f}}`,
  (f) => `.a{background:${f}}body{display:none}.b{background:${f}}`,
  (f) => `.a:is(${f}){color:red}body{display:none}.b:is(${f}){color:red}`,
  (f) => `@media screen{.a{background:${f};}}body{display:none}.b{background:${f}}`,
  (f) => `${f}{color:red}body{display:none}${f}{color:red}`,
  (f) => `.a{background:${f};}body{display:none}`,
  (f) => `.a{background:${f};}body{display:none}/*"*/ )}`,
  (f) => `.a{background:${f};}body{display:none}/*'*/ )}`,
];

describe("url( spellings x bodies x contexts", () => {
  it("lets nothing out of bounds through: 7 x 29 x 8 = 1624 sheets, 0 bypasses", () => {
    const bypasses: string[] = [];
    let total = 0;
    for (const name of NAMES) {
      for (const body of BODIES) {
        for (const context of CONTEXTS) {
          total++;
          const css = context(`${name}${body})`);
          const found = violations(scopeTemplateStyles(css, OWN_ORIGIN));
          if (found.length > 0) bypasses.push(`${JSON.stringify(css)} => ${found[0]}`);
        }
      }
    }

    expect(total).toBe(1624);
    expect(bypasses).toEqual([]);
  });
});
