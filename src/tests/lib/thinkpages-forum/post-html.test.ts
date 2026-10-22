/** @jest-environment node */
import {
  embedFileTitle,
  embedTitle,
  embedWidth,
  isPostId,
  linkQuoteSources,
  quotedPostIds,
  relatedWikiTitles,
} from "~/lib/thinkpages-forum/post-html";
import { withBasePath } from "~/lib/base-path";
import { hasImageSrc, rebaseRootRelativeUrls } from "~/lib/thinkpages-forum/html-urls";
import { categoryHref, realmBoardAttachHref } from "~/lib/thinkpages-forum/links";

describe("isPostId", () => {
  it.each(["cnative13", "x".repeat(64)])("accepts %s", (id) => {
    expect(isPostId(id)).toBe(true);
  });

  it.each(["x".repeat(65), 'a"b', "../x", null])("refuses %p", (id) => {
    expect(isPostId(id)).toBe(false);
  });
});

describe("embedTitle", () => {
  it.each(["<script>", 'a"b', "a\nb"])("refuses %p", (title) => {
    expect(embedTitle(title)).toBeNull();
  });
});

describe("embedFileTitle", () => {
  it.each(["File:../secret.png", "File:a.png?x=1", "File:%2e%2e%2fx.png"])(
    "refuses %p",
    (title) => {
      expect(embedFileTitle(title)).toBeNull();
    }
  );
});

describe("embedWidth", () => {
  it("is absent without the attribute, and clamped to 1..1200 with it", () => {
    expect(embedWidth(null)).toEqual({ width: null });
    expect(embedWidth("300")).toEqual({ width: 300 });
    expect(embedWidth("0")).toEqual({ width: 1 });
    expect(embedWidth("5000")).toEqual({ width: 1200 });
  });

  it.each(["12px", "9999999"])("refuses %p", (value) => {
    expect(embedWidth(value)).toBeNull();
  });
});

describe("linkQuoteSources", () => {
  const quote = (attrs: string, author = "Ann &amp; Co wrote:") =>
    `<blockquote ${attrs}><div class="forum-quote-author">${author}</div><div class="forum-quote-body">hi</div></blockquote>`;

  it("links the author line to the quoted post when data-post is a valid id", () => {
    expect(linkQuoteSources(quote('class="forum-quote" data-post="p9"'))).toContain(
      '<div class="forum-quote-author"><a class="forum-quote-source" href="/thinkpages/post/p9">Ann &amp; Co wrote:</a></div>'
    );
  });
  it.each([
    ['class="forum-quote" data-post="a&quot;onmouseover=x"'],
    ['class="forum-quote" data-post="../../admin"'],
  ])("leaves a quote with %s as written", (attrs) => {
    const html = quote(attrs);
    expect(linkQuoteSources(html)).toBe(html);
  });
  it("does not take other markup in the author line as part of the link text", () => {
    const html = quote('class="forum-quote" data-post="p9"', '<img src="x" onerror="y"> wrote:');
    expect(linkQuoteSources(html)).toBe(html);
  });
});

describe("relatedWikiTitles", () => {
  const a = (href: string, cls = "") => `<a href="${href}"${cls ? ` class="${cls}"` : ""}>x</a>`;

  it("lists article titles from relative and absolute wiki links, once each, at most three", () => {
    const html = [
      a("/wiki/River_compacts"),
      a("https://ixwiki.com/wiki/Juan_Kerr", "forum-wikilink"),
      a("/wiki/River_compacts#History"),
      a("/wiki/Fiannria"),
      a("/wiki/Urcea"),
    ].join(" ");
    expect(relatedWikiTitles(html)).toEqual(["River compacts", "Juan Kerr", "Fiannria"]);
  });
});

describe("quotedPostIds", () => {
  it("lists the posts a post quotes, once each, valid ids only", () => {
    const html =
      '<blockquote class="forum-quote" data-post="p1"><div>x</div></blockquote>' +
      '<blockquote data-post="p1"></blockquote>' +
      '<blockquote data-post="bad id!"></blockquote>' +
      '<blockquote data-post="p2"></blockquote>';
    expect(quotedPostIds(html)).toEqual(["p1", "p2"]);
  });

  it("stops at five and ignores a data-post that is not on a blockquote", () => {
    const many = Array.from({ length: 9 }, (_, i) => `<blockquote data-post="q${i}"></blockquote>`);
    expect(quotedPostIds(many.join(""))).toHaveLength(5);
    expect(quotedPostIds('<div data-post="p1"></div><a data-post="p2">x</a>')).toEqual([]);
  });
});

