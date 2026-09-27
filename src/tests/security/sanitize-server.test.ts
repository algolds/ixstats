/** @jest-environment node */
/**
 * The sanitizers must really sanitize on the server (tRPC, SSR, route handlers),
 * where there is no `window`. Before plan 335 they returned the input unchanged there.
 */

import { sanitizeUserContent, sanitizeWikiArticleHtml } from "~/lib/utils/sanitize-html";

describe("server-side sanitization (no window)", () => {
  it("runs without a browser window", () => {
    expect(typeof window).toBe("undefined");
  });

  it("removes script tags", () => {
    const out = sanitizeUserContent("<p>x</p><script>alert(1)</script>");
    expect(out).toContain("<p>x</p>");
    expect(out).not.toContain("<script");
  });

  it("removes event handler attributes", () => {
    expect(sanitizeUserContent("<img src=x onerror=alert(1)>")).not.toContain("onerror");
  });

  it("removes javascript: hrefs", () => {
    expect(sanitizeUserContent('<a href="javascript:alert(1)">a</a>')).not.toContain(
      "javascript:"
    );
  });

  it("blanks data: URIs in src", () => {
    const out = sanitizeWikiArticleHtml('<img src="data:image/svg+xml;base64,AAAA">');
    expect(out).not.toContain("data:");
  });

  describe("sanitizeWikiArticleHtml", () => {
    it.each([
      ['<table class="infobox"><tbody><tr><td>x</td></tr></tbody></table>', '<table class="infobox">'],
      ['<sup id="cite_ref-1"><a href="#cite_note-1">[1]</a></sup>', '<sup id="cite_ref-1"><a href="#cite_note-1">'],
      ['<span typeof="mw:Transclusion" data-mw="{}">t</span>', '<span typeof="mw:Transclusion" data-mw="{}">'],
      ['<figure><img src="https://ixwiki.com/images/a.png"></figure>', '<figure><img src="https://ixwiki.com/images/a.png"></figure>'],
    ])("keeps wiki markup %s", (input, expected) => {
      expect(sanitizeWikiArticleHtml(input)).toContain(expected);
    });

    it("keeps live-data placeholders", () => {
      expect(sanitizeWikiArticleHtml("<p>{{MyCountry:gdp}}</p>")).toContain("{{MyCountry:gdp}}");
    });

    it("removes <style> and <iframe>", () => {
      const out = sanitizeWikiArticleHtml(
        '<style>body{display:none}</style><p>ok</p><iframe src="https://evil.example"></iframe>'
      );
      expect(out).toContain("<p>ok</p>");
      expect(out).not.toContain("<style");
      expect(out).not.toContain("<iframe");
    });

    it("removes scripts and handlers", () => {
      const out = sanitizeWikiArticleHtml('<p onclick="x()">a</p><script>alert(1)</script>');
      expect(out).not.toContain("onclick");
      expect(out).not.toContain("<script");
    });
  });
});
