/** @jest-environment node */
// Plan 415 (COMPAT-10): the filter every TemplateStyles `<style>` of an article goes through. It scopes
// each selector under the article's root (`.mw-parser-output`), keeps `@media`, and drops everything that could load, run or
// reach outside the article. It fails closed: what it cannot read with certainty it does not emit.
import {
  ARTICLE_STYLE_ROOT_CLASS,
  ARTICLE_STYLE_SCOPE,
  scopeTemplateStyles,
} from "~/lib/utils/scope-template-styles";

const S = ARTICLE_STYLE_SCOPE;
const OWN_ORIGIN = "https://ixwiki.com";

describe("scoping", () => {
  it("prefixes a selector with the article root", () => {
    expect(scopeTemplateStyles(".home-grid{display:grid}")).toBe(`${S} .home-grid{display:grid}`);
  });

  it("scopes every selector of a list, whatever combinators and pseudo-classes it holds", () => {
    expect(scopeTemplateStyles("h2, .a > .b:hover, a[href^='https'] + p {color:red}")).toBe(
      `${S} h2,${S} .a > .b:hover,${S} a[href^='https'] + p{color:red}`
    );
  });

  it("does not split a selector list inside :is(), :not() or an attribute string", () => {
    expect(scopeTemplateStyles(":is(.a, .b) .c, [data-x='a,b'] {color:red}")).toBe(
      `${S} :is(.a, .b) .c,${S} [data-x='a,b']{color:red}`
    );
  });

  it("scopes a selector that tries to name the page (`body`, `html`, `:root`, `*`)", () => {
    expect(scopeTemplateStyles("body, html, :root, * {display:none}")).toBe(
      `${S} body,${S} html,${S} :root,${S} *{display:none}`
    );
  });

  it.each([
    [".mw-parser-output .infobox{color:red}", `${S} .infobox{color:red}`],
    [".mw-parser-output > p{color:red}", `${S} > p{color:red}`],
    [".mw-parser-output.wide{color:red}", `${S}.wide{color:red}`],
    [".mw-parser-output{color:red}", `${S}{color:red}`],
    [".mw-parser-output-x .a{color:red}", `${S} .mw-parser-output-x .a{color:red}`],
  ])("keeps MediaWiki's own root selector as it is, the root being that class: %s", (css, expected) => {
    expect(scopeTemplateStyles(css)).toBe(expected);
  });

  it("confines a sheet to the class the reader gives the article's parts, MediaWiki's own", () => {
    expect(S).toBe(".mw-parser-output");
    expect(ARTICLE_STYLE_ROOT_CLASS).toBe("mw-parser-output");
    // a MediaWiki selector means what it meant: the root's children are the article's own elements
    expect(scopeTemplateStyles(".mw-parser-output > .infobox{color:red}")).toBe(".mw-parser-output > .infobox{color:red}");
    // a selector of anything else is a descendant of the root, never the root's ancestor or sibling
    expect(scopeTemplateStyles("body, .wikios-article, .wikios-header{display:none}")).toBe(
      ".mw-parser-output body,.mw-parser-output .wikios-article,.mw-parser-output .wikios-header{display:none}"
    );
  });

  it("is idempotent: CSS already scoped is not scoped again", () => {
    const once = scopeTemplateStyles(".mw-parser-output .a, .b{color:red} @media print{.c{color:blue}}");

    expect(scopeTemplateStyles(once)).toBe(once);
    expect(scopeTemplateStyles(`${S}-main .a{color:red}`)).toBe(`${S} ${S}-main .a{color:red}`);
  });

  it("keeps @media and scopes the rules inside, nested @media included", () => {
    expect(scopeTemplateStyles("@media (max-width: 600px) and (min-width:100px){.a{color:red}}")).toBe(
      `@media (max-width: 600px) and (min-width:100px){${S} .a{color:red}}`
    );
    expect(scopeTemplateStyles("@media screen{@media (min-width:1px){.a{color:red}}}")).toBe(
      `@media screen{@media (min-width:1px){${S} .a{color:red}}}`
    );
    expect(scopeTemplateStyles("@media screen{@media a{@media b{@media c{.a{color:red}}}}}")).toBe("");
  });

  it("keeps rules after an @media block and drops an @media with nothing left", () => {
    expect(scopeTemplateStyles("@media print{.a{behavior:url(x)}} .b{color:red}")).toBe(`${S} .b{color:red}`);
  });

  it.each([
    "@import url(https://evil.example/x.css);",
    '@import "https://evil.example/x.css";',
    "@charset 'utf-8';",
    "@namespace svg url(http://www.w3.org/2000/svg);",
    "@font-face{font-family:x;src:url(https://x.example/f.woff)}",
    "@keyframes spin{from{opacity:0}to{opacity:1}}",
    "@supports (display:grid){.a{display:grid}}",
    "@layer base{.a{color:red}}",
    "@container (min-width:1px){.a{color:red}}",
    "@page{margin:0}",
    "@\\69mport 'https://evil.example/x.css';",
    "@\\6d edia print{.a{color:red}}",
  ])("drops the at-rule %s with its block, keeping the rule after it", (atRule) => {
    expect(scopeTemplateStyles(`${atRule} .ok{color:red}`)).toBe(`${S} .ok{color:red}`);
  });

  it.each(["@media url(x){.a{color:red}}", "@media expression(1){.a{color:red}}", "@media a;b{.a{color:red}}", "@media (a\\){.a{color:red}}"])(
    "drops an @media whose query is not plain: %s",
    (css) => {
      expect(scopeTemplateStyles(css)).toBe("");
    }
  );

  it("removes comments, and a comment cannot join two tokens", () => {
    expect(scopeTemplateStyles("/* a */ .a /* b */ {color /* c */ : red /* d */}").replace(/\s+/g, " ")).toBe(
      `${S} .a{color : red}`
    );
    expect(scopeTemplateStyles(".a{background:u/**/rl(javascript:alert(1))}")).not.toContain("url(");
  });

  it("keeps !important, custom properties, vendor properties and strings with braces and semicolons", () => {
    expect(scopeTemplateStyles(".a{color:red !important;--gap: 4px;-webkit-box-shadow:0 0 1px #000}")).toBe(
      `${S} .a{color:red !important;--gap: 4px;-webkit-box-shadow:0 0 1px #000}`
    );
    expect(scopeTemplateStyles('.a::after{content:"};}{ \\" ";color:red}')).toBe(
      `${S} .a::after{content:"};}{ \\" ";color:red}`
    );
  });

  it("answers an empty string for nothing, and drops a rule left without declarations", () => {
    expect(scopeTemplateStyles("")).toBe("");
    expect(scopeTemplateStyles("   /* only a comment */  ")).toBe("");
    expect(scopeTemplateStyles(".a{}")).toBe("");
    expect(scopeTemplateStyles(".a{behavior:url(x)} .b{color:red}")).toBe(`${S} .b{color:red}`);
  });
});