describe("URLs in a stored post", () => {
  const prefix = (path: string) => `/p${path}`;
  describe("rebaseRootRelativeUrls", () => {
    it("rebases root-relative src and href", () => {
      expect(
        rebaseRootRelativeUrls(
          '<p><a href="/images/x">x</a><img src="/images/y" alt="y"></p>',
          prefix
        )
      ).toBe('<p><a href="/p/images/x">x</a><img src="/p/images/y" alt="y"></p>');
    });

    it("leaves absolute, protocol-relative, anchor, mailto and relative URLs alone", () => {
      const html =
        '<p><a href="https://e.com/a">a</a><img src="//cdn.e.com/b.png"><a href="#top">t</a>' +
        '<a href="mailto:a@e.com">m</a><img src="http://e.com/c.png"><a href="x/y">r</a></p>';
      expect(rebaseRootRelativeUrls(html, prefix)).toBe(html);
    });

    it("never touches text, other attributes or quoted look-alikes", () => {
      const html =
        '<p>see src="/images/x" and href="/y"</p><img alt="/images/z" title="a src=&quot;/q&quot;" src="https://e.com/i.png">';
      expect(rebaseRootRelativeUrls(html, prefix)).toBe(html);
    });

    it.each(["/images/uploads/a.png", "/thinkpages/t/abc"])("rebases the app path %s", (url) => {
      expect(rebaseRootRelativeUrls(`<a href="${url}">x</a>`, prefix)).toBe(
        `<a href="/p${url}">x</a>`
      );
    });
    it.each(["/wiki/Foo", "/thinkpagesx", "/\\evil.com/x", "//evil.com/x"])(
      "leaves %s alone",
      (url) => {
        const html = `<a href="${url}">x</a>`;
        expect(rebaseRootRelativeUrls(html, prefix)).toBe(html);
      }
    );

    describe("with withBasePath under /projects/ixstates", () => {
      const saved = { ...process.env };
      beforeEach(() => {
        process.env.NEXT_PUBLIC_BASE_PATH = "/projects/ixstates";
        delete process.env.NEXT_PUBLIC_IXWORLD_STANDALONE;
      });
      afterEach(() => {
        process.env = { ...saved };
      });

      it.each([
        ["/images/uploads/a.png", "/projects/ixstates/images/uploads/a.png"],
        [
          "/projects/ixstates/images/downloaded/x.png",
          "/projects/ixstates/images/downloaded/x.png",
        ],
      ])("src %s becomes %s", (src, expected) => {
        expect(rebaseRootRelativeUrls(`<img src="${src}" alt="">`, withBasePath)).toBe(
          `<img src="${expected}" alt="">`
        );
      });

      it("is idempotent", () => {
        const once = rebaseRootRelativeUrls(
          '<img src="/images/uploads/a.png"><a href="/thinkpages/t/1">t</a>',
          withBasePath
        );
        expect(rebaseRootRelativeUrls(once, withBasePath)).toBe(once);
      });
    });
  });
  describe("hasImageSrc", () => {
    const base = "/projects/ixstates";
    const has = (html: string) => hasImageSrc(html, base);

    it("counts an image whose src is http(s) or an app image path", () => {
      expect(has('<p><img src="/images/uploads/a.png" alt=""></p>')).toBe(true);
      expect(has('<img alt="" src="https://e.com/a.png">')).toBe(true);
      expect(has('<img src="HTTP://e.com/a.png">')).toBe(true);
      expect(has('<img src="/images/downloaded/x.png">')).toBe(true);
      expect(has('<img src="/api/mediawiki/commons/Special:Filepath/A%20b.png">')).toBe(true);
      expect(has('<img src="/projects/ixstates/images/downloaded/x.png">')).toBe(true);
      expect(has('<img src="/projects/ixstates/images/uploads/forum/1-abc-x.png">')).toBe(true);
      expect(has('<img src="/projects/ixstates/api/mediawiki/ixwiki/images/a/ab/X.png">')).toBe(
        true
      );
      expect(has('<img src="data:x"><img src="/images/uploads/a.png">')).toBe(true);
    });

    it.each([
      ["a data: URL", '<img src="data:image/png;base64,AAAA" alt="">'],
      ["a javascript: URL", '<img src=" JavaScript:alert(1)" alt="">'],
      ["a protocol-relative URL", '<img src="//e.com/a.png">'],
      ["another app path", '<img src="/images/data:x.png" alt="">'],
      ["another base path", '<img src="/elsewhere/images/uploads/a.png">'],
      ["escaped text", '<p>&lt;img src="/images/uploads/a.png"&gt;</p>'],
    ])("does not count %s", (_, html) => {
      expect(has(html)).toBe(false);
    });
  });
});

describe("links the forum builds", () => {
  describe("forum links", () => {
    it("encodes slugs so they cannot add path segments or query parameters", () => {
      expect(categoryHref({ key: "hub", realm: { slug: "../x" } })).toBe(
        "/thinkpages/r/..%2Fx/hub"
      );
    });
  });
  describe("attach links", () => {
    it("encodes the slug and the id, so neither can add a parameter", () => {
      expect(realmBoardAttachHref("a b", "x&y=1")).toBe("/thinkpages/r/a%20b?attach=x%26y%3D1");
    });
  });
});
