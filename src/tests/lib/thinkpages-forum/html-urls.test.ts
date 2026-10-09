/** @jest-environment node */
import { withBasePath } from "~/lib/base-path";
import {
  APP_PATH_PREFIXES,
  hasImageSrc,
  rebaseRootRelativeUrls,
} from "~/lib/thinkpages-forum/html-urls";

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

  it("rebases each attribute of a tag and keeps entities", () => {
    expect(
      rebaseRootRelativeUrls('<a href="/thinkpages/a?x=1&amp;y=2" title="t">a</a>', prefix)
    ).toBe('<a href="/p/thinkpages/a?x=1&amp;y=2" title="t">a</a>');
  });

  it.each([
    "/images/uploads/a.png",
    "/forum/members/7",
    "/thinkpages/t/abc",
    "/api/download/external-image?x=1",
    "/@aria",
    "/r/urcea",
  ])("rebases the app path %s", (url) => {
    expect(rebaseRootRelativeUrls(`<a href="${url}">x</a>`, prefix)).toBe(
      `<a href="/p${url}">x</a>`
    );
  });

  it("covers exactly the app's own prefixes", () => {
    expect(APP_PATH_PREFIXES).toEqual([
      "/images/",
      "/forum/",
      "/thinkpages/",
      "/api/",
      "/@",
      "/r/",
    ]);
  });

  it.each(["/wiki/Foo", "/countries/x", "/", "/imagesx/a.png", "/\\evil.com/x", "//evil.com/x"])(
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
        "/images/uploads/forum/55-abc-x.png",
        "/projects/ixstates/images/uploads/forum/55-abc-x.png",
      ],
      ["/images/downloaded/b.png", "/projects/ixstates/images/downloaded/b.png"],
      ["/projects/ixstates/images/downloaded/x.png", "/projects/ixstates/images/downloaded/x.png"],
      ["https://e.com/c.png", "https://e.com/c.png"],
      ["//host/d.png", "//host/d.png"],
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
    expect(has('<img src="/projects/ixstates/api/mediawiki/ixwiki/images/a/ab/X.png">')).toBe(true);
    expect(has('<img src="data:x"><img src="/images/uploads/a.png">')).toBe(true);
  });

  it.each([
    ["an empty src", '<img src="" alt="">'],
    ["a blank src", '<img src="  " alt="">'],
    ["no src", "<img alt=x>"],
    ["a data: URL", '<img src="data:image/png;base64,AAAA" alt="">'],
    ["a javascript: URL", '<img src=" JavaScript:alert(1)" alt="">'],
    ["a vbscript: URL", '<img src="vbscript:x" alt="">'],
    ["a bare word", '<img src="x">'],
    ["a fragment", '<img src="#">'],
    ["a mailto: URL", '<img src="mailto:a@b.c">'],
    ["a protocol-relative URL", '<img src="//e.com/a.png">'],
    ["an http URL with no host", '<img src="https://">'],
    ["another app path", '<img src="/images/data:x.png" alt="">'],
    ["a bare upload prefix", '<img src="/images/uploads/">'],
    ["another base path", '<img src="/elsewhere/images/uploads/a.png">'],
    ["the base path on its own", '<img src="/projects/ixstates/a.png">'],
    ["a data-src attribute", '<img data-src="/images/uploads/a.png">'],
    ["escaped text", '<p>&lt;img src="/images/uploads/a.png"&gt;</p>'],
    ["no image", "<p></p>"],
  ])("does not count %s", (_, html) => {
    expect(has(html)).toBe(false);
  });

  it("counts unprefixed app paths when there is no base path", () => {
    expect(hasImageSrc('<img src="/images/uploads/a.png">', "")).toBe(true);
    expect(hasImageSrc('<img src="/projects/ixstates/images/uploads/a.png">', "")).toBe(false);
  });
});
