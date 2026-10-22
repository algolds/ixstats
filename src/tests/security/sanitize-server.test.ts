/** @jest-environment node */
/**
 * The sanitizers must really sanitize on the server (tRPC, SSR, route handlers),
 * where there is no `window`. Before plan 335 they returned the input unchanged there.
 * The article sanitizer's fingerprint changes with anything that changes its output (DOMPurify's
 * version, the depth ceiling, the TemplateStyles switch), so stored bundles re-render. Plan 415
 * re-review: `WIKIOS_TEMPLATESTYLES=0` is the emergency lever if a CSS bypass is reported; it fails
 * safe (anything but an explicit yes turns TemplateStyles off).
 *
 * User content keeps the forum import's wiki and quote attributes, which cannot break out of their attribute. An
 * uploaded SVG keeps its drawing and loses everything that runs or loads (script, handlers, javascript: links,
 * foreignObject, external url() and use references, CSS escapes), and comes back well-formed XML.
 *
 * Folds strip-html-ssr, template-styles-switch, sanitize-user-content-forum-attrs and svg-sanitize.
 */
import { JSDOM } from "jsdom";
import { sanitizeSvg } from "~/lib/media/svg-sanitize";

import {
  sanitizeUserContent,
  sanitizeWikiArticleHtml,
  stripHtml,
  wikiArticleSanitizerFingerprint,
} from "~/lib/utils/sanitize-html";