describe("declarations that load or run something", () => {
  const kept = (declaration: string) => scopeTemplateStyles(`.a{${declaration};color:red}`, OWN_ORIGIN);

  it.each([
    "background:url(https://ixwiki.com/images/a.png)",
    'background:url("https://ixwiki.com/images/a.png") no-repeat',
    "background-image:url('https://ixwiki.com/images/a.png')",
    "background:url(  https://ixwiki.com/images/a.png  )",
    "background:url(HTTPS://IXWIKI.COM/images/a.png)",
    "background:url(https://ixwiki.com:443/images/a.png)",
    "background:url(/images/a.png)",
    "background:url(images/a.png)",
    "background:url(../a.png)",
    "background:url(#fragment)",
    "background:linear-gradient(red, blue)",
  ])("keeps %s", (declaration) => {
    expect(kept(declaration)).toContain(declaration);
  });

  it.each([
    "background:url(https://x.example/a.png)",
    "background-image:url('https://x.example/a.png')",
    "background:url(  https://x.example/a.png  )",
    "background:url(//x.example/a.png)",
    "background:url(///x.example/a.png)",
    "background:url(\\\\\\\\x.example/a.png)", // CSS \\\\ is two backslashes, which the URL parser reads as "//"
    "background:url(/\\\\x.example/a.png)",
    "background:url(https:/x.example/a.png)",
    "background:url(https://ixwiki.com.evil.example/a.png)",
    "background:url(https://ixwiki.com@evil.example/a.png)",
    "background:url(https://evil.example/ixwiki.com)",
    "background:url(https://www.ixwiki.com/a.png)",
    "background:url(http://ixwiki.com/a.png)",
    "background:url(https://ixwiki.com:8443/a.png)",
    'background:url("https://ixwiki.com\\@x.example/a.png")',
    'background:url("https://\tx.example/a.png")',
    "background:url('javascript:alert(1)')",
    'background:url("javascript:alert(1)")',
    'background:url("data:image/svg+xml;base64,AAAA")',
    "background:url(data:text/html,x)",
    "background:url(http://x.example/a.png)",
    "background:url(ftp://x.example/a.png)",
    "background:url(file:///etc/passwd)",
    'background:url("java\tscript:alert(1)")',
    "background:URL('JAVASCRIPT:alert(1)')",
    "background:url(https://ok.example/a.png), url('javascript:alert(1)')",
    "background:u\\72l('javascript:alert(1)')",
    "background:\\75 rl('javascript:alert(1)')",
    "background:\\75rl(data:text/html,x)",
    "width:expression(alert(1))",
    "width:EXPRESSION (alert(1))",
    "width:exp\\72 ession(alert(1))",
    "behavior:url(x.htc)",
    "BEHAVIOR:url(x.htc)",
    "-ms-behavior:url(x.htc)",
    "-moz-binding:url(x.xml#a)",
    "b\\65 havior:url(x.htc)",
    "background:image-set('https://x.example/a.png' 1x)",
    "background:-webkit-image-set(url(https://x.example/a.png) 1x)",
    "background:image('https://x.example/a.png')",
    "background:cross-fade(url(a.png), url(b.png))",
    "background:element(#id)",
    "background:paint(worklet)",
    "content:src('x')",
    "x:javascript:alert(1)",
    "x:vbscript:alert(1)",
  ])("drops %s and keeps the declaration after it", (declaration) => {
    const out = kept(declaration);

    expect(out).toBe(`${S} .a{color:red}`);
  });

  it.each([
    "background:url(javascript:alert(1))",
    "background:URL(JAVASCRIPT:alert(1))",
    "background:u\\72l(javascript:alert(1))",
    "background:\\75 rl(javascript:alert(1))",
    "background:url(https://ok.example/a.png), url(javascript:alert(1))",
  ])("a url holding a paren is a bad url, which the browser reads to the first `)`: the sheet goes (%s)", (declaration) => {
    expect(kept(declaration)).toBe("");
  });

  it("names no absolute origin when none is given: only relative urls stay", () => {
    expect(scopeTemplateStyles(".a{background:url(https://ixwiki.com/a.png);color:red}")).toBe(`${S} .a{color:red}`);
    expect(scopeTemplateStyles(".a{background:url(/a.png);color:red}")).toBe(`${S} .a{background:url(/a.png);color:red}`);
  });

  it("resolves escapes the way a browser does: \\72e is one character, not `r` and `e`", () => {
    expect(kept("width:exp\\72ession(alert(1))")).toContain("width:exp\\72ession(alert(1))");
  });

  it("drops an unreadable declaration without touching the rest of the rule", () => {
    expect(scopeTemplateStyles(".a{color:red;nonsense;:x;1a:b;display:block}")).toBe(
      `${S} .a{color:red;display:block}`
    );
  });
});

