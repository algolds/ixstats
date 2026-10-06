/** @jest-environment node */
/**
 * The sanitizers must really sanitize on the server (tRPC, SSR, route handlers),
 * where there is no `window`. Before plan 335 they returned the input unchanged there.
 */

import {
  sanitizeUserContent,
  sanitizeWikiArticleHtml,
  wikiArticleSanitizerFingerprint,
} from "~/lib/utils/sanitize-html";

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

describe("the article sanitizer's fingerprint (plan 404 review)", () => {
  it("is stable and compact, so stored bundles can carry it", () => {
    const fingerprint = wikiArticleSanitizerFingerprint();

    expect(fingerprint).toMatch(/^[0-9a-f]{8,14}$/);
    expect(wikiArticleSanitizerFingerprint()).toBe(fingerprint);
  });

  it("changes with DOMPurify's version: a sanitizer upgrade invalidates every stored bundle", () => {
    const fingerprintWithVersion = (version?: string): string => {
      let result = "";
      jest.isolateModules(() => {
        if (version) {
          const DOMPurify = require("dompurify") as { version: string };
          Object.defineProperty(DOMPurify, "version", { value: version, configurable: true });
        }
        result = (
          require("~/lib/utils/sanitize-html") as typeof import("~/lib/utils/sanitize-html")
        ).wikiArticleSanitizerFingerprint();
      });
      return result;
    };

    expect(fingerprintWithVersion()).toBe(wikiArticleSanitizerFingerprint());
    expect(fingerprintWithVersion("99.0.0")).not.toBe(wikiArticleSanitizerFingerprint());
    expect(fingerprintWithVersion("99.0.0")).toBe(fingerprintWithVersion("99.0.0"));
  });
});

describe("the article sanitizer's fingerprint and the depth guard (plan F15)", () => {
  /** The fingerprint before HTML nested too deep became an escaped source: hooks version 7, no depth ceiling in it. */
  const FINGERPRINT_BEFORE_THE_DEPTH_GUARD = "f0176dfa84301";

  it("is not the one stored bundles carry from before the guard changed the output, so they re-render", () => {
    expect(wikiArticleSanitizerFingerprint()).not.toBe(FINGERPRINT_BEFORE_THE_DEPTH_GUARD);
  });

  it("changes with the depth ceiling: a bundle sanitized under another ceiling re-renders", () => {
    const fingerprintWithCeiling = (ceiling?: number): string => {
      let result = "";
      jest.isolateModules(() => {
        if (ceiling !== undefined) {
          const real = jest.requireActual<typeof import("~/lib/wiki-os/transformers/inert-dom")>(
            "~/lib/wiki-os/transformers/inert-dom"
          );
          jest.doMock("~/lib/wiki-os/transformers/inert-dom", () => ({
            ...real,
            DOM_DEPTH_CEILING: ceiling,
          }));
        }
        result = (
          require("~/lib/utils/sanitize-html") as typeof import("~/lib/utils/sanitize-html")
        ).wikiArticleSanitizerFingerprint();
      });
      jest.dontMock("~/lib/wiki-os/transformers/inert-dom");
      return result;
    };

    expect(fingerprintWithCeiling()).toBe(wikiArticleSanitizerFingerprint());
    expect(fingerprintWithCeiling(500)).not.toBe(wikiArticleSanitizerFingerprint());
    expect(fingerprintWithCeiling(500)).toBe(fingerprintWithCeiling(500));
  });
});