describe("server-side sanitization (no window)", () => {
  it("runs without a browser window", () => {
    expect(typeof window).toBe("undefined");
  });

  it.each([
    ["a script tag", "<p>x</p><script>alert(1)</script>", "<script"],
    ["an event handler attribute", "<img src=x onerror=alert(1)>", "onerror"],
    ["a javascript: href", '<a href="javascript:alert(1)">a</a>', "javascript:"],
  ])("removes %s from user content", (_case, input, removed) => {
    expect(sanitizeUserContent(input)).not.toContain(removed);
  });

  it("blanks data: URIs in an article's src", () => {
    expect(sanitizeWikiArticleHtml('<img src="data:image/svg+xml;base64,AAAA">')).not.toContain(
      "data:"
    );
  });

  it("strips HTML to text exactly as the browser path does: entities decoded, block tags spaced", () => {
    expect(stripHtml("<p>Fish &amp; chips<br>&quot;cod&quot; &#8211; &hellip;</p>")).toBe(
      'Fish & chips "cod" – …'
    );
    expect(stripHtml("A<br>B")).toBe("A B");
    expect(stripHtml("a&nbsp;&nbsp;b")).toBe("a b");
  });

  describe("sanitizeWikiArticleHtml", () => {
    it.each([
      [
        '<table class="infobox"><tbody><tr><td>x</td></tr></tbody></table>',
        '<table class="infobox">',
      ],
      [
        '<sup id="cite_ref-1"><a href="#cite_note-1">[1]</a></sup>',
        '<sup id="cite_ref-1"><a href="#cite_note-1">',
      ],
      [
        '<span typeof="mw:Transclusion" data-mw="{}">t</span>',
        '<span typeof="mw:Transclusion" data-mw="{}">',
      ],
      [
        '<figure><img src="https://ixwiki.com/images/a.png"></figure>',
        '<figure><img src="https://ixwiki.com/images/a.png"></figure>',
      ],
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

describe("WIKIOS_TEMPLATESTYLES", () => {
  const PAGE =
    '<style data-mw-deduplicate="TemplateStyles:r1">.box{color:red}</style><style>.plain{color:blue}</style>' +
    '<div class="box">Text</div>';

  interface Loaded {
    html: string;
    fingerprint: string;
    enabled: boolean;
  }

  /** The config is built when its module loads, so each mode loads the modules afresh. */
  function loadWith(value: string | undefined): Loaded {
    const previous = process.env.WIKIOS_TEMPLATESTYLES;
    if (value === undefined) delete process.env.WIKIOS_TEMPLATESTYLES;
    else process.env.WIKIOS_TEMPLATESTYLES = value;
    try {
      let loaded: Loaded | null = null;
      jest.isolateModules(() => {
        const sanitizer =
          require("~/lib/utils/sanitize-html") as typeof import("~/lib/utils/sanitize-html");
        const config = require("~/lib/wiki-os/config") as typeof import("~/lib/wiki-os/config");
        loaded = {
          html: sanitizer.sanitizeWikiArticleHtml(PAGE),
          fingerprint: sanitizer.wikiArticleSanitizerFingerprint(),
          enabled: config.wikiosConfig.templateStyles,
        };
      });
      if (!loaded) throw new Error("the sanitizer did not load");
      return loaded;
    } finally {
      if (previous === undefined) delete process.env.WIKIOS_TEMPLATESTYLES;
      else process.env.WIKIOS_TEMPLATESTYLES = previous;
    }
  }
  const on = loadWith(undefined);

  it("is on by default: TemplateStyles' <style> stays, scoped to the article root, and any other <style> goes", () => {
    expect(on.enabled).toBe(true);
    expect(on.html).toContain(
      '<style data-mw-deduplicate="TemplateStyles:r1">.mw-parser-output .box{color:red}</style>'
    );
    expect(on.html).not.toContain("plain");
    expect(on.html).toContain('<div class="box">Text</div>');
  });

  it.each(["0", "OFF", "anything", "tru"])(
    "%j turns it off, a typo included: no <style> survives, the markup does",
    (value) => {
      const off = loadWith(value);
      expect(off.enabled).toBe(false);
      expect(off.html).toBe('<div class="box">Text</div>');
    }
  );

  it.each(["1", "", " Yes "])("%j leaves it on", (value) => {
    const same = loadWith(value);
    expect(same.enabled).toBe(true);
    expect(same.html).toBe(on.html);
    expect(same.fingerprint).toBe(on.fingerprint);
  });

  it("changes the sanitizer fingerprint, so stored bundles are re-rendered when it is toggled", () => {
    const off = loadWith("0");
    expect(off.fingerprint).not.toBe(on.fingerprint);
    expect(loadWith("0").fingerprint).toBe(off.fingerprint);
  });
});

describe("sanitizeUserContent and the forum import's wiki and quote attributes", () => {
  it("keeps class, data-post, data-wiki-embed, data-wiki-title and data-width", () => {
    const html =
      '<blockquote class="forum-quote" data-post="abc123"><div>q</div></blockquote>' +
      '<div class="forum-wiki-embed" data-wiki-embed="image" data-wiki-title="File:X.jpg" data-width="300"><a href="https://ixwiki.com/wiki/File:X.jpg">File:X.jpg</a></div>' +
      '<a href="https://ixwiki.com/wiki/Y" class="forum-wikilink" data-wiki-title="Y">Y</a>';
    expect(sanitizeUserContent(html)).toBe(html);
  });

  it.each([
    [
      "a data-wiki-title that tries to close the attribute and open a script",
      "<a href=\"https://ixwiki.com/wiki/X\" data-wiki-title='&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;'>x</a>",
      '<a href="https://ixwiki.com/wiki/X">x</a>',
    ],
    [
      "a quote character in data-wiki-title, kept escaped inside the attribute",
      '<a data-wiki-title="Say &quot;hi&quot; onmouseover=x">x</a>',
      '<a data-wiki-title="Say &quot;hi&quot; onmouseover=x">x</a>',
    ],
    [
      "an event handler and an unlisted data attribute beside a kept one",
      '<div data-wiki-title="T" onclick="x()" data-other="1">t</div>',
      '<div data-wiki-title="T">t</div>',
    ],
  ])("neutralises %s", (_case, input, expected) => {
    expect(sanitizeUserContent(input)).toBe(expected);
  });
});

describe("sanitizeSvg", () => {
  /** Parses `markup` the way a browser reads a stored .svg file; the parse error text, or null when well-formed. */
  function xmlError(markup: string): string | null {
    const { DOMParser } = new JSDOM("").window;
    const doc = new DOMParser().parseFromString(markup, "image/svg+xml");
    return doc.getElementsByTagName("parsererror")[0]?.textContent ?? null;
  }
  const wrap = (inner: string) =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">${inner}</svg>`;

  it("keeps a plain svg, with its namespace", () => {
    const out = sanitizeSvg("<svg><rect/></svg>");
    expect(out).toContain("<svg");
    expect(out).toContain("<rect");
    expect(out).toContain("xmlns=");
  });

  it.each([
    ["a script element", wrap("<script>alert(1)</script><rect/>"), /script|alert/i],
    [
      "event handler attributes",
      '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><rect onclick="x()"/></svg>',
      /onload|onclick|alert/i,
    ],
    [
      "javascript: links",
      wrap('<a href="javascript:alert(1)"><text>x</text></a>'),
      /javascript|href/i,
    ],
    [
      "foreignObject",
      wrap("<foreignObject><div>hi</div></foreignObject><rect/>"),
      /foreignObject|<div/i,
    ],
    [
      "a style that imports another resource",
      wrap("<style>@import url(https://evil.example/a.css);</style><rect/>"),
      /evil\.example/,
    ],
    [
      "a style attribute that loads an external url",
      wrap('<rect style="fill:url(https://x.example/a)"/>'),
      /x\.example/,
    ],
    [
      "a CSS escape in a style attribute",
      wrap('<rect style="fill:\\75 rl(https://x.example/a)"/>'),
      /x\.example/,
    ],
    [
      "a CSS escape in a style element",
      wrap("<style>.a{fill:\\75 rl(https://x.example/a)}</style><rect/>"),
      /x\.example/,
    ],
    ...["fill", "filter", "mask", "clip-path", "marker-start"].map(
      (attr) =>
        [
          `an external url in ${attr}`,
          wrap(`<rect ${attr}="url(https://x.example/a)"/>`),
          /x\.example/,
        ] as const
    ),
  ])("removes %s", (_case, input, removed) => {
    expect(sanitizeSvg(input)).not.toMatch(removed);
  });

  it("removes external use references but keeps fragment ones and same-document urls", () => {
    const out = sanitizeSvg(
      wrap(
        '<defs><g id="a"/><linearGradient id="g"/></defs><use href="https://evil.example/x.svg#a"/><use href="#a"/>' +
          '<rect fill="url(#g)"/><style>.a{fill:url("#g")}</style>'
      )
    );
    expect(out).not.toContain("evil.example");
    expect(out).toContain('href="#a"');
    expect(out).toContain('fill="url(#g)"');
    expect(out).toContain('url("#g")');
  });

  it("round-trips a non-breaking space as well-formed XML", () => {
    const out = sanitizeSvg(wrap('<text aria-label="a\u00a0b">a\u00a0b</text>'));
    expect(out).not.toContain("&nbsp;");
    expect(out).toContain("a\u00a0b");
    expect(xmlError(out ?? "")).toBeNull();
  });

  it("returns null when no svg root remains", () => {
    expect(sanitizeSvg("<script>alert(1)</script>")).toBeNull();
    expect(sanitizeSvg("not an svg")).toBeNull();
  });
});