describe("what the splitter cannot read, it does not emit", () => {
  it.each([
    ['.a{content:"unterminated}', "an unterminated string"],
    [".a{content:'line\nbreak'}", "a string with a raw line break"],
    [".a{color:red}}", "a stray closing brace"],
    [".a{color:red", "an unclosed block"],
    [".a{background:url(x}", "an unclosed url()"],
    [".a)b{color:red}", "a stray closing parenthesis"],
    [".a[b{color:red}", "an unclosed bracket"],
    [".a(b]{color:red}", "mismatched brackets"],
    [".a:is(b{c){color:red}", "a brace inside parentheses"],
  ])("drops the whole sheet for %s (%s)", (css) => {
    expect(scopeTemplateStyles(`.ok{color:red} ${css} .also{color:blue}`)).toBe("");
  });

  it("drops a rule that nests another, keeping its siblings", () => {
    expect(scopeTemplateStyles(".a{color:red} .b{.c{color:blue}} .d{color:green}")).toBe(
      `${S} .a{color:red}${S} .d{color:green}`
    );
    expect(scopeTemplateStyles(".b{color:blue; & .c{color:red}} .d{color:green}")).toBe(`${S} .d{color:green}`);
  });

  it("drops a rule whose selector list has an empty or unsafe member", () => {
    expect(scopeTemplateStyles(".a,{color:red} .b{color:blue}")).toBe(`${S} .b{color:blue}`);
    expect(scopeTemplateStyles(",.a{color:red} .b{color:blue}")).toBe(`${S} .b{color:blue}`);
    expect(scopeTemplateStyles(".a<b{color:red} .b{color:blue}")).toBe(`${S} .b{color:blue}`);
    expect(scopeTemplateStyles(`${".a".repeat(600)}{color:red} .b{color:blue}`)).toBe(`${S} .b{color:blue}`);
  });

  it("never emits a `<`, which could end the <style> element", () => {
    expect(scopeTemplateStyles('.a{content:"</style><img src=x onerror=alert(1)>";color:red}')).toBe(
      `${S} .a{color:red}`
    );
    const commented = scopeTemplateStyles("<!-- .a{color:red} --> .b{color:blue}");
    expect(commented).not.toContain("<");
    expect(commented).not.toContain("color:red");
  });

  it("treats escaped braces and quotes as part of a name, not as structure", () => {
    expect(scopeTemplateStyles(".a\\{b{color:red} .c{color:blue}")).toBe(
      `${S} .a\\{b{color:red}${S} .c{color:blue}`
    );
    expect(scopeTemplateStyles(".a\\\"b{color:red} .c{color:blue}")).toBe(
      `${S} .a\\"b{color:red}${S} .c{color:blue}`
    );
  });

  it("drops a sheet longer than the limit", () => {
    expect(scopeTemplateStyles(`.a{color:red}${" ".repeat(200_001)}`)).toBe("");
  });

  it("never lets its own string marks through", () => {
    const out = scopeTemplateStyles('.a{content:"x";color:red}\u0001\u0002.b{content:"y"}');

    expect(out).not.toMatch(/[\u0000-\u0002]/);
  });
});
