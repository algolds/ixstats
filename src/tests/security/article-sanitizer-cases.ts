/**
 * The article sanitizer's parity cases (plan 415, COMPAT-10), run twice: on the server (jsdom window created
 * by the module, `article-sanitizer-parity.test.ts`) and in a browser-like environment (Jest's jsdom window,
 * `article-sanitizer-parity-browser.test.ts`), which take different paths to a DOMPurify instance.
 */
import { sanitizeWikiArticleHtml } from "~/lib/utils/sanitize-html";

const S = ".wikios-article";

/** The attribute TemplateStyles puts on its `<style>`. */
const STYLE_OPEN = '<style data-mw-deduplicate="TemplateStyles:r1">';

export function describeArticleSanitizerParity(): void {
  describe("tags and attributes MediaWiki's Sanitizer allows", () => {
    it("keeps a legacy wikitext table with its presentation attributes", () => {
      const html =
        '<table border="1" cellpadding="4" cellspacing="0" bgcolor="#eeeeee" align="center" width="50%" summary="s">' +
        '<caption align="top">c</caption><colgroup><col span="2" width="10"></colgroup>' +
        '<tbody><tr bgcolor="red" valign="top"><th scope="col" headers="h" abbr="a" axis="x">h</th>' +
        '<td rowspan="2" colspan="2" valign="top" align="right" bgcolor="red" nowrap="nowrap" height="20" width="30">x</td></tr></tbody></table>';

      expect(sanitizeWikiArticleHtml(html)).toBe(html);
    });

    it.each([
      '<center>c</center>',
      '<font color="red" size="3" face="Arial">f</font>',
      "<del>d</del>",
      '<ins datetime="2020-01-01" cite="https://x.example/">i</ins>',
      "<big>b</big>",
      "<tt>t</tt>",
      "<kbd>k</kbd>",
      "<samp>s</samp>",
      "<var>v</var>",
      "<dfn>d</dfn>",
      "<strike>s</strike>",
      '<bdo dir="rtl">r</bdo>',
      '<bdi lang="ar">b</bdi>',
      '<data value="1">d</data>',
      '<time datetime="2020-01-01">t</time>',
      "<mark>m</mark>",
      "<ruby>漢<rp>(</rp><rt>kan</rt><rp>)</rp></ruby>",
      '<ol start="3" type="a"><li value="5">x</li></ol>',
      '<ul type="square"><li>x</li></ul>',
      "<p>a<wbr>b</p>",
      '<abbr title="t">a</abbr><q cite="https://x.example/">q</q><cite>c</cite><s>s</s><u>u</u><small>s</small><sub>2</sub><sup>3</sup>',
    ])("keeps %s", (html) => {
      expect(sanitizeWikiArticleHtml(html)).toBe(html);
    });

    it("keeps `reversed` on a list", () => {
      expect(sanitizeWikiArticleHtml('<ol reversed start="3"><li>x</li></ol>')).toContain("reversed");
    });

    it("keeps lang, dir and title on any element", () => {
      const html = '<p lang="fr" dir="ltr" title="t">x</p>';

      expect(sanitizeWikiArticleHtml(html)).toBe(html);
    });
  });

  describe("what MediaWiki's Sanitizer blocks stays blocked", () => {
    it.each([
      ["<script>alert(1)</script><p>x</p>", "<script"],
      ["<iframe src=\"https://evil.example\"></iframe>", "<iframe"],
      ['<object data="x.swf"></object>', "<object"],
      ['<embed src="x.swf">', "<embed"],
      ['<form action="https://evil.example"><input name="a"><button>b</button></form>', "<form"],
      ['<input type="text" value="x">', "<input"],
      ["<select><option>a</option></select>", "<select"],
      ["<textarea>t</textarea>", "<textarea"],
      ['<link rel="stylesheet" href="https://evil.example/x.css">', "<link"],
      ['<meta http-equiv="refresh" content="0;url=https://evil.example">', "<meta"],
      ['<base href="https://evil.example/">', "<base"],
      ['<svg onload="alert(1)"></svg>', "<svg"],
      ['<math><mi xlink:href="javascript:alert(1)">x</mi></math>', "<math"],
    ])("removes %s", (html, forbidden) => {
      expect(sanitizeWikiArticleHtml(html)).not.toContain(forbidden);
    });

    it.each([
      '<p onclick="alert(1)">x</p>',
      '<img src="https://x.example/a.png" onerror="alert(1)">',
      '<font color="red" onmouseover="alert(1)">f</font>',
      '<table border="1" onload="alert(1)"><tr><td onclick="x()">c</td></tr></table>',
      '<center onfocus="alert(1)">c</center>',
    ])("removes event handlers from %s", (html) => {
      expect(sanitizeWikiArticleHtml(html)).not.toMatch(/\bon[a-z]+=/i);
    });

    it.each([
      '<a href="javascript:alert(1)">x</a>',
      '<a href="  JaVaScRiPt:alert(1)">x</a>',
      '<a href="&#106;avascript:alert(1)">x</a>',
      '<a href="data:text/html,<script>alert(1)</script>">x</a>',
      '<img src="data:image/svg+xml;base64,AAAA">',
      '<ins cite="javascript:alert(1)">x</ins>',
      '<font color="javascript:alert(1)">x</font>',
      '<ol type="javascript:alert(1)"><li>x</li></ol>',
      '<td bgcolor="javascript:alert(1)">x</td>',
    ])("removes script and data URLs from %s", (html) => {
      const out = sanitizeWikiArticleHtml(html).toLowerCase();

      expect(out).not.toContain("javascript:");
      expect(out).not.toContain("data:");
    });

    it("does not allow the presentational attributes to smuggle a style: `background` stays out", () => {
      expect(sanitizeWikiArticleHtml('<table background="https://x.example/a.png"><tr><td>x</td></tr></table>')).not.toContain(
        "background="
      );
    });
  });

  describe("TemplateStyles", () => {
    it("keeps a <style data-mw-deduplicate> and scopes its selectors under the article", () => {
      const out = sanitizeWikiArticleHtml(
        `${STYLE_OPEN}.mw-parser-output .home-grid{display:grid}.mw-parser-output .a, .b > c{color:red}</style><p>after</p>`
      );

      expect(out).toBe(
        `${STYLE_OPEN}${S} .home-grid{display:grid}${S} .a,${S} .b > c{color:red}</style><p>after</p>`
      );
    });

    it("keeps a style that opens the article (it must not be taken for <head> content)", () => {
      expect(sanitizeWikiArticleHtml(`${STYLE_OPEN}.a{color:red}</style>`)).toBe(
        `${STYLE_OPEN}${S} .a{color:red}</style>`
      );
      expect(sanitizeWikiArticleHtml(`  \n${STYLE_OPEN}.a{color:red}</style><p>x</p>`)).toContain(
        `${S} .a{color:red}`
      );
    });

    it("keeps @media blocks and drops @import, @font-face and the like", () => {
      const out = sanitizeWikiArticleHtml(
        `${STYLE_OPEN}@import url(https://evil.example/x.css);@font-face{font-family:x;src:url(https://x.example/f.woff)}` +
          "@media (max-width:600px){.mw-parser-output .x{color:blue}}.y{color:red}</style>"
      );

      expect(out).toBe(`${STYLE_OPEN}@media (max-width:600px){${S} .x{color:blue}}${S} .y{color:red}</style>`);
    });

    it("strips url() that is not https or relative, expression(), behavior and -moz-binding", () => {
      const out = sanitizeWikiArticleHtml(
        `${STYLE_OPEN}.a{background:url(javascript:alert(1));width:expression(alert(1));behavior:url(x.htc);` +
          "-moz-binding:url(x.xml#a);background-image:url(data:text/html,x);" +
          "color:red;background:url(https://ixwiki.com/images/a.png)}</style>"
      );

      expect(out).toBe(`${STYLE_OPEN}${S} .a{color:red;background:url(https://ixwiki.com/images/a.png)}</style>`);
    });

    it("removes a <style> that is not TemplateStyles' (no data-mw-deduplicate)", () => {
      const out = sanitizeWikiArticleHtml("<style>body{display:none}</style><p>ok</p>");

      expect(out).toBe("<p>ok</p>");
    });

    it("removes a TemplateStyles style when nothing survives the filter", () => {
      expect(sanitizeWikiArticleHtml(`${STYLE_OPEN}@import url(x);</style><p>ok</p>`)).toBe("<p>ok</p>");
      expect(sanitizeWikiArticleHtml(`${STYLE_OPEN}</style><p>ok</p>`)).toBe("<p>ok</p>");
    });

    it("keeps no attribute of the style but its own marker", () => {
      const out = sanitizeWikiArticleHtml(
        '<style data-mw-deduplicate="r1" media="print" onload="alert(1)" class="c" id="i" title="t" type="text/css">.a{color:red}</style>'
      );

      expect(out).toBe(`<style data-mw-deduplicate="r1">${S} .a{color:red}</style>`);
    });

    it("removes a <style> inside <svg> or <math>, where its content would be parsed as markup", () => {
      const svg = sanitizeWikiArticleHtml('<svg><style data-mw-deduplicate="x"><img src=x onerror=alert(1)></style></svg><p>ok</p>');
      const math = sanitizeWikiArticleHtml('<math><style data-mw-deduplicate="x"><img src=x onerror=alert(1)></style></math><p>ok</p>');

      for (const out of [svg, math]) {
        expect(out).not.toContain("<style");
        expect(out).not.toContain("onerror");
      }
    });

    it("cannot be broken out of: a `</style>` in the CSS ends the element, and what follows is sanitized page content", () => {
      const out = sanitizeWikiArticleHtml(
        `${STYLE_OPEN}.a{content:"</style><img src=x onerror=alert(1)>";color:red}</style><p>ok</p>`
      );

      expect(out).not.toContain("onerror");
      expect(out).not.toMatch(/<style[^>]*>[^<]*<(?!\/style>)/);
    });

    it("never keeps a `<` inside the style: the declaration that holds it is dropped", () => {
      const out = sanitizeWikiArticleHtml(`${STYLE_OPEN}.a{content:"<b>";color:red}</style>`);

      expect(out).toBe(`${STYLE_OPEN}${S} .a{color:red}</style>`);
    });

    it("cannot be broken out of through the page around it", () => {
      const out = sanitizeWikiArticleHtml(
        `<p></style><img src=x onerror=alert(1)>${STYLE_OPEN}.a{color:red}</style>`
      );

      expect(out).not.toContain("onerror");
    });

    it("is idempotent: sanitizing sanitized HTML changes nothing (the render pipeline sanitizes twice)", () => {
      const once = sanitizeWikiArticleHtml(
        `${STYLE_OPEN}.mw-parser-output .a, .b{color:red}@media print{.c{color:blue}}</style><table border="1"><tr><td bgcolor="red">x</td></tr></table>`
      );

      expect(sanitizeWikiArticleHtml(once)).toBe(once);
    });

    it("scopes a style in the middle of an article too", () => {
      const out = sanitizeWikiArticleHtml(`<div class="mw-parser-output"><p>a</p>${STYLE_OPEN}.mw-parser-output .a{color:red}</style><p>b</p></div>`);

      expect(out).toBe(`<div class="mw-parser-output"><p>a</p>${STYLE_OPEN}${S} .a{color:red}</style><p>b</p></div>`);
    });
  });
}
